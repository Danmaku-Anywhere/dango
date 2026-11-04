import { describe, expect, it } from 'bun:test'
import { loadManifest, parseManifest } from '../index.js'

const base = {
  apiVersion: 1,
  id: 'src',
  name: 'Source',
  version: '0.1.0',
  hosts: ['api.example.com'],
}

const commented = `{
  // line comment
  "apiVersion": 1,
  /* block
     comment */
  "id": "src",
  "name": "Source",
  "version": "0.1.0",
  "hosts": ["api.example.com",],
}`

describe('parseManifest', () => {
  it('accepts comments and trailing commas', () => {
    const result = parseManifest(commented)
    expect(result.status).toBe('ok')
    expect(result).toEqual(loadManifest(base))
  })

  it('reports a syntax error with its code and offset', () => {
    const result = parseManifest('{ "apiVersion": 1 "id": "src" }')
    expect(result).toEqual({
      status: 'malformed',
      issues: [{ path: '', message: 'CommaExpected at offset 18' }],
    })
  })

  it('reports schema failures like loadManifest', () => {
    const doc = { ...base, hosts: 'nope' }
    const result = parseManifest(`// bad hosts\n${JSON.stringify(doc)}`)
    expect(result.status).toBe('malformed')
    expect(result).toEqual(loadManifest(doc))
  })

  it('reports an unsupported apiVersion as incompatible', () => {
    expect(
      parseManifest('{ /* future */ "apiVersion": 2, "id": "src", }')
    ).toEqual({
      status: 'incompatible',
      incompatibility: { reason: 'api-version', apiVersion: 2 },
    })
  })

  it('loads every bundled manifest', async () => {
    const dir = new URL(
      '../../../dango-manifests/src/manifests/',
      import.meta.url
    )
    const names = [...new Bun.Glob('*.json').scanSync(dir.pathname)]
    expect(names.length).toBeGreaterThan(0)
    for (const name of names) {
      const text = await Bun.file(new URL(name, dir)).text()
      const result = parseManifest(text)
      expect({ name, status: result.status }).toEqual({ name, status: 'ok' })
    }
  })
})
