import { artilleryContact } from '../packages/game/tactical.js';
import { recoveryMendozaDressingOrder } from './recovery-mendoza-driver.mjs';
import { northernReliefDefenseController } from './northern-relief-defense.mjs';

// Opt in only at the real Mendoza fight. The ordinary battery keeps its
// actual fire, aid, loading and crew work. Before contact, its existing paid
// carried-linen relay may precede another approach or posture order.
export function mendozaInfantrySupportController(ordinary) {
  const support = northernReliefDefenseController([]);
  const controller = (battle, unit) => {
    const action = ordinary(battle, unit);
    if (action && !['move', 'look', 'stance', 'artilleryMove'].includes(action.type)) {
      return action;
    }
    return recoveryMendozaDressingOrder(battle, unit) ?? action;
  };
  // openingControlWindow calls this only after an entire ordinary squad pass
  // has no work. Use the existing Native public-sighting bound; a null remains
  // a hold. Do not borrow a physician, commander or current working gun post.
  controller.sharedFallback = (battle, unit) => {
    if (
      unit.medical >= 60 ||
      unit.id === '57' ||
      unit.missionAlly ||
      battle.artillery.some(
        (gun) =>
          gun.side === unit.side &&
          (gun.loaded || gun.ammo > 0) &&
          artilleryContact(battle, unit, gun),
      )
    ) {
      return null;
    }
    return support.sharedFallback(battle, unit);
  };
  return controller;
}
