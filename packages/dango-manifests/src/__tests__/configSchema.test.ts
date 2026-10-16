import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateConfig, type ConfigSchema } from '@mr-quin/dango'
import { describe, expect, it } from 'bun:test'

/**
 * Pins the display contract of every shipped manifest's configSchema: each
 * enum field carries a labelled option (oneOf const + title) for every value
 * it allows and nothing else, and every locales key names a string that
 * exists in the source manifest, so a translation never targets a typo or a
 * removed option.
 */

const here = dirname(fileURLToPath(import.meta.url))
const manifestsDir = join(here, '..', 'manifests')

type Json = Record<string, unknown>

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function loadManifests(): Json[] {
  return readdirSync(manifestsDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(manifestsDir, f), 'utf8')) as Json)
}

function collectEnumFields(node: unknown, path: string, out: [string, Json][]) {
  if (!isRecord(node)) return
  if (Array.isArray(node.enum)) out.push([path, node])
  if (isRecord(node.properties)) {
    for (const [key, child] of Object.entries(node.properties)) {
      collectEnumFields(child, `${path}.properties.${key}`, out)
    }
  }
  collectEnumFields(node.items, `${path}.items`, out)
}

function collectUrlFields(node: unknown, path: string, out: [string, Json][]) {
  if (!isRecord(node)) return
  if (isRecord(node.properties)) {
    for (const [key, child] of Object.entries(node.properties)) {
      const at = `${path}.properties.${key}`
      if (isRecord(child) && child.type === 'string' && /url|uri/i.test(key)) {
        out.push([at, child])
      }
      collectUrlFields(child, at, out)
    }
  }
  collectUrlFields(node.items, `${path}.items`, out)
}

function resolvePath(root: Json, path: string): unknown {
  let current: unknown = root
  for (const segment of path.split('.')) {
    if (Array.isArray(current)) {
      current = current[Number(segment)]
    } else if (isRecord(current)) {
      current = current[segment]
    } else {
      return undefined
    }
  }
  return current
}

describe('manifest configSchema display', () => {
  for (const manifest of loadManifests()) {
    describe(String(manifest.id), () => {
      it('labels every enum value through oneOf', () => {
        const fields: [string, Json][] = []
        collectEnumFields(manifest.configSchema, 'configSchema', fields)
        for (const [path, field] of fields) {
          const options = Array.isArray(field.oneOf) ? field.oneOf : []
          const consts = options.map((option) =>
            isRecord(option) ? option.const : undefined
          )
          expect({ path, consts: [...consts].sort() }).toEqual({
            path,
            consts: [...(field.enum as unknown[])].sort(),
          })
          for (const option of options) {
            expect(isRecord(option) && typeof option.title === 'string').toBe(
              true
            )
          }
        }
      })

      it('declares a URL format on every URL field', () => {
        const fields: [string, Json][] = []
        collectUrlFields(manifest.configSchema, 'configSchema', fields)
        for (const [path, field] of fields) {
          expect({ path, format: field.format }).toEqual({
            path,
            format: 'uri',
          })
        }
      })

      it('only translates strings the manifest has', () => {
        const locales = isRecord(manifest.locales) ? manifest.locales : {}
        for (const [tag, map] of Object.entries(locales)) {
          for (const key of Object.keys(isRecord(map) ? map : {})) {
            expect({
              tag,
              key,
              type: typeof resolvePath(manifest, key),
            }).toEqual({ tag, key, type: 'string' })
          }
        }
      })
    })
  }
})

describe('dandanplay baseUrl', () => {
  const dandanplay = loadManifests().find((m) => m.id === 'dandanplay')
  const schema = dandanplay?.configSchema as ConfigSchema

  function issues(baseUrl: string) {
    return validateConfig(schema, { baseUrl }).map((issue) => [
      issue.path.join('.'),
      issue.code,
    ])
  }

  it('accepts http and https servers', () => {
    expect(issues('https://api.example.com/ddp')).toEqual([])
    expect(issues('http://192.168.1.10:8000')).toEqual([])
  })

  it('rejects text that is not a URL', () => {
    expect(issues('not a url')).toEqual([['baseUrl', 'format']])
  })

  it.each(['ftp://files.example.com', 'javascript:alert(1)', 'file:///x'])(
    'rejects the scheme in %s',
    (baseUrl) => {
      expect(issues(baseUrl)).toEqual([['baseUrl', 'urlScheme']])
    }
  )
})
