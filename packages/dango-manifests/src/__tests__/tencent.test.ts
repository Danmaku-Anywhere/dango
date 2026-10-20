import type { FetchLike } from '@mr-quin/dango'
import { zManifest } from '@mr-quin/dango'
import { describe, expect, it } from 'bun:test'
import builtinTencent from '../manifests/tencent.json' with { type: 'json' }
import { ContractRunner, createContractRunner } from './contractRunner.js'
import parseUrlDetails from './fixtures/tencent-parse-url-details.json' with { type: 'json' }
import parseUrlEpisodes from './fixtures/tencent-parse-url-episodes.json' with { type: 'json' }
import parseUrlNotFound from './fixtures/tencent-parse-url-notfound.json' with { type: 'json' }

const pageServerUrl =
  'https://pbaccess.video.qq.com/trpc.universal_backend_service.page_server_rpc.PageServer/GetPageData?video_appid=3000010&vversion_name=8.2.96&vversion_platform=2'

function pageServerHandler(details: unknown, episodes: unknown) {
  return (_url: string, init: unknown): MockResponse => {
    const { body } = init as { body: string }
    const pageId = JSON.parse(body).pageParams.page_id
    const payload = pageId === 'vsite_episode_list' ? episodes : details
    return { body: JSON.stringify(payload) }
  }
}

interface MockResponse {
  status?: number
  body: string
  headers?: Record<string, string>
}

function mockFetcher(
  handlers: Record<
    string,
    MockResponse | ((url: string, init: unknown) => MockResponse)
  >
): {
  fetcher: FetchLike
  calls: Array<{ url: string; init?: unknown }>
} {
  const calls: Array<{ url: string; init?: unknown }> = []
  const fetcher: FetchLike = async (input, init) => {
    calls.push({ url: input, init })
    let handler = handlers[input]
    if (handler === undefined) {
      const noQuery = input.split('?')[0]
      handler = handlers[noQuery]
    }
    if (handler === undefined) {
      throw new Error(`mockFetcher: no handler for ${input}`)
    }
    const resp = typeof handler === 'function' ? handler(input, init) : handler
    const headers = new Map<string, string>(Object.entries(resp.headers ?? {}))
    return {
      status: resp.status ?? 200,
      text: async () => {
        return resp.body
      },
      bytes: async () => {
        return new TextEncoder().encode(resp.body)
      },
      headers,
    }
  }
  return { fetcher, calls }
}

const searchFixture = {
  ret: 0,
  msg: '',
  data: {
    areaBoxList: [
      {
        boxId: 'MainNeed',
        itemList: [
          {
            doc: { dataType: 1, id: 'mzc00200qkxg2td' },
            videoInfo: {
              videoType: 2,
              typeName: '动漫',
              title: '葬送的芙莉莲',
              year: 2023,
              imgUrl: 'https://puui.qpic.cn/vcover/frieren.jpg',
              episodeSites: [{ showName: '正片', totalEpisode: 28 }],
            },
          },
          {
            // junk entry without episodeSites, should be filtered out
            doc: { dataType: 1, id: 'junk' },
            videoInfo: {
              videoType: 2,
              typeName: '其它',
              title: '不该出现',
              year: 2020,
              imgUrl: 'https://example.com/x.jpg',
              episodeSites: [],
            },
          },
        ],
      },
    ],
    normalList: { itemList: [] },
  },
}

function makeEpisodePage(start: number, count: number) {
  const items = []
  for (let i = 0; i < count; i++) {
    const n = start + i
    items.push({
      item_id: `id_${n}`,
      item_params: {
        vid: `vid_${n}`,
        cid: 'mzc00200qkxg2td',
        is_trailer: '0',
        play_title: `测试剧 第${n}话`,
        title: `${n}`,
        union_title: `测试剧_${n}`,
        image_url: `https://example.com/${n}.jpg`,
      },
    })
  }
  return {
    ret: 0,
    msg: '',
    data: {
      has_next_page: count === 100,
      module_list_datas: [
        {
          module_datas: [
            { module_id: 'main', item_data_lists: { item_datas: items } },
          ],
        },
      ],
    },
  }
}

// Tencent answers the first page for any page_context it does not
// recognize, and lists the page_context of every page in the first page's
// module_params.tabs. Only those contexts select a later page.
function pagedEpisodeList(total: number, trailers: number[] = []) {
  const pageCount = Math.ceil(total / 100)
  const tabs = Array.from({ length: pageCount }, (_, i) => ({
    begin: i * 100 + 1,
    end: Math.min(total, (i + 1) * 100),
    page_context: `cid=mzc00200qkxg2td&page_num=${i}&page_size=100&req_type=6`,
  }))
  return (_url: string, init: unknown): MockResponse => {
    const { body } = init as { body: string }
    const { page_id, page_context } = JSON.parse(body).pageParams
    if (page_id !== 'vsite_episode_list') {
      return { body: JSON.stringify(parseUrlDetails) }
    }
    const pageNum = Math.max(
      0,
      tabs.findIndex((tab) => tab.page_context === page_context)
    )
    const start = pageNum * 100 + 1
    const page = makeEpisodePage(start, Math.min(100, total - start + 1))
    const module = page.data.module_list_datas[0].module_datas[0]
    for (const item of module.item_data_lists.item_datas) {
      if (trailers.includes(Number(item.item_params.title))) {
        item.item_params.is_trailer = '1'
      }
    }
    if (pageCount > 1) {
      Object.assign(module, { module_params: { tabs: JSON.stringify(tabs) } })
    }
    return { body: JSON.stringify(page) }
  }
}

const danmakuBase = {
  segment_start: 0,
  segment_span: 30000,
  segment_index: {
    '0': { segment_start: 0, segment_name: '0' },
    '1': { segment_start: 30000, segment_name: '30000' },
  },
}

const danmakuSegment0 = {
  barrage_list: [
    {
      id: '101',
      content: 'hello tencent',
      time_offset: 5000,
      content_score: 0,
      content_style:
        '{"color":"FFFFFF","gradient_colors":["FFFFFF",""],"position":0}',
    },
    {
      id: '102',
      content: 'colored',
      time_offset: 12345,
      content_score: 0,
      content_style:
        '{"color":"FF0000","gradient_colors":["FF0000",""],"position":0}',
    },
  ],
}

const danmakuSegment1 = {
  barrage_list: [
    {
      id: '201',
      content: 'no style',
      time_offset: 35000,
      content_score: 0,
      content_style: '',
    },
  ],
}

describe('tencent manifest', () => {
  it('runs search, picks MainNeed box, filters episodeless items', async () => {
    const { fetcher, calls } = mockFetcher({
      'https://pbaccess.video.qq.com/trpc.videosearch.mobile_search.MultiTerminalSearch/MbSearch?vplatform=2':
        {
          body: JSON.stringify(searchFixture),
        },
    })
    const runner = createContractRunner(builtinTencent, {
      fetcher,
    })

    const result = await runner.runSearch({ q: 'frieren' })

    expect(result).toEqual([
      {
        providerIds: { cid: 'mzc00200qkxg2td' },
        indexedId: 'mzc00200qkxg2td',
        title: '葬送的芙莉莲',
        type: '动漫',
        typeDescription: '动漫',
        imageUrl: 'https://puui.qpic.cn/vcover/frieren.jpg',
        episodeCount: 28,
        year: 2023,
      },
    ])

    expect(calls).toHaveLength(1)
    const init = calls[0].init as {
      method?: string
      headers?: Record<string, string>
      body?: string
      rewriteHeaders?: Record<string, string>
    }
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(init.rewriteHeaders).toEqual({
      Origin: 'https://v.qq.com',
      Referer: 'https://v.qq.com/',
    })
    const body = JSON.parse(init.body ?? '{}')
    expect(body.query).toBe('frieren')
    expect(body.pagesize).toBe(30)
  })

  it('falls back to normalList when MainNeed box is absent', async () => {
    const noMainNeed = {
      ret: 0,
      msg: '',
      data: {
        areaBoxList: [
          {
            boxId: 'Other',
            itemList: [],
          },
        ],
        normalList: {
          itemList: [
            {
              doc: { dataType: 1, id: 'fallback-1' },
              videoInfo: {
                videoType: 2,
                typeName: '电影',
                title: 'Fallback Movie',
                year: 2024,
                imgUrl: 'https://example.com/fb.jpg',
                episodeSites: [{ showName: '正片', totalEpisode: 1 }],
              },
            },
          ],
        },
      },
    }
    const { fetcher } = mockFetcher({
      'https://pbaccess.video.qq.com/trpc.videosearch.mobile_search.MultiTerminalSearch/MbSearch?vplatform=2':
        {
          body: JSON.stringify(noMainNeed),
        },
    })
    const runner = createContractRunner(builtinTencent, {
      fetcher,
    })

    const result = (await runner.runSearch({ q: 'x' })) as Array<{
      providerIds: { cid: string }
    }>
    expect(result).toHaveLength(1)
    expect(result[0].providerIds.cid).toBe('fallback-1')
  })

  it('fetches every page Tencent lists in tabs', async () => {
    const { fetcher, calls } = mockFetcher({
      [pageServerUrl]: pagedEpisodeList(245),
    })
    const runner = createContractRunner(builtinTencent, { fetcher })

    const result = (await runner.runEpisodes({
      cid: 'mzc00200qkxg2td',
    })) as Array<{
      providerIds: { vid: string }
      title: string
      episodeNumber: number
      alternativeTitle?: string[]
    }>

    expect(calls).toHaveLength(3)
    expect(result.map((ep) => ep.providerIds.vid)).toEqual(
      Array.from({ length: 245 }, (_, i) => `vid_${i + 1}`)
    )
    expect(result[0].title).toBe('测试剧 第1话')
    expect(result[0].episodeNumber).toBe(1)
    expect(result[0].alternativeTitle).toEqual(['测试剧_1'])
  })

  it('returns items past the first 100 without repeating any', async () => {
    const { fetcher, calls } = mockFetcher({
      [pageServerUrl]: pagedEpisodeList(119),
    })
    const runner = createContractRunner(builtinTencent, { fetcher })

    const result = (await runner.runEpisodes({
      cid: 'mzc00200qkxg2td',
    })) as Array<{ providerIds: { vid: string } }>

    expect(calls).toHaveLength(2)
    expect(result.map((ep) => ep.providerIds.vid)).toEqual(
      Array.from({ length: 119 }, (_, i) => `vid_${i + 1}`)
    )
  })

  it('drops trailers from every page', async () => {
    const { fetcher, calls } = mockFetcher({
      [pageServerUrl]: pagedEpisodeList(150, [50]),
    })
    const runner = createContractRunner(builtinTencent, { fetcher })

    const result = (await runner.runEpisodes({
      cid: 'mzc00200qkxg2td',
    })) as Array<{ providerIds: { vid: string } }>

    expect(calls).toHaveLength(2)
    expect(result).toHaveLength(149)
    expect(result.map((ep) => ep.providerIds.vid)).not.toContain('vid_50')
    expect(result.at(-1)?.providerIds.vid).toBe('vid_150')
  })

  it('lists each item once when a tab answers with the first page again', async () => {
    const page = makeEpisodePage(1, 3)
    Object.assign(page.data.module_list_datas[0].module_datas[0], {
      module_params: {
        tabs: JSON.stringify([{ page_context: 'a' }, { page_context: '' }]),
      },
    })
    const { fetcher } = mockFetcher({
      [pageServerUrl]: { body: JSON.stringify(page) },
    })
    const runner = createContractRunner(builtinTencent, { fetcher })

    const result = (await runner.runEpisodes({
      cid: 'mzc00200qkxg2td',
    })) as Array<{ providerIds: { vid: string } }>

    expect(result.map((ep) => ep.providerIds.vid)).toEqual([
      'vid_1',
      'vid_2',
      'vid_3',
    ])
  })

  it('keeps an item that has no is_trailer field', async () => {
    const page = makeEpisodePage(1, 2)
    const items = page.data.module_list_datas[0].module_datas[0].item_data_lists
      .item_datas as Array<{ item_params: Record<string, unknown> }>
    delete items[0].item_params.is_trailer
    const { fetcher } = mockFetcher({
      [pageServerUrl]: { body: JSON.stringify(page) },
    })
    const runner = createContractRunner(builtinTencent, { fetcher })

    const result = (await runner.runEpisodes({
      cid: 'mzc00200qkxg2td',
    })) as Array<{ providerIds: { vid: string } }>

    expect(result.map((ep) => ep.providerIds.vid)).toEqual(['vid_1', 'vid_2'])
  })

  it.each([28, 100])(
    'makes one request for a list of %p items, which has no tabs',
    async (total) => {
      const { fetcher, calls } = mockFetcher({
        [pageServerUrl]: pagedEpisodeList(total),
      })
      const runner = createContractRunner(builtinTencent, { fetcher })

      const result = (await runner.runEpisodes({
        cid: 'mzc00200qkxg2td',
      })) as unknown[]

      expect(calls).toHaveLength(1)
      expect(result).toHaveLength(total)
    }
  )

  it('runs the two-phase danmaku flow and emits {p, m} CommentEntity rows', async () => {
    const vid = 'vid_42'
    const { fetcher, calls } = mockFetcher({
      [`https://dm.video.qq.com/barrage/base/${vid}`]: {
        body: JSON.stringify(danmakuBase),
      },
      [`https://dm.video.qq.com/barrage/segment/${vid}/0`]: {
        body: JSON.stringify(danmakuSegment0),
      },
      [`https://dm.video.qq.com/barrage/segment/${vid}/30000`]: {
        body: JSON.stringify(danmakuSegment1),
      },
    })
    const runner = createContractRunner(builtinTencent, {
      fetcher,
    })

    const result = (await runner.runDanmaku({ vid })) as Array<{
      p: string
      m: string
    }>

    // p is `${seconds},${rtl=1},${colorInt}`. Tencent has no userHash;
    // color resolves via gradient_colors[0] (preferred) or color, default white.
    expect(result).toEqual([
      { p: '5,1,16777215,', m: 'hello tencent' },
      { p: '12.345,1,16711680,', m: 'colored' },
      { p: '35,1,16777215,', m: 'no style' },
    ])
    expect(calls).toHaveLength(3)
  })

  it('per-row map output is byte-identical to the whole-array projection form', async () => {
    const vid = 'vid_42'
    const handlers = {
      [`https://dm.video.qq.com/barrage/base/${vid}`]: {
        body: JSON.stringify(danmakuBase),
      },
      [`https://dm.video.qq.com/barrage/segment/${vid}/0`]: {
        body: JSON.stringify(danmakuSegment0),
      },
      [`https://dm.video.qq.com/barrage/segment/${vid}/30000`]: {
        body: JSON.stringify(danmakuSegment1),
      },
    }

    const parsed = zManifest.parse(builtinTencent)
    const danmakuVariants = parsed.danmaku
    if (danmakuVariants === undefined) {
      throw new Error('tencent manifest is missing a danmaku pipeline')
    }
    const variant = danmakuVariants[0]
    if (variant.map === undefined) {
      throw new Error('expected tencent danmaku pipeline to use a map step')
    }

    // Reconstruct the pre-DA-477 form: fold the per-row map back into the
    // output as a whole-array projection. Both must produce identical bytes.
    const projectionManifest = zManifest.parse({
      ...builtinTencent,
      danmaku: {
        inputs: variant.inputs,
        steps: variant.steps,
        output: `[segments.(${variant.map})]`,
      },
    })

    const mapResult = await new ContractRunner(parsed, {
      fetcher: mockFetcher(handlers).fetcher,
    }).runDanmaku({ vid })
    const projectionResult = await new ContractRunner(projectionManifest, {
      fetcher: mockFetcher(handlers).fetcher,
    }).runDanmaku({ vid })

    expect(mapResult).toEqual(projectionResult)
  })

  it('parseUrl resolves a cover URL to the season and the matching episode', async () => {
    const { fetcher, calls } = mockFetcher({
      [pageServerUrl]: pageServerHandler(parseUrlDetails, parseUrlEpisodes),
    })
    const runner = createContractRunner(builtinTencent, { fetcher })

    const result = await runner.runParseUrl(
      'https://v.qq.com/x/cover/mzc00200wo6sr9q/l4100oh6xb3.html'
    )

    expect(calls).toHaveLength(2)
    expect(result).toEqual({
      seasonInsert: {
        providerIds: { cid: 'mzc00200wo6sr9q' },
        indexedId: 'mzc00200wo6sr9q',
        title: '葬送的芙莉莲 第1季[日语版]',
        type: '1',
        imageUrl:
          'https://vcover-vt-pic.puui.qpic.cn/vcover_vt_pic/0/mzc00200wo6sr9q1720582916067/0',
        episodeCount: 28,
      },
      episodeMeta: {
        providerIds: { vid: 'l4100oh6xb3' },
        indexedId: 'l4100oh6xb3',
        title: '葬送的芙莉莲 第1季[日语版] 第01话',
        episodeNumber: 1,
        alternativeTitle: ['葬送的芙莉莲_01'],
        imageUrl:
          'https://vpic-cover.puui.qpic.cn/l4100oh6xb3/l4100oh6xb3_1720661556_hz.jpg/496',
      },
    })
  })

  it.each(['', 'N/A'])(
    'parseUrl omits episodeCount when episode_all is %p',
    async (episodeAll) => {
      const details = structuredClone(parseUrlDetails)
      details.data.module_list_datas[0].module_datas[0].item_data_lists.item_datas[0].item_params.episode_all =
        episodeAll
      const { fetcher } = mockFetcher({
        [pageServerUrl]: pageServerHandler(details, parseUrlEpisodes),
      })
      const runner = createContractRunner(builtinTencent, { fetcher })

      const result = (await runner.runParseUrl(
        'https://v.qq.com/x/cover/mzc00200wo6sr9q/l4100oh6xb3.html'
      )) as { seasonInsert: Record<string, unknown> } | null

      expect(result?.seasonInsert.title).toBe('葬送的芙莉莲 第1季[日语版]')
      expect(result?.seasonInsert).not.toHaveProperty('episodeCount')
    }
  )

  it('parseUrl yields no result for a cid Tencent does not know', async () => {
    const { fetcher } = mockFetcher({
      [pageServerUrl]: pageServerHandler(parseUrlNotFound, {
        ret: 0,
        msg: '',
      }),
    })
    const runner = createContractRunner(builtinTencent, { fetcher })

    const result = await runner.runParseUrl(
      'https://v.qq.com/x/cover/mzc00200zzzzzzz/a0000000000.html'
    )

    expect(result ?? undefined).toBeUndefined()
  })

  it.each([
    ['vid_5', 5],
    ['vid_105', 105],
  ])('parseUrl finds %s in a 119-item episode list', async (vid, n) => {
    const { fetcher } = mockFetcher({
      [pageServerUrl]: pagedEpisodeList(119),
    })
    const runner = createContractRunner(builtinTencent, { fetcher })

    const result = (await runner.runParseUrl(
      `https://v.qq.com/x/cover/mzc00200wo6sr9q/${vid}.html`
    )) as { episodeMeta?: { indexedId: string; episodeNumber: number } }

    expect(result.episodeMeta).toMatchObject({
      indexedId: vid,
      episodeNumber: n,
    })
  })

  it('loginProbe returns true when the details endpoint succeeds', async () => {
    const { fetcher, calls } = mockFetcher({
      'https://pbaccess.video.qq.com/trpc.universal_backend_service.page_server_rpc.PageServer/GetPageData?video_appid=3000010&vversion_name=8.2.96&vversion_platform=2':
        {
          body: JSON.stringify({
            ret: 0,
            msg: '',
            data: { module_list_datas: [] },
          }),
        },
    })
    const runner = createContractRunner(builtinTencent, {
      fetcher,
    })

    expect(runner.hasLoginProbe()).toBe(true)
    expect(await runner.runLoginProbe<boolean>()).toBe(true)

    expect(calls).toHaveLength(1)
    const init = calls[0].init as {
      method?: string
      rewriteHeaders?: Record<string, string>
    }
    expect(init.method).toBe('POST')
    expect(init.rewriteHeaders).toEqual({
      Origin: 'https://v.qq.com',
      Referer: 'https://v.qq.com/',
    })
  })

  it('loginProbe returns false when the details endpoint reports ret != 0', async () => {
    const { fetcher } = mockFetcher({
      'https://pbaccess.video.qq.com/trpc.universal_backend_service.page_server_rpc.PageServer/GetPageData?video_appid=3000010&vversion_name=8.2.96&vversion_platform=2':
        { body: JSON.stringify({ ret: -1100001, msg: 'need login' }) },
    })
    const runner = createContractRunner(builtinTencent, {
      fetcher,
    })

    expect(await runner.runLoginProbe<boolean>()).toBe(false)
  })

  it('color resolution handles missing gradient_colors, leading #, and broken JSON', async () => {
    const vid = 'vid_color'
    const segment = {
      barrage_list: [
        // color-only (no gradient_colors)
        {
          id: '1',
          content: 'green',
          time_offset: 1000,
          content_style: '{"color":"00FF00","position":0}',
        },
        // defensive: leading # in color hex
        {
          id: '2',
          content: 'hashed',
          time_offset: 2000,
          content_style: '{"color":"#FFFFFF","position":0}',
        },
        // broken JSON falls through to white
        {
          id: '3',
          content: 'broken',
          time_offset: 3000,
          content_style: 'not json',
        },
        // missing content_style entirely
        { id: '4', content: 'absent', time_offset: 4000 },
      ],
    }
    const { fetcher } = mockFetcher({
      [`https://dm.video.qq.com/barrage/base/${vid}`]: {
        body: JSON.stringify({
          segment_index: { '0': { segment_start: 0, segment_name: '0' } },
        }),
      },
      [`https://dm.video.qq.com/barrage/segment/${vid}/0`]: {
        body: JSON.stringify(segment),
      },
    })
    const runner = createContractRunner(builtinTencent, {
      fetcher,
    })

    const result = (await runner.runDanmaku({ vid })) as Array<{
      p: string
      m: string
    }>

    expect(result).toEqual([
      { p: '1,1,65280,', m: 'green' },
      { p: '2,1,16777215,', m: 'hashed' },
      { p: '3,1,16777215,', m: 'broken' },
      { p: '4,1,16777215,', m: 'absent' },
    ])
  })
})
