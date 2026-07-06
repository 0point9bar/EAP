# Efficiency — how EAP measures and reports token savings

EAP makes **no** headline efficiency claim it cannot reproduce. This page is the
standard every number in this repo must meet.

## Why we reprint none of the upstream numbers

- context-mode's "99% context reduction" is `(1 − terse_hand_summary_bytes /
  raw_file_bytes)` against a strawman "dump every raw byte into context"
  baseline. Its own aggregate is lower (~96%), and its lossless retrieval path
  is only ~44–93%. The best-case rows are cherry-picked.
- graphify's headline retrieval multiples are measured against "dump all files
  every query" and contradict its own honest code-intel benchmark; some
  headline numbers ship without a reproducible harness.
- TLDR's own output-reduction figures are **historical** (an older prompt
  generation) and are net-negative on already-terse workloads.

None of these are reproduced in EAP. We publish only what `bench/` reproduces.

## The rules

1. **Realistic baseline.** The honest baseline is `B1` — a competent
   grep-and-read agent — not `B0`, the dump-everything strawman. `B0` may be
   reported for context but is **always explicitly labeled a strawman**.
2. **Per-layer, never multiplied.** Report input-token savings (Context),
   working-token savings (Runtime), and output-token savings (Voice)
   **separately**. Never multiply the three percentages into one compounded
   headline — the membranes are independent, and a product-of-percentages
   number is meaningless.
3. **Task success is a first-class metric.** Every efficiency table reports
   task success / accuracy next to token counts. A configuration that saves
   tokens but lowers success is a **regression**.
4. **Lossy vs lossless, with recall.** Retrieval that returns summaries (lossy)
   is reported separately from retrieval that returns exact chunks/pointers
   (lossless), each with recall. We never blend them into one number.
5. **Full distribution, not best case.** Report the aggregate and the full
   per-task distribution. No cherry-picked best rows.
6. **Reproducible or unpublished.** If `make bench` does not reproduce it, it
   does not appear in the README.

## The harness (`bench/`)

- A **committed** fixed corpus and a fixed task suite.
- Token counts from a committed tokenizer script (documented approximation
  where an exact model tokenizer is unavailable).
- Arms: `B0` (strawman dump-all, labeled), `B1` (realistic grep+read agent —
  the honest baseline), `B2` (EAP-on).
- Metrics per layer and end-to-end: input tokens, working tokens, output
  tokens, total tokens, and task success.

Until the harness is populated with committed runs, this repo makes **no
quantitative efficiency claim** — only the qualitative one that each layer
removes tokens at its membrane while preserving correctness.
