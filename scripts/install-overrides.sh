#!/usr/bin/env bash
# Plugin agents can't replace built-ins, so copy the overrides to user scope, which can.
set -eu
dest="$HOME/.claude/agents"
mkdir -p "$dest"
for f in "${CLAUDE_PLUGIN_ROOT}"/overrides/*.md; do
  cmp -s "$f" "$dest/$(basename "$f")" || cp "$f" "$dest/"
done
