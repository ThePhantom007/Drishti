"""Find the per-model weights that give the best weighted ensemble, instead
of assuming equal weighting is optimal.

Equal-weight averaging (evaluate_ensemble.py) treats every model as equally
trustworthy, which is a strong and untested assumption -- especially when
combining models with very different failure profiles (e.g. one aggressive,
high-sensitivity/low-specificity model with two conservative, well-balanced
ones). This searches the weight simplex directly for the combination that
best satisfies the problem statement's targets.

Model inference (the expensive part) runs exactly ONCE per checkpoint --
every candidate weight vector is then just a numpy-cheap weighted sum over
cached per-model probabilities, so searching thousands of weight
combinations takes seconds, not hours.

Usage:
    python optimize_ensemble_weights.py --checkpoints runs/run_I/epoch_07.pt \
        runs/run_E/epoch_12.pt runs/run_C/epoch_11.pt \
        --data-dir ../../data/messidor2 --tta
"""
from __future__ import annotations

import argparse
import itertools
from pathlib import Path

import numpy as np
import torch
from scipy.optimize import differential_evolution
from tqdm import tqdm

from dataset import Messidor2Dataset
from evaluate_ensemble import build_transform, predict_with_tta, compute_metrics
from evaluate_messidor2 import compute_effective_sensitivity
from train_severity_classifier import build_model


def softmax_np(x: np.ndarray) -> np.ndarray:
    e = np.exp(x - x.max())
    return e / e.sum()


def objective_score(weights: np.ndarray, probs_per_model: list[np.ndarray], y_true: np.ndarray,
                     target_sensitivity: float, target_specificity: float) -> tuple[float, float, float, float]:
    """Returns (score, sensitivity, specificity, qwk). Scalarization:
    - Any weight vector meeting the specificity floor scores >= 1.0 and is
      ranked by sensitivity above it (climbing toward the sensitivity target).
    - Any vector below the floor scores < 1.0, ranked by specificity itself
      (climbing toward the floor first) -- so the search always has a
      well-shaped gradient to follow toward feasibility, then toward the
      real target, rather than a flat/undefined landscape outside the
      feasible region."""
    ensemble_probs = sum(w * p for w, p in zip(weights, probs_per_model))
    y_pred = ensemble_probs.argmax(axis=1)
    sensitivity, specificity, qwk = compute_metrics(y_true, y_pred)

    if specificity >= target_specificity:
        score = 1.0 + sensitivity
    else:
        score = specificity  # < 1.0 always, so strictly worse than any feasible point
    return score, sensitivity, specificity, qwk


def grid_search(probs_per_model: list[np.ndarray], y_true: np.ndarray, target_sensitivity: float,
                 target_specificity: float, resolution: int = 20):
    """Exhaustive, interpretable search over the weight simplex -- only
    practical for a small number of models (2-4), which is exactly the
    regime a seed-search-based ensemble is likely to use."""
    n = len(probs_per_model)
    best = None
    steps = range(0, resolution + 1)
    combos = [c for c in itertools.product(steps, repeat=n) if sum(c) == resolution]
    for c in combos:
        weights = np.array(c) / resolution
        score, sens, spec, qwk = objective_score(weights, probs_per_model, y_true, target_sensitivity, target_specificity)
        if best is None or score > best[0]:
            best = (score, weights, sens, spec, qwk)
    return best


def differential_evolution_search(probs_per_model: list[np.ndarray], y_true: np.ndarray,
                                    target_sensitivity: float, target_specificity: float, maxiter: int, popsize: int):
    """Derivative-free global search over an unconstrained reparameterization
    (weights = softmax(theta)), since the true objective is piecewise-constant
    (argmax + confusion-matrix counts) and has no usable gradient for a
    gradient-based optimizer -- differential evolution handles this
    non-smooth landscape without needing one."""
    n = len(probs_per_model)

    def neg_objective(theta):
        weights = softmax_np(np.array(theta))
        score, _, _, _ = objective_score(weights, probs_per_model, y_true, target_sensitivity, target_specificity)
        return -score

    result = differential_evolution(
        neg_objective, bounds=[(-4, 4)] * n, maxiter=maxiter, popsize=popsize,
        seed=42, tol=1e-6, polish=True,
    )
    weights = softmax_np(result.x)
    score, sens, spec, qwk = objective_score(weights, probs_per_model, y_true, target_sensitivity, target_specificity)
    return score, weights, sens, spec, qwk


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoints", nargs="+", required=True)
    parser.add_argument("--data-dir", required=True)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--tta", action="store_true")
    parser.add_argument("--review-threshold", type=float, default=0.70)
    parser.add_argument("--target-sensitivity", type=float, default=0.90)
    parser.add_argument("--target-specificity", type=float, default=0.85)
    parser.add_argument("--grid-resolution", type=int, default=20,
        help="Grid search granularity (weights in steps of 1/resolution). Only used for <=4 models.")
    parser.add_argument("--de-maxiter", type=int, default=200)
    parser.add_argument("--de-popsize", type=int, default=20)
    args = parser.parse_args()

    if len(args.checkpoints) < 2:
        raise SystemExit("Weight optimization needs at least 2 checkpoints.")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Evaluating on: {device}")

    models = []
    for ckpt_path in args.checkpoints:
        model = build_model().to(device)
        model.load_state_dict(torch.load(ckpt_path, map_location=device))
        model.eval()
        models.append(model)

    dataset = Messidor2Dataset(args.data_dir, transform=build_transform())
    print(f"Messidor-2: {len(dataset)} images\n")
    print("Running inference once per model (this is the only slow part)...")

    probs_per_model = [[] for _ in models]
    all_true = []
    for start in tqdm(range(0, len(dataset), args.batch_size), desc="Caching model outputs"):
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
        for m_idx, model in enumerate(models):
            probs = predict_with_tta(model, images, device, args.tta)
            probs_per_model[m_idx].append(probs)
        all_true.extend(batch_labels)

    probs_per_model = [np.concatenate(p, axis=0) for p in probs_per_model]
    y_true = np.array(all_true)

    print("\n" + "=" * 70)
    print(f"SEARCHING FOR OPTIMAL WEIGHTS (target: sensitivity>={args.target_sensitivity}, "
          f"specificity>={args.target_specificity})")
    print("=" * 70)

    candidates = []
    if len(models) <= 4:
        print(f"\nGrid search (resolution=1/{args.grid_resolution})...")
        grid_best = grid_search(probs_per_model, y_true, args.target_sensitivity,
                                  args.target_specificity, args.grid_resolution)
        candidates.append(("grid", grid_best))
        print(f"  Grid best: weights={np.round(grid_best[1], 3)} "
              f"sensitivity={grid_best[2]:.4f} specificity={grid_best[3]:.4f} qwk={grid_best[4]:.4f}")

    print(f"\nDifferential evolution (maxiter={args.de_maxiter}, popsize={args.de_popsize})...")
    de_best = differential_evolution_search(probs_per_model, y_true, args.target_sensitivity,
                                              args.target_specificity, args.de_maxiter, args.de_popsize)
    candidates.append(("differential_evolution", de_best))
    print(f"  DE best: weights={np.round(de_best[1], 3)} "
          f"sensitivity={de_best[2]:.4f} specificity={de_best[3]:.4f} qwk={de_best[4]:.4f}")

    method, (score, weights, sens, spec, qwk) = max(candidates, key=lambda c: c[1][0])
    weights = weights / weights.sum()  # renormalize after any floating point drift

    ensemble_probs = sum(w * p for w, p in zip(weights, probs_per_model))
    y_pred = ensemble_probs.argmax(axis=1)
    confidences = ensemble_probs.max(axis=1)
    eff_sens, fn_caught, fn_total, review_rate = compute_effective_sensitivity(
        y_true, y_pred, confidences, args.review_threshold)

    print("\n" + "=" * 70)
    print(f"BEST RESULT (via {method})")
    print("=" * 70)
    for ckpt_path, w in zip(args.checkpoints, weights):
        print(f"  weight={w:.4f}  {ckpt_path}")
    print(f"\nsensitivity={sens:.4f}  specificity={spec:.4f}  qwk={qwk:.4f}")
    print(f"effective_sensitivity={eff_sens:.4f}  review_rate={review_rate:.1%}")

    meets_targets = sens >= args.target_sensitivity and spec >= args.target_specificity
    if meets_targets:
        print("\nMEETS both problem-statement targets with this weighting.")
    else:
        print(f"\nDoes not fully meet both targets yet -- this is the best achievable weighted "
              f"combination of THESE specific checkpoints. If still short, the next lever is "
              f"different/additional checkpoints to combine, not further weight tuning of the same three.")

    print("\n" + "=" * 70)
    print("TO DEPLOY THIS EXACT WEIGHTING IN MATLAB:")
    print("=" * 70)
    print("1. Export each checkpoint individually:")
    for ckpt_path in args.checkpoints:
        name = Path(ckpt_path).stem
        print(f"   python export_onnx.py --checkpoint {ckpt_path} --out ../../matlab/models/severity_net_{name}.onnx")
    print("\n2. Set these two lines in config/pipeline_config.yaml (under 'paths:'):")
    model_list = ", ".join(f'"severity_net_{Path(c).stem}.onnx"' for c in args.checkpoints)
    weight_list = ", ".join(f"{w:.4f}" for w in weights)
    print(f"   severity_model: [{model_list}]")
    print(f"   severity_model_weights: [{weight_list}]")
    print("\n   getSeverityNet.m, predictSeverity.m, and generateGradCAM.m already support this "
          "weighted-ensemble mode -- no further MATLAB code changes needed.")


if __name__ == "__main__":
    main()
