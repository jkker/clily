# @clily/core

A schema-first CLI framework for Node.js.

`@clily/core` accepts Standard Schema validators that also expose `StandardJSONSchemaV1`, builds one reusable command tree at `clily()` invocation time, and executes commands through a small, testable workflow: resolve the subtree, parse layered input, validate the merged payload with the source schema, then run command lifecycle hooks.

## Features

- Standard Schema validation and output typing
- Standard JSON Schema metadata for help, prompts, and completion payloads
- Layered input resolution with `defu`: CLI args > env vars > `c12` config > schema defaults
- Node built-in `util.parseArgs()` for argv parsing instead of a hand-rolled scanner
- Local command schemas for named args and positionals
- Infinite-depth `subCommands`
- `clily.command()` for nested contextual typing without manual generics
- Logger-aware command context backed by `consola` by default
- Interactive prompting for missing or invalid values in TTY sessions
- Built-in help and placeholder completion metadata from the same command tree

## Install

```bash
vp add @clily/core zod
```

Swap `zod` for any library that implements both Standard Schema and Standard JSON Schema metadata, such as ArkType.

## Quick Start

```ts
import clily from '@clily/core'
import { z } from 'zod'

const cli = clily({
  name: 'release',
  version: '1.2.0',
  description: 'Example schema-first CLI',
  completion: true,
  subCommands: {
    deploy: clily.command({
      description: 'Deploy the current release',
      args: z.object({
        image: z.string().describe('OCI image reference'),
        region: z.string().default('us-east-1').describe('Deployment region'),
        replicas: z.number().default(2).describe('Desired replica count'),
      }),
      positionals: z.string().describe('Target environment'),
      run: async ({ args, positionals }) => {
        console.log(args.image, args.region, args.replicas, positionals)
      },
    }),
  },
})

await cli()
```

## Execution Workflow

Every command run follows the same sequence:

1. `clily()` builds a reusable command tree once.
2. Raw argv resolves the active command subtree.
3. Node's built-in `util.parseArgs()` parses CLI flags while clily resolves env, config, and default layers for the active subtree.
4. Those layers merge with `defu`, prompts repair missing or invalid values in TTY sessions, and the source Standard Schema validates the merged payload.
5. Plugins, `setup`, `run`, and `cleanup` execute with a logger-aware context.

## Config And Env Resolution

clily resolves each command's named args in this order:

1. CLI args like `--server.port=4000`
2. Env vars like `RELEASE_DEPLOY_SERVER__PORT=4000`
3. `c12` config for the command name and subtree path
4. Schema defaults

Validation is delegated to the source Standard Schema implementation. clily uses JSON Schema metadata for help text, prompting, defaults, and coercion, but it does not try to re-implement Zod or ArkType's validators.

A matching `package.json` block is enough for simple config-driven workflows:

```json
{
  "release": {
    "deploy": {
      "region": "eu-west-1",
      "replicas": 3
    }
  }
}
```

## Nested Command Typing

Use `clily.command()` inside `subCommands` to preserve precise handler types without spelling out manual generic arguments:

```ts
import clily from '@clily/core'
import { z } from 'zod'

clily({
  name: 'release',
  subCommands: {
    deploy: clily.command({
      subCommands: {
        rollout: clily.command({
          args: z.object({
            revision: z.string(),
            strategy: z.enum(['rolling', 'blue-green']).default('rolling'),
          }),
          run: async ({ args }) => {
            args.revision
            args.strategy
          },
        }),
      },
    }),
  },
})
```

## Logger Interface

Each command context includes `logger`, which defaults to a tagged `consola` instance. You can also provide your own `clily.Logger` implementation at the root command:

```ts
import clily from '@clily/core'

const logger: clily.Logger = {
  log: console.log,
  info: console.info,
  success: console.log,
  warn: console.warn,
  error: console.error,
  debug: console.debug,
}

clily({
  name: 'release',
  logger,
})
```

## Completion

`completion: true` enables the built-in `completion` command. The current implementation returns a stable JSON payload describing the command tree and the requested shell, which makes it easy to add a dedicated shell adapter later without mixing completion logic into command execution.

## Public API

Preferred import:

```ts
import clily from '@clily/core'
```

Namespace runtime members:

- `clily`
- `clily.command`

Namespace types:

- `clily.Command`
- `clily.RootCommand`
- `clily.CommandMeta`
- `clily.CommandContext`
- `clily.Logger`
- `clily.Plugin`
- `clily.Completion`

Compatibility named exports:

- `ClilyError`

Internal tree builders, workflow helpers, help renderers, and schema utilities are intentionally not exported from the package root.

## Development

```bash
cd packages/core
vp test
vp run build
```
