#!/usr/bin/env bash
# test-graph.sh — keep graph/ honest.
#
# The node graph under graph/ is hand-authored on purpose (topology is NOT generated
# from templates/). That makes it readable and lets it carry plain-Russian explanations
# a generator could never write — but it also means it can silently rot. This test is
# the cheap watchdog: add an agent, a script or a mode and forget the graph, and CI fails.
#
# Golden rules honoured: cross-platform Bash (Linux/macOS/Windows Git Bash), never `sed -i`.
# JSON-level checks need python3/python; without it they are skipped with a warning and the
# grep-level checks still run.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GRAPH="$ROOT/graph"
DATA="$GRAPH/data"
IGNORE="$DATA/ignore.txt"

fails=0
pass() { echo "  ok   $1"; }
fail() { echo "  FAIL $1" >&2; fails=$((fails + 1)); }

echo "test-graph: viewer files"

for f in index.html expert.html assets/app.js assets/styles.css assets/demo.js assets/demo.css story/scenario.js story/timing.js data/overview.js data/mp-spec.js data/mp-dev.js; do
  if [ -f "$GRAPH/$f" ]; then pass "graph/$f exists"; else fail "graph/$f is missing"; fi
done

# The viewer must stay openable straight from disk: no fetch(), no ES modules.
if grep -nE 'fetch[(]["'"'"'`]|type=["'"'"']module["'"'"']' "$GRAPH/index.html" "$GRAPH/expert.html" "$GRAPH/assets/app.js" "$GRAPH/assets/demo.js" >/dev/null 2>&1; then
  fail "graph uses fetch() or an ES module — that breaks opening index.html over file://"
else
  pass "no fetch()/ES modules (works over file://)"
fi

echo "test-graph: data wrapper shape"

for f in "$DATA"/*.js; do
  name="$(basename "$f")"
  last="$(awk '!/^[[:space:]]*$/ { line = $0 } END { print line }' "$f")"
  if grep -Fxq 'window.MP_GRAPH_REGISTER({' "$f" && [ "$last" = "});" ]; then
    pass "$name has the MP_GRAPH_REGISTER wrapper"
  else
    fail "$name must start with 'window.MP_GRAPH_REGISTER({' and end with '});'"
  fi
done

echo "test-graph: every template agent and script is on the graph"

# Coverage is a plain substring search, so a node may also claim extra files via "also".
collect_sources() {
  find "$ROOT/templates" -type f \( -name '*.md' -path '*/agents/*' -o -name '*.sh' \) \
    | sed "s#^$ROOT/##" | tr '\134' '/' | sort
}

missing=0
while IFS= read -r rel; do
  [ -n "$rel" ] || continue
  if [ -f "$IGNORE" ] && grep -Fq "$rel" "$IGNORE"; then continue; fi
  if ! grep -Fq "$rel" "$DATA"/*.js; then
    fail "not referenced by any graph node: $rel"
    missing=$((missing + 1))
  fi
done <<EOF
$(collect_sources)
EOF
[ "$missing" -eq 0 ] && pass "all agents and scripts are covered"

echo "test-graph: every /mp mode has a flow"

modes="$(grep -v '^#' "$ROOT/templates/common/commands/runtime/manifest.tsv" | cut -f1)"
for mode in $modes; do
  if grep -Fq "\"id\": \"$mode\"" "$DATA/mp-dev.js"; then
    pass "mode --$mode has a flow"
  else
    fail "mode --$mode from manifest.tsv has no flow in graph/data/mp-dev.js"
  fi
done

echo "test-graph: version stamp"

version="$(tr -d '[:space:]' < "$ROOT/VERSION")"
for f in "$DATA"/*.js; do
  name="$(basename "$f")"
  if grep -Fq "\"pipelineVersion\": \"$version\"" "$f"; then
    pass "$name is stamped $version"
  else
    fail "$name pipelineVersion does not match VERSION ($version)"
  fi
done

echo "test-graph: structural checks (JSON)"

PY=""
for cand in python3 python; do
  if command -v "$cand" >/dev/null 2>&1; then PY="$cand"; break; fi
done

if [ -z "$PY" ]; then
  echo "  warn python not found — skipping JSON structural checks"
else
  # Windows consoles default to a legacy codepage, which mangles Russian titles in the
  # failure messages. Force UTF-8 so a failure is readable on every host.
  if PYTHONIOENCODING=utf-8 "$PY" - "$ROOT" <<'PY'
import glob, json, os, re, sys

root = sys.argv[1]
data_dir = os.path.join(root, 'graph', 'data')
errors = []

def load(path):
    with open(path, encoding='utf-8') as fh:
        text = fh.read()
    # whole-line block comments are the only comment form allowed inside the payload
    text = '\n'.join(l for l in text.split('\n') if not re.match(r'^\s*/\*.*\*/\s*$', l))
    match = re.search(r'window\.MP_GRAPH_REGISTER\((.*)\);\s*$', text, re.S)
    if not match:
        raise ValueError('no MP_GRAPH_REGISTER wrapper')
    return json.loads(match.group(1))

for path in sorted(glob.glob(os.path.join(data_dir, '*.js'))):
    name = os.path.basename(path)
    try:
        graph = load(path)
    except Exception as exc:
        errors.append('%s: %s' % (name, exc))
        continue

    nodes = {n['id']: n for n in graph['nodes']}
    if len(nodes) != len(graph['nodes']):
        errors.append('%s: duplicate node ids' % name)

    # every declared source file must exist on disk
    for node in graph['nodes']:
        for rel in ([node['src']] if node.get('src') else []) + node.get('also', []):
            if not os.path.isfile(os.path.join(root, rel)):
                errors.append('%s: node "%s" points at a missing file: %s' % (name, node['id'], rel))

    # every node needs a Russian explanation
    for node in graph['nodes']:
        if not (node.get('ru') or {}).get('what'):
            errors.append('%s: node "%s" has no ru.what' % (name, node['id']))

    # A title answers "why this step exists", in short plain Russian. The command,
    # its flags and the agent id live in `tech` — never in the title.
    for node in graph['nodes']:
        title = node.get('title', '')
        if not title:
            errors.append('%s: node "%s" has no title' % (name, node['id']))
        elif '/mp' in title or title.startswith('--') or '{{' in title:
            errors.append('%s: node "%s" title carries a command or placeholder — '
                          'move it to "tech": %r' % (name, node['id'], title))
        elif len(title) > 40:
            errors.append('%s: node "%s" title is too long (%d chars, max 40): %r'
                          % (name, node['id'], len(title), title))

    def ports(node_id, side):
        node = nodes.get(node_id) or {}
        return {p['id'] for p in (node.get('ports') or {}).get(side, [])}

    edge_ids = set()
    for edge in graph['edges']:
        if edge['id'] in edge_ids:
            errors.append('%s: duplicate edge id "%s"' % (name, edge['id']))
        edge_ids.add(edge['id'])
        for ref, side in ((edge['from'], 'out'), (edge['to'], 'in')):
            node_id, _, port = ref.partition(':')
            if node_id not in nodes:
                errors.append('%s: edge "%s" points at unknown node "%s"' % (name, edge['id'], node_id))
            elif port and port not in ports(node_id, side):
                errors.append('%s: edge "%s" uses unknown %s port "%s" on "%s"'
                              % (name, edge['id'], side, port, node_id))

    flow_ids = set()
    for flow in graph['flows']:
        if flow['id'] in flow_ids:
            errors.append('%s: duplicate flow id "%s"' % (name, flow['id']))
        flow_ids.add(flow['id'])
        for node_id in flow.get('nodes', []):
            if node_id not in nodes:
                errors.append('%s: flow "%s" lists unknown node "%s"' % (name, flow['id'], node_id))
        for edge_id in flow.get('edges', []):
            if edge_id not in edge_ids:
                errors.append('%s: flow "%s" lists unknown edge "%s"' % (name, flow['id'], edge_id))
        for edge in graph['edges']:
            for key in ('only', 'not'):
                for scoped in edge.get(key, []):
                    if scoped not in {f['id'] for f in graph['flows']}:
                        errors.append('%s: edge "%s" scopes to unknown flow "%s"' % (name, edge['id'], scoped))

    print('  ok   %s parses: %d nodes, %d edges, %d flows'
          % (name, len(graph['nodes']), len(graph['edges']), len(graph['flows'])))

for err in sorted(set(errors)):
    print('  FAIL %s' % err, file=sys.stderr)
sys.exit(1 if errors else 0)
PY
  then
    pass "structural checks"
  else
    fail "structural checks"
  fi
fi

echo
if [ "$fails" -eq 0 ]; then
  echo "test-graph: PASS"
else
  echo "test-graph: FAIL ($fails problem(s))" >&2
  exit 1
fi
