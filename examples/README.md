# Example Workspaces

Each example is an isolated workspace package so schema-library versions, runtime commands, and container setup can evolve independently.

## Workspace Matrix

- `examples/valibot-node-zsh`: Node-oriented release CLI with zsh completion and nested subcommands
- `examples/zod-bun-bash`: Bun-oriented packaging CLI with bash completion and defaulted Zod schemas
- `examples/arktype-deno-pwsh`: Deno-style deployment CLI with pwsh completion and injected runtime state
- `examples/valibot-node-fish-runtime`: fish completion plus captured stdout and overridable exit behavior

## Running Locally

Node + zsh:

```bash
node --experimental-strip-types examples/valibot-node-zsh/src/index.ts deploy --api-key=sk_live_demo
```

Bun + bash:

```bash
bun run examples/zod-bun-bash/src/index.ts publish --tag=latest
```

Deno-style runtime:

```bash
node --experimental-strip-types examples/arktype-deno-pwsh/src/index.ts
```

Fish runtime example:

```bash
node --experimental-strip-types examples/valibot-node-fish-runtime/src/index.ts completion fish
```

## Docker Validation

Each workspace owns its own Dockerfile. The root validator builds them individually:

```bash
vp run validate:examples:docker
```

That validates:

- `examples/valibot-node-zsh/Dockerfile`
- `examples/zod-bun-bash/Dockerfile`
- `examples/arktype-deno-pwsh/Dockerfile`
- `examples/valibot-node-fish-runtime/Dockerfile`
