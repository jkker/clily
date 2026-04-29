import { beforeEach, describe, expect, test, vi } from 'vite-plus/test'
import { z } from 'zod'

import { ClilyError } from '../src/errors.ts'
import { buildCommandTree, resolveCommandSubtree } from '../src/tree.ts'

const promptForCommandInput = vi.fn()

vi.mock('../src/prompt.ts', () => ({
  promptForCommandInput,
}))

const { executeCommandNode, resolveCommandInput } = await import('../src/workflow.ts')

const createTestLogger = () => {
  const logger = {
    log: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    start: vi.fn(),
    ready: vi.fn(),
    box: vi.fn(),
    withTag: vi.fn(),
  }

  logger.withTag.mockImplementation(() => logger)
  return logger
}

beforeEach(() => {
  promptForCommandInput.mockReset()
})

describe('workflow pipeline', () => {
  test('resolves the command subtree from positional command tokens', () => {
    const tree = buildCommandTree({
      name: 'mycli',
      subCommands: {
        deploy: {
          alias: 'ship',
          subCommands: {
            rollout: {
              run: async () => {},
            },
          },
        },
      },
    })

    const resolved = resolveCommandSubtree(tree, ['ship', 'rollout', '--revision=r2'])

    expect(resolved.node.path).toEqual(['mycli', 'deploy', 'rollout'])
    expect(resolved.remainingTokens).toEqual(['--revision=r2'])
  })

  test('resolves each args layer independently and merges with CLI precedence', async () => {
    const logger = createTestLogger()
    const tree = buildCommandTree({
      name: 'mycli',
      args: z.object({
        server: z.object({
          host: z.string().default('localhost'),
          port: z.number().default(3000),
        }),
        dryRun: z.boolean().default(false),
      }),
      run: async () => {},
    })

    const resolved = await resolveCommandInput({
      node: tree.root,
      rawArgs: ['--server.host=cli.example'],
      env: {
        MYCLI_SERVER__PORT: '5000',
      },
      config: {
        dryRun: true,
      },
      interactive: false,
      logger,
    })

    expect(resolved.layers.cli.value).toEqual({
      server: {
        host: 'cli.example',
      },
    })
    expect(resolved.layers.env.value).toEqual({
      server: {
        port: 5000,
      },
    })
    expect(resolved.layers.config.value).toEqual({
      dryRun: true,
    })
    expect(resolved.layers.defaults.value).toEqual({
      server: {
        host: 'localhost',
        port: 3000,
      },
      dryRun: false,
    })
    expect(resolved.args).toEqual({
      server: {
        host: 'cli.example',
        port: 5000,
      },
      dryRun: true,
    })
  })

  test('parses repeated array flags and negated booleans with node util.parseArgs', async () => {
    const logger = createTestLogger()
    const tree = buildCommandTree({
      name: 'mycli',
      args: z.object({
        dryRun: z.boolean().default(true),
        tags: z.array(z.string()).default([]),
      }),
      run: async () => {},
    })

    const resolved = await resolveCommandInput({
      node: tree.root,
      rawArgs: ['--no-dry-run', '--tags=first', '--tags=second'],
      interactive: false,
      logger,
    })

    expect(resolved.layers.cli.value).toEqual({
      dryRun: false,
      tags: ['first', 'second'],
    })
    expect(resolved.args).toEqual({
      dryRun: false,
      tags: ['first', 'second'],
    })
  })

  test('rejects invalid merged input when interactive recovery is disabled', async () => {
    const logger = createTestLogger()
    const tree = buildCommandTree({
      name: 'mycli',
      args: z.object({
        port: z.number().default(3000),
      }),
      run: async () => {},
    })

    try {
      await resolveCommandInput({
        node: tree.root,
        rawArgs: ['--port=abc'],
        config: { port: 4000 },
        interactive: false,
        logger,
      })
      throw new Error('Expected validation failure')
    } catch (error) {
      expect(error).toBeInstanceOf(ClilyError)
      if (error instanceof ClilyError) {
        expect(error.kind).toBe('validation')
        expect(error.message).toContain('Validation failed for mycli')
        expect(error.issues?.length).toBeGreaterThan(0)
      }
    }
  })

  test('re-prompts until interactive input validates against the merged schema', async () => {
    const logger = createTestLogger()
    const tree = buildCommandTree({
      name: 'mycli',
      args: z.object({
        port: z.number().default(3000),
      }),
      run: async () => {},
    })

    promptForCommandInput
      .mockResolvedValueOnce({ args: { port: 'still-bad' }, positionals: undefined })
      .mockResolvedValueOnce({ args: { port: '4500' }, positionals: undefined })

    const resolved = await resolveCommandInput({
      node: tree.root,
      rawArgs: ['--port=abc'],
      config: { port: 4000 },
      interactive: true,
      logger,
    })

    expect(promptForCommandInput).toHaveBeenCalledTimes(2)
    expect(resolved.args).toEqual({ port: 4500 })
    expect(resolved.layers.prompt?.value).toEqual({ port: '4500' })
  })

  test('rejects async Standard Schema validators because command validation must be synchronous', async () => {
    const logger = createTestLogger()
    const asyncArgs = {
      '~standard': {
        version: 1 as const,
        vendor: 'test',
        validate: async (value: unknown) => ({ value: value as { port: number } }),
        jsonSchema: {
          input: () => ({
            type: 'object',
            properties: {
              port: { type: 'number' },
            },
          }),
          output: () => ({
            type: 'object',
            properties: {
              port: { type: 'number' },
            },
          }),
        },
      },
    }
    const tree = buildCommandTree({
      name: 'mycli',
      args: asyncArgs,
      run: async () => {},
    })

    await expect(
      resolveCommandInput({
        node: tree.root,
        rawArgs: ['--port=3000'],
        interactive: false,
        logger,
      }),
    ).rejects.toThrow('Schema validation must be synchronous')
  })

  test('executes plugins and command lifecycle hooks in a predictable order', async () => {
    const logger = createTestLogger()
    const order: string[] = []
    const tree = buildCommandTree({
      name: 'mycli',
      plugins: [
        {
          setup: async () => {
            order.push('plugin:setup')
          },
          cleanup: async () => {
            order.push('plugin:cleanup')
          },
        },
      ],
      setup: async () => {
        order.push('command:setup')
      },
      cleanup: async () => {
        order.push('command:cleanup')
      },
      run: async () => {
        order.push('command:run')
      },
    })

    await executeCommandNode({
      node: tree.root,
      rawArgs: [],
      logger,
      resolvedInput: {
        args: {},
        positionals: undefined,
        positionalTokens: [],
        layers: {
          cli: { name: 'cli', value: {} },
          env: { name: 'env', value: {} },
          config: { name: 'config', value: {} },
          defaults: { name: 'defaults', value: {} },
        },
      },
    })

    expect(order).toEqual([
      'plugin:setup',
      'command:setup',
      'command:run',
      'command:cleanup',
      'plugin:cleanup',
    ])
  })
})
