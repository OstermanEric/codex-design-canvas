# Design Canvas

A local Codex plugin: Node.js 22, MCP SDK over stdio, a bundled MCP Apps UI, and a loopback browser companion. Canonical source belongs here, separate from loaded projects.

Read [engineering docs](docs/agent-wiki/index.md) and [product docs](docs/product-wiki/index.md) before substantial work. Use [_hotcache.md](_hotcache.md) for the active task. Understand → inspect minimally → implement → verify → update docs.

- Prefix shell commands with `rtk` when available.
- Never edit loaded project source during import. Do not read hidden/secret files or follow inventory symlinks.
- Stable screen/variation labels and immutable revision history are core invariants. Use transactions and version conflicts.
- Keep designs out of Git. Store user boards under CANVAS_DATA_DIR or the documented user-data directory.
- Keep tokens out of logs and remote URLs. Bind the viewer to 127.0.0.1 only.
- Run `npm run build`, `npm test` and skill validation after relevant changes; UI-check canvas changes. Listening on loopback may require sandbox escalation.
- Runtime dist bundles are committed release assets; rebuild them with source changes. No npm install is needed by the installed plugin.
- Update feature map, known gaps and changelog after material changes. Do not claim an untested host integration works.
