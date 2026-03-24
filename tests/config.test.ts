import { describe, expect, test, vi } from 'vite-plus/test'

import { loadClilyConfig } from '../src/config.ts'

// Mock c12 to avoid actual file system operations in tests
vi.mock('c12', () => ({
  loadConfig: vi.fn(async (options: { name: string }) => ({
    config: { logLevel: 'debug', name: options.name },
    layers: [],
  })),
}))

describe('loadClilyConfig', () => {
  test('loads config using c12 with the given name', async () => {
    const { loadConfig } = await import('c12')

    const config = await loadClilyConfig({ name: 'mycli' })

    expect(loadConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'mycli',
        rcFile: '.myclirc',
        globalRc: true,
        dotenv: true,
        packageJson: true,
      }),
    )
    expect(config).toEqual({ logLevel: 'debug', name: 'mycli' })
  })

  test('passes custom cwd', async () => {
    const { loadConfig } = await import('c12')

    await loadClilyConfig({ name: 'mycli', cwd: '/custom/dir' })

    expect(loadConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: '/custom/dir',
      }),
    )
  })

  test('returns empty object when config is null', async () => {
    const { loadConfig } = await import('c12')
    vi.mocked(loadConfig).mockResolvedValueOnce({
      config: null as any,
      layers: [],
    })

    const config = await loadClilyConfig({ name: 'mycli' })
    expect(config).toEqual({})
  })
})
