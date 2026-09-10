"""Ensemble multiple independently trained checkpoints and evaluate the
combined prediction against Messidor-2.

Rationale: the seed-search results (see select_best_checkpoint.py) showed
different checkpoints failing in different, sometimes complementary ways --
one biased toward high sensitivity/low specificity, another better balanced
with higher QWK. Averaging predicted probabilities across several
independently trained checkpoints is a standard, low-risk way to smooth out
each individual model's idiosyncrasies and often improves both the
sensitivity/specificity balance and overall stability, not just raw accuracy.

This script only VALIDATES whether ensembling helps for your specific
checkpoints, using the same metrics as select_best_checkpoint.py (so the
numbers are directly comparable). If it helps, export the chosen checkpoints
individually (export_onnx.py, one call per checkpoint) and point
config/pipeline_config.yaml's grading.severity_model at a LIST of filenames
instead of one -- getSeverityNet.m / predictSeverity.m already support this
ensemble mode (see matlab/models/predictSeverity.m).

Usage:
    python evaluate_ensemble.py --checkpoints runs/run_A/epoch_08.pt runs/run_E/epoch_12.pt \
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


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoints", nargs="+", required=True,
        help="2 or more checkpoint .pt files to ensemble (predictions averaged equally).")
    parser.add_argument("--data-dir", required=True)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--tta", action="store_true")
    parser.add_argument("--review-threshold", type=float, default=0.70)
    args = parser.parse_args()

    if len(args.checkpoints) < 2:
        raise SystemExit("Ensembling needs at least 2 checkpoints -- got 1. Use select_best_checkpoint.py "
                          "for single-checkpoint evaluation instead.")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Evaluating on: {device}")
    print(f"Ensembling {len(args.checkpoints)} checkpoints (equal-weight probability averaging):")
    for c in args.checkpoints:
        print(f"  - {c}")

    models = []
    for ckpt_path in args.checkpoints:
        model = build_model().to(device)
        model.load_state_dict(torch.load(ckpt_path, map_location=device))
        model.eval()
        models.append(model)

    dataset = Messidor2Dataset(args.data_dir, transform=build_transform())
    print(f"Messidor-2: {len(dataset)} images\n")

    all_true, all_pred_individual, all_pred_ensemble, all_conf_ensemble = [], [[] for _ in models], [], []

    for start in tqdm(range(0, len(dataset), args.batch_size), desc="Evaluating ensemble"):
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

        probs_per_model = []
        for m_idx, model in enumerate(models):
            probs = predict_with_tta(model, images, device, args.tta)
            probs_per_model.append(probs)
            all_pred_individual[m_idx].extend(probs.argmax(axis=1).tolist())

        ensemble_probs = np.mean(probs_per_model, axis=0)  # equal-weight average across models
        all_pred_ensemble.extend(ensemble_probs.argmax(axis=1).tolist())
        all_conf_ensemble.extend(ensemble_probs.max(axis=1).tolist())
        all_true.extend(batch_labels)

    y_true = np.array(all_true)

    print("\n" + "=" * 70)
    print("INDIVIDUAL CHECKPOINTS (for comparison)")
    print("=" * 70)
    for ckpt_path, preds in zip(args.checkpoints, all_pred_individual):
        sens, spec, qwk = compute_metrics(y_true, np.array(preds))
        print(f"{Path(ckpt_path).name}: sensitivity={sens:.4f} specificity={spec:.4f} qwk={qwk:.4f}")

    y_pred_ensemble = np.array(all_pred_ensemble)
    confidences = np.array(all_conf_ensemble)
    sens_e, spec_e, qwk_e = compute_metrics(y_true, y_pred_ensemble)
    eff_sens_e, fn_caught, fn_total, review_rate = compute_effective_sensitivity(
        y_true, y_pred_ensemble, confidences, args.review_threshold)

    print("\n" + "=" * 70)
    print("ENSEMBLE (equal-weight probability average)")
    print("=" * 70)
    print(f"sensitivity={sens_e:.4f}  specificity={spec_e:.4f}  qwk={qwk_e:.4f}")
    print(f"effective_sensitivity={eff_sens_e:.4f}  review_rate={review_rate:.1%}")
    print("\nCompare this block against the individual checkpoints above. If the ensemble's "
          "QWK and/or sensitivity/specificity balance beats every individual model, it's worth "
          "deploying: export each checkpoint individually with export_onnx.py, then set "
          "config/pipeline_config.yaml -> grading.severity_model to a LIST of the resulting "
          "filenames (matlab/models/getSeverityNet.m and predictSeverity.m already support this "
          "ensemble mode). If the ensemble doesn't clearly beat your best single checkpoint, "
          "it's not worth the extra inference cost and complexity -- ensembling is not "
          "guaranteed to help, it's a hypothesis worth testing, same as everything else in "
          "this pipeline's iteration history.")


if __name__ == "__main__":
    main()
