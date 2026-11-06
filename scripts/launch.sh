#!/bin/sh
set -eu
CANVAS_SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
for CANVAS_NODE_CANDIDATE in "${CANVAS_NODE:-}" "$(command -v node || true)" /opt/homebrew/bin/node /usr/local/bin/node /usr/local/opt/node@22/bin/node; do
  if [ -n "$CANVAS_NODE_CANDIDATE" ] && [ -x "$CANVAS_NODE_CANDIDATE" ]; then
    exec "$CANVAS_NODE_CANDIDATE" "$CANVAS_SCRIPT_DIR/../dist/mcp.mjs"
  fi
done
echo 'Design Canvas requires Node.js 22 or later. Install Node, then restart Codex.' >&2
exit 1
