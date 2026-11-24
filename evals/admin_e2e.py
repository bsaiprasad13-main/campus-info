"""The admin, end to end, against the real GitHub repo, without touching the live site.

Makes two throwaway branches from main (test-live-<n> stands in for main, test-draft-<n> for the draft), runs
every admin action on them, checks the results, and deletes both branches at the end. Main is checked before and
after; the run fails if it moved.

    .venv\\Scripts\\python.exe -X utf8 evals/admin_e2e.py          (needs server/campus_api/secrets.env)
    node evals/run.mjs --admin                                       (the same, inside the scorecard)
"""

import base64
import copy
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "server" / "campus_api"))

import main  # noqa: E402
from github import GitHubStore  # noqa: E402
from service import AdminService, AuthError, Conflict, Forbidden  # noqa: E402

AS_JSON = "--json" in sys.argv
results = []


def step(name, fn):
    t = time.monotonic()
    try:
        out = fn()
        results.append({"step": name, "ok": True, "secs": round(time.monotonic() - t, 1)})
        return out
    except Exception as e:  # noqa: BLE001 - every failure is reported, not raised
        results.append({"step": name, "ok": False, "secs": round(time.monotonic() - t, 1), "error": f"{type(e).__name__}: {e}"})
        raise


def run():
    cfg = main.config()
    store = GitHubStore(cfg["GITHUB_TOKEN"], cfg["GITHUB_REPO"])
    n = int(time.time())
    live, draft = f"test-live-{n}", f"test-draft-{n}"
    emails = {"owner": cfg["OWNER_EMAIL"], "senior": "e2e-senior@example.com", "stranger": "e2e-stranger@example.com"}

    def verify(cred):
        if cred not in emails:
            raise AuthError("unknown test sign-in")
        return {"email": emails[cred]}

    svc = AdminService(store, cfg["OWNER_EMAIL"], cfg["SESSION_SECRET"], cfg["ADMIN_HASH_KEY"], verify,
                       live=live, draft=draft, repo=cfg["GITHUB_REPO"])
    main_before = store.head("main")
    try:
        step("make throwaway branches from main", lambda: store.move(live, main_before, create=True))

        def stranger():
            try:
                svc.login("stranger")
            except Forbidden:
                return
            raise AssertionError("a stranger got in")
        step("a stranger can't get in", stranger)
        owner = svc.who(svc.login("owner")["session"])

        st = step("read the draft", lambda: svc.state(owner))
        path = "content/topics/sick-food.json"

        def edit():
            t = copy.deepcopy(st["topics"]["sick-food"])
            t["summary"] = f"End-to-end check {n}."
            out = svc.save(owner, [{"path": path, "content": t, "base_sha": st["shas"][path]}])
            assert out["shas"][path] == store.tree(store.head(draft))[path], "returned sha differs from GitHub's"
            return out
        saved = step("an edit saves itself", edit)

        def preview():
            pv = svc.preview(owner)
            t = next(x for x in pv["content"]["topics"] if x["slug"] == "sick-food")
            assert t["summary"] == f"End-to-end check {n}.", t["summary"]
        step("and shows in preview", preview)

        def conflict():
            t = copy.deepcopy(st["topics"]["sick-food"])
            t["summary"] = "An older version"
            try:
                svc.save(owner, [{"path": path, "content": t, "base_sha": st["shas"][path]}])
            except Conflict as c:
                assert c.current["summary"] == f"End-to-end check {n}.", "the conflict didn't return the other version"
                return
            raise AssertionError("a stale save went through")
        step("two people on one topic don't overwrite each other", conflict)

        pdf = next((ROOT / "docs" / "files").glob("*/minors_list.pdf")).read_bytes()
        up = step("upload a PDF", lambda: svc.upload(owner, "End to end check.pdf", base64.b64encode(pdf).decode()))
        assert up["searchable"], "no text came out of the PDF"

        def attach():
            s = svc.state(owner)
            t = copy.deepcopy(s["topics"]["sick-food"])
            t["posts"][-1]["files"] = t["posts"][-1]["files"] + [up["id"]]
            svc.save(owner, [{"path": path, "content": t, "base_sha": s["shas"][path]}])
        step("attach it to a post", attach)

        def publish_first():
            svc.publish(owner, f"End-to-end check {n}")
            tree = store.tree(store.head(live))
            content = json.loads(store.texts([tree["docs/data/content.json"]])[tree["docs/data/content.json"]])
            t = next(x for x in content["topics"] if x["slug"] == "sick-food")
            assert t["summary"] == f"End-to-end check {n}.", "the publish didn't carry the edit"
            assert f"docs/files/{up['id']}/End_to_end_check.pdf" in tree, "the file didn't go live"
            search = json.loads(store.texts([tree["docs/data/search.json"]])[tree["docs/data/search.json"]])
            assert len(search["files"].get(up["id"], "")) > 200, "the PDF isn't searchable after publishing"
            assert store.head(draft) == store.head(live), "the draft didn't follow the publish"
        step("publish puts the edit and the searchable PDF live", publish_first)
        first = svc.history(owner)[0]["sha"]

        def publish_second():
            s = svc.state(owner)
            t = copy.deepcopy(s["topics"]["sick-food"])
            t["summary"] = "A mistake to roll back"
            svc.save(owner, [{"path": path, "content": t, "base_sha": s["shas"][path]}])
            svc.publish(owner, "A mistake")
        step("publish a mistake", publish_second)

        def rollback():
            svc.rollback(owner, first)
            tree = store.tree(store.head(live))
            content = json.loads(store.texts([tree["docs/data/content.json"]])[tree["docs/data/content.json"]])
            t = next(x for x in content["topics"] if x["slug"] == "sick-food")
            assert t["summary"] == f"End-to-end check {n}.", "the rollback didn't restore the earlier version"
        step("a rollback brings the old version back", rollback)

        def admins():
            svc.add_admin(owner, emails["senior"], "E2E senior")
            senior = svc.who(svc.login("senior")["session"])
            assert senior["label"] == "E2E senior"
            tree = store.tree(store.head(live))
            raw = store.texts([tree["content/admins.json"]])[tree["content/admins.json"]]
            assert emails["senior"] not in raw, "an email reached the repo"
            svc.remove_admin(owner, senior["key"])
        step("the owner adds and removes an admin (no email stored)", admins)
    finally:
        for b in (draft, live):
            try:
                store.delete_branch(b)
            except Exception:  # noqa: BLE001
                pass
        ok = store.head("main") == main_before
        results.append({"step": "throwaway branches deleted, main untouched", "ok": ok, "secs": 0,
                        **({} if ok else {"error": "main moved during the check"})})


if __name__ == "__main__":
    try:
        run()
    except Exception:  # noqa: BLE001 - the failing step is already in results
        pass
    for r in results:
        if AS_JSON:
            print(json.dumps(r))
        else:
            print(f"{'ok  ' if r['ok'] else 'FAIL'}  {r['secs']:5.1f}s  {r['step']}" + ("" if r["ok"] else f"  ({r.get('error')})"))
    sys.exit(0 if results and all(r["ok"] for r in results) else 1)
