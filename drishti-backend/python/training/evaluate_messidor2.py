"""Evaluate the trained severity classifier against Messidor-2 -- the
external, held-out benchmark never touched during training or hyperparameter
tuning (see data/README.md). This produces the sensitivity/specificity/QWK
numbers that actually belong in your report and pitch, as distinct from the
internal APTOS validation-split numbers seen during training.

Runs inference via ONNX Runtime directly (not the full MATLAB pipeline) since
this only needs the classifier's grade, not lesion segmentation/reports --
this is faster for evaluating ~1,748 images and, since it uses the exact same
ONNX file MATLAB imports, confirms both environments agree on what the model
predicts, which is worth knowing before you trust MATLAB's numbers too.

Usage:
    python evaluate_messidor2.py --onnx-model ../../matlab/models/severity_net.onnx \\
        --data-dir ../../data/messidor2 --tta
"""
from __future__ import annotations

import argparse
from pathlib import Path

import albumentations as A
import numpy as np
import onnxruntime as ort
from albumentations.pytorch import ToTensorV2
from sklearn.metrics import classification_report, cohen_kappa_score, confusion_matrix
from tqdm import tqdm

from dataset import Messidor2Dataset, ben_graham_preprocess

IMG_SIZE = 380  # must match training


def _ben_graham_transform(img, **kwargs):
    """Module-level wrapper (not a lambda) -- see train_severity_classifier.py's
    identical wrapper for why: lambdas/closures aren't picklable for
    multiprocessing on Windows, so this is kept as a plain top-level function
    for consistency even though this script's evaluation loop doesn't
    currently use DataLoader workers."""
    return ben_graham_preprocess(img, IMG_SIZE)


def build_transform():
    # MUST match train_severity_classifier.py's val-time transform exactly --
    # if the model was retrained with Ben Graham preprocessing, this has to
    # apply it too, or these benchmark numbers reflect a mismatched input
    # distribution rather than the model's real generalization.
    return A.Compose([
        A.Resize(IMG_SIZE, IMG_SIZE),
        A.Lambda(image=_ben_graham_transform, name="ben_graham"),
        A.Normalize(),  # ImageNet mean/std -- must match predictSeverity.m exactly
        ToTensorV2(),
    ])


def softmax(x: np.ndarray) -> np.ndarray:
    e = np.exp(x - x.max(axis=1, keepdims=True))
    return e / e.sum(axis=1, keepdims=True)


def predict_batch(session: ort.InferenceSession, images: np.ndarray, tta: bool) -> np.ndarray:
    """images: (N, 3, H, W) float32, already normalized. Returns (N, 5) probabilities."""
    input_name = session.get_inputs()[0].name

    variants = [images]
    if tta:
        variants.append(images[:, :, :, ::-1].copy())  # horizontal flip
        variants.append(images[:, :, ::-1, :].copy())  # vertical flip

    probs_sum = np.zeros((images.shape[0], 5), dtype=np.float32)
    for variant in variants:
        logits = session.run(None, {input_name: variant})[0]
        probs_sum += softmax(logits)
    return probs_sum / len(variants)


def compute_referable_metrics(y_true: np.ndarray, y_pred: np.ndarray, referable_threshold: int = 2):
    true_bin = (y_true >= referable_threshold).astype(int)
    pred_bin = (y_pred >= referable_threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(true_bin, pred_bin, labels=[0, 1]).ravel()
    sensitivity = tp / max(tp + fn, 1)
    specificity = tn / max(tn + fp, 1)
    return sensitivity, specificity, (tn, fp, fn, tp)


def compute_effective_sensitivity(y_true: np.ndarray, y_pred: np.ndarray, confidences: np.ndarray,
                                   review_threshold: float, referable_threshold: int = 2):
    """The pipeline is a human-in-the-loop system, not an AI-alone classifier:
    any prediction below confidence_review_threshold gets routed to an
    ophthalmologist instead of being trusted silently (see calibrateConfidence.m).
    A missed referable case therefore only represents real clinical risk if the
    model was ALSO confidently wrong about it. This recomputes sensitivity
    under that system-level assumption: false negatives with confidence below
    the review threshold are treated as "caught by mandatory human review"
    rather than silently missed, since that is what the deployed pipeline
    would actually do with them. This is an estimate of system-level safety,
    not a substitute for the raw AI-only number -- report both, clearly labeled."""
    true_bin = (y_true >= referable_threshold).astype(int)
    pred_bin = (y_pred >= referable_threshold).astype(int)

    false_negative_mask = (true_bin == 1) & (pred_bin == 0)
    fn_total = false_negative_mask.sum()
    fn_low_confidence = ((confidences < review_threshold) & false_negative_mask).sum()

    tn, fp, fn, tp = confusion_matrix(true_bin, pred_bin, labels=[0, 1]).ravel()
    effective_tp = tp + fn_low_confidence
    effective_fn = fn - fn_low_confidence
    effective_sensitivity = effective_tp / max(effective_tp + effective_fn, 1)

    review_rate = (confidences < review_threshold).mean()

    return effective_sensitivity, fn_low_confidence, fn_total, review_rate


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--onnx-model", required=True)
    parser.add_argument("--data-dir", required=True)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--tta", action="store_true", help="Average predictions across flips (matches training-time TTA)")
    parser.add_argument("--review-threshold", type=float, default=0.70,
        help="Must match grading.confidence_review_threshold in config/pipeline_config.yaml "
             "-- used to estimate system-level (AI + mandatory human review) sensitivity, "
             "not just raw AI-alone sensitivity.")
    args = parser.parse_args()

    print(f"Loading ONNX model: {args.onnx_model}")
    session = ort.InferenceSession(args.onnx_model, providers=["CPUExecutionProvider"])

    dataset = Messidor2Dataset(args.data_dir, transform=build_transform())
    print(f"Messidor-2: {len(dataset)} images loaded (external benchmark, never used in training)")

    all_preds, all_true, all_confidences = [], [], []
    skipped = []
    for start in tqdm(range(0, len(dataset), args.batch_size), desc="Evaluating"):
        batch_images, batch_labels = [], []
        for i in range(start, min(start + args.batch_size, len(dataset))):
            try:
                img, label = dataset[i]
            except Exception as exc:  # noqa: BLE001 -- a handful of corrupted
                # files in a real-world download shouldn't kill a ~40-minute
                # evaluation run; skip and report at the end instead.
                skipped.append((i, str(exc)))
                continue
            batch_images.append(img.numpy())
            batch_labels.append(label)

        if not batch_images:
            continue

        images_np = np.stack(batch_images).astype(np.float32)
        probs = predict_batch(session, images_np, args.tta)
        preds = probs.argmax(axis=1)
        confidences = probs.max(axis=1)

        all_preds.extend(preds.tolist())
        all_true.extend(batch_labels)
        all_confidences.extend(confidences.tolist())

    if skipped:
        print(f"\nSkipped {len(skipped)} unreadable image(s) (corrupted beyond truncation-tolerance):")
        for idx, err in skipped[:10]:  # cap printed detail so this doesn't flood output
            print(f"  index {idx}: {err}")
        if len(skipped) > 10:
            print(f"  ... and {len(skipped) - 10} more.")
        print(f"Evaluated on {len(all_true)}/{len(dataset)} images. Note this in your report "
              f"if you cite the benchmark size (e.g. '1744 - {len(skipped)} evaluable images').")

    y_true = np.array(all_true)
    y_pred = np.array(all_preds)
    confidences = np.array(all_confidences)

    sensitivity, specificity, (tn, fp, fn, tp) = compute_referable_metrics(y_true, y_pred)
    qwk = cohen_kappa_score(y_true, y_pred, weights="quadratic")

    print("\n" + "=" * 60)
    print("MESSIDOR-2 EXTERNAL BENCHMARK RESULTS")
    print("=" * 60)
    print(f"Referable DR (ICDR >= 2) sensitivity: {sensitivity:.4f}  (target: >= 0.90)")
    print(f"Referable DR (ICDR >= 2) specificity: {specificity:.4f}  (target: >= 0.85)")
    print(f"Quadratic Weighted Kappa (5-class):   {qwk:.4f}")
    print(f"Confusion (referable binary) -- TN={tn} FP={fp} FN={fn} TP={tp}")
    print("\nPer-class report (5-class ICDR 0-4):")
    print(classification_report(y_true, y_pred, target_names=[
        "No DR", "Mild NPDR", "Moderate NPDR", "Severe NPDR", "Proliferative DR"
    ], zero_division=0))

    effective_sensitivity, fn_caught, fn_total, review_rate = compute_effective_sensitivity(
        y_true, y_pred, confidences, args.review_threshold)
    print("=" * 60)
    print("SYSTEM-LEVEL (AI + mandatory human review) VS. RAW AI-ALONE METRICS")
    print("=" * 60)
    print(f"Raw AI-alone sensitivity:                {sensitivity:.4f}")
    print(f"Effective sensitivity (assuming review_threshold={args.review_threshold} "
          f"catches low-confidence misses): {effective_sensitivity:.4f}")
    print(f"  -> Of {fn_total} raw false negatives, {fn_caught} had confidence below "
          f"the review threshold and would be routed to a human instead of missed silently.")
    print(f"Overall review rate (fraction of ALL predictions below threshold): {review_rate:.1%}")
    print("NOTE: this is an estimate of system-level safety assuming ophthalmologists "
          "reliably catch what they review -- it does not replace the raw AI-alone "
          "number, which should also be reported. Both numbers tell a different, "
          "valid part of the story: raw sensitivity shows the model's standalone "
          "discriminative ability; effective sensitivity shows what the deployed "
          "human-in-the-loop pipeline is designed to guarantee.")

    meets_targets = sensitivity >= 0.90 and specificity >= 0.85
    print("=" * 60)
    if meets_targets:
        print("Raw AI-alone metrics MEET problem statement targets (sensitivity >=0.90, "
              "specificity >=0.85) on the external Messidor-2 benchmark.")
    else:
        print("Raw AI-alone metrics do NOT yet meet problem statement targets on Messidor-2 -- "
              "this is the honest, unbiased number for your report. This gap is a known, "
              "documented pattern in DR literature (models trained on one dataset/camera "
              "source generalizing imperfectly to another) rather than a broken pipeline. "
              "Concrete next steps, roughly in order of effort: "
              "(1) add Ben Graham-style color/illumination normalization (subtract local "
              "average color) to reduce cross-camera domain shift -- well-documented in "
              "the DR literature to help exactly this problem; "
              "(2) if effective sensitivity above is already much closer to target, that's "
              "meaningful evidence the human-in-the-loop design is doing its job -- report "
              "both numbers rather than treating raw sensitivity as the only truth; "
              "(3) as a last resort and with full transparency in your report, fine-tune on "
              "a small held-out slice of Messidor-2 (e.g. 15%), evaluating on the remainder "
              "-- this is common practice but must be clearly disclosed as no longer a fully "
              "blind external test if you do it.")


if __name__ == "__main__":
    main()
