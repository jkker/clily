# @clily/core

A modern, highly ergonomic TypeScript CLI framework for Node, Bun, and Deno-style runtimes. clily acts as a unified configuration and execution engine, merging CLI arguments, environment variables, and local/global configuration files into a Single Source of Truth (SSOT) validated by [Standard Schema](https://standardschema.dev/).

## Features

- **Standard Schema validation** — Use Valibot, Zod, ArkType, or any Standard Schema-compatible library
- **End-to-end type safety** — Advanced generics auto-merge flags and args into handler parameters
- **Config resolution** — Merges CLI args > env vars > config files > schema defaults via `c12`
- **Interactive fallback** — Prompts for missing required fields in TTY via `@clack/prompts`
- **Subcommand tree** — Nested commands with inherited global flags and per-child type inference
- **Shell completions** — Generate Bash, Zsh, Fish, and PowerShell completion scripts
- **Injectable runtime boundary** — Override argv, env, cwd, stdout, debug/error logging, and exit handling for tests or embedding

## Install

```bash
vp add @clily/core
```

## Quick Start

```ts
import { clily } from '@clily/core'
import * as v from 'valibot'

const cli = clily({
  name: 'mycli',
  version: '1.2.0',
  completion: true,
  flags: v.object({
    verbose: v.optional(v.boolean(), false),
    logLevel: v.optional(v.picklist(['info', 'debug', 'warn', 'error']), 'info'),
  }),
  handler: async (args) => {
    if (args.verbose) console.log('Verbose mode enabled')
  },
  children: {
    deploy: {
      description: 'Deploy the project',
      args: v.object({
        apiKey: v.string(),
        dryRun: v.optional(v.boolean(), false),
      }),
      handler: async (args) => {
        console.log(`Deploying with key: ${args.apiKey}`)
      },
    },
  },
})

await cli()
```

## Public API

The root package intentionally exposes a narrow API surface:

- `clily`
- `createRuntime`
- `getExecutionEnvironment`
- `ClilyCommandError`

Public root-level types:

- `ClilyOptions`
- `ClilyHooks`
- `ClilyRuntime`
- `ClilyExitRequest`
- `CompletionConfig`
- `CompletionShell`
- `ExecutionEnvironment`

Internal schema plumbing, help/completion builders, and generic helper types are intentionally not exported from the package root.

## Examples

The monorepo includes separate example workspaces in [examples/README.md](../../examples/README.md) that validate:

- Valibot, Zod, and ArkType
- zsh, bash, fish, and pwsh completions
- Node, Bun, and Deno-style runtime flows
- injected exit and output handling for embedding and tests

## Development

```bash
cd packages/core
vp check
vp test --typecheck
vp pack
vp run validate:dist
```
