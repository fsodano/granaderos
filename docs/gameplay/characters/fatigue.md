# Fatigue, energy capacity and marching

Across strategic travel, strategic assignments and the tactical battlefield, energy is the breath available now. Fatigue reduces the amount a soldier can recover: maximum energy is `max(10, 100 − fatigue)`. Taking a tactical breather cannot erase accumulated fatigue. Sleeping and strategic rest restore capacity as well as current energy. No separate saved maximum is needed: the existing fatigue record determines it.

## Reference and adaptation

The [classic manual](https://cdn.akamai.steamstatic.com/steam/apps/545210/manuals/JA2_Manual_English.pdf), printed pages 16, 38–40 and 44, distinguishes current energy from potential energy lost through tiredness and warns about extended marching. The maintained [JA2 assignment implementation](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/master/src/game/Strategic/Assignments.cc) uses hourly fatigue, limits current breath to maximum breath and increases foot-travel fatigue under excess load. Its [assignment constants](https://github.com/ja2-stracciatella/ja2-stracciatella/blob/master/src/game/Strategic/Assignments.h) set a minimum maximum-breath value of 10.

The capacity relationship and the 10-point floor follow that model. Travel rates, terrain multipliers, the 80-fatigue departure threshold and existing rest rates are Granaderos tuning for its much larger strategic regions. Individual sleep requirements and the original sleep/wake thresholds are not reproduced yet.

## Behavior

- Tactical creation, energy recovery, food and exertion respect the fatigue-limited capacity. The personnel panel, tactical inventory, squad strip and portrait tooltips display current energy and capacity. The squad table also shows fatigue.
- Current energy still pays for walking, running and other exertion immediately. Tactical fatigue follows campaign-hour boundaries: two fatigue per hour of activity. Quiet tactical rest instead removes one fatigue per hour. Issuing many short movement orders cannot produce extra fatigue solely through per-order rounding. Units who died, left or surrendered are excluded.
- Doctors, practice, repair and militia work retain their existing productive-hour costs with the shared energy limit. Sleep/Rest/Patient recovery removes fatigue before restoring energy, so the restored capacity is available in that hour.
- Foot travel adds two fatigue per hour on ordinary terrain, multiplied by overload beyond carrying capacity. Mountain travel multiplies effort by 1.5, rounded up. A usable assigned horse or a posta uses one fatigue per hour before terrain adjustment. Carts and flotillas use one fatigue per hour.
- Travel charges only the actual traveling soldiers, only while they remain alive and in service. Remote squads can keep resting or working. The approach to an attack carries its fatigue into the actual battle. San Martín's recruitment does not remove other soldiers' physical travel cost.
- A squad at 80 fatigue or above, or at 10 energy or below, must rest before a new march or an attack approach. Combat in a hostile sector already reached remains available, so exhaustion cannot trap the squad between battle and unavailable sleep. A multi-stage route stops at the last reached sector when this threshold is reached. No later stage is granted. The current synchronous travel system completes an in-progress stage before this check; mid-stage interruption remains part of the queued-travel requirement.
- Ordinary tactical clock synchronization does not charge a second strategic marching/recovery cost to deployed soldiers. Battle return and save/reload preserve their actual fatigue and energy. Public projections expose capacity for known friendly records, without exposing hidden enemy fatigue.

## Remaining work

A02 (rest, sleep, energy restoration and fatigue limits on work and marching) and W02 (queued travel, route choice, arrival time, cancellation and encounters) in the [parity requirements](../../requirements/ja2-parity.md) remain partial. Individual sleep needs, a fuller collapse/recovery model, simultaneous queued travel and cancellation within a stage remain open.
