# Design Canvas

A local Codex plugin for project design work and one-off explorations. Screens get stable labels such as **1a / 1b / 2a**. Iterating on **1b** appends **1b · v2**, preserving earlier versions and their annotations.

The prototype includes a canvas with movable artboards, zoom, side-by-side comparison, pinned comments, revision selection, project context, and selection context for Codex. It displays self-contained HTML/CSS or image renders. It uses your existing Codex conversation to create designs; there is no separate model call or API key.

To open a sample board without installing development dependencies, run `node dist/demo.mjs` and open the returned local URL.

## Test it

After local installation, **start a new Codex chat** and invoke `$design-canvas:design-canvas`:

> Start a one-off canvas for a reading app. Make two Home directions, labeled 1a and 1b.

Or:

> Load /absolute/path/to/my-project into Design Canvas and create two Home directions, 1a and 1b.

The plugin's `open_workspace` tool supplies an MCP Apps UI and a browser link. The browser companion works independently of embedded-panel support. It shows changes made by MCP tools automatically. In the browser, select a rendering and **Copy context for Codex**, then paste that context with your requested change. Compatible embedded hosts can pass the selection directly into the conversation.

`Load a project` imports an inventory and README. It does not run a code indexer, upload source, or modify the selected project. A one-off workspace needs only a name.

## Install

Node.js 22+ and Codex desktop/CLI are required. This repository includes runtime bundles, so no dependency install is required to use the plugin.

```sh
git clone https://github.com/OstermanEric/codex-design-canvas.git
cd codex-design-canvas
sh scripts/install.sh
```

This registers the `design-canvas-local` marketplace and installs `design-canvas`. Open a new chat after installation. To refresh after development, rebuild and rerun the installer, then open a new chat.

```sh
codex plugin remove design-canvas@design-canvas-local
codex plugin marketplace remove design-canvas-local
```

Removing the plugin leaves your saved boards intact.

## Develop

```sh
npm ci
npm run build
npm test
CANVAS_TEST_HOST=1 npm test
npm run demo
# Optional: load your project into the demo workspace
node dist/demo.mjs --project /absolute/path/to/my-project
```

The Daylight demo contains illustrative app concepts. It does not contain a user’s saved boards or loaded project files. `npm start` starts a loopback viewer and prints its access link. The viewer process stays available after a chat ends. To stop it, read the PID in the data directory's `viewer.json`, verify the process, and terminate it normally.

Boards live at `~/.local/share/codex-design-canvas/boards`. Override with `CANVAS_DATA_DIR` for tests. Back up this directory to preserve boards. Data is not published or synchronized to a hosted service.

## Prototype limits

- Embedded conversation-panel support depends on the host. The loopback browser companion is the verified fallback.
- HTML is a visual review surface: JavaScript and external resource loading are disabled, and the overlay captures clicks for selection/annotations. Embed fonts/images/CSS.
- PNG/JPEG/WebP renders are supported. This is not a vector editor or an automatic Figma/SwiftUI importer.
- Project mode gives context to the agent; it does not automatically produce designs from arbitrary source code.
- No multi-user collaboration, cloud sharing, or public marketplace release is included.
- A crashed writer can leave a lock directory. See [known gaps](docs/agent-wiki/known-gaps.md) before manual recovery.

[Engineering wiki](docs/agent-wiki/index.md) · [Product wiki](docs/product-wiki/index.md)

## Third-party software

Runtime bundles include third-party packages. Their licenses and attribution notices are included in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
