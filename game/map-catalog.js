export const TERRAIN = {
  grass: "Pasto",
  road: "Camino",
  stone: "Piedra",
  mud: "Barro",
  water: "Agua",
  forest: "Bosque",
  scrub: "Matorral",
};
export const FEATURES = {
  tree: { name: "Árbol", terrain: "forest", blocked: false, cover: 20 },
  rock: { name: "Roca", terrain: "stone", blocked: true, cover: 40 },
  shrub: { name: "Arbusto", terrain: "scrub", blocked: false, cover: 10 },
};
export const FURNITURE = {
  table: { name: "Mesa", width: 1, height: 1 },
  bench: { name: "Banco", width: 1, height: 1 },
  bed: { name: "Cama", width: 1, height: 2 },
  chest: { name: "Baúl", width: 1, height: 1 },
  barrels: { name: "Barriles", width: 1, height: 1 },
  hay: { name: "Heno", width: 1, height: 1 },
};
export const ITEM_TYPES = {
  ammo: "Cartuchos",
  medkits: "Vendas",
  rations: "Raciones",
  torches: "Antorchas",
};
export const LAYERS = ["features", "buildings", "props", "items", "spawns", "exits", "lights"];
export const cellKey = (p) => `${p.x},${p.y}`;
export const neighbours = (p) =>
  [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ].map(([x, y]) => ({ x: p.x + x, y: p.y + y }));
export function ground(x, y, type = "grass") {
  return { x, y, type, blocked: type === "water", cover: type === "forest" ? 20 : 0 };
}

export const BUILDING_KINDS = {
  house: "Casa rural",
  posta: "Posta",
  barracks: "Barraca",
  church: "Iglesia",
  chapel: "Capilla",
  cabildo: "Cabildo",
  pulperia: "Pulpería",
  warehouse: "Almacén",
  smithy: "Herrería",
  stable: "Caballeriza",
};
