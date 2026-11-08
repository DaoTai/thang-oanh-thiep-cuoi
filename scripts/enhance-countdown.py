"""Retouch the countdown background photo.

    python scripts/enhance-countdown.py [source.jpg]

Needs numpy and Pillow (kept out of package.json on purpose; use a throwaway venv).
Reads assets-src/countdown.jpg (the untouched original, never deployed) and writes
public/assets/countdown-{960,1600}.webp.

Steps: crop -> neutral white balance -> airy tone curve -> brighter, cooler
(less orange) skin -> local contrast -> luminance-only sharpening -> webp.
Tune the constants below, then re-run.
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "assets-src" / "countdown.jpg"
OUT = ROOT / "public" / "assets"

# Crop as fractions of the upright image (x, y, w, h). Keeps the kiss and the rings.
CROP = (0.0, 0.12, 1.0, 0.62)
WIDTHS = (960, 1600)

SKIN_LIFT = 0.10  # extra luminance on skin (0-1)
SKIN_COOL = 0.03  # how much skin chroma is pulled toward neutral
GAMMA = 0.86  # <1 brightens midtones
CONTRAST = 0.06  # S-curve strength
SHARP = (1.6, 0.9, 3)  # unsharp radius (px at 1600w), percent/100, threshold


def srgb_to_ycc(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    y = 0.299 * r + 0.587 * g + 0.114 * b
    return y, (b - y) * 0.564, (r - y) * 0.713


def ycc_to_srgb(y, cb, cr):
    r = y + cr / 0.713
    b = y + cb / 0.564
    g = (y - 0.299 * r - 0.114 * b) / 0.587
    return np.stack([r, g, b], axis=-1)


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def blur(plane, radius):
    img = Image.fromarray((np.clip(plane, 0, 1) * 255).astype(np.uint8))
    return np.asarray(img.filter(ImageFilter.GaussianBlur(radius)), dtype=np.float32) / 255


def main():
    img = ImageOps.exif_transpose(Image.open(SRC)).convert("RGB")
    W, H = img.size
    x, y, w, h = CROP
    img = img.crop((int(x * W), int(y * H), int((x + w) * W), int((y + h) * H)))

    # Work once at the largest output size; smaller sizes are downscaled from it.
    big = WIDTHS[-1]
    img = img.resize((big, round(img.height * big / img.width)), Image.LANCZOS)
    a = np.asarray(img, dtype=np.float32) / 255

    # 1. White balance from the bright, low-chroma backdrop (top-right corner + left edge).
    lum = a.mean(axis=-1)
    bg = (lum > np.percentile(lum, 70)) & (a.max(-1) - a.min(-1) < 0.12)
    gain = a[bg].mean(0)
    gain = (gain.mean() / gain) ** 0.6  # partial: keep the backdrop slightly warm
    a = np.clip(a * gain, 0, 1)

    # 2. Tone: gamma lift, then a gentle S-curve and highlight roll-off.
    a = a**GAMMA
    a = a + CONTRAST * (a * a * (3 - 2 * a) - a)  # blend toward smoothstep = S-curve
    a = np.clip(a, 0, 1)
    a = np.where(a > 0.82, 0.82 + (a - 0.82) * 0.75, a)  # protect the white dress / wall

    # 3. Skin: lift and cool it, using a soft hue mask so suit, hair and backdrop stay put.
    yy, cb, cr = srgb_to_ycc(a)
    skin = (
        smoothstep(0.015, 0.06, cr)
        * (1 - smoothstep(-0.005, 0.03, cb))  # not magenta/blue
        * smoothstep(0.18, 0.40, yy)  # not hair or suit
        * (1 - smoothstep(0.88, 0.97, yy))  # not blown highlights
    )
    skin = blur(skin, 6)  # feather so there is no visible edge
    yy = yy + SKIN_LIFT * skin * (1 - yy)
    cb = cb * (1 - SKIN_COOL * skin * 0.4)
    cr = cr * (1 - SKIN_COOL * skin)
    a = np.clip(ycc_to_srgb(yy, cb, cr), 0, 1)

    # 4. Local contrast on luminance (large radius, small amount) for depth and "clean" light.
    yy, cb, cr = srgb_to_ycc(a)
    local = blur(yy, 40)
    yy = np.clip(yy + 0.12 * (yy - local), 0, 1)
    a = np.clip(ycc_to_srgb(yy, cb, cr), 0, 1)

    # Slight warmth on the whites so the paper tone of the site still matches.
    a[..., 0] = np.clip(a[..., 0] * 1.008, 0, 1)
    a[..., 2] = np.clip(a[..., 2] * 0.985, 0, 1)

    out = Image.fromarray((a * 255 + 0.5).astype(np.uint8))

    # 5. Sharpen luminance only (no colour fringes), after resizing each output.
    r, amount, thr = SHARP
    OUT.mkdir(parents=True, exist_ok=True)
    for wd in WIDTHS:
        im = out if wd == big else out.resize((wd, round(out.height * wd / out.width)), Image.LANCZOS)
        ycbcr = im.convert("YCbCr")
        yc, cbc, crc = ycbcr.split()
        k = wd / big
        yc = yc.filter(ImageFilter.UnsharpMask(radius=max(r * k, 0.8), percent=int(amount * 100), threshold=thr))
        im = Image.merge("YCbCr", (yc, cbc, crc)).convert("RGB")
        dest = OUT / f"countdown-{wd}.webp"
        im.save(dest, "WEBP", quality=84, method=6)
        print(f"{dest.relative_to(ROOT)}  {im.width}x{im.height}  {dest.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
