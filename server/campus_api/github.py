"""The content store, backed by a GitHub repository. Only the standard library, so the function stays small.

Everything the admin needs comes down to a few git operations: read a branch's file list, read many small text
files at once (GraphQL), write a commit on top of another, and move a branch, only forward unless told otherwise.
"""

import json
import urllib.error
import urllib.request

API = "https://api.github.com"


class StoreError(Exception):
    """GitHub refused or couldn't be reached."""


class Moved(Exception):
    """The branch moved since we looked (someone else saved first). Safe to read again and retry."""


class GitHubStore:
    def __init__(self, token, repo):
        self.token = token
        self.repo = repo
        self.owner, self.name = repo.split("/", 1)
        self.token_expires = None
        self._trees = {}

    # ---------- plumbing ----------
    def _call(self, method, path, body=None):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(API + path, data=data, method=method, headers={
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "campus-info-admin",
            **({"Content-Type": "application/json"} if data else {}),
        })
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                exp = r.headers.get("github-authentication-token-expiration")
                if exp:
                    self.token_expires = exp
                raw = r.read()
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", "replace")[:300]
            if e.code == 422 and "fast forward" in detail.lower():
                raise Moved(detail) from None
            if e.code == 404:
                return None
            raise StoreError(f"GitHub said {e.code}: {detail}") from None
        except urllib.error.URLError as e:
            raise StoreError(f"Couldn't reach GitHub: {e.reason}") from None

    def _graphql(self, query, variables=None):
        out = self._call("POST", "/graphql", {"query": query, "variables": variables or {}})
        if not out or out.get("errors"):
            raise StoreError(f"GitHub GraphQL error: {(out or {}).get('errors')}")
        return out["data"]

    # ---------- reading ----------
    def head(self, branch):
        ref = self._call("GET", f"/repos/{self.repo}/git/ref/heads/{branch}")
        return ref["object"]["sha"] if ref else None

    def commit_info(self, sha):
        c = self._call("GET", f"/repos/{self.repo}/git/commits/{sha}")
        if not c:
            raise StoreError(f"No commit {sha}")
        return {"sha": c["sha"], "tree": c["tree"]["sha"], "parents": [p["sha"] for p in c["parents"]],
                "message": c["message"], "date": c["committer"]["date"]}

    def tree(self, commit_sha):
        """Every file in a commit: {path: blob sha}."""
        if commit_sha in self._trees:
            return dict(self._trees[commit_sha])
        t = self._call("GET", f"/repos/{self.repo}/git/trees/{commit_sha}?recursive=1")
        if not t:
            raise StoreError(f"No tree for {commit_sha}")
        if t.get("truncated"):
            raise StoreError("The repository is too big to list in one go.")
        files = {e["path"]: e["sha"] for e in t["tree"] if e["type"] == "blob"}
        self._trees[commit_sha] = files
        return dict(files)

    def texts(self, shas):
        """Read many text files at once: {blob sha: text}."""
        out = {}
        unique = list(dict.fromkeys(s for s in shas if s))
        for i in range(0, len(unique), 60):
            chunk = unique[i:i + 60]
            parts = " ".join(f'b{n}: object(oid: "{s}") {{ ... on Blob {{ text isTruncated }} }}' for n, s in enumerate(chunk))
            data = self._graphql(f'query {{ repository(owner: "{self.owner}", name: "{self.name}") {{ {parts} }} }}')
            repo = data["repository"]
            for n, s in enumerate(chunk):
                obj = repo.get(f"b{n}")
                if obj is None or obj.get("text") is None or obj.get("isTruncated"):
                    out[s] = self._blob_text(s)      # big files come back cut short; read those one by one
                else:
                    out[s] = obj["text"]
        return out

    def _blob_text(self, sha):
        b = self._call("GET", f"/repos/{self.repo}/git/blobs/{sha}")
        if not b:
            raise StoreError(f"Couldn't read file {sha}")
        import base64
        return base64.b64decode(b["content"]).decode("utf-8")

    def log(self, branch, n=60):
        items = self._call("GET", f"/repos/{self.repo}/commits?sha={branch}&per_page={n}") or []
        return [{"sha": c["sha"], "message": c["commit"]["message"], "date": c["commit"]["committer"]["date"]} for c in items]

    def ahead(self, base, head):
        """Commits on `head` that `base` doesn't have, newest first."""
        cmp = self._call("GET", f"/repos/{self.repo}/compare/{base}...{head}?per_page=100")
        if not cmp:
            return []
        items = [{"sha": c["sha"], "message": c["commit"]["message"], "date": c["commit"]["committer"]["date"]}
                 for c in cmp.get("commits", [])]
        return items[::-1]

    # ---------- writing ----------
    def put_blob(self, b64):
        return self._call("POST", f"/repos/{self.repo}/git/blobs", {"content": b64, "encoding": "base64"})["sha"]

    def commit(self, parents, base_commit, changes, message):
        """A new commit with `changes` applied on top of base_commit's files. Doesn't move any branch.
        changes: {path: ("text", str) | ("blob", sha) | ("base64", str) | None to delete}."""
        entries = []
        for path, change in sorted(changes.items()):
            if change is None:
                entries.append({"path": path, "mode": "100644", "type": "blob", "sha": None})
            elif change[0] == "text":
                entries.append({"path": path, "mode": "100644", "type": "blob", "content": change[1]})
            elif change[0] == "blob":
                entries.append({"path": path, "mode": "100644", "type": "blob", "sha": change[1]})
            elif change[0] == "base64":
                entries.append({"path": path, "mode": "100644", "type": "blob", "sha": self.put_blob(change[1])})
        base_tree = self.commit_info(base_commit)["tree"] if base_commit else None
        tree = self._call("POST", f"/repos/{self.repo}/git/trees",
                          {"tree": entries, **({"base_tree": base_tree} if base_tree else {})})["sha"]
        return self._call("POST", f"/repos/{self.repo}/git/commits",
                          {"message": message, "tree": tree, "parents": parents})["sha"]

    def move(self, branch, sha, force=False, create=False):
        if create:
            self._call("POST", f"/repos/{self.repo}/git/refs", {"ref": f"refs/heads/{branch}", "sha": sha})
            return
        out = self._call("PATCH", f"/repos/{self.repo}/git/refs/heads/{branch}", {"sha": sha, "force": force})
        if out is None:
            raise StoreError(f"No branch {branch}")

    def delete_branch(self, branch):
        self._call("DELETE", f"/repos/{self.repo}/git/refs/heads/{branch}")
