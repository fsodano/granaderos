import authoredProfile from './locomotion-profile.json';
type GaitProfile = {
  nativeStrideSpeed: number;
  duration: number;
  playbackRate: number;
};
type LocomotionProfile = {
  appearances: Readonly<Record<string, string>>;
  banks: Readonly<
    Record<
      string,
      {
        actions: Readonly<Record<string, { duration: number }>>;
        clips: Readonly<Record<string, GaitProfile>>;
      }
    >
  >;
  horse: Readonly<Record<string, GaitProfile>>;
  itemAliases: Readonly<Record<string, string>>;
  itemClips: Readonly<Record<string, Readonly<Record<string, string>>>>;
};
const profile: LocomotionProfile = authoredProfile;
import { spriteAppearance } from '../../../../packages/game/sprite-appearances.ts';
import { spriteEquipment } from '../../../../packages/game/sprite-equipment.js';
import { resolveActorAction } from '../../../../packages/game/actor-action-contract.ts';
import { actorItems, actorPosture } from './presentation';
import { TILE_METRES, actorYaw } from './projection';
import { locomotionReference, footMovementPace } from './locomotion-reference';

import type { BattleBody } from '../../../../packages/game/public/compatibility-types.ts';
type Point = { x: number; y: number; kind?: string; renderedHeight?: number };
// A supported ladder ascent raises the feet about 65 cm each second.
export const CLIMB_VERTICAL_METRES_PER_SECOND = 0.65;
/** Presentation travel uses the same measured metre/second speed as the gait.
 * AP, simulation time, positions and the paid route remain authoritative. */
export function movementStepDuration(
  unit: BattleBody,
  from: Point,
  to: Point,
  requested?: number,
  preserveFacing = false,
) {
  const fallback =
    requested ??
    (unit.mounted
      ? 150
      : unit.stance === 'prone' || unit.movementMode === 'prone'
        ? 420
        : unit.movementMode === 'crouch'
          ? 320
          : unit.movementMode === 'run'
            ? 150
            : 240);
  const appearance = spriteAppearance(unit),
    bank = profile.appearances[appearance];
  if (to.kind === 'climb') {
    const height = (to.renderedHeight ?? 0) - (from.renderedHeight ?? 0),
      action = height < 0 ? 'life.climbDown' : 'life.climbUp';
    const native = (bank ? profile.banks[bank] : undefined)?.actions[action];
    if (!native) {
      throw Error(`Missing climb profile: ${appearance}:${action}`);
    }
    return Math.max(
      fallback,
      native.duration * 1000,
      (Math.abs(height) / CLIMB_VERTICAL_METRES_PER_SECOND) * 1000,
    );
  }
  const posture = actorPosture(unit),
    equipment = spriteEquipment(unit);
  let action =
    !unit.mounted && posture === 'prone' ? 'crawl' : unit.movementMode === 'run' ? 'run' : 'walk';
  if (preserveFacing && !unit.mounted && ['walk', 'run'].includes(action)) {
    const yaw = actorYaw(
        typeof unit.facing === 'number' && Number.isInteger(unit.facing)
          ? (unit.facing + 1) % 8
          : 3,
      ),
      x = to.x - from.x,
      y = to.y - from.y;
    const forward = x * Math.sin(yaw) + y * Math.cos(yaw),
      left = x * Math.cos(yaw) - y * Math.sin(yaw);
    if (Math.abs(left) > Math.abs(forward) + 0.01) {
      action = left > 0 ? 'strafeLeft' : 'strafeRight';
    }
  }
  let gait: { nativeStrideSpeed: number; duration: number; playbackRate: number } | undefined;
  if (unit.mounted) {
    gait = profile.horse[action];
  } else {
    const capability = resolveActorAction({ action, posture, equipment });
    if (!capability) {
      throw Error(`Unsupported movement gait: ${action}:${posture}:${equipment}`);
    }
    const held = actorItems(unit).find((item) => item.socket === 'handRight'),
      id = held && (profile.itemAliases[held.id] ?? held.id);
    const overrides = id ? profile.itemClips[id] : undefined;
    const semantic = locomotionReference(overrides?.[capability.clip] ?? capability.clip);
    const clips = (bank ? profile.banks[bank] : undefined)?.clips;
    gait = clips?.[semantic];
  }
  if (!gait) {
    throw Error(`Missing movement profile: ${appearance}:${action}`);
  }
  const distance = Math.hypot(to.x - from.x, to.y - from.y) * TILE_METRES;
  const pace = footMovementPace(action, posture, Boolean(unit.mounted));
  return (
    Math.max(fallback, (distance / (gait.nativeStrideSpeed * gait.playbackRate * pace)) * 1000) *
    (preserveFacing ? 1.25 : 1)
  );
}
