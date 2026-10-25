# Working in this repo

## Docs first

`docs/` is the source of truth. Read `docs/concepts.md` first (the layers), then
`docs/video-analysis.md` (labels and thresholds) and `docs/reference.md` (the contract and the
examples). A behaviour change starts as a doc edit, then the tests, then the code. Where code and
docs disagree, the code is wrong. Keep doc edits short.

## The layers

- `src/blocks/` is Layer 1: the only code that runs ffmpeg or calls a network API. It knows
  nothing about short-form video. Its functions throw, with the stage first (`video:`, `decide:` …).
- `src/shortform/` is Layer 2: the short-form questions and their fallbacks. Pure functions.
- `src/pipeline/` is Layer 3. It imports only from `src/primitives.ts`, never from `blocks/` or
  `shortform/` directly, so `analyzeVideo` stays rebuildable from the public parts
  (`tests/compose.test.ts` checks both). It never throws: every failure is `{ ok: false, error }`.
- `shortform-breakdown` (src/index.ts) is stable; `shortform-breakdown/primitives` is experimental.
  A change to a `primitives` signature goes in CHANGELOG.md.

## Tests

Every change comes with a test that fails without it. `pnpm test` (builds, then vitest),
`pnpm typecheck` and `pnpm test:consumer` must pass. Tests never touch the network: inject
`fetch`, and make videos with ffmpeg `lavfi` (`tests/helpers.ts`). No API keys, and no video you
don't own, anywhere in the repo, tests, fixtures or history.

## Branches

Short-lived branches, small commits. Releases: bump `package.json` and CHANGELOG.md, tag `vX.Y.Z`;
`release.yml` publishes to npm.
