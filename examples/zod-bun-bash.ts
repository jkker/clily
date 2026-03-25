import { boolean, number, object, string } from 'zod'

import { clily } from '../src/index.ts'

const globalFlags = object({
  verbose: boolean().default(false),
  registry: string().default('https://registry.npmjs.org'),
})

const buildArgs = object({
  format: string().default('esm'),
  minify: boolean().default(true),
})

const publishArgs = object({
  tag: string().default('latest'),
  retries: number().default(3),
})

const run = clily<
  typeof globalFlags,
  undefined,
  {
    build: { args: typeof buildArgs }
    publish: { args: typeof publishArgs }
  }
>({
  name: 'bundle-bun',
  version: '0.3.0',
  description: 'Bun-style package build and publish workflow with bash completion.',
  completion: {
    command: 'completion',
    aliases: ['completions'],
    shell: 'bash',
    shells: ['bash', 'zsh', 'fish', 'pwsh'],
  },
  flags: globalFlags,
  children: {
    build: {
      description: 'Create distributable artifacts.',
      args: buildArgs,
      handler: async (args) => {
        console.log(
          `Building format=${args.format} minify=${args.minify} registry=${args.registry} verbose=${args.verbose}`,
        )
      },
    },
    publish: {
      description: 'Publish the package to a registry.',
      args: publishArgs,
      handler: async (args) => {
        console.log(`Publishing tag=${args.tag} retries=${args.retries} registry=${args.registry}`)
      },
    },
  },
})

await run()
