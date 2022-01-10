#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$( cd -- "$(dirname "$0")" >/dev/null 2>&1; pwd -P )"
OUTDIR="${OUTDIR:-out}"
ENABLE_TREE_HASH_OUTPUT="${ENABLE_TREE_HASH_OUTPUT:-no}"

# Step 1: Create output directory:
mkdir "$OUTDIR"

function cp_to_outdir() {
  out_filepath="$OUTDIR/$1"
  mkdir -p "${out_filepath%/*}"
  cp /dev/stdin "$out_filepath"
  echo "'$1' -> '$out_filepath'"
}

# Step 2: Copy all package.json files by extracting only the necessary fields
# from them via `jq``:

all_package_json_files="$(git ls-files --full-name -- '**package.json')"

for file in $all_package_json_files; do
  jq -f "$SCRIPT_DIR/package_json_filter.jq" "$file" | cp_to_outdir "$file"
done

# Step 3: Copy additional files:
additional_files=(
    yarn.lock
    .yarnrc.yml
    .yarn/releases/yarn-3.1.1.cjs
    scripts/ci/gather_files_for_yarn_install.bash
    scripts/ci/init_repo_in_container.bash
    scripts/ci/package_json_filter.jq
)

# Additional files necessary for deterministic tree hash:
if [ "$ENABLE_TREE_HASH_OUTPUT" = "yes" ]; then
  additional_files+=(
    Dockerfile
  )
fi

for file in "${additional_files[@]}"; do
  cp_to_outdir "$file" < "$file"
done

if [ "$ENABLE_TREE_HASH_OUTPUT" = "yes" ]; then
  git -C "$OUTDIR" init --initial-branch=tmp
  git -C "$OUTDIR" add .
  git -C "$OUTDIR" write-tree > "$OUTDIR/tree_hash"
  rm -rf "$OUTDIR/.git"
  echo "Computed tree hash: '$(cat $OUTDIR/tree_hash)'"
fi
