"""Cut the two flower corners of assets-src/invitation.png (peony, hydrangea,
baby's breath and loose petals) into transparent sprites for the letter card
(index.html #thu-moi, css "letter"):

  public/assets/invite/bouquet-tl-{360,720}.webp   top-left spray
  public/assets/invite/bouquet-br-{360,720}.webp   bottom-right spray
  public/assets/invite/petal-{a,b}.webp            two loose petals

The flowers lie on cream paper, so this is a difference matte:
1. the pink frame lines are painted over with the paper tone;
2. the paper tone is estimated locally (normalised blur of paper-like pixels);
3. alpha grows with the distance from that tone, and colours are un-blended
   from it; enclosed pale spots inside the peonies are filled back in;
4. over the black background alpha comes from luminance instead, and the
   card's anti-aliased edge only survives where a flower crosses it.

Needs numpy, Pillow, opencv-python-headless (use a throwaway venv):
  python scripts/cut-letter-flowers.py
"""

from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets-src/invitation.png"
OUT = ROOT / "public/assets/invite"

# (x0, y0, x1, y1) in source pixels
CROPS = {
    "bouquet-tl": (84, 196, 516, 606),
    "bouquet-br": (498, 868, 934, 1346),
    "petal-a": (512, 390, 582, 456),
    "petal-b": (176, 598, 250, 662),
}
WIDTHS = {"bouquet-tl": (360, 720), "bouquet-br": (360, 720)}

FRAME_ROWS = [(274, 286), (1276, 1288)]  # both hairlines + the light strip between, inclusive
FRAME_COLS = [(142, 153), (867, 880)]
SEAL = ((514, 887), 104)


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def build(rgb):
    """Full-image RGBA cut-out (flowers only)."""
    c = rgb.astype(np.float32)
    h, w, _ = c.shape
    mx = c.max(-1)

    # --- card vs black background -----------------------------------------
    dark = (mx < 40).astype(np.uint8)
    _, lab = cv2.connectedComponents(dark, connectivity=4)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    outside = np.isin(lab, list(border))
    card = cv2.erode((~outside).astype(np.uint8), np.ones((9, 9), np.uint8)).astype(bool)
    rim = ~outside & ~card

    def paperlike(img):
        r, g, b = img[..., 0], img[..., 1], img[..., 2]
        m = img.max(-1)
        return (m > 222) & (m < 252) & ((r - g) < 17) & ((r - b) < 24) & ((g - b) > -6)

    # --- scrub the frame lines --------------------------------------------
    pl = paperlike(c) & card
    for y0, y1 in FRAME_ROWS:
        ref = (c[y0 - 4] + c[y1 + 4]) / 2
        p0, p1 = pl[y0 - 4], pl[y1 + 4]
        for y in range(y0 - 1, y1 + 2):
            row = c[y]
            pink = np.abs(row - ref).max(-1) < 40
            sel = ((p0 & p1) | ((p0 | p1) & pink)) & card[y]
            row[sel] = ref[sel]
    for x0, x1 in FRAME_COLS:
        ref = (c[:, x0 - 4] + c[:, x1 + 4]) / 2
        p0, p1 = pl[:, x0 - 4], pl[:, x1 + 4]
        for x in range(x0 - 1, x1 + 2):
            col = c[:, x]
            pink = np.abs(col - ref).max(-1) < 40
            sel = ((p0 & p1) | ((p0 | p1) & pink)) & card[:, x]
            col[sel] = ref[sel]

    # --- local paper tone --------------------------------------------------
    pl = (paperlike(c) & card).astype(np.float32)
    pl = cv2.erode(pl, np.ones((5, 5), np.uint8))
    num = cv2.GaussianBlur(c * pl[..., None], (0, 0), 18)
    den = cv2.GaussianBlur(pl, (0, 0), 18)[..., None]
    paper = num / np.maximum(den, 1e-4)
    paper = np.where(den > 0.02, paper, np.array([239, 229, 225], np.float32))

    diff = c - paper
    d = np.maximum(np.abs(diff).max(-1), 1.4 * np.abs((diff[..., 0] - diff[..., 2])))
    a_in = smoothstep(6, 24, d)

    # fill enclosed pale spots (peony highlights read as paper)
    core = (a_in > 0.5).astype(np.uint8)
    core = cv2.morphologyEx(core, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    inv = (1 - core).astype(np.uint8)
    n, lab2, stats, _ = cv2.connectedComponentsWithStats(inv, connectivity=4)
    small = np.zeros(n, bool)
    small[1:] = stats[1:, cv2.CC_STAT_AREA] < 2600
    holes = small[lab2] & card
    a_in = np.maximum(a_in, holes.astype(np.float32))

    # over black: luminance key
    a_out = np.clip((mx - 38) / 150, 0, 1)
    alpha = np.where(outside, a_out, a_in)
    # card rim: only where a flower crosses the edge
    near_out = cv2.dilate(np.where(outside, a_out, 0).astype(np.float32), np.ones((5, 5), np.uint8))
    alpha = np.where(rim, np.minimum(near_out, 1.0), alpha)

    # drop the wax seal
    yy, xx = np.mgrid[0:h, 0:w]
    (sx, sy), sr = SEAL
    alpha[(xx - sx) ** 2 + (yy - sy) ** 2 <= sr * sr] = 0

    # specks
    keep_m = (alpha > 0.35).astype(np.uint8)
    n, lab3, stats, _ = cv2.connectedComponentsWithStats(keep_m, connectivity=8)
    big = np.zeros(n, bool)
    big[1:] = stats[1:, cv2.CC_STAT_AREA] >= 25
    keep = cv2.dilate(big[lab3].astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool)
    alpha = np.where(keep, alpha, 0)

    # un-blend colours from their background (paper inside, black outside)
    bg = np.where(outside[..., None], 0, paper)
    a3 = np.maximum(alpha, 0.05)[..., None]
    col = np.clip((c - (1 - a3) * bg) / a3, 0, 255)
    col = np.where(alpha[..., None] > 0.97, c, col)
    return np.dstack([col.astype(np.uint8), (alpha * 255).astype(np.uint8)])


def main():
    rgba = build(np.asarray(Image.open(SRC).convert("RGB")))
    for name, (x0, y0, x1, y1) in CROPS.items():
        img = Image.fromarray(rgba[y0:y1, x0:x1], "RGBA")
        if name.startswith("petal"):
            # keep the petal only (largest blob)
            a = np.asarray(img)[..., 3]
            n, lab, stats, _ = cv2.connectedComponentsWithStats((a > 20).astype(np.uint8), connectivity=8)
            i = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
            m = cv2.dilate((lab == i).astype(np.uint8), np.ones((3, 3), np.uint8))
            arr = np.asarray(img).copy()
            arr[..., 3] = arr[..., 3] * m
            img = Image.fromarray(arr, "RGBA")
        img = img.crop(img.getbbox())
        widths = WIDTHS.get(name)
        if widths:
            for w in widths:
                h = round(img.height * w / img.width)
                img.resize((w, h), Image.LANCZOS).save(OUT / f"{name}-{w}.webp", quality=88, method=6)
        else:
            img.save(OUT / f"{name}.webp", quality=88, method=6)
        print(f"{name}: {img.width}x{img.height} (w/h {img.width / img.height:.4f})")


if __name__ == "__main__":
    main()
