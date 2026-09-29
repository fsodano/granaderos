const obsolete = item => item === 'priming' || item === 'flints';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const list = value => Array.isArray(value) ? value : [];
const values = value => object(value) ? Object.values(value) : [];

// The basic ignition kit is implicit. Remove its old ownership references,
// while keeping arbitrary inventory keys and immutable story definitions.
export function removeUnitIgnitionSupplies(unit) {
  if (!object(unit)) return unit;
  delete unit.priming; delete unit.flints;
  if (obsolete(unit.activeItem)) {
    delete unit.activeItem;
    if (unit.activeSlot === 'item') unit.activeSlot = 'unarmed';
  }
  if (obsolete(unit.activeSupply)) {
    delete unit.activeSupply;
    if (unit.activeSlot === 'supply') unit.activeSlot = 'unarmed';
  }
  if (obsolete(unit.leftHandItem)) unit.leftHandItem = null;
  if (obsolete(unit.equipmentCursor?.stack?.item)) delete unit.equipmentCursor;
  if (Array.isArray(unit.pocketOrder)) unit.pocketOrder = unit.pocketOrder.filter(pocket => !obsolete(pocket?.item));
  if (object(unit.civilianSupplies)) {delete unit.civilianSupplies.priming; delete unit.civilianSupplies.flints;}
  return unit;
}

function scene(value) {
  if (!object(value)) return;
  removeUnitIgnitionSupplies(value);
  for (const key of ['units', 'npcs', 'squad', 'garrison', 'enemies', 'missionAllies', 'trainees', 'ammunitionSources', 'garrisonLootSources', 'casualtyLootSources']) {
    for (const unit of list(value[key])) removeUnitIgnitionSupplies(unit);
  }
  for (const remains of list(value.remains)) removeUnitIgnitionSupplies(remains?.unit);
  if (Array.isArray(value.groundItems)) value.groundItems = value.groundItems.filter(item => !obsolete(item?.type) && !obsolete(item?.item));
  for (const prop of list(value.props)) if (Array.isArray(prop?.contents)) prop.contents = prop.contents.filter(item => !obsolete(item?.item));
  if (value.resumeSnapshot) scene(value.resumeSnapshot);
}

export function removeIgnitionSupplies(state) {
  if (!object(state)) return state;
  scene(state);
  for (const key of ['operativeState', 'missionAllies']) for (const unit of values(state[key])) removeUnitIgnitionSupplies(unit);
  for (const units of values(state.garrisons)) for (const unit of list(units)) removeUnitIgnitionSupplies(unit);
  for (const group of [...list(state.militiaTraining), ...list(state.enemyGroups)]) scene(group);
  for (const remains of values(state.sectorRemains)) for (const entry of list(remains)) removeUnitIgnitionSupplies(entry?.unit);
  for (const snapshot of [...values(state.sectorStates), ...values(state.sceneStates), state.pendingBattle]) scene(snapshot);
  return state;
}
