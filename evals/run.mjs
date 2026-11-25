// Campus Info checks. One command runs them all and prints a scorecard short enough to read on a phone.
//
//   node evals/run.mjs              content, search, privacy, freshness, links, size
//   node evals/run.mjs --online     also tries every outside link (slow)
//   node evals/run.mjs --admin      also runs the admin end-to-end check on throwaway GitHub branches
//   node evals/run.mjs --today=2026-11-25   pretend it's another day (for the freshness check)
//
// Full results go to evals/results/ (a JSON file per run, and latest.md).

import { readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { gzipSync } from "node:zlib";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = join(ROOT, "docs");
const args = process.argv.slice(2);
const ONLINE = args.includes("--online");
const ADMIN = args.includes("--admin");
const todayArg = args.find((a) => a.startsWith("--today="));
const TODAY = todayArg ? new Date(todayArg.slice(8) + "T12:00:00") : new Date();
const require = createRequire(import.meta.url);

const readJSON = (p) => JSON.parse(readFileSync(p, "utf8"));
const kb = (n) => `${Math.round(n / 1024)} KB`;
const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);

// ---------- what the app ships ----------
function loadBuilt() {
  const p = join(SITE, "data", "content.json");
  if (!existsSync(p)) return null;
  const content = readJSON(p);
  const sp = join(SITE, "data", "search.json");
  const extra = existsSync(sp) ? readJSON(sp) : {};
  return { content, extra };
}

function loadAppCode() {
  try {
    const search = require(join(SITE, "search.js"));
    const markdown = require(join(SITE, "markdown.js"));
    return { search, markdown };
  } catch (e) {
    return { error: e.code === "MODULE_NOT_FOUND" ? "the app isn't built yet" : e.message };
  }
}

function loadSource() {
  const topics = readdirSync(join(ROOT, "content", "topics"))
    .filter((f) => f.endsWith(".json"))
    .map((f) => readJSON(join(ROOT, "content", "topics", f)));
  const files = readdirSync(join(ROOT, "content", "files"))
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const meta = readJSON(join(ROOT, "content", "files", f));
      const txt = join(ROOT, "content", "files", f.replace(/\.json$/, ".txt"));
      return { ...meta, text: existsSync(txt) ? readFileSync(txt, "utf8") : "" };
    });
  const site = readJSON(join(ROOT, "content", "site.json"));
  return { topics, files, site };
}

// ---------- search checks ----------
function searchChecks(app, built) {
  const cases = (name) => readJSON(join(ROOT, "evals", "cases", `${name}.json`)).cases;
  const fail = (name, why) => ({ name, pass: false, summary: why, details: [] });
  if (app.error || !built) {
    const why = app.error || "no built data yet (docs/data/content.json)";
    return [fail("2 a.m. set", why), fail("Everyday search", why), fail("Nothing on this yet", why)];
  }
  const index = app.search.buildIndex(built.content, built.extra);
  const bySlug = Object.fromEntries(built.content.topics.map((t) => [t.slug, t]));
  const ranked = (q) => {
    const r = app.search.search(index, q);
    return { r, slugs: [...r.results, ...r.mentions].map((x) => x.slug) };
  };

  // The 2 a.m. set: right topic first, shown as the answer (not under "Nothing on this yet", which also hides
  // the Call button), and it has a number to tap. Until 26 Nov this only checked the order; see CHANGES.md.
  const urgent = cases("urgent").map((c) => {
    const { r, slugs } = ranked(c.q);
    const first = slugs[0];
    const phones = first ? app.markdown.contacts(bySlug[first].posts.map((p) => p.md).join("\n\n")).phones : [];
    const ok = c.expect.includes(first) && phones.length > 0 && r.covered;
    return { q: c.q, ok, first: first || "(nothing)", phones: phones.length, expect: c.expect, shown: r.covered };
  });
  const urgentOk = urgent.filter((x) => x.ok).length;

  // Everyday search: first and top three.
  const every = cases("everyday").map((c) => {
    const { r, slugs } = ranked(c.q);
    const pos = slugs.findIndex((s) => c.expect.includes(s));
    return { q: c.q, style: c.style, first: pos === 0, top3: pos >= 0 && pos < 3, got: slugs.slice(0, 3), expect: c.expect,
      hidden: pos === 0 && !r.covered };
  });
  // Right topic first, but the page still opens with "Nothing on this yet". Reported, not part of pass or fail.
  const hidden = every.filter((x) => x.hidden);
  const n = every.length;
  const first = every.filter((x) => x.first).length;
  const top3 = every.filter((x) => x.top3).length;
  const styles = {};
  for (const x of every) {
    styles[x.style] = styles[x.style] || { n: 0, first: 0 };
    styles[x.style].n++;
    if (x.first) styles[x.style].first++;
  }

  // Questions we don't cover: the app must say so.
  const nc = cases("not_covered").map((c) => {
    const { r, slugs } = ranked(c.q);
    return { q: c.q, ok: r.covered === false, shown: slugs.slice(0, 3), note: c.note };
  });
  const ncOk = nc.filter((x) => x.ok).length;

  // Fresh questions, written after the fixes and never tuned on. Reported, not pass or fail.
  const freshPath = join(ROOT, "evals", "cases", "fresh.json");
  const fresh = [];
  if (existsSync(freshPath)) {
    const f = readJSON(freshPath);
    let ok = 0, n2 = 0;
    const notes = [];
    for (const c of f.everyday) {
      const { slugs } = ranked(c.q);
      n2++;
      if (c.expect.includes(slugs[0])) ok++; else notes.push(`everyday "${c.q}" → ${slugs.slice(0, 3).join(", ") || "(nothing)"}`);
    }
    let uok = 0;
    for (const c of f.urgent) {
      const { r, slugs } = ranked(c.q);
      const first = slugs[0];
      const phones = first ? app.markdown.contacts(bySlug[first].posts.map((p) => p.md).join("\n\n")).phones : [];
      if (c.expect.includes(first) && phones.length && r.covered) uok++;
      else notes.push(`urgent "${c.q}" → ${first || "(nothing)"}${r.covered ? "" : ", under \"Nothing on this yet\""}`);
    }
    let nok = 0;
    for (const c of f.not_covered) {
      const { r, slugs } = ranked(c.q);
      if (r.covered === false) nok++; else notes.push(`not covered "${c.q}" was answered with ${slugs.slice(0, 2).join(", ")}`);
    }
    fresh.push({ name: "Fresh questions", pass: null,
      summary: `everyday ${ok}/${n2} first · urgent ${uok}/${f.urgent.length} · nothing-yet ${nok}/${f.not_covered.length}`, details: notes });
  }

  return [
    ...fresh,
    { name: "2 a.m. set", pass: urgentOk === urgent.length, summary: `${urgentOk}/${urgent.length}`,
      details: urgent.filter((x) => !x.ok).map((x) => `"${x.q}" → first: ${x.first} (${x.phones} numbers)${x.shown ? "" : ", under \"Nothing on this yet\""}, wanted ${x.expect.join(" or ")}`) },
    { name: "Everyday search", pass: first / n >= 0.8 && top3 / n >= 0.95,
      summary: `first ${pct(first, n)}% · top 3 ${pct(top3, n)}%` + (hidden.length ? ` · ${hidden.length} right but under "Nothing on this yet"` : ""),
      extra: { first, top3, n, styles, hidden: hidden.length },
      details: [
        ...every.filter((x) => !x.first).map((x) => `${x.top3 ? "top3" : "MISS"} "${x.q}" → ${x.got.join(", ") || "(nothing)"}; wanted ${x.expect.join(" or ")}`),
        ...hidden.map((x) => `right first, but under "Nothing on this yet": "${x.q}" → ${x.got[0]}`),
      ] },
    { name: "Nothing on this yet", pass: ncOk >= nc.length - 1, summary: `${ncOk}/${nc.length}`,
      details: nc.filter((x) => !x.ok).map((x) => `"${x.q}" was answered with ${x.shown.join(", ")}`) },
  ];
}

// ---------- privacy ----------
const MOBILE = /(?<![\d/])(?:\+?91[\s-]?)?([6-9]\d{4})[\s-]?(\d{5})(?![\d/])/g;
const ROLL_EMAIL = /\b[a-z]{2}\d{2}[a-z]\d{3}@(?:smail\.)?iitm\.ac\.in\b/gi;

function privacyCheck(src) {
  const allow = readJSON(join(ROOT, "evals", "privacy_allow.json"));
  const okNumber = (d) =>
    d in allow.numbers || d in allow.not_phone_numbers || Object.keys(allow.prefixes).some((p) => d.startsWith(p));
  // The names and numbers we removed are kept out of this public repo. Point CAMPUS_INFO_PRIVATE at the list.
  const privPath = process.env.CAMPUS_INFO_PRIVATE || join(ROOT, "..", "campus-info-private", "removed.json");
  const removed = existsSync(privPath) ? readJSON(privPath) : null;

  const texts = [];
  const add = (where, t) => t && texts.push([where, String(t)]);
  for (const t of src.topics) {
    add(`${t.slug}: title`, t.title);
    add(`${t.slug}: summary`, t.summary);
    add(`${t.slug}: tags`, (t.tags || []).join(" · "));
    (t.posts || []).forEach((p, i) => add(`${t.slug}: post ${i + 1}`, p.md));
    (t.search_text || []).forEach((s) => add(`${t.slug}: linked page`, s.title + "\n" + s.md));
  }
  for (const f of src.files) add(`file ${f.name}`, f.name + "\n" + (f.text || ""));
  add("site settings", JSON.stringify(src.site));
  for (const p of ["data/content.json", "data/search.json"]) {
    const full = join(SITE, p);
    if (existsSync(full)) add(p, readFileSync(full, "utf8"));
  }
  for (const f of existsSync(SITE) ? readdirSync(SITE) : []) {
    if (/\.(html|js|css|webmanifest)$/.test(f)) add(f, readFileSync(join(SITE, f), "utf8"));
  }

  const hits = [];
  for (const [where, t] of texts) {
    for (const m of t.matchAll(MOBILE)) {
      const d = m[1] + m[2];
      if (!okNumber(d)) hits.push(`${where}: mobile number ${m[0].trim()}`);
    }
    for (const m of t.matchAll(ROLL_EMAIL)) hits.push(`${where}: roll-number email ${m[0]}`);
    if (removed) {
      for (const name of removed.names) {
        if (new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(t)) hits.push(`${where}: a removed name`);
      }
      for (const line of t.split("\n")) {
        const digits = line.replace(/\D/g, "");
        for (const num of removed.numbers) if (digits.includes(num)) hits.push(`${where}: a removed number`);
      }
    }
  }
  const unique = [...new Set(hits)];
  return { name: "Privacy", pass: unique.length === 0, summary: `${unique.length} hits${removed ? "" : " (names list not found)"}`,
           details: unique.concat(removed ? [] : ["The private list of removed names wasn't found, so only numbers and emails were checked."]) };
}

// ---------- freshness ----------
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MON = "(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?";
const DATE_PATTERNS = [
  new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${MON}(?:,?\\s+(20\\d\\d))?`, "gi"),   // 30 September (2026)
  new RegExp(`\\b${MON}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+(20\\d\\d))?`, "gi"), // September 30, 2026
];
const DEADLINE = /\b(apply|applications?|deadline|last date|register|registrations?|submit|due|closes?|till|until|before|by|opens?|starts?|will be held|upcoming)\b/i;
const RECURRING = /\b(every|each|annually|usually|typically|generally|normally|per year|a year)\b/i;
const NOW_OPEN = /\b(now accepting|now open|registrations? (?:is|are) (?:now )?open|applications? (?:is|are) (?:now )?open|apply now|last chance)\b/i;

function freshnessCheck(src) {
  const flagged = [];
  const today = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());
  for (const t of src.topics) {
    const texts = [["summary", t.summary || ""], ...(t.posts || []).map((p, i) => [`post ${i + 1}`, p.md])];
    for (const [where, text] of texts) {
      for (const line of text.split("\n")) {
        if (NOW_OPEN.test(line)) flagged.push(`${t.slug} ${where}: "${line.trim().slice(0, 90)}"`);
        if (!DEADLINE.test(line) || RECURRING.test(line)) continue;
        for (const [k, rx] of DATE_PATTERNS.entries()) {
          for (const m of line.matchAll(rx)) {
            const day = Number(k === 0 ? m[1] : m[2]);
            const mon = MONTHS.indexOf((k === 0 ? m[2] : m[1]).slice(0, 3).toLowerCase());
            const year = m[3] ? Number(m[3]) : today.getFullYear();
            if (mon < 0 || day < 1 || day > 31) continue;
            const when = new Date(year, mon, day);
            if (when < today) flagged.push(`${t.slug} ${where}: "${line.trim().slice(0, 90)}"`);
          }
        }
      }
    }
  }
  const unique = [...new Set(flagged)];
  return { name: "Freshness", pass: unique.length === 0, summary: `${unique.length} stale`, details: unique };
}

// ---------- links and files ----------
async function linksCheck(built) {
  if (!built) return { name: "Links and files", pass: false, summary: "no built data yet", details: [] };
  const c = built.content;
  const slugs = new Set(c.topics.map((t) => t.slug));
  const broken = [];
  for (const s of c.new_here || []) if (!slugs.has(s)) broken.push(`"New here?" points to a missing topic: ${s}`);
  if (c.emergency_topic && !slugs.has(c.emergency_topic)) broken.push(`emergency list points to a missing topic`);
  const urls = new Set();
  for (const t of c.topics) {
    for (const r of t.related || []) if (!slugs.has(r)) broken.push(`${t.slug}: related topic missing: ${r}`);
    for (const p of t.posts) {
      for (const id of p.files || []) {
        const f = c.files[id];
        if (!f) broken.push(`${t.slug}: file ${id} isn't in the file list`);
        else if (!existsSync(join(SITE, f.path))) broken.push(`${t.slug}: file missing on disk: ${f.path}`);
      }
      for (const m of p.md.matchAll(/\]\(#\/topic\/([a-z0-9-]+)\)/g)) if (!slugs.has(m[1])) broken.push(`${t.slug}: link to missing topic ${m[1]}`);
      for (const m of p.md.matchAll(/https?:\/\/[^\s)<>"'`\]]+/g)) urls.add(m[0].replace(/[.,;:!?]+$/, ""));
    }
  }
  const details = [...broken];
  let unreachable = [];
  if (ONLINE) {
    unreachable = await checkOutside([...urls]);
    details.push(...unreachable.map((u) => `outside link didn't open from here: ${u}`));
  }
  const tail = ONLINE ? ` · ${unreachable.length}/${urls.size} outside links didn't open` : ` · ${urls.size} outside links (not tried)`;
  return { name: "Links and files", pass: broken.length === 0, summary: `${broken.length} broken${tail}`, details };
}

async function checkOutside(urls) {
  const bad = [];
  const one = async (u) => {
    for (const method of ["HEAD", "GET"]) {
      try {
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 12000);
        const r = await fetch(u, { method, redirect: "follow", signal: ctl.signal, headers: { "User-Agent": "Mozilla/5.0 (link check)" } });
        clearTimeout(timer);
        if (r.status < 400) return;
        if (method === "GET") bad.push(`${u} (${r.status})`);
      } catch (e) {
        if (method === "GET") bad.push(`${u} (${e.name === "AbortError" ? "timed out" : "no answer"})`);
      }
    }
  };
  const queue = [...urls];
  await Promise.all(Array.from({ length: 6 }, async () => { while (queue.length) await one(queue.shift()); }));
  return bad;
}

// ---------- slow network ----------
function networkCheck() {
  const html = join(SITE, "index.html");
  if (!existsSync(html)) return { name: "Slow network", pass: false, summary: "the app isn't built yet", details: [] };
  const page = readFileSync(html, "utf8");
  const gz = (rel) => (existsSync(join(SITE, rel)) ? gzipSync(readFileSync(join(SITE, rel))).length : NaN);
  const home = ["index.html", "data/content.json"];
  for (const m of page.matchAll(/<script[^>]+src="([^"]+)"/g)) home.push(m[1].replace(/^\.\//, "").split("?")[0]);
  for (const m of page.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)) home.push(m[1].replace(/^\.\//, "").split("?")[0]);
  const homeBytes = home.reduce((s, f) => s + gz(f), 0);

  const swPath = join(SITE, "service-worker.js");
  const details = [];
  let offline = [];
  if (existsSync(swPath)) {
    const sw = readFileSync(swPath, "utf8");
    const list = sw.match(/const OFFLINE = \[([\s\S]*?)\]/);
    if (list) offline = [...list[1].matchAll(/["']([^"']+)["']/g)].map((m) => m[1].replace(/^\.\//, "") || "index.html");
  }
  const offlineSet = new Set(offline.map((f) => (f === "" || f === "./" ? "index.html" : f)));
  const offlineBytes = [...offlineSet].reduce((s, f) => s + (gz(f) || 0), 0);
  for (const f of home) if (!offlineSet.has(f)) details.push(`not kept for offline use: ${f}`);
  if (!offlineSet.has("data/search.json")) details.push("search data isn't kept for offline use");
  if (Number.isNaN(homeBytes)) details.push("a file the home page needs is missing");
  const pass = homeBytes <= 150 * 1024 && offlineBytes <= 500 * 1024 && details.length === 0;
  return { name: "Slow network", pass, summary: `home ${kb(homeBytes)} · offline ${kb(offlineBytes)}`, details,
           extra: { home, offline: [...offlineSet] } };
}

// ---------- admin ----------
function adminCheck() {
  if (!ADMIN) return { name: "Admin end to end", pass: null, summary: "not run (add --admin)", details: [] };
  const py = process.platform === "win32" ? join(ROOT, ".venv", "Scripts", "python.exe") : join(ROOT, ".venv", "bin", "python");
  const out = spawnSync(existsSync(py) ? py : "python", ["-X", "utf8", join(ROOT, "evals", "admin_e2e.py"), "--json"], { encoding: "utf8", cwd: ROOT, timeout: 600000 });
  const lines = (out.stdout || "").trim().split("\n").filter((l) => l.startsWith("{"));
  const steps = lines.map((l) => JSON.parse(l));
  const ok = steps.filter((s) => s.ok).length;
  const details = steps.filter((s) => !s.ok).map((s) => `${s.step}: ${s.error}`);
  if (!steps.length) details.push((out.stderr || "no output").trim().split("\n").slice(-3).join(" "));
  return { name: "Admin end to end", pass: steps.length > 0 && ok === steps.length, summary: `${ok}/${steps.length} steps`, details,
           extra: { steps } };
}

// ---------- run ----------
const started = new Date();
const built = loadBuilt();
const app = loadAppCode();
const src = loadSource();
const results = [
  ...searchChecks(app, built),
  privacyCheck(src),
  freshnessCheck(src),
  await linksCheck(built),
  networkCheck(),
  adminCheck(),
];

const stamp = started.toISOString().replace(/[-:]/g, "").slice(0, 15);
const head = `Campus Info checks · ${started.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`;
console.log(head);
for (const r of results) {
  const mark = r.pass === null ? (r.name === "Fresh questions" ? "info" : "skip") : r.pass ? "PASS" : "FAIL";
  console.log(`${mark}  ${r.name.padEnd(20)} ${r.summary}`);
}
const failed = results.filter((r) => r.pass === false);
for (const r of [...failed, ...results.filter((x) => x.name === "Fresh questions")]) {
  if (!r.details.length) continue;
  console.log(`\n${r.name}:`);
  for (const d of r.details.slice(0, 12)) console.log(`  - ${d}`);
  if (r.details.length > 12) console.log(`  … ${r.details.length - 12} more in evals/results/latest.md`);
}

mkdirSync(join(ROOT, "evals", "results"), { recursive: true });
writeFileSync(join(ROOT, "evals", "results", `run-${stamp}.json`), JSON.stringify({ at: started.toISOString(), today: TODAY.toISOString().slice(0, 10), results }, null, 2) + "\n");
const md = [`# ${head}`, ""];
for (const r of results) {
  md.push(`## ${r.pass === null ? "skip" : r.pass ? "PASS" : "FAIL"} · ${r.name}: ${r.summary}`, "");
  if (r.extra && r.extra.styles) {
    md.push("| style | first | of |", "|---|---|---|");
    for (const [s, v] of Object.entries(r.extra.styles)) md.push(`| ${s} | ${v.first} | ${v.n} |`);
    md.push("");
  }
  for (const d of r.details) md.push(`- ${d}`);
  if (r.details.length) md.push("");
}
writeFileSync(join(ROOT, "evals", "results", "latest.md"), md.join("\n") + "\n");
process.exitCode = failed.length ? 1 : 0;
