# EAP-Context — design & fork plan

EAP-Context is the **input membrane**: it reduces the tokens that flow *into*
context during retrieval. Instead of loading whole files, the agent queries a
local code-symbol graph and receives a small subgraph plus `file:line` pointers
it opens on demand.

## Provenance (MIT fork — forkable)

EAP-Context is a **fork of the MIT-licensed graphify graph engine**
(https://github.com/Graphify-Labs/graphify). MIT permits this. graphify's MIT
`LICENSE` and copyright notice are retained (see `../../NOTICE`); modifications
are added under the same MIT terms. Unlike EAP-Runtime, no clean-room firewall
is required here — the code is libre and may be forked directly.

## What the fork keeps (the engine)

- **AST → symbol graph.** tree-sitter parses source; nodes are symbols
  (functions, classes, modules); edges are calls/imports/references with
  per-edge `EXTRACTED` vs `INFERRED` provenance.
- **Seed scoring + traversal.** trigram/IDF seed scoring on the query; bounded
  BFS/DFS (depth ~3) with "god-node" avoidance so hub symbols don't blow up the
  subgraph.
- **Query surface (MCP tools).** `query_graph`, `get_node`, `get_neighbors`,
  `get_community`, `god_nodes`, `graph_stats`, `shortest_path`, plus the PR-impact
  tools — renamed to the `eap_graph_*` namespace.
- **Materialized cache.** The graph persists as node-link JSON under `.eap/`
  (NetworkX's natural format); it is a cache, not a second source of truth.

## What the fork strips (hard-freeze hygiene)

- The **graphify name and branding** (YC/brand marks, Discord/FUNDING badges) —
  EAP uses its own mark.
- Any **upstream corpus** vendored for benchmarks (e.g. a bundled httpx tree).
- Any **CI reference to upstream infrastructure** (e.g. an `origin/v8` ref) and
  any **CDN-loaded assets** — EAP self-hosts or drops them.
- Unreproducible **headline benchmark numbers** (LOCOMO/LongMemEval-style rows
  whose harness is not shipped). EAP publishes only what its own `bench/`
  reproduces (see `../../docs/EFFICIENCY.md`).

## Integration on the EAP spine

- Ships as an **MCP server** registered by the shared installer (the TLDR
  `tldr-shrink` registration is the precedent), plus a **skill** that teaches the
  agent to prefer a graph query over a raw file read.
- The `PreToolUse` hook nudges: when the agent is about to read a large file,
  suggest `eap_graph_query` first.
- Retrieval routing: the shared `eap_search` front door sends **code-symbol**
  queries here and **blob/log/doc** queries to EAP-Runtime's FTS store. No
  functional duplication.

## Runtime & dependencies

- Python (tree-sitter grammars + a graph library). This is the one heavier
  runtime in EAP; it is **optional and independently installable** — EAP-Voice
  and EAP-Runtime work without it. All third-party Python deps are pinned and
  enumerated in the fork's lockfile so the supply-chain surface is explicit and
  auditable (hard-freeze requirement).

## Correctness

Graph retrieval returns **pointers**, not summaries — the agent opens the real
`file:line`, so retrieval is lossless. If the graph is stale or missing, the
agent falls back to ordinary read/grep (the lossless escape hatch). The graph
never rewrites source.

## Status

Design + fork plan (this document). The engine port from the MIT upstream — AST
ingest, graph build, the `eap_graph_*` MCP surface, and the `.eap/` cache — is
the next build step, following the strip list above.
