# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Wedding invitation site for **Đỗ Mạnh Thắng & Lê Thị Kiều Oanh** (lễ ăn hỏi 28/11/2026, lễ thành hôn 29/11/2026). Layout is modeled on `https://weddingplan.online/thuanhiep`. It is a single mobile-first column (max-width 575px) over a decorative backdrop.

**Stack: plain HTML + CSS + vanilla JS (ES modules), no framework, no bundler, no client-side dependencies.** The owner chose this for performance; don't introduce React, Vite or runtime libraries. Node is used only for dev tooling, and the owner wants as few local dependencies as possible. Hosting is Cloudflare Workers (static assets), not Vercel.

Not a git repository yet.

## Commands

- `npm run dev`: `npx wrangler@4 dev`, which serves `public/` at http://localhost:5173 with Cloudflare's `_headers` and `.assetsignore` applied. There is no build step.
- `npm run deploy`: `npx wrangler@4 deploy` to Cloudflare Workers (static assets). See `DEPLOY.md`. Wrangler runs through npx and is deliberately not a devDependency.
- `npm run assets`: regenerate all derived assets. It is the only command that needs `npm install`. `node_modules` can be deleted afterwards. Run one step with `npm run assets -- <step>`:
  - `photos`: `public/assets/album/*.jpg` to `album/web/<slug>-{480,960,1600}.webp` (EXIF-rotated), plus `public/js/photos.js` (sizes and 16px blur placeholders). Also cuts the groom/bride portrait crops listed in `CROPS`.
  - `icons`: Phosphor SVGs (`@phosphor-icons/core`) to the sprite `public/assets/icons.svg`. Add icons to the `ICONS` list and reference them as `<svg class="ico"><use href="assets/icons.svg?v=2#i-name"/></svg>`. The sprite is cached for a week, so bump `?v=` in every reference (`index.html`, `js/calendar.js`) when adding symbols.
  - `fonts`: Fontsource woff2 (latin, latin-ext, vietnamese) to `public/assets/fonts` + `public/css/fonts.css`.
  - `calendar`: `public/assets/calendar/*.ics` from `CONFIG.events`. **Re-run after changing event dates or venues.**
  - `share`: `assets/og-cover.jpg` (1200×630 link preview).
  - `favicon`: `favicon.png`, `apple-touch-icon.png` (palette PNGs), both from `assets-src/logo.png` (the engraved rings, 1.4 MB original, outside `public/` so never deployed).
- `python scripts/enhance-countdown.py` (separate from `npm run assets`; needs numpy + Pillow, so use a throwaway venv): retouches `assets-src/countdown.jpg` (brighter skin, tone curve, luminance sharpening, crop around the rings) into `public/assets/countdown-{960,1600}.webp`, the `.countdown::before` background. Bump `?v=` in `css/styles.css` after re-running. Keep the original out of `assets/album/`, since the `photos` step would add it to the gallery.
- `python scripts/cut-letter-flowers.py` (same venv, plus `opencv-python-headless`): cuts the flower corners of `assets-src/invitation.png` into the letter-card sprites `public/assets/invite/bouquet-*.webp` and `petal-*.webp` (difference matte against the paper, frame lines scrubbed, wax seal excluded). The mattes keep soft paper shadows, so they read right only on a light paper background.
- `python scripts/enhance-groom.py` (same venv): crops and retouches `assets-src/groom.jpg` (brighter, rosier skin; the warm cream wall cooled and dimmed to the bride's grey) into `public/assets/album/thang-groom.jpg`. Then run `npm run assets -- photos` for `album/web/thang-groom-*.webp`; the `-groom` suffix keeps it out of the gallery.

There are no tests or linters. Verify changes in a browser at phone width (390px) and desktop width.

## Layout

`public/` is the web root and deploys as-is to Cloudflare Workers static assets. The config lives in three files:

- `wrangler.jsonc`: Worker name and assets directory.
- `public/_headers`: cache headers and the `text/calendar` content type for `.ics`. Edit it when adding asset folders.
- `public/.assetsignore`: keeps the album originals out of the upload. Anything new in `public/` that the page doesn't use belongs here.
- `robots.txt`, `sitemap.xml` and the `<head>` (`canonical`, `og:url`, absolute `og:image`, JSON-LD `WebSite` + two `Event`s) all hard-code the site URL `https://thang-oanh-wedding.happy-wedding.workers.dev/`. Change every copy together if the domain changes. The JSON-LD repeats event dates and venues from `CONFIG.events`, so keep it in sync too. Don't list `khach-moi-7q2x/` in `robots.txt` or mention it in public pages: that would reveal the unlisted path.

- `index.html`: all content, static (good for LCP and link previews). Section order: glass header (`.nav`, outside `<main>`), topbar, hero (Lời ngỏ), album (6 featured + full gallery), month calendar, countdown, photo card, invitation letter, couple, events + gift box, guestbook, thanks.
- `js/config.js`: **single source of truth** for names, event dates/times/venues, main event, gift accounts (`gifts`, `giftMemo`) and guestbook endpoint. Event times are placeholders. `index.html` repeats dates and venues in visible copy, so keep both in sync.
- `js/main.js`: entry point. It handles blur-up placeholders, scroll reveal (IntersectionObserver on `[data-reveal]`), `[data-action]` routing (`wish` / `rsvp` / `gift` / `gallery`), the dock, copy-to-clipboard and background music.
- `js/nav.js`: fixed glass header (logo, names, menu toggle). Hidden while the hero is on screen, slides in once the hero has scrolled past (album at the top); hidden state is `inert`. The menu lists section anchors (`#loi-ngo`, `#album`, `#lich`, `#thu-moi`, `#couple`, `#events`, `#gift-box`, `#guestbook`) and marks the current one with `aria-current` (scroll spy). Adding a section to the menu means adding its `id` and a `<li>` in `#nav-menu`.
- `js/calendar.js`: month grid, countdown (ticks only while visible) and Google/Outlook/Apple calendar links.
- `js/photo-cards.js`: the "Thiệp ảnh" carousel. Three stacked cards (front one large, neighbours peeking at the corners), each with its own message. Sets `data-pos` (-1/0/1) and `--dx` while dragging; swipe, tap a side card, arrows or dots. Loops.
- `js/letter.js`: the letter card (`#thu-moi`, "Đôi Lời Gửi Trao"). Types the `[data-type]` text out once on first view (each grapheme becomes a `.ch` span, so nothing reflows; tap to finish; the signature fades in after), and tilts the card toward a mouse pointer with a glass glare. Both skipped under `prefers-reduced-motion`; tilt is mouse-only. The card has a rose double hairline inside the edge, peony sprays over the top-left and bottom-right corners plus two loose petals, all `<img>` sprites from `assets/invite/` (`bouquet-{tl,br}-{360,720}.webp`, `petal-{a,b}.webp`). They bloom in after the reveal, sway gently, and lift (`translateZ`) while tilting.
- `js/gallery.js`: full-screen gallery dialog (editorial grid, every 7th photo a 2x2 feature) + dark lightbox (arrows, swipe with drag-follow, thumbnail strip, slideshow, fullscreen).
- `js/guestbook.js`: wishes form and list. Uses `CONFIG.wishesEndpoint` (Google Apps Script, see `scripts/wishes-apps-script.gs`) when set, otherwise `localStorage` only (each guest sees only their own wishes). `js/wishes-seed.js` (`SEED_WISHES`) is always merged in (newest first, duplicates dropped), so the list never starts empty. Cards show name, relative time ("2 ngày trước", full date in `title`) and a quote watermark.
- `js/gift.js`: gift box. The page shows only a sealed envelope (`#envelope`, CSS layers + 囍 seal), no QR or numbers. Tapping it opens the flap and lifts the card, then opens `#gift-dialog` (tabs Chú rể / Cô dâu, QR, grouped account number with copy chips, suggested memo, "Lưu mã QR" via the share sheet on phones, download on desktop). The sheet is rendered from `CONFIG.gifts`. The dock and hero gift buttons open the sheet directly.
- `js/ui.js`: `<dialog>` open/close with animation, toast (re-parented into an open dialog so it shows above the top layer), swipe-down-to-close for bottom sheets on phones (grab handle is `.modal-body::before`).
- `khach-moi-7q2x/`: unlisted tool page (not linked anywhere; `noindex` meta + `X-Robots-Tag` in `_headers`) that builds one link per guest: `<base>?to=<name>`. Names come from a textarea (one per line) or a CSV (header `Tên` + optional `Xưng hô`, `,`/`;`/tab, else the first column). Links always point at the home page of the same domain. Per guest: copy link, remove; bulk copy, CSV export. State is `localStorage` only. Self-contained (`guests.js`, `guests.css`), reuses `css/fonts.css` and the icon sprite. The invitation side: an inline script in `<head>` reads `?to=` and adds `.has-cover`; `js/cover.js` opens the sealed-envelope cover (`#cover`, layers in `assets/invite/`, loaded only for personal links).
- `js/music-fx.js`: shaded SVG hearts, musical notes, balloons, gift boxes and bunches of flowers (rose and white) rise from `#music-btn` while `#bg-music` plays: a burst when it starts, then a trickle. Animated with the Web Animations API. Skipped under `prefers-reduced-motion`, stops while the tab is hidden. Gradients are one hidden `<defs>` SVG appended to `body`.
- `js/snow.js`: full-screen falling snow on one fixed `<canvas class="snow">` (z-index 30, `pointer-events: none`), started after `load`. One pre-rendered sprite (white flake + soft rose glow so it reads on the paper). Flake count scales with viewport area. Skipped under `prefers-reduced-motion`, stops while the tab is hidden. Tune size/speed/count in `spawn()` and `targetCount()`.

## Conventions

- Design tokens live at the top of `css/styles.css`. Theme is light only. There is one accent (dusty rose `--accent`), and `--gold` is used only for ornament hairlines. Radius rules: buttons pill, cards 20px, photos 16px, couple portrait cards 20px (photo 14px inside a white mat), inputs 12px.
- Fonts: Great Vibes (script names), Playfair Display (`--font-heading`: section titles and every date/number, for its lining figures), Cormorant Garamond (`--font-display`: italic ledes and small accents), Nunito (body, rounded and soft). All have Vietnamese subsets; keep it that way when changing fonts.
- Real `backdrop-filter` only via `.glass--blur` (elements over photos) and the floating buttons. Plain `.glass` is a translucent fill, for scroll performance.
- Motion: `prefers-reduced-motion` disables reveal, zoom and loops. Animate only transform and opacity.
- Icon motion: sprite icons carry `data-motion="beat|twinkle|chat|gift|pop|shuffle|nudge-l|nudge-r|tick|pin|fly|sound|wiggle|turn|drop"`. `js/main.js` adds `.is-live` while the icon is on screen; the loops and the `--md` stagger live in the "icon motion" section near the end of `css/styles.css`. Hover lifts use the individual `scale`/`rotate`/`translate` properties so they compose with the looping `transform`. Give new icons a `data-motion` too.
- Section ornaments (`.orn`) are inline SVG, not sprite icons, so their parts can animate separately: camera (`snap`, album: shutter press, flash with bling stars, lens glint, then two hearts pop up, bounce and lean together), flower (`data-motion="bloom"`, gallery intro), interlocked rings (`rings`, couple + gallery end), clinking flutes (`clink`, guestbook), small 囍 (`stamp`, greet card), 囍 with neon lines (`.orn--hy`, events). Styles and keyframes are in the "wedding ornaments" section at the end of `css/styles.css`. Bump `?v=` on `styles.css` in `index.html` when markup depends on new CSS.
- No em dashes in visible copy.
- Gift box: `CONFIG.gifts` holds the couple's real accounts (groom Techcombank, bride TPBank) with QR images `assets/qr-groom.jpg` and `assets/qr-bride.jpg`. Keep the envelope discreet: no QR or account numbers in the page itself.
- When testing lazy loading in Playwright, use images not yet in the session's memory cache. Chromium loads cached `loading="lazy"` images immediately.

## Assets (`public/assets/`)

- `album/`: full-resolution originals (8–11 MB each), which are inputs for `npm run assets` only. `.assetsignore` keeps them out of the deploy, so referencing one from the page gives a 404 in production. Use `album/web/*`.
- `album/web/`: generated output. Slug = original filename lowercased, spaces become hyphens (`NMT_9160 ap.jpg` gives `nmt_9160-ap`). Delete the folder before `npm run assets -- photos` when photos are removed or re-edited, since the step skips outputs newer than their source.
- Album images keep the same filenames when regenerated, and `_headers` caches them for a week. To replace a photo that guests may already have cached, give it a new filename.
- `sound.mp3`: background music (`preload="none"`, starts on the first tap).
- `qr-groom.jpg`, `qr-bride.jpg`: bank-transfer QRs.

## Related folders (outside this repo)

- `../wedding-intivation/` (the misspelling is the real folder name): earlier vanilla version, a reference for content.
- `../references/`: design references (mockups, phoenix motif, `icon.png` used for the favicon).

## Project-local skills (`.claude/skills/`)

- `design-taste-frontend`: anti-template design guidance.
- `ui-ux-pro-max`: searchable design database (`python .claude/skills/ui-ux-pro-max/scripts/search.py`).

`.gitignore` ignores `.claude`, so these skills won't be committed unless that changes.
