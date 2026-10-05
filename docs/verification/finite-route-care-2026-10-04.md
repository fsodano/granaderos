# Finite route care and deployment checks — 2026-10-04

This checkpoint improves test-route preparation and its evidence. It does not
change game rules, content, graphics, or the tactical renderer. It does not prove
that the ordinary 3,200-peso campaign can complete the mountain route or the
historical ending.

## Changed test helpers

`createFreshRouteOrders` in `tests/fresh-cuyo-route.mjs` tracks the actual living,
uncaptured serving survivors, including reserves outside the active squad. It
uses exact contract expiry seconds and current quotes for ordinary paid renewals.
An explicit dismissal uses the normal campaign order. A rejected renewal, an
unhandled encounter, or an outstanding tactical report stops preparation.

Before a route clock advance, the helper checks actual acute survivors. A
one-hour medical wait requires an eligible, local doctor and patient assignment.
It stops when finite dressings cannot support the next hour. Accepted campaign
orders are reported before any check of the resulting interruption or loss. The
report can therefore replay the action that caused preparation to stop.

`performFreshMountainFirstAid` in `tests/fresh-mountain-route.mjs` reports the
accepted tactical orders before it tests completion. It synchronizes the actual
partial result with the campaign clock. A blocked approach, rejected order, or
untreated survivor keeps the admitted partial checkpoint and refuses departure.
Successful treatment uses ordinary departure. It does not grant health or kit.

The mountain helpers select living, capable leaders and medical roles from the
actual roster. `createdLosPatosBattery` selects two distinct issued doctors and
a separate finite dressing donor. It transfers only each doctor's deficit to
five dressings. Existing stock above five remains unchanged. Missing roles or
insufficient donor stock reject preparation. Placement, confirmation, and
transfers use ordinary actions; guns and charges are not created or refilled.

## Nine distinct acceptance cases

- Three route-order cases cover exact-second retention of an inactive reserve,
  finite hourly care followed by refusal when dressings run out, and preservation
  of a legal sector-entry order when later preparation stops. These cases declare
  immediate arrivals and, in the care case, an initial acute condition before
  campaign creation. They do not prove an earned opening.
- Two first-aid cases use real paid native day hires and finite native kits. Their
  clinical wounds and flat/blocked arena are declared before official save
  admission; they are not wounds earned in an opening battle. The cases cover
  successful treatment and a real paid self-treatment followed by an unreachable
  patient. Both compare accepted action replay, ordinary/presented results,
  official save admission, clock, kit debit, and unchanged ammunition and cash.
- Four portable Los Patos subsystem cases use declared finite issued cohorts.
  They cover original roles, different living roles, an existing overfloor stock,
  and a later feasible doctor pair. They verify exact source debit, conserved
  dressing totals, ordinary/presented/validated-snapshot replay, transfer cost,
  elapsed time, unchanged gear/seed/gun charges, and rejection of an infeasible
  role set. They do not prove campaign save admission or a mountain battle win.

The portable deployment test is copied unchanged from its reviewed source. Its
SHA256 is
`fbb67487c81e70867b032559e3d04ecee6353a5f7afc99d207e0d337151eb546`.

## Scope and validation

This branch has exactly six test/support files and this evidence document. No
test partition, skip, exclusion, runtime file, or shared video status map changes.
The complete short suite retains the existing eight extended route/artwork files
outside its partition. Those long routes are not rerun for this helper slice.

All local gates below completed on base
`f61dc7042335b1199cec0f16b5b18ab1b2e72527` with the six copied test/support files.

- The first affected run passed 70/70 checks in 13 files, including all nine new
  cases, with zero failures, cancellations, skips, or todo. It took 14.838 seconds.
  The adjacent cases cover deployment, critical first aid, medical care, and
  exact-second contracts.
- The first complete `npm run test:quick` passed 4,909/4,909 checks and completed
  705/705 selected files (`complete:true`) out of 713 total test files. It took
  326.681 seconds, with zero failures, cancellations, skips, or todo. No filters
  or new exclusions were added. The existing eight extended files remain outside
  this partition.
- Documentation and baseline audits, shard self-tests (5/5), complete 713-file
  shard coverage, and diff checks passed.
- The frozen test/support set contains 881 paths. Its SHA256 is
  `c16c6685a5fd00630e197e91b50bb4ec755196c4c10b2b7ba9700db2c03856b1`.
  Before/after test hashes match.
- The game/editor/tools source and preserved production build still match
  `413c4b2f70412613f5cf26f39146d20764c9a9c228c5b0c69592fef3caf514b4`.
  The [PR 168 source validation](range-material-penetration-2026-10-04.md)
  typecheck/build receipts remain valid for these unchanged inputs. Those two
  gates were not repeated for this test/document-only diff.

Local receipts: `/tmp/granaderos-finite-route-care-affected.log`,
`/tmp/granaderos-finite-route-care-quick.log`, and
`/tmp/granaderos-finite-route-care-quick-report.json`. Both test processes closed
with exit 0. Independent review found no extra dependency or resource grant.
