# Agent context: packages/dango

Declarative danmaku source manifest engine: JSON manifests interpreted at runtime instead of per-source TypeScript. Library-shippable, no host-runtime assumptions. See `README.md` for the trust model and what the guards are.

## Trust model

Manifests are trusted code and dango is not a sandbox; the guards are listed in `README.md`. The request-time private-host block is off by default. A host lifts it per run with `RunOptions.allowPrivateHosts` for a deliberately user-authorized local endpoint, and the hosts allowlist still applies. Rejections throw `HostNotAllowedError` with a localizable `code` (`'host-not-allowed'` | `'private-host-blocked'`).

## Files

- `src/manifest/schema.ts`: zod schema. Source of truth for what is allowed in a manifest.
- `src/engine/proto.ts`: `ProtoRegistry`. Each `ManifestRunner` owns one; a base64 `FileDescriptorSet` from `protoDescriptors` decodes into a `FileRegistry` on first use, then caches.

## Gotchas

- **Every templated value is a JSONata expression**, not a string template. `"url": "https://api.example.com"` would evaluate `https` as a variable, wrap string literals: `"url": "'https://api.example.com'"`.
- **JSONata sequence flag**: array-projection results sometimes carry a `sequence: true` property. `normalize()` in `jsonata-eval.ts` strips it so test `toEqual` is stable.
- **Singleton-unwrap**: JSONata unwraps single-element projection results. Wrap the expression in `[...]` to force an array. This bites intermediate values as much as `output`: an `extract` or `assign` feeding `forEach.in` throws `forEach.in must evaluate to an array` the day upstream returns exactly one row.
- **Pipeline `map`** (optional) applies a per-row JSONata expression to each element of the array `output` produces, with the element as `$`. `output: '[rows]'` + `map: 'expr'` equals `output: '[rows.(expr)]'` but avoids one large projection on big danmaku sets. `output` must evaluate to an array. `tencent`'s danmaku pipeline uses it.
- **`Referer` / `User-Agent` / `Origin` go in `rewriteHeaders`, not `headers`**: browser fetch silently drops them when set normally. The host applies them via DNR. Manifests setting them in `headers` are rejected at runtime.
- **Header rewriting is host-side.** The engine only hands `rewriteHeaders` to `FetchLike.init`; the host decides how to apply them.
- **`request.headers`** is either a static `{ Name: expr }` record or one expression that evaluates to a `{ Name: value }` object. Use the latter for dynamic names (user-supplied auth headers in `dandanplay`).
- **`request.acceptStatus`** lists extra HTTP statuses to parse as success (2xx is always accepted). `bilibili`'s protobuf segment loop uses it because bilibili returns `304` for "no more data".
- **`forEach.breakOn`** stops the loop early; sequential only (the schema rejects it with `concurrency > 1`). Truthy stops after including the current iteration. `tencent`'s episodes pipeline uses it for cursor pagination.
- **`forEach` failure handling** is a host policy, not a manifest field. By default the first failure cancels in-flight siblings and rejects; the `continueOnError` RunOption skips failed iterations and returns partial results. A genuine abort always propagates.
- **Protobuf descriptors** are generated from `.proto` via `dango-manifests/scripts/gen-proto-descriptors.ts`.
- **Identity is the host's concern.** The engine and the manifests say nothing about which configuration a season belongs to. `zManifest` strips unknown keys, so an older manifest that still carries `identityFields` parses and the key is dropped.
- **`minEngineVersion` gates additive features.** Unknown keys are stripped, so a manifest using a newer optional field would load on an older engine and run wrong. See `VERSIONING.md`. `src/version.ts` holds `ENGINE_VERSION`; `bun run bump` rewrites it and a test pins it to `package.json`.
- **New surface needs an `ENGINE_FEATURES` entry.** Adding a manifest field at any depth, an enum value, a step type or a helper fails `engine-features.test.ts` until `src/manifest/features.ts` lists it with the release that ships it: the release part of the `-dev` version main carries. Manifests that use it must then declare at least that release as `minEngineVersion`; the manifests catalog test computes the floor and checks it. While main is `0.10.0-dev`, surface for 0.10.0 itself goes into the baseline list in that test instead.
- **Output rows are a contract.** Rows are loose objects (extra fields pass through) with a string `indexedId`, a string `title` and an object `providerIds`; URLs are plain strings. A pipeline that emits `year: null` or a numeric `indexedId` fails the schema, so omit the key or wrap the value in `$string(...)`. Changing a required field is a breaking change for every host.
- **Request failures are typed.** `executeRequest` throws `HttpStatusError`, `NetworkError` (host error as `cause`) or `AbortedError` (signal reason as `cause`); hosts classify with `instanceof`, so keep the classes exported from the package root.

## Helpers

`src/helpers/registry.ts` is the closed namespace callable from JSONata as `$<name>`. Adding a helper requires an engine release; manifests cannot register their own.
