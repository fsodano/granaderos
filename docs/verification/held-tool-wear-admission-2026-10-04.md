# Held-tool wear admission — 2026-10-04

The saved inventory permits at most 1,000 keys. A legacy held stack with more
than one tool needs a new key when one selected tool wears. Previously, wall
breaching checked that split before the action, but lock picking, prying, and
trap disarming did not. Those actions could create a 1,001-key result that the
official save validator rejected.

## Bounded correction

The existing `heldToolWearReason` now applies to required tools with positive
wear and usable condition. The shared action profile checks it after ordinary
tool admission and before any random roll, action cost, approach, or inventory
change. Lock picking, prying, disarming, and wall breaching use that same guard.

The refusal is the existing Spanish message:
“No hay espacio para separar la herramienta usada de las herramientas sin
desgaste.” An ordinary rejection adds that one message to the log. Every other
state field remains unchanged.

One tool can still wear at the 1,000-key cap because no split is needed. A
999-key inventory can split one worn tool into its last slot. A key has zero
wear and does not split, so a stacked key can still unlock at the cap. Broken
tools retain their existing refusal. Failed but admitted tool attempts retain
their normal wear and costs.

No save limit, item count, tool condition rule, chance, cost, skill, or visibility
rule changes. No new saved field, renderer change, or cannon rule is added.

## Existing-test acceptance

Two new cases in `tests/environment-transactions.test.mjs` use an explicitly
declared preexisting campaign from the legacy subsystem fixture. Its service,
controlled sectors, and native kit are fixture inputs, not an earned opening.
The held tools and zero-quantity historical inventory keys are declared before
the first visit and official save admission. Health, skills, weapons, native
charges, and cash are not changed during the action sequence.

- Officially admitted 1,000-key stacks reject each of pick, pry, and disarm.
  The case tests local direct actions and composed tool use, plus visible remote
  approach. There is no movement, time, random draw, wear, source debit, or cost.
  The only new field value is the ordinary refusal message and its log entry.
- One-tool wear at 1,000 keys, each legal 999-to-1,000 split, and a zero-wear
  stacked key all remain valid. They retain the source count, unused condition,
  selected tool identity, weight, native weapon charges, and treasury. Accepted
  action time and random draws remain ordinary. Each result passes campaign
  clock synchronization, official encode/decode, ordinary/presented equality,
  and exact replay from the admitted source.

Existing wall-breach tests retain the breach-cap refusal, one-tool wear, finite
custody, approach costs, and valid saved rubble. No duplicate breach test is
added. Existing pure tool tests retain wear after unsuccessful attempts.

## First diagnostics

Before the source correction, the new saved-stack refusal case failed because
its preview was valid. The legal boundary controls already passed. Receipt:
`/tmp/granaderos-held-tool-before-fix.log` (1 pass, 1 fail).

The first affected run after the correction had one test-only failure: its
whole-state assertion initially excluded `lastError` but did not account for
the normal refusal log entry. The assertion now requires exactly that one log
entry, then complete equality of all remaining state. Receipt:
`/tmp/granaderos-held-tool-affected-first.log`. No physical check was removed.

The final affected run passed 75/75 checks in eight files, with zero failures,
cancellations, skips, or todo; closed exit 0 in 2.262 seconds. Receipt:
`/tmp/granaderos-held-tool-affected-final.log`.

## Final frozen gates

The unfiltered `npm run test:quick` passed 4,911/4,911 tests in all 705 selected
files of the existing 713-file partition. Its report has `complete: true`, zero
failures, cancellations, skips, or todo, and a duration of 349.526 seconds.
The process closed with exit 0. Receipts:
`/tmp/granaderos-held-tool-quick-final.log` and
`/tmp/granaderos-held-tool-quick-report.json`.

Typecheck, production build, documentation audit, baseline audit, partition and
shard coverage, and `git diff --check` all closed with exit 0. The shard
self-test passed 5/5. The build exported 1,133 files with 1,033 asset references.
No new skip, filter, or partition exclusion was added.

The frozen source and build both have SHA-256
`91c6622816fdbc8aa755b9143cbdf9c39eae41cbdd7a59244fd25076ee4945aa`.
The 881 test/support paths, including 713 test files, have SHA-256
`8d277bf4221c926331c98d75dc381298db57c133af3ef4168acbf20aacc070e3`.
Both identities remained unchanged through the complete suite and this receipt.
The candidate is based on main
`05ef7cf868b12d37bac38bcf54cb4aa6aa30b1ee`.

Root and an independent UI reviewer found no blocker in the bounded source,
saved-state tests, and scope claims. This subsystem checkpoint does not prove a
full stock campaign or historical ending.
