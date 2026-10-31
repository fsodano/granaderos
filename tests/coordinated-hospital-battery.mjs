import { artilleryProfile } from '../packages/game/artillery-definitions.ts';
import { firearmServiceable } from '../packages/game/firearm-serviceability.js';
import { criticalFirstAidNeeded } from '../packages/game/first-aid.js';
import { medicalPatientAvailable } from '../packages/game/medical-patient.js';
import { sameCell, sameSurface, spacePoint, surfaceAt } from '../packages/game/tactical-space.js';
import {
  getReachable,
  climbPreview,
  medicalUsePreview,
  hasLineOfSight,
  hasFirearm,
  actionCosts,
  stanceCost,
  artilleryContact,
  artilleryCosts,
  artilleryCrewPlan,
  artilleryReloadPreview,
  artilleryShotTrace,
  movementStepCost,
  movementEnergy,
  carriedWeight,
  carryCapacity,
} from '../packages/game/tactical.js';
import { directionTo } from '../packages/game/tactical-awareness.js';
import { lowerWeapon } from '../packages/game/weapon-readiness.js';
import { limitEnergy } from '../packages/game/fatigue.js';
import { advanceBattleClock, COMBAT_ROUND_SECONDS } from '../packages/game/time.js';
import { northernHospitalCoverOrder } from './fresh-northern-recovery.mjs';
import { teamArtilleryOrder } from './team-artillery-driver.mjs';
import {
  publicRouteView,
  usefulRouteRifleShot,
  usefulRouteFiringPosture,
} from './route-infantry-progress.mjs';
import { knownRouteBystanderShotSafety } from './route-fire-safety.ts';

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const fit = (u) =>
  u?.hp >= 15 &&
  !u.routed &&
  !u.unconscious &&
  !u.departure &&
  !u.fled &&
  !u.surrendered &&
  !u.asleep &&
  !u.captured;
const charged = (g) => g.loaded || g.ammo > 0;
const hospitalShotOptions = { shotSafety: knownRouteBystanderShotSafety };

// A quote on a public planning copy, never an executable battle result.
// Ground paths can omit kind; elevated move tags are accepted on the same
// actual surface. Every climb, level change and other step kind is refused.
// Real obstruction, reaction damage and incomplete movement stay native.
// Refuse profiles with movement-dependent training that this quote cannot
// derive without private opponent observations or a stat progression model.
export function paidHospitalRoofWalkPreview(view, unit, point) {
  if (
    view.mode !== 'combat' ||
    unit.mounted ||
    unit.stealthMode ||
    carriedWeight(unit) > carryCapacity(unit) ||
    !(point.cost > 0) ||
    !Array.isArray(point.path) ||
    !point.path.length
  ) {
    return null;
  }
  let actor = { ...unit, braced: false, overwatch: false },
    paid = 0;
  for (const step of point.path) {
    if ((step.kind !== undefined && step.kind !== 'move') || !sameSurface(actor, step)) {
      return null;
    }
    const surface = surfaceAt(view, step),
      cost = movementStepCost(view, actor, actor, step);
    if (!surface || !Number.isFinite(cost) || cost <= 0 || actor.ap < cost) {
      return null;
    }
    const factor = actor.x !== step.x && actor.y !== step.y ? 1.4 : 1,
      energy = Math.ceil(movementEnergy(actor, surface, false) * factor);
    const direction = `${step.x - actor.x},${step.y - actor.y}`,
      facing = directionTo(actor, step);
    paid += cost;
    lowerWeapon(actor);
    limitEnergy(actor);
    actor = {
      ...actor,
      ...spacePoint(step),
      ap: actor.ap - cost,
      facing,
      momentum: direction === actor.lastDirection ? actor.momentum + 1 : 1,
      lastDirection: direction,
      energy: Math.max(0, Math.round((actor.energy - energy) * 1000) / 1000),
    };
    delete actor.lastTargetId;
    delete actor.lastShotPosition;
    if (actor.energy <= 0) {
      return null;
    }
  }
  if (paid !== point.cost || !sameCell(actor, point)) {
    return null;
  }
  // Native combat charges its first round after applying the move. Use that
  // same public clock helper on a copied planning view so hourly fatigue,
  // night, lights and published regional weather do not stay stale.
  const next = {
    ...view,
    units: view.units.map((other) => (other.id === unit.id ? actor : { ...other })),
  };
  if (!view.roundTimeCharged) {
    advanceBattleClock(next, COMBAT_ROUND_SECONDS);
    next.roundTimeCharged = true;
  }
  return { actor: next.units.find((other) => other.id === unit.id), view: next, paid };
}

// The rear has already paid for its actual roof posts and battery contact.
// Keep those roles during the raid. The supplied physician does not become
// an automatic replacement gunner, and no body or charge is created here.
export function coordinatedHospitalBattery(
  initial,
  {
    coordinateSpentCrew = false,
    coordinatePhysicianHold = false,
    coordinateEmptyGround = false,
    preferredPhysicianIds = [],
  } = {},
) {
  const own = initial.units.filter((u) => u.side === 'player' && fit(u));
  const preferred = new Set(preferredPhysicianIds.map(String)),
    physicians = own
      .filter((u) => u.medical >= 60 && u.medkits > 0)
      .sort(
        (a, b) =>
          b.medical - a.medical ||
          b.medkits - a.medkits ||
          String(a.id).localeCompare(String(b.id)),
      );
  const physician = physicians.find((u) => preferred.has(u.id)) ?? physicians[0];
  const assigned = new Set(),
    crews = initial.artillery
      .filter((g) => g.side === 'player' && charged(g))
      .map((gun) => {
        const ids = own
          .filter(
            (u) =>
              u.id !== physician?.id && !assigned.has(u.id) && artilleryContact(initial, u, gun),
          )
          .sort(
            (a, b) =>
              distance(a, gun) - distance(b, gun) ||
              a.marksmanship - b.marksmanship ||
              String(a.id).localeCompare(String(b.id)),
          )
          .slice(0, artilleryProfile(initial, gun).crew)
          .map((u) => u.id);
        for (const id of ids) {
          assigned.add(id);
        }
        return { gunId: gun.id, ids };
      });
  // Keep only the actual initial roof rifle role. The supplied physician and
  // paid contact crew keep their own existing finite-work/access branches.
  const roofDefenders = new Set(
    own
      .filter((u) => u.tacticalLevel > 0 && u.id !== physician?.id && !assigned.has(u.id))
      .map((u) => u.id),
  );
  const pieces = initial.artillery.filter((g) => g.side === 'player');
  const emptyGround = new Set(
    coordinateEmptyGround && pieces.length && pieces.every((g) => !charged(g))
      ? own
          .filter(
            (u) => (u.tacticalLevel ?? 0) === 0 && u.id !== physician?.id && !assigned.has(u.id),
          )
          .map((u) => u.id)
      : [],
  );

  function gunWork(b, u, crew) {
    const gun = b.artillery.find((g) => g.id === crew.gunId);
    if (!gun || !charged(gun) || !artilleryContact(b, u, gun)) {
      return null;
    }
    const view = publicRouteView(b, u),
      targets = view.units.filter((v) => v.side !== u.side && fit(v));
    const action = teamArtilleryOrder(view, u, targets);
    if (
      !action ||
      action.artilleryId !== gun.id ||
      !['artillery', 'artilleryPivot', 'artilleryReload'].includes(action.type)
    ) {
      return null;
    }
    const plan =
      action.type === 'artilleryReload'
        ? artilleryReloadPreview(b, u, gun)
        : artilleryCrewPlan(
            b,
            u,
            gun,
            artilleryCosts(b, u, gun)[action.type === 'artillery' ? 'fire' : 'pivot'],
          );
    return !plan.reason && plan.crew.every((id) => crew.ids.includes(id) && id !== physician?.id)
      ? action
      : null;
  }

  // Clear a real blocking crew member only for a current public shot. Every
  // reached cell must retain gun contact and the complete original paid crew.
  // A forecast is not a move: native collision, interruption and costs remain
  // authoritative, and the next callback reads the actual returned state.
  function crewClearance(b, u, crew) {
    const gun = b.artillery.find((g) => g.id === crew.gunId),
      profile = gun && artilleryProfile(b, gun);
    if (
      !gun?.loaded ||
      b.mode !== 'combat' ||
      b.phase !== 'player' ||
      b.reactionStack?.length ||
      crew.ids.length !== profile.crew
    ) {
      return null;
    }
    const members = crew.ids.map((id) => b.units.find((v) => v.id === id));
    if (
      !members.every(
        (v) =>
          fit(v) &&
          !v.knockedDown &&
          !v.entangled &&
          !v.mounted &&
          v.stance !== 'prone' &&
          artilleryContact(b, v, gun),
      )
    ) {
      return null;
    }
    const view = publicRouteView(b, u),
      shooters = members.filter((v) => v.id !== u.id),
      targets = view.units.filter((v) => v.side !== u.side && fit(v) && sameSurface(v, gun));
    const blocked = shooters.some((shooter) =>
      targets.some((target) =>
        ['solid', 'canister'].some((mode) =>
          artilleryShotTrace(view, shooter, gun, target, mode).events.some(
            (e) => e.type === 'impact' && e.unitId === u.id,
          ),
        ),
      ),
    );
    if (!blocked) {
      return null;
    }
    const points = getReachable(view, u)
      .filter(
        (p) =>
          p.cost > 0 &&
          p.cost <= 20 &&
          p.cost < u.ap &&
          sameSurface(p, u) &&
          !sameCell(p, gun) &&
          artilleryContact(view, { ...u, ...spacePoint(p) }, gun) &&
          p.path.every(
            (step) =>
              (step.kind === undefined || step.kind === 'move') &&
              sameSurface(step, u) &&
              !sameCell(step, gun) &&
              artilleryContact(view, { ...u, ...spacePoint(step) }, gun),
          ),
      )
      .sort((a, c) => a.cost - c.cost || a.y - c.y || a.x - c.x);
    for (const point of points) {
      // This existing quote also handles ground forward walks: all native
      // same-surface AP, facing, breath and first-round clock costs are derived.
      const preview = paidHospitalRoofWalkPreview(view, u, point);
      if (!preview) {
        continue;
      }
      if (
        shooters.some((shooter) =>
          gunWork(
            preview.view,
            preview.view.units.find((v) => v.id === shooter.id),
            crew,
          ),
        )
      ) {
        return { type: 'move', unitId: u.id, ...spacePoint(point) };
      }
    }
    return null;
  }

  function rifleHold(
    b,
    u,
    normal,
    { holdGround = false, holdRoof = false, holdMedical = false } = {},
  ) {
    // Only the admitted contact crew can issue battery work. The ordinary
    // infantry selector can also propose it for a nearby physician.
    if (normal?.type?.startsWith('artillery')) {
      normal = null;
    }
    if (['fire', 'reload', 'reprime', 'weapon', 'useItem'].includes(normal?.type)) {
      return normal;
    }
    // A carried loaded primary needs its real paid activation. Stance changes
    // while holding a blade cannot make that rifle available for firing.
    if (
      !['primary', 'secondary'].includes(u.activeSlot ?? 'primary') &&
      u.loaded > 0 &&
      hasFirearm(u) &&
      !u.weaponDropped &&
      firearmServiceable(u) &&
      u.ap >= actionCosts(b, u).weapon
    ) {
      return { type: 'weapon', unitId: u.id, slot: 'primary' };
    }
    const shot = usefulRouteRifleShot(publicRouteView(b, u), u, hospitalShotOptions);
    if (shot) {
      return shot;
    }
    if (!holdGround) {
      const route = roofFiringApproach(b, u);
      if (route) {
        return route;
      }
    }
    if (normal?.type === 'stance' && normal.stance === 'standing') {
      const paid = stanceCost(u, 'standing'),
        posed = {
          ...u,
          stance: 'standing',
          movementMode: 'walk',
          weaponReady: false,
          momentum: 0,
          ap: u.ap - paid,
        };
      const view = publicRouteView(b, u),
        after = { ...view, units: view.units.map((v) => (v.id === u.id ? posed : v)) };
      return paid > 0 && posed.ap > 0 && usefulRouteRifleShot(after, posed, hospitalShotOptions)
        ? normal
        : null;
    }
    if (normal?.type === 'stance' && !usefulRouteFiringPosture(b, u, normal, hospitalShotOptions)) {
      return null;
    }
    if (holdGround && ['move', 'charge'].includes(normal?.type)) {
      return null;
    }
    if (holdMedical && ['climb', 'melee', 'meleePoint'].includes(normal?.type)) {
      return null;
    }
    if (holdRoof && !roofRoleActionAllowed(b, u, normal)) {
      return null;
    }
    return normal;
  }

  // Extend the existing clinic roof hold to explicit climbs and cross-floor
  // pursuit. Preserve its original turn20/no-contact public search release.
  // Medical work returns before this guard; no paid body field is changed.
  function roofRoleActionAllowed(b, u, action) {
    if (
      !action ||
      !(u.tacticalLevel > 0) ||
      u.activeSlot === 'medical' ||
      !['move', 'climb', 'charge', 'melee', 'meleePoint'].includes(action.type)
    ) {
      return true;
    }
    const view = publicRouteView(b, u),
      contact = view.units.some((v) => v.side === 'enemy' && fit(v));
    if (b.turn >= 20 && !contact) {
      return true;
    }
    if (action.type === 'climb') {
      const quote = climbPreview(view, u, action);
      return quote.valid && sameSurface(u, quote.destination);
    }
    if (action.type === 'charge') {
      return false;
    } // Native charges require ground.
    if (action.type === 'move') {
      const destination = {
        x: action.x,
        y: action.y,
        tacticalLevel: action.tacticalLevel ?? u.tacticalLevel,
      };
      if (!sameSurface(u, destination)) {
        return false;
      }
      const route = getReachable(view, u, {
        movementIntent: action.movementIntent ?? 'forward',
        stopAt: (p) => sameCell(p, destination),
      })[0];
      return Boolean(route?.cost > 0 && roofPathRetainsCover(view, u, route.path));
    }
    const target =
      action.type === 'meleePoint'
        ? spacePoint(action)
        : action.targetKind === 'npc'
          ? view.npcs?.find((v) => v.id === String(action.targetId))
          : view.units.find((v) => v.id === String(action.targetId));
    return Boolean(target && sameSurface(u, target));
  }

  // Paid roof cover belongs to the current post. A useful firing endpoint
  // does not justify crossing a lower-cover cell on the way to it. Use only
  // the current public surfaces; Native still owns the actual paid movement.
  function roofPathRetainsCover(view, u, path) {
    const origin = surfaceAt(view, u);
    if (!origin) {
      return false;
    }
    const cover = origin.cover ?? 0;
    return path.every((point) => {
      const surface = surfaceAt(view, point);
      return (
        (point.kind === undefined || point.kind === 'move') &&
        sameSurface(u, point) &&
        Boolean(surface) &&
        (surface.cover ?? 0) >= cover
      );
    });
  }

  function roofFiringApproach(b, u) {
    if (
      !(u.tacticalLevel > 0) ||
      u.knockedDown ||
      u.entangled ||
      u.mounted ||
      b.phase !== 'player' ||
      b.reactionStack?.length
    ) {
      return null;
    }
    const view = publicRouteView(b, u);
    const points = getReachable(view, u)
      .filter(
        (p) =>
          p.cost > 0 &&
          p.cost <= 20 &&
          p.cost < u.ap &&
          sameSurface(p, u) &&
          distance(p, u) <= 3 &&
          roofPathRetainsCover(view, u, p.path),
      )
      .sort((a, c) => a.cost - c.cost || a.y - c.y || a.x - c.x);
    for (const point of points) {
      // Native movement changes facing, breath, momentum and readiness. Quote
      // those paid body fields from this public route before claiming the next
      // shot is affordable. Real collisions and reactions still execute later.
      const preview = paidHospitalRoofWalkPreview(view, u, point);
      if (preview && usefulRouteRifleShot(preview.view, preview.actor, hospitalShotOptions)) {
        return { type: 'move', unitId: u.id, ...spacePoint(point) };
      }
    }
    return null;
  }

  // Every medical prefix needs a complete current affordable aid endpoint.
  // Keep current cover and known hostile exposure at the original paid rise
  // and every route cell. A different floor is not melee contact; Native LOS
  // still checks its actual height. These are quotes, never returned bodies.
  function medicalPathQuote(view, u, patient, guns) {
    const stand =
      !sameSurface(u, patient) && u.stance !== 'standing' ? stanceCost(u, 'standing') : 0;
    if (stand && u.mounted) {
      return null;
    }
    const actor = stand
      ? {
          ...u,
          stance: 'standing',
          movementMode: 'walk',
          weaponReady: false,
          momentum: 0,
          ap: u.ap - stand,
        }
      : u;
    const quoted = {
        ...view,
        units: view.units.map((other) => (other.id === u.id ? actor : other)),
      },
      cover = surfaceAt(view, u)?.cover ?? 0;
    const contacts = view.units
      .filter((other) => other.side !== u.side && fit(other))
      .map((other) => ({ actor: other, seesCurrent: hasLineOfSight(view, other, u) }));
    const outsideGuns = (point) =>
      guns.every((g) => !artilleryContact(view, { ...actor, ...spacePoint(point) }, g));
    const safe = (point) =>
      Boolean(surfaceAt(view, point)) &&
      (surfaceAt(view, point).cover ?? 0) >= cover &&
      outsideGuns(point) &&
      contacts.every(
        (contact) =>
          (!sameSurface(point, contact.actor) || distance(point, contact.actor) > 2.5) &&
          (!hasLineOfSight(view, contact.actor, { ...actor, ...spacePoint(point) }) ||
            contact.seesCurrent),
      );
    const hand = u.activeSlot === 'medical' ? 0 : actionCosts(quoted, actor).weapon,
      budget = Math.min(20, actor.ap - hand - actionCosts(quoted, actor).heal);
    if (budget <= 0 || !safe(u)) {
      return null;
    }
    const goals = getReachable(quoted, actor)
      .filter(
        (point) =>
          point.cost > 0 &&
          sameSurface(point, patient) &&
          point.path.every(
            (step) => [undefined, 'move', 'climb'].includes(step.kind) && safe(step),
          ) &&
          medicalUsePreview(
            quoted,
            {
              ...actor,
              ...spacePoint(point),
              activeSlot: 'medical',
              ap: actor.ap - point.cost - hand,
            },
            patient,
          ).allowed,
      )
      .sort((a, c) => a.cost - c.cost || a.y - c.y || a.x - c.x);
    return goals[0] ? { stand, actor, quoted, outsideGuns, safe, budget, goal: goals[0] } : null;
  }

  function medicalAccessProgress(b, u, view, patient, guns) {
    const quote = medicalPathQuote(view, u, patient, guns);
    if (!quote) {
      return null;
    }
    const { stand, actor, quoted, outsideGuns, safe, budget, goal } = quote;
    // No route can borrow a supplied gun contact or a speculative far move.
    // Walk at most three native flat cells before the next access. A climb is
    // a separate previewed public order, never an implicit free level change.
    const prefix = [];
    let spent = 0,
      from = actor;
    for (const step of goal.path) {
      if (prefix.length && step.kind === 'climb') {
        break;
      }
      const cost = movementStepCost(quoted, actor, from, step);
      if (!(cost > 0) || !Number.isFinite(cost) || spent + cost > budget || prefix.length >= 3) {
        break;
      }
      prefix.push(step);
      spent += cost;
      from = step;
      if (step.kind === 'climb') {
        break;
      }
    }
    if (!prefix.length) {
      return null;
    }
    if (prefix[0].kind === 'climb') {
      const climb = climbPreview(quoted, actor, { linkId: prefix[0].linkId });
      if (!climb.valid || climb.pa > budget || !sameCell(climb.destination, prefix[0])) {
        return null;
      }
    }
    if (stand) {
      return { type: 'stance', unitId: u.id, stance: 'standing' };
    }
    if (prefix[0].kind === 'climb') {
      return { type: 'climb', unitId: u.id, linkId: prefix[0].linkId };
    }
    const end = prefix.at(-1),
      actual = getReachable(view, u, { stopAt: (point) => sameCell(point, end) })[0];
    return actual?.cost > 0 &&
      actual.cost <= budget &&
      actual.path.length <= 3 &&
      actual.path.every(
        (step) =>
          (step.kind === undefined || step.kind === 'move') &&
          sameSurface(step, u) &&
          outsideGuns(step) &&
          safe(step),
      )
      ? { type: 'move', unitId: u.id, ...spacePoint(actual) }
      : null;
  }

  function medicalApproach(b, u) {
    if (
      !(u.medkits > 0) ||
      u.medical < 20 ||
      b.phase !== 'player' ||
      b.reactionStack?.length ||
      u.knockedDown ||
      u.entangled
    ) {
      return null;
    }
    const view = publicRouteView(b, u),
      patients = view.units
        .filter(
          (v) =>
            v.side === u.side &&
            v.id !== u.id &&
            medicalPatientAvailable(v) &&
            (v.bleeding > 0 || criticalFirstAidNeeded(v)),
        )
        .sort((a, c) => a.hp - c.hp || String(a.id).localeCompare(String(c.id)));
    const guns = view.artillery.filter((g) => g.side === u.side && charged(g));
    for (const patient of patients) {
      const access = medicalAccessProgress(b, u, view, patient, guns);
      if (access) {
        return access;
      }
    }
    return null;
  }

  // The admitted physician may pay for protection only after all existing
  // finite care, maintenance, useful fire and authored medical access hold.
  // This is a current AP quote, not a future care or survival guarantee.
  function physicianHoldingPosture(b, u) {
    if (
      !coordinatePhysicianHold ||
      b.status !== 'active' ||
      b.mode !== 'combat' ||
      b.phase !== 'player' ||
      b.reactionStack?.length ||
      !(u.tacticalLevel > 0) ||
      u.stance === 'prone' ||
      u.mounted ||
      u.knockedDown ||
      u.entangled ||
      !(u.medkits > 0)
    ) {
      return null;
    }
    if (b.artillery.some((g) => g.side === u.side && charged(g) && artilleryContact(b, u, g))) {
      return null;
    }
    const paid = stanceCost(u, 'prone');
    if (!(paid > 0)) {
      return null;
    }
    const posed = {
        ...u,
        stance: 'prone',
        movementMode: 'prone',
        weaponReady: false,
        momentum: 0,
        ap: u.ap - paid,
      },
      cost = actionCosts(b, posed);
    // Keep the quoted hand switch, finite treatment and a later real rise
    // available in this budget. Each later callback still queries Native anew.
    const reserve =
      (u.activeSlot === 'medical' ? 0 : cost.weapon) + cost.heal + stanceCost(posed, 'standing');
    return posed.ap >= reserve ? { type: 'stance', unitId: u.id, stance: 'prone' } : null;
  }

  const controller = (b, u) => {
    if (!fit(u)) {
      return null;
    }
    const normal = northernHospitalCoverOrder(b, u, hospitalShotOptions);
    if (normal?.type === 'useItem' || normal?.slot === 'medical' || u.knockedDown || u.entangled) {
      return normal;
    }
    if (u.id === physician?.id) {
      const aid = medicalApproach(b, u);
      if (aid) {
        return aid;
      }
      const held = rifleHold(b, u, normal, { holdGround: true, holdMedical: true });
      return held ?? (coordinatePhysicianHold ? physicianHoldingPosture(b, u) : held);
    }
    const crew = crews.find((c) => c.ids.includes(u.id)),
      gun = crew && b.artillery.find((g) => g.id === crew.gunId);
    if (crew && gun && charged(gun)) {
      const work = gunWork(b, u, crew);
      if (work) {
        return work;
      }
      const clearance = crewClearance(b, u, crew);
      if (clearance) {
        return clearance;
      }
      if (u.stance === 'prone' && b.phase === 'player' && !b.reactionStack?.length) {
        // Every existing assigned contact helper must be able to pay its own
        // rise before native battery work is useful. This is only a preview;
        // subsequent callbacks still execute each real stance independently.
        const members = crew.ids.map((id) => b.units.find((v) => v.id === id));
        if (members.every((v) => fit(v) && artilleryContact(b, v, gun))) {
          let payable = true;
          const posedUnits = b.units.map((v) => {
            if (!crew.ids.includes(v.id) || v.stance !== 'prone') {
              return v;
            }
            const paid = stanceCost(v, 'crouched');
            if (!(paid > 0 && v.ap >= paid)) {
              payable = false;
              return v;
            }
            return {
              ...v,
              stance: 'crouched',
              movementMode: 'crouch',
              weaponReady: false,
              momentum: 0,
              ap: v.ap - paid,
            };
          });
          const posed = posedUnits.find((v) => v.id === u.id);
          if (payable && gunWork({ ...b, units: posedUnits }, posed, crew)) {
            return { type: 'stance', unitId: u.id, stance: 'crouched' };
          }
        }
      }
      return rifleHold(b, u, normal, { holdGround: true });
    }
    const held = rifleHold(b, u, normal, { holdRoof: roofDefenders.has(u.id) });
    if (held != null || !emptyGround.has(u.id)) {
      return held;
    }
    return emptyGroundProgress(b, u);
  };
  // Only a ground rifleman admitted beside an initially empty battery may
  // close on a current team sighting after his ordinary work holds. Roof and
  // clinical roles stay separate. Each callback pays one actual short move;
  // no contact memory, future action or body is written by this quote.
  const emptyGroundProgress = (b, u) => {
    if (
      !emptyGround.has(u.id) ||
      b.status !== 'active' ||
      b.mode !== 'combat' ||
      b.phase !== 'player' ||
      b.reactionStack?.length ||
      !fit(u) ||
      (u.tacticalLevel ?? 0) !== 0 ||
      u.hp !== u.maxHp ||
      u.bleeding ||
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
      carriedWeight(u) > carryCapacity(u)
    ) {
      return null;
    }
    const view = publicRouteView(b, u);
    if (
      view.artillery.some((g) => g.side === u.side && charged(g)) ||
      usefulRouteRifleShot(view, u, hospitalShotOptions)
    ) {
      return null;
    }
    if (
      u.medical > 0 &&
      u.medkits > 0 &&
      view.units.some(
        (v) =>
          v.side === u.side &&
          medicalPatientAvailable(v) &&
          (v.bleeding > 0 || criticalFirstAidNeeded(v)),
      )
    ) {
      return null;
    }
    const seen = view.units.filter((v) => v.side !== u.side && fit(v) && sameSurface(u, v));
    if (!seen.length) {
      return null;
    }
    // Native records this window's allocated AP separately from its remaining
    // AP. All real work already paid in this turn reduces optional approach
    // room; repeated callbacks cannot renew a per-order allowance. A genuine
    // new Native turn resets the allocation, including its actual carryover.
    const allocated = u.maxAP + (u.carriedAP ?? 0),
      spent = allocated - u.ap;
    if (!Number.isFinite(allocated) || !Number.isFinite(spent) || spent < 0) {
      return null;
    }
    const budget = Math.max(0, 20 - spent);
    if (!budget) {
      return null;
    }
    const nearest = (p) => Math.min(...seen.map((target) => distance(p, target))),
      from = nearest(u),
      choices = [];
    for (const point of getReachable(view, u)) {
      if (
        !(point.cost > 0 && point.cost <= budget) ||
        !point.path?.length ||
        point.path.length > 3 ||
        !sameSurface(point, u) ||
        !point.path.every(
          (step) => (step.kind === undefined || step.kind === 'move') && sameSurface(step, u),
        )
      ) {
        continue;
      }
      const preview = paidHospitalRoofWalkPreview(view, u, point);
      if (!preview) {
        continue;
      }
      const shot = usefulRouteRifleShot(preview.view, preview.actor, hospitalShotOptions),
        gain = from - nearest(point);
      const target = shot
        ? seen.find((v) => v.id === shot.targetId)
        : seen
            .slice()
            .sort(
              (a, c) =>
                distance(point, a) - distance(point, c) || String(a.id).localeCompare(String(c.id)),
            )[0];
      if (!target || (!shot && !(gain > 0))) {
        continue;
      }
      const cost = actionCosts(preview.view, preview.actor, target),
        reserve = cost.fire + (shot?.aim ?? 2) * cost.aim;
      if (preview.actor.ap >= reserve) {
        choices.push({ point, shot: Boolean(shot), gain });
      }
    }
    choices.sort(
      (a, c) =>
        Number(c.shot) - Number(a.shot) ||
        c.gain - a.gain ||
        a.point.cost - c.point.cost ||
        a.point.y - c.point.y ||
        a.point.x - c.point.x,
    );
    const point = choices[0]?.point;
    return point ? { type: 'move', unitId: u.id, ...spacePoint(point) } : null;
  };
  // A complete ordinary pass must hold before this opt-in can run. Only an
  // actual original contact crew whose own gun is now empty can spend a public
  // firing/search bound. Initial physicians and active gun work keep their roles.
  const spentCrewProgress = (b, u) => {
    if (
      !coordinateSpentCrew ||
      b.status !== 'active' ||
      b.mode !== 'combat' ||
      b.phase !== 'player' ||
      b.reactionStack?.length ||
      !fit(u) ||
      u.hp !== u.maxHp ||
      u.bleeding ||
      u.id === physician?.id ||
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
      carriedWeight(u) > carryCapacity(u)
    ) {
      return null;
    }
    const crew = crews.find((c) => c.ids.includes(u.id)),
      piece = crew && b.artillery.find((g) => g.id === crew.gunId);
    if (!piece || charged(piece)) {
      return null;
    }
    const view = publicRouteView(b, u),
      actor = view.units.find((v) => v.id === u.id);
    if (
      !actor ||
      view.artillery.some((g) => g.side === u.side && charged(g) && artilleryContact(view, u, g))
    ) {
      return null;
    }
    // Do not replace a real finite medical duty or a presently payable shot.
    // This is a public test of work, never another stateful controller call.
    if (
      u.medical > 0 &&
      u.medkits > 0 &&
      view.units.some(
        (v) =>
          v.side === u.side &&
          medicalPatientAvailable(v) &&
          (v.bleeding > 0 || criticalFirstAidNeeded(v)),
      )
    ) {
      return null;
    }
    if (usefulRouteRifleShot(view, u, hospitalShotOptions)) {
      return null;
    }
    const seen = view.units.filter((v) => v.side !== u.side && fit(v) && sameSurface(u, v));
    if (!seen.length) {
      return null;
    }
    const nearest = (point) => Math.min(...seen.map((target) => distance(point, target))),
      from = nearest(u),
      choices = [];
    const posedShots = [];
    for (const stance of ['crouched', 'prone', 'standing']) {
      const paid = stanceCost(u, stance);
      if (stance === u.stance || !(paid > 0) || paid >= u.ap) {
        continue;
      }
      const posed = {
        ...u,
        stance,
        movementMode: stance === 'prone' ? 'prone' : stance === 'crouched' ? 'crouch' : 'walk',
        weaponReady: false,
        momentum: 0,
        ap: u.ap - paid,
      };
      const after = { ...view, units: view.units.map((v) => (v.id === u.id ? posed : v)) },
        shot = usefulRouteRifleShot(after, posed, hospitalShotOptions);
      if (shot) {
        posedShots.push({ paid, stance });
      }
    }
    if (posedShots.length) {
      posedShots.sort((a, c) => a.paid - c.paid);
      return { type: 'stance', unitId: u.id, stance: posedShots[0].stance };
    }
    for (const point of getReachable(view, u)) {
      if (
        !(point.cost > 0 && point.cost <= 20) ||
        !point.path?.length ||
        point.path.length > 3 ||
        !sameSurface(point, u) ||
        !point.path.every(
          (step) => (step.kind === undefined || step.kind === 'move') && sameSurface(step, u),
        )
      ) {
        continue;
      }
      const preview = paidHospitalRoofWalkPreview(view, u, point);
      if (!preview) {
        continue;
      }
      const shot = usefulRouteRifleShot(preview.view, preview.actor, hospitalShotOptions),
        gain = from - nearest(point);
      if (shot) {
        const target = seen.find((v) => v.id === shot.targetId);
        if (!target) {
          continue;
        }
        const cost = actionCosts(preview.view, preview.actor, target),
          reserve = cost.fire + shot.aim * cost.aim;
        if (preview.actor.ap >= reserve) {
          choices.push({ point, shot: true, gain });
        }
      } else if (gain > 1e-9) {
        const target = seen
            .slice()
            .sort(
              (a, c) =>
                distance(point, a) - distance(point, c) || String(a.id).localeCompare(String(c.id)),
            )[0],
          cost = actionCosts(preview.view, preview.actor, target);
        // This protects paid turn/raise/discharge plus two aims. It quotes AP;
        // it does not promise a hit or a currently executable shot through cover.
        if (preview.actor.ap >= cost.fire + 2 * cost.aim) {
          choices.push({ point, shot: false, gain });
        }
      }
    }
    choices.sort(
      (a, c) =>
        Number(c.shot) - Number(a.shot) ||
        c.gain - a.gain ||
        a.point.cost - c.point.cost ||
        a.point.y - c.point.y ||
        a.point.x - c.point.x,
    );
    const point = choices[0]?.point;
    return point ? { type: 'move', unitId: u.id, ...spacePoint(point) } : null;
  };
  if (coordinateSpentCrew) {
    controller.sharedFallback = spentCrewProgress;
  }
  return { controller, roles: { physicianId: physician?.id ?? null, crews } };
}
