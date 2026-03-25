import { clily } from '@clily/core'
import * as v from 'valibot'

const globalFlags = v.object({
  verbose: v.optional(v.boolean(), false),
  profile: v.optional(v.picklist(['dev', 'staging', 'prod']), 'dev'),
  region: v.optional(v.string(), 'us-east-1'),
})

const deployArgs = v.object({
  apiKey: v.string(),
  replicas: v.optional(v.number(), 2),
  dryRun: v.optional(v.boolean(), false),
})

const doctorArgs = v.object({
  fix: v.optional(v.boolean(), false),
})

const run = clily<
  typeof globalFlags,
  undefined,
  {
    deploy: { args: typeof deployArgs }
    doctor: { args: typeof doctorArgs }
  }
>({
  name: 'release-node',
  version: '1.0.0',
  description: 'Node-oriented release automation with zsh completion.',
  completion: {
    command: 'completion',
    aliases: ['completions'],
    shell: 'zsh',
    shells: ['zsh', 'bash', 'fish', 'pwsh'],
  },
  flags: globalFlags,
  handler: async (args) => {
    if (args.verbose) {
      console.log(`[root] profile=${args.profile} region=${args.region}`)
    }
  },
  children: {
    deploy: {
      description: 'Deploy the current build artifact.',
      args: deployArgs,
      handler: async (args) => {
        console.log(
          `Deploying ${args.replicas} replicas to ${args.region} (${args.profile}) with key ${args.apiKey}. dryRun=${args.dryRun}`,
        )
      },
    },
    doctor: {
      description: 'Validate local release prerequisites.',
      args: doctorArgs,
      handler: async (args) => {
        console.log(`Doctor checks complete. fix=${args.fix} verbose=${args.verbose}`)
      },
    },
  },
})

await run()
