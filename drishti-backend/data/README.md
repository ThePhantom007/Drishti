# Datasets

Public, labeled fundus image datasets used for training and benchmark validation.
None require a physical fundus camera — this is how real DR-screening research/products
validate against ground truth.

## 1. APTOS 2019 Blindness Detection (primary training set)
- ~3,662 labeled fundus images, ICDR 0-4 severity labels.
- Source: Kaggle — https://www.kaggle.com/c/aptos2019-blindness-detection
- Download and extract to `data/aptos2019/` with `train.csv` + `train_images/`.

## 2. IDRiD — Indian Diabetic Retinopathy Image Dataset
- 516 images with pixel-level lesion segmentation masks (microaneurysms, hemorrhages,
  hard/soft exudates, optic disc) — use this for training/validating the segmentation
  modules (Module 2), not just the classifier.
- Source: https://idrid.grand-challenge.org/
- Extract to `data/idrid/` — keep the `A. Segmentation/`, `B. Disease Grading/` folder
  structure from the original archive.
- **Notable**: this is an Indian dataset (collected in Nanded, Maharashtra) — good to
  cite explicitly in your pitch since it's directly relevant to the Indian population
  the district-level rollout targets.
- **Also used for severity classifier training** (not just segmentation): the
  `B. Disease Grading/` folder has its own per-image ICDR labels, separate from the
  segmentation masks in `A. Segmentation/`. Pass `--include-idrid` to
  `train_severity_classifier.py` to train on APTOS + IDRiD combined — this adds a
  second camera/population source, which meaningfully helps generalization to an
  unseen third source (Messidor-2) versus training on APTOS alone.

## 3. Messidor-2 (external validation / benchmark comparison)
- 1,748 images (1,744 gradable), used as a held-out benchmark in most published
  DR-screening papers — train on APTOS+IDRiD, report final sensitivity/specificity
  on Messidor-2 so your numbers are directly comparable to published baselines
  (this is what the problem statement means by "validation against published
  benchmarks").
- **Important: images and grades come from two SEPARATE sources.** The
  Messidor-2 dataset itself was released without official diagnostic labels —
  every paper that benchmarks on it uses third-party adjudicated grades
  released later by a Google Brain team (Krause et al.), not anything from
  the original image release.
  - **Images**: https://www.adcis.net/en/third-party/messidor2/ (registration
    required). Note: some files on this site are just metadata (e.g. a
    left/right eye pairing manifest) -- make sure you're downloading the
    actual image archive, not just a manifest CSV.
  - **Grades**: Kaggle dataset `google-brain/messidor2-dr-grades` ("MESSIDOR-2
    DR Grades" — adjudicated DR severity, DME, and gradability). Requires a
    free Kaggle account. This is the standard source essentially every
    published Messidor-2 benchmark result uses.
  - ~4 of the 1,748 images are marked ungradable in the official release;
    `Messidor2Dataset` in `python/training/dataset.py` automatically drops
    any row with a missing grade, leaving the commonly-cited 1,744.
- Rename/save the Kaggle grades file to `data/messidor2/messidor2_labels.csv`.
  `Messidor2Dataset` auto-detects common column name variants (`image_id` /
  `id_code` / `image` / `filename` for the filename column;
  `adjudicated_dr_grade` / `diagnosis` / `grade` / etc. for the label column)
  — if it still can't find the right columns, it will print the actual column
  names in your CSV so you can add them to the candidate list in dataset.py.

## Expected directory layout after setup

```
data/
├── aptos2019/
│   ├── train.csv
│   └── train_images/*.png
├── idrid/
│   ├── A. Segmentation/
│   └── B. Disease Grading/
└── messidor2/
    ├── messidor2_labels.csv
    └── images/*.jpg
```

## Split strategy
- Train: APTOS 2019 train split + IDRiD grading set (~85%)
- Internal validation: held-out 15% stratified by ICDR level (class imbalance is
  severe — level 4/PDR is rare, stratify carefully)
- External benchmark: Messidor-2, never touched during training/tuning — only used
  once, at the end, to report final sensitivity/specificity for the pitch deck.
