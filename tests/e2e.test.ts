/// <reference types="node" />
import { type as arkType } from 'arktype'
import consola from 'consola'
import * as v from 'valibot'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vite-plus/test'
import { boolean as zBoolean, enum as zEnum, number, object, string } from 'zod'

import { setNestedValue } from '../src/args.ts'
import {
  buildCompletionTree,
  camelToKebab,
  clily,
  coerceTypes,
  createRuntime,
  extractCompletionShellArg,
  generateCompletionScript,
  generateHelp,
  getCompletionCommandNames,
  getDefaults,
  getExecutionEnvironment,
  getMissingRequired,
  inferShell,
  kebabToCamel,
  normalizeArgs,
  normalizeCompletionConfig,
  resolveCompletionShell,
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
  runCommand: mockRunMain,
  runMain: mockRunMain,
}))

vi.mock('c12', () => ({
  loadConfig: mockLoadConfig,
}))

let mockHasTTY = false
let mockIsCI = true
let mockIsColorSupported = true
let mockIsDebug = false
let mockRuntime = 'node'
let mockIsNode = true
let mockIsBun = false
let mockIsDeno = false

vi.mock('std-env', () => ({
  get hasTTY() {
    return mockHasTTY
  },
  get isCI() {
    return mockIsCI
  },
  get isColorSupported() {
    return mockIsColorSupported
  },
  get isDebug() {
    return mockIsDebug
  },
  get runtime() {
    return mockRuntime
  },
  get isNode() {
    return mockIsNode
  },
  get isBun() {
    return mockIsBun
  },
  get isDeno() {
    return mockIsDeno
  },
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

  test('handles number, literal, and nullish types', () => {
    const schema = v.object({
      count: v.number(),
      mode: v.literal('fast'),
      name: v.nullish(v.string(), 'default'),
    })

    const js = toJsonSchema(schema)

    expect(js.properties.count.type).toBe('number')
    expect(js.properties.mode.type).toBe('string')
    expect(js.properties.name.type).toBe('string')
    expect(js.properties.name.default).toBe('default')
    expect(js.required).toEqual(['count', 'mode'])
  })

  test('handles function defaults', () => {
    const schema = v.object({
      list: v.optional(v.string(), () => 'computed'),
    })

    const js = toJsonSchema(schema)

    expect(js.properties.list.default).toBe('computed')
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

  test('handles boolean and enum types', () => {
    const schema = object({
      active: zBoolean(),
      level: zEnum(['info', 'debug', 'warn']),
    })

    const js = toJsonSchema(schema)

    expect(js.properties.active.type).toBe('boolean')
    expect(js.properties.level.type).toBe('string')
    expect(js.properties.level.enum).toEqual(['info', 'debug', 'warn'])
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

  test('handles schema with only optional fields', () => {
    const schema = arkType({
      'name?': 'string',
    })

    const js = toJsonSchema(schema)

    expect(js.required).toEqual([])
    expect(js.properties.name.type).toBe('string')
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

describe('std-env integration', () => {
  test('infers shells from environment variables', () => {
    expect(inferShell({ SHELL: '/bin/bash' })).toBe('bash')
    expect(inferShell({ SHELL: '/bin/zsh' })).toBe('zsh')
    expect(inferShell({ SHELL: '/usr/bin/fish' })).toBe('fish')
    expect(inferShell({ TERM_PROGRAM: 'PowerShell' })).toBe('pwsh')
    expect(inferShell({ PSModulePath: '/tmp/modules' })).toBe('pwsh')
    expect(inferShell({})).toBeNull()
  })

  test('reports execution environment details', () => {
    mockHasTTY = true
    mockIsCI = false
    mockIsColorSupported = true
    mockIsDebug = true
    mockRuntime = 'bun'
    mockIsNode = false
    mockIsBun = true
    mockIsDeno = false

    expect(getExecutionEnvironment({ SHELL: '/bin/zsh' })).toEqual({
      shell: 'zsh',
      runtime: 'bun',
      isNode: false,
      isBun: true,
      isDeno: false,
      hasTTY: true,
      isCI: false,
      isDebug: true,
      isColorSupported: true,
    })
  })

  test('reports deno runtime details', () => {
    mockRuntime = 'deno'
    mockIsNode = false
    mockIsBun = false
    mockIsDeno = true

    expect(getExecutionEnvironment({ SHELL: '/bin/bash' }).runtime).toBe('deno')
    expect(getExecutionEnvironment({ SHELL: '/bin/bash' }).isDeno).toBe(true)
  })
})

describe('runtime boundary', () => {
  test('createRuntime uses default stdout and debug adapters', async () => {
    const stdoutSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const debugSpy = vi.spyOn(consola, 'debug').mockImplementation(() => undefined)

    const runtime = createRuntime()

    await runtime.stdout('hello')
    await runtime.debug('debug-only')

    expect(stdoutSpy).toHaveBeenCalledWith('hello')
    expect(debugSpy).toHaveBeenCalledWith('debug-only')

    stdoutSpy.mockRestore()
    debugSpy.mockRestore()
  })

  test('createRuntime respects explicit overrides', async () => {
    const exit = vi.fn()
    const stdout = vi.fn()

    const runtime = createRuntime({
      argv: ['bun', 'task'],
      env: { BUN_ENV: 'test' },
      cwd: () => '/tmp/workspace',
      exit,
      stdout,
    })

    await runtime.stdout('captured')
    await runtime.exit({ code: 9, reason: 'runtime-error' })

    expect(runtime.argv).toEqual(['bun', 'task'])
    expect(runtime.env).toEqual({ BUN_ENV: 'test' })
    expect(runtime.cwd()).toBe('/tmp/workspace')
    expect(stdout).toHaveBeenCalledWith('captured')
    expect(exit).toHaveBeenCalledWith({ code: 9, reason: 'runtime-error' })
  })
})

describe('completion helpers', () => {
  test('normalizes completion config defaults', () => {
    expect(normalizeCompletionConfig(true)).toEqual({
      command: 'completion',
      aliases: ['completions'],
      shell: 'auto',
      shells: ['bash', 'zsh', 'fish', 'pwsh'],
    })
  })

  test('extracts configured command names', () => {
    expect(getCompletionCommandNames(true)).toEqual(['completion', 'completions'])
    expect(
      getCompletionCommandNames({
        command: 'complete',
        aliases: ['comp'],
        shell: 'auto',
        shells: ['bash'],
      }),
    ).toEqual(['complete', 'comp'])
  })

  test('extracts completion shell argument from argv', () => {
    expect(extractCompletionShellArg(['completion', 'fish'], ['completion'])).toBe('fish')
    expect(extractCompletionShellArg(['deploy'], ['completion'])).toBeUndefined()
    expect(extractCompletionShellArg(['completion', '--help'], ['completion'])).toBeUndefined()
  })

  test('resolves completion shell from request and env defaults', () => {
    const completion = normalizeCompletionConfig(true)
    expect(
      resolveCompletionShell('pwsh', completion, {
        shell: 'bash',
        runtime: 'node',
        isNode: true,
        isBun: false,
        isDeno: false,
        hasTTY: true,
        isCI: false,
        isDebug: false,
        isColorSupported: true,
      }),
    ).toBe('pwsh')

    expect(
      resolveCompletionShell(undefined, completion, {
        shell: 'fish',
        runtime: 'node',
        isNode: true,
        isBun: false,
        isDeno: false,
        hasTTY: true,
        isCI: false,
        isDebug: false,
        isColorSupported: true,
      }),
    ).toBe('fish')

    expect(() =>
      resolveCompletionShell('invalid', completion, {
        shell: 'bash',
        runtime: 'node',
        isNode: true,
        isBun: false,
        isDeno: false,
        hasTTY: true,
        isCI: false,
        isDebug: false,
        isColorSupported: true,
      }),
    ).toThrow('Unsupported completion shell')
  })

  test('builds completion tree from flags, args, and subcommands', () => {
    const tree = buildCompletionTree({
      flags: v.object({
        verbose: v.optional(v.boolean(), false),
      }),
      children: {
        deploy: {
          args: v.object({
            logLevel: v.optional(v.picklist(['info', 'debug']), 'info'),
          }),
          handler: async () => {},
        },
      },
      completion: true,
    })

    expect(tree['--verbose']).toEqual([])
    expect(tree.deploy).toBeDefined()
    expect((tree.deploy as Record<string, unknown>)['--log-level']).toEqual(['info', 'debug'])
    expect(tree.completion).toEqual(['bash', 'zsh', 'fish', 'pwsh'])
  })

  test('generates bash, fish, and pwsh completion scripts', () => {
    const tree = buildCompletionTree({
      children: {
        deploy: { handler: async () => {} },
      },
      completion: true,
    })

    expect(generateCompletionScript('mycli', tree, 'bash')).toContain('complete -F')
    expect(generateCompletionScript('mycli', tree, 'fish')).toContain('--compfish')
    expect(generateCompletionScript('mycli', tree, 'pwsh')).toContain('Register-ArgumentCompleter')
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
    ).rejects.toMatchObject({
      code: 1,
      reason: 'validation',
    })
  })

  test('works the same with Zod schemas in CI', async () => {
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
    ).rejects.toMatchObject({
      code: 1,
      reason: 'validation',
    })
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

  test('uses injected argv for wrapper-level help output', async () => {
    const stdout = vi.fn()

    const run = clily({
      name: 'mycli',
      description: 'Injected argv help',
      runtime: {
        argv: ['node', 'mycli', '--help'],
        stdout,
      },
      handler: async () => {},
    })

    await run()

    expect(stdout).toHaveBeenCalledWith(expect.stringContaining('Injected argv help'))
  })

  test('uses injected argv for wrapper-level version output', async () => {
    const stdout = vi.fn()

    const run = clily({
      name: 'mycli',
      version: '9.9.9',
      runtime: {
        argv: ['node', 'mycli', '--version'],
        stdout,
      },
      handler: async () => {},
    })

    await run()

    expect(stdout).toHaveBeenCalledWith('9.9.9')
  })

  test('routes missing version through injected runtime error handling', async () => {
    const error = vi.fn()
    const exit = vi.fn()

    const run = clily({
      name: 'mycli',
      runtime: {
        argv: ['node', 'mycli', '--version'],
        error,
        exit,
      },
      handler: async () => {},
    })

    await run()

    expect(error).toHaveBeenCalledWith(expect.any(Error))
    expect(exit).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 1,
        reason: 'runtime-error',
      }),
    )
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
    const errorSpy = vi.spyOn(consola, 'error').mockImplementation(() => undefined)
    mockRunMain.mockRejectedValueOnce(new Error('fatal'))

    const run = clily({
      name: 'mycli',
      handler: async () => {},
    })

    await run()

    expect(mockExit).toHaveBeenCalledWith(1)
    errorSpy.mockRestore()
    mockExit.mockRestore()
  })

  test('uses injected runtime exit instead of process.exit', async () => {
    const exit = vi.fn()
    const error = vi.fn()
    mockRunMain.mockRejectedValueOnce(new Error('fatal'))

    const run = clily({
      name: 'mycli',
      runtime: {
        exit,
        error,
      },
      handler: async () => {},
    })

    await run()

    expect(error).toHaveBeenCalledWith(expect.any(Error))
    expect(exit).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 1,
        reason: 'runtime-error',
      }),
    )
  })

  test('calls onExit with structured exit metadata', async () => {
    const exit = vi.fn()
    const error = vi.fn()
    const onExit = vi.fn()
    mockRunMain.mockRejectedValueOnce(new Error('fatal'))

    const run = clily({
      name: 'mycli',
      hooks: { onExit },
      runtime: {
        exit,
        error,
      },
      handler: async () => {},
    })

    await run()

    expect(onExit).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 1,
        reason: 'runtime-error',
      }),
    )
    expect(exit).toHaveBeenCalledTimes(1)
  })

  test('onError suppresses the default exit path for runtime failures', async () => {
    const exit = vi.fn()
    const error = vi.fn()
    const onError = vi.fn()
    mockRunMain.mockRejectedValueOnce(new Error('fatal'))

    const run = clily({
      name: 'mycli',
      hooks: { onError },
      runtime: {
        exit,
        error,
      },
      handler: async () => {},
    })

    await run()

    expect(onError).toHaveBeenCalledWith(expect.any(Error))
    expect(error).not.toHaveBeenCalled()
    expect(exit).not.toHaveBeenCalled()
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

  test('throws when root positionals are configured', () => {
    expect(() =>
      clily({
        name: 'mycli',
        positionals: v.object({ target: v.string() }),
        handler: async () => {},
      }),
    ).toThrow(/Positionals are not supported yet for command "mycli"/)
  })

  test('throws when child positionals are configured', () => {
    expect(() =>
      clily({
        name: 'mycli',
        children: {
          deploy: {
            positionals: v.object({ target: v.string() }),
            handler: async () => {},
          },
        },
      }),
    ).toThrow(/Positionals are not supported yet for command "mycli deploy"/)
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
    const debugSpy = vi.spyOn(consola, 'debug').mockImplementation(() => undefined)

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
    expect(debugSpy).toHaveBeenCalled()
    debugSpy.mockRestore()
  })

  test('uses std-env debug flag as default', async () => {
    const handler = vi.fn()
    const debugSpy = vi.spyOn(consola, 'debug').mockImplementation(() => undefined)
    mockIsDebug = true

    clily({
      name: 'mycli',
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
    expect(debugSpy).toHaveBeenCalled()
    debugSpy.mockRestore()
  })
})

describe('Completion command E2E', () => {
  const originalArgv = process.argv
  const originalShell = process.env.SHELL
  const originalPSModulePath = process.env.PSModulePath

  beforeEach(() => {
    vi.clearAllMocks()
    mockRuntime = 'node'
    mockIsNode = true
    mockIsBun = false
    mockIsDeno = false
    mockIsDebug = false
    mockHasTTY = true
    mockIsCI = false
    mockDefineCommand.mockImplementation((def: Record<string, unknown>) => def)
    mockRunMain.mockResolvedValue(undefined)
  })

  afterEach(() => {
    process.argv = originalArgv
    if (originalShell === undefined) {
      delete process.env.SHELL
    } else {
      process.env.SHELL = originalShell
    }
    if (originalPSModulePath === undefined) {
      delete process.env.PSModulePath
    } else {
      process.env.PSModulePath = originalPSModulePath
    }
  })

  test('prints inferred zsh completion script from completion command', async () => {
    process.argv = ['node', 'mycli', 'completion']
    process.env.SHELL = '/bin/zsh'
    delete process.env.PSModulePath
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const run = clily({
      name: 'mycli',
      completion: true,
      flags: v.object({
        verbose: v.optional(v.boolean(), false),
      }),
      children: {
        deploy: {
          args: v.object({
            logLevel: v.optional(v.picklist(['info', 'debug']), 'info'),
          }),
          handler: async () => {},
        },
      },
      handler: async () => {},
    })

    await run()

    expect(mockRunMain).not.toHaveBeenCalled()
    expect(consoleSpy.mock.calls[0][0]).toContain('compdef')
    consoleSpy.mockRestore()
  })

  test('prints fish completion script when shell is requested explicitly', async () => {
    process.argv = ['node', 'mycli', 'completions', 'fish']
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const run = clily({
      name: 'mycli',
      completion: true,
      children: {
        deploy: {
          handler: async () => {},
        },
      },
      handler: async () => {},
    })

    await run()

    expect(consoleSpy.mock.calls[0][0]).toContain('--compfish')
    consoleSpy.mockRestore()
  })

  test('prints pwsh completion script in PowerShell environments', async () => {
    process.argv = ['node', 'mycli', 'completion']
    delete process.env.SHELL
    process.env.PSModulePath = '/tmp/modules'
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const run = clily({
      name: 'mycli',
      completion: {
        shell: 'auto',
      },
      children: {
        deploy: {
          handler: async () => {},
        },
      },
      handler: async () => {},
    })

    await run()

    expect(consoleSpy.mock.calls[0][0]).toContain('Register-ArgumentCompleter')
    consoleSpy.mockRestore()
  })

  test('includes completion commands in generated help', async () => {
    let runHandler: (ctx: Record<string, unknown>) => Promise<void>
    mockDefineCommand.mockImplementation((def: Record<string, unknown>) => {
      runHandler = def.run as (ctx: Record<string, unknown>) => Promise<void>
      return def
    })
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    clily({
      name: 'mycli',
      completion: true,
      children: {
        deploy: {
          handler: async () => {},
        },
      },
      handler: async () => {},
    })

    await runHandler!({
      rawArgs: ['--help'],
      args: { help: true },
      cmd: {},
    })

    expect(consoleSpy.mock.calls[0][0]).toContain('completion')
    expect(consoleSpy.mock.calls[0][0]).toContain('completions')
    consoleSpy.mockRestore()
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

// ─── Nested JSON Schema Args ────────────────────────────

describe('Nested JSON Schema args', () => {
  test('jsonSchemaToCittyArgs handles nested object properties', () => {
    const { jsonSchemaToCittyArgs } = require('../src/args.ts') as typeof import('../src/args.ts')
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        config: {
          type: 'object',
          properties: {
            server: { type: 'string' },
            port: { type: 'number' },
          },
          required: ['server'],
        },
      },
      required: [],
    }

    const args = jsonSchemaToCittyArgs(schema)
    expect(args['config.server']).toBeDefined()
    expect(args['config.port']).toBeDefined()
    expect(args['config.server'].type).toBe('string')
  })
})

// ─── Env Var Helpers ────────────────────────────────────

describe('Env var helpers', () => {
  test('camelToEnvKey converts correctly', () => {
    const { camelToEnvKey } = require('../src/env.ts') as typeof import('../src/env.ts')
    expect(camelToEnvKey('apiKey')).toBe('API_KEY')
    expect(camelToEnvKey('dryRun')).toBe('DRY_RUN')
  })
})

// ─── Prompt cancel handling ─────────────────────────────

describe('Prompt cancel handling', () => {
  test('uses enum values as text prompt placeholder hints', async () => {
    const p = await import('@clack/prompts')
    const { promptForMissing } = await import('../src/prompt.ts')

    const schema: JsonSchema = {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['fast', 'safe'] },
      },
      required: ['mode'],
    }

    await promptForMissing(['mode'], schema)

    expect(p.text).toHaveBeenCalledWith(
      expect.objectContaining({
        placeholder: 'One of: fast, safe',
      }),
    )
  })

  test('exits when text prompt is cancelled', async () => {
    const p = await import('@clack/prompts')
    const { promptForMissing } = await import('../src/prompt.ts')
    vi.mocked(p.isCancel).mockReturnValueOnce(true)

    const schema: JsonSchema = {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    }

    await expect(promptForMissing(['name'], schema)).rejects.toMatchObject({
      code: 0,
      reason: 'cancelled',
      silent: true,
    })

    expect(p.cancel).toHaveBeenCalledWith('Operation cancelled.')
    vi.mocked(p.isCancel).mockReturnValue(false)
  })

  test('exits when confirm prompt is cancelled', async () => {
    const p = await import('@clack/prompts')
    const { promptForMissing } = await import('../src/prompt.ts')
    vi.mocked(p.isCancel).mockReturnValueOnce(true)

    const schema: JsonSchema = {
      type: 'object',
      properties: { flag: { type: 'boolean' } },
      required: ['flag'],
    }

    await expect(promptForMissing(['flag'], schema)).rejects.toMatchObject({
      code: 0,
      reason: 'cancelled',
      silent: true,
    })

    expect(p.cancel).toHaveBeenCalledWith('Operation cancelled.')
    vi.mocked(p.isCancel).mockReturnValue(false)
  })
})

// ─── Re-validation after prompt ─────────────────────────

describe('Re-validation after prompt', () => {
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
    mockLoadConfig.mockResolvedValue({ config: {}, layers: [] })
  })

  test('exits when re-validation fails after prompt', async () => {
    mockHasTTY = true
    mockIsCI = false

    clily({
      name: 'mycli',
      children: {
        deploy: {
          args: v.object({
            count: v.pipe(v.number(), v.minValue(1)),
          }),
          handler: async () => {},
        },
      },
    })

    // Prompt returns 'prompted-value' which isn't a valid number > 1
    await expect(
      subRunHandlers['deploy']({
        rawArgs: [],
        args: {},
        cmd: {},
      }),
    ).rejects.toMatchObject({
      code: 1,
      reason: 'validation',
    })
  })
})

// ─── TTY validation with type errors (not missing keys) ─

describe('TTY validation with type errors', () => {
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
    mockLoadConfig.mockResolvedValue({ config: {}, layers: [] })
  })

  test('logs type errors and exits in TTY when no missing keys', async () => {
    mockHasTTY = true
    mockIsCI = false

    // Schema requires a number, but CLI provides a non-coercible string
    clily({
      name: 'mycli',
      children: {
        deploy: {
          args: v.object({
            count: v.number(),
          }),
          handler: async () => {},
        },
      },
    })

    // Provide count as non-numeric string (coercion can't fix it)
    await expect(
      subRunHandlers['deploy']({
        rawArgs: ['--count=abc'],
        args: { count: 'abc' },
        cmd: {},
      }),
    ).rejects.toMatchObject({
      code: 1,
      reason: 'validation',
    })
  })
})

// ─── Help for child command (generateChildHelp) ─────────

describe('generateChildHelp', () => {
  test('generates child help with parent flags and child args', () => {
    const { generateChildHelp } = require('../src/help.ts') as typeof import('../src/help.ts')
    const parentFlagsSchema: JsonSchema = {
      type: 'object',
      properties: { verbose: { type: 'boolean', default: false } },
      required: [],
    }
    const childConfig = {
      description: 'Deploy the project',
      args: v.object({ apiKey: v.string() }),
    }

    const help = generateChildHelp(childConfig, parentFlagsSchema, ['mycli', 'deploy'])

    expect(help).toContain('deploy')
    expect(help).toContain('Deploy the project')
    expect(help).toContain('--verbose')
    expect(help).toContain('--api-key')
    expect(help).toContain('GLOBAL FLAGS:')
    expect(help).toContain('OPTIONS:')
  })

  test('generates child help without parent flags', () => {
    const { generateChildHelp } = require('../src/help.ts') as typeof import('../src/help.ts')
    const childConfig = {
      description: 'Init project',
    }

    const help = generateChildHelp(childConfig, null, ['mycli', 'init'])

    expect(help).toContain('init')
    expect(help).toContain('Init project')
    expect(help).not.toContain('GLOBAL FLAGS:')
  })
})

// ─── Valibot description extraction ─────────────────────

describe('Schema description extraction', () => {
  test('extracts description from valibot string message', () => {
    const schema = v.object({
      apiKey: v.string('API Key is required'),
    })

    const js = toJsonSchema(schema)

    expect(js.properties.apiKey.description).toBe('API Key is required')
  })
})

// ─── Config file loading error resilience ────────────────

describe('Config file loading error', () => {
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
  })

  test('continues when config file loading fails', async () => {
    const error = new Error('file not found') as Error & { code?: string }
    error.code = 'ENOENT'
    mockLoadConfig.mockRejectedValueOnce(error)
    const handler = vi.fn()

    clily({
      name: 'mycli',
      children: {
        deploy: {
          args: v.object({ name: v.optional(v.string(), 'default') }),
          handler,
        },
      },
    })

    await subRunHandlers['deploy']({
      rawArgs: [],
      args: {},
      cmd: {},
    })

    expect(handler).toHaveBeenCalled()
  })

  test('rethrows non-missing config file errors', async () => {
    mockLoadConfig.mockRejectedValueOnce(new Error('invalid config syntax'))

    clily({
      name: 'mycli',
      children: {
        deploy: {
          args: v.object({ name: v.optional(v.string(), 'default') }),
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
    ).rejects.toThrow(/Failed to load config for command "mycli"/)
  })

  test('uses process cwd when no cwd override is provided', async () => {
    const { loadClilyConfig } = await import('../src/config.ts')

    mockLoadConfig.mockResolvedValueOnce({
      config: {},
      layers: [],
    })

    await loadClilyConfig({ name: 'mycli' })

    expect(mockLoadConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: process.cwd(),
      }),
    )
  })
})

afterEach(() => {
  mockHasTTY = false
  mockIsCI = true
  mockIsColorSupported = true
  mockIsDebug = false
  mockRuntime = 'node'
  mockIsNode = true
  mockIsBun = false
  mockIsDeno = false
})
