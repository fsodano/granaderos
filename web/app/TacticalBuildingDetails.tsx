import { buildingAppearance } from '../../game/building-appearance.js';
import {
  entranceFrame,
  getBuildingProfile,
} from '../../game/building-profile.js';
import { WALL_COLOURS } from './TacticalArchitectureMaterials';
import {
  ArchitectureVolume,
  ProjectedRoofSurface,
  faceIsVisible,
  faceMatrix,
  pointList,
  screenPoint,
} from './TacticalBuildingVolumes';
import type { ElevatedPoint, Project } from './TacticalBuildingVolumes';
import type { ReactNode } from 'react';

type SceneObject = { key: string; depth: number; node: ReactNode };
const stone = { base: '#a99a79', trim: '#c7b795', shadow: '#776d54' };
const timber = { base: '#765537', trim: '#a28052', shadow: '#493b2a' };
const brick = { base: '#9b6849', trim: '#bd8b61', shadow: '#6f4a35' };

/** Architecture is anchored to authored walls. Every ground-level pier stays
 * inside an occupied wall cell. The complete detail group cuts away together
 * with the roof, so it cannot obscure actors in a revealed interior.
 */
export function buildingDetails(
  b: any,
  revealed: Set<string>,
  project: Project,
): SceneObject[] {
  if (!b.kind || b.rooms?.some((r: any) => revealed.has(r.id))) return [];
  const f = entranceFrame(b),
    profile = getBuildingProfile(b),
    h = profile.wallHeight;
  const palette = WALL_COLOURS[buildingAppearance(b).wallFinish];
  const nodes: ReactNode[] = [];
  const backNodes: ReactNode[] = [];
  const frontVisible = -f.v.x - f.v.y > 0;
  const at = (u: number, v: number) => f.at(u, v);
  const quad = (u0: number, v0: number, u1: number, v1: number) => [
    at(u0, v0),
    at(u1, v0),
    at(u1, v1),
    at(u0, v1),
  ];
  const point = (u: number, v: number, z: number) => ({ ...at(u, v), z });
  const polygon = (points: ElevatedPoint[]) => pointList(points, project);
  const solid = (
    key: string,
    u0: number,
    v0: number,
    u1: number,
    v1: number,
    bottom: number,
    top: number | number[],
    colours = palette,
    texture: 'plaster' | 'stone' | 'brick' | 'wood' | 'none' = 'plaster',
    cap = true,
  ) => (
    <ArchitectureVolume
      key={key}
      points={quad(u0, v0, u1, v1)}
      bottom={bottom}
      top={top}
      palette={colours}
      project={project}
      texture={texture}
      label={key}
      cap={cap}
    />
  );
  const wallAt = (u: number, v: number) => {
    const p = at(u, v);
    return b.walls?.find(
      (w: any) => w.x === Math.round(p.x) && w.y === Math.round(p.y),
    );
  };
  const line = (a: ElevatedPoint, c: ElevatedPoint) => {
    const p = screenPoint(a, project),
      q = screenPoint(c, project);
    return `M${p.x},${p.y}L${q.x},${q.y}`;
  };

  function pier(
    u: number,
    v: number,
    width = 0.3,
    height = h,
    label = 'pilaster',
    depth = 0.34,
  ) {
    if (wallAt(u, v)?.type !== 'wall') return;
    nodes.push(
      solid(
        `${label}-${u}-${v}-shaft`,
        u - width / 2,
        v - depth,
        u + width / 2,
        v + 0.15,
        0,
        height,
      ),
    );
    nodes.push(
      solid(
        `${label}-${u}-${v}-base`,
        u - width / 2 - 0.07,
        v - depth - 0.05,
        u + width / 2 + 0.07,
        v + 0.2,
        0,
        profile.plinthHeight,
        stone,
        'stone',
        false,
      ),
    );
    nodes.push(
      solid(
        `${label}-${u}-${v}-capital`,
        u - width / 2 - 0.05,
        v - depth - 0.03,
        u + width / 2 + 0.05,
        v + 0.19,
        height - 3.5,
        height + 1.5,
      ),
    );
  }

  function pediment(u0: number, u1: number, rise: number) {
    const pedimentNodes = frontVisible ? nodes : backNodes;
    // The curved front is a thick masonry wall, with a continuous return and
    // moulding following its upper silhouette, not an ornament above a door.
    const z0 = h + 1,
      a = at(u0, -0.27),
      c = at(u1, -0.27);
    const scale = rise / 50;
    const curve = `M0,0V-${5 * scale}C5,-${6 * scale} 7,-${10 * scale} 9,-${23 * scale}C11,-${34 * scale} 14,-${29 * scale} 15,-${40 * scale}C17,-${53 * scale} 23,-${53 * scale} 25,-${40 * scale}C26,-${29 * scale} 29,-${34 * scale} 31,-${23 * scale}C33,-${10 * scale} 35,-${6 * scale} 40,-${5 * scale}V0Z`;
    const back = faceMatrix(at(u0, 0.08), at(u1, 0.08), project, z0);
    pedimentNodes.push(
      <g key="shaped-pediment" data-architectural-volume="shaped-pediment">
        <g transform={back}>
          <path
            d={curve}
            fill={palette.shadow}
            stroke={palette.shadow}
            strokeWidth="3"
          />
        </g>
        <g transform={frontVisible ? faceMatrix(a, c, project, z0) : back}>
          <path
            d={curve}
            fill={palette.base}
            stroke={palette.shadow}
            strokeWidth=".8"
          />
          <path d={curve} fill="url(#architecture-plaster)" opacity=".3" />
          <path d={curve} fill="none" stroke={palette.trim} strokeWidth="2.8" />
          <path d={curve} fill="none" stroke="#a99873" strokeWidth=".6" />
          {frontVisible && (
            <path
              d={`M17,-${10 * scale}V-${21 * scale}a3,${5 * scale} 0 0 1 6,0V-${10 * scale}Z`}
              fill="#8b7d5e"
              stroke={palette.trim}
              strokeWidth="1.2"
            />
          )}
          {frontVisible && (
            <path
              d={`M20,-${12 * scale}V-${22 * scale}`}
              stroke="#c5b590"
              strokeWidth="1.6"
            />
          )}
        </g>
      </g>,
    );
    pedimentNodes.push(
      solid('pediment-cornice', u0 - 0.08, -0.34, u1 + 0.08, 0.2, h - 3, h + 3),
    );
    const cross = screenPoint(
      point((u0 + u1) / 2, -0.08, z0 + rise * 1.06),
      project,
    );
    pedimentNodes.push(
      <g
        key="pediment-cross"
        transform={`translate(${cross.x} ${cross.y})`}
        stroke="#5e4a2d"
        strokeWidth="1.25"
        fill="none"
      >
        <path d="M0,0V-12M-4,-8H4" />
        <path
          d="M0,-12l-1.5,-2L0,-16l1.5,2ZM-4,-8l-2,-1.5L-8,-8l2,1.5ZM4,-8l2,-1.5L8,-8l-2,1.5Z"
          strokeWidth=".8"
        />
      </g>,
    );
  }

  function pyramid(
    key: string,
    u0: number,
    v0: number,
    u1: number,
    v1: number,
    z: number,
    rise: number,
  ) {
    const base = quad(u0, v0, u1, v1),
      apex = point((u0 + u1) / 2, (v0 + v1) / 2, z + rise),
      pieces: ReactNode[] = [];
    const faces = [0, 1, 2, 3].sort((i, j) => {
      const a = base[i],
        c = base[(i + 1) % 4],
        d = base[j],
        e = base[(j + 1) % 4];
      return a.x + a.y + c.x + c.y - d.x - d.y - e.x - e.y;
    });
    // A low hip can expose parts of all four roof planes. Vertical-wall
    // visibility rules would omit a rear triangle and expose the cornice cap.
    for (const i of faces) {
      const a = base[i],
        c = base[(i + 1) % base.length];
      const pa = screenPoint({ ...a, z }, project),
        pc = screenPoint({ ...c, z }, project),
        peak = screenPoint(apex, project);
      const projectedArea =
        (pc.x - pa.x) * (peak.y - pa.y) - (pc.y - pa.y) * (peak.x - pa.x);
      if (projectedArea <= 0.0001) continue;
      pieces.push(
        <ProjectedRoofSurface
          key={i}
          id={`${b.id}-${key}-${i}`}
          points={[{ ...a, z }, { ...c, z }, apex, apex]}
          project={project}
          finish={
            buildingAppearance(b).roofFinish === 'thatch'
              ? 'clay'
              : buildingAppearance(b).roofFinish
          }
        />,
      );
      const steps = Math.ceil(Math.hypot(apex.x - a.x, apex.y - a.y) / 0.34);
      for (let step = 0; step < steps; step++) {
        const at = (t: number) => ({
          x: a.x + (apex.x - a.x) * t,
          y: a.y + (apex.y - a.y) * t,
          z: z + rise * t,
        });
        const start = at(step / steps),
          end = at((step + 0.95) / steps);
        pieces.push(
          <g key={`hip-${i}-${step}`}>
            <path
              d={line(start, end)}
              stroke="#865735"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d={line(
                { ...start, z: start.z + 0.5 },
                { ...end, z: end.z + 0.5 },
              )}
              stroke="#b48157"
              strokeWidth="1.1"
              strokeLinecap="round"
            />
          </g>,
        );
      }
    }
    nodes.push(
      <g key={key} data-architectural-volume="tower-hip-roof">
        {pieces}
      </g>,
    );
  }

  function tower() {
    const towerNodes = frontVisible ? nodes : backNodes;
    const reserve = (end: boolean) =>
      [0, 1].every((u) =>
        [0, 1].every((v) => wallAt(end ? f.width - u : u, v)?.type === 'wall'),
      );
    const corners = [true, false];
    const end =
      corners.find(reserve) ??
      corners.find((end) => wallAt(end ? f.width : 0, 0)?.type === 'wall');
    // A custom church may have openings on either corner. A smaller tower
    // still requires a solid bearing cell; never cover an authored opening.
    if (end === undefined) return;
    const wide = reserve(end),
      u0 = end ? f.width - (wide ? 1.4 : 0.4) : -0.4,
      u1 = end ? f.width + 0.4 : wide ? 1.4 : 0.4;
    const v0 = -0.4,
      v1 = wide ? 1.4 : 0.4,
      z = h + (wide ? 73 : 60);
    const base = 0;
    towerNodes.push(solid('square-bell-tower', u0, v0, u1, v1, base, z));
    if (base === 0)
      towerNodes.push(
        solid(
          'tower-stone-base',
          u0,
          v0,
          u1,
          v1,
          0,
          profile.plinthHeight + 2,
          stone,
          'stone',
          false,
        ),
      );
    for (const [i, altitude] of [h - 2, h + 7, z - 4, z + 2].entries())
      towerNodes.push(
        solid(
          `tower-cornice-${i}`,
          u0 - 0.06,
          v0 - 0.06,
          u1 + 0.06,
          v1 + 0.06,
          altitude,
          altitude + 3,
          palette,
          'plaster',
          false,
        ),
      );
    const p = quad(u0, v0, u1, v1);
    p.forEach((a, i) => {
      const c = p[(i + 1) % 4];
      if (!faceIsVisible(a, c)) return;
      towerNodes.push(
        <g key={`belfry-${i}`} transform={faceMatrix(a, c, project, h + 16)}>
          <path
            d="M11,0V-28a9,9 0 0 1 18,0V0Z"
            fill="#3d382b"
            stroke={palette.trim}
            strokeWidth="2.5"
          />
          <path
            d="M12,-1V-27a8,8 0 0 1 16,0"
            fill="none"
            stroke="#8c7852"
            strokeWidth="1.3"
          />
          <path d="M13,-26H27M20,-26V-17" stroke="#59472d" strokeWidth="2" />
          <path
            d="M16,-7Q18,-11 18,-18H22Q22,-11 24,-7Z"
            fill="#8d7744"
            stroke="#423f28"
            strokeWidth=".8"
          />
          <path d="M15,-7H25" stroke="#c2a668" strokeWidth="1.5" />
          <path d="M20,-6V-3" stroke="#5c4e2c" strokeWidth="1.2" />
          <path d="M8,1H32" stroke={palette.shadow} strokeWidth="1" />
        </g>,
      );
    });
    pyramid(
      'church-tower-roof',
      u0 - 0.1,
      v0 - 0.1,
      u1 + 0.1,
      v1 + 0.1,
      z + 6,
      wide ? 21 : 15,
    );
    const q = screenPoint(
      point((u0 + u1) / 2, (v0 + v1) / 2, z + (wide ? 29 : 23)),
      project,
    );
    towerNodes.push(
      <path
        key="tower-cross"
        d={`M${q.x},${q.y}v-19m-6,7h12`}
        fill="none"
        stroke="#5f4b2d"
        strokeWidth="1.8"
      />,
    );
  }

  function sideButtresses(kind: string) {
    for (const w of b.walls ?? []) {
      if (w.type !== 'wall') continue;
      const xEnd = w.x === b.x + b.width - 1,
        yEnd = w.y === b.y + b.height - 1;
      if ((!xEnd && !yEnd) || w.x === b.x || w.y === b.y) continue;
      const along = xEnd ? w.y - b.y : w.x - b.x;
      if (along % 3 !== 2) continue;
      const u = (w.x - f.origin.x) * f.u.x + (w.y - f.origin.y) * f.u.y;
      const v = (w.x - f.origin.x) * f.v.x + (w.y - f.origin.y) * f.v.y;
      if (v < 1 || v > f.depth - 1) continue;
      const dx = xEnd ? 0.39 : 0.19,
        dy = xEnd ? 0.19 : 0.39;
      const points = [
        { x: w.x - dx, y: w.y - dy },
        { x: w.x + dx, y: w.y - dy },
        { x: w.x + dx, y: w.y + dy },
        { x: w.x - dx, y: w.y + dy },
      ];
      const top = xEnd
        ? [h - 12, h * 0.59, h * 0.59, h - 12]
        : [h - 12, h - 12, h * 0.59, h * 0.59];
      nodes.push(
        <g
          key={`buttress-${u}-${v}`}
          data-architectural-volume={`${kind}-buttress`}
        >
          <ArchitectureVolume
            points={points}
            top={top}
            palette={palette}
            project={project}
            texture={
              buildingAppearance(b).wallFinish === 'stone' ? 'stone' : 'plaster'
            }
          />
          <ArchitectureVolume
            points={points}
            top={profile.plinthHeight + 2}
            cap={false}
            palette={stone}
            project={project}
            texture="stone"
          />
        </g>,
      );
    }
  }

  function porch(label: string, u0: number, u1: number, masonry = false) {
    if (!frontVisible) return;
    const roofLow = h * 0.72,
      roofHigh = h * 0.89;
    const v0 = -0.42,
      v1 = 0.43;
    const canopy = (
      <ProjectedRoofSurface
        id={`${b.id}-${label}`}
        points={[
          point(u0, v0, roofLow),
          point(u1, v0, roofLow),
          point(u1, v1, roofHigh),
          point(u0, v1, roofHigh),
        ]}
        project={project}
        finish={
          buildingAppearance(b).roofFinish === 'thatch'
            ? 'clay'
            : buildingAppearance(b).roofFinish
        }
      />
    );
    for (const u of Array.from(
      { length: Math.max(1, Math.ceil(u1 - u0)) },
      (_, i) => Math.round(u0) + i,
    )) {
      if (
        u > u1 ||
        wallAt(u, 0)?.type !== 'wall' ||
        (u > u0 + 0.7 && u < u1 - 0.7 && u % 2)
      )
        continue;
      nodes.push(
        solid(
          `${label}-post-${u}`,
          u - 0.07,
          -0.39,
          u + 0.07,
          -0.25,
          0,
          roofLow,
          masonry ? palette : timber,
          masonry ? 'plaster' : 'wood',
        ),
      );
      if (!masonry)
        nodes.push(
          <path
            key={`bracket-${u}`}
            d={`${line(point(u, -0.31, roofLow - 10), point(Math.min(u1, u + 0.33), -0.31, roofLow - 1))}${line(point(u, -0.31, roofLow - 10), point(Math.max(u0, u - 0.33), -0.31, roofLow - 1))}`}
            stroke={timber.base}
            strokeWidth="2"
            fill="none"
          />,
        );
    }
    nodes.push(
      solid(
        `${label}-beam`,
        u0,
        -0.43,
        u1,
        -0.23,
        roofLow - 3,
        roofLow,
        masonry ? palette : timber,
        masonry ? 'plaster' : 'wood',
      ),
    );
    nodes.push(
      <g key={`${label}-roof`} data-architectural-volume={`${label}-canopy`}>
        {canopy}
      </g>,
    );
  }

  function chimney(industrial: boolean) {
    const chimneyNodes = f.u.x + f.u.y > 0 ? nodes : backNodes;
    const u = f.width;
    const v = Array.from(
      { length: Math.max(0, Math.floor(f.depth) - 1) },
      (_, i) => i + 1,
    )
      .filter((candidate) => wallAt(u, candidate)?.type === 'wall')
      .sort(
        (a, c) => Math.abs(a - f.depth * 0.66) - Math.abs(c - f.depth * 0.66),
      )[0];
    if (v === undefined) return;
    const half = industrial ? 0.29 : 0.19,
      bottom = h - 1,
      top = h + profile.roofRise + (industrial ? 38 : 16);
    chimneyNodes.push(
      solid(
        industrial ? 'forge-chimney' : 'domestic-chimney',
        u - half,
        v - half,
        u + half,
        v + half,
        bottom,
        top,
        industrial ? brick : palette,
        industrial ? 'brick' : 'plaster',
      ),
    );
    chimneyNodes.push(
      solid(
        'chimney-cap',
        u - half - 0.06,
        v - half - 0.06,
        u + half + 0.06,
        v + half + 0.06,
        top - 2,
        top + 2,
        industrial ? brick : stone,
        industrial ? 'brick' : 'stone',
      ),
    );
    chimneyNodes.push(
      <polygon
        key="chimney-flue"
        points={polygon(
          quad(
            u - half + 0.06,
            v - half + 0.06,
            u + half - 0.06,
            v + half - 0.06,
          ).map((p) => ({ ...p, z: top + 2.3 })),
        )}
        fill="#40382b"
      />,
    );
  }

  if (b.kind === 'church') {
    sideButtresses('nave');
    if (frontVisible) {
      pier(0, 0, 0.37, h + 7, 'church-facade');
      pier(f.width, 0, 0.37, h + 7, 'church-facade');
    }
    const span = Math.min(f.width - 1.8, 5.2),
      centre = Math.max(
        span / 2 + 0.15,
        Math.min(f.width - span / 2 - 0.15, f.doorU),
      );
    pediment(centre - span / 2, centre + span / 2, profile.roofRise + 12);
    tower();
  } else if (b.kind === 'chapel') {
    if (frontVisible) {
      pier(0, 0, 0.28, h + 1, 'chapel-corner');
      pier(f.width, 0, 0.28, h + 1, 'chapel-corner');
    }
    const z = h + profile.roofRise * 0.82,
      u = f.doorU,
      w = Math.min(0.62, f.width / 6);
    const bellNodes: ReactNode[] = [];
    bellNodes.push(
      solid(
        'chapel-bellgable-body',
        u - w,
        -0.25,
        u + w,
        0.15,
        h + profile.roofRise * 0.55,
        z + 16,
        palette,
        'plaster',
        false,
      ),
    );
    bellNodes.push(
      <g
        key="chapel-bellgable-curve"
        transform={faceMatrix(
          at(u - w, frontVisible ? -0.26 : 0.16),
          at(u + w, frontVisible ? -0.26 : 0.16),
          project,
          z,
        )}
      >
        <path
          d="M0,-15Q20,-37 40,-15V-12H0Z"
          fill={palette.base}
          stroke={palette.trim}
          strokeWidth="2.3"
        />
        {frontVisible && (
          <>
            <path
              d="M12,-1V-10a8,8 0 0 1 16,0V-1Z"
              fill="#403a2b"
              stroke={palette.trim}
              strokeWidth="1.8"
            />
            <path
              d="M15,-4Q18,-6 18,-12H22Q22,-6 25,-4Z"
              fill="#9e8249"
              stroke="#594c2e"
              strokeWidth=".7"
            />
          </>
        )}
        <path d="M20,-26V-40M15,-35H25" stroke="#6a5031" strokeWidth="1.5" />
      </g>,
    );
    (frontVisible ? nodes : backNodes).push(...bellNodes);
  } else if (b.kind === 'cabildo') {
    if (frontVisible) {
      const columns = [
        0,
        ...Array.from(
          { length: Math.max(0, Math.floor(f.width / 2) - 1) },
          (_, i) => (i + 1) * 2,
        ),
        f.width,
      ];
      columns.forEach((u) => pier(u, 0, 0.26, h - 7, 'arcade-pier'));
      for (let i = 1; i < columns.length; i++) {
        const a = columns[i - 1] + 0.14,
          c = columns[i] - 0.14;
        nodes.push(
          <g
            key={`arcade-${i}`}
            transform={faceMatrix(at(a, -0.35), at(c, -0.35), project)}
          >
            <path
              d={`M0,-3V-${h - 24}a20,17 0 0 1 40,0V-3`}
              fill="none"
              stroke={palette.shadow}
              strokeWidth="6"
            />
            <path
              d={`M0,-3V-${h - 24}a20,17 0 0 1 40,0V-3`}
              fill="none"
              stroke={palette.trim}
              strokeWidth="4.5"
            />
          </g>,
        );
      }
      nodes.push(
        solid(
          'cabildo-arcade-entablature',
          -0.12,
          -0.4,
          f.width + 0.12,
          0.21,
          h - 9,
          h - 3,
        ),
      );
    }
    // A compact civic cupola starts on the facade bearing wall. It is an
    // upper-storey roof feature; it places no new obstacle at street level.
    const cupolaStart = nodes.length;
    const u = f.width / 2,
      bottom = h - 3,
      top = h + 55;
    nodes.push(
      solid('cabildo-clock-tower', u - 0.7, -0.27, u + 0.7, 0.4, bottom, top),
    );
    nodes.push(
      solid(
        'cabildo-tower-cornice',
        u - 0.78,
        -0.35,
        u + 0.78,
        0.47,
        top - 2,
        top + 3,
      ),
    );
    if (frontVisible)
      nodes.push(
        <g
          key="cabildo-clock"
          transform={faceMatrix(
            at(u - 0.7, -0.28),
            at(u + 0.7, -0.28),
            project,
            bottom,
          )}
        >
          <circle
            cx="20"
            cy="-23"
            r="10"
            fill="#ddd0aa"
            stroke="#9b8964"
            strokeWidth="1.3"
          />
          <path
            d="M20,-30V-23L26,-21"
            stroke="#554931"
            strokeWidth="1.1"
            fill="none"
          />
          {Array.from({ length: 12 }, (_, i) => (
            <path
              key={i}
              d="M20,-31v1.5"
              transform={`rotate(${i * 30} 20 -23)`}
              stroke="#665439"
              strokeWidth=".65"
            />
          ))}
        </g>,
      );
    pyramid('civic-cupola', u - 0.81, -0.4, u + 0.81, 0.51, top + 3, 17);
    if (!frontVisible) backNodes.push(...nodes.splice(cupolaStart));
  } else if (b.kind === 'posta') {
    porch('posta-veranda', 0.15, f.width - 0.15, true);
    if (frontVisible) {
      pier(0, 0, 0.3, h - 3, 'posta-pier');
      pier(f.width, 0, 0.3, h - 3, 'posta-pier');
    }
  } else if (b.kind === 'barracks') {
    if (frontVisible) {
      for (const u of [Math.round(f.doorU - 1), Math.round(f.doorU + 1)])
        pier(u, 0, 0.35, h + 3, 'gate-pilaster');
      nodes.push(
        solid(
          'barracks-gate-entablature',
          Math.max(0, f.doorU - 1.2),
          -0.31,
          Math.min(f.width, f.doorU + 1.2),
          0.19,
          h - 4,
          h + 3,
        ),
      );
      nodes.push(
        <g
          key="barracks-masonry-plaque"
          transform={faceMatrix(
            at(f.doorU - 0.5, -0.32),
            at(f.doorU + 0.5, -0.32),
            project,
            h - 8,
          )}
        >
          <path
            d="M12,0V-13H28V0L20,5Z"
            fill="#c9bc93"
            stroke="#998660"
            strokeWidth=".8"
          />
          <path d="M16,-8L24,0M24,-8L16,0" stroke="#7b6945" strokeWidth="1.2" />
        </g>,
      );
    }
  } else if (b.kind === 'pulperia') {
    porch(
      'shop-porch',
      Math.max(0.15, f.doorU - 2),
      Math.min(f.width - 0.15, f.doorU + 2),
    );
    if (frontVisible) {
      const u = Math.max(0.4, f.doorU - 1.35),
        p = screenPoint(point(u, -0.42, h - 5), project);
      nodes.push(
        <g key="shop-sign" transform={`translate(${p.x} ${p.y})`}>
          <path d="M0,0v10m0,-6h-14v4" stroke="#5f472e" strokeWidth="1.5" />
          <rect
            x="-21"
            y="8"
            width="14"
            height="10"
            rx=".7"
            fill="#645039"
            stroke="#c1a676"
            strokeWidth=".7"
          />
          <path
            d="M-17,14h6m-5,-3v6m4,-6v6"
            stroke="#d5c096"
            strokeWidth=".9"
          />
        </g>,
      );
    }
  } else if (b.kind === 'warehouse') {
    sideButtresses('storehouse');
    porch(
      'loading',
      Math.max(0.15, f.doorU - 1.35),
      Math.min(f.width - 0.15, f.doorU + 1.35),
    );
  } else if (b.kind === 'smithy') {
    chimney(true);
    porch(
      'forge',
      Math.max(0.15, f.doorU - 1.25),
      Math.min(f.width - 0.15, f.doorU + 1.25),
    );
  } else if (b.kind === 'stable') {
    if (frontVisible) {
      const z = h * 0.89;
      nodes.push(
        solid(
          'stable-timber-header',
          0.02,
          -0.28,
          f.width - 0.02,
          0.1,
          z - 4,
          z,
          timber,
          'wood',
        ),
      );
      for (let u = 0; u <= f.width; u += 2)
        if (wallAt(u, 0)?.type === 'wall') {
          nodes.push(
            solid(
              `stable-post-${u}`,
              u - 0.095,
              -0.3,
              u + 0.095,
              0.12,
              0,
              z,
              timber,
              'wood',
            ),
          );
          nodes.push(
            <path
              key={`stable-tie-${u}`}
              d={line(
                point(u, -0.31, z - 13),
                point(Math.min(f.width, u + 0.6), -0.31, z - 2),
              )}
              stroke={timber.base}
              strokeWidth="3"
            />,
          );
        }
      nodes.push(
        <g
          key="stable-ventilation"
          transform={faceMatrix(
            at(0.4, -0.03),
            at(f.width - 0.4, -0.03),
            project,
            h + 2,
          )}
        >
          <path
            d={`M2,0L20,-${profile.roofRise - 5}L38,0Z`}
            fill="#594c35"
            stroke={timber.base}
            strokeWidth="2"
          />
          {[8, 13, 18, 23, 28, 33].map((u) => (
            <path
              key={u}
              d={`M${u},-1V-${Math.max(1, (profile.roofRise - 7) * (1 - Math.abs(u - 20) / 18))}`}
              stroke="#ac9467"
              strokeWidth="1.2"
            />
          ))}
        </g>,
      );
    }
  } else if (b.kind === 'house') {
    chimney(false);
    if (frontVisible) {
      const u0 = Math.max(0.1, f.doorU - 0.72),
        u1 = Math.min(f.width - 0.1, f.doorU + 0.72);
      nodes.push(
        solid(
          'domestic-door-lintel',
          u0,
          -0.22,
          u1,
          0.13,
          h * 0.87,
          h * 0.87 + 3,
          timber,
          'wood',
        ),
      );
      for (const u of [0, f.width])
        pier(u, 0, 0.19, h - 2, 'house-corner', 0.22);
    }
  }

  return [
    ...(backNodes.length
      ? [
          {
            key: `architecture-detail-back-${b.id}`,
            depth: b.x + b.y + b.width + b.height + 0.08,
            node: (
              <g data-architecture-rear={b.kind} pointerEvents="none">
                {backNodes}
              </g>
            ),
          },
        ]
      : []),
    {
      key: `architecture-detail-${b.id}`,
      depth: b.x + b.y + b.width + b.height + 0.3,
      node: (
        <g
          data-building-kind={b.kind}
          data-architecture-front={f.side}
          pointerEvents="none"
        >
          {nodes}
        </g>
      ),
    },
  ];
}
