# Civilian health across campaign locations

This delivery connects existing encounter residents to one campaign health record.
It does not add new world identities or finish the story editor.

## Behavior

A resident has one identity across fixed, initial-random and daily placements.
Its health ceiling comes from its character definition. Ordinary local residents
use 100 health. The Yatasto contact and San Martín's field roles share his service
record. Paid bulletin candidates remain outside the NPC encounter system.

The normal tactical attack and medical cursors work on residents. Firearms,
melee, charges, scatter shot, cannon fire and existing door traps can hurt them.
A resident standing on the path of a successful ordinary shot intercepts it.
Bleeding advances on loaded exploration ticks and completed combat rounds.
Residents below 15 health, or with no energy, cannot walk or converse. First aid
uses one of the selected soldier's medical charges, stops bleeding and restores
only a critically injured resident to 15 health. It does not restore full health.
Medical charges and bleeding no longer reset on redeployment. The existing
workshop supply order replenishes up to two medical charges at 10 pesos per
missing charge. It keeps the workshop, ownership, supply and payment restrictions.

A synchronized tactical action updates the campaign record. Relocation starts a
new local routine but keeps health and injury history. Recruitment transfers the
current health into the soldier and removes the NPC from retained scenes. A
later dismissal uses the returned soldier's condition. Death stops placement
updates, prevents recruitment and leaves the body in its actual scene. Reentry
keeps the body's position and collapsed presentation. When a commander has several
mission identities, death also removes stale copies from earlier locations.

The first player wound and death retain attributed receipts. A death changes the
local city's loyalty once: intentional player kills -10, accidental player kills
-5, militia kills -7/-4, and enemy kills -3/-1 in patriotic territory or +10/+5 in
Royalist territory. These are the existing advanced-workspace adaptation values,
not a claim of numerical identity with JA2. Open rural cells have no invented city
reward. An unfinished local errand fails when its contact dies. Death of a required
stock commander ends the campaign explicitly; the open scene can still be closed
and the defeated campaign saved.

Save admission checks health, bleeding, consciousness, injury history, identity,
scene membership and the campaign's matching record. Old saves without a civilian
ledger migrate existing injuries from the previous 100-point scale. Migration
does not reroll placement or reset an injured resident to full health. Older
saves that retain commander wounds only in a mission ally keep those wounds.

## Evidence

Runtime and tests: `d5d2ca1ebc0a709acb36cc177e013c2c1ef3010e`.

- `tests/civilian-state.test.mjs` uses actual movement, melee and medical actions
  before save, daily relocation, recruitment and a second deployment. It also
  covers permanent death, corpse reentry, city receipts, failed errands, critical
  aid, finite supplies and paid replenishment, firearms, incidental hits, cannon fire, legacy injured
  saves, altered snapshots, dismissal and the shared mission identity.
- `tests/civilian-interaction.test.mjs` mounts the actual battlefield. Pointer and
  keyboard input select the resident for attack and care; a dead resident cannot
  retain or reopen a conversation.
- Existing compact combat tests now provide the actual deployment ID, sector and
  resident list. Their recruitment helper performs the same NPC-to-squad transfer
  as the game. The original combat and mission assertions are retained.

The complete local suite passed **582/582 tests**, with no failures or skips, in
181 seconds. TypeScript and the production export passed (721 files and 631
asset references). The baseline audit passed all 36 comparisons. Documentation
checks retained 171 requirements, including all 50 original and 87 parity rows.
All 44 local links in changed documents resolved. The
[requirement register](requirements.json) records this source. [PR #33](https://github.com/fsodano/granaderos/pull/33) was
merged at `5812d9b9c2e1bfae180216b4e413a0ebf4845097` after
[CI for `c00c6af`](https://github.com/fsodano/granaderos/actions/runs/36363917668/job/108746414452) passed.
No new browser playthrough or loaded-combat performance measurement was made.

## Remaining work at this checkpoint

STORY-02 remains partial. New authored world identities, editable personal stock,
NPC looting, custody, successor activation and role/stock transfer are not yet
connected. The editor still blocks these unsupported launch options. Existing
residents have no newly invented loot or equipment. They do not heal or bleed
while their sector is unloaded; a strategic care system is separate work.

Civic parity remains partial: armed civilian factions, witnesses, retaliation,
distant effects, theft/aid reputation and authored failure branches still need
integration. Long-term medical care and the advanced contextual inventory rules
also remain separate. This delivery does not establish full campaign completion.

New world identities were subsequently connected by the [resident delivery](authored-residents.md).
See the [requirement register](requirements.json) for current status.

A later [wound-continuity delivery](unloaded-civilian-bleeding.md) advances
previously recorded civilian bleeding outside the loaded sector. The earlier
checkpoint above is preserved; strategic civilian care remains separate.
