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

run_example_build "example-zod-node-release" "examples/zod-node-release/Dockerfile"
run_example_build "example-zod-node-package" "examples/zod-node-package/Dockerfile"
run_example_build "example-zod-node-maintenance" "examples/zod-node-maintenance/Dockerfile"
run_example_build "example-arktype-node-rollout" "examples/arktype-node-rollout/Dockerfile"

echo "[docker] example validation complete"
