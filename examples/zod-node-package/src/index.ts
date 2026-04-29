import clily from '@clily/core'
import { z } from 'zod'

const formatValue = (value: unknown): string => {
  if (typeof value === 'string') return value
  const serialized = JSON.stringify(value)
  return serialized ?? String(value)
}

const createLogger = (tag: string): clily.Logger => {
  const emit = (level: string, args: unknown[]) => {
    console.log(`[${tag}:${level}] ${args.map(formatValue).join(' ')}`)
  }

  return {
    log: (...args) => emit('log', args),
    info: (...args) => emit('info', args),
    success: (...args) => emit('success', args),
    warn: (...args) => emit('warn', args),
    error: (...args) => emit('error', args),
    debug: (...args) => emit('debug', args),
    start: (...args) => emit('start', args),
    ready: (...args) => emit('ready', args),
    box: (...args) => emit('box', args),
    withTag: (childTag) => createLogger(`${tag}/${childTag}`),
  }
}

const run = clily({
  name: 'packagectl',
  version: '1.0.0',
  description: 'Package build and publish workflow with a custom logger.',
  completion: {
    command: 'completion',
    aliases: ['completions'],
    description: 'Emit completion metadata for external shell adapters.',
  },
  logger: createLogger('packagectl'),
  subCommands: {
    build: clily.command({
      description: 'Create distributable artifacts.',
      args: z.object({
        format: z.enum(['esm', 'cjs']).default('esm').describe('Artifact format'),
        minify: z.boolean().default(true).describe('Whether to minify the output'),
        sourcemap: z.boolean().default(true).describe('Whether to emit sourcemaps'),
      }),
      run: ({ args, logger }) => {
        logger.start?.('build')
        logger.ready?.(
          `Built format=${args.format} minify=${args.minify} sourcemap=${args.sourcemap}`,
        )
      },
    }),
    publish: clily.command({
      description: 'Publish the package to a registry.',
      args: z.object({
        tag: z.string().default('latest').describe('Release tag'),
        registry: z.url().default('https://registry.npmjs.org').describe('Registry URL'),
        retries: z.number().default(2).describe('Publish retry count'),
      }),
      run: ({ args, logger }) => {
        logger.success(
          `Publishing tag=${args.tag} registry=${args.registry} retries=${args.retries}`,
        )
      },
    }),
  },
})

await run()
