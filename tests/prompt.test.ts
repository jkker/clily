import { describe, expect, test, vi } from 'vite-plus/test'

import { promptForMissing } from '../src/prompt.ts'

// Mock @clack/prompts
vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  text: vi.fn(async () => 'user-input-value'),
  confirm: vi.fn(async () => true),
  isCancel: vi.fn(() => false),
}))

describe('promptForMissing', () => {
  test('prompts for missing string fields', async () => {
    const entries = [{ key: 'apiKey', type: 'string' as const, required: true }]

    const result = await promptForMissing(['apiKey'], entries)

    expect(result).toEqual({ apiKey: 'user-input-value' })
  })

  test('prompts for missing boolean fields with confirm', async () => {
    const entries = [{ key: 'dryRun', type: 'boolean' as const, required: true }]

    const result = await promptForMissing(['dryRun'], entries)

    expect(result).toEqual({ dryRun: true })
  })

  test('prompts for multiple missing fields', async () => {
    const entries = [
      { key: 'apiKey', type: 'string' as const, required: true },
      { key: 'verbose', type: 'boolean' as const, required: true },
    ]

    const result = await promptForMissing(['apiKey', 'verbose'], entries)

    expect(result).toEqual({
      apiKey: 'user-input-value',
      verbose: true,
    })
  })

  test('uses description as label when available', async () => {
    const p = await import('@clack/prompts')
    const entries = [
      {
        key: 'apiKey',
        type: 'string' as const,
        required: true,
        description: 'Your API Key',
      },
    ]

    await promptForMissing(['apiKey'], entries)

    expect(p.text).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Your API Key',
      }),
    )
  })

  test('falls back to generic label without description', async () => {
    const p = await import('@clack/prompts')
    const entries = [{ key: 'name', type: 'string' as const, required: true }]

    await promptForMissing(['name'], entries)

    expect(p.text).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Enter name',
      }),
    )
  })

  test('calls intro and outro', async () => {
    const p = await import('@clack/prompts')
    const entries = [{ key: 'name', type: 'string' as const, required: true }]

    await promptForMissing(['name'], entries)

    expect(p.intro).toHaveBeenCalledWith('Missing required config.')
    expect(p.outro).toHaveBeenCalledWith('Configuration complete.')
  })
})
