// Personal link previews. Runs only for "/" (see run_worker_first in
// wrangler.jsonc); every other file is served straight from static assets.
//
// For ?to=<name> it rewrites <title>, description, og:* and twitter:* so the
// link preview in Zalo / Messenger / Facebook greets the guest by name. Those
// crawlers don't run JS, so this has to happen on the server.

const COUPLE = "Mạnh Thắng & Kiều Oanh";
const WHEN = "Chủ Nhật 29.11.2026";

// Same clean-up as the inline script in index.html.
function guestName(url) {
  return (url.searchParams.get("to") || "").replace(/\s+/g, " ").trim().slice(0, 60);
}

function setContent(value) {
  return { element: (el) => el.setAttribute("content", value) };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const guest = guestName(url);
    const res = await env.ASSETS.fetch(request);

    const type = res.headers.get("content-type") || "";
    if (!guest || res.status !== 200 || !type.includes("text/html")) return res;

    const title = `Kính mời ${guest} dự lễ cưới ${COUPLE}`;
    const desc = `Trân trọng kính mời ${guest} đến chung vui trong lễ thành hôn của ${COUPLE}, ${WHEN}. Rất mong được đón tiếp!`;

    // Facebook re-scrapes og:url and uses *that* page's tags, so it must be
    // the personal URL. canonical stays on the plain URL for search engines.
    const shareUrl = new URL(url.origin + url.pathname);
    shareUrl.searchParams.set("to", guest);

    const out = new HTMLRewriter()
      .on("title", { element: (el) => el.setInnerContent(title) })
      .on('meta[name="description"]', setContent(desc))
      .on('meta[property="og:title"]', setContent(title))
      .on('meta[property="og:description"]', setContent(desc))
      .on('meta[property="og:url"]', setContent(shareUrl.href))
      .on('meta[name="twitter:title"]', setContent(title))
      .on('meta[name="twitter:description"]', setContent(desc))
      .transform(res);

    const headers = new Headers(out.headers);
    // Keep guest names out of search results.
    headers.set("X-Robots-Tag", "noindex, nofollow");
    return new Response(out.body, { status: out.status, headers });
  },
};
