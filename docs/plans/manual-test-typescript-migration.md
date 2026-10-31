# Manual acceptance tools: TypeScript migration

Status: active migration; remaining work batches. Inventory date: 31 October 2026.

[Test guide](../../tests/README.md) · [Complete file inventory](manual-test-typescript-inventory.json)

The automated test suite and its shared helpers use TypeScript. The `tests/`
directory also contains 210 manual acceptance scripts and supporting JavaScript
modules, with 92,973 source lines. These files are linted. Their implementations
do not receive strict TypeScript checking. None has the automated `.test.mjs`
suffix, and the inspected TypeScript source does not import these modules.

The inventory records every remaining file once, with proposed work groups.
Counts describe the recorded source revision. Update the inventory as each
group is migrated; completed automated tests must remain in the normal suite.

## Work groups

Start with shared dependencies, then migrate their consumers. Each review slice
should normally contain at most 20 small files or approximately 4,000 existing
source lines. A large route can need its own slice. These are review targets,
not reasons to omit required contracts or checks.

| Group | Files | Source lines | Suggested review slices |
| --- | ---: | ---: | --- |
| Fixture builders and instrumentation | 52 | 7,716 | 3–5 slices, grouped by equipment, personnel, rendering, and authored content |
| Tactical controllers | 23 | 5,466 | 3 slices, with shared controller inputs and results first |
| Shared route utilities | 17 | 4,132 | 2–3 slices for equipment, supplies, and progress reporting |
| Opening and coastal acceptance | 16 | 4,730 | 2 slices after their shared utilities |
| Cuyo and mountain acceptance | 18 | 18,824 | 5–7 slices; separate the shared order functions first |
| Northern and medical acceptance | 48 | 37,148 | 10–13 slices; use the actual care, travel, and supply contracts |
| Capital, ending and remaining logistics acceptance | 36 | 14,957 | 4–6 slices after their route dependencies |
| **Total** | **210** | **92,973** | |

The dependency scan found 93 files with no imports of another remaining manual
module, totaling 15,006 lines. These are the first candidates for parallel work.
Shared modules with many consumers include `route-owned-equipment.mjs` (25),
`route-infantry-progress.mjs` (20), `route-dressings.mjs` (18), and
`route-battery.mjs` (17). Migrate these contracts before the long route scripts.

## Dependency blockers

Two circular groups need a small separation of genuinely shared functions before
their route consumers can be migrated in independent slices:

- Seven files, 11,611 lines: `fresh-northern-fixture`, `fresh-northern-command`,
  `stock-cuyo-battery-defense`, `route-stable-local-rest`, `created-cuyo-route`,
  `foundry-convoy-recapture`, and `fresh-cuyo-route`.
- Four files, 5,095 lines: `salta-hospital-encounter`, `recovery-road-route`,
  `fresh-northern-recovery`, and `coordinated-hospital-battery`.

All names above refer to `.mjs` files in `tests/`. For example, shared order
functions in `fresh-cuyo-route` are imported by route helpers that this same
file imports. Move the shared implementation to a focused typed helper, then
migrate each caller. Do not add declaration files that leave these bodies
unchecked.

Other recurring work includes concrete callback and report-event types,
admission of JSON inventory receipts, optional person and equipment records,
and controller results that distinguish a refused order from accepted progress.
The largest files contain approximately 3,200–4,300 lines and combine several
route stages. Preserve real game time, casualties, finite supplies, service
terms, identity, and save checks while separating those stages.

## Completion checks

For each slice, update source imports and current execution instructions to
`.ts`. Preserve paths inside dated evidence and source manifests. Include every
new module in the strict project, with no `any`, unchecked assertions, or
declaration-only compatibility wrapper. Reuse existing game contracts and
validated fixture factories where their behavior matches.

Run strict types, lint, dependency rules, affected automated tests, and the
bounded manual acceptance command that exercises the changed route stage.
Record the tested stage and any remaining route limits. A typed file or a short
route segment does not establish complete campaign acceptance.

Migration is complete when this inventory has no remaining JavaScript source
and all retained commands run through the same checked implementations.
