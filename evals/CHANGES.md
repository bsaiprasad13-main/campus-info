# What we changed after the first run, and why

The first scorecard (`results/first-run.md`) passed everything except the 2 a.m. set: **5 of 10**. Everyday search
already passed at 93% first and 97% in the top three. We fixed in the order Prompt 6 gives: privacy, the 2 a.m. set,
"Nothing on this yet", freshness, then everyday search. Words before code, wherever words were enough.

## Privacy (before the first run)

| Change | Why |
|---|---|
| Dropped two personal mobiles with their names, one staff name, and lines from two linked pages that listed student volunteers and club heads with numbers and roll-number emails | Personal details on a public site. Office numbers and official helplines stayed. |
| Search text from official PDFs leaves out any line with a mobile number or a roll-number email | The PDFs stay exactly as published; search just doesn't index those lines. |
| Post ids can't be all digits any more | Two random ids came out as `p8617629142` and tripped the mobile-number check. |
| The private list of removed names doesn't include "Sindhu" | It's also a hostel's name. Her number is still checked. |

## The 2 a.m. set (5/10 → 10/10)

| Query that failed | What it showed | Change |
|---|---|---|
| "friend fainted in hostel" | "fainted" matched "painting" (LitSoc) as a typo | `faint, fainted, fainting, unconscious, collapsed` → ambulance, emergency, hospital |
| "suicidal thoughts helpline" | landed on the ragging helpline | `suicide, suicidal, selfharm` → counselling, helpline, wellness, emergency |
| "panic attack" | landed on a documents page | `panic, anxiety, anxious, stressed, depressed, depression, lonely, homesick` → counselling, wellness, mental; the phrase "panic attack" too |
| "need to talk to someone" | matched Shaastra's guest *talks* | the phrases "talk to someone" and "someone to talk" → counselling |
| "someone is harassing me" | right topic, but POSH/CCASH had no number to call | added campus Security's number (+91 44 2257 9999, already on the site) to its contacts, under "In danger right now?" |
| "friend fainted in hostel", again | with the synonym it still lost to Hostel visitor entry: "friend" and "hostel" outvoted "fainted" | **code**: when a query has an emergency word, topics reached through it rank first (safety first). |

## Everyday search (93% → 96% first, 97% → 99% top three)

| Query | What it showed | Change |
|---|---|---|
| "khana room pe chahiye bimar hu" | Hindi words weren't understood | `khana, bhojan` → food; `bimar, beemar` → sick, unwell |
| "where to eat outside mess" | "mess" pulled the Mess topic to the top | `eat, eating, hungry` → food, restaurant, cafe |
| "can my friend stay in hostel at night" | "night" pulled night buses to the top | `friend, friends, guest` → visitor |
| "places to take parents" | "places" was read as the start of "placements" | **code**: a word that's already a word in the content no longer stretches into longer words. Short ones still do ("prof" → professor). |
| (general) | short forms students use | `prof` → professor, `sem` → semester, `hrs` → hours, timings |

## Found by the fresh questions

After the fixes we wrote 25 new questions (`cases/fresh.json`) and didn't tune on them.
`results/after-fixes.md` shows how they did: everyday 15/15, urgent 4/5, "Nothing on this yet" 4/5.

| Query | Result | What we did |
|---|---|---|
| "accident near hostel" | landed on Hostel council | added `accident, injured, injury, bleeding, fracture, burn, burnt` → ambulance, emergency, hospital. This one is now tuned, so the fresh set can't vouch for it any more. |
| "jee mains result" | answered with Merit scholarships (they mention JEE ranks and results) | left alone. A stricter "covered" rule would start hiding real answers. Noted as a known gap. |

## Admin end to end (24 Nov)

The first run on the real repo failed before any edit: GitHub cuts off files over about 500 KB when it sends many
at once, and the search file is 650 KB. The server now fetches big files one at a time. The next run passed 13 of 13
steps (`results/final.md`).

## Found on 26 Nov, by trying the live app the way a reviewer would

Typing "friend fainted in hostel" into the live app put the right topic first, but the page opened with "Nothing on
this yet", and the Call button only shows when a result counts as the answer. The 2 a.m. check looked only at the
order of results, so it said 10/10 while three of the ten searches looked like this.

| Change | Why |
|---|---|
| **The check:** a 2 a.m. search now also has to be shown as the answer, not under "Nothing on this yet" | That's what a scared student actually sees. With the stricter check, the set scored **7/10** (`results/stricter-check.md`). |
| **Code:** a search with an emergency word or phrase is never told "Nothing on this yet". Its best match is shown as the answer, with its Call button. Ranking doesn't change. The words: `faint, fainted, fainting, unconscious, collapsed, collapse, accident, injured, injury, bleeding, fracture, burn, burnt, suicide, suicidal, selfharm, panic, anxiety, anxious, stressed, depressed, depression, lonely, homesick, harass, harassing, harassed, harassment, stalking, stalker, ambulance, emergency, doctor, fever`, plus the phrases already in search ("talk to someone", "someone to talk", "panic attack", "passed out", "self harm") | At 2 a.m., a wrong "nothing here" costs far more than one extra number on screen. |
| **Result** | 2 a.m. set **10/10** under the stricter check. "Nothing on this yet" still 12/12 (`results/urgent-fix.md`). |

The fresh questions, under the stricter check: urgent 3/5 before the change, 4/5 after. "security guard number
hostel" still opens with "Nothing on this yet", with the right topic first. We left it: adding "security" to the
emergency words would also catch "security deposit", and tuning on the fresh set would stop it from telling us
anything.

Everyday search now also reports right answers that sit under "Nothing on this yet": 4 of 70 ("minimum cgpa to not
get kicked out", "hostel me wifi kaise lagaye", "places to take parents", "sholarship income limit"). A looser rule
would fix these, but it would also start answering questions we don't cover. Real searches after launch should
decide; the app already counts every search that finds nothing.

## Added on 26 Nov: the senior test, and what it found

The search checks show that a student reaches the right page. They don't show whether the page then tells the
student what a senior would. The senior test asks that of the 32 pages about something a student can join, apply
for, compete in or get: what do I get, how do I get in, when, and whom do I ask?

First run (`results/senior-baseline.md`): all four on **4 of 32** pages.

| What it found | What we'll do |
|---|---|
| Only 5 of 32 pages give a phone number or an email to ask. Most councils, fests, teams and scholarship pages name an office or a website at most. | Add official contacts, office and club addresses only, never personal numbers, so the privacy check still holds. |
| Shaastra, Saarang, PoR, SGS, CoCAS, LitSoc and Schroeter don't say how to get in. | Seniors who've been through them write that part. |
| The Avanti Fellows page shows only a link. Its useful text (what you get, the timeline, the selection) is read by search but never shown on the page. | Show that text on the page itself. |

We set no pass bar yet; this run is the baseline. The target is all 32 pages, and we won't make up a contact to get
there.

## Left as they are

- **Outside links:** 4 of 73 didn't open during the check. They are the Digi Mess app (402), one Vidal Health page (404), saarang.org (no answer), and `192.168.0.1`, which is a router's own address inside the Wi-Fi router guide and only works on that router's network. The first three are other people's sites; a senior should look at them, not a script.
- **"Nothing on this yet" leans strict.** A topic has to account for most of what was asked, weighted by how rare each word is. That's why "pg near velachery" says nothing on this yet, even though a bus timetable mentions Velachery.
