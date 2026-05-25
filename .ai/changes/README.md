# `.ai/changes/` — agent/skill change-log + sync cursor

Append-only journal of edits to agents, skills, and templates, plus a per-adapter sync cursor.
Purpose: let a sync propagate changes into the per-tool adapters (`AGENTS.md`, `.codex/`) or a
downstream project by reading **only new entries**, never the whole system.

## `agent-skill-log.md` — entry format

One entry per change, newest at the bottom (append-only, immutable):

```
## <id>
type: add | update | fix | remove
target: <repo-relative path of the canonical file that changed>
summary: <one line — what changed>
reason: <one line — why>
affects: <comma-separated adapters this change must propagate to: claude, codex — or empty>
by: <claude | codex>
```

- `<id>` is `YYYY-MM-DDTHH:MM-<slug>`, monotonically increasing, globally unique, never reused.
- Entries are immutable. A later correction is a *new* entry, never an edit of an old one.
- `affects` declares intent (which adapters care). It never mutates. Whether an adapter has
  *consumed* an entry is tracked only in `sync-state.json`.

## `sync-state.json` — the cursor (authoritative)

```json
{ "claude": "<last-consumed-id|null>", "codex": "<last-consumed-id|null>" }
```

`lib/sync.sh <adapter>` reads entries whose id is greater than `cursor[adapter]`, propagates
them, then advances `cursor[adapter]` to the newest processed id. `null` means "consume from
the beginning". Only `lib/sync.sh` writes this file.
