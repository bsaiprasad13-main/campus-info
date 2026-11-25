# Campus Info

Everything a senior would tell you.

Campus Info answers the questions every IITM student ends up asking: how the mess works, how CGPA is counted, which
scholarship fits you, and **whom to call** when something goes wrong.

It helps **first- and second-years** most, and anyone who has asked a senior "whom do I even ask about this?"

Inside: **academics, hostel and mess, scholarships and loans, health, clubs and Inter IIT**, with the official
documents and office numbers that go with them.

Search the way you'd ask a friend, or browse by area. It **works offline**, so it's there even when the hostel Wi-Fi
isn't.

Written and kept up to date by **IITM students**, from official sources. Not an official institute website.

- **The site:** https://bsaiprasad13-main.github.io/campus-info/
- **The admin:** https://bsaiprasad13-main.github.io/campus-info/admin/. Reviewing this? Press **Try the admin**: no sign-in, a practice copy that stays in your browser.

## Two minutes: five things to try

1. Search **friend fainted in hostel**. The hospital comes first, with a Call button for the ambulance.
2. Search **mess change kab tak**, typed the way students type.
3. Search **gre coaching**. It isn't covered, and the app says so, with a link to ask the seniors for it.
4. Tap **Emergency** in the nav: every emergency number, one tap to call.
5. Open the admin, press **Try the admin**, edit a topic and publish it. Then go back to the old version from
   **More → Published versions**.

## What's where

| Folder | What it is |
|---|---|
| `docs/` | The website. GitHub Pages serves this folder as it is: HTML, CSS and JavaScript, no build step. |
| `docs/admin/` | The admin page seniors use. |
| `content/` | The content: one JSON file per topic, the home page settings, details of each file. The admin edits these. |
| `server/campus_api/` | The admin server, a Zoho Catalyst function in Python. It checks the Google sign-in, holds the GitHub key and writes to this repo. |
| `evals/` | The checks, the questions they use, and every scorecard. Start with [evals/README.md](evals/README.md). |
| `prompts/` | [The prompts](prompts/PROMPTS.md) Campus Info was built from, with Claude's replies. |
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
