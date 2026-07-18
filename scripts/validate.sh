#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"

python3 -m json.tool manifest.json >/dev/null
node --check shared.js
node --check content.js
node --check popup.js
node --test tests/*.test.js

if rg -n 'eval\(|new Function|<script[^>]+src="https?://' shared.js content.js popup.js popup.html; then
  echo "Disallowed dynamic or remote code detected." >&2
  exit 1
fi

archive="$(bash scripts/package.sh)"
test "$(unzip -Z1 "$archive" | head -n 1)" = "manifest.json"
test "$(unzip -Z1 "$archive" | rg -c '^manifest\.json$')" = "1"

echo "Validation passed: $archive"
