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
  - `favicon`: `favicon.png`, `apple-touch-icon.png` and the header logo `assets/logo.webp` (132px), all from `assets-src/logo.png` (the engraved rings, 1.4 MB original, outside `public/` so never deployed).

There are no tests or linters. Verify changes in a browser at phone width (390px) and desktop width.

## Layout

`public/` is the web root and deploys as-is to Cloudflare Workers static assets. The config lives in three files:

- `wrangler.jsonc`: Worker name and assets directory.
- `public/_headers`: cache headers and the `text/calendar` content type for `.ics`. Edit it when adding asset folders.
- `public/.assetsignore`: keeps the album originals and `album/thumbs/` out of the upload. Anything new in `public/` that the page doesn't use belongs here.

- `index.html`: all content, static (good for LCP and link previews). Section order: glass header (`.nav`, outside `<main>`), topbar, hero (Lời ngỏ), album (6 featured + full gallery), month calendar, countdown, photo card, invitation letter, couple, events + gift box, guestbook, thanks.
- `js/config.js`: **single source of truth** for names, event dates/times/venues, main event and guestbook endpoint. Event times are placeholders. `index.html` repeats dates and venues in visible copy, so keep both in sync.
- `js/main.js`: entry point. It handles blur-up placeholders, scroll reveal (IntersectionObserver on `[data-reveal]`), `[data-action]` routing (`wish` / `rsvp` / `gift` / `gallery`), the dock, copy-to-clipboard and background music.
- `js/nav.js`: fixed glass header (logo, names, menu toggle). Hidden while the hero is on screen, slides in once the hero has scrolled past (album at the top); hidden state is `inert`. The menu lists section anchors (`#loi-ngo`, `#album`, `#lich`, `#thu-moi`, `#couple`, `#events`, `#gift-box`, `#guestbook`) and marks the current one with `aria-current` (scroll spy). Adding a section to the menu means adding its `id` and a `<li>` in `#nav-menu`.
- `js/calendar.js`: month grid, countdown (ticks only while visible) and Google/Outlook/Apple calendar links.
- `js/gallery.js`: full-screen gallery dialog (editorial grid, every 7th photo a 2x2 feature) + dark lightbox (arrows, swipe with drag-follow, thumbnail strip, slideshow, fullscreen).
- `js/guestbook.js`: wishes form and list. Uses `CONFIG.wishesEndpoint` (Google Apps Script, see `scripts/wishes-apps-script.gs`) when set, otherwise `localStorage` only (each guest sees only their own wishes).
- `js/ui.js`: `<dialog>` open/close with animation, toast.
- `js/snow.js`: full-screen falling snow on one fixed `<canvas class="snow">` (z-index 30, `pointer-events: none`), started after `load`. One pre-rendered sprite (white flake + soft rose glow so it reads on the paper). Flake count scales with viewport area. Skipped under `prefers-reduced-motion`, stops while the tab is hidden. Tune size/speed/count in `spawn()` and `targetCount()`.

## Conventions

- Design tokens live at the top of `css/styles.css`. Theme is light only. There is one accent (dusty rose `--accent`), and `--gold` is used only for ornament hairlines. Radius rules: buttons pill, cards 20px, photos 16px, portrait frames arch-top, inputs 12px.
- Fonts: Great Vibes (script names), Cormorant Garamond (display), Be Vietnam Pro (body). All have Vietnamese subsets; keep it that way when changing fonts.
- Real `backdrop-filter` only via `.glass--blur` (elements over photos) and the floating buttons. Plain `.glass` is a translucent fill, for scroll performance.
- Motion: `prefers-reduced-motion` disables reveal, zoom and loops. Animate only transform and opacity.
- No em dashes in visible copy.
- Gift box: the QR images (`assets/qr-example.jpg`) and the account numbers are placeholders. They come from the earlier site and the holder is not the couple. Replace them before sharing.
- When testing lazy loading in Playwright, use images not yet in the session's memory cache. Chromium loads cached `loading="lazy"` images immediately.

## Assets (`public/assets/`)

- `album/`: full-resolution originals (8–11 MB each), which are inputs for `npm run assets` only. `.assetsignore` keeps them out of the deploy, so referencing one from the page gives a 404 in production. Use `album/web/*`.
- `album/thumbs/`: older ~15 KB webp thumbs (naming: lowercase, spaces become hyphens). They are unused and not deployed.
- Album images keep the same filenames when regenerated, and `_headers` caches them for a week. To replace a photo that guests may already have cached, give it a new filename.
- `sound.mp3`: background music (`preload="none"`, starts on the first tap).
- `qr-example.jpg`: placeholder bank-transfer QR.

## Related folders (outside this repo)

- `../wedding-intivation/` (the misspelling is the real folder name): earlier vanilla version, a reference for content.
- `../references/`: design references (mockups, phoenix motif, `icon.png` used for the favicon).

## Project-local skills (`.claude/skills/`)

- `design-taste-frontend`: anti-template design guidance.
- `ui-ux-pro-max`: searchable design database (`python .claude/skills/ui-ux-pro-max/scripts/search.py`).

`.gitignore` ignores `.claude`, so these skills won't be committed unless that changes.
