// Screen-independent geometry shared by the web editor and its tests.
export function rectangleCells(a, b) {
  const x = Math.min(a.x, b.x),
    y = Math.min(a.y, b.y),
    width = Math.abs(a.x - b.x) + 1,
    height = Math.abs(a.y - b.y) + 1;
  return Array.from({ length: width * height }, (_, i) => ({
    x: x + (i % width),
    y: y + Math.floor(i / width),
  }));
}
export function lineCells(a, b) {
  const cells = [],
    steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
  for (let i = 0; i <= steps; i++)
    cells.push({
      x: Math.round(a.x + ((b.x - a.x) * i) / (steps || 1)),
      y: Math.round(a.y + ((b.y - a.y) * i) / (steps || 1)),
    });
  return cells;
}
export function isometricCell(client, box, camera, origin, bounds) {
  if (
    client.x < box.left ||
    client.y < box.top ||
    client.x > box.left + box.width ||
    client.y > box.top + box.height
  )
    return null;
  const scale = Math.min(box.width / camera.width, box.height / camera.height),
    offsetX = (box.width - camera.width * scale) / 2,
    offsetY = (box.height - camera.height * scale) / 2;
  const sx = (client.x - box.left - offsetX) / scale + camera.x - origin.x,
    sy = (client.y - box.top - offsetY) / scale + camera.y - origin.y;
  const x = Math.round((sx / 26 + sy / 14) / 2),
    y = Math.round((sy / 14 - sx / 26) / 2);
  return x >= 0 && y >= 0 && x < bounds.width && y < bounds.height ? { x, y } : null;
}
export function seededTerrainCommands(
  document,
  { seed = 1, density = 0.15, type = "forest" } = {},
) {
  let value = seed >>> 0;
  const cells = [];
  for (const t of document.terrain) {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    if (value / 4294967296 < density) cells.push({ x: t.x, y: t.y });
  }
  return [{ type: "paintTerrain", terrain: type, cells }];
}
