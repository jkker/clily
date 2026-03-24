# clily

A modern, highly ergonomic TypeScript CLI framework for Node/Bun. clily acts as a unified configuration and execution engine, merging CLI arguments, environment variables, and local/global configuration files into a Single Source of Truth (SSOT) validated by [Standard Schema](https://standardschema.dev/).

## Features

- **🔧 Standard Schema validation** — Use Valibot, Zod, ArkType, or any Standard Schema-compatible library
- **📦 Config resolution** — Merges CLI args > env vars > config files > schema defaults via [c12](https://github.com/unjs/c12)
- **💬 Interactive fallback** — Prompts for missing required fields in TTY via [@clack/prompts](https://github.com/bombshell-dev/clack)
- **🌳 Subcommand tree** — Nested commands with inherited global flags
- **🎨 Beautiful output** — Powered by [consola](https://github.com/unjs/consola) and [picocolors](https://github.com/alexeyraspopov/picocolors)
- **🤖 CI-aware** — Detects CI/TTY and skips interactive prompts via [std-env](https://github.com/unjs/std-env)

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
vp test
vp check
vp pack
```
