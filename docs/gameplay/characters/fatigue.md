# Fatigue, energy capacity and marching

> **Development-workspace record.** This note describes a separate development
> checkout. Its implementation and test results are not published-main acceptance.
> See [published progress](../../verification/published-progress.md) for the main branch baseline.

Energy is the breath available now. Fatigue reduces the amount a soldier can recover: maximum energy is `max(10, 100 − fatigue)`. Taking a tactical breather cannot erase accumulated fatigue. Sleeping and strategic rest restore capacity as well as current energy. No separate saved maximum is needed: the existing fatigue record determines it.

## Reference and adaptation

The [classic manual](https://cdn.akamai.steamstatic.com/steam/apps/545210/manuals/JA2_Manual_English.pdf), printed pages 16, 38–40 and 44, distinguishes current energy from potential energy lost through tiredness and warns about extended marching. The maintained [JA2 assignment implementation](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/master/src/game/Strategic/Assignments.cc) uses hourly fatigue, limits current breath to maximum breath and increases foot-travel fatigue under excess load. Its [assignment constants](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/master/src/game/Strategic/Assignments.h) set a minimum maximum-breath value of 10.

The capacity relationship and the 10-point floor follow that model. Travel rates, terrain multipliers, the 80-fatigue departure threshold and existing rest rates are Granaderos tuning for its much larger strategic regions. Individual sleep requirements and the original sleep/wake thresholds are not reproduced yet.

## Behavior

- Tactical creation, energy recovery, food and exertion respect the fatigue-limited capacity. The personnel panel, tactical inventory, squad strip and portrait tooltips display current energy and capacity. The squad table also shows fatigue.
- Current energy still pays for walking, running and other exertion immediately. Tactical fatigue now follows campaign-hour boundaries: two fatigue per hour of activity. Quiet tactical rest instead removes one fatigue per hour. Issuing many short movement orders cannot produce extra fatigue solely through per-order rounding. Units who died, left or surrendered are excluded.
- Doctors, practice, repair and militia work retain their existing productive-hour costs, now with the shared energy limit. Sleep/Rest/Patient recovery removes fatigue before restoring energy, so the restored capacity is available in that hour.
- Foot travel adds two fatigue per hour on ordinary terrain, multiplied by overload beyond carrying capacity. Mountain travel multiplies effort by 1.5, rounded up. A usable assigned horse or a posta uses one fatigue per hour before terrain adjustment. Carts and flotillas use one fatigue per hour.
- Travel charges only the actual traveling soldiers, only while they remain alive and in service. Remote squads can keep resting or working. The approach to an attack carries its fatigue into the actual battle. San Martín's recruitment no longer removes everyone's physical travel cost.
- A squad at 80 fatigue or above, or at 10 energy or below, must rest before a new march or an attack approach. Combat in a hostile sector already reached remains available, so exhaustion cannot trap the squad between battle and unavailable sleep. A multi-stage route stops at the last reached sector when this threshold is reached. No later stage is granted. The current synchronous travel system completes an in-progress stage before this check; mid-stage interruption remains part of the queued-travel requirement.
- Ordinary tactical clock synchronization does not charge a second strategic marching/recovery cost to deployed soldiers. Battle return and save/reload preserve their actual fatigue and energy. Public projections expose capacity for known friendly records, without exposing hidden enemy fatigue.

## Verification

`fatigue-capacity.test.mjs` covers capped recovery, food, tactical entry, hourly timing, quiet rest, save continuation, battle return and information visibility. `march-fatigue.test.mjs` covers hourly effort, load, transport, terrain, actual route stops, remote squads, expiry and attack deployment. `fatigue-render.test.mjs` covers player-facing capacity and route-effort information. Existing journey test helpers use real sleep and travel orders; NPC approach helpers can spend real tactical rest time. The opening playthrough prepares the squad at its staging sector and selects a surviving supply bearer from the actual outcome.

A02 and W02 remain partial. Individual sleep needs, a fuller collapse/recovery model, simultaneous queued travel and cancellation within a stage still need implementation and acceptance evidence.

### Browser acceptance — 2026-09-11

In the local game with separate QA storage, the squad panel showed two fatigue per hour before travel. A real Retiro → Buenos Aires march advanced 12 hours and showed all three soldiers at 24 fatigue and 76/76 energy. Cabral slept for one hour: fatigue fell to 16 and energy/capacity rose to 84/84. After manual wake and sector entry, the tactical strip, portrait tooltip and inventory all showed the same 84-point limit. A tactical breather did not refill him above it. A fresh page load continued the saved tactical sector at the same 84/84 limit. The checked page reported no warning or error logs.

The legal seed-8 opening replay won San Nicolás in 19 turns / 99 orders and San Lorenzo in 13 turns / 123 orders. It uses real staging-sector sleep, finite recovered medical supplies, relief care and replacements; four soldiers died in the first battle and three in the second. This is opening-campaign evidence, not a full campaign win through real tactical play. The separate phase/production test still uses explicitly scripted battle reports.

Final validation: all 1,065 tests passed in the isolated gameplay checkout, with type checking, production build and whitespace checks also passing. The build exported 278 files and verified 189 asset references. Concurrent art and recruitment edits were preserved and excluded from this commit.
