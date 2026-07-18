#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
version="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["version"])' "$project_dir/manifest.json")"
output_dir="$project_dir/dist"
output_file="$output_dir/goodreads-edition-language-checker-$version.zip"
staging_dir="$(mktemp -d "${TMPDIR:-/tmp}/goodreads-language-checker.XXXXXX")"

cleanup() {
  rm -rf "$staging_dir"
}
trap cleanup EXIT

runtime_files=(
  manifest.json
  shared.js
  content.js
  popup.html
  popup.css
  popup.js
  icons/icon-16.png
  icons/icon-32.png
  icons/icon-48.png
  icons/icon-128.png
)

mkdir -p "$output_dir"
rm -f "$output_file"

for runtime_file in "${runtime_files[@]}"; do
  mkdir -p "$staging_dir/$(dirname "$runtime_file")"
  cp "$project_dir/$runtime_file" "$staging_dir/$runtime_file"
  TZ=UTC touch -t 198001010000 "$staging_dir/$runtime_file"
done

cd "$staging_dir"
zip -X -q "$output_file" "${runtime_files[@]}"

echo "$output_file"
