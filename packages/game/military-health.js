import { Health, HealthRules } from './domain/personnel/health.ts';
import { refreshMilitaryCondition } from './actor-condition.js';
import { requireGameSecond } from './domain/world/world-timeline.ts';
import { Corpse } from './domain/world/corpse.ts';

export function advanceMilitaryWoundTime(
  snapshot,
  seconds,
  { beforeBleeding = () => null, afterBleeding = () => {}, atSecond, actors } = {},
) {
  if (!Number.isSafeInteger(seconds) || seconds < 0) {
    throw new Error('Military wound time must be a non-negative integer.');
  }
  const previousRemainder = snapshot.bleedSeconds ?? 0;
  const elapsed = previousRemainder + seconds;
  const ticks = Math.floor(elapsed / HealthRules.BleedingIntervalSeconds);
  const endSecond = atSecond ?? (snapshot.startSeconds ?? 0) + (snapshot.elapsedSeconds ?? seconds);
  snapshot.bleedSeconds = elapsed % HealthRules.BleedingIntervalSeconds;
  for (const actor of (actors ?? snapshot.units ?? []).filter((actor) => actor.hp > 0)) {
    const observation = beforeBleeding(actor, ticks);
    const health = new Health({
      current: actor.hp,
      maximum: actor.maxHp ?? 100,
      bleeding: actor.bleeding ?? 0,
      bandaged: Math.min(actor.bandaged ?? 0, (actor.maxHp ?? 100) - actor.hp),
    });
    const result = health.advanceBleeding(ticks);
    const condition = health.toSnapshot();
    actor.hp = condition.current;
    actor.bleeding = condition.bleeding;
    actor.bandaged = condition.bandaged;
    refreshMilitaryCondition(actor);
    if (result.died && (snapshot.sceneId ?? snapshot.sectorId)) {
      const diedAtSecond =
        endSecond -
        seconds +
        result.deathAfterTicks * HealthRules.BleedingIntervalSeconds -
        previousRemainder;
      actor.corpse = Corpse.recordDeath(
        String(actor.originalUnitId ?? actor.id),
        snapshot.sceneId ?? snapshot.sectorId,
        diedAtSecond,
      ).toSnapshot();
    }
    afterBleeding(actor, result, observation);
  }
}

export function advanceMilitaryWoundClock(
  snapshot,
  targetSecond,
  { initialSecond, ...hooks } = {},
) {
  requireGameSecond(targetSecond);
  const previousSecond =
    snapshot.militaryConditionSecond ?? initialSecond ?? snapshot.startSeconds ?? targetSecond;
  requireGameSecond(previousSecond);
  if (targetSecond < previousSecond) {
    throw new Error('Military wound time cannot move backwards.');
  }
  advanceMilitaryWoundTime(snapshot, targetSecond - previousSecond, {
    ...hooks,
    atSecond: targetSecond,
  });
  snapshot.militaryConditionSecond = targetSecond;
}
