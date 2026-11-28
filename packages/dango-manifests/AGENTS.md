# Agent context: packages/dango-manifests

## Purpose

Ships the JSON manifests that drive [@mr-quin/dango](../dango/AGENTS.md). One manifest per source. This package is data + tests + a manual live smoke; engine logic lives in dango.

## Layout

Manifests are `src/manifests/<source>.json`; the filename and `id` are the bare `<source>`. Tests and fixtures are in `src/__tests__/`. `scripts/smoke-test.ts` is a manual live test, not in CI. There is no `index.ts` and must not be one: an aggregate index forces every consumer to load every manifest. Consumers use the `./manifests/*` subpath export.

## URL strategy

Sources call their upstream API directly: point at the upstream host and list it in `hosts`. This package has no dependency on any host application's backend or proxy. Authenticated sources sign requests in-pipeline using config-supplied secrets (see DanDanPlay below), never a hosted credential service.

## DanDanPlay (`dandanplay`)

One manifest for the official API, a proxy, or a self-hosted server; `hosts: ['*']` because `baseUrl` is config. Each pipeline's first `assign` step resolves endpoint and auth into `prep.req`; read it in `src/manifests/dandanplay.json`. Auth modes are listed in README.md. `baseUrl`, `appId`, `appSecret`, `auth`, `chConvert` are optional config, so they are not in pipeline `inputs` (the engine requires every listed input present). There is no separate `ddp-compat` manifest.

## Bilibili (`bilibili`)

- Danmaku `protobuf` is the default variant; it decodes against `protoDescriptors.bili` (regenerate with `scripts/gen-proto-descriptors.ts` in dango-manifests). Past the last segment bilibili returns 304, opted into with `acceptStatus: [304]`.
- Modes 2 and 3 collapse to mode 1; modes outside `{1,4,5,6}` are dropped.
- User uploads: `configSchema.includeUserUploads` gates a third search through a `forEach` whose `in` is `[]` when off. UGC variants of `episodes` / `season` / `parseUrl` are selected by `$exists(bvid) and $not($exists(seasonId))`; the `seasonId` half matters because a pgc episode also carries a `bvid`. Season identity is the landed `bvid`, not the collection id. `urlMatch` claims `/video/BV...` pages regardless of the checkbox, since the host matches it before config is in scope.

## Tencent (`tencent`)

POST endpoints with JSON bodies. Episode pagination uses `forEach.breakOn`, so it runs sequentially. `content_style` is a JSON string; the color falls back to white when it is missing or unparseable.

## Mango (`mango`)

Search keeps `source=imgo` rows from `mediaRebirthV2` / `mediaRebirthV3` (plain `mediaRebirth` is aggregated third-party content), then appends the `clipMerge` block deduped. Upstream demotes every sibling season to `clipMerge`, so dropping that block loses older seasons. `clipMerge` rows carry only `clipId` / `title` / `img`.

## Youku (`youku`)

Signing uses `$millis`, so danmaku segment URLs are non-deterministic.

## iQIYI (`iqiyi`)

Search keeps only templates whose `pageUrl` is a real `/v_` watch page; the rest are cross-site redirect stubs.

## Aiyifan (`aiyifan`)

Every pipeline first fetches the `www.yfsp.tv` homepage and extracts the `pConfig` keys that sign each request.

## Bahamut (`bahamut`)

Search with simplified-Chinese keywords often misses. Episodes flatten all category groups, so a title with an alternate-version group yields each episode number once per group (distinct `videoSn`). That is the upstream shape, not a dedup bug.

## Maiduidui (`maiduidui`)

The search `type` label lives on the parent group; bind it (`$tn := typeName`) before descending into `vodList`.

## Sohu (`sohu`)

`t.c` is a decimal RGB string for most comments but a `#RRGGBB` hex string for some, so the manifest branches on a leading `#`. Treating every value as hex overflows past `0xFFFFFF`.

## CI and the engine

`dango-manifests` depends on `@mr-quin/dango` through `workspace:*`, which `bun install` symlinks to `packages/dango`, and the engine's `exports` point at `dist`. `.github/workflows/ci.yml` runs `bun run build` before `bun test`, so the manifests tests run against the engine built from the same checkout. The release workflow does the same on the tag, so every manifest in tag X is tested against engine X. `catalog.test.ts` also parses every manifest with that engine's `zManifest`, so no manifest in tag X declares a `minEngineVersion` above X. A host gates each catalog entry with `checkManifestCompatibility` rather than the whole catalog on `packageVersion`: a release also ships manifest fixes that older engines run fine.

When a manifest starts using an engine feature added after the oldest engine it should load on, set its `minEngineVersion` to the release that added the feature.

## Localization

Display strings (`name`, `configSchema` `title`/`description` at any depth, and `cookieSet.title`) are localized through an optional top-level `locales` block. Keys are BCP-47 locale tags, then the **dotted path** to the field; only strings that differ from the source language are listed.

```jsonc
"locales": {
  "zh-CN": {
    "name": "B站",
    "configSchema.properties.danmakuFormat.title": "弹幕格式",
    "cookieSet.title": "登录B站"
  }
}
```

Top-level fields stay the source / fallback language (English here), so a manifest with nothing to translate omits `locales` entirely. The engine resolves on demand via `getDisplayStrings(manifest, locale)` (narrows `zh-TW` → `zh`, falls back to the source value per key, ignores unknown keys). The execution path never reads `locales` — it is pure presentation data. All current manifests carry `zh-CN`; the catalog index still indexes the source-language `name` only.

## Conventions

- Manifests are raw JSON, not pre-parsed; consumers wrap with `zManifest.parse()`. Pre-parsing here would push a dango type dependency into the published package.
- Build test runners with `createContractRunner(manifestJson, { fetcher })` from `src/__tests__/contractRunner.ts`; it also checks every result against the engine's row schemas. Use exact URL match in the mock fetcher so silent query-string mismatches fail.
- Fixtures are captured responses, edited only to redact noise.

## Gotchas

- **URLs in manifests are JSONata expressions**, not raw strings. String literals must be wrapped in single quotes: `'https://...'`. Forgetting the quotes makes `https` look like a variable.
- **`$sortedQueryString` for canonical query strings.** Raw concat of user input into a query string breaks when the input contains `&`, `=`, or `?`. The helper URL-encodes each value; pair it with signing helpers for sign-then-send flows.
- **JSON imports need `with { type: 'json' }`** under NodeNext module mode.
- **No engine reimplementation here.** If a test fails because of dango behavior, fix dango.

## Adding a manifest

See "Adding a manifest" in `README.md`.
