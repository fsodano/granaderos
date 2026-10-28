import {
  WALL_FINISHES,
  ROOF_FINISHES,
  DOOR_STYLES,
  WINDOW_STYLES,
} from '../campaign-format/building-appearance-schema.js';
export {
  WALL_FINISHES,
  ROOF_FINISHES,
  DOOR_STYLES,
  WINDOW_STYLES,
} from '../campaign-format/building-appearance-schema.js';
export const BUILDING_APPEARANCES = {
  house: { wallFinish: 'adobe', roofFinish: 'thatch', doorStyle: 'plank', windowStyle: 'shutters' },
  posta: {
    wallFinish: 'ochre',
    roofFinish: 'aged',
    doorStyle: 'panelled',
    windowStyle: 'shutters',
  },
  barracks: {
    wallFinish: 'limewash',
    roofFinish: 'aged',
    doorStyle: 'double',
    windowStyle: 'small',
  },
  church: {
    wallFinish: 'limewash',
    roofFinish: 'clay',
    doorStyle: 'arched',
    windowStyle: 'arched',
  },
  chapel: { wallFinish: 'ochre', roofFinish: 'aged', doorStyle: 'arched', windowStyle: 'small' },
  cabildo: {
    wallFinish: 'limewash',
    roofFinish: 'clay',
    doorStyle: 'panelled',
    windowStyle: 'barred',
  },
  townhall: {
    wallFinish: 'limewash',
    roofFinish: 'aged',
    doorStyle: 'double',
    windowStyle: 'barred',
  },
  palace: {
    wallFinish: 'ochre',
    roofFinish: 'clay',
    doorStyle: 'panelled',
    windowStyle: 'arched',
  },
  pulperia: {
    wallFinish: 'ochre',
    roofFinish: 'clay',
    doorStyle: 'double',
    windowStyle: 'lattice',
  },
  warehouse: { wallFinish: 'stone', roofFinish: 'aged', doorStyle: 'barn', windowStyle: 'small' },
  depot: { wallFinish: 'brick', roofFinish: 'aged', doorStyle: 'barn', windowStyle: 'small' },
  farmhouse: {
    wallFinish: 'limewash',
    roofFinish: 'clay',
    doorStyle: 'plank',
    windowStyle: 'shutters',
  },
  smithy: { wallFinish: 'brick', roofFinish: 'aged', doorStyle: 'barn', windowStyle: 'barred' },
  stable: { wallFinish: 'adobe', roofFinish: 'thatch', doorStyle: 'barn', windowStyle: 'lattice' },
};
export function buildingAppearance(b = {}) {
  const base = BUILDING_APPEARANCES[b.kind] ?? {
    wallFinish: b.material === 'stone' ? 'stone' : 'limewash',
    roofFinish: 'clay',
    doorStyle: 'plank',
    windowStyle: 'barred',
  };
  return Object.fromEntries(Object.entries(base).map(([key, value]) => [key, b[key] ?? value]));
}
