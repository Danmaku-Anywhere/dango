# Agent context: dango

The guide to this repo is [CLAUDE.md](CLAUDE.md); each package has its own `AGENTS.md` ([engine](packages/dango/AGENTS.md), [manifests](packages/dango-manifests/AGENTS.md)). This file holds what the guide does not: what counts as proof that a change works.

## Proof

Every change is proven by `bun run check` green, its output saved to a file and attached to the task. That is the CI gate (`.github/workflows/ci.yml` runs the same steps), so a PR whose check output is attached has already passed CI locally. On top of it, each kind of change needs its own evidence:

- **Engine change** (`packages/dango`): a test under `packages/dango/src/__tests__` that fails without the change and passes with it, named in the reply. New manifest surface (a field, an enum value, a step type, a helper) also needs its `ENGINE_FEATURES` entry; `engine-features.test.ts` failing is the sign it is missing, and the manifests `catalog.test.ts` then checks every manifest using it declares a matching `minEngineVersion`.
- **Manifest change** (`packages/dango-manifests/src/manifests`): the fixture captured from the real response (redacted only, never hand-written), the per-manifest test through `createContractRunner` green, and a live run against the upstream: `bun run health <id>` from the repo root, its output saved and attached, with the verdict `OK`. `bun run health` alone sweeps the whole catalog and is the proof for a change that touches every manifest. A `DRIFT`, `BROKEN` or `BLOCKED` verdict goes in the reply with the diagnostics the probe printed; it is not hidden behind the fixture test. `bun run smoke <source>` in the manifests package covers the DanDanPlay (needs `DDP_APP_ID` / `DDP_APP_SECRET`) and bilibili user-upload config paths the health probe does not. When the live run cannot happen from this machine (credentials, geo-block, anti-bot wall), attach what did run and say so plainly.
- **Fixture or test change** alone: `bun test` output, and the request that produced each new fixture named in the PR, so the next person can recapture it.
- **Release** (`bun run bump <version>`): `bun run check` green after the bump, since it covers the catalog check and the test pinning `ENGINE_VERSION` to `package.json`, plus the `CHANGELOG.md` entry. Pushing the `vX.Y.Z` tag publishes to npm through `.github/workflows/release.yml`, so prepare the bump and stop: the owner pushes tags.
- **Docs** (`README`s, `AGENTS.md`, `CHANGELOG.md`, `VERSIONING.md`): `bun run check` output is the whole proof; the format check covers Markdown.

This repo has no UI, so nothing here is proven by a screenshot. A change whose effect only shows in a host application (how danmaku render, how a source appears in a picker) is proven in that host's repository under its own contract; here it is proven by the row schemas in `packages/dango/src/manifest/output.ts` and the contract runner, which fail a pipeline that emits a shape a host would reject.
