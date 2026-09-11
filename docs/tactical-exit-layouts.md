# Tactical exit layouts: T09 implementation input

Status note: this document records the design input. The implemented behavior and remaining limits are now described in [JA2 gameplay](ja2-gameplay.md#physical-departure-and-persistent-casualties) and [the parity audit](ja2-parity-audit.md).

Checked on 2026-09-06 against all 15 outputs of [buildSectorMap](../game/maps.js), the 13 [CAMPAIGN_SECTORS](../game/data.js), and current [movementStepCost/getReachable](../game/tactical.js). This is a proposed logical exit mapping. No terrain, building, prop, or exit implementation changed. See [the transaction plan](tactical-exit-plan.md) for separated units, casualties, and campaign reporting.

All maps are 20 × 16. Coordinates below are zero-based; N is `y=0`, E is `x=19`, S is `y=15`, W is `x=0`. The campaign chart and tactical plans are schematic. A bearing below describes the campaign chart's `x/y` positions, not a surveyed route or an archaeological claim. The tactical road may turn before it reaches another map.

## Measured boundary access

Generated each map with one ordinary player, exploration enabled, and no enemies. Used the generated spawn, closed doors, full prop collision, and the current eight-way movement rules. `R/I` means **reachable boundary cells / arrival candidates with a legal cardinal step inward**. Corners count on each incident edge. Occupants are excluded from this static measurement and must be checked at runtime. Every unblocked boundary cell was connected to the generated spawn; some lack a direct inward step because a house stands immediately inside the edge.

| Map | N: R/I | E: R/I | S: R/I | W: R/I |
|---|---:|---:|---:|---:|
| buenos_aires | 20/9 | 16/16 | 20/11 | 16/16 |
| retiro | 11/11 | 16/16 | 12/12 | 16/16 |
| ensenada | 18/18 | 0/0 | 18/18 | 16/16 |
| san_nicolas | 18/18 | 0/0 | 18/18 | 16/16 |
| santa_fe | 15/12 | 0/0 | 15/15 | 16/16 |
| cordoba | 20/20 | 16/16 | 20/17 | 16/16 |
| mendoza | 20/15 | 16/16 | 20/15 | 16/16 |
| uspallata | 0/0 | 8/8 | 0/0 | 8/8 |
| los_patos | 0/0 | 10/10 | 0/0 | 10/10 |
| tucuman | 20/20 | 16/16 | 20/20 | 16/16 |
| salta | 20/13 | 16/16 | 20/17 | 16/16 |
| jujuy | 0/0 | 12/12 | 0/0 | 12/12 |
| humahuaca | 0/0 | 8/8 | 0/0 | 8/8 |
| san_lorenzo | 17/17 | 0/0 | 17/17 | 16/16 |
| yatasto | 20/20 | 16/16 | 20/20 | 16/16 |

Exceptions that prevent a generic geographic exit rule:

- Ensenada, San Nicolás, and Santa Fe have water across their entire east boundary. San Lorenzo also has an impassable bluff at `x=17`, before its river at `x=18–19`. These are not foot exits.
- Uspallata, Los Patos, Jujuy, and Humahuaca have blocked stone across both north and south boundaries. Their east/west passages must represent onward mountain travel.
- Retiro has barracks on parts of the north and south boundaries. Its road at `x=14–15` reaches both edges.
- Santa Fe has water on parts of its north and south edges. The apparent northbound road does not reach the north edge as a road; the northern building also blocks direct inward movement at three otherwise reachable boundary cells. Use its west and south roads for the listed links.

## Explicit route endpoints

Each row defines both directions: departing A uses the A edge; arrival in B uses the B edge, and vice versa. The coordinate is the preferred boundary arrival anchor and exit sign location. Other valid cells on that designated edge remain eligible. Distinct destinations may share an edge or anchor; the exit ID and destination must remain explicit.

| Link A ↔ B | Chart bearing A → B | A edge and anchor | B edge and anchor | Layout decision |
|---|---|---|---|---|
| buenos_aires ↔ retiro | NE | N `(9,0)` | S `(14,15)` | Existing north/south roads. |
| buenos_aires ↔ ensenada | SE | E `(19,7)` | W `(0,7)` | Use Ensenada's landward road. |
| buenos_aires ↔ san_nicolas | NW | N `(10,0)` | S `(11,15)` | North/south roads; avoids the river. |
| buenos_aires ↔ cordoba | NW | W `(0,7)` | E `(19,8)` | West/east roads. |
| san_nicolas ↔ santa_fe | N | N `(11,0)` | S `(4,15)` | Existing north/south roads. |
| cordoba ↔ san_nicolas | E | E `(19,7)` | W `(0,6)` | Landward Paraná approach. |
| cordoba ↔ santa_fe | E | E `(19,8)` | W `(0,7)` | Landward port approach. |
| santa_fe ↔ tucuman | NW | W `(0,8)` | E `(19,8)` | Existing roads; no north-edge road in Santa Fe. |
| cordoba ↔ tucuman | N | N `(9,0)` | S `(12,15)` | Existing north/south roads. |
| cordoba ↔ mendoza | SW | S `(9,15)` | N `(12,0)` | Schematic bend along existing roads. |
| mendoza ↔ uspallata | W | W `(0,7)` | E `(19,7)` | Existing mountain passage. |
| mendoza ↔ los_patos | NW | W `(0,8)` | E `(19,6)` | Los Patos has no south exit. |
| uspallata ↔ los_patos | N | W `(0,7)` | E `(19,7)` | Mountain branch; neither map has a north/south exit. |
| tucuman ↔ salta | NW | N `(12,0)` | S `(10,15)` | Existing north/south roads. |
| salta ↔ jujuy | N | N `(10,0)` | E `(19,7)` | Jujuy's schematic corridor turns the approach. |
| jujuy ↔ humahuaca | N | W `(0,7)` | E `(19,7)` | Continue through the mountain corridors. |
| san_lorenzo → san_nicolas | Scene return | S `(11,15)` | N `(12,0)` | Explicit mission link; never enter the river or bluff. |
| yatasto → parent tucuman | Scene return | S `(3,15)` | N `(13,0)` | Parent is `request.sector === 'tucuman'`, not Salta. |

The first 16 rows cover every undirected campaign-neighbor pair exactly once. The final two are separate mission links, not additions to the normal campaign neighbor graph. Their reverse entry endpoints can be used when the existing mission action permits entry. Yatasto's scene state remains separate from Tucumán's sector state. Returning to the parent must not invent a strategic travel leg or complete the conference without its existing mission conditions.

Checked all 36 endpoint anchors: each is a reachable boundary **road** cell with a legal inward step. Each proposed edge has at least six valid arrival candidates on its fresh map. This verifies a normal six-person deployment's static capacity, not runtime space for every defense force.

## Deterministic entry selection

1. Store the link's explicit destination edge and anchor. Do not infer the arrival edge by reversing a compass bearing; Salta/Jujuy is one counterexample. Do not expose links unavailable under current campaign/mission rules.
2. On the destination's current saved terrain, enumerate only cells on that edge. Require unblocked terrain, no blocking prop, a finite cardinal inward `movementStepCost`, and connection to the designated exterior road approach. Do not open a door or remove an obstacle to create an entry.
3. Remove occupied cells, including NPCs and already reserved arrivals. Use a stable soldier order from the departure receipt. Sort candidates by distance to the anchor, then road before other terrain at equal distance, then `y`, then `x`; reserve each chosen cell once. The inward cell is a legal approach check, not permission to spawn one tile inside.
4. Preflight enough valid cells for the whole arriving subset. If insufficient, keep the arrival pending or reject it with an explicit blocked-entry result. Do not select another edge, place someone inside a house, stack people, or silently use an arbitrary interior tile. The caller can choose another authorized route explicitly.
5. Distinguish a new arrival from continuation by residents. [enterSector](../game/world.js) currently prefers prior player coordinates and then searches all open map cells. That fallback cannot be used for a new edge arrival. Residents retain their own valid persisted locations; new arrivals use the departure receipt's edge. Validate and reserve positions before initial contact is evaluated.

Raw read-only measurement output: `/tmp/granaderos-exit-layouts.BKfU7t/layouts.json`; verified proposed endpoints: `/tmp/granaderos-exit-layouts.BKfU7t/proposed-routes.json`. Re-run after authored terrain or prop changes. This check does not verify live UI behavior.
