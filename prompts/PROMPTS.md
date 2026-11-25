# The prompts Campus Info was built from

Campus Info was built with Claude Code from these prompts, in this order. Prompts 1 to 6 were written before any
code. Prompt 7 came in just before the build started. What changed after the first scorecard, and why, is in
[evals/CHANGES.md](../evals/CHANGES.md).

## Prompt 1: Who it's for, and the content

Plenty of first-years, three months in, have heard "HAS" and "CCW" thrown around and couldn't tell you what either one does. Many haven't heard of the Wellness Centre, or of UGRP, the research programme for undergraduates. Campus Info is for them, and for second-years: one website about student life at IIT Madras that they can save to their home screen and search in their own words. Seniors keep it current.

The content is already in the `content` folder: 76 topics in seven groups and the files that go with them, written by IITM students from official sources and their own experience. Clean it first. It's about to go on a public website.

- Personal mobile numbers go, and so do the names next to them: student volunteers, club heads, individual staff. Office landlines, official helplines and office email IDs stay.
- Student email IDs made from roll numbers go.
- Skip topics marked hidden. Drop internal post ids, authors and old timestamps.
- A few lines only made sense where they were first written ("as mentioned above", "message me for details"). Rewrite them for someone who lands on the page from a search.
- Some posts announce things that have already closed. Make those evergreen or drop them, and keep a list of what you changed; the checks will need it.
- Official PDFs stay exactly as they are, even where they print office numbers. The Tech Guilds deck is 67 MB and nobody will open it on mobile data, but it stays as a download.

Then tell me what you removed, counted by type, and every line you weren't sure about. I'd rather go through twenty doubtful lines than miss one personal number.

Not in this build: a chatbot, student accounts, comments, notifications.

## Prompt 2: The checks, before any code

Write the checks first, so we agree on what "working" means before there's anything to look at. They go in an `evals` folder. One command runs all of them and prints a scorecard short enough to read on a phone.

The set I care about most is the 2 a.m. one: ten things a scared student might type, like "ambulance", "friend fainted in hostel", "ragging helpline", "need to talk to someone". The right topic comes first, with a number they can tap to call. Pass: 10 out of 10.

Then everyday search, about 60 questions typed the way students type:

> mess change kab tak · cgpa kaise calculate · has kya hai · ccw coupon for parents · lan not working hostel · iddd eligibility · scholarship income limit · library open 24 hrs

Lowercase, misspelt, half in Hindi or Tamil, short forms everywhere. Each one names the topic that answers it. Pass: the right topic first for 80% and in the top three for 95%. I don't know yet how many students really search in Hinglish. Analytics will show us after launch, and if it's very few, we stop adding those words.

A dozen questions we don't cover, say GRE coaching or last year's placement packages. The app has to admit it, in roughly these words: "Nothing on this yet. Tell us what you were looking for and a senior will add it." Passing off a loosely related topic as the answer is a fail. Pass: 11 of 12.

Privacy: scan all the text, including what gets pulled out of files, for personal mobile numbers, roll-number email IDs and the names we removed. Only the approved office and helpline numbers may appear. Pass: zero hits.

Freshness: catch any date that has passed but still reads as coming up ("apply by 30 September"). Pass: zero.

Links and files: every link in the app lands somewhere, and every file opens. Pass: zero broken.

Slow network: the home page shows after less than 150 KB has come down, everything needed to work offline (files aside) stays under 500 KB, and after one visit the app opens and searches in airplane mode.

The admin, end to end, on a throwaway copy and never the live site: a stranger can't get in; an edit saves itself and shows in preview; a publish reaches the live site in under three minutes; two people editing one topic don't overwrite each other; a rollback brings the old version back; an uploaded PDF becomes searchable.

Expect most of this to fail on the first run.

## Prompt 3: What students see

No app store. A plain website that installs to the home screen and stays light enough for hostel Wi-Fi.

The home page is an index, like the one at the back of a printed handbook: every topic from A to Z with a line on what it covers, and a column of letters down the right edge to jump with. I chose this over a grid of category boxes on purpose. A fresher doesn't know yet that sick food is filed under Hostel, or that L-TAP exists at all; scrolling one list, they'll run into things they didn't know to look for. It has a cost: 76 entries is a long scroll on a small phone, which is what the letters and the search are for. Entries start with the word a student would look under, so "What is Saarang?" sits under S, not W.

Above the index, in this order:
- a thin strip that never goes away, with Ambulance 2257 8888 and Security 2257 9999 (tap to call, offline too) and a link to the full emergency list;
- the search line;
- the group names as plain words (Academics, Hostel, Scholarships…) that narrow the index when tapped;
- "New here?", the five or six topics marked for freshers.

Searching narrows that same index as you type, and the matching words get a yellow mark, like a highlighter on a printout. Topics where the words only turn up deep in a post or inside a PDF come after a line that says "Mentioned inside". Typos and short forms should still find things. When nothing fits well, show the "Nothing on this yet" line with the feedback link; anything that merely mentions the words can sit below it.

A topic page runs top to bottom: title, one line on what it covers, the posts, then every phone number and email in that topic gathered into a contacts block (tap to call, tap to mail), the files with their sizes, and two or three other topics from the same group.

White page, black text, yellow as the only colour, and a dark version for phones set to dark. No cards, no emoji icons, no gradients, no web fonts.

Topics carry no dates. I don't love that, because a student can't tell how old a single post is; the freshness check is our guard against stale ones. The footer shows "Content updated" with the date of the last publish, the feedback link, and one line on who writes this: IITM students, from official sources and their own experience.

Google Analytics counts searches, and separately the searches that found nothing; topic opens; file downloads; call and email taps. Nothing is counted in preview.

## Prompt 4: The admin

Seniors will keep this current from their phones, without touching code. A mistake here reaches every student at once.

Sign-in is with Google, and only accounts on the admin list get in. I'm the owner and I manage the list. GitHub Pages only serves files, so a small function on Zoho Catalyst sits in between: it checks the sign-in, holds the GitHub key and writes the changes. That's one more thing that can break. I'll take that over asking every senior to learn GitHub. Edits go to a `draft` branch; `main` is what students see.

What they can do: find a topic; change its title, summary, group and tags; mark it for freshers; hide it; write posts in simple Markdown with a preview alongside; drag posts and topics into order; attach PDFs and images (text inside PDFs becomes searchable); edit the emergency strip and the "New here?" list.

Now the list that matters more. These must never happen:

1. Someone loses what they typed. Saving is automatic, and if the network drops halfway, the text waits and goes through when it's back.
2. The sign-in expires mid-edit and takes the work with it. Let them sign in again on the spot and carry on.
3. Two seniors edit one topic and one quietly overwrites the other. The second person gets told, and both versions survive.
4. Something goes live by accident. Only Publish changes what students see; it asks for a one-line note, and the site updates within a few minutes.
5. A bad publish is stuck there. Every publish is kept with who and when, and I can roll back to any of them.

Preview shows the draft exactly as a student would see it.

## Prompt 5: For the reviewers

The people reviewing Campus Info won't be on the admin list, so everything in prompt 4 sits behind a sign-in they can't get past. Put a "Try the admin" button on the sign-in screen. It opens the same admin on a practice copy of the live content, with no sign-in, and saves only in that browser; publishing there changes only their own preview. A banner says so ("Practice copy. Nothing you do here reaches the real site."), next to a button to start over.

## Prompt 6: Fix it, ship it, try it on a phone

Run every check and show me the first scorecard as it is, failures included. Fix in this order: privacy, the 2 a.m. set, "Nothing on this yet", freshness, then everyday search. For search, change words before code: add the words students actually type to the topics' tags or to a synonym list, and note each word and why. Then run everything again and keep both scorecards side by side.

Then put it live: a public repo called campus-info, served by GitHub Pages. Anyone can read a public repo, and that's fine; the content is public anyway. Only I can push, though. `main` can't be deleted or force-pushed, and anyone else can at most suggest a change I'd have to accept. I'll send you the new Google Analytics ID and the feedback form link.

Add a short README: what Campus Info is, how a senior edits it, how to run the checks.

Then open the link in a private window. Add it to the home screen on an Android phone and an iPhone. Turn on airplane mode, search "mess", and tap the ambulance number to see the dialler open with it.

## Prompt 7: Make the value obvious

Make sure the structuring of the website is good, and the value should be clearly visible to the person who is
coming to the website. Don't just follow what is best. Think about what is required, and make sure the value is
conveyed properly and clearly to whoever is opening the website. If you have any ideas, include them.

### What Prompt 7 changed

- The home page opens with what the site is for: "What IIT Madras offers you, and whom to ask." Below it are three
  numbers: topics, official documents, and phone numbers and emails.
- Every topic ends with a "Who to contact" block, so the answer to "whom to ask" is always the last thing you read.
- "Was this useful?" on every topic, and a link from any search that finds nothing, so seniors learn what's missing.
- A "Share this page" button. Most answers travel through group chats.

## Prompt 8: Make it something you'd want to open

It works, but it isn't attractive. There's no search icon, no logo and no tagline, and the buttons don't look like
buttons. Take "IIT Madras" off the top right; we shouldn't lean on the college's name, so say in the footer who
builds it instead. Add some colour, but soft, not heavy. And don't add features to make up for it: fewer things,
each one worth having. Show me two versions side by side before you touch the real site.

### What Prompt 8 changed

Two looks were built as a separate mock-up, next to the live site, on the same content. The warm one was picked.

- A bookmark logo with "ci" (also the app icon) and the tagline "Everything a senior would tell you."
- "IIT Madras" left the header. The footer now says "Built and kept up to date by IITM students. Not an official
  institute website."
- Cream paper, navy ink, the icon's yellow, and a soft colour for each group, so a topic's group shows at a glance.
- A real search box with an icon and a clear button. It stays at the top while you scroll the index.
- Groups became pills with small icons that you swipe sideways.
- On a topic, a short "Whom to ask" list now sits under the title with Call buttons, instead of at the end. The three
  topics that are mostly a list of numbers keep it at the end, with a link to it at the top.
- The three big numbers became three small tags, and the intro is one line.
- Nothing new was added. Ideas like "recently opened" and per-topic jump lists were dropped as not worth the extra
  things to learn.

## Prompt 9: Split the home page, and show people where they are

Give it a nav bar: Home, Topics, Emergency, and the feedback form. Put it where a nav bar usually goes, at the top
right. Not everything has to sit on the home page; split it up.

The home page opens with "A place for you to…" and then: "Find out what you need to know, where you need to go, what
you can explore and whom you can reach out to at IIT Madras." Highlight the phrases that matter. Drop the tags with
"76 topics" and "numbers tap to call"; students don't care, and that kind of explanation belongs on the About page.
Put the option to install it as an app there instead, and say it works offline. Then the search bar. "New here? Start
with these" is fine; suggest changes only if they help.

The emergency strip moves into the nav. The A to Z list gets its own page, reached from the nav. No topic counts
anywhere.

The search should take you to where the information actually is. And every page should show the path to it, so you
know how deep you are and can climb back up yourself.

Look at how Free Rooms is put together and take what fits; don't copy it. Write the "What is this?" the way its Read
Me is written: what Campus Info is, who it helps most, what's in it, and why it's worth opening. Keep it short.

The logo loses the "ci". Just the bookmark.

The letters down the side are a good idea, but they're small, and nothing shows which section you're in. Don't just
make them bigger; find a better way.

The admin looks like a default page and its buttons are sharp. Round them and make it look as good as the site.

Keep the whole thing simple. More features don't make it easier to use; they make it harder to see what it's for.

### What Prompt 9 changed

Three choices were settled before building: on a phone the nav gets its own row under the logo, the areas live on the
Topics page, and the logo is a plain bookmark.

- **Nav:** Home · Topics · Emergency · Feedback. Top right on a laptop; on a phone, a row under the logo that stays on
  screen. Emergency is the one red item, so the ambulance number is still one tap from any page.
- **Home:** the new headline with the four phrases marked, an install card (Android installs; iPhones get the two
  steps), the search bar, and "New here?", now ordered by when a fresher needs each thing.
- **Topics:** the A to Z list, with the areas as pills at the top. Each letter's heading stays pinned while you're in it.
- **Emergency:** big Call buttons for the numbers seniors pick, then every emergency number.
- **Where you are:** a trail on every page, like ⌂ › Topics › Hostel › Mess coupons.
- **Search lands on the answer:** each result says where in the topic the words are; opening it scrolls to that line
  with the words marked. An area's name offers the whole area, and if the best answer has a phone number, its Call
  button is right in the results.
- **The letter rail:** the letter you're in lights up. Sliding a thumb along the rail shows a big letter and jumps the
  list, so the letters stay small but are easy to hit.
- **What is this?:** five short paragraphs, written like the Free Rooms Read Me. The same text opens the README.
- **Admin:** same screens and buttons; rounded, in the site's colours, with Publish as the one dark button.
