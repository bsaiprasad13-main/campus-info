# How we check Campus Info

The checks were written before the app (Prompt 2), so "working" had a definition before there was anything to look at.
The pass bars come from Prompt 2. Claude wrote the scripts and the question sets.

```
node evals/run.mjs              # search, privacy, freshness, links, size: about two seconds
node evals/run.mjs --online     # also tries every outside link
node evals/run.mjs --admin      # also runs the admin end to end on throwaway GitHub branches
```

Each run prints a scorecard and saves the details in `results/` (`latest.md`, plus a JSON file per run).

## The checks

| Check | What it asks | Pass |
|---|---|---|
| **2 a.m. set** | Ten things a scared student types ("ambulance", "friend fainted in hostel", "panic attack"). Is the first result the right topic, shown as the answer (not under "Nothing on this yet"), with a number to tap? | 10 of 10 |
| **Everyday search** | 70 searches typed the way students type: Hinglish ("cgpa kaise calculate"), typos ("libary open 24 hrs"), short forms ("ccw coupon for parents"). Also reports right answers that still open with "Nothing on this yet". | right topic first for 80%, in the top three for 95% |
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

On 26 Nov the 2 a.m. check got stricter: the answer also has to be shown as the answer. Rows before that date
count only the order of results.

| | 2 a.m. | everyday first · top 3 | nothing yet | privacy | fresh questions |
|---|---|---|---|---|---|
| [First run](results/first-run.md), 24 Nov | **5/10** | 93% · 97% | 12/12 | 0 | (not written yet) |
| [After the fixes](results/after-fixes.md) | 10/10 | 96% · 99% | 12/12 | 0 | everyday 15/15 · urgent 4/5 · nothing yet 4/5 |
| [Final](results/final.md), 24 Nov | 10/10 | 96% · 99% | 12/12 | 0 | urgent 5/5 (the miss above was fixed; see CHANGES.md) |
| [Stricter check](results/stricter-check.md), 26 Nov | **7/10** | 96% · 99% | 12/12 | 0 | urgent 3/5 |
| [After the fix](results/urgent-fix.md), 26 Nov | 10/10 | 96% · 99% | 12/12 | 0 | everyday 15/15 · urgent 4/5 · nothing yet 4/5 |

The admin end to end failed its first run on the real repo (GitHub cuts off big files) and passed 13 of 13 steps
after the fix, on 24 Nov. What changed between runs, and why, word by word: [CHANGES.md](CHANGES.md).

## What's checked, and what's still a guess

**Checked:**
- Search, against 117 questions: the 2 a.m. set, everyday, "Nothing on this yet" and the fresh set.
- Privacy, freshness, links and size, on every run.
- The admin, end to end on the real repo, and two real publishes that went live 31 seconds after the click.

**Still a guess until students use it:**
- **How students type.** The questions follow the examples in Prompt 2, but none of them is a logged search from a
  real student yet.
- **What counts as urgent.** The 2 a.m. set assumes the worst moment is a medical or safety emergency at night.
- **When to say "Nothing on this yet".** It leans strict. Four everyday questions with the right answer first
  still open with it, because loosening it would start answering questions we don't cover.

## After launch: what tells us it's working

None of the checks above shows whether a fresher learns something they didn't know, or comes back. The app already
counts these in Google Analytics, without names, and nothing is counted in preview:

| Question | What's counted |
|---|---|
| Do people come back? | weekly users |
| Does search find things? | every search, and every search that found nothing (`search`, `search_nothing`) |
| Were the answers useful? | "Was this useful?" yes and no, per topic (`helpful`) |
| Do people act on it? | taps on a number or an email, files opened (`contact_tap`, `file_open`) |
| What's missing? | the words of each search that found nothing, and the "Ask for…" form |

The searches that found nothing become the next topics, and the next test questions.

## Checked by hand

Some things a script can't judge:

- **On a phone:** open the link in a private window, add it to the home screen on Android and iPhone, turn on airplane mode and search "mess", then open Emergency, tap Ambulance and see the dialler open.
- **Publish to live (measured 24 Nov):** two real publishes from the admin went live 31 s after the click (GitHub Pages built each in 28 s). Pass: under three minutes. The same test found a bug: a reload in an open tab still showed the old version, because GitHub's CDN keeps files for 10 minutes. Data is now requested under a fresh address on every load.
