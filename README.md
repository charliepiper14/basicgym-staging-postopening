# BasicGym Riverside: staging (SAVE50 + Basic Icons)

Staging preview of the basicgym.co.uk changes Riaz asked for on 30 Oct 2026:

1. **SAVE50 replaces BACK26** across the site, with no time pressure (no end date, no "limited spaces").
2. **Basic Icons**, a first draft of the content creator page.

Every page here was built from the live Elementor code as it stood on 30 Oct 2026. Each live widget was checked against a sha256 fingerprint before any edit, so nothing else on the live site gets lost or rolled back.

## The offer, as built

| Plan | Normal first payment | With SAVE50 today |
|---|---|---|
| Off Peak, 12 month (£17.99) | £17.99 + £9.99 joining = £27.98 | **£9.00**, joining fee waived |
| Plus, 12 month (£24.99) | £24.99 + £9.99 = £34.98 | **£12.50**, joining fee waived |
| Off Peak, monthly (£21.99) | £21.99 + £14.99 = £36.98 | **£11.00 + £14.99 = £25.99** |
| Monthly (£27.99) | £27.99 + £14.99 = £42.98 | **£14.00 + £14.99 = £28.99** |
| Day pass (£9.99) | £9.99 | no offer |

Half prices are rounded to the nearest penny (17.99 / 2 = 8.995, shown as £9.00). **Check one test checkout per plan with Ashbourne before go live.** If Ashbourne rounds down (£8.99, £12.49, £10.99, £13.99), change the four figures in `02-membership.html`, `03-join.html` and the home band in `01-home.html`, and switch `Math.round(p / 2)` to `Math.floor(p / 2)` in the membership totals script.

## Folders

- `elementor/` is the **paste-ready code**, with real WordPress paths. This is what goes into Elementor.
- The root `.html` files are the **staging preview** (GitHub Pages). They are the same widgets with a yellow staging bar, `noindex`, links to the other staging pages, and join forms that record nothing.
- `_archive/aug-2026/` holds the old August files. GitHub Pages does not publish folders that start with `_`.

## Install order (live site)

Do this in one sitting. Purge LiteSpeed and Cloudflare at the end.

1. **Elementor > Custom Code**: replace the Back to Basic / BACK26 snippet with `elementor/00-site-wide-offer-script.html` (same location and priority as the old one).
2. Paste each page widget into the first HTML widget on its page. Leave the footer widget alone.
   - `01-home.html` into `/`
   - `02-membership.html` into `/membership/`
   - `03-join.html` into `/join/`
   - `04-nottingham.html` into `/nottingham/`
   - `05-faqs.html` into `/faqs/`
   - `06-classes.html` into `/classes/`
   - `07-students.html` into `/students/`
3. Ask Ashbourne to switch off BACK26 once these pages are live, not before.
4. Purge LiteSpeed, then Cloudflare. Test on a phone, one join per plan up to the Ashbourne checkout.

**Basic Icons (not yet).** `08-basic-icons.html` goes on a new Canvas page at `/basic-icons/`, with the shared footer widget below it. After that page is published, paste `90-shared-footer-with-icons-link.html` into the footer widget on every page. It is the live footer plus one "Basic Icons" link.

## What changed, page by page

**Site-wide script (00)**: code `SAVE50`. The scarcity counter is gone. `OFFER_ON = false` hides every offer block and shows the standard price lines, as before. It also adds one CSS rule, so a hidden offer block always stays hidden.

**Home (01)**
- Hero: "Summer is over. Back to your routine. Back to basic." is now "A premium gym. At a basic price."
- Offer circle: "1st month 50% off with code SAVE50". The line under it reads "No joining fee on 12 month plans".
- Orange band: "Half price first month", with the 12 month prices spelled out.
- Membership section: "Start for less. Stay for the service." The 100 spaces line now reads "Plus, 12 month: £12.50 today".
- Closing band: "Big gym. Basic price." The sticky bar says "Half price first month with SAVE50" while the offer is on.

**Membership (02)**
- Hero: "Choose your plan. Train today."
- Offer circle as on the home page.
- 12 month tab opens first, as before.
- Each card says exactly what SAVE50 does on that plan.
- "Total due today" shows the normal total struck through, next to the SAVE50 total.
- The FAQ card now explains SAVE50 and only shows while the offer is on.

**Join (03)**
- The code bar is plan specific, for example "Your first month is £12.50 instead of £24.99, and there is no joining fee." It is hidden on the day pass.
- The offer field sent to the join leads sheet is now `SAVE50`.
- The Lead value is now that plan's first payment (it was a flat 5).
- Endpoint and Ashbourne product IDs are unchanged.

**Nottingham (04)**: offer circle, price card note and sticky bar.

**FAQs (05)**: SAVE50 questions that only show while the offer is on. "Back to routine" closing band replaced.

**Classes (06), Students (07)**: price card note only.

**Basic Icons (08)**: rebuilt on 4 Nov from Riaz's Basic Icon document.
- Hero with the application form: first name, mobile and email, an optional handle, and one tick box. An optional step 2 adds platform, followers and why.
- Four benefits: complimentary annual membership, 30% commission (first 3 months, after VAT), your own affiliate code, and events and launches.
- A "Train, create and earn" band, three steps, and a Good to know section that includes the #ad rule.
- The form posts to a Google Apps Script that writes to the "Basic Icons applications" sheet and emails info@basicgym.co.uk. Setup is in `apps-script/SETUP.md`. Paste the `/exec` URL into `ICON_ENDPOINT` before go live.
- Tracking: dataLayer `bg_icon_application` and the Meta custom event `IconApplication`. Kept separate from the membership Lead event.

**Online Coaching (09), new 5 Nov:** a sales page at /online-coaching/ for the three coaching plans sold in the BasicGym app: Coach £29.99, Online Coaching £59.99 (marked Recommended) and Premium £99.99.
- The page sells; the app takes payment. Buttons open the right app store on phones and scroll to the download section on computers.
- Tracking: dataLayer `coaching_app_click` with tier and store, plus the Meta custom event `CoachingAppClick`.
- Draft tags to confirm: cancellation terms, plan changes, and whether people who aren't members can create an app account.

**Personal Training band (10):** a separate HTML widget added between the PT page widget and the footer. The PT page code itself is unchanged.

**Menu snippet (01b):** now adds Online Coaching under Personal Training as well as Basic Icons. Paste it only when /online-coaching/ is live.

## Still waiting on Riaz (unchanged on purpose)

- Ratings and the Long Eaton review section (R16)
- "120 classes a week" (R04)
- Online PT page and gym events: next builds, not started
