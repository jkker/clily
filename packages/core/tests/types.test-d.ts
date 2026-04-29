import { type as arkType } from 'arktype'
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { z } from 'zod'

import clily from '../src/index.ts'
import type { Empty, InferOutput } from '../src/types.ts'

describe('InferOutput', () => {
  test('infers zod output types', () => {
    const schema = z.object({
      name: z.string(),
      count: z.number().default(0),
    })

    type Result = InferOutput<typeof schema>

    expectTypeOf<Result>().toEqualTypeOf<{
      name: string
      count: number
    }>()
  })

  test('infers arktype output types', () => {
    const schema = arkType({
      name: 'string',
      count: 'number',
    })

    type Result = InferOutput<typeof schema>

    expectTypeOf<Result>().toEqualTypeOf<{
      name: string
      count: number
    }>()
  })

  test('falls back to Empty for undefined', () => {
    type Result = InferOutput<undefined>

    expectTypeOf<Result>().toEqualTypeOf<Empty>()
  })
})

describe('command context inference', () => {
  test('root run receives the root args and positionals payloads', () => {
    clily({
      name: 'typed-cli',
      args: z.object({
        dryRun: z.boolean().default(false),
      }),
      positionals: z.string(),
      run: (context) => {
        expectTypeOf(context.args).toEqualTypeOf<{
          dryRun: boolean
        }>()
        expectTypeOf(context.positionals).toEqualTypeOf<string>()
        expectTypeOf(context.logger).toEqualTypeOf<clily.Logger>()
      },
    })
  })

  test('subcommands infer only their own local args without manual generics', () => {
    clily({
      name: 'typed-cli',
      subCommands: {
        deploy: clily.command({
          args: z.object({
            apiKey: z.string(),
            replicas: z.number().default(1),
          }),
          run: (context) => {
            expectTypeOf(context.args).toEqualTypeOf<{
              apiKey: string
              replicas: number
            }>()
            expectTypeOf(context.commandPath).toEqualTypeOf<string[]>()
          },
        }),
      },
    })
  })

  test('nested subcommands preserve their own positional types without manual generics', () => {
    clily({
      name: 'typed-cli',
      subCommands: {
        deploy: clily.command({
          subCommands: {
            rollout: clily.command({
              positionals: z.array(z.string()),
              run: (context) => {
                expectTypeOf(context.positionals).toEqualTypeOf<string[]>()
                expectTypeOf(context.args).toEqualTypeOf<Empty>()
              },
            }),
          },
        }),
      },
    })
  })

  test('namespace plugin aliases preserve contextual typing', () => {
    const deployArgs = z.object({
      image: z.string(),
    })

    const plugin = {
      setup: (context) => {
        expectTypeOf(context.args).toEqualTypeOf<{
          image: string
        }>()
      },
    } satisfies clily.Plugin<typeof deployArgs>

    expectTypeOf(plugin).toExtend<clily.Plugin<typeof deployArgs>>()
  })
})
