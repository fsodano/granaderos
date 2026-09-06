// Visual properties do not change tile occupancy or door state.
export const WALL_FINISHES = {
  adobe: "Adobe visto",
  limewash: "Cal blanca",
  ochre: "Cal ocre",
  stone: "Mampostería de piedra",
  brick: "Ladrillo visto",
};
export const ROOF_FINISHES = { clay: "Teja rojiza", aged: "Teja envejecida", thatch: "Paja" };
export const DOOR_STYLES = {
  plank: "Tablas de madera",
  panelled: "Cuarterones",
  double: "Doble hoja",
  arched: "Arco de medio punto",
  barn: "Portón de trabajo",
};
export const WINDOW_STYLES = {
  barred: "Reja de hierro",
  shutters: "Postigos de madera",
  arched: "Ventana de arco",
  small: "Tronera pequeña",
  lattice: "Celosía de madera",
};
export const BUILDING_APPEARANCES = {
  house: { wallFinish: "adobe", roofFinish: "thatch", doorStyle: "plank", windowStyle: "shutters" },
  posta: {
    wallFinish: "ochre",
    roofFinish: "aged",
    doorStyle: "panelled",
    windowStyle: "shutters",
  },
  barracks: {
    wallFinish: "limewash",
    roofFinish: "aged",
    doorStyle: "double",
    windowStyle: "small",
  },
  church: {
    wallFinish: "limewash",
    roofFinish: "clay",
    doorStyle: "arched",
    windowStyle: "arched",
  },
  chapel: { wallFinish: "ochre", roofFinish: "aged", doorStyle: "arched", windowStyle: "small" },
  cabildo: {
    wallFinish: "limewash",
    roofFinish: "clay",
    doorStyle: "panelled",
    windowStyle: "barred",
  },
  townhall: {
    wallFinish: "limewash",
    roofFinish: "aged",
    doorStyle: "double",
    windowStyle: "barred",
  },
  palace: {
    wallFinish: "ochre",
    roofFinish: "clay",
    doorStyle: "panelled",
    windowStyle: "arched",
  },
  pulperia: {
    wallFinish: "ochre",
    roofFinish: "clay",
    doorStyle: "double",
    windowStyle: "lattice",
  },
  warehouse: { wallFinish: "stone", roofFinish: "aged", doorStyle: "barn", windowStyle: "small" },
  depot: { wallFinish: "brick", roofFinish: "aged", doorStyle: "barn", windowStyle: "small" },
  farmhouse: { wallFinish: "limewash", roofFinish: "clay", doorStyle: "plank", windowStyle: "shutters" },
  smithy: { wallFinish: "brick", roofFinish: "aged", doorStyle: "barn", windowStyle: "barred" },
  stable: { wallFinish: "adobe", roofFinish: "thatch", doorStyle: "barn", windowStyle: "lattice" },
};
export function buildingAppearance(b = {}) {
  const base = BUILDING_APPEARANCES[b.kind] ?? {
    wallFinish: b.material === "stone" ? "stone" : "limewash",
    roofFinish: "clay",
    doorStyle: "plank",
    windowStyle: "barred",
  };
  return Object.fromEntries(Object.entries(base).map(([key, value]) => [key, b[key] ?? value]));
}
