import { describe, expect, it } from 'bun:test'
import { ManifestRunner } from '../engine/ManifestRunner.js'
import { zManifest } from '../manifest/schema.js'
import { mockFetcher } from './fixtures.js'

/**
 * XML responses decode the predefined entities in both their named and
 * numeric forms, in text and in attributes, so danmaku such as "It&#39;s"
 * reaches consumers as "It's". Other character references stay as written.
 */

const manifest = zManifest.parse({
  apiVersion: 1,
  id: 'xml',
  name: 'XML',
  version: '0.1.0',
  hosts: ['api.example.com'],
  danmaku: {
    inputs: ['cid'],
    steps: [
      {
        type: 'http',
        id: 'res',
        request: { url: "'https://api.example.com/dm.xml'", format: 'xml' },
      },
    ],
    output: "[res.i.d.{ 'p': `@_p`, 'm': `#text` }]",
  },
})

describe('xml entity decoding', () => {
  it('decodes named and numeric forms of the predefined entities', async () => {
    const { fetcher } = mockFetcher({
      'https://api.example.com/dm.xml': {
        body: '<i><d p="1,&#34;a&#39;&quot;">It&#39;s &#60;3 &#38; &#x27;hi&#x27; &lt;ok&gt; &amp; &quot;q&quot;</d></i>',
      },
    })
    const runner = new ManifestRunner(manifest, { fetcher })

    const result = await runner.runDanmaku({ cid: 1 })

    expect(result).toEqual([{ p: '1,"a\'"', m: "It's <3 & 'hi' <ok> & \"q\"" }])
  })

  it('leaves other character references as written', async () => {
    const { fetcher } = mockFetcher({
      'https://api.example.com/dm.xml': {
        body: '<i><d p="1">party&#127882;</d></i>',
      },
    })
    const runner = new ManifestRunner(manifest, { fetcher })

    const result = await runner.runDanmaku({ cid: 1 })

    expect(result).toEqual([{ p: '1', m: 'party&#127882;' }])
  })
})
