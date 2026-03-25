# clily Monorepo

This repository is the monorepo for the `@clily/*` organization.

## Workspaces

- `packages/core`: the publishable CLI framework package, `@clily/core`
- `examples/valibot-node-zsh`: Node + Valibot + zsh completion example workspace
- `examples/zod-bun-bash`: Bun + Zod + bash completion example workspace
- `examples/arktype-deno-pwsh`: Deno-style + ArkType + pwsh completion example workspace
- `examples/valibot-node-fish-runtime`: Node + Valibot + fish completion + injected runtime example workspace

Each example is a real workspace with its own dependencies, scripts, and Dockerfile so schema-library versions and runtime setup can diverge independently over time.

## Packages

### `@clily/core`

The framework package lives in [packages/core/README.md](packages/core/README.md).

Install it with:

```bash
vp add @clily/core
```

## Examples

See [examples/README.md](examples/README.md) for the workspace matrix, runtime-specific scripts, and Docker validation details.

## Monorepo Development

```bash
vp install
vp run check
vp run test
vp run validate:dist
vp run validate:examples:docker
vp run build
```
