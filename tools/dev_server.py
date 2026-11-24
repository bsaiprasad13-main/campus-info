"""Run Campus Info on this computer: http://localhost:8790/campus-info/

    python tools/dev_server.py              # the site, plus the admin API on a local copy of the content
    python tools/dev_server.py --github     # the admin API on throwaway branches of the real GitHub repo

The local admin API never touches GitHub: edits go to an in-memory copy that starts from content/.
Sign in at /campus-info/admin/ with "Local sign-in" (only offered on localhost).
"""

import argparse
import json
import mimetypes
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "docs"
BASE = "/campus-info/"
sys.path.insert(0, str(ROOT / "server" / "campus_api"))

mimetypes.add_type("application/manifest+json", ".webmanifest")
mimetypes.add_type("text/javascript", ".js")

API = None  # set in main() once the server code exists


class Handler(BaseHTTPRequestHandler):
    server_version = "campus-info-dev"

    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (self.command, self.path))

    def do_GET(self):
        path = urlparse(self.path).path
        if path in ("/", "/campus-info"):
            self.send_response(302)
            self.send_header("Location", BASE)
            self.end_headers()
            return
        if not path.startswith(BASE):
            return self.send_error(404)
        rel = unquote(path[len(BASE):]) or "index.html"
        if rel.endswith("/"):
            rel += "index.html"
        target = (SITE / rel).resolve()
        if SITE.resolve() not in target.parents and target != SITE.resolve():
            return self.send_error(403)
        if not target.is_file():
            target = SITE / "404.html"
            code = 404
        else:
            code = 200
        body = target.read_bytes()
        self.send_response(code)
        self.send_header("Content-Type", mimetypes.guess_type(str(target))[0] or "application/octet-stream")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if not self.path.startswith("/api/") or API is None:
            return self.send_error(404)
        n = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(n) if n else b"{}"
        status, payload = API(self.path[len("/api/"):].split("?")[0], self.headers, raw)
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    global API
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8790)
    ap.add_argument("--github", action="store_true", help="use throwaway branches of the real repo")
    args = ap.parse_args()
    try:
        from local_api import make_api  # noqa: E402  (tools/local_api.py, the admin API for this computer)
        API = make_api(ROOT, use_github=args.github)
    except ImportError:
        API = None
    print(f"Campus Info on http://localhost:{args.port}{BASE}  (admin: {BASE}admin/)")
    ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    main()
