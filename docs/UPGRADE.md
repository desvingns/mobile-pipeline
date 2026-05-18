# UPGRADE — pulling cmp improvements into an existing project

When cmp publishes a new version (PATCH / MINOR / MAJOR) you may want to update an
existing project to get the new agent prompts, workflow tweaks, etc.

## v1.0.0 — manual upgrade (no `--upgrade` flag yet)

Automated upgrade is planned for v1.1.0+ but not shipped. For now, the manual flow:

### Step 1 — find your project's current cmp version

```bash
cat .claude/.cmp-version
# version: 1.0.0
# generated: 2026-05-18
# platforms: android
# prefix: ft
# package: com.example.fitness
```

### Step 2 — see what changed in cmp since then

```bash
cd /path/to/claude-mobile-pipeline
git log --oneline v1.0.0..HEAD
git diff v1.0.0..HEAD -- templates/
cat CHANGELOG.md  # human-curated summary per version
```

### Step 3 — re-bootstrap into a sibling temp directory

```bash
# In a clean temp dir, run bootstrap with the SAME flags as .cmp-version
mkdir /tmp/cmp-upgrade-preview && cd /tmp/cmp-upgrade-preview
bash /path/to/claude-mobile-pipeline/bootstrap.sh \
    --platform=android \
    --prefix=ft \
    --project-name="Fitness Tracker" \
    --package=com.example.fitness \
    --ui-lang=ru \
    --skip-memory
```

### Step 4 — diff against your project

```bash
diff -r /tmp/cmp-upgrade-preview/.claude /path/to/your/project/.claude
diff /tmp/cmp-upgrade-preview/CLAUDE.md /path/to/your/project/CLAUDE.md
```

### Step 5 — apply selectively

- For files you have NOT modified locally → safe to copy over.
- For files you HAVE customised → `git mergetool` or manual three-way merge.
- For `.cmp-version` → update version line to new value.

Update `STATE.md` → "Last completed: upgraded cmp infrastructure to vN.M.P".

## v1.1.0+ — `bootstrap.sh --upgrade` (planned)

Future flow:

```bash
cd /path/to/your/project
bash /path/to/claude-mobile-pipeline/bootstrap.sh --upgrade
```

This will:
1. Read `.claude/.cmp-version` to know your starting point.
2. Show `git diff v<old>..HEAD` summary in cmp repo.
3. For each changed template file:
   - If your project's copy matches the OLD version (unmodified) → apply patch automatically.
   - If your copy diverges → write conflicted version and invoke `git mergetool` (or print the patch and let you handle).
4. Update `.claude/.cmp-version` to new version.

Until that ships, use the manual flow above.

## When NOT to upgrade

- If `STATE.md` shows an iteration in flight (`In progress: …`) — finish or revert that work first.
- If cmp's CHANGELOG has a BREAKING change (MAJOR bump) — read the migration notes in
  the CHANGELOG carefully before pulling.
- If your project has heavily customised `dh-*` agents — upgrade selectively, skipping
  changes to your customised files.
