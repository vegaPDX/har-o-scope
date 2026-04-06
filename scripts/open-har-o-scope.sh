#!/bin/sh
# Open har-o-scope in your default browser.
# Works on macOS, Linux, and WSL.

DIR="$(cd "$(dirname "$0")" && pwd)"
FILE="$DIR/index.html"

if [ ! -f "$FILE" ]; then
  echo "Error: index.html not found in $DIR"
  exit 1
fi

if command -v open >/dev/null 2>&1; then
  open "$FILE"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$FILE"
elif command -v wslview >/dev/null 2>&1; then
  wslview "$FILE"
else
  echo "Open this file in your browser: $FILE"
fi
