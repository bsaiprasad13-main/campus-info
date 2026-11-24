"""Turn the editable content (content/) into the two files the website reads (docs/data/).

Used in two places: by the admin server every time someone publishes, and by tools/build.py on a laptop.
Nothing here touches the network or the disk; it takes plain dicts and returns plain dicts.
"""

import re
import unicodedata
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

IST = timezone(timedelta(hours=5, minutes=30))


def today_ist():
    return datetime.now(IST).date().isoformat()


def sort_key(title):
    """A-to-Z order the way a reader expects it: case and accents ignored, punctuation skipped."""
    t = unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9 ]+", "", t).strip()


def squash(text):
    """Text pulled out of PDFs often has one word per line, page markers and s p a c e d letters.
    Search only needs the words."""
    t = re.sub(r"-{2,}\s*page\s*\d+\s*-{2,}", " ", text or "", flags=re.I)
    t = re.sub(r"\b(?:[A-Za-z] ){3,}[A-Za-z]\b", lambda m: m.group(0).replace(" ", ""), t)
    t = re.sub(r"\bPage\s+\d+(?:\s*(?:\||of)\s*\d+)?\b", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def build(site, topics, files, updated=None):
    """site: content/site.json; topics: list of topic dicts; files: {id: file meta incl. 'text'}.

    Returns (content, search): content.json is everything the pages show, search.json is the extra
    text (inside files and linked pages) that only search needs, so the first visit can skip it.
    """
    visible = sorted((t for t in topics if not t.get("hidden")), key=lambda t: sort_key(t["title"]))
    slugs = {t["slug"] for t in visible}
    used = []
    out_topics = []
    for t in visible:
        posts = []
        for p in t.get("posts", []):
            fids = [f for f in p.get("files", []) if f in files]
            used.extend(f for f in fids if f not in used)
            if p.get("md", "").strip() or fids:
                posts.append({"id": p["id"], "md": p.get("md", ""), "files": fids})
        out_topics.append({
            "slug": t["slug"],
            "title": t["title"],
            "summary": t.get("summary", ""),
            "group": t.get("group", ""),
            "tags": t.get("tags", []),
            "related": [r for r in t.get("related", []) if r in slugs and r != t["slug"]],
            "posts": posts,
        })
    file_map = {}
    for fid in used:
        f = files[fid]
        file_map[fid] = {"name": f["name"], "size": f.get("size", 0), "type": f.get("type", ""),
                         "path": f"files/{fid}/{quote(f['name'])}"}
    content = {
        "updated": updated or today_ist(),
        "groups": site.get("groups", []),
        "new_here": [s for s in site.get("new_here", []) if s in slugs],
        "emergency": site.get("emergency", []),
        "emergency_topic": site.get("emergency_topic") if site.get("emergency_topic") in slugs else None,
        "topics": out_topics,
        "files": file_map,
    }
    search = {
        "files": {fid: squash(files[fid].get("text", "")) for fid in file_map},
        "linked": {t["slug"]: squash(" ".join(f"{s.get('title', '')} {s.get('md', '')}" for s in t["search_text"]))
                   for t in visible if t.get("search_text")},
    }
    return content, search
