# The prompts Campus Info was built from, and what came back

Campus Info was built with Claude Code from these prompts, in this order. Prompts 1 to 6 were written before any
code. Prompt 7 came in just before the build started. Prompts 8 to 10 came after it went live, from using it.
What changed after the first scorecard, and why, is in [evals/CHANGES.md](../evals/CHANGES.md).

Under each prompt is what Claude said back, in its own words. Prompts 1 to 7 went in together and were built in one
run, so the short notes Claude wrote along the way sit under the prompt they belong to, and its report at the end,
with what followed, sits under Prompt 7. Prompts 8 to 10 were each a short back-and-forth: each one puts together
what I asked over a message or two, and my answers in between are in square brackets.

The quotes are cut but never reworded. "[…]" marks a cut inside a quote, and under Prompts 1 to 6 only the notes
with a result or a decision in them are shown. What's left out: account setup steps, file paths on my laptop,
reminders of what was still mine to do, and a few side remarks.

---

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

### Claude's notes while building it

> The personal data is small, as expected. Now I'm writing the import and clean-up tool. It goes in a private folder outside the repo, because it has to list what it removes.

> The import works: 76 topics, 267 posts and 21 files, with every personal number and name removed. I'm fixing two formatting leftovers, then moving to the checks.

> Content is clean. Next I'm creating the new GitHub repo, still empty, so you can make its access key while I keep building. Nothing gets pushed until the privacy check passes.

The count by type and the doubtful lines went into a report file next to the clean-up tool, not into a reply. The
report as written:

```
# Content import report

- closed announcements dropped: 1
- emoji removed: 1929
- files: 21
- files not carried over: 1
- lines rewritten: 4
- lines with personal contacts dropped from file text: 4
- lines with personal contacts dropped from linked page text: 6
- personal lines removed (label): 1
- personal lines removed (mobile): 1
- personal lines removed (name): 2
- personal lines removed (name+mobile): 1
- posts: 267
- repeated titles removed: 40
- separator lines removed: 286
- topics: 76
- topics skipped (hidden): 1

## Not sure about

- institute-hospital: mobile-looking number left in a post: 6736517283
```

*[Checked on 25 Nov: 6736517283 is the App Store ID inside the link to the hospital's app, not a phone number.]*

---

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

### Claude's notes while building it

> […] I'm writing the checks first, as Prompt 2 says. These are the question sets, typed the way students type.

> Privacy passes. Next is the app itself (Prompt 3), starting with the build step that turns the editable content into the two files the website reads.

> They're false alarms. Two random post IDs came out all digits ("p8617629142") and look like mobile numbers. I'll give those posts IDs with letters, and make the ID generator always include one.

> Privacy is back to zero. […]

---

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

### Claude's notes while building it

> […] Now the student app itself: the page shell, styles and app logic, following the layout you approved, with the value statement on top.

> Now the styles: white page, black text, yellow only where something is marked, and a dark version.

> Now the icons: a yellow square with a black "ci", generated by a small script so they can be remade any time.

> Every check that exists so far passes except the 2 a.m. set (5 of 10), which I'll fix in the Prompt 6 order. The home page is 96 KB, and the whole offline copy is 245 KB. Now a topic page.

> The contacts block works. Two fixes: numbers wrap mid-number, and repeated labels like "Wellness Centre" take five rows. I'll keep numbers on one line and group them under one label.

---

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

### Claude's notes while building it

> Now the service: who can sign in, and what save, upload, preview, publish, history, rollback and admins do.

> All 11 server tests pass. Now the local admin API, so I can drive the admin in the browser against an in-memory copy of the real content, with GitHub untouched.

> Now the admin page itself, the part seniors use. One file of plain JavaScript with two backends behind the same calls: the real server, and a practice copy kept in the browser for reviewers.

> The sign-in screen renders. Testing a stranger first, then signing in as the owner.

> The conflict case works the way Prompt 4 asks. The second person is told, their version stays, and my text is shown so I can copy it back. Now publishing, history and rollback.

> Publish, history and rollback all work, and the bad title is gone after going back. Next: upload a file into a post, then preview.

> Upload works: the file is attached and counted as unpublished. Now the preview.

> Found a bug: the Preview button passed the click event in place of the topic, so the address ended in "[object PointerEvent]". Fixing it, then checking the preview page.

> The preview shows the draft with a banner, and the new file is served from the draft branch. […]

---

## Prompt 5: For the reviewers

The people reviewing Campus Info won't be on the admin list, so everything in prompt 4 sits behind a sign-in they can't get past. Put a "Try the admin" button on the sign-in screen. It opens the same admin on a practice copy of the live content, with no sign-in, and saves only in that browser; publishing there changes only their own preview. A banner says so ("Practice copy. Nothing you do here reaches the real site."), next to a button to start over.

### Claude's notes while building it

> […] Now the reviewer path: "Try the admin", the practice copy.

> Practice publish, history and rollback all work, and everything stays in the browser. A quick look at the admin at phone width, since seniors will edit from phones:

> The admin works at phone width too. […]

---

## Prompt 6: Fix it, ship it, try it on a phone

Run every check and show me the first scorecard as it is, failures included. Fix in this order: privacy, the 2 a.m. set, "Nothing on this yet", freshness, then everyday search. For search, change words before code: add the words students actually type to the topics' tags or to a synonym list, and note each word and why. Then run everything again and keep both scorecards side by side.

Then put it live: a public repo called campus-info, served by GitHub Pages. Anyone can read a public repo, and that's fine; the content is public anyway. Only I can push, though. `main` can't be deleted or force-pushed, and anyone else can at most suggest a change I'd have to accept. I'll send you the new Google Analytics ID and the feedback form link.

Add a short README: what Campus Info is, how a senior edits it, how to run the checks.

Then open the link in a private window. Add it to the home screen on an Android phone and an iPhone. Turn on airplane mode, search "mess", and tap the ambulance number to see the dialler open with it.

### Claude's notes while building it

> Now Prompt 6: run every check and keep the first scorecard as it is, failures included. I'm including the outside-link check this time.

> The urgent set is now 5 of 5 on fresh questions too. Now the write-ups: the change log Prompt 6 asked for ("each word and why"), the evals guide, the prompts as used, and the README.

> Now the admin end-to-end check. It runs against the real GitHub repo on two throwaway branches and never touches `main`. It needs the GitHub key, so it runs once you've added it.

> Pushed. GitHub warned about the 64 MB deck, as expected, and accepted it. Now turning on GitHub Pages from `docs/` and locking `main` against deletion and force-pushes.

> Pages is on, and `main` is now protected against deletion and force-pushes. […]

> The site is live. The first Pages build took about a minute, and the site, its data and the admin all respond. […]

> All 11 files are in the offline copy on the live site. Now "Try the admin" on the live site, which is the reviewers' path:

> "Try the admin" works on the live site too. […]

*[The scorecard, and what was still open, are in Claude's report under Prompt 7.]*

---

## Prompt 7: Make the value obvious

Make sure the structuring of the website is good, and the value should be clearly visible to the person who is
coming to the website. Don't just follow what is best. Think about what is required, and make sure the value is
conveyed properly and clearly to whoever is opening the website. If you have any ideas, include them.

### Claude's report at the end of the build

> Campus Info is live and works without any sign-in, including "Try the admin". Real Google sign-in for seniors is the one piece left, and it's waiting on the setup values from you.
>
> - **Site:** https://bsaiprasad13-main.github.io/campus-info/
> - **Admin:** https://bsaiprasad13-main.github.io/campus-info/admin/. Reviewers press **Try the admin**: a practice copy in their own browser with no sign-in. Editing, attaching files, preview, publish, history and rollback all work there.
> - **Repo:** https://github.com/bsaiprasad13-main/campus-info. It's public, `main` can't be deleted or force-pushed, and the [prompts](https://github.com/bsaiprasad13-main/campus-info/blob/main/prompts/PROMPTS.md) and [evals](https://github.com/bsaiprasad13-main/campus-info/blob/main/evals/README.md) are linked from the README.
>
> **How the value comes across:** the page opens with "What IIT Madras offers you, and whom to ask.", then three numbers: 76 topics, 21 official documents, 91 phone numbers and emails. The ambulance and security numbers sit in a strip on every page. Below that is "New here?", then the A-to-Z index, and every topic ends with a "Who to contact" block. My own additions: "Was this useful?", share, and a search that finds nothing offers to send that search to the seniors.
>
> **Evals.** I wrote them before the code, as Prompt 2 says. The first run is kept, failures included:
>
> | Check | First run | Now |
> |---|---|---|
> | 2 a.m. set (urgent searches) | 5/10 | 10/10 |
> | Everyday search, right topic first | 93% | 96% |
> | Everyday search, in the top three | 97% | 99% |
> | "Nothing on this yet" | 12/12 | 12/12 |
> | Privacy | 0 hits | 0 hits |
>
> The failures taught real things: "fainted" was typo-matched to "painting", and "talk to someone" matched Shaastra's guest talks. The fix was a safety-first rule: an emergency word now puts emergency topics on top. I then wrote 25 new questions I hadn't tuned on. They exposed a missing "accident" word, which is now fixed. One gap I left: "jee mains result" gets matched to the merit scholarships page.
>
> **Not done yet:**
> - The admin end-to-end check against real GitHub hasn't run; it needs the GitHub key.
> - How long a real publish takes to show is unmeasured. The site's first build went live in about a minute.
> - The phone test is yours.
>
> […]
>
> Once these arrive, I'll deploy the server, switch on Google sign-in, analytics and feedback, run the GitHub check and time a real publish. Then you do a 5-minute phone test.
>
> […]

*[Later, once I'd added the sign-in keys and sent the analytics ID and the form link:]*

> Everything is connected and pushed. The live site updates within about a minute.
>
> - **The server** is live on Catalyst. It answers, rejects a fake sign-in, and accepts calls only from your site's address.
> - **Google Analytics** (`G-2QR921947Y`) now counts searches, searches that found nothing, topic opens, and number and email taps.
> - **The form:** a search that finds nothing, and the "Not really" answer under a topic, both open your form with the search or topic already filled in.
> - **All checks still pass**, and the end-to-end admin check passed 13 of 13 on the real repo earlier.
>
> […]

*[I then signed in and published two small edits. That worked, but reloading a tab that was already open kept showing the old version, while a link opened fresh showed the change. I asked Claude to check.]*

> You were right. A reload in a tab that was already open could keep showing the old version for up to 10 minutes. That's fixed and live now.
>
> **Why:** GitHub's servers keep a copy of each file for 10 minutes. A reload asked for "a newer copy if there is one", but GitHub sent the saved one anyway, and the offline layer stored that old copy too. A link opened fresh from this chat happened to get past it.
>
> **The fix:** each time the page loads, it now asks for its data under a slightly different address, so no saved copy can answer, and the offline copy still works. All the checks still pass.
>
> **One time only:** a tab that's already open is still running the old code. Close it, or reload twice; after that, one reload always shows the latest.
>
> **Your publishes, measured:** both went live about 31 seconds after you clicked Publish, well under the 3-minute target. I've added that timing and this bug to the evals guide, since your test is what found it.
>
> […]

---

## Prompt 8: Make it something you'd want to open

It works, but it isn't attractive. There's no search icon, no logo and no tagline, and the buttons don't look like
buttons. Take "IIT Madras" off the top right; we shouldn't lean on the college's name, so say in the footer who
builds it instead. Add some colour, but soft, not heavy. And don't add features to make up for it: fewer things,
each one worth having. Show me two versions side by side before you touch the real site.

### Claude's replies

*Two messages went into this prompt. The first asked for ideas before anything changed; the second, after Claude's
ideas, asked for soft colour, fewer features and two versions side by side.*

> I agree with most of this. The site works, but it reads like a printed page, and the things that make an app feel easy to use are missing: icons, a clear search box, a real logo, buttons that look tappable. Here's how I'd change it, with my recommendation for each.
>
> **1. Name, logo, tagline**
>
> **Logo:** the yellow "ci" square is too small and plain to read as a logo. Options:
> - **A.** A bookmark shape with "ci" cut into it ("the page you keep coming back to").
> - **B.** A map pin with an "i" inside ("information, on campus").
> - **C.** A speech bubble with "?" ("the questions you'd ask a senior").
>
> **My pick: A.** It fits "a handbook you keep", and it stays recognisable at phone-icon size.
>
> **Tagline**, a short line under the name that says what it's for:
> - "Everything a senior would tell you."
> - "Your campus, explained by seniors."
> - "Ask less. Find more."
> - "Know what's yours on campus."
>
> **My pick: "Everything a senior would tell you."** It says the value, who's behind it, and why to trust it, in six words.
>
> **2. The college name**
>
> You're right to worry. The risk isn't saying "IIT Madras"; it's looking like an official institute site.
> - **Remove** "IIT Madras" from the top right.
> - **Keep the college named once in the page text**, otherwise a visitor can't tell which campus this is for. For example: "for IIT Madras students".
> - **Footer:** "Built and kept up to date by IITM students. Not an official institute website." That's honest and protects you.
>
> […]
>
> **3. Buttons and the search box**
>
> - **Search:** make it a proper box, with a search icon, rounded, sticky at the top as you scroll, and a clear (✕) button inside.
> - **Groups** (Academics, Hostel…): they currently look like plain text, so people don't know they can tap them. Make them tappable pills with a small icon each (book, bed, rupee, heart, flag…) in a row you can swipe.
> - **"Was this useful?":** two clear buttons with thumb icons.
> - **Emergency strip:** add a phone icon next to each number, so it obviously dials.
> - **Topic page:** a "Call" button beside each number, not just underlined text.
>
> **4. What I'd remove or shrink**
>
> - **The three-number row** ("76 topics · 21 documents · 91 numbers"): reviewers like it, students don't need it. Shrink it to one quiet line under the tagline, or drop it.
> - **The long intro paragraph:** cut it to one line. The tagline does the job.
> - **The A–Z letter rail:** keep it, but only once you scroll into the list (it already behaves this way).
> - **"For seniors: edit"** stays in the footer, small. That's the right place.
> - **The About page:** keep it, but shorter.
>
> **5. Making it smoother**
>
> - **Recently opened:** show the last 3 topics you opened at the top. Returning students are the main users.
> - **Long topics:** add a small "On this page" list of jump links, since some posts are long.
> - **Emergency topics:** show "Who to contact" at the top for Emergency, Hospital, Ragging and Counselling, not at the bottom.
> - **A back-to-top button** on long pages.
>
> **What I'd keep as it is**
>
> - The single A–Z list with search on top. The structure is right; it's the look that's thin.
> - The yellow highlight on matched words. It's the one distinctive touch.
> - No cards and no heavy colours. Adding icons and proper buttons gets the polish without making it look like every other template.
>
> **Your decisions**
>
> 1. Logo: A, B or C?
> 2. Tagline: one of the four, or your own?
> 3. Footer line: OK as written?
> 4. The three-number row: shrink or drop?
> 5. Of the smoother extras (recently opened, "On this page", contacts on top for emergencies), which do you want?
>
> If it's easier to decide by looking, I can build a separate mock-up page in the preview with two versions side by side. It wouldn't touch the live site. Changes to the real site wait for your "Now you can proceed".

*[Then my second message.]*

> I've built the mock-up in the browser pane: three phones side by side, all working. You can scroll, search and tap inside each one. The buttons along the top switch all three phones to the same screen: home, a topic, a topic with phone numbers, a search, a search we don't cover, and a group.
>
> - **Now:** today's site, unchanged, for comparison.
> - **A · Clean:** white page with one calm teal colour for everything you can tap, and a soft red emergency strip.
> - **B · Warm:** cream page that keeps today's yellow as the brand colour, with a soft pastel colour for each group (hostel purple, academics blue, and so on).
>
> The live site and the repo haven't changed. […]
>
> **What both new looks change**
> - **Logo and tagline:** a bookmark logo with "ci", and "Everything a senior would tell you." under the name. "IIT Madras" is gone from the top right; the college is named only in the headline.
> - **Search:** a proper rounded box with a search icon and a ✕ to clear it. It stays at the top while you scroll the A–Z list.
> - **Groups:** tappable pills with small icons that you swipe sideways. The group you picked is always visible in the row.
> - **Phone numbers:** a phone icon on the emergency numbers. On a topic page, numbers are real Call buttons, in a "Whom to ask" box right under the title. The three topics with long contact lists keep them at the end, with a small "N contacts below" link at the top.
> - **Buttons:** "Was this useful?" has thumbs, and Back and Share look like buttons.
> - **Footer:** "Built and kept up to date by IITM students. Not an official institute website."
>
> **What I took out**
> - The three big numbers became three small tags: "76 topics · Numbers tap to call · Works offline".
> - The intro is down to one line.
> - I dropped my earlier extras (recently opened, "On this page" jump lists, back-to-top). I agree with you: they'd add things to learn without adding much value. Each change above is a look change to something that's already there.
>
> **My pick is B.** It gives the colour you asked for without being heavy, it keeps the yellow from the app icon, and the group colours help a student see at a glance where a topic belongs. If the coloured group tags on every row feel busy, I can make those plain and keep colour only on the pills.
>
> Tell me A or B (or a mix, like "B but without row colours"), plus any wording changes. When you say "Now you can proceed", I'll apply it to the real site, rerun the checks and push.

*[I replied "B looks good", and said yes when Claude asked whether to put it live.]*

> Look B is now live at https://bsaiprasad13-main.github.io/campus-info/ (commit `f209e08`). I opened the live page on a phone-sized screen after the push and it showed the new look.
>
> **What changed on the real site**
> - **Brand:** a yellow bookmark logo with "ci". It's also the new app icon on the home screen and the browser tab, and the admin page uses it too. The tagline under the name is "Everything a senior would tell you."
> - **College name:** "IIT Madras" is gone from the header and appears only in the headline. The footer says "Built and kept up to date by IITM students. Not an official institute website."
> - **Colour:** cream background, navy text, the icon's yellow, and a soft colour for each group.
> - **Search:** a rounded box with a search icon and a clear button, which stays at the top while you scroll.
> - **Groups:** pills with icons that you swipe sideways.
> - **Emergency strip:** both numbers fit on one line, even on a small 360 px Android screen.
> - **Topic pages:** a short "Whom to ask" box with Call buttons sits right under the title. "Was this useful?" has thumbs buttons, and Back and Share look like buttons.
> - **Less to read:** the three big numbers are now three small tags, and the intro is one line. No new features were added.
>
> **Two fixes beyond the mock-up**
> - On a 375 px phone the strip's "More" link was cut off, so I tightened the strip.
> - The admin header read "Campus Infoadmin" with no space between the words. That was an older bug, now fixed.
>
> **Checks:** all passed again. The 2 a.m. set scored 10/10, everyday search 96% first and 99% in the top three, "Nothing on this yet" 12/12, with 0 privacy hits. The home page is now 100 KB (limit 150). […] I didn't rerun the admin end-to-end test because the admin server didn't change.
>
> I also added this round to `prompts/PROMPTS.md` as Prompt 8, in the same voice as the others.
>
> **Phones that already opened the site:** they get the new look on their next load. The home-screen icon may keep the old yellow "ci" square until the phone refreshes it.
>
> […]

---

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

### Claude's replies

> I went through Free Rooms (its code and the live app on a phone) and the admin page, and read your message line by line. Below is how I'd shape the changes and why. Three decisions are yours; they're in the questions at the end.
>
> **What I'm taking from Free Rooms**
>
> - **Controls first, answers below.** Free Rooms stacks a brand row, then day tabs, then search, then building chips, and the room list underneath just answers. Campus Info gets the same order: brand, then nav, then (on the home page) search.
> - **The explanation sits behind a button.** Free Rooms keeps its "Read Me" behind a button at the top right. Campus Info gets a "What is this?" in the same spot.
> - **Short explanation, one idea per paragraph.** Its "What is this?" is four short paragraphs, each with one highlighted phrase. I wrote ours that way (draft below).
> - **A slim install banner.** Its "works offline too" banner becomes the install card you asked for.
> - **Everything is rounded.** That's also the fix for the sharp buttons on the admin page.
>
> **The pages**
>
> **Nav: Home · Topics · Emergency · Feedback** (Feedback is your Google Form). On a laptop it sits at the top right, as you described. On a phone, four words don't fit beside the logo, so I'd give them their own row under it (question 1).
>
> **Home, top to bottom:**
> 1. **A place for you to…** then "find out *what you need to know*, *where you need to go*, *what you can explore* and *whom you can reach out to* at IIT Madras." The four phrases get a soft yellow marker underline, the same yellow that marks your words in search. […]
> 2. **An install card** in place of the three tags: "Install Campus Info. Opens like an app and works offline." On Android the button installs it. iPhones don't allow a website to show that button, so there it shows the two steps instead (Share, then Add to Home Screen). The card hides inside the installed app and has a × to close it.
> 3. **The search bar.**
> 4. **"New here? Start with these."**
>
> The emergency strip, the counts and the A–Z list all leave the home page.
>
> **Topics:** the A–Z list moves here. The seven areas become the pills at the top of the page, the way Free Rooms has building chips. "76 topics" and "11 topics" are gone everywhere.
>
> **Emergency:** today the ambulance number is one tap away on every page, and moving it into the nav shouldn't make it slower. So Emergency is the one red item in the nav and is always on screen. It opens a page of big Call buttons: Security, Ambulance, Hospital, Wellness Centre and the 24×7 tele-counselling line.
>
> **Where you are:** every page shows its path under the nav, for example ⌂ › Topics › Hostel › Mess coupons. Each step is tappable, so you can climb back to the area or the full list.
>
> **Search that lands you on the answer**
>
> - **Path and matching line:** each result shows where it lives (Hostel › Mess coupons) and the line that matched.
> - **Lands on the right spot:** tapping a result opens the topic at that line with your words highlighted, not at the top of a long page.
> - **Area shortcut:** typing an area's name ("hostel") puts that whole area first.
> - **Call button in the results:** if the top result has a phone number, its Call button shows right there. With the strip gone, typing "ambulance" still gets you a Call button immediately.
>
> **The letter rail**
>
> […] Agreed that bigger letters aren't the answer. Only 16 letters are in use, so they all fit on screen; a scrolling rail would just hide some of them. Instead:
> - **Current letter lights up:** as you scroll, the current letter is highlighted and enlarged (H while you're in H). The rest stay small.
> - **Slide to jump:** slide your thumb down the rail and a big letter bubble follows it while the list jumps along. Android's contacts app works this way: the letters stay small, but you never have to hit one exactly.
> - **Pinned heading:** the letter heading stays pinned at the top while you're in that section.
> - **Wider touch area:** easier to grab, without bigger letters.
>
> **New here?**
>
> Keep it. One tweak: order it by when a fresher needs each thing:
> - day one: college websites, mess
> - first week: attendance, NSO/NSS/NCA/NCC
> - first month: scholarships
> - end of semester: CGPA
>
> Nothing to add or remove; six fits in one glance. Seniors can change the list any time from the admin's "Home page" item.
>
> **"What is this?" draft, in the Free Rooms style**
>
> > Campus Info answers the questions every IITM student ends up asking: how the mess works, how CGPA is counted, which scholarship fits you, and **whom to call** when something goes wrong.
> >
> > It helps **first- and second-years** most, and anyone who has asked a senior "whom do I even ask about this?"
> >
> > Inside: **academics, hostel and mess, scholarships and loans, health, clubs and Inter IIT**, with the official documents and office numbers that go with them.
> >
> > Search the way you'd ask a friend, or browse by area. It **works offline**, so it's there even when the hostel Wi-Fi isn't.
> >
> > Written and kept up to date by **IITM students**, from official sources. Not an official institute website. Something missing or wrong? **Tell us.**
>
> The same text would go at the top of the GitHub README, since that's the first thing an evaluator opens.
>
> **Admin and footer**
>
> - **Admin:** same screens, with the same buttons in the same places; only the look changes. It gets the site's cream and navy, rounded buttons and inputs, and the topic list as soft rounded rows with the open one highlighted. Publish becomes the one dark button, Write/Preview becomes a small toggle, and the yellow practice bar becomes a soft rounded note.
> - **Footer:** "Built and kept up to date by IITM students. Not an official institute website." plus About, "For seniors: edit" and the update date. Feedback moves to the nav and Install moves to the home card.
>
> Once you answer, I'll build it on my machine and send you phone and laptop screenshots of each page. Nothing goes live until you've seen it. […]

*[Three questions followed, each with Claude's pick marked. I took all three picks: on a phone the nav gets its own row under the logo, the areas live on the Topics page, and the logo is a plain bookmark.]*

> The redesign is built and running on my machine, and nothing is live yet. I sent you 10 screenshots, and the browser pane has the local copy open so you can click around. All the checks pass: the 2 a.m. set 10/10, everyday search 96% right first and 99% in the top three, privacy 0, no broken links, home 105 KB (limit 150) […].
>
> **What's built, following your three choices:**
> - **Nav:** Home · Topics · Emergency · Feedback, top right on a laptop. On a phone it's a row under the logo that stays on screen while you scroll. Emergency is the one red item, and the old strip is gone.
> - **Home:** "A place for you to…" with the four phrases marked in yellow, then the install card ("Opens like an app and works offline"), the search bar, and "New here?", now ordered by when a fresher needs each topic. The counts are gone everywhere.
> - **Topics:** the A–Z list, with the seven areas as pills at the top.
> - **The letter rail:**
>   - The letter you're in lights up and grows.
>   - Sliding a thumb down the rail shows a big letter bubble while the list jumps along.
>   - The section's letter heading stays pinned at the top.
>   - The rail only appears once the pills have scrolled away, so it never covers them.
> - **Where you are:** every page shows its path, like ⌂ › Topics › Hostel › Mess coupons, and each step is tappable.
> - **Search:**
>   - Results say where in the topic the words are ("in Usually Covered:"). Tapping one opens the topic at that line; for "ambulance" → Health insurance, that's 2,700 px down the page, with the word marked.
>   - "hostel" offers "Everything in Hostel" first.
>   - "ambulance" shows a Call button right in the results.
> - **Emergency:** two big Call cards (Ambulance, Security), then every emergency number as a tappable pill.
> - **What is this?:** the five short paragraphs from my draft. The same text now opens the GitHub README.
> - **Logo:** a plain bookmark, also used as the app icon.
> - **Admin:** same screens and buttons, now rounded and in the site's colours. Publish is the one dark button, Write/Preview is a small toggle, and the Google sign-in button is a pill too.
>
> **Also worth knowing:**
> - I fixed a few things during testing: the tagline left "you." alone on a line, the install card squeezed its text, the nav row let text show through, and white text on the red Emergency pill was too faint in dark mode.
> - On iPhones the Install button shows the two steps (Share, then Add to Home Screen), because Apple doesn't let websites install directly.
> - I tested the thumb slide on the rail with simulated touches in the browser. Your phone test is the real check.
> - Old shared links to areas (`#/group/hostel`) still open the right page.
> - This round is recorded as Prompt 9 in `prompts/PROMPTS.md`.
>
> **One step when it goes live:** reordering "New here?" is a content change. So when I push, I'll also move the admin's `draft` branch forward to match. Otherwise the next publish from the admin would put the old order back. `draft` has no unpublished edits right now, so nothing is lost.
>
> Have a look at the screenshots or the pane. Tell me what to change, or say the word and I'll push it live and check the live site.

*[I replied: "push it live".]*

> The redesign is live at https://bsaiprasad13-main.github.io/campus-info/. I checked it on the live site after the push and it works, with no errors:
> - **Topics:** the Hostel area shows its 11 topics and the trail.
> - **Search:** "mess rebate" leads to "Mess: how it works" and opens at the matching line.
> - **Emergency:** both Call buttons and all 11 numbers are there.
> - **Admin:** shows the new look, with a rounded Google sign-in button.
> - **Returning visitors:** this browser had the old offline copy from earlier today, and it got the new site straight away.
>
> **One extra fix I pushed after the main release (`5d7ec1d`).** A returning visitor's phone keeps an offline copy of the old site. On a slow connection it could briefly mix the new page with an old cached script, and that mix would sit on "Loading…" once. I added two small safeguards so either mix still opens. All the checks passed again before that push.
>
> **The admin's draft:** because "New here?" was reordered, I also moved the admin's draft forward to the new version. Your next publish from the admin won't bring the old order back, and no unpublished edits were affected.
>
> **Phones that already installed the app:** they may keep the old icon for a while, until the phone refreshes it.
>
> […]

---

## Prompt 10: Both light and dark, and three fixes

You've been designing in light mode, but plenty of people, me included, keep their computer in dark mode. Keep both,
with a switch to move between them, and pick colours so the things that should stand out stand out in both. Go
through every screen in both modes and fix whatever looks different or breaks, so it's one website either way.

When I close the install card with ×, it should only go away until the next reload, not for good. It shouldn't show at
all to someone who has already installed the app.

"What is this?" is in the header and again in the footer. Keep one.

And see if the footer can be better, especially the "For seniors: edit" link, which should look like something you'd
want to press.

### Claude's replies

> All four changes are done and checked on my machine. Nothing is live yet. I sent you light and dark screenshots of each main screen side by side, and the browser pane has the local copy open.
>
> **Light/dark switch.** There's a round moon/sun button next to "What is this?" in the header, and a "Dark mode / Light mode" item in the admin's More menu. Whichever you pick is remembered, and the site and admin share it. Until someone picks, the site follows the device's setting, even if it changes while the page is open. The theme is chosen before the page draws, so dark mode never flashes white first.
>
> **What looked different in dark mode, now fixed:**
> - **Area colours:** every area pill and tag turned the same brown. Each area now keeps its own colour in dark too.
> - **Headline highlight:** the yellow marker went muddy brown on dark paper. In dark the four phrases are now yellow words on a faint marker. I tried a yellow underline first, but that made them look like tappable links.
> - **Emergency:** it looked dim maroon in dark and is now a clear red. White text on the selected red pill was also hard to read, so it's dark text there now.
> - **Smaller items:** the rail's big letter bubble was light-on-light, Google's sign-in button was a white block (now Google's dark version), and links inside topics now look the same in both modes (text with an underline).
> - **Not colour, but found on the way:** on a laptop the area pills scrolled sideways and cut off "All / Essentials / Academics". They now wrap onto two rows.
>
> **Install card.** × now hides it only until the next reload, and it doesn't show at all once the app is installed. Your earlier × was saved for good by the old version, so the card will reappear for you once this is live.
>
> **"What is this?"** now appears once, in the header. The footer link is gone, and so is the repeated editor link at the bottom of the "What is this?" page.
>
> **Footer:**
> - a soft card, "For seniors", saying "Found something out of date? If you're on the editing team, you can fix it in a few minutes." with an **Open the editor** button
> - then the bookmark and "Campus Info"
> - then "Built and kept up to date by IITM students. Not an official institute website."
> - then the update date
>
> All checks pass. The home page is now 107 KB (limit 150) […]. I also tested a 360 px phone: the header fits with nothing spilling off the edge. This round is recorded as Prompt 10 in the prompts file.
>
> Shall I push it live?

*[I replied: "push it live".]*

> The light and dark update is live at https://bsaiprasad13-main.github.io/campus-info/ (commit `8fcd2f3`).
>
> I checked it on the live site after the push:
> - **Light/dark switch:** the button flips the theme, and the choice holds after a reload. With no choice made, the site follows your computer's setting, so on your dark-mode PC it opens dark.
> - **Install card:** I set the old "hidden for good" mark that your earlier × left behind and loaded the live site. The card came back and the old mark was cleared, so you'll see it again too. From now on, × only hides it until the next reload.
> - **"What is this?":** it appears once, in the header.
> - **Footer:** the new "For seniors" card with "Open the editor" is on every page.
> - **Errors:** none in the browser console.
>
> This round didn't change any content, so the admin's draft didn't need moving. All the checks passed before the push […].
>
> […]
