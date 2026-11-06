# Architecture

`src/store.mjs` owns JSON boards, atomic file replacement, cross-process per-board locks, labels, revisions and bounded read-only project inspection. `src/tools.mjs` owns validated actions shared by all transports.

`src/mcp.mjs` exposes stdio tools and a versioned MCP Apps UI resource. `src/http.mjs` hosts the browser companion, bound to 127.0.0.1 with exact Host/Origin checks and a private access token. `src/viewer.mjs` starts/reuses that viewer. `src/cli.mjs` is a development/fallback transport.

`web/` supplies a vanilla JS UI bundled with the official MCP Apps bridge. Embedded mode calls MCP tools; browser mode calls the local API. Both use the same files, and refresh live. Rendering content is kept out of model-visible workspace summaries but available through `get_rendering`.

`dist/` contains self-contained UI/server/CLI bundles built by `scripts/build.mjs`. Installed copies need Node only. Plugin manifests support both portable and Codex compatibility layouts. The marketplace points at the repository root.

A board has stable UUID, mode, optional project context, next screen number, renderings, immutable revisions, revision-scoped annotations, saved selection and layout. No project source is copied other than the bounded README reference.
