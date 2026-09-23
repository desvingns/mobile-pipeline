# Handoff

Last session: Claude · 2026-09-04 · added `graph/` — the node-view of both pipelines.

## DONE

- New `graph/` tree: a dependency-free node editor (pan/zoom, draggable nodes, ports, labelled
  bezier edges, side panel, search, deep links, contracts layer) written in vanilla JS. Opens
  straight from disk over `file://` — data lives in `data/*.js` behind a one-line
  `window.MP_GRAPH_REGISTER({…})` wrapper because `fetch()` and ES modules are blocked there.
- Three hand-authored graphs, every node explained in plain Russian on one running example
  («Избранное» в приложении рецептов):
  - `data/overview.js` — 14 nodes: how `/mp-spec` and `/mp` compose into the five pipelines.
  - `data/mp-spec.js` — 53 nodes / 77 edges / 6 flows: A.0 crawl loop, clone analyzer fan-out,
    greenfield interview, brownfield feature mode, GATE 1/2, phases B–F, evaluator routing table.
  - `data/mp-dev.js` — 99 nodes / 159 edges / 22 flows: router, all 15 modes, the implementation
    chain, TDD order, semantic repair loop, post-ship tail, 12 scripts, 14 contracts, artifacts.
- `tests/test-graph.sh` — the drift guard. Wired into `validate-plugins.yml`.
- `.github/workflows/pages.yml` — publishes `graph/` to GitHub Pages on `graph/**` changes.
- Docs: `graph/README.md` (format + editing rules), links from `README.md` and
  `docs/ARCHITECTURE.md`, and a "keep the graph current" line in `AGENTS.md` → How to work.

## VERIFIED

- `bash tests/test-graph.sh` → PASS (all checks), plus a negative run: renaming one node's `src`
  makes it fail, restoring it makes it pass.
- `bash -n tests/test-graph.sh` clean. shellcheck not installed locally — CI covers it.
- Rendered in a browser at every graph and several flows; console clean; panel, search, flow
  switch, contracts toggle, fit and deep links all work.
- Nothing under `templates/`, `claude-plugins/` or `codex-plugins/` was touched, so
  `lib/build-marketplace.sh` and the regeneration drift gate are unaffected.

## DECISIONS

- **Topology is hand-authored, not generated from `templates/`.** A generator cannot write the
  plain-Russian "what this does, on this example" prose that makes the graph worth opening, and
  that prose is the whole point. The cost — staleness — is paid for by `tests/test-graph.sh`,
  whose reverse-coverage check fails when an agent or script exists in `templates/` but appears
  in no node (explicit exemptions go in `graph/data/ignore.txt` with a reason).
- **Data files are `.js`, not `.json`.** Same hand-edited JSON, one line of wrapper, but a plain
  `<script src>` works over `file://` while `fetch()` does not. That keeps "double-click to open"
  and "hand-edited JSON" true at the same time.
- **Comments inside a data file must occupy a whole line.** The validator strips exactly that
  form before parsing; anything else would risk mangling string content.
- **Opening view is a readable zoom, not fit-to-window.** A pipeline is a long horizontal chain;
  fitting it makes the labels unreadable. "Вписать" / `F` still gives the bird's eye.
- Nodes that exist but are never invoked (`mp-intake`, `backend-api-extractor`) and fallback-only
  agents (`mp-runner-*`, `mp-reviewer-*` as agents) are drawn honestly with a badge, so nobody
  hunts for them in the chain.
- **A node title says why the step exists, never what it is called.** Commands, flags and agent
  ids belong to the mono `tech` line under the title; the title is a short Russian verb phrase
  ("Написать код", "Проверить руками перед пушем"), capped at 40 chars. `tests/test-graph.sh`
  enforces it — a title containing a command or a `{{…}}` placeholder fails the build. Reading a
  card should answer "why is this here" before "what is it called".

## NEXT

- Enable Pages in the repository settings (Settings → Pages → Source: GitHub Actions). Until
  then `pages.yml` fails; nothing else depends on it and the local file works regardless.
- When `VERSION` is bumped, bump `pipelineVersion` in all three `graph/data/*.js` — the guard
  checks it.

## OWNER

Free.

## BLOCKERS

None.
