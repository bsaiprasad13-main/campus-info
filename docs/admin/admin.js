/* Campus Info admin. Seniors edit topics here; edits save on their own to a draft and go live when published.
   Two backends answer the same calls: Remote talks to the admin server (Zoho Catalyst + GitHub), Practice keeps a
   copy of the live content in this browser so anyone can try everything without touching the real site. */
(function () {
  "use strict";

  const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const CONFIG = {
    API: LOCAL ? "/api" : "https://campusinfo-60086240727.development.catalystserverless.in/server/campus_api/execute",
    GOOGLE_CLIENT_ID: "699909418873-831o6gb25c2pvrgqlre3j63r5tittc0g.apps.googleusercontent.com",
  };
  const M = window.CampusMarkdown;
  const SITE_PATH = "content/site.json";
  const topicPath = (slug) => `content/topics/${slug}.json`;
  const MAX_FILE = 8 * 1024 * 1024;

  // ---------- small helpers ----------
  const RAW = Symbol("raw");
  const raw = (s) => ({ [RAW]: String(s) });
  const esc = M.esc;
  function h(strings, ...vals) {
    let out = strings[0];
    vals.forEach((v, i) => {
      const one = (x) => (x && x[RAW] !== undefined ? x[RAW] : esc(x == null ? "" : x));
      out += Array.isArray(v) ? v.map(one).join("") : one(v);
      out += strings[i + 1];
    });
    return raw(out);
  }
  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => [...(el || document).querySelectorAll(sel)];
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del: (k) => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };
  function newId(prefix) {
    const hex = () => Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => b.toString(16).padStart(2, "0")).join("");
    let t = hex();
    while (!/[a-f]/.test(t)) t = hex();
    return (prefix || "") + t;
  }
  function slugify(title, taken) {
    let base = title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").split("-").slice(0, 6).join("-") || "topic";
    let s = base;
    for (let n = 2; taken.has(s); n++) s = `${base}-${n}`;
    return s;
  }
  function niceTime(iso) {
    const d = new Date(iso);
    return isNaN(d) ? "" : d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }
  function hash(s) {
    let x = 2166136261;
    for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); }
    return (x >>> 0).toString(16).padStart(8, "0");
  }
  const sortKey = (t) => t.normalize("NFKD").replace(/[^\x00-\x7f]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, "").trim();

  // ---------- the real server ----------
  class Remote {
    constructor() {
      this.kind = "remote";
      this.session = store.get("campus-info.admin.session");
    }
    async call(route, body) {
      let res;
      try {
        res = await fetch(`${CONFIG.API}/${route}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(this.session ? { "X-Admin-Session": this.session } : {}) },
          body: JSON.stringify(body || {}),
        });
      } catch (e) {
        const err = new Error("No connection.");
        err.status = 0;
        throw err;
      }
      let data = {};
      try { data = await res.json(); } catch (e) { /* empty */ }
      if (!res.ok) {
        const err = new Error(data.error || `The server answered ${res.status}.`);
        err.status = res.status;
        err.data = data;
        throw err;
      }
      return data;
    }
    async login(credential) {
      const r = await this.call("auth", { credential });
      this.session = r.session;
      store.set("campus-info.admin.session", r.session);
      return r.who;
    }
    logout() { this.session = null; store.del("campus-info.admin.session"); }
    state() { return this.call("state"); }
    save(changes, message) { return this.call("save", { changes, message }); }
    upload(filename, data) { return this.call("upload", { filename, data }); }
    preview() { return this.call("preview"); }
    publish(note) { return this.call("publish", { note }); }
    discard() { return this.call("discard"); }
    history() { return this.call("history"); }
    rollback(sha) { return this.call("rollback", { sha }); }
    admins() { return this.call("admins/list"); }
    addAdmin(email, label) { return this.call("admins/add", { email, label }); }
    removeAdmin(key) { return this.call("admins/remove", { key }); }
  }

  // ---------- the practice copy (everything stays in this browser) ----------
  const PKEY = "campus-info.practice.state";
  class Practice {
    constructor() { this.kind = "practice"; this.session = "practice"; }
    async init() {
      const saved = store.get(PKEY);
      if (saved) { this.db = JSON.parse(saved); return; }
      const r = await fetch("../data/content.json", { cache: "no-cache" });
      const c = await r.json();
      const topics = {};
      for (const t of c.topics) {
        topics[t.slug] = { slug: t.slug, title: t.title, summary: t.summary, group: t.group, tags: t.tags || [],
          freshers: (c.new_here || []).includes(t.slug), hidden: false, related: t.related || [], posts: t.posts, search_text: [] };
      }
      const site = { name: "Campus Info", groups: c.groups, new_here: c.new_here, emergency: c.emergency, emergency_topic: c.emergency_topic };
      const files = {};
      for (const [id, f] of Object.entries(c.files)) files[id] = { id, name: f.name, size: f.size, type: f.type, path: f.path };
      this.db = { topics, site, files, published: null, history: [], edits: [] };
      this.db.published = clone({ topics, site, files });
      this.persist();
    }
    persist() {
      if (!store.set(PKEY, JSON.stringify(this.db))) {
        this.db.history.forEach((x, i) => { if (i > 1) delete x.snapshot; });
        store.set(PKEY, JSON.stringify(this.db));
      }
    }
    sha(path) {
      const m = path.match(/^content\/topics\/(.+)\.json$/);
      const v = path === SITE_PATH ? this.db.site : m ? this.db.topics[m[1]] : null;
      return v ? hash(JSON.stringify(v)) : null;
    }
    login() { return { key: "practice", label: "You (practice)", owner: true }; }
    logout() { /* nothing to do */ }
    async state() {
      const shas = { [SITE_PATH]: this.sha(SITE_PATH) };
      for (const s of Object.keys(this.db.topics)) shas[topicPath(s)] = this.sha(topicPath(s));
      return { who: this.login(), topics: clone(this.db.topics), site: clone(this.db.site), files: clone(this.db.files),
        shas, unpublished: this.unpublished(), edits: this.db.edits.slice(0, 50), repo: null, token_expires: null };
    }
    unpublished() {
      const out = [];
      const pub = this.db.published;
      const slugs = new Set([...Object.keys(this.db.topics), ...Object.keys(pub.topics)]);
      for (const s of slugs) {
        const a = this.db.topics[s], b = pub.topics[s];
        if (JSON.stringify(a) !== JSON.stringify(b)) {
          out.push({ path: topicPath(s), kind: !b ? "added" : !a ? "removed" : "changed", what: "topic", slug: s, title: (a || b).title });
        }
      }
      if (JSON.stringify(this.db.site) !== JSON.stringify(pub.site)) out.push({ path: SITE_PATH, kind: "changed", what: "home page", title: "Home page settings" });
      for (const id of Object.keys(this.db.files)) if (!pub.files[id]) out.push({ path: `docs/files/${id}`, kind: "added", what: "file", title: this.db.files[id].name });
      return out;
    }
    async save(changes, message) {
      const shas = {};
      for (const ch of changes) {
        const current = this.sha(ch.path);
        if ((ch.base_sha || null) !== current) {
          const m = ch.path.match(/^content\/topics\/(.+)\.json$/);
          const err = new Error("Someone else changed this while you were editing.");
          err.status = 409;
          err.data = { path: ch.path, current_sha: current, current: m ? clone(this.db.topics[m[1]] || null) : clone(this.db.site) };
          throw err;
        }
      }
      for (const ch of changes) {
        const m = ch.path.match(/^content\/topics\/(.+)\.json$/);
        if (ch.path === SITE_PATH) this.db.site = clone(ch.content);
        else if (m && ch.content === null) delete this.db.topics[m[1]];
        else if (m) this.db.topics[m[1]] = clone(ch.content);
        shas[ch.path] = this.sha(ch.path);
        const title = ch.path === SITE_PATH ? "home page" : (ch.content && ch.content.title) || m[1];
        this.db.edits.unshift({ sha: newId(), message: `Edit: ${message || title}`, by: "You (practice)", date: new Date().toISOString() });
      }
      this.db.edits = this.db.edits.slice(0, 60);
      this.persist();
      return { shas };
    }
    async upload(filename, data) {
      const name = filename.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 90);
      const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
      const id = newId();
      const type = guessType(name);
      await idb("put", id, new Blob([bytes], { type }));
      this.db.files[id] = { id, name, size: bytes.length, type, practice: true };
      this.persist();
      return { id, name, size: bytes.length, type, searchable: false };
    }
    async preview() {
      const content = buildContent(this.db.site, this.db.topics, this.db.files);
      return { content, search: { files: {}, linked: {} } };
    }
    async publish(note) {
      if (!note.trim()) { const e = new Error("Write a short note on what changed."); e.status = 400; throw e; }
      if (!this.unpublished().length) { const e = new Error("There's nothing new to publish."); e.status = 400; throw e; }
      this.db.published = clone({ topics: this.db.topics, site: this.db.site, files: this.db.files });
      this.db.history.unshift({ sha: newId(), kind: "publish", note: note.trim(), by: "You (practice)", date: new Date().toISOString(),
        snapshot: clone(this.db.published) });
      this.db.history.forEach((x, i) => { if (i > 4) delete x.snapshot; });
      this.db.edits = [];
      this.persist();
      return { ok: true };
    }
    async discard() {
      const p = clone(this.db.published);
      Object.assign(this.db, { topics: p.topics, site: p.site, files: p.files, edits: [] });
      this.persist();
      return { ok: true };
    }
    async history() {
      return this.db.history.map((x) => ({ sha: x.sha, kind: x.kind, note: x.note, by: x.by, date: x.date, canRoll: !!x.snapshot }));
    }
    async rollback(sha) {
      const x = this.db.history.find((y) => y.sha === sha && y.snapshot);
      if (!x) { const e = new Error("That version isn't kept in the practice copy any more."); e.status = 400; throw e; }
      const snap = clone(x.snapshot);
      Object.assign(this.db, { topics: snap.topics, site: snap.site, files: snap.files, edits: [] });
      this.db.published = clone(snap);
      this.db.history.unshift({ sha: newId(), kind: "rollback", note: `to the version of ${niceTime(x.date)} (${x.note})`, by: "You (practice)", date: new Date().toISOString() });
      this.persist();
      return { ok: true };
    }
    async admins() { return { admins: [], practice: true }; }
    async addAdmin() { const e = new Error("In the practice copy the admin list can't be changed. The real admin page lets the owner add seniors by their Google email."); e.status = 400; throw e; }
    async removeAdmin() { return this.addAdmin(); }
    async reset() {
      store.del(PKEY);
      store.del("campus-info.practice.preview");
      store.del("campus-info.practice.pending");
      await idb("clear");
    }
  }

  function guessType(name) {
    const ext = (name.split(".").pop() || "").toLowerCase();
    return { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", txt: "text/plain", csv: "text/csv" }[ext] || "application/octet-stream";
  }

  function idb(op, key, value) {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("campus-info-practice", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("files");
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const tx = req.result.transaction("files", op === "get" ? "readonly" : "readwrite");
        const os = tx.objectStore("files");
        const r = op === "put" ? os.put(value, key) : op === "get" ? os.get(key) : os.clear();
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      };
    });
  }

  // The same steps as server/campus_api/build.py, for the practice preview.
  function buildContent(site, topics, files) {
    const visible = Object.values(topics).filter((t) => !t.hidden).sort((a, b) => sortKey(a.title).localeCompare(sortKey(b.title)));
    const slugs = new Set(visible.map((t) => t.slug));
    const used = [];
    const out = visible.map((t) => {
      const posts = [];
      for (const p of t.posts || []) {
        const fids = (p.files || []).filter((f) => files[f]);
        fids.forEach((f) => { if (!used.includes(f)) used.push(f); });
        if ((p.md || "").trim() || fids.length) posts.push({ id: p.id, md: p.md || "", files: fids });
      }
      return { slug: t.slug, title: t.title, summary: t.summary || "", group: t.group || "", tags: t.tags || [],
        related: (t.related || []).filter((r) => slugs.has(r) && r !== t.slug), posts };
    });
    const fileMap = {};
    for (const id of used) {
      const f = files[id];
      fileMap[id] = { name: f.name, size: f.size, type: f.type, path: f.path || `files/${id}/${encodeURIComponent(f.name)}`, ...(f.practice ? { practice: true } : {}) };
    }
    return { updated: new Date().toISOString().slice(0, 10), groups: site.groups || [], new_here: (site.new_here || []).filter((s) => slugs.has(s)),
      emergency: site.emergency || [], emergency_topic: slugs.has(site.emergency_topic) ? site.emergency_topic : null, topics: out, files: fileMap };
  }

  // ---------- app state ----------
  let backend = null;
  let S = null;                 // the state from the backend
  let changed = new Set();      // paths with unpublished changes
  let openSlug = null;          // topic in the editor ("" = home page settings)
  const pending = new Map();    // path -> {content, base}; saved one at a time
  let saving = false;
  let saveTimer = null;
  let blocked = false;          // waiting for sign-in
  const root = () => $("#root");
  const pendingKey = () => backend && backend.kind === "practice" ? "campus-info.practice.pending" : "campus-info.admin.pending";

  // ---------- sign in ----------
  function signInScreen(message) {
    root().innerHTML = h`
      <main class="signin">
        <p class="brand"><span class="logo">ci</span> Campus Info <span class="muted">admin</span></p>
        <h1>Keep Campus Info up to date.</h1>
        <p class="lede">Seniors on the admin list edit topics here. Every change saves on its own to a draft; students see it once someone publishes.</p>
        <div id="gbtn" class="gbtn"></div>
        ${CONFIG.GOOGLE_CLIENT_ID ? "" : raw(LOCAL ? "" : `<p class="note">Google sign-in isn't switched on for this copy.</p>`)}
        ${LOCAL ? raw(`<p class="local"><button type="button" data-local="local-owner">Local sign-in: owner</button><button type="button" data-local="local-senior">Local sign-in: senior</button><button type="button" data-local="local-stranger">Not an admin</button></p>`) : ""}
        <p class="error" id="err">${message || ""}</p>
        <section class="try">
          <h2>Reviewing this? Try the admin.</h2>
          <p>Open the same admin on a practice copy of the live content. No sign-in. Edit, upload, preview, publish and roll back; it all stays in this browser and never reaches the real site.</p>
          <p><button type="button" class="primary" id="try">Try the admin</button></p>
        </section>
        <p class="muted small"><a href="../">Back to Campus Info</a></p>
      </main>`[RAW];
    $("#try").onclick = startPractice;
    $$("[data-local]").forEach((b) => { b.onclick = () => signIn(b.dataset.local); });
    googleButton($("#gbtn"));
  }

  function googleButton(slot) {
    if (!CONFIG.GOOGLE_CLIENT_ID || !slot) return;
    const draw = () => {
      window.google.accounts.id.initialize({ client_id: CONFIG.GOOGLE_CLIENT_ID, callback: (r) => signIn(r.credential), ux_mode: "popup" });
      window.google.accounts.id.renderButton(slot, { theme: "outline", size: "large", text: "signin_with", shape: "rectangular", width: 280 });
    };
    if (window.google && window.google.accounts) return draw();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = draw;
    s.onerror = () => { slot.textContent = "Couldn't load Google sign-in. Check the connection."; };
    document.head.appendChild(s);
  }

  async function signIn(credential) {
    backend = backend && backend.kind === "remote" ? backend : new Remote();
    try {
      await backend.login(credential);
      $("#relogin") && $("#relogin").remove();
      if (S) { blocked = false; setStatus(); flush(); return; }
      await load();
    } catch (e) {
      const err = $("#err") || $("#relogin-err");
      if (err) err.textContent = e.message;
    }
  }

  async function startPractice() {
    backend = new Practice();
    try {
      await backend.init();
      await load();
    } catch (e) {
      signInScreen("Couldn't load the practice copy: " + e.message);
    }
  }

  // ---------- loading ----------
  async function load(keepOpen) {
    root().innerHTML = `<p class="boot">Loading the draft…</p>`;
    try {
      S = await backend.state();
    } catch (e) {
      if (e.status === 401) { backend.logout(); return signInScreen(e.message); }
      root().innerHTML = h`<p class="boot">Couldn't load the draft: ${e.message} <button type="button" id="again">Try again</button></p>`[RAW];
      $("#again").onclick = () => load(keepOpen);
      return;
    }
    changed = new Set(S.unpublished.map((c) => c.path));
    restorePending();
    shell();
    if (keepOpen && (keepOpen === "" || S.topics[keepOpen])) open(keepOpen);
  }

  function restorePending() {
    let saved = {};
    try { saved = JSON.parse(store.get(pendingKey()) || "{}"); } catch (e) { saved = {}; }
    for (const [path, item] of Object.entries(saved)) {
      const now = S.shas[path] || null;
      if ((item.base || null) === now) {
        pending.set(path, item);
        applyLocal(path, item.content);
      } else {
        setTimeout(() => conflictDialog(path, item.content, { current: currentOf(path), current_sha: now }), 300);
      }
    }
    if (pending.size) { setStatus("saving"); saveTimer = setTimeout(flush, 500); }
    persistPending();
  }

  function currentOf(path) {
    if (path === SITE_PATH) return S.site;
    const m = path.match(/^content\/topics\/(.+)\.json$/);
    return m ? S.topics[m[1]] || null : null;
  }

  function applyLocal(path, content) {
    if (path === SITE_PATH) S.site = content;
    const m = path.match(/^content\/topics\/(.+)\.json$/);
    if (m) { if (content === null) delete S.topics[m[1]]; else S.topics[m[1]] = content; }
  }

  // ---------- the main screen ----------
  function shell() {
    const practice = backend.kind === "practice";
    const expiring = S.token_expires && (new Date(S.token_expires) - Date.now()) < 14 * 864e5
      ? h`<p class="warn">The GitHub key the admin uses expires on ${new Date(S.token_expires).toLocaleDateString("en-GB")}. Make a new one and update the server before then.</p>` : "";
    root().innerHTML = h`
      ${practice ? raw(`<div class="practice">Practice copy. Nothing you do here reaches the real site. <button type="button" id="restart">Start over</button></div>`) : ""}
      <header class="bar">
        <a class="brand" href="../" title="Open Campus Info"><span class="logo">ci</span><span class="hide-s">Campus Info</span> <span class="muted">admin</span></a>
        <span class="status" id="status" aria-live="polite"></span>
        <span class="actions">
          <button type="button" id="preview">Preview</button>
          <button type="button" class="primary" id="publish">Publish</button>
          <button type="button" id="more" aria-haspopup="true">More</button>
        </span>
      </header>
      <nav class="menu" id="menu" hidden>
        <button type="button" data-do="history">Published versions</button>
        <button type="button" data-do="admins">Admins</button>
        <button type="button" data-do="edits">Recent edits</button>
        <button type="button" data-do="discard">Discard unpublished changes</button>
        <button type="button" data-do="signout">${practice ? "Leave the practice copy" : "Sign out"}</button>
        <p class="muted small">Signed in as ${S.who.label}</p>
      </nav>
      ${expiring}
      <div class="panes" id="panes">
        <aside class="list" id="list">
          <div class="list-top">
            <input type="search" id="filter" placeholder="Find a topic" autocomplete="off">
            <button type="button" id="new">New topic</button>
          </div>
          <ul id="topics"></ul>
        </aside>
        <section class="editor" id="editor"><div class="empty"><p>Pick a topic to edit, or start a new one.</p>
          <p class="muted">Changes save on their own. Students see them after you publish.</p></div></section>
      </div>`[RAW];
    if (practice) $("#restart").onclick = async () => { if (confirm("Start over with a fresh copy of the live content?")) { await backend.reset(); startPractice(); } };
    $("#preview").onclick = () => preview(openSlug || "");
    $("#publish").onclick = publishDialog;
    $("#more").onclick = () => { $("#menu").hidden = !$("#menu").hidden; };
    $("#menu").onclick = (e) => {
      const b = e.target.closest("[data-do]");
      if (!b) return;
      $("#menu").hidden = true;
      ({ history: historyDialog, admins: adminsDialog, edits: editsDialog, discard: discardChanges, signout: signOut })[b.dataset.do]();
    };
    $("#filter").oninput = drawList;
    $("#new").onclick = newTopic;
    $("#topics").onclick = (e) => {
      const a = e.target.closest("[data-slug]");
      if (a) { e.preventDefault(); open(a.dataset.slug); }
    };
    drawList();
    setStatus();
  }

  function drawList() {
    const q = ($("#filter") && $("#filter").value || "").trim().toLowerCase();
    const groups = Object.fromEntries((S.site.groups || []).map((g) => [g.slug, g.title]));
    const topics = Object.values(S.topics).filter((t) => !q || (t.title + " " + (t.tags || []).join(" ")).toLowerCase().includes(q))
      .sort((a, b) => sortKey(a.title).localeCompare(sortKey(b.title)));
    const home = !q || "home page emergency new here".includes(q) ? h`<li><a href="#" data-slug="" class="${openSlug === "" ? "on" : ""}">
      <span class="t">Home page</span><span class="g">Emergency numbers, New here?</span>${changed.has(SITE_PATH) ? raw('<span class="dot" title="Not published yet"></span>') : ""}</a></li>`[RAW] : "";
    $("#topics").innerHTML = home + topics.map((t) => h`<li><a href="#" data-slug="${t.slug}" class="${t.slug === openSlug ? "on" : ""}">
      <span class="t">${t.title}</span><span class="g">${groups[t.group] || t.group}${t.hidden ? " · hidden" : ""}</span>
      ${changed.has(topicPath(t.slug)) ? raw('<span class="dot" title="Not published yet"></span>') : ""}</a></li>`[RAW]).join("");
    const n = changed.size;
    $("#publish").textContent = n ? `Publish (${n})` : "Publish";
  }

  // ---------- autosave ----------
  function queue(path, content) {
    pending.set(path, { content: clone(content), base: S.shas[path] || null });
    applyLocal(path, content);
    persistPending();
    setStatus("saving");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 900);
  }

  function persistPending() {
    const obj = {};
    for (const [p, item] of pending) obj[p] = item;
    if (pending.size) store.set(pendingKey(), JSON.stringify(obj));
    else store.del(pendingKey());
  }

  async function flush() {
    if (saving || blocked || !pending.size) return;
    if (!navigator.onLine) { setStatus("offline"); return; }
    saving = true;
    const [path, item] = pending.entries().next().value;
    const base = S.shas[path] || null;
    try {
      const r = await backend.save([{ path, content: item.content, base_sha: base }], "");
      S.shas[path] = r.shas[path];
      if (r.shas[path] === null) delete S.shas[path];
      if (pending.get(path) === item) pending.delete(path);
      else pending.get(path).base = r.shas[path];
      changed.add(path);
      persistPending();
      drawList();
      setStatus(pending.size ? "saving" : "saved");
    } catch (e) {
      if (e.status === 401) { blocked = true; setStatus("signin"); reloginDialog(e.message); }
      else if (e.status === 409) { pending.delete(path); persistPending(); conflictDialog(path, item.content, e.data || {}); setStatus(pending.size ? "saving" : "saved"); }
      else if (e.status === 400) { pending.delete(path); persistPending(); setStatus("error", e.message); }
      else { setStatus(e.status === 0 ? "offline" : "retry"); saving = false; setTimeout(flush, 5000); return; }
    }
    saving = false;
    if (pending.size && !blocked) setTimeout(flush, 200);
  }

  window.addEventListener("online", () => flush());
  window.addEventListener("beforeunload", (e) => { if (pending.size) { e.preventDefault(); e.returnValue = ""; } });

  async function settle(ms) {
    clearTimeout(saveTimer);
    flush();
    const end = Date.now() + (ms || 20000);
    while ((pending.size || saving) && Date.now() < end && !blocked) await new Promise((r) => setTimeout(r, 150));
    return !pending.size;
  }

  function setStatus(kind, msg) {
    const el = $("#status");
    if (!el) return;
    const n = changed.size;
    const texts = {
      saving: "Saving…",
      saved: n ? `Saved · ${n} change${n > 1 ? "s" : ""} not published yet` : "Saved · everything is published",
      offline: "No connection. Your edits are kept and save when you're back.",
      retry: "Couldn't save. Trying again…",
      signin: "Sign in again to keep saving. Your edits are kept.",
      error: msg || "That change couldn't be saved.",
    };
    const k = kind || (pending.size ? "saving" : "saved");
    el.textContent = texts[k];
    el.className = `status ${k}`;
  }

  // ---------- editing a topic ----------
  function open(slug) {
    openSlug = slug;
    $("#panes").classList.add("editing");
    drawList();
    if (slug === "") return homeEditor();
    const t = S.topics[slug];
    const groups = S.site.groups || [];
    $("#editor").innerHTML = h`
      <p class="back-s"><button type="button" class="link" id="tolist">← All topics</button></p>
      <div class="fields">
        <label>Title<input id="f-title" value="${t.title}" maxlength="120"></label>
        <label>One line on what it covers<input id="f-summary" value="${t.summary || ""}" maxlength="300"></label>
        <div class="row">
          <label>Group<select id="f-group">${groups.map((g) => h`<option value="${g.slug}" ${g.slug === t.group ? "selected" : ""}>${g.title}</option>`)}</select></label>
          <label class="grow">Words people search for <span class="muted">(comma between)</span><input id="f-tags" value="${(t.tags || []).join(", ")}"></label>
        </div>
        <div class="row checks">
          <label class="check"><input type="checkbox" id="f-freshers" ${t.freshers ? "checked" : ""}> Useful for freshers</label>
          <label class="check"><input type="checkbox" id="f-hidden" ${t.hidden ? "checked" : ""}> Hidden from students</label>
          <a class="small" href="#" id="view">See it as students do</a>
        </div>
      </div>
      <h2>Posts</h2>
      <details class="help"><summary>Formatting help</summary>
        <p><code>**bold**</code> · <code>## Heading</code> · <code>- list item</code> · <code>[link text](https://…)</code>. Phone numbers and emails become tap-to-call and tap-to-mail by themselves.</p></details>
      <ol class="posts" id="posts"></ol>
      <p><button type="button" id="addpost">Add a post</button></p>
      <p class="danger"><button type="button" class="link" id="deltopic">Delete this topic</button></p>`[RAW];
    drawPosts(t);
    const bind = (id, fn) => { $(id).addEventListener("input", fn); $(id).addEventListener("change", fn); };
    const edit = (fn) => () => { const cur = clone(S.topics[slug]); fn(cur); queue(topicPath(slug), cur); };
    bind("#f-title", edit((c) => { c.title = $("#f-title").value.trim() || c.title; }));
    bind("#f-summary", edit((c) => { c.summary = $("#f-summary").value; }));
    bind("#f-group", edit((c) => { c.group = $("#f-group").value; }));
    bind("#f-tags", edit((c) => { c.tags = $("#f-tags").value.split(",").map((x) => x.trim()).filter(Boolean); }));
    bind("#f-freshers", edit((c) => { c.freshers = $("#f-freshers").checked; }));
    bind("#f-hidden", edit((c) => { c.hidden = $("#f-hidden").checked; }));
    $("#tolist").onclick = () => { $("#panes").classList.remove("editing"); };
    $("#view").onclick = (e) => { e.preventDefault(); preview(slug); };
    $("#addpost").onclick = () => {
      const cur = clone(S.topics[slug]);
      cur.posts.push({ id: newId("p"), md: "", files: [] });
      queue(topicPath(slug), cur);
      drawPosts(cur, cur.posts.length - 1);
    };
    $("#deltopic").onclick = () => {
      if (!confirm(`Delete “${t.title}”? Students keep seeing it until you publish. If you only want it out of sight for a while, tick “Hidden from students” instead.`)) return;
      queue(topicPath(slug), null);
      openSlug = null;
      $("#editor").innerHTML = `<div class="empty"><p>Deleted. It disappears from the site with the next publish.</p></div>`;
      drawList();
    };
  }

  function drawPosts(t, focusIndex) {
    const files = S.files || {};
    $("#posts").innerHTML = t.posts.map((p, i) => postHtml(p, i, t.posts.length, files)).join("");
    $$("#posts textarea").forEach(grow);
    if (focusIndex !== undefined) { const ta = $$("#posts textarea")[focusIndex]; if (ta) ta.focus(); }
    const slug = t.slug;
    const list = $("#posts");
    list.oninput = (e) => {
      if (e.target.tagName !== "TEXTAREA") return;
      grow(e.target);
      const cur = clone(S.topics[slug]);
      cur.posts[Number(e.target.dataset.i)].md = e.target.value;
      queue(topicPath(slug), cur);
    };
    list.onclick = (e) => {
      const b = e.target.closest("[data-act]");
      if (!b || b.tagName === "INPUT") return;
      const li = b.closest(".post");
      const i = Number(li.dataset.i);
      const cur = clone(S.topics[slug]);
      const act = b.dataset.act;
      if (act === "write" || act === "look") {
        const look = act === "look";
        $(".look", li).hidden = !look;
        $("textarea", li).hidden = look;
        if (look) $(".look", li).innerHTML = M.render(cur.posts[i].md) || `<p class="muted">Nothing written yet.</p>`;
        $$(".tabs button", li).forEach((x) => x.classList.toggle("on", x.dataset.act === act));
        return;
      }
      if (act === "up" || act === "down") {
        const j = act === "up" ? i - 1 : i + 1;
        [cur.posts[i], cur.posts[j]] = [cur.posts[j], cur.posts[i]];
      } else if (act === "delete") {
        if ((cur.posts[i].md || "").trim() && !confirm("Delete this post?")) return;
        cur.posts.splice(i, 1);
      } else if (act === "unfile") {
        cur.posts[i].files = cur.posts[i].files.filter((x) => x !== b.dataset.id);
      } else return;
      queue(topicPath(slug), cur);
      drawPosts(cur);
    };
    list.onchange = async (e) => {
      if (e.target.dataset.act !== "attach" || !e.target.files.length) return;
      const file = e.target.files[0];
      const i = Number(e.target.closest(".post").dataset.i);
      await attach(slug, i, file);
    };
    sortable(list, (order) => {
      const cur = clone(S.topics[slug]);
      cur.posts = order.map((i) => cur.posts[i]);
      queue(topicPath(slug), cur);
      drawPosts(cur);
    });
  }

  function postHtml(p, i, n, files) {
    return h`
      <li class="post" data-i="${i}">
        <div class="post-bar">
          <span class="drag" title="Drag to move">⋮⋮</span>
          <button type="button" class="link" data-act="up" ${raw(i === 0 ? "disabled" : "")} aria-label="Move up">Up</button>
          <button type="button" class="link" data-act="down" ${raw(i === n - 1 ? "disabled" : "")} aria-label="Move down">Down</button>
          <span class="tabs"><button type="button" class="link on" data-act="write">Write</button><button type="button" class="link" data-act="look">Preview</button></span>
          <button type="button" class="link" data-act="delete">Delete</button>
        </div>
        <textarea rows="6" data-i="${i}" spellcheck="true" aria-label="Post ${i + 1}">${p.md}</textarea>
        <div class="look" hidden></div>
        <ul class="files">${(p.files || []).map((id) => h`<li><span>${files[id] ? files[id].name : id}</span>
          <button type="button" class="link" data-act="unfile" data-id="${id}">Remove</button></li>`)}</ul>
        <label class="attach"><input type="file" data-act="attach" hidden><span class="link">Attach a file</span>
          <span class="muted small">PDF, image or Office file, up to 8 MB</span></label>
      </li>`[RAW];
  }

  function grow(ta) {
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight + 4, 900) + "px";
  }

  async function attach(slug, i, file) {
    if (file.size > MAX_FILE) return alert("Files can be up to 8 MB. Compress it or split it first.");
    setStatus("error", `Uploading ${file.name}…`);
    try {
      const data = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1] || "");
        r.onerror = () => reject(r.error);
        r.readAsDataURL(file);
      });
      const meta = await backend.upload(file.name, data);
      S.files[meta.id] = meta;
      changed.add(`docs/files/${meta.id}`);
      const cur = clone(S.topics[slug]);
      cur.posts[i].files = [...(cur.posts[i].files || []), meta.id];
      queue(topicPath(slug), cur);
      if (openSlug === slug) drawPosts(cur);
      if (!meta.searchable && /\.pdf$/i.test(meta.name)) alert("Uploaded. This PDF has no readable text (probably a scan), so search can find it by its name only.");
    } catch (e) {
      if (e.status === 401) { blocked = true; reloginDialog(e.message); }
      alert("The upload didn't go through: " + e.message);
      setStatus();
    }
  }

  // Drag by the ⋮⋮ handle. Works with a mouse and a finger.
  function sortable(list, done) {
    list.onpointerdown = (e) => {
      const handle = e.target.closest(".drag");
      if (!handle) return;
      const item = handle.closest("li");
      const items = [...list.children];
      const start = items.indexOf(item);
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      item.classList.add("dragging");
      const move = (ev) => {
        const over = [...list.children].find((x) => x !== item && ev.clientY > x.getBoundingClientRect().top && ev.clientY < x.getBoundingClientRect().bottom);
        if (!over) return;
        const r = over.getBoundingClientRect();
        list.insertBefore(item, ev.clientY < r.top + r.height / 2 ? over : over.nextSibling);
      };
      const up = () => {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        handle.removeEventListener("pointercancel", up);
        item.classList.remove("dragging");
        const order = [...list.children].map((x) => Number(x.dataset.i));
        if (order.indexOf(start) !== start || order.some((v, k) => v !== k)) done(order);
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
      handle.addEventListener("pointercancel", up);
    };
  }

  function newTopic() {
    const title = (prompt("Title of the new topic (start with the word people would look under, like “Gym timings”):") || "").trim();
    if (!title) return;
    const slug = slugify(title, new Set(Object.keys(S.topics)));
    const t = { slug, title, summary: "", group: (S.site.groups[0] || {}).slug || "", tags: [], freshers: false, hidden: false,
      related: [], posts: [{ id: newId("p"), md: "", files: [] }], search_text: [] };
    queue(topicPath(slug), t);
    open(slug);
    $("#f-summary").focus();
  }

  // ---------- the home page settings ----------
  function homeEditor() {
    const site = S.site;
    const titles = Object.fromEntries(Object.values(S.topics).map((t) => [t.slug, t.title]));
    const options = Object.values(S.topics).filter((t) => !(site.new_here || []).includes(t.slug))
      .sort((a, b) => (b.freshers - a.freshers) || sortKey(a.title).localeCompare(sortKey(b.title)));
    $("#editor").innerHTML = h`
      <p class="back-s"><button type="button" class="link" id="tolist">← All topics</button></p>
      <h2>Emergency numbers</h2>
      <p class="muted">The strip at the top of every page. Keep it to two or three; the full list is the topic it links to.</p>
      <ol class="rows" id="sos">${(site.emergency || []).map((e, i) => h`<li data-i="${i}"><span class="drag">⋮⋮</span>
        <input data-k="label" value="${e.label}" aria-label="Name" maxlength="30"><input data-k="number" value="${e.number}" aria-label="Number" maxlength="24" inputmode="tel">
        <button type="button" class="link" data-act="del">Remove</button></li>`)}</ol>
      ${(site.emergency || []).length < 4 ? raw(`<p><button type="button" id="sos-add">Add a number</button></p>`) : ""}
      <label>“More” links to<select id="sos-topic">${Object.values(S.topics).sort((a, b) => sortKey(a.title).localeCompare(sortKey(b.title)))
        .map((t) => h`<option value="${t.slug}" ${t.slug === site.emergency_topic ? "selected" : ""}>${t.title}</option>`)}</select></label>
      <h2>New here? Start with these</h2>
      <p class="muted">Up to six topics, in the order a fresher should read them.</p>
      <ol class="rows" id="newhere">${(site.new_here || []).map((s, i) => h`<li data-i="${i}"><span class="drag">⋮⋮</span>
        <span class="grow">${titles[s] || s}</span><button type="button" class="link" data-act="del">Remove</button></li>`)}</ol>
      ${(site.new_here || []).length < 6 ? h`<p><select id="nh-pick"><option value="">Add a topic…</option>${options.map((t) => h`<option value="${t.slug}">${t.freshers ? "★ " : ""}${t.title}</option>`)}</select></p>` : ""}`[RAW];
    const saveSite = (fn) => { const cur = clone(S.site); fn(cur); queue(SITE_PATH, cur); };
    $("#tolist").onclick = () => { $("#panes").classList.remove("editing"); };
    $("#sos").oninput = (e) => {
      const li = e.target.closest("li");
      if (!li || !e.target.dataset.k) return;
      saveSite((c) => { c.emergency[Number(li.dataset.i)][e.target.dataset.k] = e.target.value; });
    };
    $("#sos").onclick = (e) => {
      if (e.target.dataset.act !== "del") return;
      saveSite((c) => c.emergency.splice(Number(e.target.closest("li").dataset.i), 1));
      homeEditor();
    };
    sortable($("#sos"), (order) => { saveSite((c) => { c.emergency = order.map((i) => c.emergency[i]); }); homeEditor(); });
    if ($("#sos-add")) $("#sos-add").onclick = () => { saveSite((c) => c.emergency.push({ label: "Name", number: "+91 44 2257 0000" })); homeEditor(); };
    $("#sos-topic").onchange = () => saveSite((c) => { c.emergency_topic = $("#sos-topic").value; });
    $("#newhere").onclick = (e) => {
      if (e.target.dataset.act !== "del") return;
      saveSite((c) => c.new_here.splice(Number(e.target.closest("li").dataset.i), 1));
      homeEditor();
    };
    sortable($("#newhere"), (order) => { saveSite((c) => { c.new_here = order.map((i) => c.new_here[i]); }); homeEditor(); });
    if ($("#nh-pick")) $("#nh-pick").onchange = () => {
      const v = $("#nh-pick").value;
      if (v) { saveSite((c) => { c.new_here = [...(c.new_here || []), v]; }); homeEditor(); }
    };
  }

  // ---------- preview and publish ----------
  async function preview(slug) {
    const win = window.open("about:blank", "_blank");
    setStatus("saving");
    await settle();
    try {
      const data = await backend.preview();
      const key = backend.kind === "practice" ? "campus-info.practice.preview" : "campus-info.preview";
      if (!store.set(key, JSON.stringify(data))) throw new Error("This browser is out of space for the preview.");
      const url = `../index.html?preview=${backend.kind === "practice" ? "practice" : "draft"}#/${slug ? "topic/" + slug : ""}`;
      if (win) win.location.href = url; else location.href = url;
    } catch (e) {
      if (win) win.close();
      alert("Couldn't build the preview: " + e.message);
    }
    setStatus();
  }

  function dialog(html, onReady) {
    const d = document.createElement("dialog");
    d.className = "dlg";
    d.innerHTML = html;
    document.body.appendChild(d);
    d.addEventListener("close", () => d.remove());
    d.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) d.close(); });
    d.showModal();
    if (onReady) onReady(d);
    return d;
  }

  async function publishDialog() {
    await settle();
    if (pending.size) return alert("Some edits haven't saved yet. Check the connection, then publish.");
    let list = S.unpublished;
    try { list = (await backend.state()).unpublished; } catch (e) { /* use what we have */ }
    if (!list.length) return alert("Everything is already published.");
    dialog(h`
      <h2>Publish ${list.length} change${list.length > 1 ? "s" : ""}</h2>
      <ul class="changes">${list.map((c) => h`<li><span class="k">${c.kind}</span> ${c.title}</li>`)}</ul>
      <label>What changed, in one line<input id="note" maxlength="120" placeholder="e.g. New mess timings for December"></label>
      <p class="error" id="perr"></p>
      <p class="buttons"><button type="button" data-close>Not yet</button><button type="button" class="primary" id="go">Publish</button></p>`[RAW], (d) => {
      $("#note", d).focus();
      $("#go", d).onclick = async () => {
        const note = $("#note", d).value.trim();
        if (!note) { $("#perr", d).textContent = "Write a short note first; it's how the history tells versions apart."; return; }
        $("#go", d).disabled = true;
        $("#go", d).textContent = "Publishing…";
        try {
          await backend.publish(note);
          d.innerHTML = h`<h2>Published</h2><p>${backend.kind === "practice"
            ? "Your practice copy now counts this as live. Preview shows it."
            : "Students see it within a few minutes, as soon as GitHub Pages refreshes the site."}</p>
            <p class="buttons"><button type="button" class="primary" data-close>Done</button></p>`[RAW];
          await load(openSlug);
        } catch (e) {
          $("#perr", d).textContent = e.message;
          $("#go", d).disabled = false;
          $("#go", d).textContent = "Publish";
          if (e.status === 401) reloginDialog(e.message);
        }
      };
    });
  }

  async function historyDialog() {
    let items = [];
    try { items = await backend.history(); } catch (e) { return alert(e.message); }
    dialog(h`
      <h2>Published versions</h2>
      ${items.length ? "" : raw(`<p class="muted">Nothing published from the admin yet.</p>`)}
      <ul class="history">${items.map((x, i) => h`<li><span class="when">${niceTime(x.date)}</span> <span class="by">${x.by}</span>
        <span class="what">${x.kind === "rollback" ? "Rolled back " : ""}${x.note}</span>
        ${x.kind === "publish" && i > 0 && x.canRoll !== false ? h`<button type="button" class="link" data-sha="${x.sha}">Go back to this version</button>` : ""}
        ${i === 0 ? raw(`<span class="now">live now</span>`) : ""}</li>`)}</ul>
      <p class="buttons"><button type="button" data-close>Close</button></p>`[RAW], (d) => {
      d.onclick = async (e) => {
        const b = e.target.closest("[data-sha]");
        if (!b) return;
        if (!confirm("Put this version back on the site? Unpublished edits in the draft are cleared too.")) return;
        b.disabled = true;
        b.textContent = "Going back…";
        try {
          await backend.rollback(b.dataset.sha);
          d.close();
          pending.clear();
          persistPending();
          await load();
          alert(backend.kind === "practice" ? "Done. The practice copy is back to that version." : "Done. The site shows that version within a few minutes.");
        } catch (err) { alert(err.message); b.disabled = false; }
      };
    });
  }

  async function adminsDialog() {
    let data;
    try { data = await backend.admins(); } catch (e) { return alert(e.message); }
    const practice = data.practice;
    dialog(h`
      <h2>Admins</h2>
      ${practice ? raw(`<p class="muted">The practice copy has no admin list. On the real admin page the owner adds seniors by their Google email; only a keyed hash of the email is stored, never the address.</p>`)
        : h`<p class="muted">Everyone here can edit and publish. Their label shows next to their edits; the email itself is never stored.</p>
        <ul class="admins" id="alist">${data.admins.map((a) => h`<li><span>${a.label}</span><span class="muted small">added ${a.added}</span>
          <button type="button" class="link" data-key="${a.key}">Remove</button></li>`)}</ul>
        <h3>Add a senior</h3>
        <label>Their Google email<input id="a-email" type="email" autocomplete="off"></label>
        <label>Label shown next to their edits<input id="a-label" maxlength="40" placeholder="e.g. Hostel senior, 4th year"></label>
        <p class="error" id="aerr"></p>
        <p><button type="button" class="primary" id="a-add">Add</button></p>`}
      <p class="buttons"><button type="button" data-close>Close</button></p>`[RAW], (d) => {
      if (practice) return;
      $("#a-add", d).onclick = async () => {
        try {
          await backend.addAdmin($("#a-email", d).value, $("#a-label", d).value);
          d.close();
          adminsDialog();
        } catch (e) { $("#aerr", d).textContent = e.message; }
      };
      $("#alist", d).onclick = async (e) => {
        const b = e.target.closest("[data-key]");
        if (!b || !confirm("Remove this admin? They lose access within a minute.")) return;
        try { await backend.removeAdmin(b.dataset.key); d.close(); adminsDialog(); } catch (err) { alert(err.message); }
      };
    });
  }

  async function editsDialog() {
    let edits = S.edits;
    try { edits = (await backend.state()).edits; } catch (e) { /* use what we have */ }
    dialog(h`
      <h2>Recent edits, not published yet</h2>
      ${edits.length ? "" : raw(`<p class="muted">None. Everything in the draft is live.</p>`)}
      <ul class="history">${edits.map((x) => h`<li><span class="when">${niceTime(x.date)}</span> <span class="by">${x.by}</span> <span class="what">${x.message}</span></li>`)}</ul>
      <p class="buttons"><button type="button" data-close>Close</button></p>`[RAW]);
  }

  async function discardChanges() {
    if (!changed.size) return alert("There's nothing unpublished to discard.");
    if (!confirm(`Throw away ${changed.size} unpublished change${changed.size > 1 ? "s" : ""}? The draft goes back to what students see now.`)) return;
    try {
      pending.clear();
      persistPending();
      await backend.discard();
      openSlug = null;
      await load();
    } catch (e) { alert(e.message); }
  }

  function signOut() {
    if (pending.size && !confirm("Some edits haven't saved yet. Sign out anyway?")) return;
    backend.logout();
    pending.clear();
    S = null;
    backend = null;
    signInScreen();
  }

  function reloginDialog(message) {
    if ($("#relogin")) return;
    const d = dialog(h`<h2>Sign in again</h2><p>${message || "Your sign-in ran out."} Your edits are kept on this device and save as soon as you're back.</p>
      <div id="gbtn2" class="gbtn"></div>
      ${LOCAL ? raw(`<p class="local"><button type="button" data-local="local-owner">Local sign-in: owner</button></p>`) : ""}
      <p class="error" id="relogin-err"></p>`[RAW]);
    d.id = "relogin";
    googleButton($("#gbtn2", d));
    $$("[data-local]", d).forEach((b) => { b.onclick = () => signIn(b.dataset.local).then(() => d.close()); });
  }

  function conflictDialog(path, mine, data) {
    const theirs = data.current;
    const text = (x) => !x ? "" : path === SITE_PATH ? JSON.stringify(x, null, 2) : [x.title, x.summary, ...(x.posts || []).map((p) => p.md)].join("\n\n");
    if (theirs === null || theirs === undefined) delete S.shas[path]; else S.shas[path] = data.current_sha;
    applyLocal(path, theirs === undefined ? null : theirs);
    const slug = (path.match(/^content\/topics\/(.+)\.json$/) || [])[1];
    dialog(h`
      <h2>Someone else changed this</h2>
      <p>${slug ? `“${(theirs || mine || {}).title || slug}”` : "The home page settings"} changed while you were editing. Their version is saved and is now on screen.
      Here's yours, so nothing is lost: copy what you need back in.</p>
      <textarea class="mine" rows="10" readonly>${text(mine)}</textarea>
      <p class="buttons"><button type="button" class="primary" data-close>Got it</button></p>`[RAW]);
    drawList();
    if (openSlug === slug && slug) { if (S.topics[slug]) open(slug); else { openSlug = null; $("#editor").innerHTML = `<div class="empty"><p>This topic was deleted by someone else.</p></div>`; } }
    if (!slug && openSlug === "") homeEditor();
  }

  // ---------- start ----------
  async function start() {
    const remote = new Remote();
    if (remote.session && CONFIG.API) {
      backend = remote;
      return load();
    }
    signInScreen();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
