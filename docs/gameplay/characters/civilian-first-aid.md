# Civilian first aid

> **Development-workspace record.** This note describes a separate development
> checkout. Its implementation and test results are not published-main acceptance.
> See [published progress](../../verification/published-progress.md) for the main branch baseline.

Equip bandages in the main hand, then click a visible injured civilian. The soldier approaches and uses one dressing. Mouse and keyboard target activation use the same command. The talk cursor still opens dialogue. The cursor shows the combined movement and treatment cost; exploration spends time and movement energy, with no AP deduction.

Ordinary field treatment stops bleeding and covers existing wounds without restoring normal health. Critical treatment can restore a living casualty toward 15 HP, using one finite dressing per stroke. Several strokes may be needed. Treatment grants no energy or AP, does not stand the patient up, and cannot revive a corpse or remove the record of a player attack. A treated character can still refuse conversation. No generic loyalty reward is added. See [critical first aid](critical-first-aid.md).

New physical civilian injuries can bleed on the same six-second clock as soldier wounds. An interrupted approach, patient movement, collapse or death prevents the queued treatment from consuming a dressing. Dead and departed residents do not receive treatment. Existing injuries from older saves remain stable unless they receive a new wound.

Wounds, dressings and the responsible damage source persist through saves and sector reentry. A later death from bleeding retains its recorded source even if that attacker has left the sector. Public controls expose only observed wounds, not private attribution. Named residents use the same maximum health as their service record. Once-only migration preserves missing health from older 100-HP civilian records. Paid critical recovery is acknowledged once in the campaign ledger, so later hiring retains treatment without allowing stale reports to heal again.

## Reference and adaptation

The reference is Stracciatella commit `a06f4896c43c76396529e415a29a8ca26b00f9f1`. [Soldier_Control.cc](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Tactical/Soldier_Control.cc#L6900-L7191) permits first aid on non-team humans, applies target-specific refusal rules, and spends medical supplies. [Handle_Items.cc](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/Tactical/Handle_Items.cc#L501-L545) accounts for approaching a patient. [NPC.cc](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/a06f4896c43c76396529e415a29a8ca26b00f9f1/src/game/TacticalAI/NPC.cc#L2181-L2210) records daily bandaging and invokes authored first-aid responses.

Granaderos now implements critical stabilization toward 15 HP with explicit period supply and AP adaptations. Named residents use their service health scale, including after dismissal. Authored treatment responses, armed civilian hostility and civilian automatic bandaging remain outside this change. This is partial medical parity.

## Verification

Verification covers actual mouse and keyboard handlers, shared preview/reducer costs, finite dressings, exploration, combat, interruptions, hidden patients, delayed death attribution, persistence and named recruitment. See the tests for the exact prepared battlefield conditions; these are focused mechanic checks, not a complete campaign playthrough.

Previous ordinary-wound verification used a prepared open Retiro field, paid Acosta recruitment, the issued resident roster and an unattributed 20-HP injury. Clicking Cabral with bandages made Acosta move one tile, spend one dressing and one energy point, and retain 91 AP. Cabral remained at 78 HP after a preceding bleeding tick, with 22 points bandaged and zero bleeding. Reload and Continue preserved this state. The initial injury and compact geometry were test setup.

Previous ordinary-wound validation: the full suite passed 2,506 tests with no skips. The final combined checkout passed 169 focused tests, including the later dismissal regression and stricter wound-version checks. TypeScript and production build passed; the export verified 960 files and 856 asset references. All 51 pre-existing pending files were preserved, including an exact reverse-merge check for the four shared files. No artwork is included.
