# Automated tests

Use the Node.js version in [`.node-version`](../.node-version) and run
`npm run setup` from the repository root. Run `npm test` or its alias
`npm run test:quick` to execute the complete automated suite with two workers.

The runner discovers `*.test.ts` beneath `tests`, `packages`, `apps`, and `tools`.
It excludes dependencies and generated output. JavaScript test files fail
discovery so new automated tests cannot bypass the TypeScript requirement.
Automated tests and their shared helpers are included in strict compiler and lint checks.

For a focused run, use the shared test loader:

```sh
node --import ./tools/register-test-loader.ts --test tests/game-persistence.test.ts
```

The loader resolves test dependencies from the game application. Tests and
renderer code share the same Three.js instance. React rendering tests register
the TSX and browser-asset loader when they need it.

Use real domain objects in domain tests. Construct valid fixtures through public
factories. Check fixture presence before reading indexed or optional values.
Describe the behavior each test protects. Include refusal atomicity, stale
results, partial progress, identity, time, and save compatibility when the
change affects those contracts. Negative admission tests must make malformed
input explicit; do not hide it with an unchecked assertion.

The suite covers game and editor operations, saves, worker transport, lifecycle
cleanup, architecture boundaries, and published actor assets. Long campaign
route scripts are separate acceptance tools. The 31 October 2026 inventory contains
198 manual `.mjs` scripts and helpers that remain JavaScript. They are linted but
their implementations do not receive strict TypeScript checking. The
[migration inventory and proposed batches](../docs/plans/manual-test-typescript-migration.md)
track this remaining scope. Shared route helpers follow normal recruitment,
movement, time, and fight-or-withdraw rules.

Run `npm run verify:quick` before pushing. Run `npm run verify` for the production
build as well. A passing suite does not establish campaign completion, sustained
performance, or visual quality. Browser checks verify visible controls,
rendering, and file workflows. Record exact results and limits in dated evidence.
