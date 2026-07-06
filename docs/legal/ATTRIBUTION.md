# Attribution & Provenance

**EAP** (Efficient Agent Protocol) is an independent, MIT-licensed project
maintained solely by [jqbit](https://github.com/jqbit). It is a self-contained
hard fork/freeze with no upstream runtime dependency. This file records the
lineage of every idea and every line of third-party code, per layer.

## EAP-Voice (output compression)

Descends from **TLDR** (jqbit, MIT), which itself derives — with attribution —
from **caveman** by Julius Brussee (MIT) and jqbit's earlier TAUT→STFU→blunt
prompt lineage. The "compress like a caveman, sound like a senior engineer"
design (drop the persona, keep the compression) is documented in TLDR's
`data/philosophy.md`. All of this lineage is MIT and libre-compatible.

- **caveman** — https://github.com/JuliusBrussee/caveman — MIT, © 2026 Julius Brussee.
- **ponytail** by Dietrich Gebert — https://github.com/DietrichGebert/ponytail — MIT.
  EAP borrows ponytail's *concept* of a code-brevity discipline (the "ladder":
  YAGNI → reuse → stdlib → native → dep → one line → minimum) as an optional
  Voice sub-mode. Concept only; no ponytail source is used.

## EAP-Context (input / retrieval)

Forks the **graphify** code-graph engine.

- **graphify** — https://github.com/Graphify-Labs/graphify — **MIT License**.
  MIT permits redistribution, modification, and relicense-compatible
  combination. graphify's MIT `LICENSE` and its copyright notice are **retained
  verbatim** in `NOTICE`. Our modifications are added under the same MIT terms.
  This retained notice is the project's only permanent upstream tie, and being
  libre-compatible it constrains nothing.
- The graphify **name and branding are dropped** (YC/brand marks); EAP uses its
  own mark. Upstream corpora, CI refs to upstream infrastructure, and CDN
  assets are stripped from the fork.

## EAP-Runtime (working / tool-output offload)

**Independent clean-room reimplementation.** The context-offload pattern
("think in code": run a script in a subprocess and return only its summary;
auto-index oversized output behind a searchable pointer; persist session state
across compaction) is a general technique also seen in OpenAI Code Interpreter
and Anthropic's "code execution with MCP." EAP-Runtime implements it from a
written specification only.

- **context-mode** by Mert Köseoğlu (mksglu) —
  https://github.com/mksglu/context-mode — **Elastic License 2.0 (ELv2)**.
  ELv2 is **not** an open-source / libre license. **EAP uses zero context-mode
  source code.** EAP-Runtime was written from the architecture specification in
  `layers/eap-runtime/DESIGN.md` (a description of the *pattern*), by an
  implementer who did not read context-mode's TypeScript source or its
  distributed bundles. ELv2 obligations attach only to copied or distributed
  ELv2 software; a genuine clean-room reimplementation carries none. The
  context-mode **name/marks are not used**. No context-mode NOTICE or
  attribution file exists upstream, and because we copy nothing, there is
  nothing to carry.

## Contamination guard

`scripts/check-contamination.sh` fails the build on any occurrence of upstream
ELv2 identifiers (`context-mode`, `mksglu`, `Koseoglu`/`Köseoğlu`, `Elastic-2.0`,
`ELv2` outside this attribution file) or any vendored upstream bundle
(`*.bundle.mjs`). Clean-room contamination is a red build, not a lawsuit.

## Summary

EAP ships **MIT**, sole-copyright-holder for all original and clean-room code,
with a single retained MIT attribution to graphify's author for the graph
layer. Fully relicensable, zero copyleft, zero ELv2 contamination, zero
upstream runtime coupling.
