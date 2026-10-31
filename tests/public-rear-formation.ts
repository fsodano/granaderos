import type { BattleSnapshot, BattleUnit, TacticalPoint } from '../packages/game/public/compatibility-types.ts';
import type { ReachableCell } from '../packages/game/public/tactical-query-types.ts';
import type { PublicRifleReserve } from './public-support-staging.ts';
import { present } from './assert-present.ts';
type RearOptions={reserveIds?:readonly (number|string)[]};
import {
  getReachable,
  hasFirearm,
  interruptAvailable,
  artilleryContact,
  actionCosts,
  carriedWeight,
  carryCapacity,
} from '../packages/game/tactical.js';
import { sameCell, sameSurface, spacePoint } from '../packages/game/tactical-space.js';
import { firearmServiceable } from '../packages/game/firearm-serviceability.js';
import { publicRouteView } from './route-infantry-progress.ts';
import { previewPublicPaidWalk, previewPublicRifleReserve } from './public-support-staging.ts';

const distance = (a:TacticalPoint, b:TacticalPoint) => Math.hypot(a.x - b.x, a.y - b.y),
  MAX_BOUND_AP = 16;
const fit = (u:BattleUnit|null|undefined):u is BattleUnit =>
  u !== null && u !== undefined && u.hp >= 15 &&
  !u.departure &&
  !u.fled &&
  !u.routed &&
  !u.unconscious &&
  !u.surrendered &&
  !u.asleep &&
  !u.captured;
const clinical = (u:BattleUnit) =>
  ['doctor', 'militia_doctor', 'patient'].includes(u.assignment ?? '') ||
  (u.activeSlot ?? 'primary') === 'medical';
const chargedContact = (view:BattleSnapshot, u:BattleUnit) =>
  view.artillery.some(
    (g) => g.side === u.side && (g.loaded || g.ammo > 0) && artilleryContact(view, u, g),
  );

// A separate full-idle-pass doctrine. Ordinary fire, aid and loading have
// already received a complete squad pass before this fallback is considered.
// It never releases the required rear when the existing screen is absent.
export function publicRearFormationFollowPlan(battle:BattleSnapshot, unit:BattleUnit, { reserveIds = [] }:RearOptions = {}) {
  if (
    battle.status !== 'active' ||
    battle.mode !== 'combat' ||
    battle.phase !== 'player' ||
    battle.reactionStack?.length
  ) {
    return null;
  }
  const reserves = new Set([...reserveIds].map(String)),
    view = publicRouteView(battle, unit),
    u = view.units.find((other) => other.id === unit.id);
  if (
    !u ||
    !reserves.has(u.id) ||
    u.side !== 'player' ||
    !fit(u) ||
    u.hp !== u.maxHp ||
    u.bleeding ||
    u.medical >= 60 ||
    clinical(u) ||
    u.missionAlly ||
    u.knockedDown ||
    u.entangled ||
    u.mounted ||
    u.stealthMode ||
    (u.activeSlot ?? 'primary') !== 'primary' ||
    u.weaponMode === 'melee' ||
    !u.loaded ||
    u.jammed ||
    u.weaponDropped ||
    !hasFirearm(u) ||
    !firearmServiceable(u) ||
    !interruptAvailable(view, u) ||
    u.energy <= 0 ||
    carriedWeight(u) > carryCapacity(u) ||
    chargedContact(view, u)
  ) {
    return null;
  }
  // Keep EXACTLY the existing rear screen predicate and sort. Medical 70
  // and unarmed/empty nonreserves still count; this is not an armed-screen rule.
  const screen = battle.units
    .filter(
      (other) =>
        other.side === unit.side &&
        !reserves.has(other.id) &&
        other.medical < 90 &&
        other.hp >= 15 &&
        !other.departure &&
        !other.routed &&
        !other.unconscious &&
        !other.surrendered,
    )
    .sort((a, b) => b.x - a.x || b.marksmanship - a.marksmanship);
  if (!screen.length) {
    return null;
  }
  const lead = present(screen[Math.min(1, screen.length - 1)]);
  if (!sameSurface(u, lead)) {
    return null;
  }
  const goal = { x: Math.max(0, lead.x - 4), y: lead.y, tacticalLevel: lead.tacticalLevel ?? 0 };
  if (distance(u, goal) <= 2) {
    return null;
  }
  // Public geometry planning may route around a wall/cart. It grants neither
  // future AP nor passage. The next order is an actual current reachable prefix.
  const route = getReachable({ ...view, mode: 'exploration' }, u, {
    stopAt: (point) => sameSurface(point, u) && point.x <= goal.x && distance(point, goal) <= 2,
  })[0];
  if (
    !route?.path?.length ||
    !route.path.every(
      (step) => (step.kind === undefined || step.kind === 'move') && sameSurface(step, u),
    )
  ) {
    return null;
  }
  const current = new Map(
    getReachable(view, u).map((point) => [
      `${point.x},${point.y},${point.tacticalLevel ?? 0}`,
      point,
    ]),
  );
  const seen = view.units.filter(
    (other) => other.side !== u.side && fit(other) && sameSurface(other, u),
  );
  const rows:{point:ReachableCell;paid:number;fireReserve:PublicRifleReserve|{totalPA:number;useful:false;targetId:null};routePrefix:number}[] = [];
  for (let index = 0; index < Math.min(3, route.path.length); index++) {
    const step = present(route.path[index]),
      point = current.get(`${step.x},${step.y},${step.tacticalLevel ?? 0}`);
    if (
      !point ||
      point.path.length !== index + 1 ||
      !point.path.every((cell, i) => sameCell(cell, present(route.path[i]))) ||
      !point.path.every(
        (cell) =>
          sameSurface(cell, u) &&
          cell.x <= goal.x &&
          !seen.some((contact) => distance(cell, contact) < 3),
      )
    ) {
      continue;
    }
    const walked = previewPublicPaidWalk(view, u, point, Math.min(MAX_BOUND_AP, u.ap));
    if (!walked) {
      continue;
    }
    // If a target is currently public, quote paid final facing, posture and aim.
    // Without a target, retain the actual native basic discharge quote only;
    // no target location, hit chance or future firing opportunity is invented.
    const reserve = seen.length
      ? previewPublicRifleReserve(walked.view, walked.actor, seen)
      : { totalPA: actionCosts(walked.view, walked.actor).fire, useful: false as const, targetId: null };
    if (
      !reserve ||
      !Number.isFinite(reserve.totalPA) ||
      reserve.totalPA < 0 ||
      walked.actor.ap < reserve.totalPA
    ) {
      continue;
    }
    rows.push({ point, paid: walked.paid, fireReserve: reserve, routePrefix: index + 1 });
  }
  const row = rows.sort(
    (a, b) =>
      b.routePrefix - a.routePrefix ||
      a.point.cost - b.point.cost ||
      a.point.y - b.point.y ||
      a.point.x - b.point.x,
  )[0];
  return row
    ? {
        kind: 'rear-formation-follow' as const,
        unitId: u.id,
        screenId: lead.id,
        goal,
        route: row.point,
        paid: row.paid,
        fireReserve: row.fireReserve,
        action: { type: 'move' as const, unitId: u.id, ...spacePoint(row.point) },
      }
    : null;
}

// The actual screen can be lost while the required rear still lives. After
// the existing no-contact search threshold, an ordinary public search is
// allowed only in exploration, not an early combat advance or a shared bound.
export function publicLateRearSearchEligible(battle:BattleSnapshot, unit:BattleUnit, { reserveIds = [] }:RearOptions = {}) {
  if (
    battle.status !== 'active' ||
    battle.mode !== 'exploration' ||
    battle.turn < 20 ||
    battle.phase !== 'player' ||
    battle.reactionStack?.length
  ) {
    return false;
  }
  const reserves = new Set(reserveIds.map(String)),
    view = publicRouteView(battle, unit),
    u = view.units.find((other) => other.id === unit.id);
  if (
    !u ||
    !reserves.has(u.id) ||
    u.side !== 'player' ||
    !fit(u) ||
    u.hp !== u.maxHp ||
    u.bleeding ||
    u.medical >= 60 ||
    clinical(u) ||
    u.missionAlly ||
    u.knockedDown ||
    u.entangled ||
    u.mounted ||
    u.stealthMode ||
    (u.activeSlot ?? 'primary') !== 'primary' ||
    u.weaponMode === 'melee' ||
    !u.loaded ||
    u.jammed ||
    u.weaponDropped ||
    !hasFirearm(u) ||
    !firearmServiceable(u) ||
    !interruptAvailable(view, u) ||
    u.energy <= 0 ||
    carriedWeight(u) > carryCapacity(u) ||
    chargedContact(view, u)
  ) {
    return false;
  }
  // Keep the same current screen predicate, including unarmed/medical70
  // nonreserves. It is actual own-team state, never a hidden target route.
  return !battle.units.some(
    (other) =>
      other.side === u.side &&
      !reserves.has(other.id) &&
      other.medical < 90 &&
      other.hp >= 15 &&
      !other.departure &&
      !other.routed &&
      !other.unconscious &&
      !other.surrendered,
  );
}
