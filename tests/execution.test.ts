/// <reference types="node" />
import * as v from 'valibot'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vite-plus/test'

// Use vi.hoisted so mock functions are available in hoisted vi.mock factories
const { mockRunMain, mockDefineCommand, mockLoadConfig } = vi.hoisted(() => ({
  mockRunMain: vi.fn(),
  mockDefineCommand: vi.fn((def: any) => def),
  mockLoadConfig: vi.fn(async () => ({ config: {}, layers: [] })),
}))

vi.mock('citty', () => ({
  defineCommand: mockDefineCommand,
  runMain: mockRunMain,
}))

vi.mock('c12', () => ({
  loadConfig: mockLoadConfig,
}))

// Default: non-interactive CI environment
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
  text: vi.fn(async () => 'prompted-value'),
  confirm: vi.fn(async () => true),
  isCancel: vi.fn(() => false),
}))

import { clily, handleValidationFailure } from '../src/index.ts'

describe('handleValidationFailure', () => {
  const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('process.exit called')
  })

  afterEach(() => {
    mockExit.mockClear()
    mockHasTTY = false
    mockIsCI = true
  })

  test('returns null and logs errors in CI (non-TTY)', async () => {
    mockHasTTY = false
    mockIsCI = true

    const issues = [{ message: 'Required field', path: [{ key: 'apiKey' }] }]

    const result = await handleValidationFailure(
      issues,
      {},
      [{ key: 'apiKey', type: 'string' as const, required: true }],
      undefined,
      { name: 'test' },
    )

    expect(result).toBeNull()
  })

  test('calls onValidationError hook', async () => {
    const onValidationError = vi.fn()
    const issues = [{ message: 'Error' }]

    await handleValidationFailure(issues, {}, [], undefined, {
      hooks: { onValidationError },
    })

    expect(onValidationError).toHaveBeenCalledWith(issues)
  })

  test('prompts for missing fields in TTY mode', async () => {
    mockHasTTY = true
    mockIsCI = false

    const schema = v.object({
      apiKey: v.string(),
    })

    const issues = [{ message: 'Required', path: [{ key: 'apiKey' }] }]

    const result = await handleValidationFailure(
      issues,
      {},
      [{ key: 'apiKey', type: 'string' as const, required: true }],
      schema,
      {},
    )

    expect(result).toEqual({ apiKey: 'prompted-value' })
  })

  test('calls onPromptSelect hook before prompting', async () => {
    mockHasTTY = true
    mockIsCI = false

    const onPromptSelect = vi.fn()
    const schema = v.object({
      apiKey: v.string(),
    })

    await handleValidationFailure(
      [{ message: 'Required', path: [{ key: 'apiKey' }] }],
      {},
      [{ key: 'apiKey', type: 'string' as const, required: true }],
      schema,
      { hooks: { onPromptSelect } },
    )

    expect(onPromptSelect).toHaveBeenCalledWith(['apiKey'])
  })

  test('returns null for type errors in TTY (not missing keys)', async () => {
    mockHasTTY = true
    mockIsCI = false

    const issues = [{ message: 'Invalid type', path: [{ key: 'count' }] }]

    // Schema has no missing keys (all present but wrong type)
    const schema = v.object({
      count: v.number(),
    })

    const result = await handleValidationFailure(
      issues,
      { count: 'abc' },
      [{ key: 'count', type: 'number' as const, required: true }],
      schema,
      {},
    )

    // No missing keys, so nothing to prompt for → returns null
    expect(result).toBeNull()
  })

  test('extracts keys from issue paths when no schema provided', async () => {
    mockHasTTY = true
    mockIsCI = false

    const issues = [{ message: 'Required', path: ['apiKey'] }]

    const result = await handleValidationFailure(
      issues,
      {},
      [{ key: 'apiKey', type: 'string' as const, required: true }],
      undefined,
      {},
    )

    expect(result).toEqual({ apiKey: 'prompted-value' })
  })

  test('handles issues with path segments containing key property', async () => {
    mockHasTTY = false
    mockIsCI = true

    const issues = [{ message: 'Required', path: [{ key: 'apiKey' }] }]

    const result = await handleValidationFailure(issues, {}, [], undefined, {})

    expect(result).toBeNull()
  })

  test('handles issues without path', async () => {
    mockHasTTY = false
    mockIsCI = true

    const issues = [{ message: 'General error' }]

    const result = await handleValidationFailure(issues, {}, [], undefined, {})

    expect(result).toBeNull()
  })
})

describe('clily execution flow', () => {
  beforeEach(() => {
    mockRunMain.mockClear()
    mockDefineCommand.mockClear()
    mockLoadConfig.mockClear()
    mockHasTTY = false
    mockIsCI = true
  })

  test('calls runMain when invoked', async () => {
    mockRunMain.mockResolvedValueOnce(undefined)

    const cli = clily({
      name: 'test-cli',
      handler: async () => {},
    })

    await cli()

    expect(mockRunMain).toHaveBeenCalled()
  })

  test('calls onError hook when runMain throws', async () => {
    const error = new Error('test error')
    mockRunMain.mockRejectedValueOnce(error)

    const onError = vi.fn()
    const cli = clily({
      name: 'test-cli',
      hooks: { onError },
      handler: async () => {},
    })

    await cli()

    expect(onError).toHaveBeenCalledWith(error)
  })

  test('calls onError with Error object for non-Error throws', async () => {
    mockRunMain.mockRejectedValueOnce('string error')

    const onError = vi.fn()
    const cli = clily({
      name: 'test-cli',
      hooks: { onError },
      handler: async () => {},
    })

    await cli()

    expect(onError).toHaveBeenCalledWith(expect.any(Error))
    expect(onError.mock.calls[0][0].message).toBe('string error')
  })

  test('exits with code 1 when runMain throws without onError hook', async () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    mockRunMain.mockRejectedValueOnce(new Error('test'))

    const cli = clily({
      name: 'test-cli',
      handler: async () => {},
    })

    await cli()

    expect(mockExit).toHaveBeenCalledWith(1)
    mockExit.mockRestore()
  })

  test('defineCommand is called with correct meta', () => {
    clily({
      name: 'mycli',
      version: '1.0.0',
      description: 'Test CLI',
    })

    expect(mockDefineCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: {
          name: 'mycli',
          version: '1.0.0',
          description: 'Test CLI',
        },
      }),
    )
  })

  test('defineCommand is called for subcommands', () => {
    clily({
      name: 'mycli',
      children: {
        deploy: {
          description: 'Deploy',
          handler: async () => {},
        },
      },
    })

    // Called for root + deploy subcommand
    expect(mockDefineCommand).toHaveBeenCalledTimes(2)
    expect(mockDefineCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: {
          name: 'deploy',
          description: 'Deploy',
        },
      }),
    )
  })
})

describe('Root command run handler', () => {
  let rootRunHandler: (ctx: any) => Promise<void>

  beforeEach(() => {
    mockDefineCommand.mockClear()
    mockLoadConfig.mockClear()
    mockHasTTY = false
    mockIsCI = true

    // Capture the run handler when defineCommand is called
    mockDefineCommand.mockImplementation((def: any) => {
      // The last call to defineCommand is for the root command
      rootRunHandler = def.run
      return def
    })
    mockRunMain.mockResolvedValue(undefined)
  })

  test('shows help when no handler is defined', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    clily({
      name: 'mycli',
      version: '1.0.0',
    })

    await rootRunHandler({
      rawArgs: [],
      args: {},
      cmd: {},
    })

    expect(consoleSpy).toHaveBeenCalled()
    const output = consoleSpy.mock.calls[0][0]
    expect(output).toContain('mycli')

    consoleSpy.mockRestore()
  })

  test('shows help when --help flag is passed', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    clily({
      name: 'mycli',
      handler: async () => {},
    })

    await rootRunHandler({
      rawArgs: ['--help'],
      args: { help: true },
      cmd: {},
    })

    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  test('calls onParse hook with rawArgs', async () => {
    const onParse = vi.fn()

    clily({
      name: 'mycli',
      hooks: { onParse },
      handler: async () => {},
    })

    await rootRunHandler({
      rawArgs: ['--verbose'],
      args: { help: true },
      cmd: {},
    })

    expect(onParse).toHaveBeenCalledWith(['--verbose'])
  })

  test('calls onHelp hook and uses its return value', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    clily({
      name: 'mycli',
      hooks: {
        onHelp: () => 'Custom help text',
      },
    })

    await rootRunHandler({
      rawArgs: [],
      args: {},
      cmd: {},
    })

    expect(consoleSpy).toHaveBeenCalledWith('Custom help text')
    consoleSpy.mockRestore()
  })

  test('executes handler with merged config', async () => {
    const handler = vi.fn()
    mockLoadConfig.mockResolvedValueOnce({ config: {}, layers: [] })

    clily({
      name: 'mycli',
      args: v.object({
        ci: v.optional(v.boolean(), false),
      }),
      handler,
    })

    await rootRunHandler({
      rawArgs: [],
      args: { ci: true },
      cmd: {},
    })

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ ci: true }))
  })

  test('calls onValidate hook before validation', async () => {
    const onValidate = vi.fn()

    clily({
      name: 'mycli',
      args: v.object({
        ci: v.optional(v.boolean(), false),
      }),
      hooks: { onValidate },
      handler: async () => {},
    })

    await rootRunHandler({
      rawArgs: [],
      args: {},
      cmd: {},
    })

    expect(onValidate).toHaveBeenCalled()
  })

  test('handles config file loading failure gracefully', async () => {
    mockLoadConfig.mockRejectedValueOnce(new Error('file not found'))
    const handler = vi.fn()

    clily({
      name: 'mycli',
      args: v.object({
        name: v.optional(v.string(), 'default'),
      }),
      handler,
    })

    await rootRunHandler({
      rawArgs: [],
      args: {},
      cmd: {},
    })

    expect(handler).toHaveBeenCalled()
  })

  test('exits with code 1 on validation failure in CI', async () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit')
    })
    mockHasTTY = false
    mockIsCI = true

    clily({
      name: 'mycli',
      args: v.object({
        apiKey: v.string(),
      }),
      handler: async () => {},
    })

    await expect(
      rootRunHandler({
        rawArgs: [],
        args: {},
        cmd: {},
      }),
    ).rejects.toThrow('exit')

    expect(mockExit).toHaveBeenCalledWith(1)
    mockExit.mockRestore()
  })

  test('logs debug info when debug is true', async () => {
    const handler = vi.fn()
    mockLoadConfig.mockResolvedValueOnce({ config: {}, layers: [] })

    clily({
      name: 'mycli',
      debug: true,
      args: v.object({
        ci: v.optional(v.boolean(), false),
      }),
      handler,
    })

    // Should not throw, debug logging is non-critical
    await rootRunHandler({
      rawArgs: [],
      args: {},
      cmd: {},
    })

    expect(handler).toHaveBeenCalled()
  })
})

describe('Subcommand run handler', () => {
  let subRunHandlers: Record<string, (ctx: any) => Promise<void>>

  beforeEach(() => {
    mockDefineCommand.mockClear()
    mockLoadConfig.mockClear()
    mockHasTTY = false
    mockIsCI = true
    subRunHandlers = {}

    mockDefineCommand.mockImplementation((def: any) => {
      if (def.meta?.name) {
        subRunHandlers[def.meta.name] = def.run
      }
      return def
    })
    mockRunMain.mockResolvedValue(undefined)
  })

  test('subcommand handler receives merged config', async () => {
    const deployHandler = vi.fn()
    mockLoadConfig.mockResolvedValueOnce({ config: {}, layers: [] })

    clily({
      name: 'mycli',
      flags: v.object({
        verbose: v.optional(v.boolean(), false),
      }),
      children: {
        deploy: {
          description: 'Deploy',
          args: v.object({
            dryRun: v.optional(v.boolean(), false),
          }),
          handler: deployHandler,
        },
      },
    })

    await subRunHandlers['deploy']({
      rawArgs: [],
      args: { 'dry-run': true },
      cmd: {},
    })

    expect(deployHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        dryRun: true,
        verbose: false,
      }),
    )
  })

  test('subcommand shows help with --help flag', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    clily({
      name: 'mycli',
      children: {
        deploy: {
          description: 'Deploy the project',
          handler: async () => {},
        },
      },
    })

    await subRunHandlers['deploy']({
      rawArgs: ['--help'],
      args: { help: true },
      cmd: {},
    })

    expect(consoleSpy).toHaveBeenCalled()
    const output = consoleSpy.mock.calls[0][0]
    expect(output).toContain('deploy')

    consoleSpy.mockRestore()
  })

  test('subcommand calls onValidate hook from child config', async () => {
    const childOnValidate = vi.fn()
    mockLoadConfig.mockResolvedValueOnce({ config: {}, layers: [] })

    clily({
      name: 'mycli',
      children: {
        deploy: {
          args: v.object({
            name: v.optional(v.string(), 'default'),
          }),
          hooks: { onValidate: childOnValidate },
          handler: async () => {},
        },
      },
    })

    await subRunHandlers['deploy']({
      rawArgs: [],
      args: {},
      cmd: {},
    })

    expect(childOnValidate).toHaveBeenCalled()
  })

  test('subcommand falls back to root onValidate if child has none', async () => {
    const rootOnValidate = vi.fn()
    mockLoadConfig.mockResolvedValueOnce({ config: {}, layers: [] })

    clily({
      name: 'mycli',
      hooks: { onValidate: rootOnValidate },
      children: {
        deploy: {
          args: v.object({
            name: v.optional(v.string(), 'default'),
          }),
          handler: async () => {},
        },
      },
    })

    await subRunHandlers['deploy']({
      rawArgs: [],
      args: {},
      cmd: {},
    })

    expect(rootOnValidate).toHaveBeenCalled()
  })

  test('subcommand exits on validation failure in CI', async () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit')
    })
    mockHasTTY = false
    mockIsCI = true
    mockLoadConfig.mockResolvedValueOnce({ config: {}, layers: [] })

    clily({
      name: 'mycli',
      children: {
        deploy: {
          args: v.object({
            apiKey: v.string(),
          }),
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

  test('subcommand uses onHelp hook from child', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    clily({
      name: 'mycli',
      children: {
        deploy: {
          description: 'Deploy',
          hooks: {
            onHelp: () => 'Custom deploy help',
          },
          handler: async () => {},
        },
      },
    })

    await subRunHandlers['deploy']({
      rawArgs: ['--help'],
      args: { help: true },
      cmd: {},
    })

    expect(consoleSpy).toHaveBeenCalledWith('Custom deploy help')
    consoleSpy.mockRestore()
  })

  test('subcommand falls back to root onHelp hook', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    clily({
      name: 'mycli',
      hooks: {
        onHelp: () => 'Custom root help',
      },
      children: {
        deploy: {
          description: 'Deploy',
          handler: async () => {},
        },
      },
    })

    await subRunHandlers['deploy']({
      rawArgs: ['--help'],
      args: { help: true },
      cmd: {},
    })

    expect(consoleSpy).toHaveBeenCalledWith('Custom root help')
    consoleSpy.mockRestore()
  })

  test('subcommand handles debug mode', async () => {
    const handler = vi.fn()
    mockLoadConfig.mockResolvedValueOnce({ config: {}, layers: [] })

    clily({
      name: 'mycli',
      debug: true,
      children: {
        deploy: {
          args: v.object({
            name: v.optional(v.string(), 'default'),
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

    expect(handler).toHaveBeenCalled()
  })

  test('subcommand does not call handler if none defined', async () => {
    mockLoadConfig.mockResolvedValueOnce({ config: {}, layers: [] })

    clily({
      name: 'mycli',
      children: {
        deploy: {
          description: 'Deploy',
          args: v.object({
            name: v.optional(v.string(), 'default'),
          }),
          // No handler
        },
      },
    })

    // Should not throw
    await subRunHandlers['deploy']({
      rawArgs: [],
      args: {},
      cmd: {},
    })
  })

  test('subcommand handles config file loading failure', async () => {
    mockLoadConfig.mockRejectedValueOnce(new Error('file not found'))
    const handler = vi.fn()

    clily({
      name: 'mycli',
      children: {
        deploy: {
          args: v.object({
            name: v.optional(v.string(), 'default'),
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

    expect(handler).toHaveBeenCalled()
  })

  test('subcommand with nested children', async () => {
    mockLoadConfig.mockResolvedValueOnce({ config: {}, layers: [] })

    clily({
      name: 'mycli',
      children: {
        deploy: {
          description: 'Deploy',
          children: {
            staging: {
              description: 'Deploy to staging',
              args: v.object({
                env: v.optional(v.string(), 'staging'),
              }),
              handler: async () => {},
            },
          },
        },
      },
    })

    // The defineCommand is called for: root, deploy, staging
    expect(mockDefineCommand).toHaveBeenCalledTimes(3)
    expect(mockDefineCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: {
          name: 'staging',
          description: 'Deploy to staging',
        },
      }),
    )
  })

  test('subcommand re-validation exits on failure after TTY prompt', async () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit')
    })
    mockHasTTY = true
    mockIsCI = false
    mockLoadConfig.mockResolvedValueOnce({ config: {}, layers: [] })

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

describe('Root command TTY re-validation', () => {
  let rootRunHandler: (ctx: Record<string, unknown>) => Promise<void>

  beforeEach(() => {
    mockDefineCommand.mockClear()
    mockLoadConfig.mockClear()
    mockHasTTY = false
    mockIsCI = true

    mockDefineCommand.mockImplementation((def: Record<string, unknown>) => {
      rootRunHandler = def.run as (ctx: Record<string, unknown>) => Promise<void>
      return def
    })
    mockRunMain.mockResolvedValue(undefined)
  })

  test('root command re-validation exits on failure after TTY prompt', async () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit')
    })
    mockHasTTY = true
    mockIsCI = false
    mockLoadConfig.mockResolvedValueOnce({ config: {}, layers: [] })

    clily({
      name: 'mycli',
      args: v.object({
        count: v.pipe(v.number(), v.minValue(1)),
      }),
      handler: async () => {},
    })

    await expect(
      rootRunHandler({
        rawArgs: [],
        args: {},
        cmd: {},
      }),
    ).rejects.toThrow('exit')

    expect(mockExit).toHaveBeenCalledWith(1)
    mockExit.mockRestore()
  })
})
