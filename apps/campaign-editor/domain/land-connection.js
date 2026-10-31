const ORTHOGONAL_NEIGHBORS = Object.freeze([
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
]);

export class LandConnection {
  #cells;

  constructor(cells) {
    this.#cells = structuredClone(cells);
  }

  connects(originLocality, destinationLocality) {
    const origin = this.#cells.find((cell) => cell.anchor && cell.locality === originLocality);
    const destination = this.#cells.find(
      (cell) => cell.anchor && cell.locality === destinationLocality,
    );
    if (!origin?.land || !destination?.land) {
      return false;
    }
    const byPosition = new Map(this.#cells.map((cell) => [`${cell.col},${cell.row}`, cell]));
    const visited = new Set([origin.id]);
    const pending = [origin];
    for (const cell of pending) {
      if (cell.id === destination.id) {
        return true;
      }
      for (const [columnOffset, rowOffset] of ORTHOGONAL_NEIGHBORS) {
        const neighbor = byPosition.get(`${cell.col + columnOffset},${cell.row + rowOffset}`);
        if (!neighbor?.land || visited.has(neighbor.id)) {
          continue;
        }
        visited.add(neighbor.id);
        pending.push(neighbor);
      }
    }
    return false;
  }
}
