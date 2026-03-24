import * as v from 'valibot'
import { describe, expect, test } from 'vite-plus/test'

import { generateHelp } from '../src/help.ts'

describe('generateHelp', () => {
  test('generates basic help text with name', () => {
    const help = generateHelp({
      name: 'mycli',
      description: 'A test CLI',
    })

    expect(help).toContain('mycli')
    expect(help).toContain('A test CLI')
    expect(help).toContain('USAGE:')
  })

  test('includes version when provided', () => {
    const help = generateHelp({
      name: 'mycli',
      version: '1.2.0',
    })

    expect(help).toContain('v1.2.0')
  })

  test('lists global flags from schema', () => {
    const help = generateHelp({
      name: 'mycli',
      flags: v.object({
        verbose: v.optional(v.boolean(), false),
        logLevel: v.optional(v.picklist(['info', 'debug']), 'info'),
      }),
    })

    expect(help).toContain('GLOBAL FLAGS:')
    expect(help).toContain('--verbose')
    expect(help).toContain('--log-level')
  })

  test('lists command-specific args', () => {
    const help = generateHelp({
      name: 'mycli',
      args: v.object({
        apiKey: v.string(),
        dryRun: v.optional(v.boolean(), false),
      }),
    })

    expect(help).toContain('OPTIONS:')
    expect(help).toContain('--api-key')
    expect(help).toContain('--dry-run')
  })

  test('lists subcommands', () => {
    const help = generateHelp({
      name: 'mycli',
      children: {
        deploy: {
          description: 'Deploy the project',
        },
        init: {
          description: 'Initialize a new project',
        },
      },
    })

    expect(help).toContain('COMMANDS:')
    expect(help).toContain('deploy')
    expect(help).toContain('Deploy the project')
    expect(help).toContain('init')
    expect(help).toContain('Initialize a new project')
  })

  test('shows command usage with subcommands', () => {
    const help = generateHelp({
      name: 'mycli',
      children: {
        deploy: { description: 'Deploy' },
      },
    })

    expect(help).toContain('mycli <command> [options]')
  })

  test('shows command usage without subcommands', () => {
    const help = generateHelp({
      name: 'mycli',
    })

    expect(help).toContain('mycli [options]')
  })

  test('generates help for child command with path', () => {
    const help = generateHelp(
      {
        description: 'Deploy the project',
        args: v.object({
          apiKey: v.string(),
        }),
      },
      ['mycli', 'deploy'],
    )

    expect(help).toContain('deploy')
    expect(help).toContain('Deploy the project')
    expect(help).toContain('--api-key')
  })

  test('marks required fields in help', () => {
    const help = generateHelp({
      name: 'mycli',
      args: v.object({
        apiKey: v.string(),
      }),
    })

    expect(help).toContain('required')
  })

  test('shows default values in help', () => {
    const help = generateHelp({
      name: 'mycli',
      args: v.object({
        dryRun: v.optional(v.boolean(), false),
      }),
    })

    expect(help).toContain('default: false')
  })
})
