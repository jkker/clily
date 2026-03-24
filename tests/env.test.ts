import { describe, expect, test } from 'vite-plus/test'

import { camelToEnvKey, envKeyToCamel, resolveEnvVars, toEnvPrefix } from '../src/env.ts'

describe('toEnvPrefix', () => {
  test('converts simple name to uppercase prefix', () => {
    expect(toEnvPrefix('mycli')).toBe('MYCLI_')
  })

  test('converts hyphenated name', () => {
    expect(toEnvPrefix('my-cli')).toBe('MY_CLI_')
  })

  test('converts dotted name', () => {
    expect(toEnvPrefix('my.cli')).toBe('MY_CLI_')
  })

  test('handles already uppercase', () => {
    expect(toEnvPrefix('MYCLI')).toBe('MYCLI_')
  })
})

describe('envKeyToCamel', () => {
  test('converts simple key', () => {
    expect(envKeyToCamel('API_KEY')).toBe('apiKey')
  })

  test('converts multi-word key', () => {
    expect(envKeyToCamel('DRY_RUN')).toBe('dryRun')
  })

  test('converts single word', () => {
    expect(envKeyToCamel('VERBOSE')).toBe('verbose')
  })

  test('converts three-word key', () => {
    expect(envKeyToCamel('LOG_LEVEL_MAX')).toBe('logLevelMax')
  })
})

describe('camelToEnvKey', () => {
  test('converts camelCase to SCREAMING_SNAKE_CASE', () => {
    expect(camelToEnvKey('apiKey')).toBe('API_KEY')
  })

  test('converts simple key', () => {
    expect(camelToEnvKey('verbose')).toBe('VERBOSE')
  })

  test('converts multi-hump key', () => {
    expect(camelToEnvKey('dryRun')).toBe('DRY_RUN')
  })
})

describe('resolveEnvVars', () => {
  test('resolves matching env vars', () => {
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

  test('returns empty object when no matching env vars', () => {
    const env = {
      OTHER_VAR: 'value',
    }

    const result = resolveEnvVars('mycli', env)
    expect(result).toEqual({})
  })

  test('ignores undefined env var values', () => {
    const env: Record<string, string | undefined> = {
      MYCLI_API_KEY: undefined,
      MYCLI_NAME: 'test',
    }

    const result = resolveEnvVars('mycli', env)
    expect(result).toEqual({ name: 'test' })
  })

  test('handles hyphenated CLI names', () => {
    const env = {
      MY_CLI_PORT: '3000',
    }

    const result = resolveEnvVars('my-cli', env)
    expect(result).toEqual({ port: '3000' })
  })

  test('skips prefix-only keys', () => {
    const env = {
      MYCLI_: 'value',
    }

    const result = resolveEnvVars('mycli', env)
    expect(result).toEqual({})
  })
})
