"""The admin server's rules, tested against the in-memory store (same interface as GitHub).

    python -m unittest discover -s tests -v
"""

import base64
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "server" / "campus_api"))

from memory_store import MemoryStore, blob_sha  # noqa: E402
from service import AdminService, AuthError, Conflict, Forbidden  # noqa: E402

OWNER = "owner@example.com"
SENIOR = "senior@example.com"


def topic(slug, title, md="Some text.", **extra):
    return {"slug": slug, "title": title, "summary": f"About {title}.", "group": "hostel", "tags": [title.lower()],
            "freshers": False, "hidden": False, "related": [], "posts": [{"id": "pabc1234", "md": md, "files": []}],
            "search_text": [], **extra}


def seed():
    site = {"name": "Campus Info", "groups": [{"slug": "hostel", "title": "Hostel", "summary": ""}],
            "new_here": ["sick-food"], "emergency": [{"label": "Ambulance", "number": "+91 44 2257 8888"}],
            "emergency_topic": "sick-food"}
    files = {
        "content/site.json": json.dumps(site),
        "content/topics/sick-food.json": json.dumps(topic("sick-food", "Sick food")),
        "content/topics/mess.json": json.dumps(topic("mess", "Mess: how it works")),
        "content/admins.json": json.dumps({"admins": []}),
        "docs/app.js": "// app v1",
        "docs/data/content.json": "{}",
    }
    return MemoryStore(files)


class Clock:
    def __init__(self):
        self.t = 1_800_000_000.0

    def __call__(self):
        return self.t


def make(store=None, clock=None):
    store = store or seed()
    clock = clock or Clock()
    who_is = {"tok-owner": OWNER, "tok-senior": SENIOR, "tok-stranger": "nobody@example.com"}

    def verify(cred):
        if cred not in who_is:
            raise AuthError("bad token")
        return {"email": who_is[cred]}
    svc = AdminService(store, OWNER, "s" * 64, "k" * 64, verify, repo="me/campus-info", clock=clock)
    return svc, store, clock


class SignIn(unittest.TestCase):
    def test_owner_gets_in_and_strangers_dont(self):
        svc, _, _ = make()
        s = svc.login("tok-owner")
        self.assertTrue(s["who"]["owner"])
        self.assertTrue(svc.who(s["session"])["owner"])
        with self.assertRaises(Forbidden):
            svc.login("tok-stranger")
        with self.assertRaises(AuthError):
            svc.login("forged")

    def test_admins_are_added_by_hash_and_can_be_removed(self):
        svc, store, clock = make()
        owner = svc.who(svc.login("tok-owner")["session"])
        svc.add_admin(owner, SENIOR, "Hostel senior")
        main_files = store.tree(store.head("main"))
        raw = store.texts([main_files["content/admins.json"]])[main_files["content/admins.json"]]
        self.assertNotIn(SENIOR, raw)                      # the public repo never sees the email
        s = svc.login("tok-senior")
        senior = svc.who(s["session"])
        self.assertEqual(senior["label"], "Hostel senior")
        with self.assertRaises(Forbidden):
            svc.add_admin(senior, "x@example.com", "x")    # only the owner manages admins
        svc.remove_admin(owner, senior["key"])
        clock.t += 61                                      # past the one-minute cache
        with self.assertRaises(AuthError):
            svc.who(s["session"])

    def test_sessions_expire_and_cannot_be_forged(self):
        svc, _, clock = make()
        s = svc.login("tok-owner")["session"]
        with self.assertRaises(AuthError):
            svc.who(s[:-3] + "abc")
        clock.t += 13 * 3600
        with self.assertRaises(AuthError):
            svc.who(s)


class Editing(unittest.TestCase):
    def setUp(self):
        self.svc, self.store, _ = make()
        self.owner = self.svc.who(self.svc.login("tok-owner")["session"])
        self.state = self.svc.state(self.owner)

    def edit(self, base_sha=None, title="Sick food (edited)"):
        t = dict(self.state["topics"]["sick-food"], title=title)
        path = "content/topics/sick-food.json"
        return self.svc.save(self.owner, [{"path": path, "content": t, "base_sha": base_sha or self.state["shas"][path]}])

    def test_save_returns_the_new_sha_so_the_next_save_needs_no_reload(self):
        out = self.edit()
        path = "content/topics/sick-food.json"
        self.assertEqual(out["shas"][path], self.store.tree(self.store.head("draft"))[path])
        self.edit(base_sha=out["shas"][path], title="Sick food (again)")
        st = self.svc.state(self.owner)
        self.assertEqual(st["topics"]["sick-food"]["title"], "Sick food (again)")
        self.assertEqual([c["kind"] for c in st["unpublished"]], ["changed"])
        self.assertEqual(st["edits"][0]["by"], "Owner")

    def test_a_stale_save_is_refused_and_returns_the_other_version(self):
        self.edit()
        with self.assertRaises(Conflict) as c:
            self.edit(title="My older version")
        self.assertEqual(c.exception.current["title"], "Sick food (edited)")

    def test_save_retries_when_something_else_lands_on_the_draft(self):
        real_move = self.store.move
        calls = {"n": 0}

        def move(branch, sha, force=False, create=False):
            if branch == "draft" and calls["n"] == 0 and not force and not create:
                calls["n"] += 1         # someone uploads a file at exactly the wrong moment
                head = self.store.head("draft")
                other = self.store.commit([head], head, {"content/files/zz.json": ("text", "{}")}, "Upload: x")
                real_move("draft", other)
            return real_move(branch, sha, force, create)
        self.store.move = move
        self.edit()
        tree = self.store.tree(self.store.head("draft"))
        self.assertIn("content/files/zz.json", tree)
        self.assertIn('"Sick food (edited)"', self.store.texts([tree["content/topics/sick-food.json"]])[tree["content/topics/sick-food.json"]])

    def test_bad_saves_are_refused(self):
        with self.assertRaises(ValueError):
            self.svc.save(self.owner, [{"path": "docs/app.js", "content": {}, "base_sha": None}])
        with self.assertRaises(ValueError):
            t = dict(self.state["topics"]["sick-food"], slug="other")
            self.svc.save(self.owner, [{"path": "content/topics/sick-food.json", "content": t, "base_sha": None}])

    def test_new_topic_and_upload_and_preview(self):
        up = self.svc.upload(self.owner, "Mess rules.txt", base64.b64encode(
            b"Mess timings 7 to 9\nCall Ravi on 98765 43210\nRebate rules apply").decode())
        self.assertTrue(up["searchable"])
        new = topic("gym", "Gym timings")
        new["posts"][0]["files"] = [up["id"]]
        self.svc.save(self.owner, [{"path": "content/topics/gym.json", "content": new, "base_sha": None}])
        pv = self.svc.preview(self.owner)
        f = pv["content"]["files"][up["id"]]
        self.assertTrue(f["url"].startswith("https://raw.githubusercontent.com/me/campus-info/draft/docs/files/"))
        self.assertIn("Rebate rules", pv["search"]["files"][up["id"]])
        self.assertNotIn("98765", pv["search"]["files"][up["id"]])     # the personal number stays out of search


class Publishing(unittest.TestCase):
    def setUp(self):
        self.svc, self.store, _ = make()
        self.owner = self.svc.who(self.svc.login("tok-owner")["session"])
        st = self.svc.state(self.owner)
        t = dict(st["topics"]["sick-food"], title="Sick food, delivered")
        self.svc.save(self.owner, [{"path": "content/topics/sick-food.json", "content": t,
                                    "base_sha": st["shas"]["content/topics/sick-food.json"]}])

    def live_content(self):
        tree = self.store.tree(self.store.head("main"))
        return json.loads(self.store.texts([tree["docs/data/content.json"]])[tree["docs/data/content.json"]])

    def test_publish_rebuilds_the_site_and_brings_the_draft_along(self):
        with self.assertRaises(ValueError):
            self.svc.publish(self.owner, "  ")
        self.svc.add_admin(self.owner, SENIOR, "Hostel senior")    # lands on main while the draft is behind
        main_before = self.store.head("main")
        head = self.store.head("main")
        code = self.store.commit([head], head, {"docs/app.js": ("text", "// app v2")}, "Fix the app")
        self.store.move("main", code)
        self.svc.publish(self.owner, "Sick food wording")
        live = self.live_content()
        self.assertEqual(next(t for t in live["topics"] if t["slug"] == "sick-food")["title"], "Sick food, delivered")
        tree = self.store.tree(self.store.head("main"))
        self.assertEqual(self.store.texts([tree["docs/app.js"]])[tree["docs/app.js"]], "// app v2")   # code kept
        self.assertIn("Hostel senior", self.store.texts([tree["content/admins.json"]])[tree["content/admins.json"]])
        self.assertEqual(self.store.head("draft"), self.store.head("main"))
        self.assertIn(main_before, self.store._ancestors(self.store.head("main")))     # main only moved forward
        self.assertEqual(self.svc.state(self.owner)["unpublished"], [])
        with self.assertRaises(ValueError):
            self.svc.publish(self.owner, "nothing")
        h = self.svc.history(self.owner)
        self.assertEqual((h[0]["kind"], h[0]["note"], h[0]["by"]), ("publish", "Sick food wording", "Owner"))

    def test_rollback_restores_content_but_not_code_or_admins(self):
        self.svc.publish(self.owner, "First")
        first = self.svc.history(self.owner)[0]["sha"]
        st = self.svc.state(self.owner)
        t = dict(st["topics"]["sick-food"], title="A mistake")
        self.svc.save(self.owner, [{"path": "content/topics/sick-food.json", "content": t,
                                    "base_sha": st["shas"]["content/topics/sick-food.json"]}])
        self.svc.publish(self.owner, "Oops")
        self.svc.add_admin(self.owner, SENIOR, "Hostel senior")
        self.svc.rollback(self.owner, first)
        live = self.live_content()
        self.assertEqual(next(t for t in live["topics"] if t["slug"] == "sick-food")["title"], "Sick food, delivered")
        tree = self.store.tree(self.store.head("main"))
        self.assertIn("Hostel senior", self.store.texts([tree["content/admins.json"]])[tree["content/admins.json"]])
        self.assertEqual(self.svc.history(self.owner)[0]["kind"], "rollback")
        self.assertEqual(self.svc.state(self.owner)["topics"]["sick-food"]["title"], "Sick food, delivered")
        with self.assertRaises(ValueError):
            self.svc.rollback(self.owner, "not-a-publish")

    def test_discard_drops_unpublished_edits(self):
        self.svc.discard(self.owner)
        st = self.svc.state(self.owner)
        self.assertEqual(st["unpublished"], [])
        self.assertEqual(st["topics"]["sick-food"]["title"], "Sick food")


if __name__ == "__main__":
    unittest.main()
