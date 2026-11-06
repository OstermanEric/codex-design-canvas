# Current Task
Publish Design Canvas 0.1.0 as a public GitHub repository and release.

## Relevant Wiki Pages
[Architecture](docs/agent-wiki/architecture.md), [Known gaps](docs/agent-wiki/known-gaps.md), [Product](docs/product-wiki/index.md).

## Relevant Source Files
plugin.json, mcp.json, scripts/install.sh, scripts/build.mjs, README.md.

## Constraints
Publish source and runtime bundles; exclude user boards, tokens, machine-specific project paths and development dependencies. Project import remains read-only. Public GitHub distribution is separate from the public OpenAI plugin directory.

## Plan
Prepare portable examples and notices → build → validate → commit → create public repository → push → publish release → verify remote state.
