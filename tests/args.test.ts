import { describe, expect, test } from 'vite-plus/test'

import { camelToKebab, kebabToCamel, normalizeArgs, schemaToCittyArgs } from '../src/args.ts'

describe('camelToKebab', () => {
  test('converts camelCase to kebab-case', () => {
    expect(camelToKebab('apiKey')).toBe('api-key')
  })

  test('converts multi-hump camelCase', () => {
    expect(camelToKebab('dryRun')).toBe('dry-run')
  })

  test('handles single word', () => {
    expect(camelToKebab('verbose')).toBe('verbose')
  })

  test('handles three humps', () => {
    expect(camelToKebab('logLevelMax')).toBe('log-level-max')
  })
})

describe('kebabToCamel', () => {
  test('converts kebab-case to camelCase', () => {
    expect(kebabToCamel('api-key')).toBe('apiKey')
  })

  test('converts multi-dash kebab', () => {
    expect(kebabToCamel('dry-run')).toBe('dryRun')
  })

  test('handles single word', () => {
    expect(kebabToCamel('verbose')).toBe('verbose')
  })
})

describe('schemaToCittyArgs', () => {
  test('converts schema entries to citty args format', () => {
    const entries = [
      {
        key: 'apiKey',
        type: 'string' as const,
        required: true,
        description: 'API Key',
      },
      {
        key: 'dryRun',
        type: 'boolean' as const,
        required: false,
        default: false,
        description: 'Dry run mode',
      },
    ]

    const cittyArgs = schemaToCittyArgs(entries)

    expect(cittyArgs).toEqual({
      'api-key': {
        type: 'string',
        description: 'API Key',
        required: false,
        default: undefined,
      },
      'dry-run': {
        type: 'boolean',
        description: 'Dry run mode',
        required: false,
        default: false,
      },
    })
  })

  test('handles empty entries', () => {
    expect(schemaToCittyArgs([])).toEqual({})
  })
})

describe('normalizeArgs', () => {
  test('converts kebab-case keys to camelCase', () => {
    const parsed = {
      'api-key': 'abc123',
      'dry-run': true,
      verbose: false,
    }

    const result = normalizeArgs(parsed)

    expect(result).toEqual({
      apiKey: 'abc123',
      dryRun: true,
      verbose: false,
    })
  })

  test('strips undefined values', () => {
    const parsed = {
      name: 'test',
      unused: undefined,
    }

    const result = normalizeArgs(parsed)
    expect(result).toEqual({ name: 'test' })
  })

  test('strips underscore key (_)', () => {
    const parsed = {
      _: ['extra', 'args'],
      name: 'test',
    }

    const result = normalizeArgs(parsed)
    expect(result).toEqual({ name: 'test' })
  })
})
