# Privacy Policy

**Goodreads Edition Language Checker**

Effective date: July 17, 2026

This Privacy Policy explains how Goodreads Edition Language Checker (the
“Extension”) handles data. The Extension is an independent project and is not
affiliated with, endorsed by, or sponsored by Goodreads or Amazon.

## Summary

- The developer does not collect, receive, sell, or share user data.
- The Extension has no analytics, telemetry, advertising, affiliate tracking,
  or developer-operated server.
- Goodreads page data is processed inside the browser only to provide the
  visible edition-language feature.
- Lookup results are stored locally in Chrome storage and can be deleted with
  **Clear cache** or by uninstalling the Extension.

## Data the Extension processes

To provide its single purpose, the Extension may process:

- the URL and visible structure of Goodreads pages where it runs;
- numeric Goodreads book and work identifiers;
- the language selected by the user;
- edition information returned by Goodreads, including edition titles,
  Goodreads URLs, cover image URLs, descriptive metadata, and ISBN-13 values;
- lookup status, timestamps, and whether a result represents only the first
  available page.

The Extension does not access passwords, payment information, private messages,
contacts, files, precise location, or data from sites other than Goodreads.

## How the data is used

Data is used only to:

1. identify the Goodreads book associated with a page or linked cover;
2. request the matching Goodreads editions page for the selected language;
3. show a cover marker, book-page pill, and editions panel; and
4. avoid unnecessary repeat requests through a short local cache.

The data is not used for advertising, profiling, credit decisions, analytics,
or any purpose unrelated to the Extension’s visible functionality.

## Storage and retention

- The selected language is stored with `chrome.storage.sync` when available, so
  Chrome may synchronize that preference through the user’s browser account.
  The developer cannot access that synchronized value.
- Edition lookup results and Goodreads book/work mappings are stored with
  `chrome.storage.local` on the user’s device.
- Found results expire after 30 days.
- Negative and partial results expire after 7 days.
- Cache size and entry count are capped and pruned automatically.

Users can delete lookup data at any time by clicking **Clear cache** in the
Extension popup. Uninstalling the Extension removes its local Chrome storage.
Chrome account synchronization behavior is controlled by the user’s Chrome
settings and Google account.

## Network requests and third parties

The Extension communicates only with Goodreads services required for its
feature:

- `https://www.goodreads.com/` for book and editions pages; and
- Goodreads asset hosts for edition cover images displayed in the panel.

Requests use HTTPS and may include the user’s existing Goodreads session cookies
because they are sent directly from the Goodreads page to Goodreads. The
Extension does not read, store, copy, or transmit those cookies to the developer
or any other party.

Goodreads and Google process data under their own privacy policies. The
developer does not control their independent practices.

## Data sharing and sale

The developer does not receive Extension data. No Extension data is sold,
licensed, disclosed to advertisers, or transferred to data brokers or unrelated
third parties.

## Security

All executable logic is packaged with the Manifest V3 Extension. It does not
load or execute remote code. Network requests use HTTPS, URLs are restricted to
expected Goodreads hosts, and parsed values are validated before display or
storage.

## Chrome Web Store Limited Use disclosure

The use of information received from Chrome APIs adheres to the
[Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data/),
including the Limited Use requirements.

Specifically:

- data access is limited to providing and improving the Extension’s single,
  user-facing edition-language feature;
- data is not transferred except as necessary to provide that feature, comply
  with applicable law, address security, or complete a merger or acquisition;
- data is never used or transferred for personalized advertising; and
- humans are not permitted to read user data except with explicit consent for a
  specific support case, for security, to comply with law, or after aggregation
  and anonymization for internal operations. The current Extension has no
  telemetry system or developer data-access system.

## Children’s privacy

The Extension is not directed to children and does not knowingly collect
personal information from children.

## Changes to this policy

Material changes will be published in this repository with an updated effective
date. Changes that alter data practices will also be reflected in the Chrome Web
Store privacy disclosures before release.

## Contact

Privacy questions can be submitted through the project’s GitHub repository:

https://github.com/rapinoinfeliz/goodreads-language-checker/issues
