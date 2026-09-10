"""Export a trained PyTorch checkpoint (classifier or segmentation model) to
ONNX for import into MATLAB via matlab/models/importPyTorchModel.m
(importNetworkFromONNX).

Usage:
    python export_onnx.py --checkpoint runs/severity_best.pt \\
        --model-type classifier --out ../../matlab/models/severity_net.onnx

    python export_onnx.py --checkpoint runs/ma_seg_best.pt \\
        --model-type segmentation --out ../../matlab/models/ma_seg_net.onnx
"""
from __future__ import annotations

import argparse
from pathlib import Path

import onnx
import torch

from train_segmentation_models import UNet
from train_severity_classifier import build_model


def export_classifier(checkpoint_path: str, out_path: str, img_size: int = 380):
    model = build_model()
    model.load_state_dict(torch.load(checkpoint_path, map_location="cpu"))
    model.eval()

    dummy_input = torch.randn(1, 3, img_size, img_size)
    torch.onnx.export(
        model, dummy_input, out_path,
        input_names=["fundus_image"],
        output_names=["icdr_logits"],
        dynamic_axes={"fundus_image": {0: "batch"}, "icdr_logits": {0: "batch"}},
        opset_version=17,
        dynamo=False,  # forces the legacy TorchScript-based exporter, which
                        # doesn't need the separate onnxscript package (newer
                        # PyTorch defaults to the dynamo exporter, which does)
    )


def export_segmentation(checkpoint_path: str, out_path: str, img_size: int = 512):
    model = UNet()
    model.load_state_dict(torch.load(checkpoint_path, map_location="cpu"))
    model.eval()

    dummy_input = torch.randn(1, 3, img_size, img_size)
    torch.onnx.export(
        model, dummy_input, out_path,
        input_names=["fundus_image"],
        output_names=["lesion_mask_logits"],
        dynamic_axes={"fundus_image": {0: "batch"}, "lesion_mask_logits": {0: "batch"}},
        opset_version=17,
        dynamo=False,
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--model-type", choices=["classifier", "segmentation"], default="classifier")
    args = parser.parse_args()

    Path(args.out).parent.mkdir(parents=True, exist_ok=True)

    if args.model_type == "classifier":
        export_classifier(args.checkpoint, args.out)
    else:
        export_segmentation(args.checkpoint, args.out)

    # Sanity-check the exported graph before handing off to MATLAB.
    onnx_model = onnx.load(args.out)
    onnx.checker.check_model(onnx_model)
    print(f"Exported and validated ONNX model -> {args.out}")
    print("Next: in MATLAB, run importPyTorchModel('<out path>') to verify import.")


if __name__ == "__main__":
    main()
