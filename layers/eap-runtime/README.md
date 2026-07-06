# EAP-Runtime — working/tool-output offload (clean-room)

The **working membrane** of EAP. Keeps oversized tool output (logs, API blobs,
stdout) *out* of the context window: "think in code" (run a script, return only
its summary) and auto-offload large output into a local index behind a
searchable pointer.

**Independent clean-room reimplementation** of the context-offload pattern — no
Elastic-Licensed upstream source is used. See `DESIGN.md` (the specification
this is built from) and `../../docs/legal/ATTRIBUTION.md`.

## Built now

- `src/store.mjs` — the deterministic offload store on Node's built-in
  `node:sqlite` (FTS5). **Zero third-party runtime dependencies.**
  - `index(source, content)` → chunk + full-text index, return a pointer.
  - `search(query, {docId})` → **exact matching chunks** (lossless), with source
    spans and bm25 ranking. Never a summary.
  - `offload(source, content, {threshold})` → inline small content; pointer +
    hint for large content.
  - `stats()` → **measured** bytes kept out of context (a real sum, not a
    modeled percentage).
- Tests: `../../tests/runtime-store.test.mjs` (6 passing).

## Next (specified in `DESIGN.md`)

- The polyglot executor (`eap_execute*`) that runs scripts in a subprocess with
  a policy network-deny-list.
- MCP JSON-RPC framing (`eap_*` tools).
- Session-continuity snapshotting for `PreCompact` / SessionStart.

## Requirements

Node ≥ 22 (for stable `node:sqlite`). No npm install needed for the core.

## Security (honest)

The executor is a subprocess with a **policy** deny-list, **not** OS isolation;
it inherits host credentials. Labeled as a policy control, not a sandbox. See
`../../docs/ARCHITECTURE.md` → Security posture.
