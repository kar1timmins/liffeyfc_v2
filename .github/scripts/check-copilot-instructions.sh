#!/usr/bin/env bash
set -euo pipefail

# Lightweight docs consistency check for the brief and long instructions
# - ensures both files exist
# - ensures the long instructions references the copilot brief
# - ensures the copilot brief contains key sections

repo_root=$(git rev-parse --show-toplevel 2>/dev/null || echo "$(pwd)")
long_file="$repo_root/.github/instructions/lfc_project_instructions.instructions.md"
brief_file="$repo_root/.github/copilot-instructions.md"

if [[ ! -f "$long_file" ]]; then
  echo "ERROR: Missing long instructions file: $long_file" >&2
  exit 2
fi

if [[ ! -f "$brief_file" ]]; then
  echo "ERROR: Missing copilot instructions file: $brief_file" >&2
  exit 2
fi

echo "Found both docs. Running consistency and coverage checks..."

# 1. Check that long file points to the brief (required)
if ! grep -q "copilot-instructions.md" "$long_file"; then
  echo "WARN: Long instructions missing cross-reference to copilot-instructions.md" >&2
  warn=1
else
  echo "OK: Long instructions reference copilot-instructions.md"
fi

# 2. Check that brief contains 'Quick commands' and 'Where to look' sections (warning)
if ! grep -q "Quick commands" "$brief_file"; then
  echo "WARN: Copilot brief missing 'Quick commands' section" >&2
  warn=1
else
  echo "OK: Copilot brief has 'Quick commands' section"
fi
if ! grep -q "Where to look for common tasks" "$brief_file"; then
  echo "WARN: Copilot brief missing 'Where to look for common tasks' section" >&2
  warn=1
else
  echo "OK: Copilot brief has 'Where to look for common tasks' section"
fi

warn=${warn:-0}

# 3. Stricter match: extract endpoints from both files and compare
extract_endpoints() {
  # Accepts filename as $1; match HTTP method then path until whitespace
  # Normalize matched endpoints and placeholders
  grep -oE "\b(GET|POST|PUT|DELETE|PATCH) /[^[:space:]]+" "$1" \
    | perl -pe "s/ +/ /g; s/[`),]+\$//; s/^`//; s/0x[^[:space:]?&,)]+/<param>/gi; s/<[^>]+>/<param>/g; s/\{[^}]+\}/<param>/g; s/chain=(ethereum|avalanche|<[^>]+>)/chain=<chain>/g; s/:[a-zA-Z0-9_]+/:param/g; s/:param/<param>/g; s#(/[0-9]+)(/|$)#/<param>\\2#g; s#(/[0-9a-fA-F-]{36})(/|$)#/<param>\\2#g; s/=([^&?#]+)/=<param>/g; s#/$##; s/[;,.]+\$//;" | sort -u
}

endpoints_long=$(mktemp)
endpoints_brief=$(mktemp)
extract_endpoints "$long_file" > "$endpoints_long" || true
extract_endpoints "$brief_file" > "$endpoints_brief" || true

echo "Endpoints in long instructions:"
cat "$endpoints_long" || true
echo "Endpoints in copilot brief:"
cat "$endpoints_brief" || true

missing_in_brief=0
while read -r ep; do
  if [[ -z "$ep" ]]; then
    continue
  fi
  if ! grep -Fxq "$ep" "$endpoints_brief"; then
    echo "WARN: Endpoint present in long file but missing in brief: $ep"
    missing_in_brief=$((missing_in_brief+1))
    warn=1
  fi
done < "$endpoints_long"

missing_in_long=0
while read -r ep; do
  if [[ -z "$ep" ]]; then
    continue
  fi
  if ! grep -Fxq "$ep" "$endpoints_long"; then
    echo "WARN: Endpoint present in brief but missing in long file: $ep"
    missing_in_long=$((missing_in_long+1))
    warn=1
  fi
done < "$endpoints_brief"

total_long=$(wc -l < "$endpoints_long" | tr -d ' ')
total_brief=$(wc -l < "$endpoints_brief" | tr -d ' ')
overlap=$((total_long - missing_in_brief))

echo "Summary: long_endpoints=$total_long, brief_endpoints=$total_brief, overlap=$overlap"

# 4. Soft threshold: warn if overlap is less than 60% of long endpoints
if [[ $total_long -gt 0 ]]; then
  percent_overlap=$((100 * overlap / total_long))
  if [[ $percent_overlap -lt 60 ]]; then
    echo "WARN: Only ${percent_overlap}% of endpoints in the long file are listed in the brief (threshold 60%)"
    warn=1
  else
    echo "OK: Endpoint coverage is ${percent_overlap}% in brief"
  fi
fi

# 5. 'How to update' and 'Updated:' stamp should exist in brief
if ! grep -q "How to update this brief" "$brief_file"; then
  echo "WARN: Copilot brief missing 'How to update this brief' section" >&2
  warn=1
else
  echo "OK: Copilot brief 'How to update' section present"
fi
if ! grep -q "Updated:" "$brief_file"; then
  echo "WARN: Copilot brief missing 'Updated:' stamp" >&2
  warn=1
else
  echo "OK: Copilot brief has 'Updated:' stamp"
fi

if [[ $warn -ne 0 ]]; then
  echo "WARNINGS detected: See messages above. These are non-blocking; please review and update docs as needed."
else
  echo "Docs check passed: both files present and essential sections exist."
fi

exit 0
