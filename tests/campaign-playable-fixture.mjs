import { compileMap, reachableMap } from '../packages/game/compile-map.js';
import { propBlocksAt } from '../packages/game/props.js';

// Stock maps use configured deployment. Copies used as generic authored maps
// need their own explicit entry points in the same reachable walking area.
export function addPlayableSpawns(doc) {
  const map = compileMap(doc),
    open = map.tiles.filter((t) => !t.blocked && !propBlocksAt(map, t.x, t.y));
  const start = open.find((t) => t.x <= 2 && t.y >= 5) ?? open[0];
  if (!start) {
    throw Error('The fixture map has no walking area.');
  }
  const reached = reachableMap(map, start),
    end = open
      .filter((t) => reached.has(`${t.x},${t.y}`) && t !== start)
      .sort(
        (a, b) =>
          Math.abs(b.x - start.x) +
          Math.abs(b.y - start.y) -
          (Math.abs(a.x - start.x) + Math.abs(a.y - start.y)),
      )[0];
  if (!end) {
    throw Error('The fixture map has no enemy position.');
  }
  doc.spawns = [
    { id: 'fixture-player', x: start.x, y: start.y, side: 'player' },
    { id: 'fixture-enemy', x: end.x, y: end.y, side: 'enemy' },
  ];
  return doc;
}
