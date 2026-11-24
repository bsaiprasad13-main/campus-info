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

## Left as they are

- **Outside links:** 4 of 73 didn't open during the check. They are the Digi Mess app (402), one Vidal Health page (404), saarang.org (no answer), and `192.168.0.1`, which is a router's own address inside the Wi-Fi router guide and only works on that router's network. The first three are other people's sites; a senior should look at them, not a script.
- **"Nothing on this yet" leans strict.** A topic has to account for most of what was asked, weighted by how rare each word is. That's why "pg near velachery" says nothing on this yet, even though a bus timetable mentions Velachery.
