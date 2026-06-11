#!/usr/bin/env bash
# element-manifest.sh — distil crawl uiautomator dumps (ST*.xml) into per-state JSON manifests
# of every INTERACTIVE element (clickable / long-clickable): class, resource-id, text,
# content-desc, bounds. These manifests are the deterministic ground truth for
# "no forgotten button": spec-evaluator Class 5 audits the inventory against them, and the
# build-time --fit gate diffs the built app's element tree against them.
#
# Usage: element-manifest.sh --states-dir <dir with ST*.xml> --out-dir <dir>
# Output: <out-dir>/ST*.json (one per dump) + ONE summary JSON line on stdout.
# Offline (no adb). Cross-platform bash + awk. Always exits 0 with a JSON line unless args are bad.
set -u

emit() { printf '%s\n' "$1"; exit "${2:-0}"; }

states_dir=""; out_dir=""
while [ $# -gt 0 ]; do
  case "$1" in
    --states-dir) states_dir="${2-}"; shift 2 2>/dev/null || shift ;;
    --out-dir)    out_dir="${2-}";    shift 2 2>/dev/null || shift ;;
    -h|--help)    sed -n '2,11p' "$0"; exit 0 ;;
    *) emit "{\"ok\":false,\"error\":\"unknown arg: $1\"}" 2 ;;
  esac
done
[ -n "$states_dir" ] && [ -d "$states_dir" ] || emit '{"ok":false,"error":"--states-dir missing or not a directory"}' 2
[ -n "$out_dir" ] || emit '{"ok":false,"error":"--out-dir is required"}' 2
mkdir -p "$out_dir" 2>/dev/null || emit "{\"ok\":false,\"error\":\"cannot create $out_dir\"}"

states=0; total=0
for xml in "$states_dir"/ST*.xml; do
  [ -f "$xml" ] || continue
  base="$(basename "$xml" .xml)"
  out="$out_dir/$base.json"

  # Split the (often single-line) dump into one <node .../> per line, keep interactive nodes,
  # extract the attributes we care about, emit one JSON object per element.
  count="$(sed 's/></>\
</g' "$xml" | awk -v state="$base" -v src="$base.xml" -v out_file="$out" '
    function attr(s, name,   re, v) {
      re = name "=\"[^\"]*\""
      if (match(s, re)) { v = substr(s, RSTART, RLENGTH); sub(name "=\"", "", v); sub(/"$/, "", v); return v }
      return ""
    }
    function jesc(s) { gsub(/\\/, "\\\\", s); gsub(/"/, "\\\"", s); gsub(/\r|\n/, " ", s); return s }
    BEGIN { n = 0 }
    /<node / {
      if ($0 !~ /clickable="true"/ && $0 !~ /long-clickable="true"/) next
      cls = attr($0, "class"); rid = attr($0, "resource-id"); txt = attr($0, "text")
      cd  = attr($0, "content-desc"); b = attr($0, "bounds")
      ck  = ($0 ~ /[^-]clickable="true"/) ? "true" : "false"
      lck = ($0 ~ /long-clickable="true"/) ? "true" : "false"
      el[++n] = "    {\"class\":\"" jesc(cls) "\",\"resource_id\":\"" jesc(rid) "\",\"text\":\"" jesc(txt) "\",\"content_desc\":\"" jesc(cd) "\",\"bounds\":\"" jesc(b) "\",\"clickable\":" ck ",\"long_clickable\":" lck "}"
    }
    END {
      print "{" > out_file
      print "  \"state\": \"" state "\"," > out_file
      print "  \"source\": \"" src "\"," > out_file
      print "  \"elements\": [" > out_file
      for (i = 1; i <= n; i++) print el[i] ((i < n) ? "," : "") > out_file
      print "  ]" > out_file
      print "}" > out_file
      print n
    }
  ')"
  case "$count" in ''|*[!0-9]*) count=0 ;; esac
  states=$((states + 1)); total=$((total + count))
done

[ "$states" -gt 0 ] || emit "{\"ok\":false,\"error\":\"no ST*.xml dumps in $states_dir\"}" 1
emit "{\"ok\":true,\"states\":$states,\"elements_total\":$total,\"out_dir\":\"$out_dir\"}"
