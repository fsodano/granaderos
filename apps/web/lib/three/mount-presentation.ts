import { nativeAnimationClip } from './animation-profiles';
import type { BattlePresentationFrame } from '../../../../packages/game/public/compatibility-types.ts';
import { spriteAppearance } from '../../../../packages/game/sprite-appearances.ts';

/** Admission must cover both sides of a successful mount-state change.
 * The helper cannot infer or disclose a hidden rider's preparation. */
export function admittedMountTransitions(frames: readonly BattlePresentationFrame[]) {
  const result = frames.map((frame) => ({ ...frame }));
  for (let index = 0; index < frames.length; index++) {
    const start = frames[index];
    if (!start || start.type !== 'prepare' || start.action !== 'mount' || !start.unitId) {
      continue;
    }
    let endIndex = index + 1;
    while (
      endIndex < frames.length &&
      frames[endIndex]?.type !== 'prepare' &&
      frames[endIndex]?.type !== 'result'
    ) {
      endIndex++;
    }
    const end = frames[endIndex];
    if (
      end?.type !== 'result' ||
      end.action !== 'mount' ||
      end.unitId !== start.unitId ||
      end.performed === false
    ) {
      continue;
    }
    const before = start.state.units.find((unit) => unit.id === start.unitId),
      after = end.state.units.find((unit) => unit.id === end.unitId);
    if (
      !before ||
      !after ||
      before.hp <= 0 ||
      after.hp <= 0 ||
      before.unconscious ||
      after.unconscious ||
      after.knockedDown ||
      Boolean(before.mounted) === Boolean(after.mounted)
    ) {
      continue;
    }
    const action = after.mounted ? 'mount' : 'dismount',
      from = before.mounted ? 'mounted' : 'standing';
    const initial = result[index],
      final = result[endIndex];
    if (initial && final) {
      initial.mountAction = action;
      initial.mountFromPosture = from;
      final.mountComplete = true;
    }
  }
  return result;
}

/** One protected native preparation contains the complete physical move.
 * The result commits rules normally and holds the final idle pose. */
export function mountFrameDuration(frame: BattlePresentationFrame, requested: number) {
  if (frame.type !== 'prepare' || !frame.mountAction || !frame.unitId) {
    return requested;
  }
  const unit = frame.state.units.find((unit) => unit.id === frame.unitId);
  if (!unit) {
    return requested;
  }
  const clip = nativeAnimationClip(spriteAppearance(unit), `life.${frame.mountAction}`);
  return Math.max(requested, clip.duration * 1000);
}
