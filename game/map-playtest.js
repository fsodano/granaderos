import { compileMap } from "./compile-map.js";
import { validateMap } from "./map-schema.js";
import { createBattle } from "./tactical.js";
export function createMapPlaytest(document) {
  const checked = validateMap(document, { playable: true });
  if (!checked.valid) throw Error(checked.errors.join("\n"));
  const map = compileMap(document),
    units = map.spawns.map((s) => ({
      id: s.id,
      name: s.name ?? (s.side === "player" ? "Granadero" : "Realista"),
      x: s.x,
      y: s.y,
      side: s.side,
      weapon: 1800,
    }));
  const battle = createBattle(
    units.filter((s) => s.side === "player"),
    {
      ...map,
      exploration: true,
      enemies: units.filter((s) => s.side === "enemy"),
      npcs: units.filter((s) => s.side === "civilian"),
    },
  );
  battle.sourceMapId = document.id;
  battle.sourceMapRevision = document.revision;
  return battle;
}
