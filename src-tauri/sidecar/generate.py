#!/usr/bin/env python3
"""
MADE TripoSR sidecar — CPU-only 3D mesh generation.

Usage (called by Tauri via tauri-plugin-shell):
  generate.py --quality fast|full [--weights <path>]

Reads a PNG image (base64) from stdin, writes OBJ text to stdout.

Prerequisites (first-run download via `npm run tauri -- download-weights`):
  pip install triposr torch torchvision pillow

Model: stabilityai/TripoSR (~1 GB), CPU inference ~1-2 min on 2017 i7-U.
"""

import sys
import argparse
import base64
import io

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--quality", choices=["fast", "full"], default="fast")
    parser.add_argument("--weights", default=None)
    args = parser.parse_args()

    # Read base64 PNG from stdin
    b64 = sys.stdin.read().strip()
    if not b64:
        print("# ERROR: no image received", file=sys.stderr)
        sys.exit(1)

    try:
        from PIL import Image  # type: ignore
        img_bytes = base64.b64decode(b64)
        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    except Exception as e:
        print(f"# ERROR loading image: {e}", file=sys.stderr)
        sys.exit(1)

    # Reduce resolution for speed on integrated GPU / CPU
    max_side = 256 if args.quality == "fast" else 512
    img.thumbnail((max_side, max_side))

    try:
        import torch  # type: ignore
        from tsr.system import TSR  # type: ignore

        weights = args.weights or "weights/triposr/model.ckpt"
        model = TSR.from_pretrained(weights, config_name="config.yaml")
        model.renderer.set_chunk_size(8192)
        model.eval()

        with torch.no_grad():
            scene_codes = model([img], device="cpu")
            mesh = model.extract_mesh(scene_codes, resolution=32)[0]

        # Write OBJ to stdout
        import tempfile, os  # noqa
        with tempfile.NamedTemporaryFile(suffix=".obj", delete=False) as f:
            tmp = f.name
        mesh.export(tmp)
        with open(tmp) as f:
            print(f.read())
        os.unlink(tmp)

    except ImportError as e:
        print(f"# ERROR: missing dependency — {e}", file=sys.stderr)
        print("# Run: pip install triposr torch torchvision pillow", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
