# EAP-Runtime — clean-room design specification

**This document is the specification.** EAP-Runtime is implemented **only** from
this description of the *pattern*. No source code, bundle, or test from any
Elastic-Licensed upstream is read or copied. See `../../docs/legal/ATTRIBUTION.md`.

The pattern (execute-in-subprocess, return-only-summary, index-the-rest) is a
general technique also found in OpenAI Code Interpreter and Anthropic's "code
execution with MCP." It is not novel to any one project and is described here in
first-principles terms.

## Problem

During an agent turn, tool output accretes in the context window: a 56 KB
Playwright snapshot, a 45 KB access log, 20 GitHub issues. Most of those bytes
are never needed after one derived fact is extracted. They crowd out reasoning
budget and cost money on every subsequent turn that re-sends the history.

## Mechanism (three moves)

1. **Think in code.** Instead of reading raw data into context, the agent writes
   a short script. EAP-Runtime runs it in a child subprocess against the raw
   data on disk, and **only the script's printed stdout re-enters context**. The
   56 KB log is `read` inside the subprocess; only `"500 requests, 12 errors,
   avg 34ms"` returns.

2. **Auto-offload oversized output.** When a script's stdout (or an indexed
   document/URL) exceeds a size threshold (default 100 KB), it is chunked and
   written to a local lexical index (SQLite full-text search), and context
   receives a **pointer** message: *"Indexed N sections under <id>. Query with
   eap_search(...)"*. Retrieval returns matching chunks (lossless) — not
   summaries.

3. **Session continuity.** Tool calls, edits, and decisions are logged to a
   per-project store. Before compaction, a small priority-tiered snapshot is
   written; at the next SessionStart it is rehydrated so working state survives
   compaction and `--continue`.

## Public interface (MCP tools, `eap_*`)

Deterministic, no LLM, no network egress (network fetches are blocked and
redirected to the indexed-fetch path).

| Tool | Purpose |
|---|---|
| `eap_execute` / `eap_execute_file` / `eap_batch_execute` | Run a script in a subprocess; return only stdout (auto-offloaded if large). |
| `eap_index` | Chunk + index a file/blob/string into the local FTS store; return a pointer. |
| `eap_search` | Query the FTS store; return exact matching chunks (lossless) with source spans. |
| `eap_fetch` / `eap_fetch_and_index` | Fetch a URL (host-allowlisted) and index it; return a pointer, never the raw body. |
| `eap_stats` | Report bytes kept out of context (measured, not modeled). |
| `eap_purge` / `eap_doctor` | Maintenance: clear the store; health-check the runtime. |

## Storage

- One project root `.eap/`.
- A single SQLite database (`.eap/runtime.db`) with an FTS virtual table for
  chunks and a table for the session event log + snapshots.
- Prefer the language runtime's **built-in** SQLite (`node:sqlite`) so there is
  **no third-party runtime dependency** — supply-chain surface stays zero.

## Runtime & dependencies

- Node ≥ 22 (for stable `node:sqlite`). No npm runtime dependencies.
- The polyglot executor shells out to language runtimes already on the host
  (python3, node, bash, …); it does not bundle them.

## Security (stated honestly)

- The executor is a subprocess with a **policy deny-list** (blocks
  `curl`/`wget`/inline `fetch(http…)`/`requests.get`), redirecting network I/O
  to the allowlisted `eap_fetch`. It **inherits host credentials** and is **not**
  OS-isolated. This is a policy control, documented as such — not a sandbox.
- Real isolation (bwrap/landlock/containers) is an explicit later layer.

## Honesty

`eap_stats` reports **measured** bytes-kept-out (real `read`/`fetch` byte
counts inside the subprocess), not a modeled percentage against a dump-all
strawman. No "99%" headline. See `../../docs/EFFICIENCY.md`.

## Status

`src/store.mjs` implements the clean-room deterministic FTS core (index/search)
on `node:sqlite` with a passing test (`../../tests/runtime-store.test.mjs`). The
executor, MCP framing, and session-continuity snapshotting are the next build
step and are specified above.
