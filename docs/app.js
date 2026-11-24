/* Campus Info: the pages students see. Plain JavaScript, no build step.
   Routes:  #/  home and index · #/group/<slug> · #/find/<words> · #/topic/<slug> · #/about */
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
  const esc = M.esc;
  const params = new URLSearchParams(location.search);
  const PREVIEW = params.get("preview"); // "draft" from the admin, "practice" from Try the admin
  const PREVIEW_KEY = PREVIEW === "practice" ? "campus-info.practice.preview" : "campus-info.preview";
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
  };

  let DATA = null;
  let INDEX = null;
  let BY_SLUG = {};
  let CONTACTS = {};
  let searchTimer = null;
  let lastLogged = "";

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
    strip();
    footer();
    window.addEventListener("hashchange", route);
    route();
    whenIdle(loadSearchText);
    analytics();
    serviceWorker();
    installPrompt();
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

  // ---------- routing ----------
  function parseHash() {
    const h = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
    const [kind, ...rest] = h.split("/");
    return { kind: kind || "home", arg: rest.join("/") };
  }

  function currentQuery() {
    const { kind, arg } = parseHash();
    return kind === "find" ? arg : "";
  }

  function route() {
    const { kind, arg } = parseHash();
    if (kind === "topic" && BY_SLUG[arg]) return topicPage(BY_SLUG[arg]);
    if (kind === "about") return aboutPage();
    if (kind === "group") return homePage({ group: arg });
    if (kind === "find") return homePage({ query: arg });
    return homePage({});
  }

  function setPage(html, title) {
    const main = $("#main");
    main.innerHTML = html;
    document.title = title ? `${title} · Campus Info` : "Campus Info · student life at IIT Madras, searchable";
    pageView();
  }

  // ---------- emergency strip and footer ----------
  function strip() {
    const nums = (DATA.emergency || []).map((e) =>
      `<a href="tel:${esc(telOf(e.number))}" data-contact="call" data-topic="strip"><span>${esc(e.label)}</span> ${esc(shortNumber(e.number))}</a>`
    ).join("");
    const all = DATA.emergency_topic ? `<a class="all" href="#/topic/${esc(DATA.emergency_topic)}">More</a>` : "";
    $("#strip").innerHTML = `<span class="label">Emergency</span>${nums}${all}`;
  }

  function telOf(n) {
    const d = String(n).replace(/\D/g, "");
    return d.length === 12 && d.startsWith("91") ? "+" + d : d.length === 10 ? "+91" + d : "+" + d;
  }

  function shortNumber(n) {
    return String(n).replace(/^\+91[\s-]?44[\s-]?/, "").replace(/^\+91[\s-]?/, "");
  }

  function footer() {
    const fb = CONFIG.FEEDBACK_URL ? `<a href="${esc(feedbackLink("General"))}" target="_blank" rel="noopener" data-feedback="footer">Tell us what's missing</a>` : "";
    $("#foot").innerHTML = `
      <p><strong>Content updated ${esc(niceDate(DATA.updated))}.</strong> Written by IITM students, from official sources and their own experience.</p>
      <p class="links">${fb}<a href="#/about">About</a><a href="${esc(CONFIG.ADMIN_PATH)}">For seniors: edit</a><button type="button" class="install" hidden>Install the app</button></p>
      <p class="offline" id="offline"></p>`;
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

  // ---------- home: value, search, groups, New here?, index ----------
  function homePage({ group, query }) {
    const g = group && (DATA.groups || []).find((x) => x.slug === group);
    const counts = stats();
    const hello = g || query ? "" : `
      <section class="hello">
        <h1>What IIT Madras offers you, and whom to ask.</h1>
        <p class="lede">Mess, hostel, scholarships, academics, health and clubs, written by IITM students from official
        sources. Search in your own words. Every number taps to call, and it all works offline.</p>
        <ul class="proof">
          <li><b>${counts.topics}</b> topics</li>
          <li><b>${counts.documents}</b> official documents</li>
          <li><b>${counts.contacts}</b> phone numbers and emails</li>
        </ul>
      </section>`;
    const groups = (DATA.groups || []).map((x) =>
      `<a href="#/group/${esc(x.slug)}"${x.slug === group ? ' class="on" aria-current="page"' : ""}>${esc(x.title)}</a>`).join("");
    setPage(`
      ${hello}
      <form class="find" role="search" id="find">
        <label for="q" class="vh">Search Campus Info</label>
        <input id="q" type="search" placeholder="Try: mess change, cgpa, wifi" autocomplete="off"
          autocapitalize="off" spellcheck="false" enterkeyhint="search" value="${esc(query || "")}">
        <button type="button" class="clear" id="clear"${query ? "" : " hidden"}>Clear</button>
      </form>
      <nav class="groups" aria-label="Groups"><a href="#/"${!group ? ' class="on"' : ""}>All</a>${groups}</nav>
      <div id="results" aria-live="polite"></div>
      <div id="browse"></div>`, g ? g.title : query ? `“${query}”` : "");
    const input = $("#q");
    input.addEventListener("input", () => onType(input.value));
    $("#find").addEventListener("submit", (e) => { e.preventDefault(); input.blur(); logSearch(input.value, true); });
    $("#clear").addEventListener("click", () => { location.hash = "#/"; setTimeout(() => $("#q") && $("#q").focus(), 0); });
    if (query) {
      showResults(query);
    } else {
      browse(g);
    }
    restoreScroll();
  }

  function stats() {
    const seen = new Set();
    for (const c of Object.values(CONTACTS)) {
      for (const p of c.phones) seen.add(p.tel);
      for (const e of c.emails) seen.add(e.email.toLowerCase());
    }
    return { topics: DATA.topics.length, documents: Object.keys(DATA.files || {}).length, contacts: seen.size };
  }

  function browse(group) {
    const topics = group ? DATA.topics.filter((t) => t.group === group.slug) : DATA.topics;
    const newHere = !group && DATA.new_here && DATA.new_here.length ? `
      <section class="newhere">
        <h2>New here? Start with these</h2>
        <ol class="entries">${DATA.new_here.filter((s) => BY_SLUG[s]).map((s) => entry(BY_SLUG[s], { group: false })).join("")}</ol>
      </section>` : "";
    const head = group
      ? `<h2>${esc(group.title)} <span class="count">${topics.length} topics</span></h2><p class="gsum">${esc(group.summary || "")}</p>`
      : `<h2>Everything, A to Z <span class="count">${topics.length} topics</span></h2>`;
    const letters = {};
    for (const t of topics) {
      const L = letterOf(t.title);
      (letters[L] = letters[L] || []).push(t);
    }
    const order = Object.keys(letters).sort((a, b) => (a === "#") - (b === "#") || a.localeCompare(b));
    $("#browse").innerHTML = `${newHere}
      <section class="index">${head}
        ${order.map((L) => `<h3 class="letter" id="letter-${L}">${L}</h3><ul class="entries">${letters[L].map((t) => entry(t, { group: !group })).join("")}</ul>`).join("")}
      </section>`;
    rail(order);
  }

  function letterOf(title) {
    const c = title.normalize("NFKD").replace(/[^A-Za-z0-9]/g, "").charAt(0).toUpperCase();
    return /[A-Z]/.test(c) ? c : "#";
  }

  function entry(t, opts) {
    const g = opts.group ? `<span class="g">${esc(groupTitle(t.group))}</span>` : "";
    const title = opts.matched ? S.highlight(t.title, opts.matched) : esc(t.title);
    let line = opts.matched ? S.highlight(t.summary, opts.matched) : esc(t.summary);
    if (opts.snippet) {
      const from = opts.snippet.from ? `<span class="from">in ${esc(opts.snippet.from)}:</span> ` : "";
      line = from + S.highlight(opts.snippet.text, opts.matched);
    }
    return `<li><a href="#/topic/${esc(t.slug)}"><span class="t">${title}</span>${g}<span class="s">${line}</span></a></li>`;
  }

  function groupTitle(slug) {
    const g = (DATA.groups || []).find((x) => x.slug === slug);
    return g ? g.title : "";
  }

  let railWatch = null;
  function rail(order) {
    const el = $("#rail");
    if (railWatch) { railWatch.disconnect(); railWatch = null; }
    el.classList.remove("show");
    if (!order || order.length < 6) { el.hidden = true; el.innerHTML = ""; return; }
    el.innerHTML = order.map((L) => `<a href="#letter-${L}" data-letter="${L}">${L}</a>`).join("");
    el.hidden = false;
    // The letters only appear once the reader is in the index, so they never cover the text above it.
    const index = $(".index");
    if (index && "IntersectionObserver" in window) {
      railWatch = new IntersectionObserver((list) => el.classList.toggle("show", list[0].isIntersecting), { rootMargin: "-45% 0px -45% 0px" });
      railWatch.observe(index);
    } else {
      el.classList.add("show");
    }
    el.onclick = (e) => {
      const a = e.target.closest("a[data-letter]");
      if (!a) return;
      e.preventDefault();
      const target = document.getElementById("letter-" + a.dataset.letter);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    };
  }

  // ---------- search ----------
  function onType(value) {
    const q = value.trim();
    $("#clear").hidden = !q;
    const browseEl = $("#browse");
    const hello = $(".hello");
    if (!q) {
      $("#results").innerHTML = "";
      if (!browseEl.innerHTML) browse(null);
      browseEl.hidden = false;
      if (hello) hello.hidden = false;
      history.replaceState(null, "", "#/");
      return;
    }
    if (hello) hello.hidden = true;
    browseEl.hidden = true;
    $("#rail").hidden = true;
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
    $("#rail").hidden = true;
    const none = r.covered ? "" : `
      <div class="none">
        <p><mark>Nothing on this yet.</mark> Tell us what you were looking for and a senior will add it.</p>
        ${CONFIG.FEEDBACK_URL ? `<p><a class="ask" href="${esc(feedbackLink(q))}" target="_blank" rel="noopener" data-feedback="search">Ask for “${esc(q)}”</a></p>` : ""}
      </div>`;
    const list = (items) => items.map((x) => entry(BY_SLUG[x.slug], { group: true, matched: x.matched, snippet: x.snippet })).join("");
    const results = r.results.length
      ? `${r.covered ? "" : `<p class="divider">Closest matches</p>`}<ul class="entries hits">${list(r.results, false)}</ul>` : "";
    const mentions = r.mentions.length
      ? `<p class="divider">Mentioned inside</p><ul class="entries hits deep">${list(r.mentions, true)}</ul>` : "";
    el.innerHTML = none + results + mentions;
    el.dataset.covered = r.covered ? "yes" : "no";
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
  function topicPage(t) {
    rail(null);
    const c = CONTACTS[t.slug];
    const posts = t.posts.map((p) => `
      <section class="post">${M.render(p.md)}${files(p.files)}</section>`).join("");
    // One row per label ("Wellness Centre"), with all of its numbers and emails stacked on the right.
    const rows = [];
    const rowFor = (label) => {
      let r = rows.find((x) => x.label === label);
      if (!r) rows.push((r = { label, links: [] }));
      return r;
    };
    for (const p of c.phones) rowFor(p.label || "Phone").links.push(`<a href="tel:${esc(p.tel)}" class="num" data-contact="call" data-topic="${esc(t.slug)}">${esc(p.display)}</a>`);
    for (const e of c.emails) rowFor(e.label || "Email").links.push(`<a href="mailto:${esc(e.email)}" class="mail" data-contact="mail" data-topic="${esc(t.slug)}">${esc(e.email)}</a>`);
    const phones = rows.map((r) => `<li><span class="who">${esc(r.label)}</span><span class="how">${r.links.join("")}</span></li>`).join("");
    const emails = "";
    const contacts = phones || emails ? `
      <section class="contacts">
        <h2>Who to contact</h2>
        <ul>${phones}${emails}</ul>
      </section>` : "";
    const more = related(t).map((x) => entry(x, { group: false })).join("");
    let inApp = false;
    try { inApp = !!sessionStorage.getItem("ci.inapp"); } catch (e) { /* ignore */ }
    const back = inApp ? "Back" : "Index";
    setPage(`
      <article class="topic">
        <p class="crumbs"><a href="#/" class="back" id="back">← ${back}</a><a href="#/group/${esc(t.group)}" class="kicker">${esc(groupTitle(t.group))}</a></p>
        <h1>${esc(t.title)}</h1>
        <p class="lede">${esc(t.summary)}</p>
        <div class="posts">${posts}</div>
        ${contacts}
        <section class="useful" id="useful">
          <p>Was this useful?</p>
          <p><button type="button" data-useful="yes">Yes</button><button type="button" data-useful="no">Not really</button></p>
        </section>
        ${more ? `<section class="more"><h2>Also in ${esc(groupTitle(t.group))}</h2><ul class="entries">${more}</ul></section>` : ""}
        <p class="share"><button type="button" id="share">Share this page</button></p>
      </article>`, t.title);
    window.scrollTo(0, 0);
    track("view_topic", { topic: t.slug });
    $("#back").addEventListener("click", (e) => {
      if (inApp) { e.preventDefault(); history.back(); }
    });
    $("#useful").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-useful]");
      if (!b) return;
      track("helpful", { topic: t.slug, answer: b.dataset.useful });
      const ask = b.dataset.useful === "no" && CONFIG.FEEDBACK_URL
        ? ` <a href="${esc(feedbackLink(t.title))}" target="_blank" rel="noopener" data-feedback="topic">Tell us what was missing</a>` : "";
      $("#useful").innerHTML = `<p>Thanks.${ask}</p>`;
    });
    $("#share").addEventListener("click", async () => {
      const url = location.href.split("?")[0];
      track("share", { topic: t.slug });
      if (navigator.share) {
        try { await navigator.share({ title: t.title + " · Campus Info", url }); } catch (e) { /* closed */ }
      } else {
        try { await navigator.clipboard.writeText(url); $("#share").textContent = "Link copied"; } catch (e) { prompt("Copy this link", url); }
      }
    });
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

  // ---------- about ----------
  function aboutPage() {
    rail(null);
    const c = stats();
    const fb = CONFIG.FEEDBACK_URL ? `<a href="${esc(feedbackLink("General"))}" target="_blank" rel="noopener" data-feedback="about">tell us</a>` : "tell a senior";
    setPage(`
      <article class="topic about">
        <p class="crumbs"><a href="#/" class="back">← Index</a></p>
        <h1>About Campus Info</h1>
        <p class="lede">One place for what IIT Madras offers students and whom to ask about it, so nobody has to find out
        in their fourth year that a scholarship, a counsellor or a research programme was there all along.</p>
        <h2>What's in it</h2>
        <p>${c.topics} topics on academics, the hostel and mess, money, health, clubs and Inter IIT, with ${c.documents}
        official documents and ${c.contacts} phone numbers and emails. Each topic gathers its contacts at the end, and
        every number taps to call.</p>
        <h2>Who writes it</h2>
        <p>IITM students, from official sources and their own experience. Seniors keep it current through an admin page;
        a change goes live within a few minutes of being published. Content updated ${esc(niceDate(DATA.updated))}.</p>
        <h2>Something wrong or missing?</h2>
        <p>Please ${fb}. If a search finds nothing, the page offers a link that sends your search to the seniors.</p>
        <h2>Privacy</h2>
        <p>No accounts, no sign-in. Anonymous usage counts (Google Analytics) show what people search for and can't find.
        Personal phone numbers are kept off this site; the numbers here are offices and official helplines.</p>
        <h2>On your phone</h2>
        <p>Android: open the browser menu and choose <em>Install app</em> or <em>Add to Home screen</em>.
        iPhone: tap Share, then <em>Add to Home Screen</em>. After one visit it works without internet.</p>
        <p class="share"><a href="${esc(CONFIG.ADMIN_PATH)}">For seniors: edit Campus Info</a></p>
      </article>`, "About");
    window.scrollTo(0, 0);
  }

  // ---------- scroll memory (so Back returns to the same place in the index) ----------
  window.addEventListener("scroll", () => {
    try { sessionStorage.setItem("ci.scroll." + location.hash, String(window.scrollY)); } catch (e) { /* ignore */ }
  }, { passive: true });

  function restoreScroll() {
    let y = 0;
    try { y = Number(sessionStorage.getItem("ci.scroll." + location.hash) || 0); } catch (e) { /* ignore */ }
    window.scrollTo(0, y);
  }

  window.addEventListener("hashchange", () => { try { sessionStorage.setItem("ci.inapp", "1"); } catch (e) { /* ignore */ } });

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
    return kind === "topic" ? arg : "";
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

  // ---------- offline and install ----------
  function serviceWorker() {
    if (!("serviceWorker" in navigator) || PREVIEW) return;
    navigator.serviceWorker.register("service-worker.js").then(() => navigator.serviceWorker.ready).then(() => {
      const el = $("#offline");
      if (el) el.textContent = "Saved on this device: it opens even without internet.";
    }).catch(() => { /* not available here */ });
  }

  function installPrompt() {
    let deferred = null;
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferred = e;
      const b = $(".install");
      if (b) b.hidden = false;
    });
    document.addEventListener("click", async (e) => {
      if (!e.target.closest(".install") || !deferred) return;
      deferred.prompt();
      const choice = await deferred.userChoice;
      track("install", { outcome: choice.outcome });
      deferred = null;
      e.target.hidden = true;
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
