import { type as arkType } from 'arktype'
import { describe, expect, test } from 'vite-plus/test'
import { z } from 'zod'

import { buildCompletionTree, renderCompletionPlaceholder } from '../src/completion.ts'
import { renderHelp } from '../src/help.ts'
import { toJsonSchema } from '../src/schema.ts'
import { buildCommandTree } from '../src/tree.ts'

describe('schema-driven helpers', () => {
  test('converts zod and arktype schemas through Standard JSON Schema', () => {
    const zodSchema = z.object({
      server: z.object({
        port: z.number().default(3000),
      }),
      mode: z.enum(['dev', 'prod']).optional(),
    })
    const arktypeSchema = arkType({
      server: {
        port: 'number',
      },
      mode: '"dev" | "prod"',
    })

    expect(toJsonSchema(zodSchema)).toMatchObject({
      type: 'object',
      properties: {
        server: {
          type: 'object',
        },
      },
    })
    expect(toJsonSchema(arktypeSchema)).toMatchObject({
      type: 'object',
      properties: {
        mode: {
          enum: ['dev', 'prod'],
        },
      },
    })
  })

  test('renders help and placeholder completion output from the command tree', () => {
    const tree = buildCommandTree({
      name: 'mycli',
      version: '1.0.0',
      description: 'Example CLI',
      args: z.object({
        server: z.object({
          port: z.number().default(3000).describe('Port to bind'),
        }),
      }),
      completion: {
        description: 'Generate shell completion output',
      },
      subCommands: {
        deploy: {
          description: 'Deploy an artifact',
          alias: 'ship',
          positionals: z.string().describe('Target environment'),
          run: async () => {},
        },
      },
    })

    const help = renderHelp(tree, tree.root, { includeCompletionCommand: true })
    const childHelp = renderHelp(tree, tree.root.children.deploy)
    const completionTree = buildCompletionTree(tree.root)
    const placeholder = renderCompletionPlaceholder(tree, 'bash')

    expect(help).toContain('USAGE:')
    expect(help).toContain('--server.port <number> Port to bind')
    expect(help).toContain('completion Generate shell completion output')
    expect(help).toContain('ship')
    expect(childHelp).toContain('POSITIONALS:')
    expect(completionTree.commands.deploy.description).toBe('Deploy an artifact')
    expect(completionTree.options['--version']).toEqual([])
    expect(completionTree.commands.deploy.options['--help']).toEqual([])
    expect(placeholder).toContain('"program": "mycli"')
    expect(placeholder).toContain('"shell": "bash"')
  })
})
