# Current contract, conduct and carried-repair rules

This record corrects stale backlog statements against local commit
`cfbdf4fc3a1bcabb779871e5e4edca7fb4162c01`. The eight-file check used Node
25.9.0 and production source identity `8476681dc25a`, which was identical
before and after the run. All 61 tests passed, with no skips, in 32.56 seconds.
This is a bounded rule check, not full campaign or JA2 parity acceptance.

| Row | Existing behavior | Remaining scope |
| --- | --- | --- |
| R02 | An explicitly authored paid character can refuse renewal below 30 personal morale. A failed renewal preserves payment, the paid term and equipment. Ordinary recovery can remove this reason. | Profile-specific tolerances, buddy overrides and complete live contract acceptance remain separate. |
| R04 | A capable issued observer can object to a directly witnessed intentional killing of an explicitly authored noncombatant. The saved objection blocks later service, while the paid term continues. | This service objection adds no morale loss. Wider civilian-conduct morale effects and fatigue-specific morale events remain open. |
| R05 | Directed service refusals, preferred deployment companions, shared-service cohesion and witnessed-companion-loss rules already exist. Older pinned content can omit them. | Timed conflicts, evolving directed opinions and forced early departure remain open. |
| A03 / I07 | A local mechanic's finite carried-equipment queue repairs weapons, fittings, tools, and worn or packed garments. Ruined owned clothing remains the same object; repair does not issue replacement clothes. | Shared ground stores, artillery, vehicles, field-repair ceilings and historically supported ballistic protection remain separate. |

The source uses these declarations and transactions:

- `game/morale-renewal.js`, `game/contracts.js` and
  [poor-morale renewal](../gameplay/characters/poor-morale-renewal.md).
- `game/service-objections.js` and
  [civilian objections](../gameplay/characters/service-objections.md).
- `game/service-relationships.js`, `game/morale.js` and
  [service relationships](../gameplay/characters/service-relationships.md).
- `game/equipment-repair.js`, `game/assignments.js` and
  [garment wear and repair](../gameplay/equipment/outfit-equipment.md).

The exact command was:

```sh
node --test --test-concurrency=2 \
  tests/low-morale-renewal.test.mjs \
  tests/morale-renewal-integration.test.mjs \
  tests/service-relationships.test.mjs \
  tests/service-objections.test.mjs \
  tests/service-objections-context.test.mjs \
  tests/equipment-repair.test.mjs \
  tests/equipment-repair-render.test.mjs \
  tests/outfit-equipment.test.mjs
```

The [retained test output](../evidence/rule-reconciliation-2026-10-09/tests.txt)
and [source receipt](../evidence/rule-reconciliation-2026-10-09/checks.json)
identify this check. Requirement statuses remain unchanged. Historical published
checks keep their exact sources and totals. The latest
[road and campaign report](sector-roads-2026-10-09.md) records remaining long
campaign failures; these 61 passes do not close them.
