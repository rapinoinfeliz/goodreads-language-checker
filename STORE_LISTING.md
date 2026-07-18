# Chrome Web Store Listing and Submission Checklist

This document contains release copy and dashboard answers for version 4.3.0.
Review the final Chrome Web Store dashboard wording before submission because
Google may change its forms and policies.

## Product name

Goodreads Edition Language Checker

## Short description

Check Goodreads for book editions in your chosen language with on-demand cover markers and a book-page editions pill.

The manifest description is under Chrome’s 132-character limit.

## Detailed description

Find Goodreads editions in the language you actually read.

Goodreads Edition Language Checker adds a compact language indicator to linked
book covers and a dedicated editions pill to Goodreads book pages. Choose one of
58 Goodreads languages from the extension popup, then hover over a linked cover
for 700 ms to run an intentional, on-demand check.

When a matching edition exists, the cover displays a discreet language flag.
When none is found, it displays a small ×. Click a positive marker or the
book-page pill to view matching edition titles, covers, metadata, ISBN-13 values,
and direct Goodreads links.

Designed to be respectful of Goodreads and user accounts:

- no automatic cover scanning;
- one lookup at a time;
- a minimum delay between requests;
- a 30-second request timeout;
- only the first filtered editions page is checked;
- language-aware local caching; and
- a Clear cache control in the popup.

Privacy-first by design:

- no analytics or telemetry;
- no ads or affiliate links;
- no developer-operated server;
- no remote code;
- no sale or sharing of user data; and
- only the minimum Chrome permission and Goodreads site access required for the
  visible feature.

This is an independent, unofficial extension. It is not affiliated with,
endorsed by, or sponsored by Goodreads or Amazon.

## Category

Recommended: **Tools**

## Language

Listing language: **English**

## Single purpose statement

The Extension’s single purpose is to help users identify and inspect Goodreads
book editions in a user-selected language. The popup setting, delayed cover
markers, book-page pill, editions panel, cache, and Goodreads requests all serve
that same purpose.

## Permission justifications

### `storage`

Stores the selected edition language and a versioned cache of Goodreads lookup
results. The cache reduces repeat requests and can be cleared from the popup.

### Site access: `https://www.goodreads.com/*`

A statically declared content script must run on Goodreads pages to identify
linked book covers, read numeric Goodreads book/work identifiers, add the visible
markers and pill, and make same-origin requests to Goodreads book and editions
pages. The Extension has no access to other websites.

## Remote code declaration

**No remote code is used.** All JavaScript and CSS logic is packaged in the
submitted ZIP. Goodreads HTML and cover images are fetched as data and are not
executed as Extension logic.

## Data-use disclosure guidance

The Extension processes Goodreads website content and browsing interactions
necessary for its user-facing feature. Book/work identifiers and edition
metadata are cached locally. The developer does not receive this data.

Conservative dashboard disclosure:

- **Website content:** processed locally to identify books and editions.
- **Web history / browsing activity:** limited to current Goodreads pages and
  deliberately hovered book links needed for the visible feature.
- **Authentication information:** not collected. Existing Goodreads cookies may
  accompany direct same-origin requests, but the Extension never reads or stores
  them.
- **Personally identifiable information:** not collected.
- **Financial, health, communications, location, and user-generated content:**
  not collected.

Data-use certifications:

- not sold to third parties;
- not used or transferred for unrelated purposes;
- not used or transferred for creditworthiness or lending;
- not used for personalized advertising;
- no human access system exists; and
- use complies with the Chrome Web Store Limited Use requirements.

Privacy policy URL after this repository is public:

https://github.com/rapinoinfeliz/goodreads-language-checker/blob/main/PRIVACY.md

## Store assets still required in the dashboard

Use real, current screenshots. Do not submit mock functionality.

- [ ] At least one 1280×800 or 640×400 screenshot.
- [ ] One 440×280 small promotional tile.
- [ ] Optional 920×680 large promotional tile.
- [ ] Optional 1400×560 marquee promotional image.
- [ ] Confirm the 128×128 packaged icon renders clearly.

Recommended screenshots:

1. Goodreads book page with a positive editions pill below Buy on Amazon.
2. A Goodreads list with flag, ×, and loading cover-marker examples.
3. The matching-editions panel.
4. The two-control language popup.

Avoid account names, avatars, private shelf information, email addresses, or any
other personal data in screenshots.

## Pre-submission checklist

- [ ] Run `bash scripts/validate.sh`.
- [ ] Run `bash scripts/package.sh`.
- [ ] Load the exact ZIP contents unpacked in a clean Chrome profile.
- [ ] Test positive, negative, error, popup, language-change, and cache-clear flows.
- [ ] Verify site access is limited to Goodreads in the install prompt.
- [ ] Publish the privacy policy URL.
- [ ] Complete the dashboard privacy disclosures conservatively.
- [ ] Upload accurate screenshots and promotional artwork.
- [ ] Confirm support and homepage URLs.
- [ ] Confirm the listing clearly says the extension is unofficial.
- [ ] Start with trusted testers or unlisted visibility if desired; all modes
  still undergo policy review.

## Official references

- [Prepare your extension](https://developer.chrome.com/docs/webstore/prepare/)
- [Chrome Web Store Program Policies](https://developer.chrome.com/docs/webstore/program-policies/)
- [Manifest V3 requirements](https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements/)
- [User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq/)
- [Complete your listing](https://developer.chrome.com/docs/webstore/cws-dashboard-listing/)
