import { type as arkType } from 'arktype'

import { clily } from '../src/index.ts'

const globalFlags = arkType({
  verbose: 'boolean',
  region: 'string',
})

const rolloutArgs = arkType({
  revision: 'string',
  'replicas?': 'number',
})

const denoStyleRuntime = {
  argv: ['deno', 'task', 'deploy', 'rollout', '--revision', 'rev-42', '--replicas', '3'],
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
