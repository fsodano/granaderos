import type {
  BattleSnapshot,
  BattlePresentationFrame,
  ProjectilePresentationPoint,
  FirearmPresentation,
  TacticalPoint,
  KnifePresentation,
  GrenadePresentation,
} from '../../../../packages/game/public/compatibility-types.ts';
import { absoluteBodyHeight } from '../../../../packages/game/sight-geometry.js';
import { surfaceHeight } from '../../../../packages/game/tactical-space.js';
import { actionPresentationDuration } from './action-pace';
import type { CombatEffectEvent, EffectPoint } from './combat-effects';

type LocalEffect<Visual> = {
  id: number;
  startedAt: number;
  visual: Visual;
} | null;
const point = (p: ProjectilePresentationPoint): EffectPoint => ({
  x: p?.x,
  y: p?.y,
  height: p?.height,
  ...(p?.tacticalLevel === undefined ? {} : { tacticalLevel: p.tacticalLevel }),
  ...(p?.fraction === undefined ? {} : { fraction: p.fraction }),
});
const landing = (state: BattleSnapshot, p: TacticalPoint) => ({
  x: p?.x,
  y: p?.y,
  tacticalLevel: p?.tacticalLevel ?? 0,
  elevation: surfaceHeight(state, p) ?? NaN,
});
const finite = (p: ProjectilePresentationPoint | undefined) =>
  p && [p.x, p.y, p.height].every(Number.isFinite);
const samePoint = (a: ProjectilePresentationPoint | undefined, b: ProjectilePresentationPoint) =>
  Boolean(a) && a?.x === b.x && a.y === b.y && a.height === b.height;
const validShotPath = (p: ProjectilePresentationPoint[] | undefined, shot: FirearmPresentation) =>
  p === undefined ||
  (Array.isArray(p) &&
    p.length >= 2 &&
    p.length <= 256 &&
    p.every(finite) &&
    samePoint(p[0], shot.source) &&
    samePoint(p.at(-1), shot.impact));

/** Copy only already admitted presentation records. The renderer gets no roster or private trajectory. */
export function presentCombatEffects(
  state: BattleSnapshot,
  frame: BattlePresentationFrame | null | undefined,
  knife: LocalEffect<KnifePresentation> = null,
  grenade: LocalEffect<GrenadePresentation> = null,
  admitted: readonly { key: string }[] = [],
): readonly CombatEffectEvent[] {
  const events: CombatEffectEvent[] = [],
    base = `${frame?.sequenceId ?? 'local'}:${frame?.index ?? 0}`,
    startedAtSeconds = (frame?.startedAt ?? 0) / 1000;
  const shot = frame?.shotVisual;
  if (
    frame &&
    shot?.visible &&
    finite(shot.source) &&
    finite(shot.impact) &&
    validShotPath(shot.points, shot) &&
    (frame.type === 'projectile' || frame.type === 'impact')
  ) {
    events.push({
      id: `${base}:firearm`,
      kind: 'firearm',
      stage: frame.type,
      startedAtSeconds,
      ...(frame.unitId ? { actorKey: `unit:${frame.unitId}` } : {}),
      ...((frame.durationMs ?? 0) > 0 ? { durationSeconds: (frame.durationMs ?? 0) / 1000 } : {}),
      visual: {
        visible: true,
        source: point(shot.source),
        impact: point(shot.impact),
        ...(shot.points ? { points: shot.points.map(point) } : {}),
        outcome: shot.outcome ?? null,
        ...(shot.material ? { material: shot.material } : {}),
        ...(shot.spread === undefined ? {} : { spread: Boolean(shot.spread) }),
        ...(shot.discharge === false ? { discharge: false } : {}),
        ...(shot.shotHand ? { shotHand: shot.shotHand } : {}),
        ...(typeof shot.shotId === 'string' || typeof shot.shotId === 'number'
          ? { shotId: shot.shotId }
          : {}),
        ...Object.fromEntries(
          (['bodyTargetKey', 'sourceBodyKey'] as const).flatMap((field) =>
            typeof shot[field] === 'string' &&
            admitted.filter((actor) => actor.key === shot[field]).length === 1
              ? [[field, shot[field]]]
              : [],
          ),
        ),
      },
    });
  }
  const thrown = frame?.knifeVisual
    ? {
        id: `${base}:knife`,
        startedAt: frame.startedAt ?? 0,
        visual: frame.knifeVisual,
      }
    : knife
      ? { ...knife, id: `local:knife:${knife.id}` }
      : null;
  if (thrown?.visual?.visible) {
    const v = thrown.visual,
      source = {
        ...point(v.source),
        height:
          v.source?.height ??
          absoluteBodyHeight(state, { ...v.source, stance: 'standing' }, 'muzzle'),
      };
    if (finite(source) && finite(v.impact)) {
      events.push({
        id: thrown.id,
        kind: 'knife',
        startedAtSeconds: thrown.startedAt / 1000,
        durationSeconds: actionPresentationDuration(0.6),
        visual: {
          visible: true,
          source,
          impact: point(v.impact),
          ...(v.weapon !== undefined ? { weapon: v.weapon } : {}),
        },
      });
    }
  }
  const bomb = frame?.grenadeEffect
    ? {
        ...frame.grenadeEffect,
        id: `${frame.sequenceId}:grenade:${frame.grenadeEffect.id}`,
      }
    : grenade
      ? { ...grenade, id: `local:grenade:${grenade.id}` }
      : null;
  if (bomb?.visual?.visible) {
    const v = bomb.visual,
      ground = landing(state, v.landing);
    if (
      finite(v.source) &&
      finite(v.impact) &&
      Number.isFinite(ground.elevation) &&
      Array.isArray(v.points) &&
      v.points.length >= 2 &&
      v.points.length <= 256 &&
      v.points.every(finite)
    ) {
      events.push({
        id: bomb.id,
        kind: 'grenade',
        startedAtSeconds: bomb.startedAt / 1000,
        durationSeconds: actionPresentationDuration(1.2),
        visual: {
          visible: true,
          source: point(v.source),
          impact: point(v.impact),
          landing: ground,
          points: v.points.map(point),
          radius: v.radius,
          detonated: Boolean(v.detonated),
        },
      });
    }
  }
  const cannon = frame?.artilleryVisual;
  if (frame && cannon?.visible && finite(cannon.source)) {
    events.push({
      id: `${base}:artillery`,
      kind: 'artillery',
      ...(cannon.cannonId ? { cannonId: cannon.cannonId } : {}),
      stage: frame.type === 'projectile' || frame.type === 'impact' ? frame.type : 'effect',
      startedAtSeconds,
      ...((frame.durationMs ?? 0) > 0 ? { durationSeconds: (frame.durationMs ?? 0) / 1000 } : {}),
      visual: {
        visible: true,
        source: point(cannon.source),
        ...(cannon.impact ? { impact: point(cannon.impact) } : {}),
        ...(Array.isArray(cannon.points) ? { points: cannon.points.map(point) } : {}),
        ...(Array.isArray(cannon.impacts)
          ? {
              impacts: cannon.impacts.map((p) => ({
                ...point(p),
                outcome: p.outcome ?? null,
                ...(p.material ? { material: p.material } : {}),
              })),
            }
          : {}),
        ...(cannon.canister ? { canister: true } : {}),
        ...(cannon.discharge === false ? { discharge: false } : {}),
      },
    });
  }
  return events;
}
