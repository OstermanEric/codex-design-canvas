#!/bin/sh
set -eu
CANVAS_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
if [ ! -f "$CANVAS_ROOT/dist/mcp.mjs" ]; then
  echo 'Build first: npm ci && npm run build' >&2
  exit 1
fi
codex plugin marketplace add "$CANVAS_ROOT"
codex plugin add design-canvas@design-canvas-local
echo 'Installed Design Canvas. Start a new Codex chat and invoke $design-canvas:design-canvas.'
