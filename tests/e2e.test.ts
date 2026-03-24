/// <reference types="node" />
import { type as arkType } from 'arktype'
import * as v from 'valibot'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vite-plus/test'
import { object, string, number } from 'zod'

import { setNestedValue } from '../src/args.ts'
import {
  camelToKebab,
  clily,
  coerceTypes,
  generateHelp,
  getDefaults,
  getMissingRequired,
  kebabToCamel,
  normalizeArgs,
  resolveEnvVars,
  toEnvPrefix,
  toJsonSchema,
  validateSchema,
} from '../src/index.ts'
import type { JsonSchema } from '../src/types.ts'

// ─── Mock boundaries (I/O, process, filesystem) ─────────

const { mockRunMain, mockDefineCommand, mockLoadConfig } = vi.hoisted(() => ({
  mockRunMain: vi.fn(),
  mockDefineCommand: vi.fn((def: Record<string, unknown>) => def),
  mockLoadConfig: vi.fn(async () => ({ config: {}, layers: [] })),
}))

vi.mock('citty', () => ({
  defineCommand: mockDefineCommand,
  runMain: mockRunMain,
}))

vi.mock('c12', () => ({
  loadConfig: mockLoadConfig,
}))

let mockHasTTY = false
let mockIsCI = true

vi.mock('std-env', () => ({
  get hasTTY() {
    return mockHasTTY
  },
  get isCI() {
    return mockIsCI
  },
  isDebug: false,
}))

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn(),
  text: vi.fn(async () => 'prompted-value'),
  confirm: vi.fn(async () => true),
  isCancel: vi.fn(() => false),
}))

// ─── Schema Introspection: Valibot ──────────────────────

describe('toJsonSchema — Valibot', () => {
  test('extracts properties, required fields, and defaults', () => {
    const schema = v.object({
      apiKey: v.string(),
      dryRun: v.optional(v.boolean(), false),
      logLevel: v.optional(v.picklist(['info', 'debug', 'warn', 'error']), 'info'),
    })

    const js = toJsonSchema(schema)

    expect(js.type).toBe('object')
    expect(js.required).toEqual(['apiKey'])
    expect(js.properties.apiKey).toEqual({ type: 'string' })
    expect(js.properties.dryRun).toEqual({
      type: 'boolean',
      default: false,
    })
    expect(js.properties.logLevel).toEqual({
      type: 'string',
      default: 'info',
      enum: ['info', 'debug', 'warn', 'error'],
    })
  })

  test('returns empty schema for unknown schema types', () => {
    const schema = {
      '~standard': {
        version: 1 as const,
        vendor: 'unknown',
        validate: () => ({ value: {} }),
      },
    }

    const js = toJsonSchema(schema)

    expect(js.properties).toEqual({})
    expect(js.required).toEqual([])
  })
})

// ─── Schema Introspection: Zod v4 ──────────────────────

describe('toJsonSchema — Zod v4', () => {
  test('extracts properties, required fields, and defaults', () => {
    const schema = object({
      apiKey: string(),
      count: number().default(5),
    })

    const js = toJsonSchema(schema)

    expect(js.type).toBe('object')
    expect(js.required).toEqual(['apiKey'])
    expect(js.properties.apiKey.type).toBe('string')
    expect(js.properties.count.type).toBe('number')
    expect(js.properties.count.default).toBe(5)
  })

  test('handles optional fields', () => {
    const schema = object({
      name: string(),
      nickname: string().optional(),
    })

    const js = toJsonSchema(schema)

    expect(js.required).toEqual(['name'])
    expect(js.properties.nickname.type).toBe('string')
  })
})

// ─── Schema Introspection: ArkType ──────────────────────

describe('toJsonSchema — ArkType', () => {
  test('extracts properties and required fields', () => {
    const schema = arkType({
      name: 'string',
      active: 'boolean',
      'count?': 'number',
    })

    const js = toJsonSchema(schema)

    expect(js.type).toBe('object')
    expect(js.required).toContain('name')
    expect(js.required).toContain('active')
    expect(js.required).not.toContain('count')
    expect(js.properties.name.type).toBe('string')
    expect(js.properties.active.type).toBe('boolean')
    expect(js.properties.count.type).toBe('number')
  })
})

// ─── Schema Validation with All Libraries ───────────────

describe('validateSchema — cross-library', () => {
  test('validates with Valibot schema', async () => {
    const schema = v.object({
      name: v.string(),
      count: v.optional(v.number(), 0),
    })

    const good = await validateSchema(schema, { name: 'test' })
    expect(good.success).toBe(true)
    if (good.success) {
      expect(good.value).toEqual({ name: 'test', count: 0 })
    }

    const bad = await validateSchema(schema, { count: 'abc' })
    expect(bad.success).toBe(false)
  })

  test('validates with Zod schema', async () => {
    const schema = object({
      name: string(),
      count: number().default(0),
    })

    const good = await validateSchema(schema, { name: 'test' })
    expect(good.success).toBe(true)
    if (good.success) {
      expect(good.value).toEqual({ name: 'test', count: 0 })
    }

    const bad = await validateSchema(schema, { count: 'abc' })
    expect(bad.success).toBe(false)
  })

  test('validates with ArkType schema', async () => {
    const schema = arkType({
      name: 'string',
      'count?': 'number',
    })

    const good = await validateSchema(schema, {
      name: 'test',
      count: 5,
    })
    expect(good.success).toBe(true)

    const bad = await validateSchema(schema, { count: 'abc' })
    expect(bad.success).toBe(false)
  })
})

// ─── JSON Schema Utilities ──────────────────────────────

describe('getDefaults / getMissingRequired / coerceTypes', () => {
  const schema: JsonSchema = {
    type: 'object',
    properties: {
      apiKey: { type: 'string' },
      dryRun: { type: 'boolean', default: false },
      count: { type: 'number', default: 10 },
    },
    required: ['apiKey'],
  }

  test('getDefaults extracts default values', () => {
    expect(getDefaults(schema)).toEqual({ dryRun: false, count: 10 })
  })

  test('getMissingRequired finds missing required keys', () => {
    expect(getMissingRequired(schema, {})).toEqual(['apiKey'])
    expect(getMissingRequired(schema, { apiKey: 'key' })).toEqual([])
    expect(getMissingRequired(schema, { apiKey: null })).toEqual(['apiKey'])
  })

  test('coerceTypes converts string values to correct types', () => {
    const data = {
      apiKey: 'sk_live',
      dryRun: 'true',
      count: '42',
    }
    const result = coerceTypes(data, schema)

    expect(result.dryRun).toBe(true)
    expect(result.count).toBe(42)
    expect(result.apiKey).toBe('sk_live')
  })

  test('coerceTypes handles false-like boolean strings', () => {
    expect(coerceTypes({ dryRun: 'false' }, schema).dryRun).toBe(false)
    expect(coerceTypes({ dryRun: '0' }, schema).dryRun).toBe(false)
    expect(coerceTypes({ dryRun: '1' }, schema).dryRun).toBe(true)
  })
})

// ─── Environment Variable Resolution ────────────────────

describe('resolveEnvVars', () => {
  test('maps prefixed env vars to camelCase keys', () => {
    const env = {
      MYCLI_API_KEY: 'sk_live_123',
      MYCLI_DRY_RUN: 'true',
      OTHER_VAR: 'ignored',
    }

    const result = resolveEnvVars('mycli', env)

    expect(result).toEqual({
      apiKey: 'sk_live_123',
      dryRun: 'true',
    })
  })

  test('handles hyphenated CLI names', () => {
    expect(toEnvPrefix('my-cli')).toBe('MY_CLI_')
  })

  test('ignores exact prefix match without suffix', () => {
    const result = resolveEnvVars('mycli', { MYCLI_: 'bad' })
    expect(result).toEqual({})
  })
})

// ─── Argument Parsing ───────────────────────────────────

describe('camelToKebab / kebabToCamel / normalizeArgs', () => {
  test('camelToKebab converts camelCase to kebab-case', () => {
    expect(camelToKebab('apiKey')).toBe('api-key')
    expect(camelToKebab('dryRun')).toBe('dry-run')
    expect(camelToKebab('verbose')).toBe('verbose')
  })

  test('kebabToCamel converts kebab-case to camelCase', () => {
    expect(kebabToCamel('api-key')).toBe('apiKey')
    expect(kebabToCamel('dry-run')).toBe('dryRun')
    expect(kebabToCamel('verbose')).toBe('verbose')
  })

  test('normalizeArgs strips undefined and _, converts keys', () => {
    const result = normalizeArgs({
      'api-key': 'val',
      'dry-run': true,
      _: ['cmd'],
      missing: undefined,
    })
    expect(result).toEqual({ apiKey: 'val', dryRun: true })
  })

  test('normalizeArgs handles dot-notation for nested keys', () => {
    const result = normalizeArgs({ 'config.server': 'localhost' })
    expect(result).toEqual({ config: { server: 'localhost' } })
  })
})

describe('setNestedValue', () => {
  test('sets a deeply nested value', () => {
    const obj: Record<string, unknown> = {}
    setNestedValue(obj, 'a.b.c', 42)
    expect(obj).toEqual({ a: { b: { c: 42 } } })
  })
})

// ─── Help Text Generation ───────────────────────────────

describe('generateHelp', () => {
  test('generates help for root command with Valibot schema', () => {
    const help = generateHelp({
      name: 'mycli',
      version: '1.0.0',
      description: 'A test CLI',
      flags: v.object({
        verbose: v.optional(v.boolean(), false),
      }),
      children: {
        deploy: { description: 'Deploy the project' },
        init: { description: 'Initialize config' },
      },
    })

    expect(help).toContain('mycli')
    expect(help).toContain('v1.0.0')
    expect(help).toContain('A test CLI')
    expect(help).toContain('--verbose')
    expect(help).toContain('deploy')
    expect(help).toContain('init')
    expect(help).toContain('GLOBAL FLAGS:')
    expect(help).toContain('COMMANDS:')
  })

  test('generates help for command with Zod schema', () => {
    const help = generateHelp({
      name: 'zcli',
      args: object({
        apiKey: string(),
        count: number().default(5),
      }),
    })

    expect(help).toContain('zcli')
    expect(help).toContain('--api-key')
    expect(help).toContain('--count')
    expect(help).toContain('OPTIONS:')
  })
})

// ─── PRD Scenario A: Perfectly Configured Run ───────────

describe('Scenario A: Perfectly Configured Run', () => {
  let runHandler: (ctx: Record<string, unknown>) => Promise<void>

  beforeEach(() => {
    vi.clearAllMocks()
    mockHasTTY = false
    mockIsCI = true
    mockDefineCommand.mockImplementation((def: Record<string, unknown>) => {
      runHandler = def.run as (ctx: Record<string, unknown>) => Promise<void>
      return def
    })
    mockRunMain.mockResolvedValue(undefined)
  })

  test('handler receives merged flags + args + env + config', async () => {
    const handler = vi.fn()

    mockLoadConfig.mockResolvedValueOnce({
      config: { logLevel: 'debug' },
      layers: [],
    })

    clily({
      name: 'mycli',
      flags: v.object({
        verbose: v.optional(v.boolean(), false),
        logLevel: v.optional(v.picklist(['info', 'debug', 'warn', 'error']), 'info'),
      }),
      args: v.object({
        ci: v.optional(v.boolean(), false),
      }),
      handler,
    })

    // Simulate: MYCLI_API_KEY not applicable here, but config file provides logLevel
    await runHandler({
      rawArgs: ['--ci'],
      args: { ci: true },
      cmd: {},
    })

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        verbose: false,
        logLevel: 'debug',
        ci: true,
      }),
    )
  })
})

// ─── PRD Scenario B: Interactive Fallback ───────────────

describe('Scenario B: Interactive Fallback', () => {
  let subRunHandlers: Record<string, (ctx: Record<string, unknown>) => Promise<void>>

  beforeEach(() => {
    vi.clearAllMocks()
    subRunHandlers = {}
    mockDefineCommand.mockImplementation((def: Record<string, unknown>) => {
      const meta = def.meta as Record<string, string> | undefined
      if (meta?.name && meta.name !== 'mycli') {
        subRunHandlers[meta.name] = def.run as (ctx: Record<string, unknown>) => Promise<void>
      }
      return def
    })
    mockRunMain.mockResolvedValue(undefined)
    mockLoadConfig.mockResolvedValue({
      config: {},
      layers: [],
    })
  })

  test('prompts for missing required args in TTY mode', async () => {
    mockHasTTY = true
    mockIsCI = false

    const handler = vi.fn()

    clily({
      name: 'mycli',
      children: {
        deploy: {
          description: 'Deploy the project',
          args: v.object({
            apiKey: v.string(),
            dryRun: v.optional(v.boolean(), false),
          }),
          handler,
        },
      },
    })

    await subRunHandlers['deploy']({
      rawArgs: [],
      args: {},
      cmd: {},
    })

    // promptForMissing returns 'prompted-value' for apiKey
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'prompted-value',
        dryRun: false,
      }),
    )
  })
})

// ─── PRD Scenario C: CI/CD Validation Error ─────────────

describe('Scenario C: CI/CD Validation Error', () => {
  let subRunHandlers: Record<string, (ctx: Record<string, unknown>) => Promise<void>>

  beforeEach(() => {
    vi.clearAllMocks()
    subRunHandlers = {}
    mockHasTTY = false
    mockIsCI = true
    mockDefineCommand.mockImplementation((def: Record<string, unknown>) => {
      const meta = def.meta as Record<string, string> | undefined
      if (meta?.name && meta.name !== 'mycli') {
        subRunHandlers[meta.name] = def.run as (ctx: Record<string, unknown>) => Promise<void>
      }
      return def
    })
    mockRunMain.mockResolvedValue(undefined)
    mockLoadConfig.mockResolvedValue({
      config: {},
      layers: [],
    })
  })

  test('prints validation errors and exits in CI mode', async () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit')
    })

    clily({
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

    // No apiKey provided → validation fails
    await expect(
      subRunHandlers['deploy']({
        rawArgs: [],
        args: {},
        cmd: {},
      }),
    ).rejects.toThrow('exit')

    expect(mockExit).toHaveBeenCalledWith(1)
    mockExit.mockRestore()
  })

  test('works the same with Zod schemas in CI', async () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit')
    })

    clily({
      name: 'mycli',
      children: {
        deploy: {
          args: object({ apiKey: string() }),
          handler: async () => {},
        },
      },
    })

    await expect(
      subRunHandlers['deploy']({
        rawArgs: [],
        args: {},
        cmd: {},
      }),
    ).rejects.toThrow('exit')

    expect(mockExit).toHaveBeenCalledWith(1)
    mockExit.mockRestore()
  })
})

// ─── PRD Scenario D: Help Discovery ─────────────────────

describe('Scenario D: Help Discovery', () => {
  let rootRunHandler: (ctx: Record<string, unknown>) => Promise<void>
  let subRunHandlers: Record<string, (ctx: Record<string, unknown>) => Promise<void>>

  beforeEach(() => {
    vi.clearAllMocks()
    subRunHandlers = {}
    mockDefineCommand.mockImplementation((def: Record<string, unknown>) => {
      const meta = def.meta as Record<string, string> | undefined
      if (meta?.name === 'mycli' || !meta) {
        rootRunHandler = def.run as (ctx: Record<string, unknown>) => Promise<void>
      }
      if (meta?.name && meta.name !== 'mycli') {
        subRunHandlers[meta.name] = def.run as (ctx: Record<string, unknown>) => Promise<void>
      }
      return def
    })
    mockRunMain.mockResolvedValue(undefined)
  })

  test('shows help when --help flag is passed to root', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    clily({
      name: 'mycli',
      version: '1.2.0',
      description: 'A test CLI',
      flags: v.object({
        verbose: v.optional(v.boolean(), false),
      }),
      handler: async () => {},
      children: {
        deploy: {
          description: 'Deploy project',
          handler: async () => {},
        },
      },
    })

    await rootRunHandler({
      rawArgs: ['--help'],
      args: { help: true },
      cmd: {},
    })

    const output = consoleSpy.mock.calls[0][0] as string
    expect(output).toContain('mycli')
    expect(output).toContain('v1.2.0')
    expect(output).toContain('--verbose')
    expect(output).toContain('deploy')

    consoleSpy.mockRestore()
  })

  test('shows help when no handler on root', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    clily({
      name: 'mycli',
      children: {
        deploy: {
          description: 'Deploy',
          handler: async () => {},
        },
      },
    })

    await rootRunHandler({
      rawArgs: [],
      args: {},
      cmd: {},
    })

    const output = consoleSpy.mock.calls[0][0] as string
    expect(output).toContain('mycli')

    consoleSpy.mockRestore()
  })

  test('shows help for subcommand', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    clily({
      name: 'mycli',
      flags: v.object({
        verbose: v.optional(v.boolean(), false),
      }),
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

    await subRunHandlers['deploy']({
      rawArgs: ['--help'],
      args: { help: true },
      cmd: {},
    })

    const output = consoleSpy.mock.calls[0][0] as string
    expect(output).toContain('deploy')
    expect(output).toContain('--api-key')
    expect(output).toContain('--verbose')

    consoleSpy.mockRestore()
  })
})

// ─── Config Resolution Priority ─────────────────────────

describe('Config resolution priority', () => {
  let runHandler: (ctx: Record<string, unknown>) => Promise<void>

  beforeEach(() => {
    vi.clearAllMocks()
    mockHasTTY = false
    mockIsCI = true
    mockDefineCommand.mockImplementation((def: Record<string, unknown>) => {
      runHandler = def.run as (ctx: Record<string, unknown>) => Promise<void>
      return def
    })
    mockRunMain.mockResolvedValue(undefined)
  })

  test('CLI args override env vars and config file', async () => {
    const handler = vi.fn()

    // Config file provides logLevel: 'debug'
    mockLoadConfig.mockResolvedValueOnce({
      config: { logLevel: 'debug', verbose: true },
      layers: [],
    })

    // Env vars provide logLevel: 'warn'  (would be overridden by CLI)
    const origEnv = process.env
    process.env = {
      ...origEnv,
      MYCLI_LOG_LEVEL: 'warn',
      MYCLI_VERBOSE: 'false',
    }

    clily({
      name: 'mycli',
      flags: v.object({
        verbose: v.optional(v.boolean(), false),
        logLevel: v.optional(v.picklist(['info', 'debug', 'warn', 'error']), 'info'),
      }),
      handler,
    })

    // CLI provides --log-level=error (highest priority)
    await runHandler({
      rawArgs: ['--log-level=error'],
      args: { 'log-level': 'error' },
      cmd: {},
    })

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        logLevel: 'error', // CLI wins
      }),
    )

    process.env = origEnv
  })
})

// ─── Lifecycle Hooks ─────────────────────────────────────

describe('Lifecycle hooks', () => {
  let runHandler: (ctx: Record<string, unknown>) => Promise<void>

  beforeEach(() => {
    vi.clearAllMocks()
    mockHasTTY = false
    mockIsCI = true
    mockDefineCommand.mockImplementation((def: Record<string, unknown>) => {
      runHandler = def.run as (ctx: Record<string, unknown>) => Promise<void>
      return def
    })
    mockRunMain.mockResolvedValue(undefined)
    mockLoadConfig.mockResolvedValue({
      config: {},
      layers: [],
    })
  })

  test('calls onParse hook with raw args', async () => {
    const onParse = vi.fn()
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    clily({
      name: 'mycli',
      hooks: { onParse },
      handler: async () => {},
    })

    await runHandler({
      rawArgs: ['--verbose'],
      args: {},
      cmd: {},
    })

    expect(onParse).toHaveBeenCalledWith(['--verbose'])
    consoleSpy.mockRestore()
  })

  test('calls onValidate hook before validation', async () => {
    const onValidate = vi.fn()

    clily({
      name: 'mycli',
      hooks: { onValidate },
      args: v.object({
        name: v.optional(v.string(), 'default'),
      }),
      handler: async () => {},
    })

    await runHandler({
      rawArgs: [],
      args: {},
      cmd: {},
    })

    expect(onValidate).toHaveBeenCalledWith(expect.objectContaining({ name: 'default' }))
  })

  test('calls onError hook on unhandled errors', async () => {
    const onError = vi.fn()

    mockRunMain.mockRejectedValueOnce(new Error('boom'))

    const run = clily({
      name: 'mycli',
      hooks: { onError },
      handler: async () => {},
    })

    await run()

    expect(onError).toHaveBeenCalledWith(expect.any(Error))
    expect((onError.mock.calls[0][0] as Error).message).toBe('boom')
  })

  test('calls onHelp hook and allows mutation', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    clily({
      name: 'mycli',
      hooks: {
        onHelp: () => 'CUSTOM HELP OUTPUT',
      },
      handler: async () => {},
    })

    await runHandler({
      rawArgs: ['--help'],
      args: { help: true },
      cmd: {},
    })

    expect(consoleSpy).toHaveBeenCalledWith('CUSTOM HELP OUTPUT')
    consoleSpy.mockRestore()
  })
})

// ─── Error Handling ──────────────────────────────────────

describe('Error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHasTTY = false
    mockIsCI = true
    mockRunMain.mockResolvedValue(undefined)
  })

  test('exits with code 1 when runMain throws without onError', async () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    mockRunMain.mockRejectedValueOnce(new Error('fatal'))

    const run = clily({
      name: 'mycli',
      handler: async () => {},
    })

    await run()

    expect(mockExit).toHaveBeenCalledWith(1)
    mockExit.mockRestore()
  })
})

// ─── Nested Subcommands ─────────────────────────────────

describe('Nested subcommands', () => {
  test('builds nested command tree', () => {
    vi.clearAllMocks()

    clily({
      name: 'mycli',
      children: {
        deploy: {
          description: 'Deploy',
          children: {
            staging: {
              description: 'Deploy to staging',
              handler: async () => {},
            },
          },
        },
      },
    })

    // Root + deploy + staging = 3 defineCommand calls
    expect(mockDefineCommand).toHaveBeenCalledTimes(3)
    expect(mockDefineCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: { name: 'staging', description: 'Deploy to staging' },
      }),
    )
  })
})

// ─── Debug Mode ─────────────────────────────────────────

describe('Debug mode', () => {
  let runHandler: (ctx: Record<string, unknown>) => Promise<void>

  beforeEach(() => {
    vi.clearAllMocks()
    mockHasTTY = false
    mockIsCI = true
    mockDefineCommand.mockImplementation((def: Record<string, unknown>) => {
      runHandler = def.run as (ctx: Record<string, unknown>) => Promise<void>
      return def
    })
    mockRunMain.mockResolvedValue(undefined)
    mockLoadConfig.mockResolvedValue({
      config: {},
      layers: [],
    })
  })

  test('logs resolved config in debug mode', async () => {
    const handler = vi.fn()

    clily({
      name: 'mycli',
      debug: true,
      args: v.object({
        name: v.optional(v.string(), 'world'),
      }),
      handler,
    })

    await runHandler({
      rawArgs: [],
      args: {},
      cmd: {},
    })

    expect(handler).toHaveBeenCalled()
  })
})

// ─── Realistic E2E: Multi-Library Deploy CLI ────────────

describe('E2E: realistic deploy CLI with multiple schema libraries', () => {
  let subRunHandlers: Record<string, (ctx: Record<string, unknown>) => Promise<void>>

  beforeEach(() => {
    vi.clearAllMocks()
    subRunHandlers = {}
    mockHasTTY = false
    mockIsCI = true
    mockDefineCommand.mockImplementation((def: Record<string, unknown>) => {
      const meta = def.meta as Record<string, string> | undefined
      if (meta?.name && meta.name !== 'deploytool') {
        subRunHandlers[meta.name] = def.run as (ctx: Record<string, unknown>) => Promise<void>
      }
      return def
    })
    mockRunMain.mockResolvedValue(undefined)
    mockLoadConfig.mockResolvedValue({
      config: {},
      layers: [],
    })
  })

  test('Valibot subcommand receives typed merged config', async () => {
    const handler = vi.fn()

    clily({
      name: 'deploytool',
      flags: v.object({
        verbose: v.optional(v.boolean(), false),
      }),
      children: {
        push: {
          description: 'Push deployment',
          args: v.object({
            target: v.optional(v.string(), 'production'),
            force: v.optional(v.boolean(), false),
          }),
          handler,
        },
      },
    })

    await subRunHandlers['push']({
      rawArgs: ['--force'],
      args: { force: true },
      cmd: {},
    })

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        verbose: false,
        target: 'production',
        force: true,
      }),
    )
  })

  test('Zod subcommand validates and provides defaults', async () => {
    const handler = vi.fn()

    clily({
      name: 'deploytool',
      children: {
        scale: {
          description: 'Scale service',
          args: object({
            replicas: number().default(1),
          }),
          handler,
        },
      },
    })

    await subRunHandlers['scale']({
      rawArgs: [],
      args: {},
      cmd: {},
    })

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ replicas: 1 }))
  })
})

afterEach(() => {
  mockHasTTY = false
  mockIsCI = true
})
