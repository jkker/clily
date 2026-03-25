# clily

A modern, highly ergonomic TypeScript CLI framework for Node/Bun. clily acts as a unified configuration and execution engine, merging CLI arguments, environment variables, and local/global configuration files into a Single Source of Truth (SSOT) validated by [Standard Schema](https://standardschema.dev/).

## Features

- **🔧 Standard Schema validation** — Use Valibot, Zod, ArkType, or any Standard Schema-compatible library
- **🎯 End-to-end type safety** — Advanced generics auto-merge flags & args into handler parameters
- **📦 Config resolution** — Merges CLI args > env vars > config files > schema defaults via [c12](https://github.com/unjs/c12)
- **💬 Interactive fallback** — Prompts for missing required fields in TTY via [@clack/prompts](https://github.com/bombshell-dev/clack)
- **🌳 Subcommand tree** — Nested commands with inherited global flags and per-child type inference
- **⌨️ Shell completions** — Generate Bash, Zsh, Fish, and PowerShell completion scripts
- **🎨 Beautiful output** — Powered by [consola](https://github.com/unjs/consola) and [picocolors](https://github.com/alexeyraspopov/picocolors)
- **🤖 Runtime-aware** — Uses [std-env](https://github.com/unjs/std-env) to react to CI/TTY/debug/color/runtime conditions
- **📐 JSON Schema internal format** — Extensible internal representation for future nested args support

## Install

```bash
vp add clily
```

## Quick Start

```ts
import { clily } from 'clily'
import * as v from 'valibot'

const cli = clily({
  name: 'mycli',
  version: '1.2.0',
  completion: true,
  // Global flags — inherited by all subcommands
  flags: v.object({
    verbose: v.optional(v.boolean(), false),
    logLevel: v.optional(v.picklist(['info', 'debug', 'warn', 'error']), 'info'),
  }),
  // Root handler receives merged flags + args, fully typed
  handler: async (args) => {
    // args.verbose: boolean ✓
    // args.logLevel: 'info' | 'debug' | 'warn' | 'error' ✓
    if (args.verbose) console.log('Verbose mode enabled')
  },
  children: {
    deploy: {
      description: 'Deploy the project',
      args: v.object({
        apiKey: v.string(),
        dryRun: v.optional(v.boolean(), false),
      }),
      // Child handler receives merged parent flags + own args, fully typed
      handler: async (args) => {
        // args.verbose: boolean ✓  (from parent flags)
        // args.apiKey: string ✓    (from own args)
        // args.dryRun: boolean ✓   (from own args)
        console.log(`Deploying with key: ${args.apiKey}`)
      },
    },
  },
})

await cli()
```

### Shell Completion

When `completion: true` is enabled, clily automatically reserves:

- `mycli completion`
- `mycli completions`
- `mycli completion <shell>`

Shell defaults are inferred from `std-env` / process environment (`$SHELL`, PowerShell env markers, etc.), with Bash as a fallback.

```ts
const cli = clily({
  name: 'mycli',
  completion: {
    command: 'completion',
    aliases: ['completions'],
    shell: 'auto',
    shells: ['bash', 'zsh', 'fish', 'pwsh'],
  },
  handler: async () => {},
})
```

Examples:

```bash
mycli completion         # infer current shell
mycli completion zsh     # force a shell
mycli completions fish   # alias
```

### Works with Any Standard Schema Library

```ts
import { clily } from 'clily'
import { z } from 'zod'

const cli = clily({
  name: 'zcli',
  flags: z.object({ verbose: z.boolean().default(false) }),
  children: {
    deploy: {
      args: z.object({ apiKey: z.string(), replicas: z.number().default(1) }),
      handler: async (args) => {
        // Fully typed: args.verbose, args.apiKey, args.replicas
      },
    },
  },
})
```

### Runtime & Shell Metadata

clily exports `getExecutionEnvironment()` so you can inspect the same `std-env` data used internally for prompt, debug, completion, and runtime defaults:

```ts
import { getExecutionEnvironment } from 'clily'

const env = getExecutionEnvironment()
// {
//   shell: 'bash' | 'zsh' | 'fish' | 'pwsh' | null,
//   runtime: 'node' | 'bun' | 'deno' | ...,
//   isNode, isBun, isDeno,
//   hasTTY, isCI, isDebug, isColorSupported
// }
```

## Configuration Resolution

Parameters are merged in this priority order (highest to lowest):

1. **CLI Arguments** — `--api-key=123`
2. **Environment Variables** — `MYCLI_API_KEY=123`
3. **Local Config Files** — `./mycli.config.ts`, `./.myclirc.json`
4. **Global Config Files** — `~/.config/mycli/config.json`
5. **Schema Defaults** — `.default()` values from schema

## Development

```bash
vp install
vp test              # Run runtime tests
vp test --typecheck  # Run runtime + type-level tests
vp check             # Lint, format, and type check
vp pack              # Build library
```
