"""The admin API for this computer, used by tools/dev_server.py.

By default it works on an in-memory copy of this folder (content/ and docs/), so nothing you do locally reaches
GitHub. "Local sign-in" stands in for Google here: local-owner signs in as the owner, local-senior as an admin.
With --github it runs on two throwaway branches of the real repo instead, deleted when the server stops.
"""

import atexit
import json
import sys
import time
from pathlib import Path

LOCAL_OWNER = "owner@local.test"
LOCAL_SENIOR = "senior@local.test"


def make_api(root, use_github=False):
    sys.path.insert(0, str(root / "server" / "campus_api"))
    from main import dispatch  # noqa: E402
    from service import AdminService, AuthError  # noqa: E402

    def verify(credential):
        emails = {"local-owner": LOCAL_OWNER, "local-senior": LOCAL_SENIOR, "local-stranger": "stranger@local.test"}
        if credential not in emails:
            raise AuthError("Use the local sign-in buttons on this computer.")
        return {"email": emails[credential]}

    if use_github:
        import main as live  # noqa: E402
        from github import GitHubStore  # noqa: E402
        c = live.config()
        store = GitHubStore(c["GITHUB_TOKEN"], c["GITHUB_REPO"])
        n = int(time.time())
        live_b, draft_b = f"test-live-{n}", f"test-draft-{n}"
        store.move(live_b, store.head("main"), create=True)
        atexit.register(lambda: (store.delete_branch(draft_b), store.delete_branch(live_b)))
        svc = AdminService(store, LOCAL_OWNER, c["SESSION_SECRET"], c["ADMIN_HASH_KEY"], verify,
                           live=live_b, draft=draft_b, repo=c["GITHUB_REPO"])
        print(f"admin API on GitHub branches {live_b} / {draft_b} (deleted on exit)")
    else:
        from memory_store import MemoryStore  # noqa: E402
        files = {}
        for folder in ("content", "docs"):
            for p in (root / folder).rglob("*"):
                if p.is_file():
                    files[p.relative_to(root).as_posix()] = p.read_bytes()
        files.setdefault("content/admins.json", json.dumps({"admins": []}).encode())
        store = MemoryStore(files, "Local copy")
        svc = AdminService(store, LOCAL_OWNER, "local-session-secret-" * 3, "local-admin-key-" * 3, verify,
                           repo="local/campus-info")
        owner = {"key": "owner", "label": "Owner", "owner": True}
        svc.add_admin(owner, LOCAL_SENIOR, "Hostel senior")
        print("admin API on an in-memory copy of this folder (nothing reaches GitHub)")

    def api(route, headers, raw):
        try:
            body = json.loads(raw or b"{}")
        except ValueError:
            body = {}
        status, payload = dispatch(svc, "POST", "/" + route, headers.get("X-Admin-Session"), body)
        return status, payload

    return api
