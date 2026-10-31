import type {BattleController} from './opening-driver.ts';
import { present } from './assert-present.ts';
import type { BattleSnapshot, BattleArtillery, TacticalPoint, BattleUnit, TacticalAction } from '../packages/game/public/compatibility-types.ts';
import { coastalBatteryController } from './coastal-command-driver.ts';
import { mountainBatteryOrder } from './mountain-battery-driver.ts';
import { artilleryContact, artilleryCrewPlan, artilleryCosts } from '../packages/game/tactical.js';
import { sameCell } from '../packages/game/tactical-space.js';

// World arrivals reserve the connected two-cell edge apron for carriages.
// A supplied second gun alone does not justify holding the infantry there.
function arrivalEdges(battle: BattleSnapshot, gun: BattleArtillery) {
  const arriving = new Set(
    battle.units
      .filter((u) => u.side === 'player' && u.hp > 0 && u.entryReason === 'arrival')
      .map((u) => u.entryEdge),
  );
  return ([
    ['N', gun.y],
    ['S', battle.height - 1 - gun.y],
    ['W', gun.x],
    ['E', battle.width - 1 - gun.x],
  ] satisfies ['N'|'S'|'E'|'W',number][])
    .filter(([edge, distance]) => distance <= 2 && (!arriving.size || arriving.has(edge)))
    .map(([edge]) => edge);
}
function crowdedArrivalGuns(battle: BattleSnapshot, guns: BattleArtillery[]) {
  const goal = { x: Math.floor(battle.width * 0.65), y: Math.floor(battle.height * 0.5) },
    distance = (p: TacticalPoint) => Math.hypot(p.x - goal.x, p.y - goal.y),
    crowded = new Set<string>();
  for (const gun of guns) {
    const edges = arrivalEdges(battle, gun);
    if (!edges.length) {
      continue;
    }
    const others = guns.filter(
      (other) => other !== gun && arrivalEdges(battle, other).some((edge) => edges.includes(edge)),
    );
    if (!others.length) {
      continue;
    }
    for (const actor of battle.units.filter(
      (u) =>
        u.side === 'player' &&
        u.hp >= 15 &&
        !u.unconscious &&
        !u.routed &&
        !u.departure &&
        artilleryContact(battle, u, gun),
    )) {
      const plan = artilleryCrewPlan(battle, actor, gun, artilleryCosts(battle, actor, gun).move);
      if (plan.reason) {
        continue;
      }
      const crew = battle.units.filter((u) => plan.crew.includes(u.id));
      for (const [dx, dy] of ([
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] satisfies [number, number][] )) {
        const destination = { ...gun, x: gun.x + dx, y: gun.y + dy };
        if (distance(destination) >= distance(gun)) {
          continue;
        }
        const translated = [destination, ...crew.map((u) => ({ ...u, x: u.x + dx, y: u.y + dy }))];
        for (const other of others) {
          if (translated.some((point) => sameCell(point, other))) {
            crowded.add(gun.id);
            crowded.add(other.id);
          }
        }
      }
    }
  }
  return crowded;
}

// Closely packed arrival guns share nearby soldiers. Select a legal move with
// the engine's actual crew, rather than reserving pairs that block each other.
// The cache is only for an immutable state; replay makes the same decisions.
export function stagedBatteryController() {
  const plans = new WeakMap<BattleSnapshot, TacticalAction | null>(),
    controllers = new WeakMap<BattleSnapshot, BattleController>(),
    crowding = new WeakMap<BattleSnapshot, Set<string>>();
  return (battle: BattleSnapshot, unit: BattleUnit): TacticalAction | null => {
    // Clear only an actual rigid-crew conflict in the arrival apron. Otherwise
    // let the existing coastal controller move its infantry screen and doctors.
    const loadedGuns = battle.artillery.filter(
      (g) => g.side === 'player' && (g.loaded || g.ammo > 0),
    );
    if (!controllers.has(battle)) {
      controllers.set(battle, coastalBatteryController(battle, { sharedArtillerySight: true }));
    }
    const ordinary = present(controllers.get(battle));
    if (!crowding.has(battle)) {
      crowding.set(
        battle,
        battle.mode === 'exploration' && loadedGuns.length > 1
          ? crowdedArrivalGuns(battle, loadedGuns)
          : new Set(),
      );
    }
    const crowded = present(crowding.get(battle));
    if (crowded.size) {
      // Moving a carriage must not suppress an actual adjacent finite dressing.
      const care = ordinary(battle, unit);
      if (care?.type === 'useItem' || (care && 'slot' in care ? care.slot : undefined) === 'medical') {
        return care;
      }
      if (!plans.has(battle)) {
        const goal = { x: Math.floor(battle.width * 0.65), y: Math.floor(battle.height * 0.5) };
        const distance = (gun: TacticalPoint) => Math.hypot(gun.x - goal.x, gun.y - goal.y);
        const guns = loadedGuns
          .filter((gun) => crowded.has(gun.id))
          .sort((a, b) => distance(b) - distance(a) || a.id.localeCompare(b.id));
        let action = null;
        for (const gun of guns) {
          const actors = battle.units.filter(
            (u) =>
              u.side === 'player' &&
              u.hp >= 15 &&
              !u.unconscious &&
              !u.routed &&
              !u.departure &&
              artilleryContact(battle, u, gun),
          );
          for (const actor of actors) {
            const plan = artilleryCrewPlan(
              battle,
              actor,
              gun,
              artilleryCosts(battle, actor, gun).move,
            );
            if (plan.reason) {
              continue;
            }
            const candidate = mountainBatteryOrder(battle, actor, {
              leaderId: actor.id,
              helperId: plan.crew.find((id) => id !== actor.id) ?? 'none',
              crewIds: plan.crew,
              artilleryId: gun.id,
              routeAroundObstacles: true,
              sharedArtillerySight: true,
            });
            if (candidate?.type === 'artilleryMove') {
              action = candidate;
              break;
            }
          }
          if (action) {
            break;
          }
        }
        plans.set(battle, action);
      }
      const action = plans.get(battle);
      if (action) {
        return "unitId" in action && action.unitId === unit.id ? action : null;
      }
    }
    // Once the arrival lane is clear, form crews from their current positions.
    return ordinary(battle, unit);
  };
}
