# Example Workspaces

Each example is an isolated workspace package so schema-library versions, command trees, and container checks can evolve independently.

## Workspace Matrix

- `examples/zod-node-release`: nested release commands with config/env/CLI merging and `clily.command()`
- `examples/zod-node-package`: custom `clily.Logger` implementation with build and publish commands
- `examples/arktype-node-rollout`: ArkType-based rollout commands with aliases, positionals, and plugins
- `examples/zod-node-maintenance`: array positionals plus setup/cleanup-style plugin behavior

## Running Locally

Release workflow:

```bash
cd examples/zod-node-release
RELEASE_DEPLOY_REPLICAS=4 node src/index.ts deploy production --image=ghcr.io/acme/web
```

That example intentionally exercises all four layers together:

- `package.json` provides `profile=prod` and `region=eu-west-1`
- the env var overrides `replicas`
- the CLI provides `image` and the target positional
- schema defaults still backstop anything left unset

Package workflow:

```bash
cd examples/zod-node-package
PACKAGECTL_PUBLISH_RETRIES=5 node src/index.ts publish --tag=next
```

Rollout workflow:

```bash
cd examples/arktype-node-rollout
node src/index.ts ship production --revision=rev-42 --replicas=3 --strategy=blue-green
```

Maintenance workflow:

```bash
cd examples/zod-node-maintenance
node src/index.ts backup db uploads --no-compress
```

## Docker Validation

Each workspace owns its own Dockerfile. The root validator builds them individually:

```bash
vp run validate:examples:docker
```

That validates:

- `examples/zod-node-release/Dockerfile`
- `examples/zod-node-package/Dockerfile`
- `examples/arktype-node-rollout/Dockerfile`
- `examples/zod-node-maintenance/Dockerfile`
