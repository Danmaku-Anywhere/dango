# CLAUDE.md: Agent Guide for dango

## What this is

dango is a declarative danmaku source manifest engine. A source is described by a JSON manifest the engine interprets at runtime, so adding or fixing a source needs no per-source fetch code. It ships as two versioned libraries a host application consumes:

- `packages/dango` (`@mr-quin/dango`): the engine. Library-shippable: no `chrome.*`, `window`, DOM, or `node:` builtins. Runs in a browser, a service worker, or Node.
- `packages/dango-manifests` (`@mr-quin/dango-manifests`): the built-in manifests (JSON) plus their fixtures and per-source tests. Depends on the engine for tests only; the published package is data.

Each package has an `AGENTS.md` with its conventions and gotchas. Read it before working in that package.

## Specs and design docs

Do not commit spec, design, or planning documents to this repo, and do not include them in PRs. PRs carry only code, tests, and docs that ship with or describe the packages (`README`s, `AGENTS.md`, `CHANGELOG.md`).

## Toolchain

This repo is bun-first. Do not introduce pnpm, npm, yarn, vitest, biome, or prettier.

`bun test` resolves `@mr-quin/dango` from `dist`, so run `bun run build` before testing the manifests package (`bun run check` and CI do this for you).

## Code style

- No `any`. Use `unknown` and narrow.
- The engine must stay platform-agnostic: only standard web APIs (`fetch`, `Response`, `TextEncoder`, `crypto.subtle`, `DecompressionStream`). `tsconfig.build.json` sets `types: []` to keep ambient Node/Bun globals out of engine code; do not loosen it.
- Prefer fixing the code over disabling a lint rule, and say why when you do. The `perf` oxlint category stays off: `no-await-in-loop` conflicts with the engine's sequential pipeline execution.
- `import type` for type-only imports, `function` declarations for named and exported functions, `/** */` for multi-line comments, `//` for one-liners.
- No network in tests; time-dependent tests use `setSystemTime` from `bun:test`.
- Fixtures under `**/__tests__/fixtures/**` are captured upstream responses; keep them byte-stable.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org). Mark a breaking change with `!` after the type or scope, or a `BREAKING CHANGE:` footer.

## Versions and releases

Two axes: the npm `version` (engine semver) and the manifest `apiVersion` (`SUPPORTED_API_VERSIONS`). Adding optional manifest fields, helpers, or step types is non-breaking; bump `apiVersion` only on incompatible changes. `VERSIONING.md` is the source of truth, including the release procedure.
