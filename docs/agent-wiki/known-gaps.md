# Known Gaps

- MCP App metadata and resource are implemented; exact native conversation-panel rendering depends on the installed host and remains to be verified separately from protocol tests. Browser fallback is available.
- JSON boards suit a personal prototype. Large image-heavy libraries may make refreshes slow; future storage should separate immutable asset files and metadata.
- Lock acquisition times out rather than stealing a writer's lock. A crashed process may leave `boards/<id>.json.lock` or `viewer-start.lock`. Stop/verify canvas processes and back up data before removing only the abandoned empty lock directory.
- Project context is a snapshot of up to 160 eligible paths (depth 3) and an 8 KB README excerpt; reopen/create a workspace to refresh context. No automatic source indexing.
- Preview iframe is static HTML/CSS or image display; canvas overlay intentionally intercepts selection and annotations. Interactive prototypes are future work.
- Local installs require a new chat to load tools/skills. Host restart may also be needed to refresh marketplace UI.
