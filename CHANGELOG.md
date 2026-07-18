# Changelog

All notable changes to this project are documented here.

## [4.4.0] - 2026-07-17

### Changed

- Redesigned the matching-editions dialog with a more polished visual system.
- The dialog now sizes itself to its contents and available viewport space.
- Desktop users can resize the dialog manually; compact screens use a fitted
  bottom-sheet layout.
- Added a structured language header, result summary, refined edition cards,
  clearer first-page notice, and a stronger Goodreads action button.
- Improved responsive spacing, scrolling, focus styling, reduced-motion
  behavior, and dialog accessibility metadata.

## [4.3.0] - 2026-07-17

### Added

- In-memory cache hydration for near-instant repeated checks.
- Cache preflight during the 700 ms hover window without network activity.
- Local `work_id` discovery from nearby Goodreads card metadata and links.
- Shared work mappings for different editions of the same Goodreads work.
- Regression coverage for storage reads, consolidated writes, local work lookup,
  and network-free cached cover indicators.

### Changed

- Only actual Goodreads network lookups enter the rate-limited request queue.
- Book-to-work mappings and edition results are now persisted in one operation.
- Cache reads are consolidated and synchronized across extension contexts.

## [4.2.0] - 2026-07-17

### Added

- Support for all 58 languages exposed by the Goodreads editions filter.
- Language selection in the compact extension popup.
- Delayed 700 ms cover checks with loading, positive, and negative markers.
- Clickable positive cover markers and a matching-editions panel.
- A dedicated book-page editions pill below the purchase controls.
- Language-isolated, TTL-based lookup caching with size pruning.
- Alias support for Goodreads language display-name variants.
- Keyboard focus containment and restoration for the editions dialog.
- Chrome Web Store privacy policy, listing guidance, packaging, and CI tooling.
- Unit and browser regression tests.

### Changed

- Rebuilt the extension as an English-only Manifest V3 release.
- Reduced the popup to the language dropdown and Clear cache button.
- Limited requests to one at a time with a minimum interval and timeout.
- Limited extension access to the Goodreads content-script match and `storage`.
- Updated icons to Chrome Web Store padding guidance and added a 32 px icon.

### Removed

- Automatic page-wide cover scanning.
- Tooltip injection.
- ISBN copy and Telegram actions.
- Dead clipboard and external-navigation helpers.
- Redundant host, tab, and options-page functionality.
- Legacy global page styles.
