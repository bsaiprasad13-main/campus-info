/* Campus Info: the pages students see. Plain JavaScript, no build step.
   Routes:  #/ home · #/find/<words> · #/topics · #/topics/<area> · #/topic/<slug>[?q=<words>] · #/emergency · #/about */
(function () {
  "use strict";

  const CONFIG = {
    GA_ID: "G-2QR921947Y", // Google Analytics 4 measurement ID ("" keeps analytics off)
    FEEDBACK_URL: "https://docs.google.com/forms/d/e/1FAIpQLSe3UvvfHD-_dQ4gl2veI41cDzU9HYKkPWooc_kS1fsPoEjXXQ/viewform?usp=pp_url&entry.1442607143=Something+is+missing+(I+couldn%27t+find+it)&entry.785255351=TOPIC", // pre-filled form link; TOPIC is replaced
    ADMIN_PATH: "admin/",
  };

  const M = window.CampusMarkdown;
  const S = window.CampusSearch;
  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => [...(el || document).querySelectorAll(sel)];
  const esc = M.esc;
  const ICONS = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
    up: '<path d="M7 10v12"/><path d="M15 5.9 14 10h5.8a2 2 0 0 1 1.9 2.6l-2.3 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.8a2 2 0 0 0 1.8-1.1L12 2a3.1 3.1 0 0 1 3 3.9z"/>',
    share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="m16 6-4-4-4 4"/><path d="M12 2v13"/>',
    next: '<path d="m9 18 6-6-6-6"/>',
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
    install: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
    all: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    essentials: '<path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/>',
    academics: '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>',
    "campus-life": '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
    hostel: '<path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/>',
    scholarships: '<path d="M6 3h12M6 8h12M6 13l8.5 8M6 13h3a5 5 0 0 0 0-10"/>',
    clubs: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    "inter-iit": '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.7V17c0 .6-.5 1-1 1.2-1.2.5-2 2-2 3.8M14 14.7V17c0 .6.5 1 1 1.2 1.2.5 2 2 2 3.8M18 2H6v7a6 6 0 0 0 12 0z"/>',
  };
  const ic = (name, cls) => `<svg class="ic${cls ? " " + cls : ""}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ""}</svg>`;
  const params = new URLSearchParams(location.search);
  const PREVIEW = params.get("preview"); // "draft" from the admin, "practice" from Try the admin
  const PREVIEW_KEY = PREVIEW === "practice" ? "campus-info.practice.preview" : "campus-info.preview";
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
  };
  const INSTALLED = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  let DATA = null;
  let INDEX = null;
  let BY_SLUG = {};
  let CONTACTS = {};
  let searchTimer = null;
  let lastLogged = "";
  let installEvent = null;

  // ---------- start ----------
  async function boot() {
    try {
      DATA = await loadContent();
    } catch (e) {
      $("#main").innerHTML = `<p class="loading">Couldn't load Campus Info. Check your connection and try again.</p>`;
      return;
    }
    BY_SLUG = Object.fromEntries(DATA.topics.map((t) => [t.slug, t]));
    for (const t of DATA.topics) CONTACTS[t.slug] = M.contacts(t.posts.map((p) => p.md).join("\n\n"));
    INDEX = S.buildIndex(DATA, {});
    if (PREVIEW) previewBar();
    const fb = $("#nav-feedback");
    if (fb && CONFIG.FEEDBACK_URL) fb.href = feedbackLink("General");
    else if (fb) fb.remove();
    footer();
    stickyHeight();
    window.addEventListener("resize", stickyHeight);
    window.addEventListener("hashchange", route);
    route();
    whenIdle(loadSearchText);
    analytics();
    serviceWorker();
    installWatch();
    document.addEventListener("click", trackClicks);
  }

  async function loadContent() {
    if (PREVIEW) {
      const raw = store.get(PREVIEW_KEY);
      if (raw) return JSON.parse(raw).content;
    }
    const r = await fetch("data/content.json?v=" + Date.now(), { cache: "no-store" });
    if (!r.ok) throw new Error("content " + r.status);
    return r.json();
  }

  // Text inside files and linked pages only matters for search, so it loads after the first screen.
  async function loadSearchText() {
    let extra = null;
    if (PREVIEW) {
      const raw = store.get(PREVIEW_KEY);
      if (raw) extra = JSON.parse(raw).search || null;
    }
    if (!extra) {
      try {
        const r = await fetch("data/search.json?v=" + Date.now(), { cache: "no-store" });
        if (r.ok) extra = await r.json();
      } catch (e) { /* offline and not cached yet */ }
    }
    if (!extra) return;
    INDEX = S.buildIndex(DATA, extra);
    const q = currentQuery();
    if (q) showResults(q);
  }

  function whenIdle(fn) {
    if ("requestIdleCallback" in window) requestIdleCallback(fn, { timeout: 2500 });
    else setTimeout(fn, 600);
  }

  // The nav row (phones) or the whole top bar (wider screens) stays on screen; letter headings stick under it.
  function stickyHeight() {
    const wide = window.matchMedia("(min-width: 760px)").matches;
    const el = wide ? $(".masthead") : $(".nav");
    document.documentElement.style.setProperty("--stick", (el ? el.offsetHeight : 0) + "px");
  }
  const stickPx = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--stick")) || 0;

  // ---------- routing ----------
  function parseHash() {
    const raw = location.hash.replace(/^#\/?/, "");
    const cut = raw.indexOf("?");
    let path = cut < 0 ? raw : raw.slice(0, cut);
    try { path = decodeURIComponent(path); } catch (e) { /* a stray % in a typed address */ }
    const [kind, ...rest] = path.split("/");
    return { kind: kind || "home", arg: rest.join("/"), q: new URLSearchParams(cut < 0 ? "" : raw.slice(cut + 1)).get("q") || "" };
  }

  function currentQuery() {
    const { kind, arg } = parseHash();
    return kind === "find" ? arg : "";
  }

  function route() {
    const { kind, arg, q } = parseHash();
    if (kind === "topic" && BY_SLUG[arg]) return arg === DATA.emergency_topic ? emergencyPage(q) : topicPage(BY_SLUG[arg], q);
    if (kind === "emergency") return emergencyPage("");
    if (kind === "about") return aboutPage();
    if (kind === "topics" || kind === "group") return topicsPage(arg);
    if (kind === "find") return homePage(arg);
    return homePage("");
  }

  // section: which nav item this page belongs to.
  function setPage(html, title, section) {
    rail(null);
    $("#main").innerHTML = html;
    document.title = title ? `${title} · Campus Info` : "Campus Info · Everything a senior would tell you";
    for (const a of $$("[data-nav]")) {
      if (a.dataset.nav === section) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    }
    pageView();
  }

  // Where you are: ⌂ › Topics › Hostel › Mess coupons. Every step but the last is a link back up.
  function crumbs(parts) {
    const steps = parts.map((p, i) => i === parts.length - 1
      ? `<li aria-current="page"><span>${esc(p.label)}</span></li>`
      : `<li><a href="${esc(p.href)}">${esc(p.label)}</a></li>`);
    return `<nav class="crumbs" aria-label="You are here"><ol><li><a href="#/" class="home" aria-label="Home">${ic("home")}</a></li>${steps.join("")}</ol></nav>`;
  }

  // ---------- footer ----------
  function footer() {
    $("#foot").innerHTML = `
      <p class="made"><strong>Built and kept up to date by IITM students.</strong> Not an official institute website.</p>
      <p class="links"><a href="#/about">What is this?</a><a href="${esc(CONFIG.ADMIN_PATH)}">For seniors: edit</a></p>
      <p class="upd">Content updated ${esc(niceDate(DATA.updated))}. <span class="offline" id="offline"></span></p>`;
  }

  function telOf(n) {
    const d = String(n).replace(/\D/g, "");
    return d.length === 12 && d.startsWith("91") ? "+" + d : d.length === 10 ? "+91" + d : "+" + d;
  }

  function niceDate(iso) {
    const d = new Date(String(iso).slice(0, 10) + "T00:00:00");
    return isNaN(d) ? iso : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  function previewBar() {
    const bar = document.createElement("div");
    bar.className = "preview-bar";
    bar.innerHTML = PREVIEW === "practice"
      ? "<strong>Practice preview.</strong> Only you can see this. Nothing here reaches the real site."
      : "<strong>Preview.</strong> Students don't see these changes until a senior publishes them.";
    document.body.prepend(bar);
  }

  // ---------- home: what this is, install, search, New here? ----------
  function homePage(query) {
    setPage(`
      <section class="hello"${query ? " hidden" : ""}>
        <h1>A place for you to…</h1>
        <p class="lede">Find out <span class="hl">what you need to know</span>, <span class="hl">where you need to go</span>,
          <span class="hl">what you can explore</span> and <span class="hl">whom you can reach out to</span> at IIT Madras.</p>
      </section>
      ${installCard(query)}
      <form class="find" role="search" id="find">
        <label for="q" class="vh">Search Campus Info</label>
        ${ic("search", "lens")}
        <input id="q" type="search" placeholder="Try: mess change, cgpa, wifi" autocomplete="off"
          autocapitalize="off" spellcheck="false" enterkeyhint="search" value="${esc(query || "")}">
        <button type="button" class="clear" id="clear" aria-label="Clear search"${query ? "" : " hidden"}>${ic("x")}</button>
      </form>
      <div id="results" aria-live="polite"></div>
      <div id="browse"${query ? " hidden" : ""}>${newHere()}</div>`, query ? `“${query}”` : "", "home");
    const input = $("#q");
    input.addEventListener("input", () => onType(input.value));
    $("#find").addEventListener("submit", (e) => { e.preventDefault(); input.blur(); logSearch(input.value, true); });
    $("#clear").addEventListener("click", () => { location.hash = "#/"; setTimeout(() => $("#q") && $("#q").focus(), 0); });
    wireInstall();
    if (query) showResults(query);
    restoreScroll();
  }

  function newHere() {
    const list = (DATA.new_here || []).filter((s) => BY_SLUG[s]);
    return list.length ? `
      <section class="newhere">
        <h2>New here? Start with these</h2>
        <ol class="entries">${list.map((s) => entry(BY_SLUG[s], {})).join("")}</ol>
      </section>` : "";
  }

  // ---------- install: Android gets the real button; iPhones get the two steps ----------
  function installCard(query) {
    if (INSTALLED || PREVIEW || query || store.get("ci.install.hide")) return "";
    return `
      <section class="install" id="install">
        <span class="ins-ic">${ic("install")}</span>
        <p class="ins-txt"><strong>Install Campus Info</strong><span>Opens like an app and works offline.</span></p>
        <button type="button" class="ins-btn" id="ins-btn">Install</button>
        <button type="button" class="ins-x" id="ins-x" aria-label="Hide this">${ic("x")}</button>
        <p class="ins-steps" id="ins-steps" hidden></p>
      </section>`;
  }

  function wireInstall() {
    const card = $("#install");
    if (!card) return;
    $("#ins-x").onclick = () => { store.set("ci.install.hide", "1"); card.remove(); track("install_hide"); };
    $("#ins-btn").onclick = async () => {
      if (installEvent) {
        installEvent.prompt();
        const choice = await installEvent.userChoice;
        track("install", { outcome: choice.outcome });
        installEvent = null;
        if (choice.outcome === "accepted") card.remove();
        return;
      }
      const steps = $("#ins-steps");
      steps.innerHTML = IOS
        ? `On iPhone: tap ${ic("share")} <b>Share</b> at the bottom of Safari, then <b>Add to Home Screen</b>.`
        : `Open your browser's menu and choose <b>Install app</b> or <b>Add to Home screen</b>.`;
      steps.hidden = false;
      track("install_help", { ios: IOS ? "yes" : "no" });
    };
  }

  function installWatch() {
    window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvent = e; });
    window.addEventListener("appinstalled", () => { const c = $("#install"); if (c) c.remove(); });
  }

  // ---------- Topics: every topic A to Z, narrowed by area ----------
  function topicsPage(slug) {
    const g = slug && (DATA.groups || []).find((x) => x.slug === slug);
    const topics = g ? DATA.topics.filter((t) => t.group === g.slug) : DATA.topics;
    const pills = (DATA.groups || []).map((x) =>
      `<a href="#/topics/${esc(x.slug)}" data-g="${esc(x.slug)}"${g && x.slug === g.slug ? ' class="on" aria-current="page"' : ""}>${ic(x.slug)}${esc(x.title)}</a>`).join("");
    const letters = {};
    for (const t of topics) (letters[letterOf(t.title)] = letters[letterOf(t.title)] || []).push(t);
    const order = Object.keys(letters).sort((a, b) => (a === "#") - (b === "#") || a.localeCompare(b));
    setPage(`
      <section class="page">
        ${crumbs(g ? [{ label: "Topics", href: "#/topics" }, { label: g.title }] : [{ label: "Topics" }])}
        <h1>${g ? esc(g.title) : "All topics"}</h1>
        ${g && g.summary ? `<p class="lede">${esc(g.summary)}</p>` : ""}
        <nav class="groups" aria-label="Areas"><a href="#/topics" data-g="all"${g ? "" : ' class="on" aria-current="page"'}>${ic("all")}All</a>${pills}</nav>
        <div class="index">${order.map((L) => `
          <section class="sec" id="letter-${L}"><h2 class="letter">${L}</h2>
            <ul class="entries">${letters[L].map((t) => entry(t, { group: !g })).join("")}</ul></section>`).join("")}
        </div>
      </section>`, g ? g.title : "Topics", "topics");
    const on = $(".groups a.on");
    if (on) on.parentElement.scrollLeft = on.offsetLeft - 16; // the chosen area is always in view
    rail(order);
    restoreScroll();
  }

  function letterOf(title) {
    const c = title.normalize("NFKD").replace(/[^A-Za-z0-9]/g, "").charAt(0).toUpperCase();
    return /[A-Z]/.test(c) ? c : "#";
  }

  // One row in any list. With a search: the matched words marked, where in the topic they are, and the link
  // carries the words so the topic opens at that spot.
  function entry(t, opts) {
    const g = opts.group ? `<span class="g" data-g="${esc(t.group)}">${esc(groupTitle(t.group))}</span>` : "";
    const title = opts.matched ? S.highlight(t.title, opts.matched) : esc(t.title);
    let line = opts.matched ? S.highlight(t.summary, opts.matched) : esc(t.summary);
    if (opts.snippet) {
      const where = opts.snippet.from || sectionOf(t, opts.matched);
      line = (where ? `<span class="from">in ${esc(where)}:</span> ` : "") + S.highlight(opts.snippet.text.replace(/^[-*•]\s+/, ""), opts.matched);
    }
    const href = `#/topic/${encodeURIComponent(t.slug)}${opts.q ? "?q=" + encodeURIComponent(opts.q) : ""}`;
    return `<li><a href="${esc(href)}"><span class="t">${title}</span>${g}<span class="s">${line}</span></a>${opts.call || ""}</li>`;
  }

  // The heading of the part of a topic where the words turn up ("Rebates"), if there is one.
  function sectionOf(t, matched) {
    const want = new Set(matched || []);
    for (const p of t.posts) {
      let head = "";
      for (const line of String(p.md).split("\n")) {
        const h = line.match(/^#{1,6}\s+(.+)$/);
        if (h) head = h[1].replace(/[*_`]/g, "").trim();
        if (S.terms(line).some((w) => want.has(w))) return head && head !== t.title ? head : "";
      }
    }
    return "";
  }

  function groupTitle(slug) {
    const g = (DATA.groups || []).find((x) => x.slug === slug);
    return g ? g.title : "";
  }

  // ---------- the letters down the right edge ----------
  // While you scroll, the letter you're in lights up. Slide a thumb along them and a big letter follows it
  // while the list jumps, so the letters can stay small without being hard to hit.
  let spyFrame = 0;
  let bubbleTimer = 0;
  function onSpyScroll() { if (!spyFrame) spyFrame = requestAnimationFrame(spy); }
  function spy() {
    spyFrame = 0;
    const el = $("#rail");
    if (!el || el.hidden) return;
    // Shown only once the area pills have scrolled out from under it, and while the list is on screen.
    const top = el.getBoundingClientRect().top;
    const pills = $(".groups");
    const index = $(".index");
    el.classList.toggle("show", (!pills || pills.getBoundingClientRect().bottom < top) && !!index && index.getBoundingClientRect().bottom > top + 40);
    const line = stickPx() + 6;
    let cur = "";
    for (const s of $$(".index .sec")) {
      if (s.getBoundingClientRect().top <= line) cur = s.id.slice(7);
      else break;
    }
    if (!cur) { const first = $(".index .sec"); cur = first ? first.id.slice(7) : ""; }
    for (const b of el.children) b.classList.toggle("on", b.dataset.letter === cur);
  }

  function rail(order) {
    const el = $("#rail");
    window.removeEventListener("scroll", onSpyScroll);
    el.classList.remove("show");
    if (!order || order.length < 6) { el.hidden = true; el.innerHTML = ""; return; }
    el.innerHTML = order.map((L) => `<button type="button" tabindex="-1" data-letter="${L}">${L}</button>`).join("");
    el.hidden = false;
    window.addEventListener("scroll", onSpyScroll, { passive: true });
    spy();

    let held = false;
    let last = "";
    const jump = (b, y) => {
      if (!b) return;
      const L = b.dataset.letter;
      if (L !== last) {
        const sec = document.getElementById("letter-" + L);
        if (sec) window.scrollTo(0, sec.getBoundingClientRect().top + window.scrollY - stickPx());
        last = L;
      }
      bubble(L, y);
    };
    const under = (y) => {
      const r = el.getBoundingClientRect();
      const t = document.elementFromPoint(r.left + r.width / 2, Math.min(Math.max(y, r.top + 2), r.bottom - 2));
      return t && t.closest ? t.closest("#rail button[data-letter]") : null;
    };
    el.onpointerdown = (e) => {
      const b = e.target.closest("button[data-letter]");
      if (!b) return;
      e.preventDefault();
      held = true;
      last = "";
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
      jump(b, e.clientY);
    };
    el.onpointermove = (e) => { if (held) jump(under(e.clientY), e.clientY); };
    el.onpointerup = el.onpointercancel = () => {
      held = false;
      clearTimeout(bubbleTimer);
      bubbleTimer = setTimeout(() => { const b = $("#bubble"); if (b) b.hidden = true; }, 450);
    };
  }

  function bubble(L, y) {
    const b = $("#bubble");
    if (!b) return;
    clearTimeout(bubbleTimer);
    b.textContent = L;
    b.style.top = Math.max(stickPx() + 8, y - 30) + "px";
    b.hidden = false;
  }

  // ---------- search ----------
  function onType(value) {
    const q = value.trim();
    $("#clear").hidden = !q;
    const hide = !!q;
    for (const sel of [".hello", "#install", "#browse"]) { const el = $(sel); if (el) el.hidden = hide; }
    if (!q) {
      $("#results").innerHTML = "";
      history.replaceState(null, "", "#/");
      return;
    }
    history.replaceState(null, "", "#/find/" + encodeURIComponent(q));
    showResults(q);
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => logSearch(q, false), 1500);
  }

  function showResults(q) {
    const r = S.search(INDEX, q);
    const el = $("#results");
    if (!el) return;
    const browseEl = $("#browse");
    if (browseEl) browseEl.hidden = true;
    const area = areaFor(q);
    const areaRow = area ? `
      <a class="area-hit" href="#/topics/${esc(area.slug)}" data-g="${esc(area.slug)}">${ic(area.slug)}<span>Everything in <strong>${esc(area.title)}</strong></span>${ic("next", "go")}</a>` : "";
    const none = r.covered ? "" : `
      <div class="none">
        <p><mark>Nothing on this yet.</mark> Tell us what you were looking for and a senior will add it.</p>
        ${CONFIG.FEEDBACK_URL ? `<p><a class="ask" href="${esc(feedbackLink(q))}" target="_blank" rel="noopener" data-feedback="search">Ask for “${esc(q)}”</a></p>` : ""}
      </div>`;
    const row = (x, call) => entry(BY_SLUG[x.slug], { group: true, matched: x.matched, snippet: x.snippet, q, call });
    const results = r.results.length
      ? `${r.covered ? "" : `<p class="divider">Closest matches</p>`}<ul class="entries hits">${r.results.map((x, i) => row(x, i === 0 && r.covered ? callFor(x) : "")).join("")}</ul>` : "";
    const mentions = r.mentions.length
      ? `<p class="divider">Mentioned inside</p><ul class="entries hits deep">${r.mentions.map((x) => row(x, "")).join("")}</ul>` : "";
    el.innerHTML = areaRow + none + results + mentions;
    el.dataset.covered = r.covered ? "yes" : "no";
  }

  // Typing an area's name ("hostel", "scholarships") offers the whole area first.
  function areaFor(q) {
    const want = S.terms(q).filter((w) => !S.STOP.has(w));
    if (!want.length || want.length > 3) return null;
    return (DATA.groups || []).find((g) => {
      const have = new Set(S.terms(g.title + " " + g.slug.replace(/-/g, " ")));
      return want.every((w) => have.has(w));
    }) || null;
  }

  // If the best answer has a phone number, it's one tap away in the results ("ambulance" → Call Ambulance).
  function callFor(x) {
    const c = CONTACTS[x.slug];
    if (!c || !c.phones.length) return "";
    const want = new Set(x.matched);
    const named = (p) => p.label && !/^[\d\s+()/-]+$/.test(p.label);
    const p = c.phones.find((ph) => named(ph) && S.terms(ph.label).some((w) => want.has(w))) || c.phones[0];
    return `<a class="callrow" href="tel:${esc(p.tel)}" data-contact="call" data-topic="${esc(x.slug)}">${ic("phone")}<span>Call${named(p) ? " " + esc(p.label) : ""}</span><b>${esc(p.display)}</b></a>`;
  }

  function logSearch(q, submitted) {
    q = (q || "").trim();
    if (!q || q === lastLogged) return;
    lastLogged = q;
    const r = S.search(INDEX, q);
    track("search", { search_term: q.slice(0, 100), results: r.results.length + r.mentions.length, covered: r.covered ? "yes" : "no", submitted: submitted ? "yes" : "no" });
    if (!r.covered) track("search_nothing", { search_term: q.slice(0, 100) });
  }

  function feedbackLink(text) {
    return CONFIG.FEEDBACK_URL.replace("TOPIC", encodeURIComponent(String(text).slice(0, 200)));
  }

  // ---------- a topic ----------
  // One row per label ("Wellness Centre"), with all of its numbers and emails as buttons.
  function contactRows(slug, skip) {
    const c = CONTACTS[slug];
    const rows = [];
    const rowFor = (label) => {
      if (/^[\d\s+()/-]+$/.test(label)) label = ""; // a "label" that is only the number says nothing
      let r = rows.find((x) => x.label === label);
      if (!r) rows.push((r = { label, links: [] }));
      return r;
    };
    for (const p of c.phones) {
      if (skip && skip.has(p.tel)) continue;
      rowFor(p.label || "Phone").links.push(`<a href="tel:${esc(p.tel)}" class="num" data-contact="call" data-topic="${esc(slug)}">${ic("phone")}${esc(p.display)}</a>`);
    }
    for (const e of c.emails) rowFor(e.label || "Email").links.push(`<a href="mailto:${esc(e.email)}" class="mail" data-contact="mail" data-topic="${esc(slug)}">${ic("mail")}${esc(e.email)}</a>`);
    return rows;
  }

  const rowsHtml = (rows) => rows.map((r) => r.label
    ? `<li><span class="who">${esc(r.label)}</span><span class="how">${r.links.join("")}</span></li>`
    : `<li class="solo"><span class="how">${r.links.join("")}</span></li>`).join("");

  function topicPage(t, q) {
    const posts = t.posts.map((p) => `
      <section class="post">${M.render(p.md)}${files(p.files)}</section>`).join("");
    const rows = contactRows(t.slug);
    // A short list goes right under the title; a long one (then it is the topic itself) stays at the end.
    const onTop = rows.length && rows.length <= 5;
    const contacts = rows.length ? `
      <section class="contacts${onTop ? " ontop" : ""}" id="whom">
        <h2>Whom to ask</h2>
        <ul>${rowsHtml(rows)}</ul>
      </section>` : "";
    const more = related(t).map((x) => entry(x, {})).join("");
    setPage(`
      <article class="topic">
        ${crumbs([{ label: "Topics", href: "#/topics" }, { label: groupTitle(t.group), href: "#/topics/" + t.group }, { label: t.title }])}
        <h1>${esc(t.title)}</h1>
        <p class="lede">${esc(t.summary)}</p>
        ${onTop ? contacts : rows.length ? `<p class="jump"><a href="#whom" id="jump">${ic("phone")}Whom to ask: ${rows.length} contacts, at the end</a></p>` : ""}
        <div class="posts">${posts}</div>
        ${onTop ? "" : contacts}
        <section class="useful" id="useful">
          <p>Was this useful?</p>
          <p class="btns"><button type="button" data-useful="yes">${ic("up")}Yes</button><button type="button" data-useful="no">${ic("up", "flip")}Not really</button></p>
        </section>
        ${more ? `<section class="more"><h2>Also in ${esc(groupTitle(t.group))}</h2><ul class="entries">${more}</ul></section>` : ""}
        <p class="share"><button type="button" id="share">${ic("share")}Share this page</button></p>
      </article>`, t.title, "topics");
    track("view_topic", { topic: t.slug });
    const jump = $("#jump");
    if (jump) jump.addEventListener("click", (e) => { e.preventDefault(); $("#whom").scrollIntoView({ behavior: "smooth" }); });
    $("#useful").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-useful]");
      if (!b) return;
      track("helpful", { topic: t.slug, answer: b.dataset.useful });
      const ask = b.dataset.useful === "no" && CONFIG.FEEDBACK_URL
        ? ` <a href="${esc(feedbackLink(t.title))}" target="_blank" rel="noopener" data-feedback="topic">Tell us what was missing</a>` : "";
      $("#useful").innerHTML = `<p>Thanks.${ask}</p>`;
    });
    $("#share").addEventListener("click", async () => {
      const url = location.origin + location.pathname + "#/topic/" + t.slug;
      track("share", { topic: t.slug });
      if (navigator.share) {
        try { await navigator.share({ title: t.title + " · Campus Info", url }); } catch (e) { /* closed */ }
      } else {
        try { await navigator.clipboard.writeText(url); $("#share").lastChild.textContent = "Link copied"; } catch (e) { prompt("Copy this link", url); }
      }
    });
    landOn(q, t);
  }

  // Opened from a search: mark the words in the topic and scroll to the first place they appear.
  function landOn(q, t) {
    if (!q) { window.scrollTo(0, 0); return; }
    const r = S.search(INDEX, q, { limit: 80, mentions: 80 });
    const x = r.results.concat(r.mentions).find((y) => y.slug === t.slug);
    const want = new Set(x ? x.matched : r.words);
    let first = null;
    let upTop = false;
    for (const root of $$(".topic h1, .topic > .lede, .posts, .contacts")) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      for (const n of nodes) {
        if (n.parentElement.closest("mark, svg")) continue;
        const parts = n.nodeValue.split(/([A-Za-z0-9À-ɏ][A-Za-z0-9À-ɏ'’.-]*)/);
        if (parts.length < 2) continue;
        let hit = false;
        const frag = document.createDocumentFragment();
        parts.forEach((part, i) => {
          if (i % 2 && S.words(part).map(S.stem).some((w) => want.has(w))) {
            const m = document.createElement("mark");
            m.className = "hit";
            m.textContent = part;
            frag.appendChild(m);
            if (!first) { first = m; upTop = !root.matches(".posts, .contacts"); }
            hit = true;
          } else if (part) {
            frag.appendChild(document.createTextNode(part));
          }
        });
        if (hit) n.parentNode.replaceChild(frag, n);
      }
    }
    // Only inside an attached document: point at that document.
    if (!first && x && x.snippet && x.snippet.from) {
      const doc = $$(".docs a[data-file]").find((a) => a.dataset.file === x.snippet.from);
      if (doc) { doc.closest("li").classList.add("hit-doc"); first = doc; }
    }
    if (!first || upTop) { window.scrollTo(0, 0); return; }
    requestAnimationFrame(() => first.scrollIntoView({ block: "center" }));
  }

  function files(ids) {
    if (!ids || !ids.length) return "";
    return `<ul class="docs">${ids.map((id) => {
      const f = DATA.files[id];
      if (!f) return "";
      const href = f.url || f.path;
      const kind = (f.name.split(".").pop() || "").toUpperCase();
      return `<li><a href="${esc(href)}" target="_blank" rel="noopener" data-file="${esc(f.name)}"${f.practice ? ` data-practice="${esc(id)}"` : ""}>${esc(f.name.replace(/_/g, " "))}</a>
        <span class="meta">${esc(kind)} · ${size(f.size)}</span></li>`;
    }).join("")}</ul>`;
  }

  function size(n) {
    if (!n) return "";
    return n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
  }

  function related(t) {
    const out = [];
    for (const s of t.related || []) if (BY_SLUG[s] && !out.includes(BY_SLUG[s])) out.push(BY_SLUG[s]);
    for (const x of DATA.topics) {
      if (out.length >= 3) break;
      if (x.group === t.group && x.slug !== t.slug && !out.includes(x)) out.push(x);
    }
    return out.slice(0, 3);
  }

  // ---------- emergency: big Call buttons first, then every number, then where to read more ----------
  function emergencyPage(q) {
    const t = DATA.emergency_topic && BY_SLUG[DATA.emergency_topic];
    const first = (DATA.emergency || []).map((e) => `
      <li><a class="sos-call" href="tel:${esc(telOf(e.number))}" data-contact="call" data-topic="emergency">
        <span class="sos-ic">${ic("phone")}</span><span class="sos-l">${esc(e.label)}</span><span class="sos-n">${esc(e.number)}</span></a></li>`).join("");
    const posts = t ? t.posts.map((p) => `<section class="post">${M.render(p.md)}${files(p.files)}</section>`).join("") : "";
    const helpful = ["hospital", "counselling", "hostel-security-desks", "posh-ccash"].concat(t ? t.related || [] : [])
      .filter((s, i, all) => BY_SLUG[s] && s !== (t && t.slug) && all.indexOf(s) === i).slice(0, 4);
    setPage(`
      <article class="topic emergency">
        ${crumbs([{ label: "Emergency" }])}
        <h1>Emergency</h1>
        <p class="lede">Tap a number to call.</p>
        ${first ? `<ul class="sos-list">${first}</ul>` : ""}
        ${posts ? `<section class="all-numbers"><h2>All emergency numbers</h2><div class="posts">${posts}</div></section>` : ""}
        ${helpful.length ? `<section class="more"><h2>Also useful</h2><ul class="entries">${helpful.map((s) => entry(BY_SLUG[s], {})).join("")}</ul></section>` : ""}
      </article>`, "Emergency", "emergency");
    track("view_topic", { topic: "emergency" });
    if (t) landOn(q, t);
    else window.scrollTo(0, 0);
  }

  // ---------- what is this ----------
  function aboutPage() {
    const tell = CONFIG.FEEDBACK_URL
      ? `<a href="${esc(feedbackLink("General"))}" target="_blank" rel="noopener" data-feedback="about"><strong>Tell us.</strong></a>` : "<strong>Tell a senior.</strong>";
    setPage(`
      <article class="topic about">
        ${crumbs([{ label: "What is this?" }])}
        <h1>What is this?</h1>
        <div class="readme">
          <p>Campus Info answers the questions every IITM student ends up asking: how the mess works, how CGPA is counted,
            which scholarship fits you, and <strong>whom to call</strong> when something goes wrong.</p>
          <p>It helps <strong>first- and second-years</strong> most, and anyone who has asked a senior “whom do I even ask about this?”</p>
          <p>Inside: <strong>academics, hostel and mess, scholarships and loans, health, clubs and Inter IIT</strong>, with the
            official documents and office numbers that go with them.</p>
          <p>Search the way you'd ask a friend, or browse by area. It <strong>works offline</strong>, so it's there even when
            the hostel Wi-Fi isn't.</p>
          <p>Written and kept up to date by <strong>IITM students</strong>, from official sources. Not an official institute
            website. Something missing or wrong? ${tell}</p>
        </div>
        <p class="fine">No sign-in. Anonymous usage counts show us what people search for and can't find. Personal phone
          numbers are kept off this site; the numbers here are offices and official helplines.</p>
        <p class="share"><a href="${esc(CONFIG.ADMIN_PATH)}">For seniors: edit Campus Info</a></p>
      </article>`, "What is this?", "about");
    window.scrollTo(0, 0);
  }

  // ---------- scroll memory (so going back returns to the same place in a list) ----------
  window.addEventListener("scroll", () => {
    try { sessionStorage.setItem("ci.scroll." + location.hash, String(window.scrollY)); } catch (e) { /* ignore */ }
  }, { passive: true });

  function restoreScroll() {
    let y = 0;
    try { y = Number(sessionStorage.getItem("ci.scroll." + location.hash) || 0); } catch (e) { /* ignore */ }
    window.scrollTo(0, y);
  }

  // ---------- analytics ----------
  function analytics() {
    if (!CONFIG.GA_ID || PREVIEW) return;
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(CONFIG.GA_ID);
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", CONFIG.GA_ID, { send_page_view: false });
    pageView();
  }

  function track(name, data) {
    if (!CONFIG.GA_ID || PREVIEW || !window.gtag) return;
    window.gtag("event", name, data || {});
  }

  function pageView() {
    track("page_view", { page_location: location.href, page_title: document.title });
  }

  function trackClicks(e) {
    const a = e.target.closest("a");
    if (!a) return;
    if (a.dataset.contact) track("contact_tap", { type: a.dataset.contact, topic: a.dataset.topic || currentTopic() });
    if (a.dataset.file) {
      track("file_open", { file: a.dataset.file, topic: currentTopic() });
      if (a.dataset.practice) { e.preventDefault(); openPracticeFile(a.dataset.practice); }
    }
    if (a.dataset.feedback) track("feedback_open", { from: a.dataset.feedback });
  }

  function currentTopic() {
    const { kind, arg } = parseHash();
    return kind === "topic" ? arg : kind;
  }

  // Files uploaded in "Try the admin" live only in this browser (IndexedDB), never on the site.
  function openPracticeFile(id) {
    const req = indexedDB.open("campus-info-practice", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("files");
    req.onsuccess = () => {
      const get = req.result.transaction("files").objectStore("files").get(id);
      get.onsuccess = () => {
        if (get.result) window.open(URL.createObjectURL(get.result), "_blank", "noopener");
        else alert("This practice file isn't in this browser any more.");
      };
    };
  }

  // ---------- offline ----------
  function serviceWorker() {
    if (!("serviceWorker" in navigator) || PREVIEW) return;
    navigator.serviceWorker.register("service-worker.js").then(() => navigator.serviceWorker.ready).then(() => {
      const el = $("#offline");
      if (el) el.textContent = "Saved on this device, so it opens without internet.";
    }).catch(() => { /* not available here */ });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
