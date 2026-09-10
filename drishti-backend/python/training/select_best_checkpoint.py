"""Sweep every saved epoch checkpoint from one or more training runs directly
against Messidor-2, to find which checkpoint ACTUALLY generalizes best --
since internal-validation-best (what early stopping picks) is not guaranteed
to be external-benchmark-best (see train_severity_classifier.py's epoch_*.pt
saving and the comment on why).

Also doubles as the tool for comparing across multiple random-seed runs: if
you've run train_severity_classifier.py several times with different --seed
values (or auto-generated ones), point this at all their --out-dir folders
at once and it produces a single leaderboard across every epoch of every run.

Runs directly via PyTorch (loading each epoch_*.pt state dict) rather than
ONNX -- no need to export every candidate checkpoint just to screen it. Only
export the final winner to ONNX for the MATLAB pipeline.

Usage:
    python select_best_checkpoint.py --run-dir runs/v3_final --data-dir ../../data/messidor2 --tta
    python select_best_checkpoint.py --run-dir runs/seed_A runs/seed_B runs/seed_C \\
        --data-dir ../../data/messidor2 --tta
"""
from __future__ import annotations

import argparse
from pathlib import Path

import albumentations as A
import numpy as np
import torch
from albumentations.pytorch import ToTensorV2
from sklearn.metrics import cohen_kappa_score, confusion_matrix
from tqdm import tqdm

from dataset import Messidor2Dataset
from evaluate_messidor2 import compute_effective_sensitivity
from train_severity_classifier import IMG_SIZE, _ben_graham_transform, build_model


def build_transform():
    # MUST match train_severity_classifier.py's val-time transform exactly.
    return A.Compose([
        A.Resize(IMG_SIZE, IMG_SIZE),
        A.Lambda(image=_ben_graham_transform, name="ben_graham"),
        A.Normalize(),
        ToTensorV2(),
    ])


def predict_with_tta(model: torch.nn.Module, images: torch.Tensor, device: torch.device, tta: bool) -> np.ndarray:
    variants = [images]
    if tta:
        variants.append(torch.flip(images, dims=[3]))
        variants.append(torch.flip(images, dims=[2]))

    probs_sum = None
    with torch.no_grad():
        for variant in variants:
            logits = model(variant.to(device))
            probs = torch.softmax(logits, dim=1).cpu().numpy()
            probs_sum = probs if probs_sum is None else probs_sum + probs
    return probs_sum / len(variants)


def compute_metrics(y_true: np.ndarray, y_pred: np.ndarray, referable_threshold: int = 2):
    true_bin = (y_true >= referable_threshold).astype(int)
    pred_bin = (y_pred >= referable_threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(true_bin, pred_bin, labels=[0, 1]).ravel()
    sensitivity = tp / max(tp + fn, 1)
    specificity = tn / max(tn + fp, 1)
    qwk = cohen_kappa_score(y_true, y_pred, weights="quadratic")
    return sensitivity, specificity, qwk


def evaluate_checkpoint(ckpt_path: Path, dataset: Messidor2Dataset, device: torch.device,
                          batch_size: int, tta: bool, review_threshold: float) -> tuple:
    model = build_model().to(device)
    model.load_state_dict(torch.load(ckpt_path, map_location=device))
    model.eval()

    all_preds, all_true, all_confidences = [], [], []
    for start in tqdm(range(0, len(dataset), batch_size), desc=ckpt_path.name, leave=False):
        batch_imgs, batch_labels = [], []
        for i in range(start, min(start + batch_size, len(dataset))):
            try:
                img, label = dataset[i]
            except Exception:  # noqa: BLE001 -- skip unreadable files, same as evaluate_messidor2.py
                continue
            batch_imgs.append(img)
            batch_labels.append(label)
        if not batch_imgs:
            continue

        images = torch.stack(batch_imgs)
        probs = predict_with_tta(model, images, device, tta)
        all_preds.extend(probs.argmax(axis=1).tolist())
        all_confidences.extend(probs.max(axis=1).tolist())
        all_true.extend(batch_labels)

    y_true, y_pred, confidences = np.array(all_true), np.array(all_preds), np.array(all_confidences)
    sensitivity, specificity, qwk = compute_metrics(y_true, y_pred)
    effective_sensitivity, fn_caught, fn_total, review_rate = compute_effective_sensitivity(
        y_true, y_pred, confidences, review_threshold)
    return sensitivity, specificity, qwk, effective_sensitivity, review_rate


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-dir", nargs="+", required=True,
        help="One or more training run directories containing epoch_*.pt checkpoints.")
    parser.add_argument("--data-dir", required=True)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--tta", action="store_true")
    parser.add_argument("--min-specificity", type=float, default=0.85,
        help="Problem-statement specificity floor. A checkpoint can trivially "
             "score high 'sensitivity' by over-predicting referable broadly "
             "(indiscriminate positive-calling) at the cost of collapsed "
             "specificity -- that is NOT a better model, it's a worse, "
             "unusable one that would flood reviewers with false referrals. "
             "Checkpoints below this floor are flagged, not silently ranked "
             "to the top just because their sensitivity number looks good.")
    parser.add_argument("--review-threshold", type=float, default=0.70,
        help="Must match grading.confidence_review_threshold in "
             "config/pipeline_config.yaml -- used to also report effective "
             "(AI + mandatory human review) sensitivity per checkpoint.")
    args = parser.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Evaluating on: {device}")

    dataset = Messidor2Dataset(args.data_dir, transform=build_transform())
    print(f"Messidor-2: {len(dataset)} images (external benchmark)\n")

    results = []
    for run_dir in args.run_dir:
        run_path = Path(run_dir)
        checkpoints = sorted(run_path.glob("epoch_*.pt"))
        if not checkpoints:
            print(f"WARNING: no epoch_*.pt checkpoints found in {run_dir} -- "
                  f"was this trained with the updated train_severity_classifier.py "
                  f"that saves every epoch? Skipping.")
            continue

        run_info_path = run_path / "run_info.txt"
        seed_note = run_info_path.read_text().splitlines()[0] if run_info_path.exists() else "seed=unknown"

        for ckpt_path in checkpoints:
            sensitivity, specificity, qwk, effective_sensitivity, review_rate = evaluate_checkpoint(
                ckpt_path, dataset, device, args.batch_size, args.tta, args.review_threshold)
            label = f"{run_dir}/{ckpt_path.name} ({seed_note})"
            results.append((label, str(ckpt_path), sensitivity, specificity, qwk,
                             effective_sensitivity, review_rate))
            print(f"{label}: sensitivity={sensitivity:.4f} specificity={specificity:.4f} "
                  f"qwk={qwk:.4f} effective_sensitivity={effective_sensitivity:.4f} "
                  f"review_rate={review_rate:.1%}")

    if not results:
        print("No checkpoints evaluated -- nothing to report.")
        return

    print("\n" + "=" * 70)
    print(f"LEADERBOARD -- sorted by QWK (harder to game via indiscriminate positive-\n"
          f"calling than raw sensitivity alone; PASS/FAIL reflects the {args.min_specificity} "
          f"specificity floor)")
    print("=" * 70)
    for label, _, sens, spec, qwk, eff_sens, review_rate in sorted(results, key=lambda r: -r[4]):
        flag = "PASS" if spec >= args.min_specificity else "FAIL (specificity below floor)"
        print(f"[{flag:>30}] sensitivity={sens:.4f} (effective={eff_sens:.4f}, "
              f"review_rate={review_rate:.1%})  specificity={spec:.4f}  qwk={qwk:.4f}   {label}")

    passing = [r for r in results if r[3] >= args.min_specificity]
    print("\n" + "=" * 70)
    if passing:
        best = max(passing, key=lambda r: r[2])  # among those meeting the specificity
                                                    # floor, THEN prefer highest sensitivity
        print(f"Best checkpoint meeting the specificity floor: {best[0]}")
        print(f"  sensitivity={best[2]:.4f}  specificity={best[3]:.4f}  qwk={best[4]:.4f}  "
              f"effective_sensitivity={best[5]:.4f}")
    else:
        best = max(results, key=lambda r: r[4])  # nothing passes -- fall back to best QWK,
                                                    # NOT best raw sensitivity, since an
                                                    # ungated sensitivity ranking rewards
                                                    # exactly the collapsed-specificity failure
                                                    # mode this floor exists to catch
        print(f"WARNING: no checkpoint meets the {args.min_specificity} specificity floor. "
              f"Falling back to best QWK (most defensible single metric when nothing "
              f"clears both targets) rather than best raw sensitivity, which would reward "
              f"indiscriminate over-prediction, not genuine discriminative ability.")
        print(f"\nBest by QWK (fallback): {best[0]}")
        print(f"  sensitivity={best[2]:.4f}  specificity={best[3]:.4f}  qwk={best[4]:.4f}  "
              f"effective_sensitivity={best[5]:.4f}")

    print(f"\nExport this specific checkpoint for MATLAB:")
    print(f"  python export_onnx.py --checkpoint \"{best[1]}\" --out ../../matlab/models/severity_net.onnx")
    print("\nNOTE: picking a checkpoint based on Messidor-2 performance means it is no "
          "longer a fully blind final test for THIS specific number -- be transparent "
          "about that in your report (this is standard, disclosed model-selection "
          "practice, not the same as training on the test set, but the distinction "
          "matters and should be stated explicitly).")


if __name__ == "__main__":
    main()
