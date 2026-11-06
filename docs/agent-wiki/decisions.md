# Engineering Decisions

- **2026-11-05 — Accepted:** A local stdio MCP plugin shares tools/data with a loopback browser viewer. This makes the MVP testable while host embedding remains uncertain. [Architecture](architecture.md).
- **2026-11-05 — Accepted:** Server-allocated labels identify alternatives; append-only versions identify iteration. Cross-process locking and expectedVersion prevent duplicate labels and lost changes.
- **2026-11-05 — Accepted:** Self-contained runtime bundles avoid npm installation or lifecycle scripts during plugin use. Source development uses npm and a lockfile.
- **2026-11-05 — Accepted:** Static HTML/CSS and images are sufficient for the first visual review test. Scripts and external resources are blocked in design frames.
