# Regional terrain and weather

Fresh sectors use regional surroundings instead of a common grass exterior.
The authored landmark, streets, doors, deployment areas and boundary approaches
retain their layout. Returning to a saved sector retains its terrain and damage.

| Region | Terrain and climate profile |
| --- | --- |
| Retiro, Buenos Aires, Ensenada | Humid plain and riverbank; Ensenada has wet ground |
| San Nicolás, San Lorenzo, Santa Fe | Paraná riverbank and wetlands |
| Córdoba | Central scrub and rocky ground |
| Mendoza | Dry foothills, scrub and oasis surroundings |
| Tucumán, Yatasto, Salta, Jujuy | Northern woodland and valleys, wetter in summer |
| Humahuaca | Dry highland valley, sparse vegetation and rock |
| Uspallata, Los Patos | High mountain passes, rock and sparse vegetation |

These are broad game regions, not maps of precise ecological boundaries. The
geographic basis includes the Pampa's rain through the year, the wet Yungas, and
the dry, cold high Andes. See the National Parks descriptions of the
[Pampa](https://www.argentina.gob.ar/parquesnacionales/ecorregiones/pampa),
[Yungas](https://www.argentina.gob.ar/node/245944), and
[Altos Andes](https://www.argentina.gob.ar/node/245920).

Weather uses the existing campaign calendar: March start, 30-day months and
Southern Hemisphere seasons. A region has a deterministic weather state for
each six-hour interval. Assault, defense and exploration use the same state.
The tactical clock updates it at the interval boundary. Leaving and entering
cannot reroll it; a resumed engagement retains its saved weather and clock.
The regional weather function does not consume campaign or combat randomness.
Removing the old assault-only weather roll changes later campaign RNG positions.

Rain values are the existing 0–100 gameplay intensity. `humidity` is an additive
powder-ignition penalty, not a relative-humidity percentage. Seasonal ranges,
rain probabilities and interval length are game tuning, not recorded 1812
weather or a claim to reproduce JA2's weather formula.

Gameplay uses the existing rules: wet powder is less reliable, a serviceable
worn poncho protects the turn AP budget from rain, heavy rain shortens newly
lit torches, and mountain conditions reduce the combat AP budget. Mud costs
more movement energy. Forest and scrub provide cover. Exploration spends no
AP. Weather changes do not refill or deduct a soldier's current AP.

The campaign sector panel has a collapsed **Terreno y clima** section. It shows
the region and season, plus current weather for the squad's local sector. The
tactical header already indicates rain and day/night.

Limits: no snow tiles, temperature simulation or precipitation animation.
Existing torches retain the lifetime assigned when lit. Saved geography is
preserved; previously visited grass exteriors are not regenerated.

## Integration check — 12 September 2026

The combined weather, terrain, combat settlement, cache, sector reentry, NPC and
stationed-artillery run passes 76 checks. Nine further equipment, combat-driver
and terrain-render checks pass. Typecheck and the production build pass; the
static export verifies 960 files and 856 asset references.

The browser check used the integrated illustrated artwork in Tucumán, Córdoba,
Mendoza and Ensenada. It checked the distinct surroundings and the collapsed
campaign information panel. A four-cell exploration walk reduced energy from
100 to 96 without AP use.

The first broad integration run passed 1,649 of 1,657 tests. The cache binding was
a production defect and is corrected. Several combat and crew fixtures assumed
stale geometry or fixed casualties; their corrected focused checks now pass.
The longer northern campaign and hired-only Retiro acceptance routes remain
under review. These focused results do not establish full-suite or full-campaign
completion.
