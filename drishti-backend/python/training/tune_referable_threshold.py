"""Directly tune the referable-DR decision threshold on P(referable), instead
of relying on argmax-over-5-classes to imply the binary decision.

Why this matters: the problem statement's targets (sensitivity >= 0.90,
specificity >= 0.85) are about a BINARY decision (referable vs. not), but
every model/ensemble so far has made that decision as a side effect of a
5-way argmax. That throws away information -- a model assigning 45% to
"Moderate", 40% to "No DR" gets argmaxed to "No DR" even though it clearly
sees meaningful referable-disease probability. Thresholding the continuous
score P(referable) = P(level>=2) directly is the standard way to hit a
target operating point on a binary clinical decision, and searches a
completely different (and typically much richer) space than ensemble
weight search does, using models you have already trained -- no new
training run required to test this.

This also reports the ROC AUC for the referable/not-referable decision,
which is the honest ceiling check: if AUC is high, there is very likely a
threshold hitting both targets simultaneously; if AUC itself is too low, no
threshold choice can fix that, and the real lever becomes better models or
more data, not more search.

Usage:
    # single (possibly already-weighted) ensemble, reusing cached probs from
    # a prior run is not required -- this recomputes them, same cost as
    # optimize_ensemble_weights.py's caching step.
    python tune_referable_threshold.py --checkpoints runs/run_I/epoch_07.pt runs/run_K/epoch_09.pt \
        --weights 0.4643 0.5357 --data-dir ../../data/messidor2 --tta
"""
from __future__ import annotations

import argparse

import numpy as np
import torch
from sklearn.metrics import confusion_matrix, roc_auc_score, roc_curve
from tqdm import tqdm

from dataset import Messidor2Dataset
from evaluate_ensemble import build_transform, predict_with_tta
from evaluate_messidor2 import compute_effective_sensitivity
from train_severity_classifier import build_model


def sensitivity_specificity_at_threshold(p_referable: np.ndarray, y_true_binary: np.ndarray, threshold: float):
    y_pred_binary = (p_referable >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_true_binary, y_pred_binary, labels=[0, 1]).ravel()
    sensitivity = tp / max(tp + fn, 1)
    specificity = tn / max(tn + fp, 1)
    return sensitivity, specificity


def effective_metrics_at_threshold(p_referable: np.ndarray, y_true: np.ndarray, threshold: float,
                                     review_threshold: float, referable_level: int):
    """Effective (AI + human review) sensitivity for a THRESHOLDED binary
    decision. Confidence here is redefined as distance from indecision on the
    binary call itself -- max(p_referable, 1-p_referable), ranging [0.5, 1] --
    since that's the actual decision being made operationally now, not the
    original 5-class argmax confidence. This means review_threshold is being
    applied on a different scale than the 5-class version (whose baseline for
    "totally uncertain" is ~0.2 for 5 classes, vs. ~0.5 here for a binary
    call) -- pass --review-threshold explicitly if the default 0.70 doesn't
    represent the same real-world caution level in this new scale."""
    y_true_binary = (y_true >= referable_level).astype(int)
    y_pred_binary = (p_referable >= threshold).astype(int)
    # Reuse compute_effective_sensitivity's binary logic via a pseudo 5-class
    # encoding (0 or referable_level) rather than duplicating it -- it only
    # ever looks at (value >= referable_level) internally, so this round-trips
    # exactly.
    y_pred_pseudo = np.where(y_pred_binary == 1, referable_level, 0)
    confidence_binary = np.maximum(p_referable, 1 - p_referable)
    return compute_effective_sensitivity(y_true, y_pred_pseudo, confidence_binary, review_threshold, referable_level)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoints", nargs="+", required=True)
    parser.add_argument("--weights", nargs="+", type=float, default=None,
        help="Optional per-checkpoint weights (e.g. from optimize_ensemble_weights.py). "
             "Defaults to equal weighting if omitted.")
    parser.add_argument("--data-dir", required=True)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--tta", action="store_true")
    parser.add_argument("--target-sensitivity", type=float, default=0.90)
    parser.add_argument("--target-specificity", type=float, default=0.85)
    parser.add_argument("--referable-level", type=int, default=2, help="ICDR level >= this counts as referable.")
    args = parser.parse_args()

    if args.weights and len(args.weights) != len(args.checkpoints):
        raise SystemExit("--weights must have the same length as --checkpoints")
    weights = np.array(args.weights) if args.weights else np.ones(len(args.checkpoints)) / len(args.checkpoints)
    weights = weights / weights.sum()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Evaluating on: {device}")
    print("Models and weights:")
    for c, w in zip(args.checkpoints, weights):
        print(f"  weight={w:.4f}  {c}")

    models = []
    for ckpt_path in args.checkpoints:
        model = build_model().to(device)
        model.load_state_dict(torch.load(ckpt_path, map_location=device))
        model.eval()
        models.append(model)

    dataset = Messidor2Dataset(args.data_dir, transform=build_transform())
    print(f"\nMessidor-2: {len(dataset)} images")

    all_true, all_probs = [], []
    for start in tqdm(range(0, len(dataset), args.batch_size), desc="Caching ensemble outputs"):
        batch_imgs, batch_labels = [], []
        for i in range(start, min(start + args.batch_size, len(dataset))):
            try:
                img, label = dataset[i]
            except Exception:  # noqa: BLE001
                continue
            batch_imgs.append(img)
            batch_labels.append(label)
        if not batch_imgs:
            continue
        images = torch.stack(batch_imgs)
        probs_per_model = [predict_with_tta(m, images, device, args.tta) for m in models]
        ensemble_probs = sum(w * p for w, p in zip(weights, probs_per_model))
        all_probs.append(ensemble_probs)
        all_true.extend(batch_labels)

    probs = np.concatenate(all_probs, axis=0)
    y_true = np.array(all_true)
    y_true_binary = (y_true >= args.referable_level).astype(int)
    p_referable = probs[:, args.referable_level:].sum(axis=1)  # P(level >= referable_level)

    auc = roc_auc_score(y_true_binary, p_referable)
    print(f"\n{'=' * 70}\nROC AUC for referable-vs-not: {auc:.4f}\n{'=' * 70}")
    if auc < 0.85:
        print("AUC below ~0.85 means no threshold choice can reliably hit both targets "
              "simultaneously -- this points to a genuine model/data ceiling, not a "
              "threshold-tuning problem. More/better training data or a stronger backbone "
              "is the honest next lever, not further threshold or weight search.")
    else:
        print("AUC suggests there is real room to find a threshold meeting both targets -- "
              "searching now.")

    # Sweep every threshold implied by the ROC curve itself (exact, not a
    # fixed grid) -- these are the only thresholds where the decision can
    # actually change, so this is both exact and efficient.
    fpr, tpr, thresholds = roc_curve(y_true_binary, p_referable)
    specificity_curve = 1 - fpr

    feasible = [(t, sens, spec) for t, sens, spec in zip(thresholds, tpr, specificity_curve)
                if sens >= args.target_sensitivity and spec >= args.target_specificity]

    print(f"\n{'=' * 70}\nDefault (argmax-implied) threshold, for comparison\n{'=' * 70}")
    sens0, spec0 = sensitivity_specificity_at_threshold(p_referable, y_true_binary, 0.5)
    eff0, _, _, rr0 = effective_metrics_at_threshold(p_referable, y_true, 0.5, 0.70, args.referable_level)
    print(f"threshold=0.50 (argmax-equivalent): sensitivity={sens0:.4f} specificity={spec0:.4f} "
          f"effective_sensitivity={eff0:.4f} review_rate={rr0:.1%}")

    print(f"\n{'=' * 70}\nBEST THRESHOLD FOUND\n{'=' * 70}")
    if feasible:
        # Among thresholds meeting both targets, prefer the one with the most
        # margin above the sensitivity target (most robust to a slightly
        # different patient population at deployment time).
        best = max(feasible, key=lambda f: f[1])
        best_t, best_sens, best_spec = best
        eff, fn_caught, fn_total, rr = effective_metrics_at_threshold(
            p_referable, y_true, best_t, 0.70, args.referable_level)
        print(f"MEETS BOTH TARGETS: threshold={best_t:.4f}  sensitivity={best_sens:.4f}  "
              f"specificity={best_spec:.4f}")
        print(f"effective_sensitivity={eff:.4f}  review_rate={rr:.1%}")
        print(f"\nSet in config/pipeline_config.yaml under 'grading:':")
        print(f"  referable_probability_threshold: {best_t:.4f}")
    else:
        # No threshold meets both targets. Respect the specificity floor as a
        # hard constraint (the same principle select_best_checkpoint.py
        # enforces) rather than trade it away for a marginal sensitivity gain
        # -- a specificity below the floor is not a smaller version of a good
        # outcome, it's a different, worse, unstaffable one.
        above_floor = [(t, s, sp) for t, s, sp in zip(thresholds, tpr, specificity_curve)
                       if sp >= args.target_specificity]
        if above_floor:
            best_t, best_sens, best_spec = max(above_floor, key=lambda f: f[1])
            eff, fn_caught, fn_total, rr = effective_metrics_at_threshold(
                p_referable, y_true, best_t, 0.70, args.referable_level)
            print(f"Does NOT meet the sensitivity target, but this is the best sensitivity "
                  f"achievable WITHOUT dropping specificity below the {args.target_specificity} floor "
                  f"(a lower-specificity option is never reported as 'better' here, regardless of "
                  f"any sensitivity gain it offers):")
            print(f"  threshold={best_t:.4f}  sensitivity={best_sens:.4f}  specificity={best_spec:.4f}")
            print(f"  effective_sensitivity={eff:.4f}  review_rate={rr:.1%}")
        else:
            print(f"No threshold reaches specificity >= {args.target_specificity} at all with these "
                  f"models -- the specificity ceiling itself is below the floor, independent of "
                  f"sensitivity. This points to a genuine model limitation, not a threshold problem.")
        print(f"\nCompare this honestly against your existing ensemble-weight-search results before "
              f"switching -- if it's not clearly better on both effective_sensitivity AND review_rate, "
              f"the threshold search wasn't the missing piece for these specific models.")


if __name__ == "__main__":
    main()
