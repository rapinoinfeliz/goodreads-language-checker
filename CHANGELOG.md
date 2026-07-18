# Changelog

All notable changes to this project are documented here.

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
