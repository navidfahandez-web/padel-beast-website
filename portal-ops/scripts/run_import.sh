#!/bin/sh
# Runs import_seed.py against the LIVE portal without saving the setup key anywhere.
# It asks for the key silently (nothing is shown while you type/paste), uses it once, and forgets it.
# Usage (from the portal-ops folder):  sh scripts/run_import.sh --skip-samples
#                                      sh scripts/run_import.sh --backup my-backup.json
cd "$(dirname "$0")/.." || exit 1
trap 'stty echo 2>/dev/null' EXIT INT TERM
printf "Paste your setup key (you won't see it), then press Enter: "
stty -echo 2>/dev/null
read -r K
stty echo 2>/dev/null
echo
PORTAL_URL="${PORTAL_URL:-https://thepadelbeast.com}" PORTAL_SETUP_KEY="$K" python3 scripts/import_seed.py "$@"
unset K
