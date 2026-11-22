# Slice 5: compatibility aliases

**Branch:** `migration/compatibility-aliases`
**Intent:** Retire the first compatibility names from the source, so the
compatibility table in the [ubiquitous language](../../accepted/ubiquitous-language.md)
starts to shrink.

## Why this slice exists

The accepted architecture keeps a table of retained compatibility names. Each
row records the canonical meaning, the owner, the call sites it still serves,
and the removal stage, and the plan states that the list only shrinks. Every
row in that table is still present in the source.

This slice removes the two aliases that are not part of the persisted format
and therefore need no save conversion:

| Retained name | Canonical meaning | Owner | Served call sites |
| --- | --- | --- | --- |
| `recruitCivic` | Compatibility command alias for `recruitCombatant` | `dispatchCampaign` in `packages/game/campaign.js` | Test fixtures that hire a combatant |
| `civicStatus` | Compatibility eligibility query used by recruitment adapters | `packages/game/recruitment.ts` and `packages/game/campaign.js` | The recruitment catalogue adapter and the recruitment screen |

`recruitCivic` is a command alias. `dispatchCampaign` handles it in the same
case as `recruitCombatant`, so removing the alias changes nothing but the name
callers use.

`civicStatus` answers whether a candidate can be hired and why not. The
canonical name follows the `RecruitmentCandidate` stem in the glossary:
`candidateAdmission`. The recruitment screen already calls the result
`admission`, so the new name matches what the interface already says.

The third alias in the table, `beginAssault`, stays in this slice. It is not a
pure alias for `fightOnArrival`: it resolves a squad that is ready to assault a
sector instead of authorizing the pending arrival decision, so retiring it
would change a rule. Its glossary row is updated to state what it actually
does.

The persisted names (`pendingBattle`, `battle`, `sectorState`, `recruited`,
`operativeState`, `sectorStates`, `sceneStates`, `suspendedSectorSessions`) and
the legacy prepaid claim (`hiringArrivals`) stay. They are part of the save
format and need an explicit conversion, which is a later slice.

## What it changes

- `packages/game/campaign.js` stops handling the `recruitCivic` command and
  stops re-exporting `civicStatus`.
- `packages/game/recruitment.ts` exports `candidateAdmission` instead of
  `civicStatus`.
- `packages/game/infrastructure/personnel/campaign-get-recruitment-candidates.repository.js`
  and `apps/web/app/Recruitment.tsx` call `candidateAdmission`.
- The test fixtures that hired a combatant with `recruitCivic` now use
  `recruitCombatant`.
- `packages/game/public/campaign-types.ts` drops the `beginAssault` action
  only if the type no longer exists; it does exist, so the type stays.
- The glossary's compatibility table drops the `recruitCivic` and `civicStatus`
  rows, records `candidateAdmission` as a canonical term, and corrects the
  `beginAssault` row.

## Tests

- The existing fixtures that hire a combatant keep passing with the canonical
  command name.
- A new test asserts that `dispatchCampaign` no longer accepts the retired
  command alias and that the canonical command still works, and that the
  canonical eligibility query is exported and the retired one is not.

## Verification

- `npm test` passes, including the new test.
- `npm run typecheck` passes.
- `npm run check:architecture` passes.

## Version

`0.2.9` to `0.2.10`.
