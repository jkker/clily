import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { describe, expect, test } from 'vite-plus/test'

const srcModulePath = fileURLToPath(new URL('../src/index.ts', import.meta.url))
const srcIndexPath = fileURLToPath(new URL('../src/index.ts', import.meta.url))
const srcTypesPath = fileURLToPath(new URL('../src/types.ts', import.meta.url))

describe('package surface', () => {
  test('exports only the intended runtime entrypoints', async () => {
    const sourceModule = (await import(srcModulePath)) as Record<string, unknown>
    const exportKeys = Object.keys(sourceModule).toSorted()

    expect(exportKeys).toEqual(['ClilyError', 'clily', 'default'])
    expect(sourceModule.default).toBe(sourceModule.clily)
    expect(typeof (sourceModule.default as { command: unknown }).command).toBe('function')
  })

  test('does not leak internal helpers or workflow plumbing types', async () => {
    const indexText = await readFile(srcIndexPath, 'utf8')

    expect(indexText).not.toContain('export { buildCommandTree')
    expect(indexText).not.toContain('export { resolveCommandInput')
    expect(indexText).not.toContain('export { executeCommandNode')
    expect(indexText).not.toContain('export { renderHelp')
    expect(indexText).not.toContain('export { buildCompletionTree')
    expect(indexText).not.toContain('export { sanitizeObjectLayer')
  })

  test('retains the public types needed by command authors', async () => {
    const indexText = await readFile(srcIndexPath, 'utf8')
    const typesText = await readFile(srcTypesPath, 'utf8')

    expect(typesText).toContain('interface ClilyLogger')
    expect(typesText).toContain('interface ClilyCommandContext')
    expect(typesText).toContain('interface ClilyRootCommand')
    expect(typesText).toContain('interface CompletionConfig')
    expect(indexText).toContain('export type {')
    expect(indexText).toContain('ClilyLogger')
    expect(indexText).toContain('export namespace clily')
    expect(indexText).toContain('export default clily')
  })
})
