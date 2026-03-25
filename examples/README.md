# clily Examples

These examples are intentionally varied so the public API gets exercised across:

- Standard Schema libraries: Valibot, Zod, ArkType
- Shell completion targets: zsh, bash, fish, pwsh
- Runtime styles: default Node-style execution, Bun-oriented workflows, Deno-style injected runtimes
- Operational modes: subcommands, config defaults, hooks, runtime injection, completion generation

## Example Matrix

- `valibot-node-zsh.ts`: Node-oriented release CLI with zsh completion and nested subcommands
- `zod-bun-bash.ts`: Bun-style packaging CLI with bash completion and defaulted Zod schemas
- `arktype-deno-pwsh.ts`: Deno-style deployment CLI using injected runtime values and pwsh completion
- `valibot-node-fish-runtime.ts`: Fish completion plus captured stdout and overridable exit behavior

## Running Locally

These files import from `../src/index.ts` so they run directly against the workspace source.

Node:

```bash
node --import tsx examples/valibot-node-zsh.ts deploy --api-key sk_live_demo
```

Bun:

```bash
bun examples/zod-bun-bash.ts publish --tag latest
```

Deno-style injected runtime:

```bash
node --import tsx examples/arktype-deno-pwsh.ts
```

Fish completion demo:

```bash
node --import tsx examples/valibot-node-fish-runtime.ts completion fish
```

## Shell Completion Notes

Each example pins a preferred shell in its `completion` config, but all of them keep the full shell set enabled so you can generate scripts for:

- `bash`
- `zsh`
- `fish`
- `pwsh`
