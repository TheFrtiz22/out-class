#!/usr/bin/env python3
"""Export JPEG counterparts of the OutClass premium-board SVG assets.

Run: python -m pip install pillow cairosvg
     python scripts/export-premium-board-jpegs.py

SVGs stay as the source of truth. JPEG does not support transparency.
"""
from io import BytesIO
from pathlib import Path

import cairosvg
from PIL import Image

ASSETS = Path(__file__).resolve().parents[1] / "public" / "brand" / "premium-board"
IVORY = "#FFF9F1"
NAVY = "#0F2E56"

# Scale factor and matte color for each artwork.
ARTWORK = {
    "01_hero_on_navy": (2, NAVY),
    "02_primary_lockup": (5, IVORY),
    "03_stacked_lockup": (5, IVORY),
    "04_wordmark_no_sword": (5, IVORY),
    "05_app_icon_primary": (6, IVORY),
    "06_app_icon_light": (6, IVORY),
    "07_favicon": (6, IVORY),
    "08_monogram_no_sword": (6, IVORY),
    "09_monochrome_lockup": (5, IVORY),
    "10_hero_transparent": (3, NAVY),
}


def main() -> None:
    for stem, (scale, matte) in ARTWORK.items():
        source = ASSETS / f"{stem}.svg"
        if not source.is_file():
            raise FileNotFoundError(source)
        raster = Image.open(
            BytesIO(cairosvg.svg2png(url=str(source), scale=scale))
        ).convert("RGBA")
        background = Image.new("RGBA", raster.size, matte)
        background.alpha_composite(raster)
        target = ASSETS / f"{stem}.jpg"
        background.convert("RGB").save(
            target,
            "JPEG",
            quality=95,
            subsampling=0,  # Full-color chroma, preserve navy/orange edges.
            optimize=True,
            progressive=True,
            dpi=(300, 300),
        )
        with Image.open(target) as check:
            check.verify()
        print(f"{target.relative_to(ASSETS)}: {raster.width}×{raster.height}")

    assert len(list(ASSETS.glob("*.jpg"))) >= len(ARTWORK)


if __name__ == "__main__":
    main()
