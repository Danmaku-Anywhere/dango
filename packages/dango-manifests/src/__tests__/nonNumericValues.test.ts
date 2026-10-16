import { describe, expect, it } from 'bun:test'
import builtinAiyifan from '../manifests/aiyifan.json' with { type: 'json' }
import builtinBahamut from '../manifests/bahamut.json' with { type: 'json' }
import builtinMaiduidui from '../manifests/maiduidui.json' with { type: 'json' }
import builtinMigu from '../manifests/migu.json' with { type: 'json' }
import builtinRenren from '../manifests/renren.json' with { type: 'json' }
import builtinSohu from '../manifests/sohu.json' with { type: 'json' }
import builtinYouku from '../manifests/youku.json' with { type: 'json' }
import { createContractRunner } from './contractRunner.js'
import aiyifanPlaylist from './fixtures/aiyifan-playlist.json' with { type: 'json' }
import aiyifanSearch from './fixtures/aiyifan-search.json' with { type: 'json' }
import bahamutVideo from './fixtures/bahamut-video.json' with { type: 'json' }
import maiduiduiSactions from './fixtures/maiduidui-sactions.json' with { type: 'json' }
import maiduiduiSearch from './fixtures/maiduidui-search.json' with { type: 'json' }
import miguSearch from './fixtures/migu-search.json' with { type: 'json' }
import renrenDetails from './fixtures/renren-details.json' with { type: 'json' }
import renrenSearch from './fixtures/renren-search.json' with { type: 'json' }
import sohuAlbum from './fixtures/sohu-album.json' with { type: 'json' }
import sohuSearch from './fixtures/sohu-search.json' with { type: 'json' }
import youkuEpisodes from './fixtures/youku-episodes.json' with { type: 'json' }
import { mockFetcher } from './mockFetcher.js'

/**
 * Upstreams send specials, blanks and placeholders where a number is expected.
 * `$number()` throws on those and takes the whole call down, so each manifest
 * must drop the field and keep the row.
 */

type Path = (string | number)[]

function withValue(fixture: unknown, path: Path, value: unknown): unknown {
  const copy = structuredClone(fixture) as Record<string | number, unknown>
  let node = copy
  for (const key of path.slice(0, -1)) {
    node = node[key] as Record<string | number, unknown>
  }
  node[path[path.length - 1]] = value
  return copy
}

const aiyifanHomepage = `<!doctype html><html><head><script>window.__NUXT__={"pConfig":{"publicKey":"CJSuC3GpDZSuDIumCZbVLLDVEJWkD3KkE34kCZ0vNpGtDpauCZHbDcCoOZGtEJ9YEJGuD3WtCZarDcCnDpLcNpXaE3PcDMKnOp1YPcKoCZatDJSvOJCtDMKuC3aqE68u","privateKey":["SuC3JSuC3GpDZSuDIumC","unused"]}}</script></head><body></body></html>`

describe('episode numbers that are not integers', () => {
  it.each(['SP', ''])('bahamut: episode %p has no number', async (episode) => {
    const video = withValue(
      bahamutVideo,
      ['data', 'anime', 'episodes', '0', 0, 'episode'],
      episode
    )
    const { fetcher } = mockFetcher({
      'https://api.gamer.com.tw/anime/v1/video.php': {
        body: JSON.stringify(video),
      },
    })
    const runner = createContractRunner(builtinBahamut, { fetcher })

    const result = (await runner.runEpisodes({ videoSn: '38250' })) as {
      indexedId: string
      episodeNumber?: number
    }[]

    expect(result).toHaveLength(4)
    expect(result[0].indexedId).toBe('38250')
    expect(result[0].episodeNumber).toBeUndefined()
    expect(result[1].episodeNumber).toBe(2)
  })

  it.each(['SP', ''])('youku: stage %p has no number', async (stage) => {
    const videos = withValue(youkuEpisodes, ['videos', 0, 'stage'], stage)
    const { fetcher } = mockFetcher({
      'https://openapi.youku.com/v2/shows/videos.json': {
        body: JSON.stringify(videos),
      },
    })
    const runner = createContractRunner(builtinYouku, { fetcher })

    const result = (await runner.runEpisodes({ showId: 'ya0123abc' })) as {
      indexedId: string
      episodeNumber?: number
    }[]

    expect(result).toHaveLength(2)
    expect(result[0].indexedId).toBe('vid_1')
    expect(result[0].episodeNumber).toBeUndefined()
    expect(result[1].episodeNumber).toBe(2)
  })

  it.each(['SP', ''])('renren: episodeNo %p has no number', async (value) => {
    const details = withValue(
      renrenDetails,
      ['data', 'episodeList', 0, 'episodeNo'],
      value
    )
    const { fetcher } = mockFetcher({
      'https://api.gorafie.com/qwtv/drama/details': {
        body: JSON.stringify(details),
      },
    })
    const runner = createContractRunner(builtinRenren, { fetcher })

    const result = (await runner.runEpisodes({ seriesId: '40906' })) as {
      indexedId: string
      episodeNumber?: number
    }[]

    expect(result).toHaveLength(2)
    expect(result[0].indexedId).toBe('297185')
    expect(result[0].episodeNumber).toBeUndefined()
    expect(result[1].episodeNumber).toBe(2)
  })

  it.each(['SP', ''])('aiyifan: id %p has no number', async (id) => {
    const playlist = withValue(
      aiyifanPlaylist,
      ['data', 'info', 0, 'playList', 0, 'id'],
      id
    )
    const { fetcher } = mockFetcher({
      'https://www.yfsp.tv/': { body: aiyifanHomepage },
      'https://m10.yfsp.tv/v3/video/languagesplaylist': {
        body: JSON.stringify(playlist),
      },
    })
    const runner = createContractRunner(builtinAiyifan, { fetcher })

    const result = (await runner.runEpisodes({ vid: 'WdzDFf5yws5' })) as {
      indexedId: string
      episodeNumber?: number
    }[]

    expect(result[0].indexedId).toBe('vE7hLqizOD0')
    expect(result[0].episodeNumber).toBeUndefined()
    expect(result[1].episodeNumber).toBe(986901)
  })

  it.each(['SP', ''])('maiduidui: sort %p has no number', async (sort) => {
    const sactions = withValue(maiduiduiSactions, ['data', 0, 'sort'], sort)
    const { fetcher } = mockFetcher({
      'https://mob.mddcloud.com.cn/api/vod/listVodSactions.action': {
        body: JSON.stringify(sactions),
      },
    })
    const runner = createContractRunner(builtinMaiduidui, { fetcher })

    const result = (await runner.runEpisodes({
      vodUuid: '35806b2aa5f811eeb2aee43d1ad5fd70',
    })) as { indexedId: string; episodeNumber?: number }[]

    expect(result).toHaveLength(2)
    expect(result[0].episodeNumber).toBeUndefined()
  })

  it('maiduidui: a blank duration falls back to 0', async () => {
    const sactions = withValue(maiduiduiSactions, ['data', 0, 'duration'], '')
    const { fetcher } = mockFetcher({
      'https://mob.mddcloud.com.cn/api/vod/listVodSactions.action': {
        body: JSON.stringify(sactions),
      },
    })
    const runner = createContractRunner(builtinMaiduidui, { fetcher })

    const result = (await runner.runEpisodes({
      vodUuid: '35806b2aa5f811eeb2aee43d1ad5fd70',
    })) as { providerIds: { durationSec: number } }[]

    expect(result[0].providerIds.durationSec).toBe(0)
    expect(result[1].providerIds.durationSec).toBe(2502)
  })

  it.each(['SP', ''])(
    'sohu: albumAbsoluteOrder %p has no number',
    async (order) => {
      const album = withValue(
        sohuAlbum,
        ['data', 'videos', 0, 'albumAbsoluteOrder'],
        order
      )
      const { fetcher } = mockFetcher({
        'https://api.tv.sohu.com/v4/album/videos/9434506.json': {
          body: JSON.stringify(album),
        },
      })
      const runner = createContractRunner(builtinSohu, { fetcher })

      const result = (await runner.runEpisodes({ aid: '9434506' })) as {
        indexedId: string
        episodeNumber?: number
      }[]

      expect(result).toHaveLength(2)
      expect(result[0].indexedId).toBe('4804013')
      expect(result[0].episodeNumber).toBeUndefined()
      expect(result[1].episodeNumber).toBe(2)
    }
  )
})

describe('years that are not integers', () => {
  it('renren: a placeholder year is dropped', async () => {
    const search = withValue(renrenSearch, ['data', 0, 'year'], 'N/A')
    const { fetcher } = mockFetcher({
      'https://api.gorafie.com/qwtv/search': { body: JSON.stringify(search) },
    })
    const runner = createContractRunner(builtinRenren, { fetcher })

    const result = (await runner.runSearch({ q: '黑暗荣耀' })) as {
      year?: number
    }[]

    expect(result[0].year).toBeUndefined()
    expect(result[1].year).toBe(2022)
  })

  it('aiyifan: an unparseable postTime drops the year', async () => {
    const search = withValue(
      aiyifanSearch,
      ['data', 'info', 0, 'result', 0, 'postTime'],
      '未知'
    )
    const { fetcher } = mockFetcher({
      'https://www.yfsp.tv/': { body: aiyifanHomepage },
      'https://rankv21.tripdata.app/v3/list/briefsearch': {
        body: JSON.stringify(search),
      },
    })
    const runner = createContractRunner(builtinAiyifan, { fetcher })

    const result = (await runner.runSearch({ q: '庆余年' })) as {
      indexedId: string
      year?: number
    }[]

    expect(result[0].indexedId).toBe('WdzDFf5yws5')
    expect(result[0].year).toBeUndefined()
  })

  it('maiduidui: a placeholder year is dropped', async () => {
    const search = withValue(
      maiduiduiSearch,
      ['data', 0, 'vodList', 0, 'year'],
      'N/A'
    )
    const { fetcher } = mockFetcher({
      'https://mob.mddcloud.com.cn/searchApi/search/getAllSearchResult4820.action':
        { body: JSON.stringify(search) },
    })
    const runner = createContractRunner(builtinMaiduidui, { fetcher })

    const result = (await runner.runSearch({ q: '黄金十年' })) as {
      title: string
      year?: number
    }[]

    expect(result[0].title).toBe('黄金十年')
    expect(result[0].year).toBeUndefined()
  })

  it('sohu: a placeholder year is dropped', async () => {
    const search = withValue(sohuSearch, ['data', 'items', 0, 'year'], 'N/A')
    const { fetcher } = mockFetcher({
      'https://m.so.tv.sohu.com/search/pc/keyword': {
        body: JSON.stringify(search),
      },
    })
    const runner = createContractRunner(builtinSohu, { fetcher })

    const result = (await runner.runSearch({ q: '法医秦明' })) as {
      indexedId: string
      year?: number
    }[]

    expect(result[0].indexedId).toBe('9434506')
    expect(result[0].year).toBeUndefined()
    expect(result[1].year).toBe(2016)
  })

  it.each([
    ['missing', undefined],
    ['null', null],
    ['blank', '   '],
    ['placeholder', '未知'],
  ])('migu: %s year is omitted, not null', async (_label, year) => {
    const search = withValue(
      miguSearch,
      ['body', 'contentInfoList', 0, 'shortMediaAsset', 'year'],
      year
    )
    const { fetcher } = mockFetcher({
      'https://jadeite.migu.cn/search/v3/open-search': {
        body: JSON.stringify(search),
      },
    })
    const runner = createContractRunner(builtinMigu, { fetcher })

    const result = (await runner.runSearch({ q: '示例' })) as {
      indexedId: string
      year?: number
    }[]

    expect(result[0].indexedId).toBe('600000010')
    expect(result[0]).not.toHaveProperty('year')
    expect(result[1].year).toBe(2023)
  })
})
