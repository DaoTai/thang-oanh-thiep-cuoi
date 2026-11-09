"""Cut assets-src/invitation.png (envelope on black) into the layers of the
guest cover (index.html #cover, css "guest cover"):

  public/assets/invite/envelope-{640,1080}.webp  envelope, black -> transparent,
                                                 wax seal painted out
  public/assets/invite/seal-{200,320}.webp       wax seal alone, transparent

The flap is not a separate file: CSS clips it out of the envelope with a
polygon. FLAP / SEAL below are in source pixels; the script prints them as
percentages of the cropped envelope for the CSS custom properties.

Needs numpy, Pillow, opencv-python-headless (use a throwaway venv):
  python scripts/cut-invitation.py
"""

from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets-src/invitation.png"
OUT = ROOT / "public/assets/invite"

SEAL_C = (514, 887)  # wax seal centre
SEAL_R = 92  # radius incl. its soft contact shadow
FLAP = [(124, 652), (127, 639), (134, 631), (146, 628), (877, 628), (889, 631), (896, 638), (898, 648), (510, 908)]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    rgb = np.asarray(Image.open(SRC).convert("RGB"))
    h, w, _ = rgb.shape
    mx = rgb.max(-1)

    # --- background: black connected to the border -> transparent ---------
    dark = (mx < 40).astype(np.uint8)
    n, lab = cv2.connectedComponents(dark, connectivity=4)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(border))
    fg = ~bg
    # Feathered edge: within 3px of the background, un-blend from black.
    dist = cv2.distanceTransform(fg.astype(np.uint8), cv2.DIST_L2, 3)
    alpha = np.where(fg, 1.0, 0.0)
    edge = fg & (dist <= 3)
    alpha[edge] = np.clip(mx[edge] / 225.0, 0, 1)
    color = rgb.astype(np.float32)
    a3 = np.maximum(alpha, 1e-3)[..., None]
    color = np.where(edge[..., None], np.clip(color / a3, 0, 255), color)

    # --- seal cut-out ------------------------------------------------------
    yy, xx = np.mgrid[0:h, 0:w]
    disk = (xx - SEAL_C[0]) ** 2 + (yy - SEAL_C[1]) ** 2 <= SEAL_R**2
    r, g, b = (rgb[..., i].astype(int) for i in range(3))
    paper = np.array([238, 229, 226])
    off_paper = np.abs(rgb.astype(int) - paper).sum(-1) > 48
    seal = disk & off_paper & ((r - g) > 25)
    seal = cv2.morphologyEx(seal.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    # fill holes (the gold hearts) by flooding the outside
    ff = seal.copy() * 255
    cv2.floodFill(ff, None, (0, 0), 128)
    seal = (ff != 128).astype(np.uint8)
    seal_a = cv2.GaussianBlur(seal.astype(np.float32), (0, 0), 0.9)

    x0, x1 = SEAL_C[0] - SEAL_R, SEAL_C[0] + SEAL_R
    y0, y1 = SEAL_C[1] - SEAL_R, SEAL_C[1] + SEAL_R
    seal_img = np.dstack([rgb[y0:y1, x0:x1], (seal_a[y0:y1, x0:x1] * 255).astype(np.uint8)])
    seal_pil = Image.fromarray(seal_img, "RGBA")
    for size in (200, 320):
        seal_pil.resize((size, size), Image.LANCZOS).save(OUT / f"seal-{size}.webp", quality=90, method=6)

    # --- paint the seal out of the envelope -------------------------------
    # The paper is nearly flat, so fill the hole with the median paper tone of
    # its surroundings, separately for the flap and for the body below it,
    # add grain, then redraw the flap's edge (crease + soft drop shadow).
    big = (xx - SEAL_C[0]) ** 2 + (yy - SEAL_C[1]) ** 2 <= (SEAL_R + 22) ** 2
    hole = (cv2.dilate(seal, np.ones((31, 31), np.uint8)) | big).astype(np.uint8)
    flap_m = np.zeros((h, w), np.uint8)
    cv2.fillPoly(flap_m, [np.array(FLAP, np.int32)], 1)
    # Smooth tone from the surroundings (normalised convolution per region).
    fill = np.empty_like(color)
    for region in (flap_m, 1 - flap_m):
        known = ((1 - hole) & region).astype(np.float32)
        est = None
        for sigma in (80, 22):  # wide pass first; the tight pass wins where it has data
            num = cv2.GaussianBlur(color * known[..., None], (0, 0), sigma)
            den = cv2.GaussianBlur(known, (0, 0), sigma)[..., None]
            cur = num / np.maximum(den, 1e-6)
            if est is None:
                est = cur
            else:
                wgt = np.clip(den / 0.08, 0, 1)
                est = cur * wgt + est * (1 - wgt)
        fill[region > 0] = est[region > 0]
    # Real paper grain: high-pass of a clean body patch, tiled.
    patch = color[960:1160, 200:400]
    grain = patch - cv2.GaussianBlur(patch, (0, 0), 6)
    reps = (h // 200 + 1, w // 200 + 1, 1)
    fill += np.tile(grain, reps)[:h, :w]
    # Body paper darkens slightly toward the flap edge (shadow under the flap).
    edge_d = cv2.distanceTransform((1 - flap_m).astype(np.uint8), cv2.DIST_L2, 3)
    shadow = np.exp(-edge_d / 5.0) * (1 - flap_m) * 0.07
    fill *= (1 - shadow)[..., None]
    crease = np.zeros((h, w), np.uint8)
    pts = np.array(FLAP, np.int32)
    cv2.polylines(crease, [pts[[0, -1, -2]]], False, 255, 1, cv2.LINE_AA)
    crease = crease.astype(np.float32) / 255
    fill = fill * (1 - crease[..., None] * 0.18)
    # Feather the patch inward so its edge never shows.
    din = cv2.distanceTransform(hole, cv2.DIST_L2, 3)
    k = np.clip(din / 18.0, 0, 1)[..., None]
    clean = color * (1 - k) + fill * k

    env = np.dstack([np.clip(clean, 0, 255).astype(np.uint8), (alpha * 255).astype(np.uint8)])

    # crop to the content
    ys, xs = np.nonzero(fg)
    pad = 6
    cx0, cx1 = max(xs.min() - pad, 0), min(xs.max() + pad + 1, w)
    cy0, cy1 = max(ys.min() - pad, 0), min(ys.max() + pad + 1, h)
    env = env[cy0:cy1, cx0:cx1]
    env_pil = Image.fromarray(env, "RGBA")
    cw, ch = env_pil.size
    for width in (640, 1080):
        tw = min(width, cw)
        env_pil.resize((tw, round(ch * tw / cw)), Image.LANCZOS).save(
            OUT / f"envelope-{width}.webp", quality=88, method=6, exact=False
        )

    pct = lambda x, y: f"{(x - cx0) / cw * 100:.2f}% {(y - cy0) / ch * 100:.2f}%"
    print(f"envelope {cw}x{ch} (aspect {cw}/{ch})")
    print("flap polygon:", ", ".join(pct(x, y) for x, y in FLAP))
    print("flap hinge y:", f"{(628 - cy0) / ch * 100:.2f}%")
    print("seal centre:", pct(*SEAL_C), " seal size (% of width):", f"{SEAL_R * 2 / cw * 100:.2f}%")


if __name__ == "__main__":
    main()
