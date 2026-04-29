import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, test, vi } from 'vite-plus/test'
import { z } from 'zod'

import clily from '../src/index.ts'

const createFixtureDir = async (config: Record<string, unknown> = {}): Promise<string> => {
  const cwd = await mkdtemp(join(tmpdir(), 'clily-core-'))
  await writeFile(
    join(cwd, 'package.json'),
    JSON.stringify(
      {
        name: 'fixture',
        version: '1.0.0',
        mycli: config,
      },
      null,
      2,
    ),
  )
  return cwd
}

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

const runWithProcessState = async <T>(
  options: {
    argv: string[]
    cwd: string
    env?: Record<string, string | undefined>
  },
  callback: () => Promise<T>,
): Promise<T> => {
  const originalArgv = process.argv
  const originalCwd = process.cwd()
  const originalExitCode = process.exitCode
  const originalEnvValues = Object.fromEntries(
    Object.keys(options.env ?? {}).map((key) => [key, process.env[key]]),
  )

  process.argv = ['node', 'cli', ...options.argv]
  process.chdir(options.cwd)
  process.exitCode = undefined

  for (const [key, value] of Object.entries(options.env ?? {})) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }

  try {
    return await callback()
  } finally {
    process.argv = originalArgv
    process.chdir(originalCwd)
    process.exitCode = originalExitCode

    for (const [key, value] of Object.entries(originalEnvValues)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

describe('command execution', () => {
  test('merges CLI, env, config, and defaults and passes the logger into root context', async () => {
    const cwd = await createFixtureDir({
      server: {
        host: 'config.example',
      },
      dryRun: true,
    })
    const logger = createTestLogger()
    const run = vi.fn(({ logger: contextLogger }) => {
      contextLogger.info('executed')
    })
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    const cli = clily({
      name: 'mycli',
      logger,
      args: z.object({
        server: z.object({
          host: z.string().default('localhost'),
          port: z.number().default(3000),
        }),
        dryRun: z.boolean().default(false),
      }),
      run,
    })

    try {
      await runWithProcessState(
        {
          argv: ['--server.host=cli.example'],
          cwd,
          env: {
            MYCLI_SERVER__PORT: '5000',
          },
        },
        async () => {
          await cli()
        },
      )

      expect(run).toHaveBeenCalledWith(
        expect.objectContaining({
          commandPath: ['mycli'],
          args: {
            server: {
              host: 'cli.example',
              port: 5000,
            },
            dryRun: true,
          },
          logger,
          positionals: undefined,
        }),
      )
      expect(logger.info).toHaveBeenCalledWith('executed')
    } finally {
      logSpy.mockRestore()
      await rm(cwd, { recursive: true, force: true })
    }
  })

  test('resolves aliased nested subcommands and executes the matching subtree', async () => {
    const cwd = await createFixtureDir()
    const logger = createTestLogger()
    const deploy = vi.fn()
    const rollout = vi.fn()
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    const cli = clily({
      name: 'mycli',
      logger,
      subCommands: {
        deploy: {
          alias: 'ship',
          args: z.object({
            image: z.string(),
            replicas: z.number().default(1),
          }),
          positionals: z.string(),
          run: deploy,
          subCommands: {
            rollout: {
              args: z.object({
                revision: z.string(),
              }),
              run: rollout,
            },
          },
        },
      },
    })

    try {
      await runWithProcessState(
        {
          argv: ['ship', '--image=app:v1', 'production'],
          cwd,
        },
        async () => {
          await cli()
        },
      )

      expect(deploy).toHaveBeenCalledWith(
        expect.objectContaining({
          commandPath: ['mycli', 'deploy'],
          args: {
            image: 'app:v1',
            replicas: 1,
          },
          positionals: 'production',
        }),
      )

      await runWithProcessState(
        {
          argv: ['deploy', 'rollout', '--revision=r2'],
          cwd,
        },
        async () => {
          await cli()
        },
      )

      expect(rollout).toHaveBeenCalledWith(
        expect.objectContaining({
          commandPath: ['mycli', 'deploy', 'rollout'],
          args: {
            revision: 'r2',
          },
          positionals: undefined,
        }),
      )
    } finally {
      logSpy.mockRestore()
      await rm(cwd, { recursive: true, force: true })
    }
  })

  test('prints built-in help, version, and completion output from the prebuilt tree', async () => {
    const cwd = await createFixtureDir()
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    const cli = clily({
      name: 'mycli',
      version: '1.2.3',
      description: 'Example CLI',
      completion: true,
      args: z.object({
        dryRun: z.boolean().default(false).describe('Run without side effects'),
      }),
      subCommands: {
        deploy: {
          description: 'Deploy an artifact',
          run: async () => {},
        },
      },
    })

    try {
      await runWithProcessState(
        {
          argv: ['--help'],
          cwd,
        },
        async () => {
          await cli()
        },
      )

      expect(logSpy).toHaveBeenLastCalledWith(expect.stringContaining('COMMANDS:'))
      expect(logSpy).toHaveBeenLastCalledWith(expect.stringContaining('completion'))

      await runWithProcessState(
        {
          argv: ['--version'],
          cwd,
        },
        async () => {
          await cli()
        },
      )

      expect(logSpy).toHaveBeenLastCalledWith('1.2.3')

      await runWithProcessState(
        {
          argv: ['completion', 'zsh'],
          cwd,
        },
        async () => {
          await cli()
        },
      )

      expect(logSpy).toHaveBeenLastCalledWith(
        expect.stringContaining('# Completion generation is not implemented yet.'),
      )
    } finally {
      logSpy.mockRestore()
      await rm(cwd, { recursive: true, force: true })
    }
  })
})
