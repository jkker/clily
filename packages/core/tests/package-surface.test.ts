import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { describe, expect, test } from 'vite-plus/test'

const distModulePath = fileURLToPath(new URL('../dist/index.mjs', import.meta.url))
const distTypesPath = fileURLToPath(new URL('../dist/index.d.mts', import.meta.url))

describe('built package surface', () => {
  test('exports only the intended runtime entrypoints', async () => {
    const distModule = (await import(distModulePath)) as Record<string, unknown>
    const exportKeys = Object.keys(distModule)

    exportKeys.sort()

    expect(exportKeys).toEqual([
      'ClilyCommandError',
      'clily',
      'createRuntime',
      'getExecutionEnvironment',
    ])
  })

  test('does not leak internal helpers or schema plumbing types', async () => {
    const declarationText = await readFile(distTypesPath, 'utf8')

    expect(declarationText).not.toContain('buildCompletionTree,')
    expect(declarationText).not.toContain('generateChildHelp,')
    expect(declarationText).not.toContain('generateHelp,')
    expect(declarationText).not.toContain('toJsonSchema,')
    expect(declarationText).not.toContain('validateSchema,')
    expect(declarationText).not.toContain('coerceTypes,')
    expect(declarationText).not.toContain('type JsonSchema,')
    expect(declarationText).not.toContain('type JsonSchemaProperty,')
    expect(declarationText).not.toContain('type TypedChildren,')
    expect(declarationText).not.toContain('type ClilyChildSimple,')
    expect(declarationText).not.toContain('type Prettify,')
  })

  test('retains the public type contracts end users need', async () => {
    const declarationText = await readFile(distTypesPath, 'utf8')

    expect(declarationText).toContain('interface ClilyOptions')
    expect(declarationText).toContain('interface ClilyHooks')
    expect(declarationText).toContain('interface ClilyRuntime')
    expect(declarationText).toContain('interface CompletionConfig')
    expect(declarationText).toContain('interface ExecutionEnvironment')
    expect(declarationText).toContain('declare function clily')
    expect(declarationText).toContain('declare function createRuntime')
    expect(declarationText).toContain('declare function getExecutionEnvironment')
  })
})
