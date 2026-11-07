/* Glass header.
   Hidden while the hero is on screen; slides in once the album reaches the top.
   The toggle opens a table of contents that also marks the section being read. */

export function initNav() {
  const nav = document.getElementById("nav");
  const toggle = document.getElementById("nav-toggle");
  const menu = document.getElementById("nav-menu");
  const hero = document.getElementById("loi-ngo");
  const links = [...menu.querySelectorAll("a")];

  const setOpen = (open) => {
    nav.toggleAttribute("data-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Đóng mục lục" : "Mở mục lục");
  };

  const setShown = (shown) => {
    nav.classList.toggle("is-shown", shown);
    nav.inert = !shown; // out of the tab order and the accessibility tree while hidden
    if (!shown) setOpen(false);
  };
  setShown(false);

  // Hero gone above the bar's height = album is at the top.
  new IntersectionObserver(
    ([e]) => setShown(!e.isIntersecting && e.boundingClientRect.top < 0),
    { rootMargin: "-80px 0px 0px 0px" },
  ).observe(hero);

  toggle.addEventListener("click", () => setOpen(!nav.hasAttribute("data-open")));
  menu.addEventListener("click", (e) => {
    if (e.target.closest("a")) setOpen(false);
  });
  document.addEventListener("click", (e) => {
    if (nav.hasAttribute("data-open") && !nav.contains(e.target)) setOpen(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav.hasAttribute("data-open")) {
      setOpen(false);
      toggle.focus();
    }
  });

  // Scroll spy: the section crossing a band near the upper middle of the screen.
  // Nested targets (gift box inside events) come later in the list, so the last match wins.
  const targets = links.map((a) => document.getElementById(a.hash.slice(1)));
  const inBand = new Set();
  const spy = new IntersectionObserver(
    (entries) => {
      for (const e of entries) e.isIntersecting ? inBand.add(e.target) : inBand.delete(e.target);
      const current = targets.filter((t) => inBand.has(t)).at(-1);
      if (!current) return; // between targets (countdown, photo card): keep the last one
      links.forEach((a, i) => {
        if (targets[i] === current) a.setAttribute("aria-current", "location");
        else a.removeAttribute("aria-current");
      });
    },
    { rootMargin: "-35% 0px -60% 0px" },
  );
  targets.forEach((t) => t && spy.observe(t));
}
