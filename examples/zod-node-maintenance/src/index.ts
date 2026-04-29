import clily from '@clily/core'
import { z } from 'zod'

const backupArgs = z.object({
  snapshot: z.string().default('nightly').describe('Snapshot label'),
  compress: z.boolean().default(true).describe('Compress the archive'),
})

const backupPositionals = z.array(z.string()).min(1).describe('Paths to back up')

const lifecyclePlugin = {
  name: 'maintenance-plugin',
  setup: ({ meta }: { meta: { name: string } }) => {
    console.log(`[plugin:setup] ${meta.name}`)
  },
  cleanup: ({ meta }: { meta: { name: string } }) => {
    console.log(`[plugin:cleanup] ${meta.name}`)
  },
} satisfies clily.Plugin<typeof backupArgs, typeof backupPositionals>

const run = clily({
  name: 'maintenance',
  version: '1.0.0',
  description: 'Operational maintenance tasks with array positionals and lifecycle plugins.',
  completion: true,
  subCommands: {
    backup: clily.command({
      description: 'Create a backup archive for one or more paths.',
      args: backupArgs,
      positionals: backupPositionals,
      plugins: [lifecyclePlugin],
      run: ({ args, positionals }) => {
        console.log(
          `Backing up ${positionals.join(',')} snapshot=${args.snapshot} compress=${args.compress}`,
        )
      },
    }),
    prune: clily.command({
      description: 'Delete old backup archives.',
      args: z.object({
        days: z.number().default(30).describe('Prune backups older than this many days'),
        force: z.boolean().default(false).describe('Skip the confirmation step'),
      }),
      run: ({ args }) => {
        console.log(`Pruning backups days=${args.days} force=${args.force}`)
      },
    }),
  },
})

await run()
