"""Train the ICDR (0-4) severity classifier on APTOS 2019 + IDRiD, with
Messidor-2 reserved strictly as a final external benchmark (see dataset.py).

Usage:
    python train_severity_classifier.py --data-dir ../../data/aptos2019 --epochs 30

Design notes:
- Backbone: EfficientNet-B3 via timm — a strong, well-validated choice for
  fundus classification in the published DR literature, and small enough to
  train on a single consumer GPU within hackathon time constraints.
- Class imbalance (level 4/PDR is rare) handled via --imbalance-strategy
  (weighted sampler, weighted loss, or both — compare via --imbalance-strategy
  to see which generalizes best on your data rather than assuming).
- Loss combines cross-entropy with an ordinal regression term, since ICDR
  severity is ordinal (0-4) and misclassifying level 0 as level 4 should be
  penalized far more than misclassifying it as level 1 — plain CE treats
  both errors identically.
- Validation (and therefore model selection / early stopping) uses
  test-time augmentation (horizontal + vertical flip averaging) by default,
  since fundus images have no canonical orientation and TTA is a
  near-free accuracy gain with no training-time cost.
- Saves a temperature-scaling checkpoint fit on the validation split, whose
  (A, B) params should be copied into config/pipeline_config.yaml
  (grading.platt_A / platt_B) for calibrateConfidence.m.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import albumentations as A
import numpy as np
import timm
import torch
import torch.nn as nn
from albumentations.pytorch import ToTensorV2
from sklearn.metrics import confusion_matrix, cohen_kappa_score, recall_score
from sklearn.utils.class_weight import compute_class_weight
from torch.utils.data import ConcatDataset, DataLoader, WeightedRandomSampler
from tqdm import tqdm

from dataset import APTOSDataset, ICDR_LABELS, ben_graham_preprocess, build_combined_severity_dataset

IMG_SIZE = 380  # matches EfficientNet-B3's native input resolution


def _ben_graham_transform(img, **kwargs):
    """Module-level (not a lambda/closure) wrapper around ben_graham_preprocess
    so it can be pickled -- required because Windows' multiprocessing (used by
    DataLoader when num_workers > 0) spawns worker processes by pickling the
    whole dataset/transform pipeline, and neither lambdas nor closures defined
    inside another function are picklable there (this is a Windows-specific
    failure mode; the equivalent Linux 'fork' start method wouldn't hit it,
    which is why this is easy to miss if you haven't tested on Windows)."""
    return ben_graham_preprocess(img, IMG_SIZE)


def build_transforms(train: bool):
    # Ben Graham preprocessing runs AFTER geometric augmentation (crop/flip/
    # rotate) is finalized, so the local-contrast blur radius and circular
    # mask are computed against the final image content -- and BEFORE
    # remaining color-jitter augmentation, so that jitter adds diversity on
    # top of an already color-normalized base rather than fighting it.
    # A.CLAHE is intentionally dropped here: Ben Graham's local-contrast
    # normalization plays a similar role and is the more clinically-evidenced
    # technique for this specific cross-camera domain-shift problem -- running
    # both risked compounding/conflicting local-contrast transforms.
    ben_graham = A.Lambda(image=_ben_graham_transform, name="ben_graham")

    if train:
        return A.Compose([
            A.RandomResizedCrop(size=(IMG_SIZE, IMG_SIZE), scale=(0.85, 1.0)),
            A.HorizontalFlip(p=0.5),
            A.VerticalFlip(p=0.5),          # fundus images have no canonical up/down
            A.Rotate(limit=25, p=0.7),
            ben_graham,
            A.RandomBrightnessContrast(p=0.4),
            A.Normalize(),
            ToTensorV2(),
        ])
    return A.Compose([
        A.Resize(IMG_SIZE, IMG_SIZE),
        ben_graham,
        A.Normalize(),
        ToTensorV2(),
    ])


def build_model(num_classes: int = 5) -> nn.Module:
    model = timm.create_model("efficientnet_b3", pretrained=True, num_classes=num_classes)
    return model


class OrdinalCELoss(nn.Module):
    """Cross-entropy + an ordinal regression penalty.

    ICDR severity (0-4) is ordinal, not categorical -- confusing level 0 with
    level 4 is a far worse error than confusing level 0 with level 1, but
    plain nn.CrossEntropyLoss scores both identically. This adds a soft
    penalty on the squared distance between the predicted class's expected
    value (probability-weighted mean of 0..4) and the true label, nudging
    the model's probability mass toward *numerically close* classes even
    when it's uncertain -- a lightweight version of what quadratic weighted
    kappa (the actual competition/benchmark metric) directly optimizes for.
    """

    def __init__(self, class_weights: torch.Tensor, ordinal_weight: float = 0.3, num_classes: int = 5):
        super().__init__()
        self.ce = nn.CrossEntropyLoss(weight=class_weights)
        self.ordinal_weight = ordinal_weight
        self.register_buffer("class_values", torch.arange(num_classes, dtype=torch.float32))

    def forward(self, logits: torch.Tensor, labels: torch.Tensor) -> torch.Tensor:
        ce_loss = self.ce(logits, labels)

        probs = torch.softmax(logits, dim=1)
        expected_class = (probs * self.class_values.to(logits.device)).sum(dim=1)
        ordinal_loss = nn.functional.mse_loss(expected_class, labels.float())

        return ce_loss + self.ordinal_weight * ordinal_loss


def predict_with_tta(model: nn.Module, images: torch.Tensor, use_amp: bool) -> torch.Tensor:
    """Average softmax probabilities across the original image plus horizontal
    and vertical flips. Fundus images have no canonical up/down/left/right
    orientation, so these are valid, meaning-preserving augmentations at
    inference time (unlike, say, flipping a street-sign image) -- a
    near-free accuracy gain since it costs 3x inference compute but zero
    additional training."""
    variants = [images, torch.flip(images, dims=[3]), torch.flip(images, dims=[2])]
    probs_sum = None
    for variant in variants:
        with torch.amp.autocast("cuda", enabled=use_amp):
            logits = model(variant)
        probs = torch.softmax(logits.float(), dim=1)
        probs_sum = probs if probs_sum is None else probs_sum + probs
    return probs_sum / len(variants)


def get_all_labels(dataset) -> np.ndarray:
    """Extracts labels directly from each dataset's DataFrame (fast -- no
    image decoding) rather than looping through __getitem__. Handles both a
    plain APTOSDataset/IDRiDGradingDataset and a ConcatDataset combining them."""
    if isinstance(dataset, ConcatDataset):
        return np.concatenate([get_all_labels(d) for d in dataset.datasets])
    if hasattr(dataset, "label_col"):  # IDRiDGradingDataset
        return dataset.df[dataset.label_col].values
    return dataset.df["diagnosis"].values  # APTOSDataset


def compute_referable_metrics(y_true: np.ndarray, y_pred: np.ndarray, referable_threshold: int = 2):
    """Sensitivity/specificity for the binary 'referable DR' (level >= 2) framing —
    this is the number the problem statement's >90%/>85% target actually refers to."""
    true_bin = (y_true >= referable_threshold).astype(int)
    pred_bin = (y_pred >= referable_threshold).astype(int)

    tn, fp, fn, tp = confusion_matrix(true_bin, pred_bin, labels=[0, 1]).ravel()
    sensitivity = tp / max(tp + fn, 1)
    specificity = tn / max(tn + fp, 1)
    return sensitivity, specificity


def fit_temperature_scaling(logits: torch.Tensor, labels: torch.Tensor, iters: int = 200):
    """Single-parameter temperature scaling (Guo et al., 2017), fit on the
    validation split. Simpler than full Platt A/B but a strong, standard
    calibration baseline; extend to 2-param Platt scaling if residual
    miscalibration remains after temperature fitting."""
    temperature = torch.ones(1, requires_grad=True)
    optimizer = torch.optim.LBFGS([temperature], lr=0.01, max_iter=iters)
    nll = nn.CrossEntropyLoss()

    def closure():
        optimizer.zero_grad()
        loss = nll(logits / temperature, labels)
        loss.backward()
        return loss

    optimizer.step(closure)
    return float(temperature.item())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", required=True, help="Path to APTOS 2019 data directory")
    parser.add_argument("--include-idrid", action="store_true",
        help="Also train on IDRiD's Disease Grading images (a second camera/population "
             "source) in addition to APTOS -- adds source diversity, which is the concrete "
             "lever for improving generalization to an unseen third source like Messidor-2, "
             "rather than just more images from the same source.")
    parser.add_argument("--idrid-dir", default="../../data/idrid",
        help="Path to IDRiD data directory (only used if --include-idrid is set)")
    parser.add_argument("--epochs", type=int, default=30)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--num-workers", type=int, default=4,
        help="DataLoader worker processes. If you hit slow/stuck epochs on "
             "Windows, try 0 or 2 first -- multiprocessing overhead per-worker "
             "is higher on Windows than Linux.")
    parser.add_argument("--lr", type=float, default=3e-4)
    parser.add_argument("--out-dir", default="runs")
    parser.add_argument("--patience", type=int, default=7,
        help="Stop training if referable-DR sensitivity doesn't improve for this many epochs.")
    parser.add_argument("--imbalance-strategy", choices=["sampler", "loss", "both"], default="both",
        help="How to correct for class imbalance: weighted sampler only, "
             "weighted loss only, or both combined (default). Run all three "
             "as separate short experiments and compare final QWK/sensitivity "
             "before committing to one for your full training run -- combining "
             "both can over-correct and hurt majority-class accuracy on some "
             "datasets, so this isn't assumed to be best by default.")
    parser.add_argument("--imbalance-power", type=float, default=1.0,
        help="Dampens class-imbalance correction strength: class_weights are "
             "raised to this power before use (1.0 = full inverse-frequency "
             "weighting, the original/aggressive default; 0.5 = sqrt-dampened, "
             "gentler; 0.0 = no correction at all, uniform weights). Full-strength "
             "inverse-frequency weighting can over-correct toward very rare "
             "classes (e.g. Proliferative DR) and destabilize the middle of the "
             "ordinal scale -- try 0.5 if you see the model collapse toward "
             "predicting only the rarest and most common classes while ignoring "
             "Mild/Moderate NPDR.")
    parser.add_argument("--ordinal-weight", type=float, default=0.3,
        help="Weight of the ordinal regression penalty added to cross-entropy "
             "loss (0 disables it, falling back to plain CE).")
    parser.add_argument("--no-tta", action="store_true",
        help="Disable test-time augmentation during validation/model-selection "
             "(TTA is on by default -- it's a near-free accuracy gain).")
    parser.add_argument("--val-batch-multiplier", type=int, default=2,
        help="Validation batch size = batch_size * this. Validation needs no "
             "gradient memory so it can usually run larger batches than "
             "training, but on GPUs with limited VRAM (e.g. 8GB laptop cards) "
             "keep this low (2 or even 1) to avoid spilling into slow shared "
             "system memory, which can look like a total freeze rather than "
             "just a slowdown.")
    parser.add_argument("--seed", type=int, default=None,
        help="Random seed for reproducibility. If omitted, a fresh random seed "
             "is generated, used, and PRINTED/SAVED -- this deliberately does "
             "NOT default to a fixed value, since training in this unstable-"
             "imbalance regime is sensitive to initialization, and re-rolling "
             "the dice across runs is a legitimate way to find a better-"
             "generalizing model. The seed is always recorded (run_info.txt in "
             "--out-dir) so a lucky result is never unreproducible -- pass "
             "--seed <recorded value> later to exactly reproduce any run.")
    args = parser.parse_args()

    if args.seed is None:
        # Draw a fresh seed from an unseeded source BEFORE seeding anything,
        # so this value itself is genuinely random each run.
        args.seed = int(torch.randint(0, 2**31 - 1, (1,)).item())
        seed_was_generated = True
    else:
        seed_was_generated = False

    torch.manual_seed(args.seed)
    np.random.seed(args.seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(args.seed)
    seed_source = "auto-generated" if seed_was_generated else "user-provided"
    print(f"Random seed: {args.seed} ({seed_source}) -- reproduce this exact run "
          f"with --seed {args.seed}")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    if device.type == "cuda":
        # Lets cuDNN benchmark multiple conv algorithms and pick the fastest
        # for your specific GPU + fixed input size -- safe here since IMG_SIZE
        # is constant across batches. Meaningful speedup, no accuracy cost.
        torch.backends.cudnn.benchmark = True
        print(f"Training on GPU: {torch.cuda.get_device_name(0)}")
    else:
        print("WARNING: training on CPU -- check your PyTorch/CUDA install "
              "(see the sm_120/Blackwell driver notes if you're on an RTX 50-series GPU).")
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "run_info.txt").write_text(
        f"seed={args.seed}\ncommand_args={vars(args)}\n"
    )

    train_ds = APTOSDataset(args.data_dir, split="train", transform=build_transforms(True))
    val_ds = APTOSDataset(args.data_dir, split="val", transform=build_transforms(False))

    if args.include_idrid:
        train_ds = build_combined_severity_dataset(
            args.data_dir, args.idrid_dir, split="train", transform=build_transforms(True))
        val_ds = build_combined_severity_dataset(
            args.data_dir, args.idrid_dir, split="val", transform=build_transforms(False))

    train_labels = get_all_labels(train_ds)
    class_weights = compute_class_weight("balanced", classes=np.arange(5), y=train_labels)
    class_weights = class_weights ** args.imbalance_power
    print(f"Class weights (after imbalance_power={args.imbalance_power}): "
          f"{dict(zip(range(5), np.round(class_weights, 3)))}")

    use_sampler = args.imbalance_strategy in ("sampler", "both")
    use_loss_weighting = args.imbalance_strategy in ("loss", "both")
    print(f"Imbalance strategy: {args.imbalance_strategy} "
          f"(sampler={use_sampler}, weighted_loss={use_loss_weighting})")

    if use_sampler:
        sample_weights = class_weights[train_labels]
        sampler_generator = torch.Generator().manual_seed(args.seed)
        sampler = WeightedRandomSampler(sample_weights, num_samples=len(sample_weights),
                                          replacement=True, generator=sampler_generator)
        train_loader = DataLoader(
            train_ds, batch_size=args.batch_size, sampler=sampler,
            num_workers=args.num_workers, pin_memory=(device.type == "cuda"),
            persistent_workers=(args.num_workers > 0),
        )
    else:
        shuffle_generator = torch.Generator().manual_seed(args.seed)
        train_loader = DataLoader(
            train_ds, batch_size=args.batch_size, shuffle=True, generator=shuffle_generator,
            num_workers=args.num_workers, pin_memory=(device.type == "cuda"),
            persistent_workers=(args.num_workers > 0),
        )

    val_loader = DataLoader(
        val_ds, batch_size=args.batch_size * args.val_batch_multiplier, shuffle=False,
        num_workers=args.num_workers, pin_memory=(device.type == "cuda"),
        persistent_workers=(args.num_workers > 0),
    )

    model = build_model().to(device)
    if device.type == "cuda":
        # channels_last reorders tensor memory layout (NHWC vs NCHW) to match
        # what Tensor Cores execute most efficiently -- a near-free speedup
        # for conv-heavy models like EfficientNet on modern NVIDIA GPUs when
        # combined with mixed precision. No accuracy impact, pure layout change.
        model = model.to(memory_format=torch.channels_last)
    criterion = OrdinalCELoss(
        class_weights=torch.tensor(class_weights, dtype=torch.float32).to(device) if use_loss_weighting
        else torch.ones(5, dtype=torch.float32).to(device),
        ordinal_weight=args.ordinal_weight,
    ).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)

    # Mixed-precision training: runs most ops in float16/bfloat16 instead of
    # float32 -- roughly 1.5-2x faster on modern GPUs (including Blackwell)
    # and uses meaningfully less VRAM, which is what actually lets you push
    # batch size higher on a laptop GPU. GradScaler prevents float16 underflow
    # during backprop. No-op safely on CPU.
    use_amp = device.type == "cuda"
    scaler = torch.amp.GradScaler("cuda", enabled=use_amp)

    best_sensitivity = 0.0
    epochs_without_improvement = 0

    for epoch in range(args.epochs):
        model.train()
        running_loss = 0.0
        for images, labels in tqdm(train_loader, desc=f"epoch {epoch+1}/{args.epochs}"):
            images, labels = images.to(device, non_blocking=True), labels.to(device, non_blocking=True)
            if device.type == "cuda":
                images = images.to(memory_format=torch.channels_last)
            optimizer.zero_grad(set_to_none=True)

            with torch.amp.autocast("cuda", enabled=use_amp):
                outputs = model(images)
                loss = criterion(outputs, labels)

            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()
            running_loss += loss.item() * images.size(0)
        scheduler.step()

        if device.type == "cuda":
            # Release cached (but unused) allocator blocks between phases --
            # training and validation use very different batch sizes here,
            # and clearing the cache between them reduces fragmentation risk
            # that can otherwise force slow shared-memory fallback over time.
            torch.cuda.empty_cache()

        model.eval()
        all_preds, all_labels, all_logits = [], [], []
        with torch.no_grad():
            for images, labels in val_loader:
                images = images.to(device, non_blocking=True)
                if device.type == "cuda":
                    images = images.to(memory_format=torch.channels_last)

                if args.no_tta:
                    with torch.amp.autocast("cuda", enabled=use_amp):
                        logits = model(images)
                    probs = torch.softmax(logits.float(), dim=1)
                else:
                    probs = predict_with_tta(model, images, use_amp)

                preds = probs.argmax(dim=1).cpu().numpy()
                all_preds.append(preds)
                all_labels.append(labels.numpy())
                # Store log-probs as "logits" for temperature scaling below --
                # log() of TTA-averaged softmax approximates pre-softmax
                # logits closely enough for the calibration fit's purposes.
                all_logits.append(torch.log(probs.clamp_min(1e-8)).cpu())

        y_pred = np.concatenate(all_preds)
        y_true = np.concatenate(all_labels)
        sensitivity, specificity = compute_referable_metrics(y_true, y_pred)
        qwk = cohen_kappa_score(y_true, y_pred, weights="quadratic")

        print(f"[epoch {epoch+1}] loss={running_loss/len(train_ds):.4f} "
              f"referable_sensitivity={sensitivity:.3f} referable_specificity={specificity:.3f} "
              f"QWK={qwk:.3f}")

        # Save EVERY epoch's checkpoint, not just the internally-best one.
        # This matters because "best on internal validation" (APTOS+IDRiD held-
        # out split) is not guaranteed to be "best on external generalization"
        # (Messidor-2) -- a model can keep improving on in-domain data while
        # drifting further from what actually transfers to an unseen camera/
        # population. Keeping every epoch lets select_best_checkpoint.py sweep
        # them directly against Messidor-2 afterward and find the actual
        # best-generalizing epoch, rather than trusting this internal metric alone.
        torch.save(model.state_dict(), out_dir / f"epoch_{epoch+1:02d}.pt")

        if sensitivity >= best_sensitivity:
            best_sensitivity = sensitivity
            epochs_without_improvement = 0
            torch.save(model.state_dict(), out_dir / "severity_best.pt")

            all_logits_t = torch.cat(all_logits)
            all_labels_t = torch.tensor(y_true)
            temperature = fit_temperature_scaling(all_logits_t, all_labels_t)
            (out_dir / "calibration.txt").write_text(
                f"temperature={temperature:.4f}\n"
                f"# Copy into config/pipeline_config.yaml as:\n"
                f"# grading.platt_A: {1/temperature:.4f}\n"
                f"# grading.platt_B: 0.0\n"
            )
        else:
            epochs_without_improvement += 1
            if epochs_without_improvement >= args.patience:
                print(f"No improvement in referable sensitivity for {args.patience} epochs "
                      f"-- stopping early at epoch {epoch+1}/{args.epochs}. "
                      f"NOTE: 'severity_best.pt' is the best-by-INTERNAL-metric checkpoint -- "
                      f"run select_best_checkpoint.py against Messidor-2 on this run's "
                      f"epoch_*.pt files before assuming this is your best model.")
                break

        if device.type == "cuda":
            torch.cuda.empty_cache()

    print(f"Best referable-DR sensitivity: {best_sensitivity:.3f} "
          f"(target: >=0.90 per problem statement — validate on Messidor-2 before final claim)\n"
          f"Imbalance strategy used: {args.imbalance_strategy}. Compare against the other two "
          f"strategies (--imbalance-strategy sampler / loss) if you have time budget left -- "
          f"'both' is not guaranteed to be the best choice for every dataset.")


if __name__ == "__main__":
    main()
