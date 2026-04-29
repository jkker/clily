# clily Monorepo

This repository is the monorepo for the `@clily/*` organization.

## Workspaces

- `packages/core`: the publishable CLI framework package, `@clily/core`
- `examples/zod-node-release`: Node + Zod release workflow with nested subcommands and layered config/env/CLI input
- `examples/zod-node-package`: Node + Zod packaging workflow with a custom public logger implementation
- `examples/arktype-node-rollout`: Node + ArkType rollout workflow with aliases, positionals, and lifecycle hooks
- `examples/zod-node-maintenance`: Node + Zod maintenance workflow with array positionals and plugin-based cleanup

## Packages

### `@clily/core`

The framework package lives in [packages/core/README.md](packages/core/README.md).

Install it with:

```bash
vp add @clily/core
```

## Examples

See [examples/README.md](examples/README.md) for the workspace matrix, local verification commands, and Docker validation details.

## Monorepo Development

```bash
vp install
vpr ready
```
