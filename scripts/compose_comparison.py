#!/usr/bin/env python3
"""Compose one untouched source image and its Monet-style counterpart."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageOps


BACKGROUND = (247, 244, 238)  # #F7F4EE
BORDER = (229, 224, 215)  # #E5E0D7
ASPECT_TOLERANCE = 0.002


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create a gallery-paper comparison PNG for one source/effect pair."
    )
    parser.add_argument("--original", required=True, type=Path)
    parser.add_argument("--effect", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    return parser.parse_args()


def load_upright_rgb(path: Path) -> Image.Image:
    if not path.is_file():
        raise FileNotFoundError(f"Image not found: {path}")
    with Image.open(path) as opened:
        opened.load()
        upright = ImageOps.exif_transpose(opened)
        flattened = Image.new("RGBA", upright.size, BACKGROUND + (255,))
        flattened.alpha_composite(upright.convert("RGBA"))
        return flattened.convert("RGB")


def relative_aspect_error(a: tuple[int, int], b: tuple[int, int]) -> float:
    a_ratio = a[0] / a[1]
    b_ratio = b[0] / b[1]
    return abs(a_ratio - b_ratio) / a_ratio


def bordered_tile(image: Image.Image, border: int) -> Image.Image:
    tile = Image.new(
        "RGB", (image.width + 2 * border, image.height + 2 * border), BORDER
    )
    tile.paste(image, (border, border))
    return tile


def compose(original: Image.Image, effect: Image.Image) -> tuple[Image.Image, dict]:
    effect_input_size = effect.size
    aspect_error = relative_aspect_error(original.size, effect.size)
    if aspect_error > ASPECT_TOLERANCE:
        raise ValueError(
            "Effect aspect ratio differs from the original by "
            f"{aspect_error:.3%}; maximum allowed is {ASPECT_TOLERANCE:.3%}. "
            "Regenerate the effect instead of cropping or stretching it."
        )

    resampling = getattr(Image, "Resampling", Image).LANCZOS
    effect = effect.resize(original.size, resampling)

    short_edge = min(original.size)
    margin = max(1, round(short_edge * 0.04))
    gap = max(1, round(short_edge * 0.04))
    border = max(1, round(short_edge * 0.00125))

    original_tile = bordered_tile(original, border)
    effect_tile = bordered_tile(effect, border)
    tile_w, tile_h = original_tile.size

    if original.width > original.height:
        layout = "vertical"
        canvas_size = (tile_w + 2 * margin, 2 * tile_h + gap + 2 * margin)
        positions = ((margin, margin), (margin, margin + tile_h + gap))
    else:
        layout = "horizontal"
        canvas_size = (2 * tile_w + gap + 2 * margin, tile_h + 2 * margin)
        positions = ((margin, margin), (margin + tile_w + gap, margin))

    canvas = Image.new("RGB", canvas_size, BACKGROUND)
    canvas.paste(original_tile, positions[0])
    canvas.paste(effect_tile, positions[1])
    metadata = {
        "layout": layout,
        "source_size": list(original.size),
        "effect_input_size": list(effect_input_size),
        "canvas_size": list(canvas_size),
        "margin_px": margin,
        "gap_px": gap,
        "border_px": border,
        "aspect_error": aspect_error,
    }
    return canvas, metadata


def main() -> None:
    args = parse_args()
    if args.output.suffix.lower() != ".png":
        raise ValueError("Output path must end in .png")
    if args.output.resolve() in {args.original.resolve(), args.effect.resolve()}:
        raise ValueError("Output must not overwrite the original or effect image")

    original = load_upright_rgb(args.original)
    effect = load_upright_rgb(args.effect)
    canvas, metadata = compose(original, effect)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(args.output, format="PNG", compress_level=9)
    metadata["output"] = str(args.output.resolve())
    print(json.dumps(metadata, ensure_ascii=False))


if __name__ == "__main__":
    main()
