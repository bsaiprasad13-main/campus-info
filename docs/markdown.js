/* Campus Info: turns the simple Markdown seniors write into HTML, and finds every phone number and email
   in a topic so the page can list them as tap-to-call and tap-to-mail. Works in the browser and in Node (evals). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CampusMarkdown = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const esc = (s) =>
    String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  // ---------- phone numbers ----------
  // Institute numbers are written many ways: +91 44 2257 8888, 044-2257 8330, 2257 8330, 94986 65021,
  // 1800-425-7878, and "2257 8888 / 8333" where the second number keeps the first one's prefix.
  const PHONE = new RegExp(
    [
      String.raw`\b1800[\s-]?\d{2,3}[\s-]?\d{4}\b`,                                  // toll-free
      String.raw`\+91[\s-]?(?:\(0\)\s?)?44[\s-]?\d{4}[\s-]?\d{4}\b`,                 // +91 44 2257 8888
      String.raw`\b0?44[\s-]\d{4}[\s-]?\d{4}\b|\b044\d{8}\b`,                        // 044 2257 8330
      String.raw`(?:\+91[\s-]?|\b0)?\b[6-9]\d{4}[\s-]?\d{5}\b`,                      // mobiles and helplines
      String.raw`\b2257[\s-]?\d{4}\b`,                                                // 2257 8330 (campus exchange)
      String.raw`\+91[\s-]?44[\s-]?\d{8}\b`,
    ].join("|"),
    "g"
  );
  const SHORTHAND = /^(\s*(?:\/|or|to|,)\s*)(\d{4})\b/; // "/ 8333" or "to 8524" after a full number

  function telOf(raw) {
    let d = raw.replace(/\D/g, "");
    if (d.startsWith("1800")) return d;
    if (d.startsWith("91") && d.length === 12) return "+" + d;
    if (d.startsWith("0") && d.length === 11) d = d.slice(1);
    if (d.length === 10) return "+91" + d;
    if (d.length === 8) return "+9144" + d;
    return "+" + d;
  }

  // Finds numbers in plain text. Returns [{start, end, text, tel}] including the "/ 8333" kind.
  function findPhones(text) {
    const out = [];
    PHONE.lastIndex = 0;
    let m;
    while ((m = PHONE.exec(text))) {
      const before = text.slice(Math.max(0, m.index - 3), m.index);
      if (/[\w/=.-]$/.test(before) && !/\s$/.test(before) && !/\+$/.test(before)) continue; // inside an id or a link
      const tel = telOf(m[0]);
      out.push({ start: m.index, end: m.index + m[0].length, text: m[0], tel });
      let end = m.index + m[0].length;
      let s;
      while ((s = SHORTHAND.exec(text.slice(end)))) {
        const start = end + s[1].length;
        out.push({ start, end: start + 4, text: s[2], tel: tel.slice(0, -4) + s[2] });
        end = start + 4;
      }
      PHONE.lastIndex = end;
    }
    return out;
  }

  const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
  const URL_RX = /\bhttps?:\/\/[^\s<>"'`]+[^\s<>"'`.,;:!?)\]]/g;

  // ---------- inline ----------
  function inline(src) {
    const slots = [];
    const keep = (html) => `\u0000${slots.push(html) - 1}\u0000`;
    let s = String(src);

    s = s.replace(/`([^`]+)`/g, (_, code) => keep(`<code>${linkifyPlain(esc(code), true)}</code>`));
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, url) =>
      safeUrl(url) ? keep(`<img src="${esc(url)}" alt="${esc(alt)}" loading="lazy">`) : _);
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_, text, url) => {
      if (!safeUrl(url)) return _;
      return keep(anchor(url, inlineText(text)));
    });
    s = s.replace(URL_RX, (url) => keep(anchor(url, esc(prettyUrl(url)))));
    s = s.replace(EMAIL, (mail) => keep(`<a href="mailto:${esc(mail)}" data-contact="mail">${esc(mail)}</a>`));
    s = esc(s);
    s = linkifyPlain(s, false);
    s = emphasis(s);
    return s.replace(/\u0000(\d+)\u0000/g, (_, i) => slots[Number(i)]);
  }

  function inlineText(text) {
    return emphasis(esc(text));
  }

  function emphasis(s) {
    return s
      .replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>")
      .replace(/__([^_]+?)__/g, "<strong>$1</strong>")
      .replace(/(^|[^\w*])\*([^*\s][^*]*?)\*(?!\w)/g, "$1<em>$2</em>")
      .replace(/(^|[^\w])_([^_\s][^_]*?)_(?!\w)/g, "$1<em>$2</em>")
      .replace(/~~([^~]+)~~/g, "<del>$1</del>");
  }

  // Phone numbers in already-escaped text become tap-to-call links.
  function linkifyPlain(html, inCode) {
    const found = findPhones(html);
    if (!found.length) return html;
    let out = "";
    let at = 0;
    for (const f of found) {
      out += html.slice(at, f.start);
      out += `<a href="tel:${f.tel}" data-contact="call"${inCode ? "" : ' class="tel"'}>${html.slice(f.start, f.end)}</a>`;
      at = f.end;
    }
    return out + html.slice(at);
  }

  function prettyUrl(url) {
    const u = url.replace(/^https?:\/\/(www\.)?/, "");
    return u.length > 48 ? u.slice(0, 45) + "…" : u;
  }

  function safeUrl(url) {
    return /^(https?:|mailto:|tel:|#\/|\.\/|files\/)/i.test(url);
  }

  function anchor(url, html) {
    if (/^#\//.test(url)) return `<a href="${esc(url)}">${html}</a>`;
    if (/^mailto:/i.test(url)) return `<a href="${esc(url)}" data-contact="mail">${html}</a>`;
    if (/^tel:/i.test(url)) return `<a href="${esc(url)}" data-contact="call">${html}</a>`;
    return `<a href="${esc(url)}" target="_blank" rel="noopener">${html}</a>`;
  }

  // ---------- blocks ----------
  const LIST_ITEM = /^(\s*)([-*+]|\d{1,3}[.)])\s+(.*)$/;
  const TABLE_RULE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

  function render(md) {
    const lines = String(md || "").replace(/\r\n?/g, "\n").split("\n");
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) { i++; continue; }

      const fence = line.match(/^\s*```\s*([\w-]*)\s*$/);
      if (fence) {
        const body = [];
        i++;
        while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) body.push(lines[i++]);
        i++;
        out.push(`<pre><code>${linkifyPlain(esc(body.join("\n")), true)}</code></pre>`);
        continue;
      }
      const h = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
      if (h) {
        const level = Math.min(4, Math.max(2, h[1].length === 1 ? 2 : h[1].length));
        out.push(`<h${level}>${inline(h[2])}</h${level}>`);
        i++;
        continue;
      }
      if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { out.push("<hr>"); i++; continue; }
      if (line.includes("|") && i + 1 < lines.length && TABLE_RULE.test(lines[i + 1])) {
        const head = cells(line);
        i += 2;
        const rows = [];
        while (i < lines.length && lines[i].includes("|") && lines[i].trim()) rows.push(cells(lines[i++]));
        out.push(
          `<div class="table"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead>` +
          `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`
        );
        continue;
      }
      if (/^\s*>/.test(line)) {
        const body = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) body.push(lines[i++].replace(/^\s*>\s?/, ""));
        out.push(`<blockquote>${render(body.join("\n"))}</blockquote>`);
        continue;
      }
      if (LIST_ITEM.test(line)) {
        const block = [];
        while (i < lines.length && (LIST_ITEM.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && block.length))) block.push(lines[i++]);
        out.push(list(block));
        continue;
      }
      const para = [];
      while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i], lines[i + 1])) para.push(lines[i++].trim());
      if (!para.length) para.push(lines[i++].trim());
      out.push(`<p>${para.map(inline).join("<br>")}</p>`);
    }
    return out.join("\n");
  }

  function isBlockStart(line, next) {
    return /^\s*```/.test(line) || /^#{1,6}\s/.test(line) || LIST_ITEM.test(line) || /^\s*>/.test(line) ||
      /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line) || (line.includes("|") && next !== undefined && TABLE_RULE.test(next));
  }

  function cells(row) {
    return row.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
  }

  function list(block) {
    // Nested lists by indentation: an item indented further than the one before starts a sub-list.
    const items = [];
    for (const raw of block) {
      const m = raw.match(LIST_ITEM);
      if (m) items.push({ indent: m[1].replace(/\t/g, "  ").length, ordered: /\d/.test(m[2]), text: m[3], kids: [] });
      else if (items.length) items[items.length - 1].text += "\n" + raw.trim();
    }
    const rootList = { indent: -1, kids: [] };
    const stack = [rootList];
    for (const it of items) {
      while (stack.length > 1 && it.indent <= stack[stack.length - 1].indent) stack.pop();
      stack[stack.length - 1].kids.push(it);
      stack.push(it);
    }
    const html = (nodes) => {
      if (!nodes.length) return "";
      const tag = nodes[0].ordered ? "ol" : "ul";
      return `<${tag}>${nodes.map((n) => `<li>${n.text.split("\n").map(inline).join("<br>")}${html(n.kids)}</li>`).join("")}</${tag}>`;
    };
    return html(rootList.kids);
  }

  // ---------- contacts ----------
  // Every phone number and email in a topic, with the label it sits next to ("Ambulance", "Hostel office").
  function contacts(md) {
    const phones = [];
    const emails = [];
    const seenTel = new Set();
    const seenMail = new Set();
    let heading = "";
    for (const rawLine of String(md || "").split("\n")) {
      const hm = rawLine.match(/^#{1,6}\s+(.*)$/);
      if (hm) { heading = plain(hm[1]); continue; }
      const line = rawLine.replace(/\[([^\]]+)\]\((mailto:|tel:)[^)]+\)/g, "$1");
      const label = labelOf(line) || heading;
      const noUrls = line.replace(URL_RX, (u) => " ".repeat(u.length));
      for (const f of findPhones(noUrls)) {
        if (seenTel.has(f.tel)) continue;
        seenTel.add(f.tel);
        phones.push({ label, display: displayOf(f), tel: f.tel });
      }
      for (const m of noUrls.matchAll(EMAIL)) {
        const mail = m[0].toLowerCase();
        if (seenMail.has(mail)) continue;
        seenMail.add(mail);
        emails.push({ label, email: m[0] });
      }
    }
    return { phones, emails };
  }

  function displayOf(f) {
    if (f.text.length === 4) {
      const d = f.tel.replace(/\D/g, "");
      return d.length === 12 ? `0${d.slice(2, 4)} ${d.slice(4, 8)} ${d.slice(8)}` : f.tel;
    }
    return f.text.trim();
  }

  function plain(s) {
    return String(s).replace(/[*_`#>]/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\s+/g, " ").trim();
  }

  function labelOf(line) {
    const bold = line.match(/^\s*(?:[-*+]\s+|\d+[.)]\s+)?\*\*([^*]{2,60}?)\*\*\s*[:–-]?/);
    if (bold) {
      const t = plain(bold[1]).replace(/[:–-]\s*$/, "").trim();
      if (!/^(phone|call|email|e-mail|mail|contact|mobile|tel|landline|whatsapp|helpline)s?$/i.test(t)) return t;
    }
    const colon = line.match(/^\s*(?:[-*+]\s+|\d+[.)]\s+)?([^:|]{2,48}?):\s*\S/);
    if (colon && !/https?$/i.test(colon[1])) {
      const t = plain(colon[1]);
      if (!/^(phone|call|email|e-mail|mail|contact|mobile|tel|landline|whatsapp|helpline|note|tip)s?$/i.test(t) && !/\d{4}/.test(t)) return t;
    }
    return "";
  }

  // Plain text of a post, for search snippets.
  function text(md) {
    return String(md || "")
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^\s*[-*+]\s+/gm, "")
      .replace(/[*_`>|]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  return { render, contacts, text, esc, findPhones };
});
