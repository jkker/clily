import * as v from 'valibot'
import { describe, expect, test } from 'vite-plus/test'

import {
  getMissingRequiredKeys,
  getSchemaDefaults,
  getSchemaEntries,
  validateSchema,
} from '../src/schema.ts'

describe('getSchemaEntries', () => {
  test('extracts entries from valibot object schema', () => {
    const schema = v.object({
      name: v.string(),
      age: v.number(),
      active: v.boolean(),
    })

    const entries = getSchemaEntries(schema)

    expect(entries).toHaveLength(3)
    expect(entries[0]).toEqual({
      key: 'name',
      type: 'string',
      required: true,
      default: undefined,
      description: undefined,
    })
    expect(entries[1]).toEqual({
      key: 'age',
      type: 'number',
      required: true,
      default: undefined,
      description: undefined,
    })
    expect(entries[2]).toEqual({
      key: 'active',
      type: 'boolean',
      required: true,
      default: undefined,
      description: undefined,
    })
  })

  test('handles optional fields with defaults', () => {
    const schema = v.object({
      verbose: v.optional(v.boolean(), false),
      logLevel: v.optional(v.picklist(['info', 'debug', 'warn', 'error']), 'info'),
    })

    const entries = getSchemaEntries(schema)

    expect(entries).toHaveLength(2)
    expect(entries[0]).toEqual({
      key: 'verbose',
      type: 'boolean',
      required: false,
      default: false,
      description: undefined,
    })
    expect(entries[1]).toEqual({
      key: 'logLevel',
      type: 'string',
      required: false,
      default: 'info',
      description: undefined,
    })
  })

  test('handles optional fields without defaults', () => {
    const schema = v.object({
      name: v.optional(v.string()),
    })

    const entries = getSchemaEntries(schema)

    expect(entries).toHaveLength(1)
    expect(entries[0].required).toBe(false)
    expect(entries[0].default).toBeUndefined()
  })

  test('handles mixed required and optional fields', () => {
    const schema = v.object({
      apiKey: v.string(),
      dryRun: v.optional(v.boolean(), false),
    })

    const entries = getSchemaEntries(schema)

    expect(entries).toHaveLength(2)
    expect(entries[0].key).toBe('apiKey')
    expect(entries[0].required).toBe(true)
    expect(entries[1].key).toBe('dryRun')
    expect(entries[1].required).toBe(false)
    expect(entries[1].default).toBe(false)
  })

  test('returns empty array for non-introspectable schema', () => {
    // Simulate a schema with no known introspection mechanism
    const schema = {
      '~standard': {
        version: 1 as const,
        vendor: 'unknown',
        validate: () => ({ value: {} }),
      },
    }

    const entries = getSchemaEntries(schema)
    expect(entries).toEqual([])
  })

  test('detects picklist/enum types as string', () => {
    const schema = v.object({
      level: v.picklist(['info', 'debug', 'warn']),
    })

    const entries = getSchemaEntries(schema)
    expect(entries[0].type).toBe('string')
  })
})

describe('validateSchema', () => {
  test('returns success for valid data', async () => {
    const schema = v.object({
      name: v.string(),
    })

    const result = await validateSchema(schema, { name: 'test' })

    expect(result.success).toBe(true)
    expect(result.value).toEqual({ name: 'test' })
  })

  test('returns failure with issues for invalid data', async () => {
    const schema = v.object({
      name: v.string(),
    })

    const result = await validateSchema(schema, {})

    expect(result.success).toBe(false)
    expect(result.issues).toBeDefined()
    expect(result.issues!.length).toBeGreaterThan(0)
  })

  test('validates complex schema with optional fields', async () => {
    const schema = v.object({
      apiKey: v.string(),
      dryRun: v.optional(v.boolean(), false),
    })

    const result = await validateSchema(schema, { apiKey: 'abc123' })

    expect(result.success).toBe(true)
    expect(result.value).toEqual({ apiKey: 'abc123', dryRun: false })
  })

  test('reports type mismatch errors', async () => {
    const schema = v.object({
      count: v.number(),
    })

    const result = await validateSchema(schema, { count: 'not-a-number' })

    expect(result.success).toBe(false)
    expect(result.issues!.length).toBeGreaterThan(0)
  })
})

describe('getSchemaDefaults', () => {
  test('extracts default values', () => {
    const schema = v.object({
      verbose: v.optional(v.boolean(), false),
      logLevel: v.optional(v.picklist(['info', 'debug']), 'info'),
      apiKey: v.string(),
    })

    const defaults = getSchemaDefaults(schema)

    expect(defaults).toEqual({
      verbose: false,
      logLevel: 'info',
    })
  })

  test('returns empty object when no defaults', () => {
    const schema = v.object({
      name: v.string(),
    })

    const defaults = getSchemaDefaults(schema)
    expect(defaults).toEqual({})
  })
})

describe('getMissingRequiredKeys', () => {
  test('identifies missing required fields', () => {
    const schema = v.object({
      apiKey: v.string(),
      name: v.string(),
      verbose: v.optional(v.boolean(), false),
    })

    const missing = getMissingRequiredKeys(schema, { verbose: true })

    expect(missing).toEqual(['apiKey', 'name'])
  })

  test('returns empty array when all required fields present', () => {
    const schema = v.object({
      apiKey: v.string(),
      verbose: v.optional(v.boolean(), false),
    })

    const missing = getMissingRequiredKeys(schema, { apiKey: 'abc' })

    expect(missing).toEqual([])
  })

  test('treats null values as missing', () => {
    const schema = v.object({
      apiKey: v.string(),
    })

    const missing = getMissingRequiredKeys(schema, { apiKey: null })

    expect(missing).toEqual(['apiKey'])
  })
})

describe('getSchemaEntries - Zod-like mock objects', () => {
  test('extracts entries from Zod-like shape', () => {
    const mockSchema = {
      '~standard': {
        version: 1 as const,
        vendor: 'zod',
        validate: () => ({ value: {} }),
      },
      shape: {
        name: {
          _def: { typeName: 'ZodString' },
        },
        count: {
          _def: { typeName: 'ZodNumber' },
        },
        active: {
          _def: { typeName: 'ZodBoolean' },
        },
      },
    }

    const entries = getSchemaEntries(mockSchema)

    expect(entries).toHaveLength(3)
    expect(entries[0]).toEqual({
      key: 'name',
      type: 'string',
      required: true,
      default: undefined,
      description: undefined,
    })
    expect(entries[1]).toEqual({
      key: 'count',
      type: 'number',
      required: true,
      default: undefined,
      description: undefined,
    })
    expect(entries[2]).toEqual({
      key: 'active',
      type: 'boolean',
      required: true,
      default: undefined,
      description: undefined,
    })
  })

  test('handles ZodOptional entries', () => {
    const mockSchema = {
      '~standard': {
        version: 1 as const,
        vendor: 'zod',
        validate: () => ({ value: {} }),
      },
      shape: {
        name: {
          _def: {
            typeName: 'ZodOptional',
            innerType: {
              _def: { typeName: 'ZodString' },
            },
          },
        },
      },
    }

    const entries = getSchemaEntries(mockSchema)

    expect(entries).toHaveLength(1)
    expect(entries[0].key).toBe('name')
    expect(entries[0].type).toBe('string')
    expect(entries[0].required).toBe(false)
  })

  test('handles ZodDefault entries', () => {
    const mockSchema = {
      '~standard': {
        version: 1 as const,
        vendor: 'zod',
        validate: () => ({ value: {} }),
      },
      shape: {
        verbose: {
          _def: {
            typeName: 'ZodDefault',
            defaultValue: false,
            innerType: {
              _def: { typeName: 'ZodBoolean' },
            },
          },
        },
      },
    }

    const entries = getSchemaEntries(mockSchema)

    expect(entries).toHaveLength(1)
    expect(entries[0].key).toBe('verbose')
    expect(entries[0].type).toBe('boolean')
    expect(entries[0].required).toBe(false)
    expect(entries[0].default).toBe(false)
  })

  test('handles ZodDefault with function default', () => {
    const mockSchema = {
      '~standard': {
        version: 1 as const,
        vendor: 'zod',
        validate: () => ({ value: {} }),
      },
      shape: {
        name: {
          _def: {
            typeName: 'ZodDefault',
            defaultValue: () => 'default-val',
            innerType: {
              _def: { typeName: 'ZodString' },
            },
          },
        },
      },
    }

    const entries = getSchemaEntries(mockSchema)

    expect(entries[0].default).toBe('default-val')
  })

  test('handles unknown Zod types', () => {
    const mockSchema = {
      '~standard': {
        version: 1 as const,
        vendor: 'zod',
        validate: () => ({ value: {} }),
      },
      shape: {
        data: {
          _def: { typeName: 'ZodUnknown' },
        },
      },
    }

    const entries = getSchemaEntries(mockSchema)

    expect(entries[0].type).toBe('unknown')
  })
})

describe('getSchemaEntries - edge cases', () => {
  test('handles valibot nullish wrapper', () => {
    const schema = v.object({
      name: v.nullish(v.string(), 'default-name'),
    })

    const entries = getSchemaEntries(schema)

    expect(entries).toHaveLength(1)
    expect(entries[0].required).toBe(false)
    expect(entries[0].default).toBe('default-name')
  })

  test('handles valibot optional with function default', () => {
    const schema = v.object({
      list: v.optional(v.string(), () => 'computed'),
    })

    const entries = getSchemaEntries(schema)

    expect(entries[0].default).toBe('computed')
  })
})
