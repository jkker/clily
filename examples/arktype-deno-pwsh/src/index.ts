import { clily } from '@clily/core'
import { type as arkType } from 'arktype'

const globalFlags = arkType({
  verbose: 'boolean',
  region: 'string',
})

const rolloutArgs = arkType({
  revision: 'string',
  'replicas?': 'number',
})

function getRuntimeArgv(): string[] {
  const deno = (globalThis as { Deno?: { args: string[] } }).Deno
  if (deno && deno.args.length > 0) {
    return ['deno', 'examples/arktype-deno-pwsh/src/index.ts', ...deno.args]
  }

  if (process.argv.length > 2) {
    return [process.argv[0], 'examples/arktype-deno-pwsh/src/index.ts', ...process.argv.slice(2)]
  }

  return [
    'deno',
    'examples/arktype-deno-pwsh/src/index.ts',
    'rollout',
    '--revision',
    'rev-42',
    '--replicas',
    '3',
  ]
}

const denoStyleRuntime = {
  argv: getRuntimeArgv(),
  env: {
    SHIP_DENO_REGION: 'eu-west-1',
    SHIP_DENO_VERBOSE: 'true',
  },
  cwd: () => '/workspace/services/api',
  stdout: (message: string) => {
    console.log(`[deno-runtime] ${message}`)
  },
}

const run = clily<
  typeof globalFlags,
  undefined,
  {
    rollout: { args: typeof rolloutArgs }
  }
>({
  name: 'ship-deno',
  version: '2.1.0',
  description: 'Deno-style deployment workflow using injected runtime state and pwsh completion.',
  completion: {
    command: 'completion',
    aliases: ['completions'],
    shell: 'pwsh',
    shells: ['pwsh', 'bash', 'zsh', 'fish'],
  },
  runtime: denoStyleRuntime,
  flags: globalFlags,
  children: {
    rollout: {
      description: 'Roll the current revision through the fleet.',
      args: rolloutArgs,
      handler: async (args) => {
        console.log(
          `Rolling out revision=${args.revision} replicas=${String(args.replicas ?? 1)} region=${args.region} verbose=${args.verbose}`,
        )
      },
    },
  },
})

await run()
