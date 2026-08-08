#!/usr/bin/env python3
"""Generate the PWA / home-screen icons in icons/.

The mark is the same nine-square cube face used by the inline SVG favicon in
index.html, drawn directly with Pillow rather than rasterising SVG so the
output is reproducible without an SVG toolchain.

Run from the repo root:  python3 _make_icons.py
"""

import os

from PIL import Image, ImageDraw

# Same palette and reading order as the favicon in index.html.
COLORS = [
    ["#FF6B35", "#F7C948", "#2ECC71"],
    ["#E74C3C", "#6366F1", "#3498DB"],
    ["#9B59B6", "#1ABC9C", "#FF6B35"],
]

# App background: --lu-bg / oklch(0.141 0.005 285.823) == zinc-950.
BG = "#09090b"

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "icons")

# Supersample, then downscale, so the rounded corners come out smooth.
SS = 4


def draw_mark(size, mark_ratio, background):
    """A `size`x`size` RGB icon whose cube face spans `mark_ratio` of the edge."""
    canvas = size * SS
    img = Image.new("RGB", (canvas, canvas), background)
    draw = ImageDraw.Draw(img)

    mark = canvas * mark_ratio
    origin = (canvas - mark) / 2.0

    # Nine tiles on a 10-unit grid: 3 units per tile, 0.5 between them.
    unit = mark / 10.0
    tile = unit * 3.0
    gap = unit * 0.5
    radius = tile * 0.18

    for row in range(3):
        for col in range(3):
            x = origin + col * (tile + gap)
            y = origin + row * (tile + gap)
            draw.rounded_rectangle(
                [x, y, x + tile, y + tile],
                radius=radius,
                fill=COLORS[row][col],
            )

    return img.resize((size, size), Image.LANCZOS)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    icons = [
        # (filename, size, how much of the edge the mark covers)
        ("icon-192.png", 192, 0.78),
        ("icon-512.png", 512, 0.78),
        # Android crops maskable icons to a circle: keep the mark inside the
        # 80% safe zone so no corner tile gets clipped.
        ("icon-maskable-512.png", 512, 0.56),
        # iOS applies its own rounded mask and composites transparency on
        # black, so this one stays opaque and full-bleed.
        ("apple-touch-icon-180.png", 180, 0.76),
    ]

    for name, size, ratio in icons:
        path = os.path.join(OUT_DIR, name)
        draw_mark(size, ratio, BG).save(path, "PNG", optimize=True)
        print(f"wrote {path} ({size}x{size})")


if __name__ == "__main__":
    main()
