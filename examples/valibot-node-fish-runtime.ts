import * as v from 'valibot'

import { clily } from '../src/index.ts'

const globalFlags = v.object({
  verbose: v.optional(v.boolean(), false),
})

const snapshotArgs = v.object({
  target: v.string(),
  compress: v.optional(v.boolean(), true),
})

const capturedStdout: string[] = []
const exitRequests: number[] = []

const run = clily<
  typeof globalFlags,
  undefined,
  {
    snapshot: { args: typeof snapshotArgs }
  }
>({
  name: 'backup-fish',
  version: '0.9.0',
  description: 'Fish completion demo with injected stdout and exit handling.',
  completion: {
    command: 'completion',
    aliases: ['completions'],
    shell: 'fish',
    shells: ['fish', 'bash', 'zsh', 'pwsh'],
  },
  runtime: {
    stdout: (message) => {
      capturedStdout.push(message)
      console.log(`[captured] ${message}`)
    },
    exit: ({ code }) => {
      exitRequests.push(code)
    },
  },
  hooks: {
    onExit: ({ code, reason }) => {
      console.log(`exit requested code=${code} reason=${reason}`)
    },
  },
  flags: globalFlags,
  children: {
    snapshot: {
      description: 'Create a filesystem snapshot.',
      args: snapshotArgs,
      handler: async (args) => {
        console.log(`snapshot target=${args.target} compress=${args.compress}`)
      },
    },
  },
})

await run()

if (capturedStdout.length > 0 || exitRequests.length > 0) {
  console.log({ capturedStdout, exitRequests })
}
