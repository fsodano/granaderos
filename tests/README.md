# Game and architecture tests

Install dependencies with `npm ci --prefix web` and
`npm ci --prefix campaign-editor`. Run `npm test` or its alias
`npm run test:quick` from the repository root. The runner uses two workers.

The runner discovers `tests/*.test.mjs`, domain/application/infrastructure
`*.test.ts` and `*.test.mjs`, and the editor and campaign-format test folders.
Domain tests use real objects without React, a browser, or actual storage.
Integration checks cover recruitment, squad formation, journey decisions,
sector and combat operations, item custody, world time, saves, worker admission,
autosave ownership, queries, and editor boundaries.

Changed behavior has direct acceptance tests: immediate recruitment, zero-time
and one-minute withdrawal reversals, exact arrival pauses, shared visible and
inactive world effects, corpse removal, and supported save migrations. Tests
also protect refusal atomicity and paid partial progress.

Run `npm run check:architecture`, `npm run check:format`, and `npm run typecheck`
with the suite. `npm run build` verifies the game and separate editor export.
For a focused check, run `node --test` with the affected test file paths.

Long campaign-route scripts are explicit acceptance tools. Their shared helpers
use the same recruitment and fight-or-withdraw rules as the game. The standard
suite checks those helper contracts without automatically playing every route.
Browser checks verify visible controls, rendering, and file workflows.

A passing suite does not establish complete campaign acceptance, sustained
performance, or visual quality. Record the exact checks and their limits in a
dated verification document.
