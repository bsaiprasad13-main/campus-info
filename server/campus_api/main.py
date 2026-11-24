"""Campus Info admin API: a Zoho Catalyst Advanced I/O function (Python).

Routes, relative to .../server/campus_api/execute (all POST, JSON in and out):
  /auth            {credential}          Google sign-in -> {session, who} (admins only)
  /state                                  the draft: topics, home page settings, files, unpublished changes
  /save            {changes, message}    autosave; 409 if someone else changed the same topic first
  /upload          {filename, data}      base64 file, up to 8 MB; PDFs become searchable
  /preview                                the site data built from the draft
  /publish         {note}
  /discard                                drop unpublished changes
  /history                                published versions
  /rollback        {sha}
  /admins/list, /admins/add {email, label}, /admins/remove {key}     (owner only)
  GET /health                             public check

The session travels in the X-Admin-Session header (Catalyst's gateway rejects any Authorization header).
Settings come from secrets.env beside this file (never committed) or environment variables.
CORS for the GitHub Pages site is set in the Catalyst console (Authorized domains); this code only answers
CORS for local development, so the header is never sent twice.
"""

import json
import logging
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from github import GitHubStore, StoreError
from service import AdminService, AuthError, Conflict, Forbidden

log = logging.getLogger()
HERE = Path(__file__).resolve().parent
KEYS = ("GITHUB_TOKEN", "GITHUB_REPO", "GOOGLE_CLIENT_ID", "OWNER_EMAIL", "SESSION_SECRET", "ADMIN_HASH_KEY")
_service = None
_config = None


def config():
    global _config
    if _config is None:
        values = {}
        env_file = HERE / "secrets.env"
        if env_file.exists():
            for raw in env_file.read_text(encoding="utf-8-sig").splitlines():
                line = raw.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    values[k.strip()] = v.strip().strip('"').strip("'")
        for k in KEYS:
            if os.environ.get(k):
                values[k] = os.environ[k]
        missing = [k for k in KEYS if not values.get(k)]
        if missing:
            raise RuntimeError("missing settings: " + ", ".join(missing))
        _config = values
    return _config


def verify_google(credential):
    """Ask Google whether this sign-in token is genuine, fresh, and meant for our app."""
    if not credential:
        raise AuthError("Sign in with Google first.")
    url = "https://oauth2.googleapis.com/tokeninfo?" + urllib.parse.urlencode({"id_token": credential})
    try:
        with urllib.request.urlopen(url, timeout=10) as r:
            info = json.loads(r.read())
    except urllib.error.HTTPError:
        raise AuthError("Google didn't accept that sign-in. Please try again.") from None
    except urllib.error.URLError:
        raise StoreError("Couldn't reach Google to check the sign-in.") from None
    if info.get("aud") != config()["GOOGLE_CLIENT_ID"]:
        raise AuthError("That sign-in was meant for a different app.")
    if info.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise AuthError("That sign-in didn't come from Google.")
    if str(info.get("email_verified")).lower() != "true":
        raise AuthError("Your Google email isn't verified.")
    if int(info.get("exp", 0)) < time.time():
        raise AuthError("That sign-in expired. Please try again.")
    return {"email": info.get("email", ""), "name": info.get("name", "")}


def service():
    global _service
    if _service is None:
        c = config()
        _service = AdminService(GitHubStore(c["GITHUB_TOKEN"], c["GITHUB_REPO"]), c["OWNER_EMAIL"],
                                c["SESSION_SECRET"], c["ADMIN_HASH_KEY"], verify_google, repo=c["GITHUB_REPO"])
    return _service


def dispatch(svc, method, path, session, body):
    """Shared by Catalyst and the local dev server. Returns (status, payload)."""
    try:
        if path == "/health":
            return 200, {"ok": True}
        if method != "POST":
            return 404, {"error": "Not found"}
        if path == "/auth":
            return 200, svc.login(body.get("credential", ""))
        who = svc.who(session)
        routes = {
            "/state": lambda: svc.state(who),
            "/save": lambda: svc.save(who, body.get("changes"), body.get("message", "")),
            "/upload": lambda: svc.upload(who, body.get("filename", ""), body.get("data", "")),
            "/preview": lambda: svc.preview(who),
            "/publish": lambda: svc.publish(who, body.get("note", "")),
            "/discard": lambda: svc.discard(who),
            "/history": lambda: svc.history(who),
            "/rollback": lambda: svc.rollback(who, body.get("sha", "")),
            "/admins/list": lambda: svc.admins(who),
            "/admins/add": lambda: svc.add_admin(who, body.get("email", ""), body.get("label", "")),
            "/admins/remove": lambda: svc.remove_admin(who, body.get("key", "")),
        }
        action = routes.get(path)
        if not action:
            return 404, {"error": "Not found"}
        return 200, action()
    except AuthError as e:
        return 401, {"error": str(e)}
    except Forbidden as e:
        return 403, {"error": str(e)}
    except Conflict as e:
        return 409, {"error": str(e), "path": e.path, "current_sha": e.current_sha, "current": e.current}
    except ValueError as e:
        return 400, {"error": str(e)}
    except StoreError as e:
        log.warning("store: %s", e)
        return 502, {"error": "GitHub didn't answer properly. Your work is kept; try again in a moment."}


def handler(request):
    """Catalyst Advanced I/O entry point (a Flask request)."""
    from flask import make_response
    started = time.monotonic()
    origin = request.headers.get("Origin", "")
    path = re.sub(r"^(/server/campus_api)?(/execute)?", "", request.path) or "/"
    status = 500
    try:
        if request.method == "OPTIONS":
            status, payload = 204, {}
        else:
            body = request.get_json(silent=True) or {}
            status, payload = dispatch(service(), request.method, path, request.headers.get("X-Admin-Session"), body)
    except RuntimeError as e:
        log.error("not configured: %s", e)
        status, payload = 503, {"error": "The admin server isn't set up yet."}
    except Exception:
        log.exception("failed")
        status, payload = 500, {"error": "Something went wrong. Your work is kept; please try again."}
    finally:
        log.info("%s %s -> %s in %.0f ms", request.method, path, status, (time.monotonic() - started) * 1000)
    resp = make_response(json.dumps(payload, ensure_ascii=False), status)
    resp.headers["Content-Type"] = "application/json; charset=utf-8"
    resp.headers["Cache-Control"] = "no-store"
    if re.match(r"^http://(localhost|127\.0\.0\.1)(:\d+)?$", origin):
        resp.headers["Access-Control-Allow-Origin"] = origin
        resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        resp.headers["Access-Control-Allow-Headers"] = "Content-Type, X-Admin-Session"
        resp.headers["Vary"] = "Origin"
    return resp
