#!/usr/bin/env bash

set -euo pipefail

repo_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)

run_example_build() {
  local name=$1
  local dockerfile=$2

  echo "[docker] validating ${name}"
  docker build \
    --file "$repo_root/$dockerfile" \
    --tag "clily-${name}:local" \
    "$repo_root"
}

run_example_build "example-valibot-node-zsh" "examples/valibot-node-zsh/Dockerfile"
run_example_build "example-zod-bun-bash" "examples/zod-bun-bash/Dockerfile"
run_example_build "example-valibot-node-fish-runtime" "examples/valibot-node-fish-runtime/Dockerfile"
run_example_build "example-arktype-deno-pwsh" "examples/arktype-deno-pwsh/Dockerfile"

echo "[docker] example validation complete"