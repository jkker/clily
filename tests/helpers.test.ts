import { describe, expect, test } from 'vite-plus/test'

import { buildArgsDef, coerceValues, mergeConfigLayers } from '../src/index.ts'

describe('buildArgsDef', () => {
  test('merges flag and arg entries into citty args', () => {
    const flagEntries = [
      {
        key: 'verbose',
        type: 'boolean' as const,
        required: false,
        default: false,
      },
    ]
    const argEntries = [{ key: 'apiKey', type: 'string' as const, required: true }]

    const result = buildArgsDef(flagEntries, argEntries)

    expect(result).toHaveProperty('verbose')
    expect(result).toHaveProperty('api-key')
  })

  test('handles empty entries', () => {
    const result = buildArgsDef([], [])
    expect(result).toEqual({})
  })
})

describe('mergeConfigLayers', () => {
  test('CLI args have highest priority', () => {
    const result = mergeConfigLayers(
      { key: 'cli' },
      { key: 'env' },
      { key: 'file' },
      { key: 'default' },
    )
    expect(result.key).toBe('cli')
  })

  test('env vars have second priority', () => {
    const result = mergeConfigLayers({}, { key: 'env' }, { key: 'file' }, { key: 'default' })
    expect(result.key).toBe('env')
  })

  test('file config has third priority', () => {
    const result = mergeConfigLayers({}, {}, { key: 'file' }, { key: 'default' })
    expect(result.key).toBe('file')
  })

  test('schema defaults are lowest priority', () => {
    const result = mergeConfigLayers({}, {}, {}, { key: 'default' })
    expect(result.key).toBe('default')
  })

  test('deeply merges objects', () => {
    const result = mergeConfigLayers({ a: 1 }, { b: 2 }, { c: 3 }, { d: 4 })
    expect(result).toEqual({ a: 1, b: 2, c: 3, d: 4 })
  })
})

describe('coerceValues', () => {
  test('coerces string "true" to boolean true', () => {
    const entries = [{ key: 'flag', type: 'boolean' as const, required: false }]
    const result = coerceValues({ flag: 'true' }, entries)
    expect(result.flag).toBe(true)
  })

  test('coerces string "false" to boolean false', () => {
    const entries = [{ key: 'flag', type: 'boolean' as const, required: false }]
    const result = coerceValues({ flag: 'false' }, entries)
    expect(result.flag).toBe(false)
  })

  test('coerces string "1" to boolean true', () => {
    const entries = [{ key: 'flag', type: 'boolean' as const, required: false }]
    const result = coerceValues({ flag: '1' }, entries)
    expect(result.flag).toBe(true)
  })

  test('coerces string "0" to boolean false', () => {
    const entries = [{ key: 'flag', type: 'boolean' as const, required: false }]
    const result = coerceValues({ flag: '0' }, entries)
    expect(result.flag).toBe(false)
  })

  test('coerces numeric string to number', () => {
    const entries = [{ key: 'port', type: 'number' as const, required: false }]
    const result = coerceValues({ port: '3000' }, entries)
    expect(result.port).toBe(3000)
  })

  test('does not coerce NaN strings to number', () => {
    const entries = [{ key: 'port', type: 'number' as const, required: false }]
    const result = coerceValues({ port: 'abc' }, entries)
    expect(result.port).toBe('abc')
  })

  test('skips undefined values', () => {
    const entries = [{ key: 'flag', type: 'boolean' as const, required: false }]
    const result = coerceValues({}, entries)
    expect(result.flag).toBeUndefined()
  })

  test('does not coerce non-string boolean values', () => {
    const entries = [{ key: 'flag', type: 'boolean' as const, required: false }]
    const result = coerceValues({ flag: true }, entries)
    expect(result.flag).toBe(true)
  })

  test('does not coerce non-string number values', () => {
    const entries = [{ key: 'port', type: 'number' as const, required: false }]
    const result = coerceValues({ port: 42 }, entries)
    expect(result.port).toBe(42)
  })

  test('does not modify string type values', () => {
    const entries = [{ key: 'name', type: 'string' as const, required: true }]
    const result = coerceValues({ name: 'test' }, entries)
    expect(result.name).toBe('test')
  })

  test('handles unknown type entries', () => {
    const entries = [{ key: 'data', type: 'unknown' as const, required: false }]
    const result = coerceValues({ data: 'value' }, entries)
    expect(result.data).toBe('value')
  })

  test('does not coerce invalid boolean strings', () => {
    const entries = [{ key: 'flag', type: 'boolean' as const, required: false }]
    const result = coerceValues({ flag: 'abc' }, entries)
    expect(result.flag).toBe('abc')
  })
})
