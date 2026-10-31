import type {BattleSnapshot,BattleUnit,TacticalPoint} from './public/compatibility-types.ts';
import type {GrenadeFlightResult} from './grenade-flight.ts';
import {grenadeFlight,grenadeBlastExposure} from './grenade-flight.ts';
import {GRENADE_THROW,heldGrenade,grenadeThrowCosts,grenadeThrowRange,grenadeThrowChance} from './grenade-throw.ts';
import {sameCell,surfaceAt,surfaceHeight} from './tactical-space.js';
import {canSee} from './tactical.js';
import {inventoryOrderReason} from './inventory-order-reason.ts';
const onField = (unit:BattleUnit) => (unit.hp ?? 100) > 0 && !unit.departure && !unit.fled;
const spaceDistance = (state:BattleSnapshot,a:TacticalPoint,b:TacticalPoint) => Math.hypot(a.x-b.x,a.y-b.y,(surfaceHeight(state,a)??0)-(surfaceHeight(state,b)??0));
export function grenadeThrowPreview(s:BattleSnapshot, u:BattleUnit|null|undefined, target:TacticalPoint|null|undefined, options: {targetId?: string|number;hitLocation?:string;aim?:number} = {}) {
  const costs = u
    ? grenadeThrowCosts(u, target)
    : { total: 0, stance: 0, turn: 0, attack: 0, aim: 0, aimLevel: 0, energy: 0 };
  const grenade = heldGrenade(u),
    range = u ? grenadeThrowRange(u, grenade) : { maximum: 0 };
  let reason = inventoryOrderReason(s, u, costs.total),
    flight: GrenadeFlightResult | null = null;
  if (!reason && !grenade) {
    reason = 'Prepará una granada en la mano principal.';
  }
  if (!reason && grenade && grenade.record.condition <= 0) {
    reason = 'Esta granada está inutilizada.';
  }
  if (!reason && grenade && grenade.record.condition < 100 && (s.groundItems?.length ?? 0) >= 2000) {
    reason = 'No queda espacio en el sector para conservar una granada fallida.';
  }
  if (!reason && u?.mounted) {
    reason = 'Desmontá antes de lanzar la granada.';
  }
  if (
    !reason &&
    (!Number.isInteger(target?.x) || !Number.isInteger(target?.y) || !surfaceAt(s, target))
  ) {
    reason = 'Seleccioná una superficie del mapa.';
  }
  if (!reason && (options.targetId !== undefined || options.hitLocation !== undefined)) {
    reason = 'La granada se lanza a una casilla, sin elegir una zona del cuerpo.';
  }
  if (!reason && u && target && sameCell(u, target)) {
    reason = 'Seleccioná otra casilla para lanzar la granada.';
  }
  const distance = u && target && surfaceAt(s, target) ? spaceDistance(s, u, target) : Infinity;
  if (!reason && distance > range.maximum) {
    reason = 'Fuera del alcance de la granada.';
  }
  if (!reason) {
    if (!u || !target) { throw new TypeError('An admitted grenade throw requires an actor and target.'); }
    flight = grenadeFlight(s, u, target);
    if (!flight.landing || flight.impact.kind === 'invalid') {
      reason = 'No hay una trayectoria válida para la granada.';
    }
  }
  // No enemy data or hidden civilian positions enter the public preview.
  const landing = flight?.landing;
  const friendlyRisk = Boolean(
    u && landing &&
    [
      ...s.units.filter((v) => v.side === u.side && onField(v) && !v.fled),
      ...(s.npcs ?? []).filter(
        (v) => (v.hp ?? 100) > 0 && !v.departure && !v.fled && canSee(s, u, v),
      ),
    ].some((v) => grenadeBlastExposure(s, landing, v, GRENADE_THROW.radius).multiplier > 0),
  );
  return {
    valid: !reason,
    reason,
    pa: costs.total,
    aim: 0,
    chance: reason || !u ? 0 : grenadeThrowChance(u, distance, grenade),
    costs,
    range,
    flight,
    blastRadius: GRENADE_THROW.radius,
    friendlyRisk,
  };
}
