"""Train U-Net segmentation models for each lesion type on IDRiD, to replace
the classical (matched-filter / top-hat) baselines in the MATLAB pipeline's
segmentVessels.m / detectMicroaneurysms.m / segmentExudates.m once trained.

Usage:
    python train_segmentation_models.py --data-dir ../../data/idrid --lesion-type MA --epochs 40

Trains one lesion type per run since each (MA/HE/EX/SE) has very different
scale, morphology, and class balance — a single multi-class model tends to be
dominated by the majority (background) class and under-segment the rarest,
most clinically important lesions (microaneurysms).
"""
from __future__ import annotations

import argparse
from pathlib import Path

import albumentations as A
import numpy as np
import torch
import torch.nn as nn
from albumentations.pytorch import ToTensorV2
from torch.utils.data import DataLoader
from tqdm import tqdm

from dataset import IDRiDSegmentationDataset

IMG_SIZE = 512


class DoubleConv(nn.Module):
    def __init__(self, in_ch, out_ch):
        super().__init__()
        self.block = nn.Sequential(
            nn.Conv2d(in_ch, out_ch, 3, padding=1), nn.BatchNorm2d(out_ch), nn.ReLU(inplace=True),
            nn.Conv2d(out_ch, out_ch, 3, padding=1), nn.BatchNorm2d(out_ch), nn.ReLU(inplace=True),
        )

    def forward(self, x):
        return self.block(x)


class UNet(nn.Module):
    """Compact U-Net — deliberately smaller than a reference implementation
    (base width 32 vs. the common 64) to train quickly on IDRiD's small
    (~400 image) training set within hackathon compute/time budgets, while
    remaining a standard, well-understood architecture for the report."""

    def __init__(self, in_ch=3, out_ch=1, base=32):
        super().__init__()
        self.enc1 = DoubleConv(in_ch, base)
        self.enc2 = DoubleConv(base, base * 2)
        self.enc3 = DoubleConv(base * 2, base * 4)
        self.pool = nn.MaxPool2d(2)

        self.bottleneck = DoubleConv(base * 4, base * 8)

        self.up3 = nn.ConvTranspose2d(base * 8, base * 4, 2, stride=2)
        self.dec3 = DoubleConv(base * 8, base * 4)
        self.up2 = nn.ConvTranspose2d(base * 4, base * 2, 2, stride=2)
        self.dec2 = DoubleConv(base * 4, base * 2)
        self.up1 = nn.ConvTranspose2d(base * 2, base, 2, stride=2)
        self.dec1 = DoubleConv(base * 2, base)

        self.out_conv = nn.Conv2d(base, out_ch, 1)

    def forward(self, x):
        e1 = self.enc1(x)
        e2 = self.enc2(self.pool(e1))
        e3 = self.enc3(self.pool(e2))
        b = self.bottleneck(self.pool(e3))

        d3 = self.dec3(torch.cat([self.up3(b), e3], dim=1))
        d2 = self.dec2(torch.cat([self.up2(d3), e2], dim=1))
        d1 = self.dec1(torch.cat([self.up1(d2), e1], dim=1))
        return self.out_conv(d1)


def dice_loss(pred_logits: torch.Tensor, target: torch.Tensor, eps: float = 1e-6) -> torch.Tensor:
    pred = torch.sigmoid(pred_logits)
    intersection = (pred * target).sum(dim=(1, 2, 3))
    union = pred.sum(dim=(1, 2, 3)) + target.sum(dim=(1, 2, 3))
    dice = (2 * intersection + eps) / (union + eps)
    return 1 - dice.mean()


def dice_score(pred_logits: torch.Tensor, target: torch.Tensor, threshold: float = 0.5) -> float:
    pred = (torch.sigmoid(pred_logits) > threshold).float()
    intersection = (pred * target).sum()
    union = pred.sum() + target.sum()
    return float((2 * intersection / (union + 1e-6)).item())


def build_transforms(train: bool):
    aug = [A.Resize(IMG_SIZE, IMG_SIZE)]
    if train:
        aug += [
            A.HorizontalFlip(p=0.5),
            A.VerticalFlip(p=0.5),
            A.Rotate(limit=20, p=0.6),
            A.RandomBrightnessContrast(p=0.3),
        ]
    aug += [A.Normalize(), ToTensorV2()]
    return A.Compose(aug)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", required=True)
    parser.add_argument("--lesion-type", required=True, choices=["MA", "HE", "EX", "SE", "OD"])
    parser.add_argument("--epochs", type=int, default=40)
    parser.add_argument("--batch-size", type=int, default=4)  # small: 512px images, IDRiD is tiny
    parser.add_argument("--lr", type=float, default=1e-4)
    parser.add_argument("--out-dir", default="runs")
    args = parser.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    train_ds = IDRiDSegmentationDataset(args.data_dir, args.lesion_type, "train", build_transforms(True))
    val_ds = IDRiDSegmentationDataset(args.data_dir, args.lesion_type, "test", build_transforms(False))

    train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True, num_workers=2)
    val_loader = DataLoader(val_ds, batch_size=args.batch_size, shuffle=False, num_workers=2)

    model = UNet().to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr)

    best_dice = 0.0
    for epoch in range(args.epochs):
        model.train()
        running_loss = 0.0
        for images, masks in tqdm(train_loader, desc=f"[{args.lesion_type}] epoch {epoch+1}/{args.epochs}"):
            images = images.to(device)
            masks = masks.unsqueeze(1).float().to(device) if masks.dim() == 3 else masks.float().to(device)

            optimizer.zero_grad()
            logits = model(images)
            loss = dice_loss(logits, masks) + nn.functional.binary_cross_entropy_with_logits(logits, masks)
            loss.backward()
            optimizer.step()
            running_loss += loss.item() * images.size(0)

        model.eval()
        dices = []
        with torch.no_grad():
            for images, masks in val_loader:
                images = images.to(device)
                masks = masks.unsqueeze(1).float().to(device) if masks.dim() == 3 else masks.float().to(device)
                logits = model(images)
                dices.append(dice_score(logits, masks))

        mean_dice = float(np.mean(dices)) if dices else 0.0
        print(f"[{args.lesion_type}][epoch {epoch+1}] loss={running_loss/len(train_ds):.4f} val_dice={mean_dice:.4f}")

        if mean_dice >= best_dice:
            best_dice = mean_dice
            torch.save(model.state_dict(), out_dir / f"{args.lesion_type.lower()}_seg_best.pt")

    print(f"[{args.lesion_type}] best val Dice: {best_dice:.4f}")


if __name__ == "__main__":
    main()
