import * as v from 'valibot'
import { describe, expect, test, vi } from 'vite-plus/test'

import { clily } from '../src/index.ts'

// Mock citty's runMain to avoid actual CLI bootstrapping
vi.mock('citty', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    runMain: vi.fn(async (cmd: Record<string, unknown>) => {
      // Simulate running the command with test args
      const run = (cmd as any).run
      if (run) {
        await run({
          rawArgs: [],
          args: {},
          cmd,
        })
      }
    }),
  }
})

// Mock c12 to avoid file system
vi.mock('c12', () => ({
  loadConfig: vi.fn(async () => ({
    config: {},
    layers: [],
  })),
}))

// Mock std-env
vi.mock('std-env', () => ({
  hasTTY: false,
  isCI: true,
  isDebug: false,
}))

describe('clily', () => {
  test('returns a callable function', () => {
    const cli = clily({
      name: 'test-cli',
    })

    expect(typeof cli).toBe('function')
  })

  test('creates CLI with name and version', () => {
    const cli = clily({
      name: 'mycli',
      version: '1.0.0',
    })

    expect(cli).toBeDefined()
  })

  test('creates CLI with flags schema', () => {
    const cli = clily({
      name: 'mycli',
      flags: v.object({
        verbose: v.optional(v.boolean(), false),
      }),
    })

    expect(cli).toBeDefined()
  })

  test('creates CLI with args schema', () => {
    const cli = clily({
      name: 'mycli',
      args: v.object({
        ci: v.optional(v.boolean(), false),
      }),
    })

    expect(cli).toBeDefined()
  })

  test('creates CLI with children (subcommands)', () => {
    const cli = clily({
      name: 'mycli',
      children: {
        deploy: {
          description: 'Deploy the project',
          args: v.object({
            apiKey: v.string(),
          }),
          handler: async () => {},
        },
      },
    })

    expect(cli).toBeDefined()
  })

  test('creates CLI with hooks', () => {
    const onParse = vi.fn()
    const onError = vi.fn()

    const cli = clily({
      name: 'mycli',
      hooks: { onParse, onError },
    })

    expect(cli).toBeDefined()
  })

  test('creates CLI matching the PRD example API', () => {
    const cli = clily({
      name: 'mycli',
      version: '1.2.0',
      debug: true,
      flags: v.object({
        verbose: v.optional(v.boolean(), false),
        logLevel: v.optional(v.picklist(['info', 'debug', 'warn', 'error']), 'info'),
      }),
      args: v.object({
        ci: v.optional(v.boolean(), false),
      }),
      plugins: [],
      hooks: {
        onParse: () => {},
        onValidate: () => {},
        onError: () => {},
        onValidationError: () => {},
        onPromptSelect: () => {},
        onHelp: () => {},
      },
      handler: async () => {},
      children: {
        deploy: {
          description: 'Deploy the project',
          args: v.object({
            apiKey: v.string(),
            dryRun: v.optional(v.boolean(), false),
          }),
          handler: async () => {},
        },
      },
    })

    expect(cli).toBeDefined()
  })
})

describe('clily exports', () => {
  test('exports all expected utilities', async () => {
    const mod = await import('../src/index.ts')

    // Main function
    expect(mod.clily).toBeDefined()

    // Schema utilities
    expect(mod.getSchemaEntries).toBeDefined()
    expect(mod.getSchemaDefaults).toBeDefined()
    expect(mod.getMissingRequiredKeys).toBeDefined()
    expect(mod.validateSchema).toBeDefined()

    // Env utilities
    expect(mod.resolveEnvVars).toBeDefined()
    expect(mod.toEnvPrefix).toBeDefined()

    // Args utilities
    expect(mod.camelToKebab).toBeDefined()
    expect(mod.kebabToCamel).toBeDefined()
    expect(mod.normalizeArgs).toBeDefined()

    // Help generation
    expect(mod.generateHelp).toBeDefined()
  })
})
