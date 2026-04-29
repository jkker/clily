import clily from '@clily/core'
import { type as arkType } from 'arktype'

const applyArgs = arkType({
  revision: 'string',
  'replicas?': 'number',
  'strategy?': '"rolling" | "blue-green"',
})

const environmentSchema = arkType('string')

const rolloutPlugin = {
  name: 'rollout-plugin',
  setup: ({ meta }) => {
    console.log(`[plugin:setup] ${meta.name}`)
  },
  cleanup: ({ meta }) => {
    console.log(`[plugin:cleanup] ${meta.name}`)
  },
} satisfies clily.Plugin<typeof applyArgs, typeof environmentSchema>

const run = clily({
  name: 'rollout',
  version: '1.0.0',
  description: 'ArkType rollout planning with aliases, positionals, and lifecycle hooks.',
  completion: true,
  subCommands: {
    apply: clily.command({
      description: 'Apply a revision to an environment.',
      alias: 'ship',
      args: applyArgs,
      positionals: environmentSchema,
      plugins: [rolloutPlugin],
      setup: ({ meta }) => {
        console.log(`[setup] ${meta.name}`)
      },
      run: ({ args, positionals }) => {
        console.log(
          `Applying revision=${args.revision} strategy=${args.strategy ?? 'rolling'} replicas=${String(args.replicas ?? 1)} environment=${positionals}`,
        )
      },
      cleanup: ({ meta }) => {
        console.log(`[cleanup] ${meta.name}`)
      },
    }),
    audit: clily.command({
      description: 'Inspect recent rollout state.',
      args: arkType({
        'limit?': 'number',
      }),
      run: ({ args }) => {
        console.log(`Audit limit=${String(args.limit ?? 10)}`)
      },
    }),
  },
})

await run()
