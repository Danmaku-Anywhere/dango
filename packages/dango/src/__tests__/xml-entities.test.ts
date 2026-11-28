import { describe, expect, it } from 'bun:test'
import { ManifestRunner } from '../engine/ManifestRunner.js'
import { zManifest } from '../manifest/schema.js'
import { mockFetcher } from './fixtures.js'

/**
 * XML responses decode the five predefined entities and every numeric
 * character reference, in text and in attributes, so danmaku such as
 * "It&#39;s" reaches consumers as "It's". HTML named entities stay as written.
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

  it('decodes numeric references outside the BMP', async () => {
    const { fetcher } = mockFetcher({
      'https://api.example.com/dm.xml': {
        body: '<i><d p="&#x1F38A;">party&#127882;</d></i>',
      },
    })
    const runner = new ManifestRunner(manifest, { fetcher })

    const result = await runner.runDanmaku({ cid: 1 })

    expect(result).toEqual([{ p: '\u{1F38A}', m: 'party\u{1F38A}' }])
  })

  it('decodes an escaped reference only once', async () => {
    const { fetcher } = mockFetcher({
      'https://api.example.com/dm.xml': {
        body: '<i><d p="&amp;lt;">&amp;#39; &amp;amp;</d></i>',
      },
    })
    const runner = new ManifestRunner(manifest, { fetcher })

    const result = await runner.runDanmaku({ cid: 1 })

    expect(result).toEqual([{ p: '&lt;', m: '&#39; &amp;' }])
  })

  it('does not carry an XML 1.1 declaration into the next response', async () => {
    const bodies = [
      '<?xml version="1.1"?><i><d p="1">a&#1;b</d></i>',
      '<i><d p="1">a&#1;b</d></i>',
    ]
    let call = 0
    const { fetcher } = mockFetcher({
      'https://api.example.com/dm.xml': () => ({ body: bodies[call++] }),
    })
    const runner = new ManifestRunner(manifest, { fetcher })

    const first = await runner.runDanmaku({ cid: 1 })
    const second = await runner.runDanmaku({ cid: 1 })

    expect(first).toEqual([{ p: '1', m: 'a\u0001b' }])
    expect(second).toEqual([{ p: '1', m: 'ab' }])
  })

  it('leaves HTML named entities as written', async () => {
    const { fetcher } = mockFetcher({
      'https://api.example.com/dm.xml': {
        body: '<i><d p="&copy;">a&nbsp;b &copy; &yen;</d></i>',
      },
    })
    const runner = new ManifestRunner(manifest, { fetcher })

    const result = await runner.runDanmaku({ cid: 1 })

    expect(result).toEqual([{ p: '&copy;', m: 'a&nbsp;b &copy; &yen;' }])
  })
})
