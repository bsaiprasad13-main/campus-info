"""Build the website's data from content/ on this computer (the admin server does the same on publish).

    python tools/build.py              # writes docs/data/content.json and docs/data/search.json
    python tools/build.py --date 2026-11-25
"""

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "server" / "campus_api"))

from build import build  # noqa: E402


def load_content(root=ROOT):
    site = json.loads((root / "content" / "site.json").read_text(encoding="utf-8"))
    topics = [json.loads(p.read_text(encoding="utf-8")) for p in sorted((root / "content" / "topics").glob("*.json"))]
    files = {}
    for p in sorted((root / "content" / "files").glob("*.json")):
        f = json.loads(p.read_text(encoding="utf-8"))
        txt = p.with_suffix(".txt")
        f["text"] = txt.read_text(encoding="utf-8") if txt.exists() else ""
        files[f["id"]] = f
    return site, topics, files


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", help="the 'Content updated' date, YYYY-MM-DD (default: today in India)")
    args = ap.parse_args()
    site, topics, files = load_content()
    content, search = build(site, topics, files, updated=args.date)
    out = ROOT / "docs" / "data"
    out.mkdir(parents=True, exist_ok=True)
    (out / "content.json").write_text(json.dumps(content, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (out / "search.json").write_text(json.dumps(search, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(content['topics'])} topics, {len(content['files'])} files, content updated {content['updated']}")


if __name__ == "__main__":
    main()
