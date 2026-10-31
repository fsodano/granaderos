const level = (point) => point?.tacticalLevel ?? 0;
export const wallEdgeKey = (edge) => `${level(edge)}:${edge.axis}:${edge.x},${edge.y}`;
export function wallEdgeCells(edge) {
  const a = { x: edge.x, y: edge.y, tacticalLevel: level(edge) };
  return edge.axis === 'x' ? [{ ...a, y: a.y - 1 }, a] : [{ ...a, x: a.x - 1 }, a];
}
/** @returns {{width:number,height:number}} */
export function propSize(prop) {
  return prop.footprint ?? { width: 1, height: 1 };
}
/** @returns {{x:number,y:number,tacticalLevel?:number}[]} */
export function propCells(prop) {
  const { width, height } = propSize(prop),
    cells = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      cells.push({
        x: prop.x + x,
        y: prop.y + y,
        ...(prop.tacticalLevel === undefined ? {} : { tacticalLevel: prop.tacticalLevel }),
      });
    }
  }
  return cells;
}
