# How we check Campus Info

The checks were written before the app (Prompt 2), so "working" had a definition before there was anything to look at.

```
node evals/run.mjs              # search, privacy, freshness, links, size: about two seconds
node evals/run.mjs --online     # also tries every outside link
node evals/run.mjs --admin      # also runs the admin end to end on throwaway GitHub branches
```

Each run prints a scorecard and saves the details in `results/` (`latest.md`, plus a JSON file per run).

## The checks

| Check | What it asks | Pass |
|---|---|---|
| **2 a.m. set** | Ten things a scared student types ("ambulance", "friend fainted in hostel", "panic attack"). Is the first result the right topic, and does it have a number to tap? | 10 of 10 |
| **Everyday search** | 70 searches typed the way students type: Hinglish ("cgpa kaise calculate"), typos ("libary open 24 hrs"), short forms ("ccw coupon for parents"). | right topic first for 80%, in the top three for 95% |
| **Nothing on this yet** | 12 questions we don't cover ("gre coaching", "last year placement packages"). Does the app say so, instead of passing off a loosely related topic as the answer? | 11 of 12 |
| **Privacy** | Every bit of text, including what's pulled out of PDFs: no personal mobile numbers, no roll-number emails, none of the removed names. | 0 hits |
| **Freshness** | No date that has passed but still reads as coming up ("apply by 30 September"). | 0 |
| **Links and files** | Every link inside the app goes somewhere and every file is there. Outside links are tried with `--online` and listed for a person to look at. | 0 broken |
| **Slow network** | What the home page costs on the first visit, what the offline copy costs, and whether the offline copy has everything search needs. | home under 150 KB, offline under 500 KB |
| **Admin end to end** | On throwaway branches of the real repo: a stranger is refused; an edit saves and shows in preview; a stale edit is refused and returns the other version; a PDF uploads and becomes searchable after publishing; a rollback brings the old version back; the owner adds and removes an admin without the email reaching the repo; main never moves. | every step |
| **Fresh questions** | 25 questions written *after* the fixes and never tuned on. Shows whether the fixes generalise. | reported only |

The privacy check reads the list of removed names from outside this public repo (`CAMPUS_INFO_PRIVATE`); without it,
it still checks numbers and emails.

## Scorecards

| | 2 a.m. | everyday first · top 3 | nothing yet | privacy | fresh questions |
|---|---|---|---|---|---|
| [First run](results/first-run.md) | **5/10** | 93% · 97% | 12/12 | 0 | (not written yet) |
| [After the fixes](results/after-fixes.md) | 10/10 | 96% · 99% | 12/12 | 0 | everyday 15/15 · urgent 4/5 · nothing yet 4/5 |
| [Final](results/final.md) | 10/10 | 96% · 99% | 12/12 | 0 | urgent 5/5 (the miss above was fixed; see CHANGES.md) |

What changed between them, word by word: [CHANGES.md](CHANGES.md).

## Checked by hand

Some things a script can't judge:

- **On a phone:** open the link in a private window, add it to the home screen on Android and iPhone, turn on airplane mode and search "mess", tap the ambulance number and see the dialler open.
- **Publish to live:** time a real publish until the change shows on the live site. A throwaway branch has no live site, so the end-to-end check can't time this.
