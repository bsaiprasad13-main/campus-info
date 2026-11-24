# Campus Info

What IIT Madras offers you, and whom to ask. 76 topics on academics, the hostel and mess, scholarships, health,
clubs and Inter IIT, written by IITM students from official sources and their own experience. Search in your own
words, tap any number to call it, and keep using it offline.

- **The site:** https://bsaiprasad13-main.github.io/campus-info/
- **The admin:** https://bsaiprasad13-main.github.io/campus-info/admin/. Reviewing this? Press **Try the admin**: no sign-in, a practice copy that stays in your browser.

## What's where

| Folder | What it is |
|---|---|
| `docs/` | The website. GitHub Pages serves this folder as it is: HTML, CSS and JavaScript, no build step. |
| `docs/admin/` | The admin page seniors use. |
| `content/` | The content: one JSON file per topic, the home page settings, details of each file. The admin edits these. |
| `server/campus_api/` | The admin server, a Zoho Catalyst function in Python. It checks the Google sign-in, holds the GitHub key and writes to this repo. |
| `evals/` | The checks, the questions they use, and every scorecard. Start with [evals/README.md](evals/README.md). |
| `prompts/` | [The prompts](prompts/PROMPTS.md) Campus Info was built from. |
| `tools/` | Build the site data, draw the icons, run everything on a laptop. |
| `tests/` | Tests for the admin server. |

## How editing works

- Edits save as you type, to a `draft` branch. Students see `main`.
- Publishing makes one commit on `main` with the draft's content and the rebuilt `docs/data/`. GitHub Pages
  refreshes the site within a few minutes.
- If two people change the same topic, the second one is told, and both versions survive.
- Every publish is listed with who and when, and any of them can be put back. A rollback is a new commit, so `main`
  only ever moves forward.
- Admin emails never reach this public repo. The list keeps a keyed hash of each email and a label the owner picks.

## Run it on a laptop

```
python -m venv .venv
.venv\Scripts\pip install pypdf
.venv\Scripts\python tools\dev_server.py        # http://localhost:8790/campus-info/
node evals\run.mjs                               # the scorecard
.venv\Scripts\python -m unittest discover -s tests
```

The local admin works on an in-memory copy of this folder. Sign in with the "Local sign-in" buttons.

## Setting up the admin server

1. In Zoho Catalyst, deploy the function in `server/campus_api` (`catalyst deploy --only functions:campus_api`).
   Add `https://bsaiprasad13-main.github.io` under Authentication → Authorized domains, so the admin page may call it.
2. `server/campus_api/secrets.env` is never committed. It holds:
   - the GitHub key (fine-grained, this repo only, Contents read and write)
   - the owner's Google email
   - the Google sign-in client ID
   - two random keys
3. In `docs/admin/admin.js`, set `CONFIG.API` to the function's URL and `CONFIG.GOOGLE_CLIENT_ID` to the sign-in client.

## Privacy

- Students need no account.
- Personal phone numbers and student emails were taken out. Office numbers and official helplines stay.
- Official PDFs are kept as they were published, but search skips any line in them that carries a personal number.
- Google Analytics counts searches, searches that found nothing, topic opens and taps, without names.
