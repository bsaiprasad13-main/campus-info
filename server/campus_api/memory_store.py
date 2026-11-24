"""The same store as github.py, kept in memory. Used by the tests and by the local admin on a laptop,
so both exercise exactly the code that runs against GitHub, minus the network."""

import base64
import hashlib
import itertools
from datetime import datetime, timezone

from github import Moved, StoreError


def blob_sha(data):
    return hashlib.sha1(b"blob %d\0" % len(data) + data).hexdigest()


class MemoryStore:
    def __init__(self, files=None, message="Start"):
        self.blobs = {}
        self.commits = {}
        self.refs = {}
        self.order = itertools.count()
        self.token_expires = None
        self.repo = "local/campus-info"
        if files is not None:
            tree = {p: self._blob(d if isinstance(d, bytes) else d.encode()) for p, d in files.items()}
            self.refs["main"] = self._new_commit(tree, [], message)

    def _blob(self, data):
        s = blob_sha(data)
        self.blobs[s] = data
        return s

    def _new_commit(self, tree, parents, message):
        n = next(self.order)
        sha = hashlib.sha1(f"{n}{sorted(tree.items())}{parents}{message}".encode()).hexdigest()
        self.commits[sha] = {"tree": dict(tree), "parents": list(parents), "message": message, "n": n,
                             "date": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")}
        return sha

    def _ancestors(self, sha):
        seen, stack = set(), [sha]
        while stack:
            s = stack.pop()
            if s and s not in seen:
                seen.add(s)
                stack.extend(self.commits[s]["parents"])
        return seen

    # reading
    def head(self, branch):
        return self.refs.get(branch)

    def commit_info(self, sha):
        c = self.commits.get(sha)
        if not c:
            raise StoreError(f"No commit {sha}")
        return {"sha": sha, "tree": sha, "parents": c["parents"], "message": c["message"], "date": c["date"]}

    def tree(self, commit_sha):
        if commit_sha not in self.commits:
            raise StoreError(f"No tree for {commit_sha}")
        return dict(self.commits[commit_sha]["tree"])

    def texts(self, shas):
        return {s: self.blobs[s].decode("utf-8") for s in shas if s}

    def raw(self, sha):
        return self.blobs[sha]

    def log(self, branch, n=60):
        shas = sorted(self._ancestors(self.refs[branch]), key=lambda s: -self.commits[s]["n"])[:n]
        return [{"sha": s, "message": self.commits[s]["message"], "date": self.commits[s]["date"]} for s in shas]

    def ahead(self, base, head):
        have = self._ancestors(self.refs[base])
        extra = self._ancestors(self.refs[head]) - have
        return [{"sha": s, "message": self.commits[s]["message"], "date": self.commits[s]["date"]}
                for s in sorted(extra, key=lambda s: -self.commits[s]["n"])]

    # writing
    def put_blob(self, b64):
        return self._blob(base64.b64decode(b64))

    def commit(self, parents, base_commit, changes, message):
        tree = dict(self.commits[base_commit]["tree"]) if base_commit else {}
        for path, change in changes.items():
            if change is None:
                tree.pop(path, None)
            elif change[0] == "text":
                tree[path] = self._blob(change[1].encode())
            elif change[0] == "blob":
                if change[1] not in self.blobs:
                    raise StoreError(f"No blob {change[1]}")
                tree[path] = change[1]
            elif change[0] == "base64":
                tree[path] = self.put_blob(change[1])
        return self._new_commit(tree, parents, message)

    def move(self, branch, sha, force=False, create=False):
        if create:
            if branch in self.refs:
                raise StoreError("Branch exists")
            self.refs[branch] = sha
            return
        if branch not in self.refs:
            raise StoreError(f"No branch {branch}")
        if not force and self.refs[branch] not in self._ancestors(sha):
            raise Moved("Update is not a fast forward")
        self.refs[branch] = sha

    def delete_branch(self, branch):
        self.refs.pop(branch, None)
