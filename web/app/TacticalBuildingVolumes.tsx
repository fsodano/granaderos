import type { ReactNode } from 'react';

export type PlanPoint = { x: number; y: number };
export type ElevatedPoint = PlanPoint & { z: number };
export type ArchitecturePalette = {
  base: string;
  trim: string;
  shadow: string;
};
export type Project = (x: number, y: number) => PlanPoint;

export const screenPoint = (p: ElevatedPoint, project: Project) => {
  const q = project(p.x, p.y);
  return { x: q.x, y: q.y - p.z };
};
export const pointList = (points: ElevatedPoint[], project: Project) =>
  points
    .map((p) => {
      const q = screenPoint(p, project);
      return `${q.x},${q.y}`;
    })
    .join(' ');

/** Project a solid plan polygon, with the two camera-facing walls and its cap.
 * Plan points are counter-clockwise in map coordinates. The viewport always
 * looks toward decreasing x/y, so positive-x/positive-y faces are visible.
 */
export function ArchitectureVolume({
  points,
  bottom = 0,
  top,
  palette,
  project,
  texture = 'plaster',
  label,
  cap = true,
}: {
  points: PlanPoint[];
  bottom?: number;
  top: number | number[];
  palette: ArchitecturePalette;
  project: Project;
  texture?: 'plaster' | 'stone' | 'brick' | 'wood' | 'none';
  label?: string;
  cap?: boolean;
}) {
  const heights = typeof top === 'number' ? points.map(() => top) : top;
  const raised = points.map((p, i) => ({ ...p, z: heights[i] }));
  const faces: ReactNode[] = [];
  points.forEach((p, i) => {
    const j = (i + 1) % points.length,
      q = points[j];
    const nx = q.y - p.y,
      ny = p.x - q.x;
    if (nx + ny <= 0) return;
    const face = pointList(
      [{ ...p, z: bottom }, { ...q, z: bottom }, raised[j], raised[i]],
      project,
    );
    const a = project(p.x, p.y),
      c = project(q.x, q.y);
    // Forty local units equal one map tile, regardless of the width of this
    // particular pier or tower. Masonry joints follow the actual wall plane.
    const wallWidth = Math.hypot(q.x - p.x, q.y - p.y) * 40;
    const textureMatrix = `matrix(${(c.x - a.x) / wallWidth} ${(c.y - a.y) / wallWidth} 0 1 ${a.x} ${a.y})`;
    faces.push(
      <g key={i}>
        <polygon points={face} fill={nx > 0 ? palette.shadow : palette.base} />
        {texture !== 'none' && (
          <g transform={textureMatrix}>
            <polygon
              points={`0,${-bottom} ${wallWidth},${-bottom} ${wallWidth},${-heights[j]} 0,${-heights[i]}`}
              fill={`url(#architecture-${texture})`}
              opacity={texture === 'plaster' ? '.36' : '.6'}
            />
          </g>
        )}
        <polygon
          points={face}
          fill="none"
          stroke={palette.shadow}
          strokeWidth=".45"
        />
      </g>,
    );
  });
  return (
    <g data-architectural-volume={label}>
      {faces}
      {cap && (
        <polygon
          points={pointList(raised, project)}
          fill={palette.trim}
          stroke={palette.shadow}
          strokeWidth=".5"
        />
      )}
    </g>
  );
}

/** A wall-local matrix. Local X is 0..40 across the wall; local Y is altitude. */
export function faceMatrix(
  a: PlanPoint,
  b: PlanPoint,
  project: Project,
  height = 0,
) {
  const p = project(a.x, a.y),
    q = project(b.x, b.y);
  return `matrix(${(q.x - p.x) / 40} ${(q.y - p.y) / 40} 0 1 ${p.x} ${p.y - height})`;
}

export function faceIsVisible(a: PlanPoint, b: PlanPoint) {
  return b.y - a.y + a.x - b.x > 0;
}

/** The same physical tile scale is used on large roofs and small canopies.
 * Points run along the eave first, then return along the high edge. Duplicate
 * the last two points for a triangular pyramid face. Texture Y runs downhill.
 */
export function ProjectedRoofSurface({
  id,
  points,
  project,
  finish = 'clay',
}: {
  id: string;
  points: ElevatedPoint[];
  project: Project;
  finish?: string;
}) {
  const [a, c, d, f] = points;
  const midpoint = (p: ElevatedPoint, q: ElevatedPoint) => ({
    x: (p.x + q.x) / 2,
    y: (p.y + q.y) / 2,
    z: (p.z + q.z) / 2,
  });
  const foot = midpoint(a, c),
    top = midpoint(f, d);
  const across = Math.hypot(c.x - a.x, c.y - a.y);
  if (across < 0.001) return null;
  // A mitred canopy is a trapezoid with an offset high edge. Remove that
  // sideways offset so tile courses follow the actual downhill direction.
  const alongX = (c.x - a.x) / across,
    alongY = (c.y - a.y) / across,
    sideways = (foot.x - top.x) * alongX + (foot.y - top.y) * alongY;
  const ridge = {
    ...top,
    x: top.x + sideways * alongX,
    y: top.y + sideways * alongY,
  };
  const slope = Math.hypot(ridge.x - foot.x, ridge.y - foot.y);
  if (across < 0.001 || slope < 0.001) return null;
  const pa = screenPoint(a, project),
    pc = screenPoint(c, project),
    pt = screenPoint(ridge, project),
    pf = screenPoint(foot, project);
  const matrix = `${(pc.x - pa.x) / across} ${(pc.y - pa.y) / across} ${(pf.x - pt.x) / slope} ${(pf.y - pt.y) / slope} ${pa.x} ${pa.y}`;
  const pattern = `architecture-detail-roof-${Array.from(id)
    .map((c) => c.codePointAt(0)!.toString(16))
    .join('-')}`;
  const straw = finish === 'thatch',
    aged = finish === 'aged',
    width = straw ? 2.4 : 3.25,
    height = straw ? 2.8 : 3.5;
  const style = aged
    ? { filter: 'saturate(.55) brightness(.84)' }
    : straw
      ? { filter: 'saturate(.55) brightness(.85)' }
      : undefined;
  const low = (p: ElevatedPoint) => ({ ...p, z: p.z - 1.6 });
  return (
    <g data-detail-roof-surface="true">
      <defs>
        <pattern
          id={pattern}
          patternUnits="userSpaceOnUse"
          width={width}
          height={height}
          patternTransform={`matrix(${matrix})`}
        >
          <image
            href={`/art/architecture-roof-${straw ? 'thatch' : 'clay'}-v2.png`}
            width={width}
            height={height}
            preserveAspectRatio="none"
          />
        </pattern>
      </defs>
      <polygon
        points={pointList([a, c, low(c), low(a)], project)}
        fill="#66503b"
        stroke="#443727"
        strokeWidth=".35"
      />
      <polygon
        points={pointList(points, project)}
        fill={`url(#${pattern})`}
        style={style}
      />
      <polygon
        points={pointList(points, project)}
        fill="#362b23"
        opacity={top.x - foot.x - (top.y - foot.y) > 0 ? 0.03 : 0.13}
      />
    </g>
  );
}
