/* Campus Info search. Runs in the browser and in Node, so the checks in evals/ test exactly what students use.

   How it ranks: every word in a topic is weighted by where it sits (title, tags, summary, headings, body,
   files). A query word can match exactly, as a word student-speak maps to, as the start of a longer word,
   or with a typo. Rare words count for more than common ones.

   How it decides "Nothing on this yet": the best topic has to account for most of what was asked,
   weighted by how rare each word is. A topic that only shares one common word doesn't count. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CampusSearch = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Words that carry no meaning in a search box (English, plus Hindi words students type in English letters).
  const STOP = new Set((
    "a an the is are am was were be been being to of in on at for from with by and or if as it its this that " +
    "these those there here what how where when which who whom why do does did done i me my mine we our you " +
    "your can could should would will shall may might get got about any some please pls plz need want tell " +
    "know also than then so not no yes just like into onto out up down over under after before near via " +
    "one someone something anyone anything thing things way ways best good there's what's i'm it's " +
    "kya hai hain kaise kese kaisa kaisi kab kaha kahan kidhar ka ki ke ko se me mein mai main hu hoon ho " +
    "pe par karu kare karein karna karo kar chahiye abhi bhi aur ya nahi nhi toh to kuch kaun kon kyu kyun " +
    "batao bata bhai bro yaar wala wali hota hoti hote"
  ).split(/\s+/));

  // What students type, and the words the content uses for it. Every entry is explained in evals/CHANGES.md.
  // The third value is how much a match counts. Emergencies count most: when someone types "fainted",
  // the ambulance number beats every other topic that shares a word with the query.
  const SYNONYM_LIST = [
    ["faint fainted fainting unconscious collapsed collapse", "ambulance emergency hospital", 1.6],
    ["accident injured injury bleeding fracture burn burnt", "ambulance emergency hospital", 1.6],
    ["suicide suicidal selfharm", "counselling helpline wellness emergency", 1.6],
    ["panic anxiety anxious stressed depressed depression lonely homesick", "counselling wellness mental"],
    ["harass harassing harassed harassment stalking stalker", "harassment posh ccash"],
    ["khana bhojan", "food"],
    ["bimar beemar", "sick unwell"],
    ["eat eating hungry", "food restaurant cafe"],
    ["friend friends guest", "visitor"],
    ["prof", "professor"],
    ["sem", "semester"],
    ["hrs", "hours timings"],
  ];
  // Whole phrases that mean something their words don't.
  const PHRASES = [
    ["talk to someone", "counselling"],
    ["someone to talk", "counselling"],
    ["panic attack", "anxiety counselling"],
    ["passed out", "ambulance emergency"],
    ["self harm", "counselling emergency"],
  ];
  // Words that mean someone may need help now. A search with one of these, or with a phrase above, is never told
  // "Nothing on this yet": its best match is shown as the answer, with its Call button. At 2 a.m. a wrong
  // "nothing here" costs far more than one extra number on screen. Ranking doesn't change. See evals/CHANGES.md.
  const URGENT = new Set((
    "faint fainted fainting unconscious collapsed collapse accident injured injury bleeding fracture burn burnt " +
    "suicide suicidal selfharm panic anxiety anxious stressed depressed depression lonely homesick " +
    "harass harassing harassed harassment stalking stalker ambulance emergency doctor fever"
  ).split(" ").map(stem));

  const FIELD = { title: 8, tags: 5, summary: 3.5, headings: 2.5, group: 1.2, files: 1.5, body: 1, linked: 0.5, filetext: 0.4 };
  const STRONG = new Set(["title", "tags", "summary", "headings", "group"]);
  const COVERED_AT = 0.6;

  // ---------- words ----------
  function norm(s) {
    return String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
      .replace(/&/g, " and ").replace(/×/g, "x").replace(/[’‘]/g, "'");
  }

  function stem(w) {
    if (w.length <= 3 || /\d/.test(w)) return w;
    if (w.endsWith("ies") && w.length > 4) w = w.slice(0, -3) + "y";
    else if (/(ss|sh|ch|x|z)es$/.test(w)) w = w.slice(0, -2);
    else if (w.endsWith("s") && !/(ss|us|is)$/.test(w)) w = w.slice(0, -1);
    if (w.endsWith("ing") && w.length - 3 >= 4) w = w.slice(0, -3);
    else if (w.endsWith("ed") && w.length - 2 >= 4) w = w.slice(0, -2);
    return w;
  }

  // "wi-fi" gives wifi, wi, fi; "b.tech" gives btech; "2am" gives 2, am.
  function words(s) {
    const out = [];
    for (const raw of norm(s).split(/[^a-z0-9.\-+']+/)) {
      if (!raw) continue;
      const parts = raw.split(/[.\-+']+/).filter(Boolean);
      if (parts.length > 1) out.push(parts.join(""));
      for (const p of parts) {
        const m = p.match(/^(\d+)(am|pm|hrs?|x\d+)$/);
        if (m) out.push(m[1], m[2]);
        else out.push(p);
      }
    }
    return out.filter((w) => w.length > 1 || /\d/.test(w));
  }

  const terms = (s) => words(s).map(stem);

  const SYNONYMS = {};
  for (const [from, to, weight] of SYNONYM_LIST) {
    for (const w of from.split(" ")) SYNONYMS[stem(w)] = { to: to.split(" "), weight: weight || 0.85 };
  }

  // ---------- index ----------
  function buildIndex(content, extra) {
    extra = extra || {};
    const groupTitle = Object.fromEntries((content.groups || []).map((g) => [g.slug, g.title]));
    const docs = [];
    const postings = new Map(); // term -> Map(doc -> {w, field})
    const add = (doc, field, text) => {
      const w = FIELD[field];
      for (const t of terms(text)) {
        let m = postings.get(t);
        if (!m) postings.set(t, (m = new Map()));
        const cur = m.get(doc);
        if (!cur) m.set(doc, { w, field, n: 1 });
        else { cur.n++; if (w > cur.w) { cur.w = w; cur.field = field; } }
      }
    };
    content.topics.forEach((t, i) => {
      const headings = [];
      const body = [];
      for (const p of t.posts) {
        for (const line of String(p.md).split("\n")) {
          if (/^#{1,6}\s/.test(line)) headings.push(line.replace(/^#+\s*/, ""));
          else body.push(line);
        }
      }
      const fileNames = [];
      const fileText = [];
      for (const p of t.posts) for (const id of p.files || []) {
        const f = content.files[id];
        if (!f) continue;
        fileNames.push({ id, name: f.name });
        if (extra.files && extra.files[id]) fileText.push({ id, name: f.name, text: extra.files[id] });
      }
      const doc = {
        slug: t.slug, title: t.title, summary: t.summary, group: t.group, groupTitle: groupTitle[t.group] || "",
        tags: t.tags || [], body: plain(body.join("\n")), headings, fileNames, fileText,
        linked: (extra.linked && extra.linked[t.slug]) || "",
        titleTerms: terms(t.title).join(" "), tagTerms: (t.tags || []).map((x) => terms(x).join(" ")),
      };
      docs.push(doc);
      add(i, "title", t.title);
      add(i, "tags", doc.tags.join(" , "));
      add(i, "summary", t.summary);
      add(i, "headings", headings.join(" "));
      add(i, "group", doc.groupTitle);
      add(i, "body", doc.body);
      add(i, "files", fileNames.map((f) => f.name.replace(/\.[a-z0-9]+$/i, "")).join(" "));
      add(i, "linked", doc.linked);
      for (const f of fileText) add(i, "filetext", f.text);
    });
    const N = docs.length;
    const idf = new Map();
    for (const [t, m] of postings) idf.set(t, Math.log(1 + N / m.size));
    const byFirst = new Map();
    for (const t of postings.keys()) {
      const k = t[0];
      if (!byFirst.has(k)) byFirst.set(k, []);
      byFirst.get(k).push(t);
    }
    return { docs, postings, idf, byFirst, N, unknownIdf: Math.log(1 + N) };
  }

  function plain(md) {
    return String(md).replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/https?:\/\/\S+/g, " ").replace(/[*_`>|#]/g, " ");
  }

  // ---------- matching one query word ----------
  function editDistance(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      let rowMin = Infinity;
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        rowMin = Math.min(rowMin, d[i][j]);
      }
      if (rowMin > max) return max + 1;
    }
    return d[a.length][b.length];
  }

  // Every index term a query word can stand for, with how sure we are (1 = exact).
  function expand(index, q) {
    const found = new Map();
    const put = (t, quality) => {
      if (index.postings.has(t) && (found.get(t) || 0) < quality) found.set(t, quality);
    };
    put(q, 1);
    const exact = found.has(q);
    const syn = SYNONYMS[q];
    if (syn) for (const s of syn.to) for (const t of terms(s)) put(t, syn.weight);
    const pool = index.byFirst.get(q[0]) || [];
    if (q.length >= 4 && !/^\d+$/.test(q)) {
      for (const t of pool) {
        // Longer words that start with this one ("prof" → "professor"), but not when the word is already a word
        // of its own here: "places" shouldn't drift into "placements".
        if (t.length > q.length && t.startsWith(q) && (!exact || q.length <= 4)) put(t, 0.8);
        else if (t.length >= 4 && t.length < q.length && q.startsWith(t) && t.length / q.length >= 0.75) put(t, 0.7);
      }
      const max = q.length >= 8 ? 2 : q.length >= 5 ? 1 : q.length === 4 ? 1 : 0;
      if (max && !found.has(q)) {
        for (const t of pool) {
          if (Math.abs(t.length - q.length) > max || found.has(t)) continue;
          const dist = editDistance(q, t, max);
          if (dist <= max) put(t, dist === 1 ? 0.65 : 0.5);
        }
      }
    }
    return found;
  }

  // ---------- search ----------
  function search(index, query, opts) {
    opts = opts || {};
    let q0 = norm(query);
    let urgent = false;
    for (const [phrase, means] of PHRASES) if (q0.includes(phrase)) { q0 += " " + means; urgent = true; }
    const raw = words(q0);
    if (raw.some((w) => URGENT.has(stem(w)))) urgent = true;
    let qs = raw.filter((w) => !STOP.has(w)).map(stem);
    if (!qs.length) qs = raw.map(stem); // a query made only of small words: use them anyway
    qs = [...new Set(qs)];
    if (!qs.length) return { query, words: [], results: [], mentions: [], covered: false, urgent: false };

    const per = qs.map((q) => ({ q, terms: expand(index, q) }));
    // A word that matches nothing at all is as informative as the rarest word there is.
    for (const p of per) {
      let best = 0;
      for (const t of p.terms.keys()) best = Math.max(best, index.idf.get(t));
      p.idf = p.terms.size ? best : index.unknownIdf;
    }
    const totalIdf = per.reduce((s, p) => s + p.idf, 0);

    const scores = new Map();
    for (const [pi, p] of per.entries()) {
      for (const [t, quality] of p.terms) {
        const idf = index.idf.get(t);
        for (const [doc, hit] of index.postings.get(t)) {
          const val = quality * idf * (hit.w + 0.15 * Math.log(1 + hit.n));
          let s = scores.get(doc);
          if (!s) scores.set(doc, (s = { score: 0, best: [], strong: false, matched: new Set() }));
          const prev = s.best[pi];
          if (!prev || val > prev.val) s.best[pi] = { val, field: hit.field, term: t, urgent: quality >= 1.5 };
        }
      }
    }

    const out = [];
    for (const [doc, s] of scores) {
      let score = 0;
      let cov = 0;
      let strong = false;
      let deepOnly = true;
      let urgent = false;
      s.best.forEach((b, pi) => {
        if (!b) return;
        score += b.val;
        if (b.urgent && STRONG.has(b.field)) urgent = true;
        s.matched.add(b.term);
        if (b.field !== "filetext" && b.field !== "linked") { cov += per[pi].idf; deepOnly = false; }
        if (STRONG.has(b.field)) strong = true;
      });
      const d = index.docs[doc];
      // Words next to each other in the query and in the title or a tag: "sick food", "mess coupon".
      const phrase = qs.length > 1 && qs.some((q, i) => i > 0 &&
        (` ${d.titleTerms} `.includes(` ${qs[i - 1]} ${q} `) || d.tagTerms.some((tg) => ` ${tg} `.includes(` ${qs[i - 1]} ${q} `))));
      if (phrase) score *= 1.25;
      const coverage = totalIdf ? cov / totalIdf : 0;
      score *= 0.4 + coverage;
      if (urgent) score *= 3;   // safety first: an emergency word puts the emergency topics on top
      out.push({ doc, slug: d.slug, score, coverage, strong: strong && !deepOnly, matched: [...s.matched] });
    }
    out.sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug));

    const results = out.filter((r) => r.strong).slice(0, opts.limit || 20);
    const mentions = out.filter((r) => !r.strong).slice(0, opts.mentions || 10);
    const top = results[0];
    const covered = !!top && (top.coverage >= COVERED_AT || urgent);
    // Highlight every form a query word matched ("change" also marks "changing").
    const allTerms = [...new Set(per.flatMap((p) => [...p.terms.keys()]))];
    for (const r of [...results, ...mentions]) {
      r.snippet = snippet(index.docs[r.doc], r.matched);
      r.matched = allTerms;
    }
    return { query, words: qs, results, mentions, covered, urgent };
  }

  // ---------- showing why something matched ----------
  function snippet(doc, matched) {
    const want = new Set(matched);
    const hitIn = (text) => terms(text).some((t) => want.has(t));
    if (hitIn(doc.title) || hitIn(doc.summary)) return null;
    const sources = [{ from: "", text: doc.body }, { from: "", text: doc.linked }]
      .concat(doc.fileText.map((f) => ({ from: f.name, text: f.text })));
    for (const src of sources) {
      const sentences = String(src.text).split(/(?<=[.!?])\s+|\n+/);
      for (const s of sentences) {
        if (s.length > 6 && hitIn(s)) {
          let text = s.replace(/\s+/g, " ").trim();
          if (text.length > 170) {
            // Centre the snippet on the first word that matched.
            let at = 0;
            for (const m of text.matchAll(/[A-Za-z0-9À-ɏ][A-Za-z0-9À-ɏ'’.-]*/g)) {
              if (terms(m[0]).some((t) => want.has(t))) { at = m.index; break; }
            }
            let start = Math.max(0, at - 60);
            if (start) start = text.indexOf(" ", start) + 1 || start;
            const cut = text.slice(start, start + 160);
            text = (start ? "…" : "") + cut.slice(0, cut.lastIndexOf(" ") > 120 ? cut.lastIndexOf(" ") : cut.length).trim() + "…";
          }
          return { text, from: src.from };
        }
      }
    }
    return null;
  }

  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  // Wraps the words that matched in <mark>, like a highlighter on a printout.
  function highlight(text, matched) {
    const want = new Set(matched || []);
    if (!want.size) return esc(text);
    return String(text).split(/([A-Za-z0-9À-ɏ][A-Za-z0-9À-ɏ'’.-]*)/).map((part, i) => {
      if (i % 2 === 0) return esc(part);
      const ws = words(part).map(stem);
      return ws.some((w) => want.has(w)) ? `<mark>${esc(part)}</mark>` : esc(part);
    }).join("");
  }

  return { buildIndex, search, highlight, words, terms, stem, SYNONYMS, STOP, COVERED_AT };
});
