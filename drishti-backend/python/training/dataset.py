"""Dataset loaders for APTOS 2019, IDRiD, and Messidor-2.

Expected directory layout is documented in data/README.md. This module keeps
loading logic separate from training so the same loader can be reused for
both classifier training (dataset.py -> train_severity_classifier.py) and
segmentation training (dataset.py -> train_segmentation_models.py, via
IDRiDSegmentationDataset).
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np
import pandas as pd
from PIL import Image, ImageFile
from torch.utils.data import ConcatDataset, Dataset

# A handful of files in real-world dataset downloads (partial download, disk
# error during extraction, etc.) are truncated but otherwise readable -- this
# tells Pillow to load what data is present instead of raising OSError on the
# whole file. Applies globally to every dataset in this module.
ImageFile.LOAD_TRUNCATED_IMAGES = True

ICDR_LABELS = ["No DR", "Mild NPDR", "Moderate NPDR", "Severe NPDR", "Proliferative DR"]


def find_column(df: pd.DataFrame, candidates: list[str], kind: str, csv_hint: str = "the CSV") -> str:
    """Shared column auto-detector -- dataset label files vary in column
    naming across sources/mirrors, so every loader that reads a CSV in this
    module uses this instead of hardcoding one naming convention and quietly
    breaking on the next differently-formatted download."""
    normalized = {c.strip().lower().replace(" ", "_"): c for c in df.columns}
    for candidate in candidates:
        if candidate in normalized:
            return normalized[candidate]
    raise ValueError(
        f"Could not find a {kind} column in {csv_hint}. "
        f"Available columns: {list(df.columns)}. Expected one of: {candidates}. "
        f"Either rename the relevant column in your CSV to one of those, or add "
        f"your CSV's actual column name to the candidate list in dataset.py."
    )


def ben_graham_preprocess(image: np.ndarray, img_size: int) -> np.ndarray:
    """Local color/illumination normalization from the winning approach of the
    original 2015 Kaggle Diabetic Retinopathy Detection competition (Ben
    Graham). Subtracts a heavily-blurred version of the image from itself
    (roughly: local contrast/color enhancement), which substantially reduces
    the cross-camera, cross-illumination color differences between datasets
    (e.g. APTOS vs. Messidor-2's different camera hardware) that a plain
    ImageNet-style normalization does nothing to address -- this is the
    single most well-evidenced technique in the DR literature for exactly
    the domain-shift problem an external benchmark like Messidor-2 exposes.

    IMPORTANT: this must be applied identically at training AND inference
    time -- both here and in MATLAB's preprocessFundusForNet.m -- or the
    model sees systematically different input distributions between the two,
    silently degrading accuracy exactly like the earlier ImageNet-mean/std
    mismatch risk this codebase has already been careful about elsewhere.

    Applied AFTER resizing to a fixed square size (img_size), so the
    Gaussian sigma and circular-mask radius scale consistently regardless of
    the original image's resolution or aspect ratio.
    """
    sigma = img_size / 30.0
    blurred = cv2.GaussianBlur(image, (0, 0), sigma)
    enhanced = cv2.addWeighted(image, 4, blurred, -4, 128)

    # Mask the outer ~10% to a neutral gray -- removes residual border/vignette
    # artifacts that the local-contrast step can otherwise exaggerate at the
    # image edge, where the "local average" includes a lot of black background.
    mask = np.zeros(image.shape[:2], dtype=np.uint8)
    center = (img_size // 2, img_size // 2)
    radius = int(img_size * 0.45)
    cv2.circle(mask, center, radius, 1, thickness=-1)
    mask3 = np.dstack([mask] * 3)

    result = enhanced.astype(np.float32) * mask3 + 128 * (1 - mask3)
    return np.clip(result, 0, 255).astype(np.uint8)


@dataclass
class DRSample:
    image_path: Path
    icdr_level: int


class APTOSDataset(Dataset):
    """APTOS 2019 Blindness Detection — image + ICDR (0-4) label."""

    def __init__(self, data_dir: str | Path, split: str = "train", transform=None):
        self.data_dir = Path(data_dir)
        self.transform = transform
        csv_path = self.data_dir / "train.csv"
        if not csv_path.exists():
            raise FileNotFoundError(
                f"{csv_path} not found. See data/README.md for APTOS 2019 setup."
            )
        df = pd.read_csv(csv_path)

        # Stratified 85/15 split by diagnosis, seeded for reproducibility.
        df = df.sample(frac=1.0, random_state=42).reset_index(drop=True)
        split_idx = int(len(df) * 0.85)
        self.df = df.iloc[:split_idx] if split == "train" else df.iloc[split_idx:]
        self.df = self.df.reset_index(drop=True)

    def __len__(self) -> int:
        return len(self.df)

    def __getitem__(self, idx: int):
        row = self.df.iloc[idx]
        img_path = self.data_dir / "train_images" / f"{row['id_code']}.png"
        image = np.array(Image.open(img_path).convert("RGB"))
        label = int(row["diagnosis"])

        if self.transform:
            transformed = self.transform(image=image)
            image = transformed["image"]

        return image, label


class IDRiDGradingDataset(Dataset):
    """IDRiD 'B. Disease Grading' set — image + per-image ICDR (0-4) label.

    A SEPARATE part of the IDRiD archive from IDRiDSegmentationDataset (which
    uses 'A. Segmentation' for pixel-level lesion masks) -- this uses the
    disease-grading labels to add a second training data SOURCE (different
    camera/population than APTOS) to the severity classifier, which is the
    main lever for improving generalization to an unseen third source like
    Messidor-2: more source diversity during training, not just more images
    from the same source.
    """

    ID_COLUMN_CANDIDATES = ["image_name", "image_id", "id_code", "image", "filename"]
    LABEL_COLUMN_CANDIDATES = ["retinopathy_grade", "icdr_level", "diagnosis", "grade", "dr_grade"]

    def __init__(self, data_dir: str | Path, split: str = "train", transform=None):
        self.data_dir = Path(data_dir) / "B. Disease Grading"
        self.transform = transform
        split_name = "a. Training Set" if split == "train" else "b. Testing Set"

        self.img_dir = self.data_dir / "1. Original Images" / split_name
        label_dir = self.data_dir / "2. Groundtruths"

        if not self.img_dir.exists():
            raise FileNotFoundError(
                f"{self.img_dir} not found. See data/README.md for IDRiD Disease "
                f"Grading setup -- this is a separate folder from the segmentation set."
            )

        # The labels CSV filename varies slightly across IDRiD mirrors (e.g.
        # "a. IDRiD_Disease Grading_Training Labels.csv" vs similar) -- find
        # whichever CSV exists in the Groundtruths folder for this split
        # rather than hardcoding one exact filename.
        candidates = [f for f in label_dir.glob("*.csv") if split_name[3:].split()[0].lower() in f.name.lower()]
        if not candidates:
            candidates = list(label_dir.glob("*.csv"))
        if not candidates:
            raise FileNotFoundError(f"No labels CSV found in {label_dir}.")
        csv_path = candidates[0]

        self.df = pd.read_csv(csv_path)
        self.id_col = find_column(self.df, self.ID_COLUMN_CANDIDATES, "image name", csv_path.name)
        self.label_col = find_column(self.df, self.LABEL_COLUMN_CANDIDATES, "ICDR grade", csv_path.name)
        self.df = self.df[self.df[self.label_col].notna()].reset_index(drop=True)
        print(f"IDRiDGradingDataset ({split}): {len(self.df)} images from {csv_path.name}, "
              f"columns '{self.id_col}'/'{self.label_col}'.")

    def __len__(self) -> int:
        return len(self.df)

    def __getitem__(self, idx: int):
        row = self.df.iloc[idx]
        img_name = str(row[self.id_col]).strip()
        if not img_name.lower().endswith((".jpg", ".jpeg", ".png")):
            img_name = f"{img_name}.jpg"  # IDRiD grading images are .jpg
        img_path = self.img_dir / img_name
        image = np.array(Image.open(img_path).convert("RGB"))
        label = int(row[self.label_col])

        if self.transform:
            transformed = self.transform(image=image)
            image = transformed["image"]

        return image, label


def build_combined_severity_dataset(aptos_dir: str | Path, idrid_dir: str | Path,
                                     split: str, transform=None) -> ConcatDataset:
    """Combines APTOS 2019 + IDRiD Disease Grading into one training set for
    the severity classifier -- more than just more images, this adds a
    second camera/population source, which is the concrete lever for
    improving generalization to an unseen third source (Messidor-2) rather
    than just memorizing one dataset's specific visual characteristics more
    thoroughly. IDRiD's own 'b. Testing Set' split is used as extra
    validation data when split != 'train', kept separate from APTOS's val split."""
    aptos = APTOSDataset(aptos_dir, split=split, transform=transform)
    idrid_split = "train" if split == "train" else "test"
    idrid = IDRiDGradingDataset(idrid_dir, split=idrid_split, transform=transform)
    print(f"Combined severity dataset ({split}): {len(aptos)} APTOS + {len(idrid)} IDRiD "
          f"= {len(aptos) + len(idrid)} total images.")
    return ConcatDataset([aptos, idrid])


class IDRiDSegmentationDataset(Dataset):
    """IDRiD lesion segmentation set — image + per-lesion binary masks.

    Lesion types: MA (microaneurysms), HE (hemorrhages), EX (hard exudates),
    SE (soft exudates), OD (optic disc). Directory names follow the original
    IDRiD archive structure under 'A. Segmentation/'.
    """

    LESION_DIRS = {
        "MA": "1. Microaneurysms",
        "HE": "2. Haemorrhages",
        "EX": "3. Hard Exudates",
        "SE": "4. Soft Exudates",
        "OD": "5. Optic Disc",
    }

    def __init__(self, data_dir: str | Path, lesion_type: str = "MA", split: str = "train",
                 transform=None):
        if lesion_type not in self.LESION_DIRS:
            raise ValueError(f"lesion_type must be one of {list(self.LESION_DIRS)}")

        self.data_dir = Path(data_dir) / "A. Segmentation"
        self.lesion_type = lesion_type
        self.transform = transform
        split_name = "a. Training Set" if split == "train" else "b. Testing Set"

        self.img_dir = self.data_dir / "1. Original Images" / split_name
        self.mask_dir = self.data_dir / "2. All Segmentation Groundtruths" / split_name / self.LESION_DIRS[lesion_type]

        if not self.img_dir.exists():
            raise FileNotFoundError(
                f"{self.img_dir} not found. See data/README.md for IDRiD setup."
            )

        self.image_files = sorted(
            f for f in os.listdir(self.img_dir) if f.lower().endswith((".jpg", ".png"))
        )

    def __len__(self) -> int:
        return len(self.image_files)

    def __getitem__(self, idx: int):
        img_name = self.image_files[idx]
        image = np.array(Image.open(self.img_dir / img_name).convert("RGB"))

        mask_name = img_name.rsplit(".", 1)[0] + f"_{self.lesion_type}.tif"
        mask_path = self.mask_dir / mask_name
        if mask_path.exists():
            mask = np.array(Image.open(mask_path).convert("L"))
        else:
            mask = np.zeros(image.shape[:2], dtype=np.uint8)  # no lesion of this type -> empty mask

        if self.transform:
            transformed = self.transform(image=image, mask=mask)
            image, mask = transformed["image"], transformed["mask"]

        return image, mask


class Messidor2Dataset(Dataset):
    """Messidor-2 — held-out external benchmark, never used in training/tuning."""

    # Messidor-2 label files vary by source (no single official CSV format) --
    # auto-detect the id/label columns instead of hardcoding one naming
    # convention, so this doesn't break the moment someone's download uses
    # different column names than whatever example the code was written against.
    ID_COLUMN_CANDIDATES = ["image_id", "id_code", "image", "filename", "image_name"]
    LABEL_COLUMN_CANDIDATES = [
        "icdr_level", "diagnosis", "retinopathy_grade", "dr_grade", "grade", "adjudicated_dr_grade",
    ]

    def __init__(self, data_dir: str | Path, transform=None):
        self.data_dir = Path(data_dir)
        csv_path = self.data_dir / "messidor2_labels.csv"
        if not csv_path.exists():
            raise FileNotFoundError(
                f"{csv_path} not found. See data/README.md for Messidor-2 setup."
            )
        self.df = pd.read_csv(csv_path)
        self.transform = transform

        self.id_col = find_column(self.df, self.ID_COLUMN_CANDIDATES, "image id", "messidor2_labels.csv")
        self.label_col = find_column(self.df, self.LABEL_COLUMN_CANDIDATES, "ICDR label", "messidor2_labels.csv")

        # The official Messidor-2 grade release marks a handful of images as
        # ungradable (missing/NaN grade) -- drop those rather than crash on
        # int(nan). ~4 of 1748 images are excluded this way in the standard
        # Krause et al. release, leaving the commonly-cited 1744.
        before = len(self.df)
        self.df = self.df[self.df[self.label_col].notna()].reset_index(drop=True)
        dropped = before - len(self.df)
        if dropped > 0:
            print(f"Messidor2Dataset: dropped {dropped} image(s) with missing/ungradable label.")

        print(f"Messidor2Dataset: using column '{self.id_col}' for image filename, "
              f"'{self.label_col}' for ICDR level. {len(self.df)} gradable images.")

    def __len__(self) -> int:
        return len(self.df)

    def __getitem__(self, idx: int):
        row = self.df.iloc[idx]
        img_name = str(row[self.id_col])
        img_path = self._resolve_image_path(img_name)
        image = np.array(Image.open(img_path).convert("RGB"))
        label = int(row[self.label_col])

        if self.transform:
            transformed = self.transform(image=image)
            image = transformed["image"]

        return image, label

    def _resolve_image_path(self, img_name: str) -> Path:
        """Handles label files that store the filename with or without an
        extension -- tries the name as-is first, then common image extensions."""
        direct = self.data_dir / "images" / img_name
        if direct.exists():
            return direct
        for ext in (".jpg", ".jpeg", ".png", ".tif"):
            candidate = self.data_dir / "images" / f"{img_name}{ext}"
            if candidate.exists():
                return candidate
        raise FileNotFoundError(
            f"Could not find image '{img_name}' (with or without common extensions) "
            f"in {self.data_dir / 'images'}."
        )
