"""Retouch the groom portrait so it sits next to the bride's (nmt_9720-bride).

    python scripts/enhance-groom.py [source.jpg]

Needs numpy and Pillow (kept out of package.json on purpose; use a throwaway venv).
Reads assets-src/groom.jpg (the untouched original, never deployed) and writes a
3:4 crop to public/assets/album/thang-groom.jpg. Then run `npm run assets -- photos`
to get album/web/thang-groom-{480,960,1600}.webp and its entry in js/photos.js
(the "-groom" suffix keeps it out of the gallery).

The bride's photo is a bright, cool light-grey studio shot with luminous pink skin.
The groom's original is a warm cream wall with tanned, orange-leaning skin, so:
crop -> cool the wall to the bride's grey -> airy tone curve -> brighter, pinker
skin -> soften leaf shadows a touch -> luminance-only sharpening.
Tune the constants below, then re-run.
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "assets-src" / "groom.jpg"
DEST = ROOT / "public" / "assets" / "album" / "thang-groom.jpg"

# Crop as fractions of the upright image (x, y, w); height follows from 3:4.
# Head to bouquet, framed like the bride (head top ~10% down, face centred).
CROP = (0.2505, 0.2055, 0.5008)
WORK_W = 2000  # same scale as the bride crop (2012 px wide)

# Target backdrop: the bride's wall measures about (205, 206, 210), a cool grey.
# The groom's wall is brighter, so it is pulled part of the way toward WALL_Y.
WALL_TINT = np.array([0.990, 1.000, 1.022])  # relative RGB of the target grey
GAMMA = 0.90  # <1 brightens midtones
CONTRAST = 0.05  # S-curve strength
SKIN_LIFT = 0.28  # extra luminance on skin (0-1)
SKIN_PINK = 0.14  # extra red-magenta on skin, toward the bride's rosy tone
SKIN_UNYELLOW = 0.12  # how much skin yellow (negative Cb) is reduced
WALL_Y = 0.83  # target wall luminance (bride ~0.81)
WALL_PULL = 0.55  # 0 keeps the wall brightness, 1 matches WALL_Y
SHADOW_SOFTEN = 0.18  # lifts the leaf shadows on the wall (0 keeps them)
SHARP = (1.5, 0.8, 3)  # unsharp radius (px at 1600w), percent/100, threshold


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
    x, y, w = CROP
    cw = int(w * W)
    ch = min(round(cw * 4 / 3), H - int(y * H))
    img = img.crop((int(x * W), int(y * H), int(x * W) + cw, int(y * H) + ch))
    img = img.resize((WORK_W, round(img.height * WORK_W / img.width)), Image.LANCZOS)
    a = np.asarray(img, dtype=np.float32) / 255

    # 1. White balance from the wall (bright, low chroma), toward the bride's cool grey.
    lum = a.mean(axis=-1)
    wall = (lum > np.percentile(lum, 55)) & (a.max(-1) - a.min(-1) < 0.14)
    ref = a[wall].mean(0)
    gain = ref.mean() / ref * WALL_TINT
    a = np.clip(a * gain, 0, 1)

    # 2. Tone: gamma lift, gentle S-curve, highlight roll-off (white shirt, wall).
    a = a**GAMMA
    a = a + CONTRAST * (a * a * (3 - 2 * a) - a)
    a = np.clip(a, 0, 1)
    a = np.where(a > 0.86, 0.86 + (a - 0.86) * 0.7, a)

    # 3. Skin: brighter and less orange (raise blue, ease red) with a feathered hue mask,
    #    so the dark suit, hair, tie and green stems stay put.
    yy, cb, cr = srgb_to_ycc(a)
    skin = (
        smoothstep(0.03, 0.07, cr)
        * (1 - smoothstep(0.0, 0.03, cb))
        * smoothstep(0.22, 0.42, yy)
        * (1 - smoothstep(0.90, 0.98, yy))
    )
    skin = blur(skin, 5)
    yy = yy + SKIN_LIFT * skin * (1 - yy)
    cb = cb * (1 - SKIN_UNYELLOW * skin)  # less yellow
    cr = cr * (1 + SKIN_PINK * skin)  # rosier
    a = np.clip(ycc_to_srgb(yy, cb, cr), 0, 1)

    # 4. Soften the leaf shadows on the wall: lift only mid-bright, near-neutral areas
    #    that are darker than their surroundings.
    yy, cb, cr = srgb_to_ycc(a)
    neutral = 1 - smoothstep(0.03, 0.07, np.abs(cb) + np.abs(cr))
    bright = smoothstep(0.55, 0.70, yy)
    env = blur(yy, 60)
    lift = np.clip(env - yy, 0, None) * SHADOW_SOFTEN * 3
    wallm = blur(neutral * bright, 4)
    yy = np.clip(yy + lift * wallm, 0, 1)
    # Bring the wall's brightness toward the bride's grey.
    yy = yy + WALL_PULL * wallm * smoothstep(0.70, 0.80, yy) * (WALL_Y - yy).clip(None, 0)

    # 5. Mild local contrast for depth.
    local = blur(yy, 40)
    yy = np.clip(yy + 0.10 * (yy - local), 0, 1)
    a = np.clip(ycc_to_srgb(yy, cb, cr), 0, 1)

    out = Image.fromarray((a * 255 + 0.5).astype(np.uint8))

    # 6. Sharpen luminance only (no colour fringes).
    r, amount, thr = SHARP
    yc, cbc, crc = out.convert("YCbCr").split()
    yc = yc.filter(ImageFilter.UnsharpMask(radius=r, percent=int(amount * 100), threshold=thr))
    out = Image.merge("YCbCr", (yc, cbc, crc)).convert("RGB")

    out.save(DEST, "JPEG", quality=95, subsampling=0)
    print(f"{DEST.relative_to(ROOT)}  {out.width}x{out.height}  {DEST.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
