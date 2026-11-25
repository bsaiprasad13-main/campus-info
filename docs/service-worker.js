/* Campus Info offline support. After one visit the app opens, shows every topic and searches without internet.
   Pages and data: network first, past every cache (GitHub's CDN keeps files up to 10 minutes), so a publish
   shows up on the next load; the saved copy is used when offline or after 4 s on a slow connection.
   Documents: saved the first time someone opens them. The admin is never cached. */
const VERSION = "campus-info-6";
const OFFLINE = [
  "./",
  "index.html",
  "app.css",
  "app.js",
  "search.js",
  "markdown.js",
  "manifest.webmanifest",
  "icons/icon.svg",
  "icons/icon-192.png",
  "data/content.json",
  "data/search.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(OFFLINE.map((u) => new Request(u, { cache: "reload" })))));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k.startsWith("campus-info")).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const scope = new URL(self.registration.scope).pathname;
  const path = url.pathname.slice(scope.length);
  if (path.startsWith("admin")) return;
  if (path.startsWith("files/")) {
    event.respondWith(caches.open(VERSION).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok && res.status === 200) c.put(req, res.clone());
      return res;
    }));
    return;
  }
  event.respondWith(networkFirst(req, path));
});

async function networkFirst(req, path) {
  const cache = await caches.open(VERSION);
  // Saved under the plain address, so "content.json?v=123" and "content.json" share one offline copy.
  const key = path === "" ? "./" : new URL(req.url).pathname;
  const fresh = fetch(req, { cache: "no-store" }).then((res) => {
    if (res.ok && res.status === 200) cache.put(key, res.clone());
    return res;
  });
  const saved = await cache.match(key, { ignoreSearch: true });
  if (!saved) return fresh;
  const late = new Promise((resolve) => setTimeout(() => resolve(saved), 4000));
  try {
    return await Promise.race([fresh, late]);
  } catch (e) {
    return saved;
  }
}
