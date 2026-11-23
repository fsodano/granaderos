import { canSee } from './tactical.js';
import { isInteriorVisible } from './tactical-visibility.ts';
import { propCells } from './props.js';
import {
  discoveryObservers,
  isBodyFound,
  isDroppedWeaponFound,
  isGroundItemFound,
  isOpenChestFound,
} from './domain/perception/inventory-discovery.ts';

// Discovery survives losing sight. It grants knowledge of loose equipment,
// not of hidden bodies, living opponents' packs or unopened containers. The
// map reports what each observer sees; the domain decides what counts as
// found.
export function discoverInventory(state) {
  const observers = discoveryObservers(state.units);
  const rooms = new Set(state.revealedRooms ?? []);
  const sight = {
    interiorVisible: (point) => isInteriorVisible(state, point, rooms),
    observerSees: (observer, point) => canSee(state, observer, point),
  };
  for (const item of state.groundItems ?? []) {
    if (isGroundItemFound(item, observers, sight)) {
      item.knownToPlayer = true;
    }
  }
  for (const item of state.droppedWeapons ?? []) {
    if (isDroppedWeaponFound(item, observers, sight)) {
      item.knownToPlayer = true;
    }
  }
  for (const unit of state.units) {
    if (isBodyFound(unit, observers, sight)) {
      unit.knownToPlayer = true;
    }
  }
  for (const prop of state.props ?? []) {
    if (
      isOpenChestFound(
        { type: prop.type, open: prop.open, cells: propCells(prop) },
        observers,
        sight,
      )
    ) {
      prop.knownToPlayer = true;
    }
  }
}
