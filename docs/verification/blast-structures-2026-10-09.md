# Grenade damage to structures

Development worktree: `blast-structures`, 9 October 2026. This record describes local implementation and validation. It does not claim published-main acceptance or full JA2 1.13 parity.

## Reference and scope

The checked-in engine is JA2 1.13 at `ddb691318eb3dd0cdc6eab42139739b6d498c645`. In `engine/TileEngine/structure.cpp`, `DamageStructure` subtracts material armour before reducing structural hit points. `engine/TileEngine/Explosion Control.cpp` applies explosive structure damage and updates movement costs after destruction. Granaderos uses that material/durability principle with its existing cell geometry and finite arsenal grenades.

Weapon pickup is accepted as implemented. This change does not alter pickup rules. Solid cannonballs retain their direct breach rules and do not acquire radial explosive damage.

## Durable rules

Each detonated grenade has structural strength 160 and radius 3. Exposure falls with physical distance and uses the shared wall, furniture, raised-ground and slab geometry. The target's own volume cannot shield its near face. Multi-cell furniture receives its strongest exposed hit once. All candidates resolve against the intact geometry before any collapse is applied. People use their existing blast damage rules and the same intact cover.

Material values and size factors are game tuning:

| Material | Base durability | Armour |
| --- | ---: | ---: |
| Wood | 100 | 10 |
| Adobe | 200 | 25 |
| Stone | 350 | 50 |
| Hay | 60 | 0 |

Durability factors are wall 1, door 0.6, window 0.25, table 0.45, bench 0.3, bed 0.4, chest 0.55, barrels 0.55, hay 0.5 and cart 0.9. Door leaves and window frames use wood. At one cell from a grenade, an exposed wooden wall is destroyed, an adobe wall gains 48% damage, and a stone wall gains 20% damage.

`structureDamage` is an integer from 0 to 100. At 100, `destroyed` is true. Walls/windows become low rubble with cover 15 and a physical height of 0.15. Doors retain their identity and become open, unlocked and broken. Props retain their identity, placement, footprint and contents, while losing movement, sight and projectile obstruction. A destroyed chest stays open; its finite identified contents can be recovered once through normal inventory actions.

Old saves require no added fields. New damage is validated in active battles and stored sector scenes. Damaged structures cannot retain a hidden tall collision override after collapse. Manual and cannon breaches normalize previously damaged records to a consistent destroyed state.

## Presentation and boundaries

Partial damage has restrained local wear. Destroyed doors and furniture show low debris. Visible result frames update after the grenade flight; preparation and flight frames retain intact geometry. Shared materials and unrelated cached chunks remain reusable. Hidden rooms and unseen public-state records use the existing disclosure rules.

Roofs and floors do not collapse. There is no pressure propagation around corners, no extra propagation through a structure destroyed during the current blast, and no explosive chain reaction. These are bounded structure-damage rules, not a complete explosives simulation.

## Review and validation

The renderer sandbox has a **Daño por explosión** scene. It provides eight physical grenades, wooden/adobe/stone walls, a door, a window, furniture and a locked finite chest. Ordinary throw orders can repeat the checks; resetting creates a fresh review fixture without changing the campaign save.

Focused tests cover cumulative material damage, shielding, floors/elevation, cleared movement/sight/projectile/throw paths, finite grenade spending, failed throws, chest custody and extraction, active saves, sector leave/reentry, old saves and malformed damage records. Renderer tests cover wear, low debris within footprints, room disclosure, chunk disposal/reuse and the real grenade replay sequence. Public-state tests cover observed damage and hidden-state independence.

The strategic map was captured from a fresh local campaign for user feedback. No map changes are included. The picture is [map-screen.jpg](../evidence/blast-structures-2026-10-09/map-screen.jpg).

Live browser review used the controlled sandbox and ordinary right-click/keyboard throw controls. Throws beside the adobe and wooden walls spent two of eight grenades. The wooden wall's cell changed from obstacle to accessible; the adobe cell remained an obstacle. The inventory displayed one held grenade and five in pockets, with health and energy still 100. The browser reported no console errors. See [blast-result.jpg](../evidence/blast-structures-2026-10-09/blast-result.jpg) and [grenade-stock.jpg](../evidence/blast-structures-2026-10-09/grenade-stock.jpg). This is a controlled feature check, not a complete campaign playthrough.

Local validation on 9 October 2026:

- All 26 focused feature, custody, persistence, public-state and renderer tests passed.
- The full Node 25.9.0 suite completed all 917 files: 6,912 tests, 6,897 passed, 10 failed and 5 skipped. The full gate is not green.
- All 10 failures were reproduced on unchanged primary commit `3735cc7023d35a9c378c2c357142b37ed166eb9b` with the exact same Node executable. The nine underlying assertions match on test location, message, actual, expected and operator. The opening parent failure and five skips also match. No new failed assertion appeared in this run.
- The existing failures concern fresh coastal/northern/Cuyo/ending routes, historical-loss/recovery routes, and the opening playthrough. They remain outside this blast change. See [baseline-failures.json](../evidence/blast-structures-2026-10-09/baseline-failures.json).
- TypeScript, documentation/baseline audits, shard coverage, five shard self-tests and `git diff --check` passed.
- The production build passed. Static export validation checked 1,377 files and 1,045 asset references; source identity `baf231ccb406`.

The implementation is saved on local branch `codex/blast-structures`. It has not been merged into main or published.
