# Goodreads Edition Language Checker

[![CI](https://github.com/rapinoinfeliz/goodreads-language-checker/actions/workflows/ci.yml/badge.svg)](https://github.com/rapinoinfeliz/goodreads-language-checker/actions/workflows/ci.yml)

Find Goodreads editions in the language you actually read.

Goodreads Edition Language Checker is a focused Manifest V3 extension for
Chrome, Arc, and other Chromium browsers. It checks Goodreads only when needed,
marks linked book covers with a compact language indicator, and adds an editions
pill to book pages.

Portuguese is selected by default, and the extension supports every language
currently exposed by the Goodreads editions filter.

> This is an independent, unofficial extension. It is not affiliated with,
> endorsed by, or sponsored by Goodreads or Amazon.

## Highlights

- **58 Goodreads languages** available from the extension popup.
- **Intentional lookups only:** a cover check starts after a 700 ms hover.
- **Book-page integration:** a dedicated pill appears below the purchase controls.
- **At-a-glance cover status:** flag for a match, `×` for no match, and a small
  spinner while checking.
- **Edition details:** click a positive marker or pill to view matching editions,
  covers, metadata, ISBN-13 values, and Goodreads links.
- **Defensive request behavior:** one request at a time, a minimum delay between
  requests, a 30-second timeout, and first-page-only edition checks.
- **Language-aware cache:** positive, negative, and partial results are cached
  separately for each selected language.
- **Instant cache path:** local cache checks run during the hover delay, and
  cache hits bypass the network queue entirely.
- **Isolated UI:** Shadow DOM prevents extension styles from leaking into
  Goodreads and keeps Goodreads styles out of extension components.
- **No analytics, ads, tracking, affiliate links, or developer-operated server.**

## How it works

### On book covers

1. Hover over a linked, portrait-oriented book cover.
2. Keep the pointer over it for 700 ms.
3. A compact spinner appears while Goodreads is checked.
4. The corner marker becomes either:
   - the selected language flag when a matching edition exists; or
   - `×` when no matching edition is found.
5. Click a positive marker to open the matching-editions panel.

Leaving the cover before 700 ms cancels the trigger without making a request.
Square images such as avatars are ignored.

### On a Goodreads book page

The extension adds its own pill directly below the Goodreads purchase controls.
The pill keeps the native width, height, and typography for alignment, while
using an independent color system that never changes with **Want to Read**,
**Read**, or another shelf state.

### In the extension popup

The popup intentionally contains only two controls:

- a language dropdown; and
- **Clear cache**.

Opening the popup never queries Goodreads.

## Request and cache safeguards

The extension is deliberately conservative:

- It never scans every cover on page load.
- A cover lookup requires a deliberate 700 ms hover.
- Requests are serialized with at least 1.5 seconds between starts.
- Each request times out after 30 seconds.
- Only the first filtered editions page is checked.
- Multiple covers for the same book share in-memory state.
- Different editions mapped to the same Goodreads work share cached results.
- Only actual network misses enter the rate-limited request queue.
- Found results are cached for 30 days.
- Negative and partial results are cached for 7 days.
- Cache storage is capped and automatically pruned.
- Cache write failures never prevent a successful result from being shown.

## Installation

### Chrome Web Store

The public listing is not live yet. This repository contains the release-ready
source and packaging tools for submission.

### Load unpacked in Chrome

1. Clone or download this repository.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the repository root (the folder containing `manifest.json`).
6. Refresh any Goodreads tabs that were already open.

### Load unpacked in Arc

Follow the same steps at `arc://extensions`.

## Permissions

The extension follows the Chrome Web Store minimum-permission principle.

| Access | Why it is required |
| --- | --- |
| `storage` | Stores the selected language and the versioned lookup cache. |
| `https://www.goodreads.com/*` content-script access | Reads Goodreads book/work identifiers, adds the visible indicators, and requests same-origin Goodreads book and editions pages. |

No broad host access, tab access, browsing-history API, clipboard permission,
background service worker, or remote code is used.

## Privacy

All processing happens inside the browser. The developer does not receive user
data, and the extension has no analytics or telemetry endpoint.

The extension processes Goodreads page URLs, book/work identifiers, and edition
metadata only to provide its visible language-checking feature. Lookup results
are stored locally; the selected language may be synchronized by Chrome through
`chrome.storage.sync` when browser sync is enabled.

Read the complete [Privacy Policy](PRIVACY.md), including retention periods,
third-party requests, deletion controls, and the Chrome Web Store Limited Use
disclosure.

## Security design

- Manifest V3 with all executable code bundled locally.
- No `eval`, dynamic code execution, remote scripts, or remote configuration.
- No HTML-string injection; parsed text is rendered with `textContent`.
- Edition links are restricted to the exact Goodreads HTTPS origin.
- Cover image URLs are restricted to Goodreads and Goodreads asset hosts over
  HTTPS.
- External links use `noopener noreferrer`.
- Parsed and cached values are validated, normalized, length-limited, and
  deduplicated.
- Modal keyboard focus is contained and restored to its opener.

## Project structure

```text
.
├── manifest.json          # Manifest V3 declaration
├── shared.js              # Language definitions, parser, cache, URL validation
├── content.js             # Goodreads integration, cover markers, pill, panel
├── popup.html             # Two-control popup markup
├── popup.css              # Popup presentation
├── popup.js               # Language setting and cache clearing
├── icons/                 # Packaged extension icons
├── tests/                 # Unit tests, HTML fixtures, browser regression pages
├── scripts/package.sh     # Reproducible Chrome Web Store ZIP builder
├── PRIVACY.md             # Public privacy policy
└── STORE_LISTING.md       # Submission copy and dashboard checklist
```

## Development

There is no application build step and no runtime dependency.

Requirements:

- Node.js 20 or newer for tests
- Python 3 with Pillow only when regenerating icons
- `zip` for the release package

Run the full local validation:

```sh
bash scripts/validate.sh
```

Or run individual checks:

```sh
node --check shared.js
node --check content.js
node --check popup.js
node --test tests/*.test.js
python3 -m json.tool manifest.json >/dev/null
```

The HTML regression pages under `tests/` exercise the DOM parser, popup,
book-page pill, negative state, selected-language behavior, delayed cover hover,
local marker positioning, click handling, and page-layout stability.

## Build the Chrome Web Store package

```sh
bash scripts/package.sh
```

The script creates a deterministic, minimal ZIP under `dist/`, with
`manifest.json` at the archive root and development-only files excluded.

## Chrome Web Store submission

Submission copy, permission justifications, privacy declarations, and the
remaining dashboard asset checklist are documented in
[STORE_LISTING.md](STORE_LISTING.md).

## Troubleshooting

### Indicators do not appear

- Refresh Goodreads tabs after installing or reloading the extension.
- Confirm that site access is enabled for `www.goodreads.com`.
- Make sure the image is a linked portrait book cover; avatars are ignored.

### A lookup fails

- Goodreads may temporarily rate-limit or challenge requests.
- Wait before retrying; do not repeatedly hover many new covers.
- Use **Clear cache** only when you intentionally want fresh results.

### A language result looks incomplete

For account safety, the extension checks only the first filtered editions page.
Use the panel’s Goodreads link to inspect the full filtered list on the site.

## Contributing

Bug reports should include the Goodreads page URL, selected language, expected
behavior, actual behavior, and browser version. Do not include cookies, account
details, or other private information.

Before opening a pull request, run `bash scripts/validate.sh` and keep changes
within the extension’s single purpose: checking Goodreads edition languages.

## Disclaimer

Goodreads and its related marks are trademarks of their respective owners. This
project uses public Goodreads page markup and may require maintenance if the site
changes. Use the extension responsibly and in accordance with Goodreads terms.
