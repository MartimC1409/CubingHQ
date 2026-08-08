#!/usr/bin/env python3
"""Generate icons/og-image.png, the 1200x630 social/preview card.

Same nine-square cube mark and palette as _make_icons.py and the inline SVG
favicon in index.html, so the preview card matches the app rather than being
a separate piece of art to keep in sync.

Drawn with Pillow rather than rasterising SVG, for the same reason as the
icons: reproducible without an SVG toolchain.

Run from the repo root:  python3 scripts/make_og_image.py
"""

import os

from PIL import Image, ImageDraw, ImageFont

# Same palette and reading order as the favicon in index.html.
COLORS = [
    ["#FF6B35", "#F7C948", "#2ECC71"],
    ["#E74C3C", "#6366F1", "#3498DB"],
    ["#9B59B6", "#1ABC9C", "#FF6B35"],
]

BG = "#09090b"
TEXT = "#E8E9F0"
MUTED = "#8B8FA8"
ACCENT = "#F97316"

WIDTH, HEIGHT = 1200, 630

# Supersample so the rounded tile corners come out smooth.
SS = 2

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_PATH = os.path.join(REPO_ROOT, "icons", "og-image.png")

# Whatever the box happens to have. The layout tolerates a missing font by
# falling back to Pillow's bitmap default — ugly, but it still builds.
FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
]


def load_font(size):
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def draw_mark(draw, x, y, mark):
    """Nine tiles on a 10-unit grid, top-left at (x, y), spanning `mark`."""
    unit = mark / 10.0
    tile = unit * 3.0
    gap = unit * 0.5
    radius = tile * 0.18

    for row in range(3):
        for col in range(3):
            tx = x + col * (tile + gap)
            ty = y + row * (tile + gap)
            draw.rounded_rectangle(
                [tx, ty, tx + tile, ty + tile],
                radius=radius,
                fill=COLORS[row][col],
            )


def main():
    canvas_w, canvas_h = WIDTH * SS, HEIGHT * SS
    img = Image.new("RGB", (canvas_w, canvas_h), BG)
    draw = ImageDraw.Draw(img)

    # A soft accent wash in the lower right, echoing the app's background
    # glows. Concentric rounded rectangles rather than a real gradient — at
    # this size and opacity the banding is invisible.
    for i in range(24):
        t = i / 24.0
        pad = int(canvas_w * 0.02 * i)
        draw.ellipse(
            [canvas_w * 0.72 - pad, canvas_h * 0.62 - pad,
             canvas_w * 1.25 + pad, canvas_h * 1.45 + pad],
            fill=(
                int(9 + (249 - 9) * 0.020 * (1 - t)),
                int(9 + (115 - 9) * 0.020 * (1 - t)),
                int(11 + (22 - 11) * 0.020 * (1 - t)),
            ),
        )

    margin = int(canvas_w * 0.075)
    mark = int(canvas_h * 0.30)
    draw_mark(draw, margin, int(canvas_h * 0.17), mark)

    title_font = load_font(int(canvas_h * 0.115))
    sub_font = load_font(int(canvas_h * 0.052))
    tag_font = load_font(int(canvas_h * 0.040))

    ty = int(canvas_h * 0.55)
    draw.text((margin, ty), "CubingHQ", font=title_font, fill=TEXT)

    ty += int(canvas_h * 0.145)
    draw.text((margin, ty), "WCA Competition Simulator", font=sub_font, fill=ACCENT)

    ty += int(canvas_h * 0.080)
    draw.text(
        (margin, ty),
        "Real scrambles · enforced inspection · scorecards",
        font=tag_font,
        fill=MUTED,
    )

    img = img.resize((WIDTH, HEIGHT), Image.LANCZOS)
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    img.save(OUT_PATH, "PNG", optimize=True)
    print(f"wrote {OUT_PATH} ({os.path.getsize(OUT_PATH)} bytes)")


if __name__ == "__main__":
    main()
