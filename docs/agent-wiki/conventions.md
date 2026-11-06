# Conventions

Use Node ESM and Zod validation at tool boundaries. Never bypass `mutateBoard` for existing data. New variations allocate letters under the lock; revisions require expectedVersion. Use explicit workspace ID whenever referring to a label.

Portable MCP launch commands must be bare executable names (for example `sh`) or contained `./` paths. The native loader rejects absolute commands such as `/bin/sh`. Verify packaging with `CANVAS_TEST_HOST=1 npm test`, in addition to a direct MCP connection test.

Boards and viewer tokens are private local data, excluded from this repository. Browser file inputs send user-selected contents; arbitrary file-path import is only available to MCP/CLI. Rendering HTML stays in a sandboxed opaque-origin iframe with scripts and network resource loading blocked.

Verify observable behavior: concurrency, version conflicts, revision-scoped annotations, project import boundaries, stdio discovery and loopback authentication. Use browser QA for canvas interactions. Update runtime bundles and docs together.
