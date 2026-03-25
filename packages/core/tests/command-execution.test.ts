import * as v from 'valibot'
import { describe, expect, test, vi } from 'vite-plus/test'

import { clily } from '../src/index.ts'

describe('real command execution', () => {
  test('executes child handlers with real argv-derived args without falling back to root help', async () => {
    const stdout = vi.fn()
    const childHandler = vi.fn()

    const cli = clily({
      name: 'mycli',
      flags: v.object({
        verbose: v.optional(v.boolean(), false),
      }),
      runtime: {
        argv: ['node', 'deploy', '--api-key=sk_demo', '--verbose'],
        env: {},
        cwd: () => process.cwd(),
        stdout,
        debug: vi.fn(),
        error: vi.fn(),
        exit: vi.fn(),
      },
      children: {
        deploy: {
          args: v.object({
            apiKey: v.string(),
          }),
          handler: childHandler,
        },
      },
    })

    await cli()

    expect(childHandler).toHaveBeenCalledWith({
      apiKey: 'sk_demo',
      verbose: true,
    })
    expect(stdout).not.toHaveBeenCalled()
  })
})
