# Code map tools (Trail) and the graph report (Graphify)

Rewritten for this plugin from Trail's and Graphify's own docs (MIT and Apache-2.0). `ctx where` is the first call; reach for these when you need more than it returns. All are local, free, and need no key. Pick the one that fits and act on its answer; don't chain tools hoping for more.

| You are | Use |
|---|---|
| Landing in an unfamiliar repo, or asked for the architecture | read `graphify-out/GRAPH_REPORT.md` (god nodes, communities, surprising links), or `trail map` for directory clusters, hubs and hotspots. Then read the hub files it names; don't tour every subsystem. |
| Needing every occurrence (all call sites, all uses of a constant) | `trail grep "<short symbol or literal>"`: exhaustive, grouped by enclosing symbol, ranked by coupling. Search the bare name, not a guessed signature; if it misses, loosen it. `ctx where` is ranked top-N and can miss instances. |
| Asking what is in a file before editing it | `trail skeleton <file>`: signatures only, about a tenth of the tokens of reading it. |
| Renaming, deleting or changing a signature | `trail callers <symbol>` (who uses it); add `--depth 2` for what breaks, `--depth all` before a refactor or multi-file change, `--direction out` for what it depends on. Same job as `ctx impact`, but per symbol and transitive. |
| Asking how a flow works | `trail ask "<question>" --source`: ranked hits with the code inlined. One call per distinct sub-question, never the same one reworded. |
| Tracing how A reaches B | `graphify path "A" "B"` (add `--undirected` to ignore edge direction) |
| Wanting a node and its neighbors explained | `graphify explain "X"` (`--all` lists every connection) |
| Needing raw graph data | `graphify query "<terms>" --json` (nodes carry `source_file`, `line_start`, `community`; `--dfs` follows one chain, `--budget N` caps text output) |

## Things that bite

- Graphify `query` matches case-folded substrings weighted by rarity: no stemming, no synonyms, no other languages. If a query finds nothing, retry with 2 or 3 words that actually appear in the code (class names, folder names), not a description.
- Trail's tools refresh the map before answering, so they reflect uncommitted edits. Graphify's graph does not: `ctx status` says whether it is stale, and `graphify update .` refreshes it for code changes with no model call.
- Raw `grep` is for what neither tool indexes: docs, configs, brand-new files.
- Building the graph for documents, papers, images or video (the semantic pass) needs a model and is not part of this plugin's setup. `graphify update .` covers code only, which is what `ctx` uses.
