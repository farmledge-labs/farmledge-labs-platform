## Summary

Closes #5

Adds three pure formatter utilities to `apps/api/src/utils/formatters.ts`:

- `formatWeight(kg: number): string` — e.g. `4000` → `"4,000 kg"`
- `formatBags(bagCount: number, weightPerBagKg: number): string` — e.g. `(40, 100)` → `"40 × 100kg bags"`
- `formatCommodity(commodity: string): string` — e.g. `"MAIZE_WHITE"` → `"White Maize"` (falls back to title-cased rendering for unrecognized codes)

## Tests

6 unit tests (2 per function) added in `apps/api/tests/utils/formatters.test.ts`, using `node:test` / `node:assert/strict` to match the existing `tests/health.test.ts` convention.

```
npx tsc --noEmit   # passes
npm test           # 8/8 pass (2 existing health tests + 6 new)
```

## Note on repo layout

The issue body's tree diagram shows:

```
farmledge-platform/
└── src/
    └── utils/
        └── formatters.ts
```

This repo is a monorepo with no top-level `src/`; the API app's code lives under `apps/api/src/`. Files were placed at `apps/api/src/utils/formatters.ts` and `apps/api/tests/utils/formatters.test.ts` to match the actual structure and the existing `apps/api/tests/health.test.ts` convention, rather than introducing a new top-level `src/`.

## Additional fix

`apps/api/package.json`'s `test` script was `tsx --test tests/*.test.ts`. Under npm's POSIX `sh` script runner, this literal glob does not expand recursively (`**` globstar isn't reliably enabled), so test files added under `tests/utils/` (or any subdirectory) were silently never executed — `npm test` would report success while actually running zero of the nested tests.

Changed to `tsx --test`, which uses tsx's default recursive test-file discovery. Verified this still picks up the existing `tests/health.test.ts` as well as the new `tests/utils/formatters.test.ts` (8/8 tests pass) under both `bash` and plain `sh`.

## Constraints respected

- No external dependencies — `formatters.ts` uses only `Number.prototype.toLocaleString` and string methods from the JS standard library.
- No Express, database, or Stellar imports — functions are pure.
- All 3 functions exported as named exports.
