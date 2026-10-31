import type { BattleSnapshot, BattleUnit, BattleArtillery, BattleStance, TacticalPoint } from '../packages/game/public/compatibility-types.ts';
import type { ReachableCell } from '../packages/game/public/tactical-query-types.ts';
import type { HeldReloadPlan, HeldReprimePlan, FirearmShotPreview } from '../packages/game/public/tactical-preview-types.ts';
import type { RouteRifleShot } from './route-infantry-progress.ts';
import { present } from './assert-present.ts';
export type SupportWorkAction = RouteRifleShot | {type:'weapon'|'useItem';unitId:string;targetId:string} | {type:'reload'|'reprime';unitId:string} | {type:'stance';unitId:string;stance:BattleStance;followUp:SupportWorkAction};
export type SupportWork = SupportWorkAction & {pa:number};
type WorkStock = Pick<BattleUnit,'loaded'|'inventory'|'medkits'> & {ammo:BattleUnit['ammo'];activeSlot:string;jammed:BattleUnit['jammed'];condition:BattleUnit['condition']};
export interface SupportWorkQuote {action:SupportWorkAction;stock:WorkStock;pa:number;next?:SupportWorkQuote;plan?:HeldReloadPlan|HeldReprimePlan;patientId?:string;shots?:Pick<FirearmShotPreview,'hand'|'weapon'|'chance'|'damageFactor'>[]}
export type PreservedWork = {before:SupportWorkQuote[];steps:{point:TacticalPoint;quotes:SupportWorkQuote[]}[];afterClock:SupportWorkQuote[]};
export interface PaidWalkPreview {view:BattleSnapshot;actor:BattleUnit;paid:number;preservedWork?:PreservedWork}
export interface PublicRifleReserve {targetId:string;stance:BattleStance;stancePA:number;firePA:number;turnPA:number;readyPA:number;aim:number;aimPA:number;totalPA:number;useful:boolean}
type SupportOptions = {protectedIds?:readonly (number|string)[]};
import {
  getReachable,
  hasLineOfSight,
  hasFirearm,
  actionCosts,
  artilleryContact,
  interruptAvailable,
  movementEnergy,
  movementStepCost,
  carriedWeight,
  carryCapacity,
  stanceCost,
  AP_CARRY_LIMIT,
  reloadPlan,
  reprimePlan,
  medicalUsePreview,
  firearmVolleyPreview,
  teamCanSee,
} from '../packages/game/tactical.js';
import { sameCell, sameSurface, spacePoint, surfaceAt } from '../packages/game/tactical-space.js';
import { directionTo } from '../packages/game/tactical-awareness.js';
import { firearmServiceable } from '../packages/game/firearm-serviceability.js';
import { availableAmmunition } from '../packages/game/ammunition-types.js';
import { limitEnergy } from '../packages/game/fatigue.js';
import { lowerWeapon } from '../packages/game/weapon-readiness.js';
import { advanceBattleClock, COMBAT_ROUND_SECONDS } from '../packages/game/time.js';
import { medicalPatientAvailable } from '../packages/game/medical-patient.js';
import { criticalFirstAidNeeded } from '../packages/game/first-aid.js';
import { publicRouteView, usefulRouteRifleShot } from './route-infantry-progress.ts';
import { knownRouteShotSafety } from './route-fire-safety.ts';

const distance = (a:TacticalPoint, b:TacticalPoint) => Math.hypot(a.x - b.x, a.y - b.y),
  PROGRESS_EPSILON = 1e-9,
  OPTIONAL_MOVE_AP = 16;
const fit = (u:BattleUnit|null|undefined):u is BattleUnit =>
  u !== null && u !== undefined && u.hp >= 15 &&
  !u.departure &&
  !u.fled &&
  !u.routed &&
  !u.unconscious &&
  !u.surrendered &&
  !u.asleep &&
  !u.captured;
const charged = (g:BattleArtillery) => g.loaded || g.ammo > 0;
const armed = (u:BattleUnit|null|undefined) =>
  fit(u) &&
  (u.activeSlot ?? 'primary') === 'primary' &&
  u.weaponMode !== 'melee' &&
  !u.weaponDropped &&
  hasFirearm(u) &&
  firearmServiceable(u) &&
  (u.loaded > 0 || availableAmmunition(u) > 0);
const knownCrewContact = (view:BattleSnapshot, u:BattleUnit) =>
  view.artillery.some((g) => g.side === u.side && charged(g) && artilleryContact(view, u, g));
const eligible = (view:BattleSnapshot, u:BattleUnit|null|undefined, held:ReadonlySet<string>) =>
  u?.side === 'player' &&
  u.medical < 60 &&
  armed(u) &&
  u.loaded > 0 &&
  !u.jammed &&
  !u.knockedDown &&
  !u.entangled &&
  !u.mounted &&
  !u.stealthMode &&
  u.hp === u.maxHp &&
  !u.bleeding &&
  u.energy > 0 &&
  !held.has(u.id) &&
  interruptAvailable(view, u) &&
  carriedWeight(u) <= carryCapacity(u) &&
  !knownCrewContact(view, u);
const contacts = (view:BattleSnapshot) => view.units.filter((other) => other.side !== 'player' && fit(other));
const nearest = (point:TacticalPoint, rows:readonly TacticalPoint[]) => Math.min(...rows.map((row) => distance(point, row)));
const cover = (view:BattleSnapshot, point:TacticalPoint) => surfaceAt(view, point)?.cover ?? 0;

// Native beginUnitTurn supplies maxAP + carriedAP. Paid orders and reactions
// deplete ap; interrupts never refill it. Count ALL current depletion, not a
// private staging counter. Fresh contact can discard a prior carryover, so
// this can overcount spent AP conservatively; it can never grant new AP.
export function publicSupportAPDepletion(u:BattleUnit|null|undefined) {
  const base = u?.maxAP,
    carry = u?.carriedAP ?? 0,
    ap = u?.ap;
  if (
    typeof base !== 'number' || !Number.isFinite(base) ||
    base < 0 ||
    base > 100 ||
    !Number.isInteger(carry) ||
    carry < 0 ||
    carry > AP_CARRY_LIMIT ||
    typeof ap !== 'number' || !Number.isFinite(ap) ||
    ap < 0 ||
    ap > base + carry
  ) {
    return null;
  }
  return base + carry - ap;
}
const budget = (u:BattleUnit) => {
  const spent = publicSupportAPDepletion(u);
  return spent === null ? 0 : Math.max(0, Math.min(u.ap, OPTIONAL_MOVE_AP - spent));
};

function postureView(view:BattleSnapshot, u:BattleUnit, stance:BattleStance) {
  const paid = stance === u.stance ? 0 : stanceCost(u, stance),
    actor = { ...u, ap: u.ap - paid };
  if (paid) {
    actor.stance = stance;
    actor.movementMode = stance === 'prone' ? 'prone' : stance === 'crouched' ? 'crouch' : 'walk';
    lowerWeapon(actor);
    actor.momentum = 0;
  }
  return {
    view: { ...view, units: view.units.map((other) => (other.id === u.id ? actor : other)) },
    actor,
    paid,
  };
}

// Pure Native previews only. Do not call another actor's stateful ordinary
// controller. A useful paid posture must leave a useful payable shot. Local
// aid and real complete loading/pan work also precede optional movement.
function ordinaryWork(view:BattleSnapshot, u:BattleUnit):SupportWork|null {
  if (!fit(u) || u.knockedDown || u.entangled || !interruptAvailable(view, u)) {
    return null;
  }
  if (u.medkits > 0 && u.medical > 0) {
    for (const patient of view.units.filter(
      (other) =>
        other.side === u.side &&
        medicalPatientAvailable(other) &&
        (other.bleeding > 0 || criticalFirstAidNeeded(other)) &&
        sameSurface(u, other) &&
        distance(u, other) <= 1.5 &&
        hasLineOfSight(view, u, other),
    )) {
      const switchPA = u.activeSlot === 'medical' ? 0 : actionCosts(view, u).weapon,
        doctor = { ...u, activeSlot: 'medical' as const, ap: u.ap - switchPA },
        medical = medicalUsePreview(view, doctor, patient);
      if (switchPA <= u.ap && medical.allowed) {
        return {
          unitId: u.id,
          type: switchPA ? 'weapon' : 'useItem',
          targetId: patient.id,
          pa: switchPA + medical.cost,
        };
      }
    }
  }
  if (!armed(u)) {
    return null;
  }
  const pan = reprimePlan(u, view);
  if (u.jammed && !pan.reason && pan.pa > 0) {
    return { unitId: u.id, type: 'reprime', pa: pan.pa };
  }
  if (!u.loaded && !u.jammed) {
    const loading = reloadPlan(u, view);
    if (!loading.reason && loading.totalPA > 0 && loading.pa === loading.totalPA) {
      return { unitId: u.id, type: 'reload', pa: loading.pa };
    }
    if (u.stance === 'prone') {
      const posed = postureView(view, u, 'crouched'),
        next = reloadPlan(posed.actor, posed.view);
      if (posed.paid > 0 && !next.reason && next.totalPA > 0 && next.pa === next.totalPA) {
        return {
          unitId: u.id,
          type: 'stance',
          stance: 'crouched',
          followUp: { type: 'reload', unitId: u.id },
          pa: posed.paid + next.totalPA,
        };
      }
    }
  }
  const shot = usefulRouteRifleShot(view, u);
  if (shot) {
    const target = view.units.find((other) => other.id === shot.targetId),
      cost = actionCosts(view, u, target);
    return { ...shot, pa: cost.fire + shot.aim * cost.aim };
  }
  if (!u.loaded || u.jammed || u.mounted) {
    return null;
  }
  for (const stance of ['crouched', 'prone'] as const) {
    const posed = postureView(view, u, stance);
    if (!(posed.paid > 0 && posed.actor.ap > 0)) {
      continue;
    }
    const next = usefulRouteRifleShot(posed.view, posed.actor);
    if (next) {
      const target = view.units.find((other) => other.id === next.targetId),
        cost = actionCosts(posed.view, posed.actor, target);
      return {
        unitId: u.id,
        type: 'stance',
        stance,
        followUp: next,
        pa: posed.paid + cost.fire + next.aim * cost.aim,
      };
    }
  }
  return null;
}

export function publicSupportPriorityWork(battle:BattleSnapshot, unit:BattleUnit, { protectedIds: _protectedIds = [] }:SupportOptions = {}) {
  const view = publicRouteView(battle, unit),
    u = view.units.find((other) => other.id === unit.id),
    seen = contacts(view).filter((other) => sameSurface(other, u));
  if (!u || !seen.length) {
    return null;
  }
  const own = ordinaryWork(view, u);
  if (own) {
    return own;
  }
  // "Front" is a current same-level armed friend (or held medical user)
  // closer to public contacts with real LOS. Protected people keep work too.
  const front = view.units
    .filter(
      (other) =>
        other.side === u.side &&
        other.id !== u.id &&
        fit(other) &&
        (armed(other) ||
          (other.activeSlot === 'medical' && other.medkits > 0 && other.medical > 0)) &&
        sameSurface(other, u) &&
        !knownCrewContact(view, other) &&
        nearest(other, seen) < nearest(u, seen) - PROGRESS_EPSILON &&
        seen.some((target) => hasLineOfSight(view, other, target)),
    )
    .sort(
      (a, b) => nearest(a, seen) - nearest(b, seen) || String(a.id).localeCompare(String(b.id)),
    );
  for (const actor of front) {
    const work = ordinaryWork(view, actor);
    if (work) {
      return work;
    }
  }
  return null;
}

// Preserve CURRENT public work, not a blanket actor ordering. A friend can
// fire while an idle support approaches behind its muzzle. Quote the exact
// action/target before planning, then recheck it at EVERY paid path cell.
function currentWorkQuote(view:BattleSnapshot, u:BattleUnit|null|undefined, action:SupportWorkAction|null|undefined):SupportWorkQuote|null {
  if (!action || !fit(u) || u.knockedDown || u.entangled || !interruptAvailable(view, u)) {
    return null;
  }
  const stock = {
    loaded: u.loaded,
    ammo: u.ammo,
    medkits: u.medkits,
    activeSlot: u.activeSlot ?? 'primary',
    jammed: u.jammed,
    condition: u.condition,
    inventory: u.inventory,
  };
  if (action.type === 'stance') {
    if (u.mounted) {
      return null;
    }
    const posed = postureView(view, u, action.stance),
      next = currentWorkQuote(posed.view, posed.actor, action.followUp);
    return posed.paid > 0 && next && posed.paid + next.pa <= u.ap
      ? { action, stock, pa: posed.paid + next.pa, next }
      : null;
  }
  if (action.type === 'fire') {
    const target = view.units.find((other) => other.id === action.targetId);
    if (
      !armed(u) ||
      !(u.loaded > 0) ||
      u.jammed ||
      !target ||
      !fit(target) ||
      !teamCanSee(view, u.side, target) ||
      !hasLineOfSight(view, u, target)
    ) {
      return null;
    }
    const cost = actionCosts(view, u, target),
      pa = cost.fire + action.aim * cost.aim;
    if (
      !(Number.isInteger(action.aim) && action.aim >= 0 && action.aim <= 4 && pa > 0 && pa <= u.ap)
    ) {
      return null;
    }
    // The Native volley traces the known body path for this exact aimed region
    // and each actual held hand. The safety predicate traces known civilians.
    const volley = firearmVolleyPreview(view, u, target, action.aim, action.hitLocation),
      first = volley.shots?.[0];
    const forecast = first && {
      ...first,
      aim: action.aim,
      hitLocation: action.hitLocation,
      ...(volley.paired ? { shots: volley.shots } : {}),
    };
    if (
      volley.reason ||
      !forecast ||
      forecast.chance < 25 ||
      !(forecast.damageFactor > 0) ||
      !knownRouteShotSafety(view, u, target)(forecast)
    ) {
      return null;
    }
    return {
      action,
      stock,
      pa,
      shots: volley.shots.map((shot) => ({
        hand: shot.hand,
        weapon: shot.weapon,
        chance: shot.chance,
        damageFactor: shot.damageFactor,
      })),
    };
  }
  if (action.type === 'reload' || action.type === 'reprime') {
    const plan = action.type === 'reload' ? reloadPlan(u, view) : reprimePlan(u, view),
      pa = plan.pa;
    if (
      plan.reason ||
      !(pa > 0 && pa <= u.ap) ||
      (action.type === 'reload' && (!('totalPA' in plan) || pa !== plan.totalPA))
    ) {
      return null;
    }
    return { action, stock, pa, plan };
  }
  if (action.type === 'weapon' || action.type === 'useItem') {
    const patient = view.units.find((other) => other.id === action.targetId),
      switchPA = action.type === 'weapon' ? actionCosts(view, u).weapon : 0;
    if (
      !patient ||
      !medicalPatientAvailable(patient) ||
      !(u.medkits > 0 && u.medical > 0) ||
      (action.type === 'useItem' && u.activeSlot !== 'medical') ||
      (action.type === 'weapon' && u.activeSlot === 'medical')
    ) {
      return null;
    }
    const doctor = { ...u, activeSlot: 'medical' as const, ap: u.ap - switchPA },
      medical = medicalUsePreview(view, doctor, patient);
    if (!medical.allowed || !(switchPA + medical.cost > 0 && switchPA + medical.cost <= u.ap)) {
      return null;
    }
    return { action, stock, pa: switchPA + medical.cost, patientId: patient.id };
  }
  return null;
}
function friendWorkQuotes(view:BattleSnapshot, u:BattleUnit) {
  const quotes:SupportWorkQuote[] = [];
  for (const friend of view.units.filter(
    (other) => other.side === u.side && other.id !== u.id && fit(other),
  )) {
    const work = ordinaryWork(view, friend);
    if (!work) {
      continue;
    }
    const quote = currentWorkQuote(view, friend, work);
    if (!quote) {
      return null;
    }
    quotes.push(quote);
    // Preserve useful paid postures too. Do not call another actor's ordinary
    // controller, or limit protection to the nearest screen/radius/one floor.
    if (work.type === 'fire' && !friend.mounted) {
      for (const stance of ['crouched', 'prone'] as const) {
        const posed = postureView(view, friend, stance);
        if (!(posed.paid > 0 && posed.actor.ap > 0)) {
          continue;
        }
        const followUp = usefulRouteRifleShot(posed.view, posed.actor);
        if (!followUp) {
          continue;
        }
        const posture = currentWorkQuote(view, friend, {
          type: 'stance',
          unitId: friend.id,
          stance,
          followUp,
        });
        if (!posture) {
          return null;
        }
        quotes.push(posture);
      }
    }
  }
  return quotes;
}
const exact = <T>(a:T, b:T) => JSON.stringify(a) === JSON.stringify(b);
function workPreserved(before:SupportWorkQuote, after:SupportWorkQuote|null|undefined):boolean {
  if (
    !after ||
    !exact(before.action, after.action) ||
    !exact(before.stock, after.stock) ||
    after.pa > before.pa
  ) {
    return false;
  }
  if (before.next && !workPreserved(before.next, after.next)) {
    return false;
  }
  if (before.plan && !exact(before.plan, after.plan)) {
    return false;
  }
  if (before.patientId !== after.patientId) {
    return false;
  }
  return (
    !before.shots ||
    before.shots.every((shot, index) => {
      const next = after.shots?.[index];
      return (
        next &&
        next.hand === shot.hand &&
        next.weapon === shot.weapon &&
        next.chance + PROGRESS_EPSILON >= shot.chance &&
        next.damageFactor + PROGRESS_EPSILON >= shot.damageFactor
      );
    })
  );
}
function quotePreservedWork(view:BattleSnapshot, work:SupportWorkQuote[]):SupportWorkQuote[]|null {
  const quotes = work.map((before) =>
    currentWorkQuote(
      view,
      view.units.find((other) => other.id === before.action.unitId),
      before.action,
    ),
  );
  return quotes.every((quote):quote is SupportWorkQuote => quote !== null) && work.every((before,index)=>workPreserved(before,quotes[index])) ? quotes : null;
}

// A forecast on an isolated PUBLIC copy, never an executed/post-reaction body.
// Match each Native paid forward walk step: lower the gun, update facing and
// momentum, spend actual AP and breath, and quote the first six combat seconds.
// Unknown collisions, reactions, noise and later outcomes remain authoritative.
function paidWalk(view:BattleSnapshot, u:BattleUnit, point:ReachableCell, limit:number, work:SupportWorkQuote[] = []):PaidWalkPreview|null {
  if (
    !(point.cost > 0 && point.cost <= limit) ||
    !point.path?.length ||
    point.path.length > 3 ||
    !point.path.every(
      (step) => (step.kind === undefined || step.kind === 'move') && sameSurface(step, u),
    )
  ) {
    return null;
  }
  const copy = structuredClone(view),
    actor = present(copy.units.find((other) => other.id === u.id));
  actor.braced = false;
  actor.overwatch = false;
  let paid = 0;
  const workTrace:PreservedWork['steps'] = [];
  for (const step of point.path) {
    const cost = movementStepCost(copy, actor, actor, step),
      surface = surfaceAt(copy, step);
    if (!Number.isFinite(cost) || cost <= 0 || actor.ap < cost || !surface) {
      return null;
    }
    const factor = actor.x !== step.x && actor.y !== step.y ? 1.4 : 1,
      energy = Math.ceil(movementEnergy(actor, surface, false) * factor),
      direction = `${step.x - actor.x},${step.y - actor.y}`,
      facing = directionTo(actor, step);
    paid += cost;
    lowerWeapon(actor);
    limitEnergy(actor);
    Object.assign(actor, spacePoint(step), {
      ap: actor.ap - cost,
      facing,
      momentum: direction === actor.lastDirection ? actor.momentum + 1 : 1,
      lastDirection: direction,
      energy: Math.max(0, Math.round((actor.energy - energy) * 1000) / 1000),
    });
    delete actor.lastTargetId;
    delete actor.lastShotPosition;
    if (actor.energy <= 0) {
      return null;
    }
    const quoted = quotePreservedWork(copy, work);
    if (!quoted) {
      return null;
    }
    workTrace.push({ point: spacePoint(actor), quotes: quoted });
  }
  if (paid !== point.cost || !sameCell(actor, point)) {
    return null;
  }
  if (!copy.roundTimeCharged) {
    advanceBattleClock(copy, COMBAT_ROUND_SECONDS);
    copy.roundTimeCharged = true;
  }
  const finalWork = quotePreservedWork(copy, work);
  if (!finalWork) {
    return null;
  }
  return {
    view: copy,
    actor,
    paid,
    ...(work.length
      ? { preservedWork: { before: work, steps: workTrace, afterClock: finalWork } }
      : {}),
  };
}

// Reserve Native turn/raise/discharge, actual aim and paid posture against an
// already public target. Prefer a currently useful payable shot; where LOS
// still blocks it, reserve the real cost of prone + four aims conservatively.
// That latter quote is AP protection, not a claim that a shot is executable.
function rifleReserve(view:BattleSnapshot, u:BattleUnit, seen:readonly BattleUnit[]):PublicRifleReserve|null {
  const choices:PublicRifleReserve[] = [];
  for (const stance of ([u.stance ?? 'standing', 'crouched', 'prone'] as const).filter(
    (value, index, rows) => rows.indexOf(value) === index,
  )) {
    const posed = postureView(view, u, stance),
      shot = posed.actor.ap > 0 ? usefulRouteRifleShot(posed.view, posed.actor) : null;
    if (!shot) {
      continue;
    }
    const target = seen.find((other) => other.id === shot.targetId);
    if (!target) {
      continue;
    }
    const cost = actionCosts(posed.view, posed.actor, target);
    choices.push({
      targetId: target.id,
      stance,
      stancePA: posed.paid,
      firePA: cost.fire,
      turnPA: cost.turn,
      readyPA: cost.ready,
      aim: shot.aim,
      aimPA: shot.aim * cost.aim,
      totalPA: posed.paid + cost.fire + shot.aim * cost.aim,
      useful: true,
    });
  }
  if (choices.length) {
    return choices.sort(
      (a, b) => a.totalPA - b.totalPA || String(a.targetId).localeCompare(String(b.targetId)),
    )[0] ?? null;
  }
  const target = seen
    .slice()
    .sort((a, b) => distance(u, a) - distance(u, b) || String(a.id).localeCompare(String(b.id)))[0];
  if (!target) {
    return null;
  }
  const posed = postureView(view, u, 'prone'),
    cost = actionCosts(posed.view, posed.actor, target);
  return {
    targetId: target.id,
    stance: 'prone',
    stancePA: posed.paid,
    firePA: cost.fire,
    turnPA: cost.turn,
    readyPA: cost.ready,
    aim: 4,
    aimPA: 4 * cost.aim,
    totalPA: posed.paid + cost.fire + 4 * cost.aim,
    useful: false,
  };
}

function payableRoute(view:BattleSnapshot, u:BattleUnit, point:ReachableCell, work:SupportWorkQuote[] = []) {
  const walked = paidWalk(view, u, point, budget(u), work);
  if (!walked) {
    return null;
  }
  const seen = contacts(view).filter((other) => sameSurface(other, u)),
    reserve = rifleReserve(walked.view, walked.actor, seen);
  return reserve && walked.actor.ap >= reserve.totalPA
    ? {
        point,
        reserve,
        apDepleted: publicSupportAPDepletion(u),
        paid: walked.paid,
        ...(walked.preservedWork ? { preservedWork: walked.preservedWork } : {}),
      }
    : null;
}
function screenFor(view:BattleSnapshot, u:BattleUnit, held:ReadonlySet<string>, seen:readonly BattleUnit[]) {
  return (
    view.units
      .filter(
        (other) =>
          other.side === u.side &&
          other.id !== u.id &&
          armed(other) &&
          !held.has(other.id) &&
          !other.knockedDown &&
          !other.entangled &&
          sameSurface(other, u) &&
          !knownCrewContact(view, other) &&
          seen.some(
            (contact) => sameSurface(other, contact) && hasLineOfSight(view, other, contact),
          ),
      )
      .sort(
        (a, b) =>
          nearest(a, seen) - nearest(b, seen) ||
          b.marksmanship - a.marksmanship ||
          String(a.id).localeCompare(String(b.id)),
      )[0] ?? null
  );
}
const behind = (point:TacticalPoint, screen:TacticalPoint, seen:readonly TacticalPoint[]) =>
  seen.every(
    (contact) =>
      sameSurface(point, contact) &&
      distance(point, contact) >= Math.max(3, distance(screen, contact) + 1),
  );

function stages(view:BattleSnapshot, u:BattleUnit, _held:ReadonlySet<string>, seen:readonly BattleUnit[], screen:BattleUnit|null, work:SupportWorkQuote[] = []) {
  if (!screen || distance(u, screen) <= 4) {
    return [];
  }
  return getReachable(view, u)
    .filter(
      (point) =>
        distance(point, screen) >= 3 &&
        distance(point, screen) < distance(u, screen) - PROGRESS_EPSILON &&
        point.path.every((step) => behind(step, screen, seen)),
    )
    .map((point) => payableRoute(view, u, point, work))
    .filter(row=>row!==null)
    .sort(
      (a, b) =>
        distance(a.point, screen) - distance(b.point, screen) ||
        cover(view, b.point) - cover(view, a.point) ||
        a.point.cost - b.point.cost ||
        a.point.y - b.point.y ||
        a.point.x - b.point.x,
    );
}
function clearFriendlyLane(view:BattleSnapshot, u:BattleUnit, held:ReadonlySet<string>, seen:readonly BattleUnit[], screen:BattleUnit, work:SupportWorkQuote[] = []) {
  const ownPath = getReachable(view, u)
    .filter(
      (point) =>
        distance(point, u) <= 2 &&
        point.path.every((step) => behind(step, screen, seen)) &&
        cover(view, point) >= cover(view, u) &&
        nearest(point, seen) >= nearest(u, seen),
    )
    .map((point) => payableRoute(view, u, point, work))
    .filter(row=>row!==null);
  if (!ownPath.length) {
    return null;
  }
  const rear = view.units
    .filter(
      (other) =>
        other.side === u.side &&
        other.id !== u.id &&
        eligible(view, other, held) &&
        sameSurface(other, u) &&
        distance(other, screen) >= distance(u, screen) + 1.5,
    )
    .sort(
      (a, b) =>
        distance(b, screen) - distance(a, screen) || String(a.id).localeCompare(String(b.id)),
    );
  for (const guard of rear) {
    // Removing this KNOWN friendly remains a planning hypothesis only. Native
    // movement uses unchanged actual occupancy; the rear re-queries afterward.
    const vacated = { ...view, units: view.units.filter((other) => other.id !== u.id) },
      waitingWork = friendWorkQuotes(vacated, guard);
    if (waitingWork === null) {
      continue;
    }
    const route = stages(vacated, guard, held, seen, screen, waitingWork).find((row) =>
      row.point.path.some((step) => sameCell(step, u)),
    );
    if (!route) {
      continue;
    }
    const offLane = ownPath
      .filter((row) => !route.point.path.some((step) => sameCell(step, row.point)))
      .sort(
        (a, b) =>
          a.point.cost - b.point.cost ||
          a.point.path.length - b.point.path.length ||
          cover(view, b.point) - cover(view, a.point) ||
          a.point.y - b.point.y ||
          a.point.x - b.point.x,
      )[0];
    if (offLane) {
      return {
        kind: 'friendly-lane-clear' as const,
        unitId: u.id,
        rearId: guard.id,
        screenId: screen.id,
        route: offLane.point,
        waitingRoute: route.point,
        fireReserve: offLane.reserve,
        apDepleted: offLane.apDepleted,
        ...(offLane.preservedWork ? { preservedWork: offLane.preservedWork } : {}),
        action: { type: 'move' as const, unitId: u.id, ...spacePoint(offLane.point) },
      };
    }
  }
  return null;
}

// Stateless, default-off, public only. Own work stays first. Other current
// work is protected by each actual path cell and paid first-round clock quote,
// rather than a blanket hold for an unrelated shot behind the front muzzle.
export function publicSupportStagingPlan(battle:BattleSnapshot, unit:BattleUnit, { protectedIds = [] }:SupportOptions = {}) {
  if (
    battle.mode !== 'combat' ||
    battle.status !== 'active' ||
    battle.phase !== 'player' ||
    battle.reactionStack?.length
  ) {
    return null;
  }
  const held = new Set([...protectedIds].map(String)),
    view = publicRouteView(battle, unit),
    u = view.units.find((other) => other.id === unit.id);
  if (!u || !eligible(view, u, held) || budget(u) <= 0 || ordinaryWork(view, u)) {
    return null;
  }
  const work = friendWorkQuotes(view, u);
  if (work === null) {
    return null;
  }
  const seen = contacts(view).filter((other) => sameSurface(other, u));
  if (!seen.length) {
    return null;
  }
  const screen = screenFor(view, u, held, seen);
  if (!screen) {
    return null;
  }
  const clear = clearFriendlyLane(view, u, held, seen, screen, work);
  if (clear) {
    return clear;
  }
  const row = stages(view, u, held, seen, screen, work)[0];
  return row
    ? {
        kind: 'support-stage' as const,
        unitId: u.id,
        screenId: screen.id,
        route: row.point,
        fireReserve: row.reserve,
        apDepleted: row.apDepleted,
        ...(row.preservedWork ? { preservedWork: row.preservedWork } : {}),
        action: { type: 'move' as const, unitId: u.id, ...spacePoint(row.point) },
      }
    : null;
}

// Shared read-only Native cost projections; existing staging flow is unchanged.
export const previewPublicPaidWalk = paidWalk;
export const previewPublicRifleReserve = rifleReserve;

// Read-only admission for a specific CURRENT public route, useful for proving
// a rejected transient crossing even when another safe candidate exists.
export function publicSupportRouteWorkPreview(battle:BattleSnapshot, unit:BattleUnit, point:ReachableCell) {
  const view = publicRouteView(battle, unit),
    u = view.units.find((other) => other.id === unit.id);
  const route =
    u &&
    getReachable(view, u).find(
      (row) => sameCell(row, point) && row.cost === point.cost && exact(row.path, point.path),
    );
  if (!route || !u) {
    return { allowed: false as const, reason: 'current-public-route-unavailable' };
  }
  const work = friendWorkQuotes(view, u);
  if (work === null) {
    return { allowed: false as const, reason: 'current-public-work-unquotable' };
  }
  const walked = paidWalk(view, u, route, budget(u), work);
  return walked
    ? {
        allowed: true as const,
        preservedWork: walked.preservedWork ?? { before: [], steps: [], afterClock: [] },
      }
    : { allowed: false as const, reason: 'paid-route-or-current-work-not-preserved' };
}
