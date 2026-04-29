import clily from '@clily/core'
import { z } from 'zod'

const run = clily({
  name: 'release',
  version: '1.0.0',
  description: 'Release automation with nested subcommands and layered input merging.',
  completion: true,
  subCommands: {
    deploy: clily.command({
      description: 'Deploy the current release to a target environment.',
      alias: 'ship',
      args: z.object({
        image: z.string().describe('OCI image reference'),
        region: z.string().default('us-east-1').describe('Deployment region'),
        profile: z.enum(['staging', 'prod']).default('staging').describe('Release profile'),
        replicas: z.number().default(2).describe('Desired replica count'),
        dryRun: z.boolean().default(false).describe('Render the plan without applying it'),
      }),
      positionals: z.string().describe('Target environment'),
      subCommands: {
        rollout: clily.command({
          description: 'Continue an in-flight rollout with a specific revision.',
          args: z.object({
            revision: z.string().describe('Release revision'),
            strategy: z
              .enum(['rolling', 'blue-green'])
              .default('rolling')
              .describe('Rollout strategy'),
          }),
          run: ({ args }) => {
            console.log(`Continuing rollout revision=${args.revision} strategy=${args.strategy}`)
          },
        }),
      },
      run: ({ args, positionals }) => {
        console.log(
          `Deploying ${args.image} to ${positionals} profile=${args.profile} region=${args.region} replicas=${args.replicas} dryRun=${args.dryRun}`,
        )
      },
    }),
    doctor: clily.command({
      description: 'Validate local release prerequisites.',
      args: z.object({
        fix: z.boolean().default(false).describe('Apply suggested fixes'),
      }),
      run: ({ args }) => {
        console.log(`Doctor complete fix=${args.fix}`)
      },
    }),
  },
})

await run()
