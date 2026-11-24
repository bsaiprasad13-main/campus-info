"""What the admin can do. Independent of GitHub (the store) and Google (the sign-in check), so it can be tested.

Branches: `draft` holds every saved edit; `main` is what students see. Publishing makes one commit on main that
carries the draft's content plus the rebuilt site data, then moves draft forward to it. Main only ever moves
forward, so a protected branch (no force pushes) is fine. Rolling back is a new commit, not a rewrite.

Admin emails never go into the repository (it's public): the list stores a keyed hash of each email and a label
the owner chooses. Commits say who made them by that label.
"""

import base64
import hashlib
import hmac
import json
import re
import secrets
import time
from pathlib import PurePosixPath

from build import build, today_ist
from github import Moved, StoreError
from pdftext import extract_text

TOPIC = re.compile(r"^content/topics/([a-z0-9][a-z0-9-]{0,60})\.json$")
SITE = "content/site.json"
ADMINS = "content/admins.json"
FILE_META = re.compile(r"^content/files/([a-z0-9]{6,20})\.json$")
CONTENT_PREFIXES = ("content/topics/", "content/files/", "docs/files/")
PUBLISHED_PREFIXES = CONTENT_PREFIXES + ("docs/data/",)
SESSION_SECONDS = 12 * 3600
MAX_UPLOAD = 8 * 1024 * 1024
TYPES = {
    ".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".webp": "image/webp", ".gif": "image/gif", ".txt": "text/plain", ".csv": "text/csv",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}


class AuthError(Exception):
    """Sign in (again)."""


class Forbidden(Exception):
    """Signed in, but not allowed to do this."""


class Conflict(Exception):
    """Someone else changed this file since the editor loaded it. Their version is in .current."""

    def __init__(self, path, current_sha, current):
        super().__init__("Someone else changed this while you were editing.")
        self.path, self.current_sha, self.current = path, current_sha, current


def blob_sha(data):
    return hashlib.sha1(b"blob %d\0" % len(data) + data).hexdigest()


def dump(obj):
    return json.dumps(obj, ensure_ascii=False, indent=2) + "\n"


def b64url(b):
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def new_id(prefix=""):
    while True:
        t = secrets.token_hex(5)
        if re.search(r"[a-f]", t):      # never all digits: those look like phone numbers
            return prefix + t


class AdminService:
    def __init__(self, store, owner_email, session_secret, admin_key, verify_google, live="main", draft="draft",
                 repo="", clock=time.time):
        if not owner_email or not session_secret or not admin_key:
            raise RuntimeError("Owner email, session secret and admin key are required.")
        self.store = store
        self.owner_email = owner_email.strip().lower()
        self.secret = session_secret.encode()
        self.admin_key = admin_key.encode()
        self.verify_google = verify_google
        self.live, self.draft = live, draft
        self.repo = repo
        self.clock = clock
        self._admins_cache = (0, None)

    # ---------- who ----------
    def login(self, credential):
        ident = self.verify_google(credential)          # raises AuthError if Google doesn't vouch for it
        email = (ident.get("email") or "").strip().lower()
        if email and hmac.compare_digest(email, self.owner_email):
            who = {"key": "owner", "label": "Owner", "owner": True}
        else:
            entry = next((a for a in self._admins(fresh=True) if a["key"] == self.key_of(email)), None)
            if not entry:
                raise Forbidden("This Google account isn't on the admin list. Ask the owner to add you.")
            who = {"key": entry["key"], "label": entry["label"], "owner": False}
        return {"session": self._sign(who), "who": who}

    def key_of(self, email):
        return hmac.new(self.admin_key, email.strip().lower().encode(), hashlib.sha256).hexdigest()[:24]

    def _sign(self, who):
        payload = b64url(json.dumps({"k": who["key"], "l": who["label"], "o": who["owner"],
                                     "x": int(self.clock() + SESSION_SECONDS)}).encode())
        mac = b64url(hmac.new(self.secret, payload.encode(), hashlib.sha256).digest())
        return f"{payload}.{mac}"

    def who(self, session):
        if not session or "." not in session:
            raise AuthError("Please sign in.")
        payload, mac = session.rsplit(".", 1)
        good = b64url(hmac.new(self.secret, payload.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(mac, good):
            raise AuthError("Please sign in again.")
        data = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        if data["x"] < self.clock():
            raise AuthError("Your sign-in ran out. Please sign in again.")
        if not data["o"] and not any(a["key"] == data["k"] for a in self._admins()):
            raise AuthError("You're no longer on the admin list.")
        return {"key": data["k"], "label": data["l"], "owner": data["o"]}

    def _admins(self, fresh=False):
        at, cached = self._admins_cache
        if cached is not None and not fresh and self.clock() - at < 60:
            return cached
        tree = self.store.tree(self.store.head(self.live))
        sha = tree.get(ADMINS)
        admins = json.loads(self.store.texts([sha])[sha]).get("admins", []) if sha else []
        self._admins_cache = (self.clock(), admins)
        return admins

    # ---------- reading ----------
    def _draft_head(self):
        head = self.store.head(self.draft)
        if head is None:
            head = self.store.head(self.live)
            self.store.move(self.draft, head, create=True)
        return head

    def _read_content(self, tree, with_text=False):
        paths = [p for p in tree if TOPIC.match(p) or p == SITE or FILE_META.match(p)]
        if with_text:
            paths += [p for p in tree if p.startswith("content/files/") and p.endswith(".txt")]
        texts = self.store.texts([tree[p] for p in paths])
        topics, files, site = {}, {}, {}
        for p in paths:
            raw = texts[tree[p]]
            if p == SITE:
                site = json.loads(raw)
            elif TOPIC.match(p):
                t = json.loads(raw)
                topics[t["slug"]] = t
            elif FILE_META.match(p):
                f = json.loads(raw)
                files[f["id"]] = f
        if with_text:
            for p in paths:
                if p.endswith(".txt"):
                    fid = PurePosixPath(p).stem
                    if fid in files:
                        files[fid]["text"] = texts[tree[p]]
        return topics, site, files

    def _changes(self, d_tree, m_tree, topics_d=None):
        """What's in the draft that students don't see yet."""
        out = []
        paths = {p for p in set(d_tree) | set(m_tree) if p == SITE or p.startswith(CONTENT_PREFIXES)}
        for p in sorted(paths):
            if d_tree.get(p) == m_tree.get(p) or p.endswith(".txt"):
                continue
            kind = "added" if p not in m_tree else "removed" if p not in d_tree else "changed"
            m = TOPIC.match(p)
            if m:
                title = (topics_d or {}).get(m.group(1), {}).get("title", m.group(1))
                out.append({"path": p, "kind": kind, "what": "topic", "slug": m.group(1), "title": title})
            elif p == SITE:
                out.append({"path": p, "kind": kind, "what": "home page", "title": "Home page settings"})
            elif p.startswith("docs/files/"):
                out.append({"path": p, "kind": kind, "what": "file", "title": PurePosixPath(p).name})
        return out

    def state(self, who):
        main = self.store.head(self.live)
        draft = self._draft_head()
        d_tree, m_tree = self.store.tree(draft), self.store.tree(main)
        topics, site, files = self._read_content(d_tree)
        edits = [self._describe(c) for c in self.store.ahead(self.live, self.draft)[:50]]
        return {
            "who": who, "topics": topics, "site": site, "files": files,
            "shas": {p: s for p, s in d_tree.items() if TOPIC.match(p) or p == SITE},
            "unpublished": self._changes(d_tree, m_tree, topics),
            "edits": edits,
            "repo": self.repo,
            "token_expires": self.store.token_expires if who["owner"] else None,
        }

    @staticmethod
    def _describe(c):
        msg = c["message"]
        first = msg.split("\n", 1)[0]
        by = re.search(r"^By: (.+)$", msg, re.M)
        return {"sha": c["sha"], "message": first, "by": by.group(1) if by else "", "date": c["date"]}

    # ---------- saving ----------
    def save(self, who, changes, message=""):
        if not isinstance(changes, list) or not changes:
            raise ValueError("Nothing to save.")
        prepared = []
        for ch in changes:
            path = ch.get("path", "")
            content = ch.get("content")
            if TOPIC.match(path):
                text = None if content is None else dump(self._clean_topic(content, TOPIC.match(path).group(1)))
            elif path == SITE and content is not None:
                text = dump(self._clean_site(content))
            else:
                raise ValueError(f"Can't save {path!r}.")
            prepared.append((path, text, ch.get("base_sha")))
        titles = ", ".join(json.loads(t)["title"] if t and TOPIC.match(p) else "home page" if p == SITE else p.rsplit("/", 1)[-1]
                           for p, t, _ in prepared)
        note = (message or "").strip()[:100] or titles
        commit_msg = f"Edit: {note}\n\nBy: {who['label']}"
        for _ in range(4):
            head = self._draft_head()
            tree = self.store.tree(head)
            for path, _, base in prepared:
                if tree.get(path) != (base or None):
                    cur = tree.get(path)
                    current = json.loads(self.store.texts([cur])[cur]) if cur else None
                    raise Conflict(path, cur, current)
            sha = self.store.commit([head], head, {p: (("text", t) if t is not None else None) for p, t, _ in prepared},
                                    commit_msg)
            try:
                self.store.move(self.draft, sha)
            except Moved:
                continue        # an upload or another topic landed in between; our files didn't change, try again
            return {"commit": sha, "shas": {p: (blob_sha(t.encode()) if t is not None else None) for p, t, _ in prepared}}
        raise StoreError("The draft was busy. Please try again.")

    @staticmethod
    def _clean_topic(t, slug):
        if not isinstance(t, dict) or t.get("slug") != slug:
            raise ValueError("The topic doesn't match its address.")
        title = str(t.get("title", "")).strip()
        if not 1 <= len(title) <= 120:
            raise ValueError("A topic needs a title (up to 120 characters).")
        posts = []
        for p in t.get("posts") or []:
            pid = str(p.get("id", ""))
            if not re.fullmatch(r"p[a-z0-9]{6,20}", pid):
                raise ValueError("A post has a bad id.")
            md = str(p.get("md", ""))
            if len(md) > 60000:
                raise ValueError("A post is too long.")
            files = [str(f) for f in p.get("files") or [] if re.fullmatch(r"[a-z0-9]{6,20}", str(f))]
            posts.append({"id": pid, "md": md, "files": files})
        if len(posts) > 120:
            raise ValueError("Too many posts in one topic.")
        tags = [str(x).strip()[:60] for x in t.get("tags") or [] if str(x).strip()][:40]
        return {
            "slug": slug, "title": title, "summary": str(t.get("summary", "")).strip()[:300],
            "group": str(t.get("group", "")).strip()[:40], "tags": tags,
            "freshers": bool(t.get("freshers")), "hidden": bool(t.get("hidden")),
            "related": [str(x) for x in t.get("related") or []][:12],
            "posts": posts,
            "search_text": [{"title": str(s.get("title", ""))[:200], "md": str(s.get("md", ""))[:200000]}
                            for s in t.get("search_text") or [] if isinstance(s, dict)],
        }

    @staticmethod
    def _clean_site(s):
        if not isinstance(s, dict):
            raise ValueError("Bad home page settings.")
        emergency = []
        for e in s.get("emergency") or []:
            label, number = str(e.get("label", "")).strip()[:30], str(e.get("number", "")).strip()[:30]
            if not label or not re.fullmatch(r"\+?[\d\s()-]{6,24}", number):
                raise ValueError("Each emergency number needs a name and a phone number.")
            emergency.append({"label": label, "number": number})
        groups = [{"slug": str(g.get("slug", "")), "title": str(g.get("title", ""))[:40],
                   "summary": str(g.get("summary", ""))[:200]} for g in s.get("groups") or []]
        return {
            "name": str(s.get("name", "Campus Info"))[:40],
            "groups": groups,
            "new_here": [str(x) for x in s.get("new_here") or []][:8],
            "emergency": emergency[:4],
            "emergency_topic": str(s.get("emergency_topic") or "") or None,
        }

    def upload(self, who, filename, data_b64):
        name = re.sub(r"[^A-Za-z0-9._-]+", "_", PurePosixPath(str(filename or "").replace("\\", "/")).name).strip("._")[:90]
        ext = PurePosixPath(name).suffix.lower()
        if not name or ext not in TYPES:
            raise ValueError("Upload a PDF, an image, or an Office or text file.")
        try:
            raw = base64.b64decode(data_b64 or "", validate=True)
        except Exception:
            raise ValueError("The file didn't arrive in one piece. Try again.") from None
        if not raw:
            raise ValueError("The file is empty.")
        if len(raw) > MAX_UPLOAD:
            raise ValueError("Files can be up to 8 MB.")
        fid = new_id()
        text = extract_text(name, raw)
        meta = {"id": fid, "name": name, "size": len(raw), "type": TYPES[ext]}
        blob = self.store.put_blob(data_b64)
        changes = {f"docs/files/{fid}/{name}": ("blob", blob), f"content/files/{fid}.json": ("text", dump(meta))}
        if text:
            changes[f"content/files/{fid}.txt"] = ("text", text + "\n")
        for _ in range(4):
            head = self._draft_head()
            sha = self.store.commit([head], head, changes, f"Upload: {name}\n\nBy: {who['label']}")
            try:
                self.store.move(self.draft, sha)
            except Moved:
                continue
            return {**meta, "searchable": bool(text)}
        raise StoreError("The draft was busy. Please try again.")

    # ---------- preview and publish ----------
    def preview(self, who):
        draft, main = self._draft_head(), self.store.head(self.live)
        d_tree, m_tree = self.store.tree(draft), self.store.tree(main)
        topics, site, files = self._read_content(d_tree, with_text=True)
        content, search = build(site, list(topics.values()), files)
        for fid, f in content["files"].items():
            path = f"docs/files/{fid}/{files[fid]['name']}"
            if path not in m_tree:           # not on the live site yet: show it from the draft branch
                f["url"] = f"https://raw.githubusercontent.com/{self.repo}/{self.draft}/{path}"
        return {"content": content, "search": search}

    def publish(self, who, note):
        note = re.sub(r"\s+", " ", str(note or "")).strip()[:120]
        if not note:
            raise ValueError("Write a short note on what changed.")
        for _ in range(3):
            main, draft = self.store.head(self.live), self._draft_head()
            d_tree, m_tree = self.store.tree(draft), self.store.tree(main)
            if not self._changes(d_tree, m_tree):
                raise ValueError("There's nothing new to publish.")
            topics, site, files = self._read_content(d_tree, with_text=True)
            content, search = build(site, list(topics.values()), files, updated=today_ist())
            changes = {}
            for p in set(d_tree) | set(m_tree):
                if p == SITE or p.startswith(CONTENT_PREFIXES):
                    if p not in d_tree:
                        changes[p] = None
                    elif d_tree[p] != m_tree.get(p):
                        changes[p] = ("blob", d_tree[p])
            changes["docs/data/content.json"] = ("text", json.dumps(content, ensure_ascii=False, separators=(",", ":")))
            changes["docs/data/search.json"] = ("text", json.dumps(search, ensure_ascii=False, separators=(",", ":")))
            sha = self.store.commit([main, draft], main, changes, f"Publish: {note}\n\nBy: {who['label']}")
            try:
                self.store.move(self.live, sha)
            except Moved:
                continue
            try:
                self.store.move(self.draft, sha)
            except Moved:
                pass    # someone saved during the publish; their edit simply waits for the next one
            return {"commit": sha, "updated": content["updated"], "topics": len(content["topics"])}
        raise StoreError("The site was busy. Please publish again.")

    def discard(self, who):
        self.store.move(self.draft, self.store.head(self.live), force=True)
        return {"ok": True}

    def history(self, who):
        out = []
        for c in self.store.log(self.live, 80):
            first = c["message"].split("\n", 1)[0]
            if first.startswith(("Publish:", "Roll back:")):
                d = self._describe(c)
                d["kind"] = "publish" if first.startswith("Publish:") else "rollback"
                d["note"] = first.split(":", 1)[1].strip()
                out.append(d)
        return out

    def rollback(self, who, sha):
        target = next((h for h in self.history(who) if h["sha"] == sha and h["kind"] == "publish"), None)
        if not target:
            raise ValueError("That isn't one of the published versions.")
        t_tree = self.store.tree(sha)
        for _ in range(3):
            main = self.store.head(self.live)
            m_tree = self.store.tree(main)
            changes = {}
            for p in set(t_tree) | set(m_tree):
                if p == SITE or p.startswith(PUBLISHED_PREFIXES):
                    if p not in t_tree:
                        changes[p] = None
                    elif t_tree[p] != m_tree.get(p):
                        changes[p] = ("blob", t_tree[p])
            new = self.store.commit([main], main, changes,
                                    f"Roll back: to the version of {target['date'][:10]} ({target['note']})\n\nBy: {who['label']}")
            try:
                self.store.move(self.live, new)
            except Moved:
                continue
            # The draft follows, or the next publish would bring the rolled-back version straight back.
            self.store.move(self.draft, new, force=True)
            return {"commit": new}
        raise StoreError("The site was busy. Please try again.")

    # ---------- admins (owner only) ----------
    def admins(self, who):
        self._owner_only(who)
        return {"admins": [{"key": a["key"], "label": a["label"], "added": a.get("added", "")} for a in self._admins(fresh=True)]}

    def add_admin(self, who, email, label):
        self._owner_only(who)
        email = str(email or "").strip().lower()
        label = re.sub(r"\s+", " ", str(label or "")).strip()[:40]
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[a-z]{2,}", email):
            raise ValueError("That doesn't look like an email address.")
        if not label:
            raise ValueError("Add a short label, like 'Hostel senior'. It shows next to their edits.")
        if email == self.owner_email:
            raise ValueError("That's the owner's account; it always has access.")
        key = self.key_of(email)
        admins = [a for a in self._admins(fresh=True) if a["key"] != key]
        admins.append({"key": key, "label": label, "added": today_ist()})
        self._write_admins(admins, f"Admins: add {label}", who)
        return {"admins": admins}

    def remove_admin(self, who, key):
        self._owner_only(who)
        admins = self._admins(fresh=True)
        keep = [a for a in admins if a["key"] != key]
        if len(keep) == len(admins):
            raise ValueError("No such admin.")
        gone = next(a for a in admins if a["key"] == key)
        self._write_admins(keep, f"Admins: remove {gone['label']}", who)
        return {"admins": keep}

    def _write_admins(self, admins, title, who):
        for _ in range(3):
            main = self.store.head(self.live)
            sha = self.store.commit([main], main, {ADMINS: ("text", dump({"admins": admins}))}, f"{title}\n\nBy: {who['label']}")
            try:
                self.store.move(self.live, sha)
            except Moved:
                continue
            self._admins_cache = (self.clock(), admins)
            return
        raise StoreError("The site was busy. Please try again.")

    @staticmethod
    def _owner_only(who):
        if not who.get("owner"):
            raise Forbidden("Only the owner can change who's an admin.")
