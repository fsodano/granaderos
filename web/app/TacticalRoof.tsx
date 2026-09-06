import type { ReactNode } from 'react';
import { entranceFrame, getBuildingProfile } from '../../game/building-profile.js';
import { buildingAppearance } from '../../game/building-appearance.js';
import { WALL_COLOURS } from './TacticalArchitectureMaterials';

type Point = { x: number; y: number };
type Vertex = Point & { z: number };
type Project = (x: number, y: number) => Point;
type Cell = { x: number; y: number };
const mix = (a: Vertex, b: Vertex, t: number): Vertex => ({
  x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t,
});

// Clip in world coordinates, retaining the height of each roof plane. The same
// operation works for vertical fascia and gables, without flattening their tops.
function clipToCell(points: Vertex[], cell: Cell, b: any, eave: number) {
  let result = points;
  const limits: [keyof Point, number, number][] = [
    ['x', Math.max(b.x - eave, cell.x - .5), 1],
    ['x', Math.min(b.x + b.width - 1 + eave, cell.x + .5), -1],
    ['y', Math.max(b.y - eave, cell.y - .5), 1],
    ['y', Math.min(b.y + b.height - 1 + eave, cell.y + .5), -1],
  ];
  for (const [axis, limit, sign] of limits) {
    const input = result; result = [];
    for (let i = 0; i < input.length; i++) {
      const a = input[i], c = input[(i + 1) % input.length];
      const aIn = (a[axis] - limit) * sign >= -1e-8, cIn = (c[axis] - limit) * sign >= -1e-8;
      if (aIn) result.push(a);
      if (aIn !== cIn) result.push(mix(a, c, (limit - a[axis]) / (c[axis] - a[axis])));
    }
  }
  return result;
}

/** Roof images follow each 3D plane; courses stay parallel across clipped hips. */
export function buildingRoof(b: any, revealed: Set<string>, project: Project, brightness: number) {
  const profile = getBuildingProfile(b), appearance = buildingAppearance(b), frame = entranceFrame(b);
  const rooms = b.rooms ?? [], hidden = rooms.filter((r: any) => !revealed.has(r.id));
  if (!hidden.length) return [];
  const whole = hidden.length === rooms.length, e = profile.eave, wide = frame.width, deep = frame.depth;
  const lo = -e, hi = wide + e, front = -e, back = deep + e, mid = wide / 2;
  const base = profile.wallHeight + 1, rise = Math.min(profile.roofRise, Math.max(10, wide * 7));
  const v = (u: number, d: number, z: number): Vertex => ({ ...frame.at(u, d), z });
  const projected = (a: Vertex) => { const q = project(a.x, a.y); return { x: q.x, y: q.y - a.z }; };
  const p = (a: Vertex) => { const q = projected(a); return `${q.x},${q.y}`; };
  const panels: Vertex[][] = [], gables: Vertex[][] = [], seams: Vertex[][] = [];
  const palette = WALL_COLOURS[appearance.wallFinish];
  if (profile.roofShape === 'hip') {
    const inset = Math.min(wide * .44, deep * .3), a = v(mid, inset, base + rise), c = v(mid, deep - inset, base + rise);
    const corners = [v(lo, front, base), v(lo, back, base), v(hi, back, base), v(hi, front, base)];
    panels.push([corners[0], corners[1], c, a], [corners[2], corners[3], a, c], [corners[3], corners[0], a, a], [corners[1], corners[2], c, c]);
    seams.push([a, c], [corners[0], a], [corners[3], a], [corners[1], c], [corners[2], c]);
  } else if (profile.roofShape === 'shed') {
    panels.push([v(lo, front, base), v(hi, front, base), v(hi, back, base + rise), v(lo, back, base + rise)]);
    const high = base + rise * (deep - front) / (back - front), low = base + rise * -front / (back - front);
    for (const u of [0, wide]) gables.push([v(u, 0, profile.wallHeight), v(u, deep, profile.wallHeight), v(u, deep, high), v(u, 0, low)]);
    gables.push([v(0, 0, profile.wallHeight), v(wide, 0, profile.wallHeight), v(wide, 0, low), v(0, 0, low)]);
    gables.push([v(0, deep, profile.wallHeight), v(wide, deep, profile.wallHeight), v(wide, deep, high), v(0, deep, high)]);
  } else {
    const a = v(mid, front, base + rise), c = v(mid, back, base + rise);
    panels.push([v(lo, front, base), v(lo, back, base), c, a], [v(hi, back, base), v(hi, front, base), a, c]);
    seams.push([a, c]);
    const shoulder = base + rise * e / (wide / 2 + e);
    for (const d of [0, deep]) gables.push([v(0, d, profile.wallHeight), v(0, d, shoulder), v(mid, d, base + rise), v(wide, d, shoulder), v(wide, d, profile.wallHeight)]);
  }

  // Multi-source expansion assigns wall cells to their nearest room in O(area).
  const owners = new Map<string, string>(), queue: Cell[] = [];
  const hiddenIds = new Set<string>(hidden.map((r: any) => r.id));
  if (!whole) {
    for (const room of rooms) for (const cell of room.cells) {
      owners.set(`${cell.x},${cell.y}`, room.id); queue.push(cell);
    }
    for (let head = 0; head < queue.length; head++) {
      const cell = queue[head], owner = owners.get(`${cell.x},${cell.y}`)!;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const x = cell.x + dx, y = cell.y + dy, key = `${x},${y}`;
        if (x < b.x || x >= b.x + b.width || y < b.y || y >= b.y + b.height || owners.has(key)) continue;
        owners.set(key, owner); queue.push({ x, y });
      }
    }
  }
  const covered = (a: Point) => whole || hiddenIds.has(owners.get(`${Math.max(b.x, Math.min(b.x + b.width - 1, Math.round(a.x)))},${Math.max(b.y, Math.min(b.y + b.height - 1, Math.round(a.y)))}`)!);
  const cells = queue.filter(c => hiddenIds.has(owners.get(`${c.x},${c.y}`)!));
  const polygons = (points: Vertex[]) => whole ? [points] : cells.map(cell => clipToCell(points, cell, b, e)).filter(poly => poly.length >= 3);
  const path = (points: Vertex[]) => polygons(points).map(poly => 'M' + poly.map(p).join('L') + 'Z').join('');
  const uid = Array.from(String(b.id)).map(c => c.codePointAt(0)!.toString(16)).join('-');
  const straw = appearance.roofFinish === 'thatch', aged = appearance.roofFinish === 'aged';
  const surfaces: ReactNode[] = [], fascia: ReactNode[] = [], defs: ReactNode[] = [];
  for (const [side, points] of panels.entries()) {
    // A very short end slope can face away from the camera on a resized shell.
    // Its reversed projected winding must not overpaint the visible roof face.
    const screen = points.map(projected);
    const signedArea = screen.reduce((sum, a, i) => {
      const c = screen[(i + 1) % screen.length]; return sum + a.x * c.y - c.x * a.y;
    }, 0);
    if (signedArea * (profile.roofShape === 'shed' ? 1 : -1) <= 1e-6) continue;
    const [a, c, d, f] = points, across = Math.hypot(c.x - a.x, c.y - a.y);
    const foot = mix(a, c, .5), top = mix(f, d, .5), slope = Math.hypot(top.x - foot.x, top.y - foot.y);
    const pa = projected(a), pc = projected(c), pt = projected(top), pf = projected(foot);
    // Texture +Y runs from the ridge to the eave. Affine mapping avoids tapered
    // tiles on hip trapezoids and uses the same physical scale on every face.
    const matrix = `${(pc.x - pa.x) / across} ${(pc.y - pa.y) / across} ${(pf.x - pt.x) / slope} ${(pf.y - pt.y) / slope} ${pa.x} ${pa.y}`;
    const pattern = `roof-material-${uid}-${side}`, w = straw ? 2.4 : 3.25, h = straw ? 2.8 : 3.5;
    defs.push(<pattern key={side} id={pattern} patternUnits="userSpaceOnUse" width={w} height={h} patternTransform={`matrix(${matrix})`}><image href={`/art/architecture-roof-${straw ? 'thatch' : 'clay'}-v2.png`} width={w} height={h} preserveAspectRatio="none"/></pattern>);
    const surface = path(points), shade = (top.x - foot.x) - (top.y - foot.y) > 0 ? .03 : .13;
    surfaces.push(<g key={side} data-roof-surface={side}>
      <path d={surface} fill={`url(#${pattern})`} style={aged ? { filter: 'saturate(.55) brightness(.84)' } : straw ? { filter: 'saturate(.55) brightness(.85)' } : undefined}/>
      <path d={surface} fill="#362b23" opacity={shade}/>
    </g>);
    const below = (n: Vertex) => ({ ...n, z: n.z - (straw ? 3.4 : 2.1) });
    fascia.push(<path key={side} d={path([a, c, below(c), below(a)])} fill={straw ? '#817045' : '#66503b'} stroke="#443727" strokeWidth=".35"/>);
  }
  const caps: ReactNode[] = [];
  for (const [seam, [a, c]] of seams.entries()) {
    const steps = Math.max(1, Math.ceil(Math.hypot(c.x - a.x, c.y - a.y) / .34));
    for (let i = 0; i < steps; i++) {
      const start = mix(a, c, i / steps), end = mix(a, c, (i + .94) / steps);
      if (!covered(mix(start, end, .5))) continue;
      caps.push(<g key={`${seam}-${i}`} data-roof-cap="true"><path d={`M${p(start)}L${p(end)}`} stroke={straw ? '#786344' : aged ? '#71604c' : '#865735'} strokeWidth={straw ? 4.5 : 3.6} strokeLinecap="round"/><path d={`M${p({ ...start, z: start.z + .55 })}L${p({ ...end, z: end.z + .55 })}`} stroke={straw ? '#af9766' : aged ? '#a28c6e' : '#b48157'} strokeWidth={straw ? 1.5 : 1.2} strokeLinecap="round"/></g>);
    }
  }
  return [{ key: `architecture-roof-${hidden[0].id}`, depth: b.x + b.y + b.width + b.height + .12, node:
    <g data-roof-room={hidden[0].id} data-roof-shape={profile.roofShape} data-roof-finish={appearance.roofFinish} data-roof-partial={whole ? undefined : 'true'} pointerEvents="none" style={{ filter: `brightness(${brightness})` }}>
      <defs>{defs}</defs>
      {gables.map((points, i) => <g key={i} data-building-gable="true"><path d={path(points)} fill={palette.base}/><path d={path(points)} fill="url(#architecture-plaster)" opacity=".45"/></g>)}
      {fascia}{surfaces}{caps}
    </g> }];
}
