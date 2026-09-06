import type { ReactNode } from 'react';
type Point = { x: number; y: number };
/** Details are anchored to the actual entrance, so rotations preserve the facade. */
export function buildingDetails(
  b: any,
  revealed: Set<string>,
  project: (x: number, y: number) => Point,
): { key: string; depth: number; node: ReactNode }[] {
  const kind = b.kind;
  if (!kind || kind === 'house') return [];
  const door = b.walls?.find(
    (w: any) =>
      w.type === 'door' &&
      (w.x === b.x ||
        w.x === b.x + b.width - 1 ||
        w.y === b.y ||
        w.y === b.y + b.height - 1),
  );
  if (!door) return [];
  const onY = door.y === b.y || door.y === b.y + b.height - 1;
  const p = project(door.x, door.y),
    q = project(door.x + (onY ? 1 : 0), door.y + (onY ? 0 : 1));
  const open = b.rooms.some((r: any) => revealed.has(r.id));
  // Match front-wall cutaways. Roof ornaments disappear with the roof.
  if (open) return [];
  const transform = `matrix(${(q.x - p.x) / 40} ${(q.y - p.y) / 40} 0 1 ${p.x} ${p.y})`;
  const religious = kind === 'church' || kind === 'chapel';
  let detail: ReactNode;
  if (religious || kind === 'cabildo') {
    const top = kind === 'church' ? -185 : kind === 'cabildo' ? -137 : -112;
    detail = (
      <>
        <path
          d={`M-25,-38V${top + 16}L0,${top}L25,${top + 16}V-38Z`}
          fill="#d9ccb0"
          stroke="#8e8064"
          strokeWidth="1.5"
        />
        <path d={`M25,-38V${top + 16}l7,4V-35Z`} fill="#998b70" />
        <path
          d={`M-29,${top + 17}L0,${top - 3}L29,${top + 17}`}
          fill="none"
          stroke="#aa6747"
          strokeWidth="5"
        />
        <path
          d={`M-11,${top + 48}V${top + 31}a11,11 0 0 1 22,0V${top + 48}Z`}
          fill="#302d25"
          stroke="#a39476"
          strokeWidth="3"
        />
        <path d={`M-7,${top + 44}q3,-6 3,-12h8q0,6 3,12Z`} fill="#a88a48" />
        <path d={`M-9,${top + 45}h18`} stroke="#d4b56c" strokeWidth="2" />
        <path
          d={`M-26,${top + 54}h52M-25,-43h50`}
          stroke="#f0e2c5"
          strokeWidth="4"
        />
        {religious ? (
          <path
            d={`M0,${top - 2}v-21m-8,8h16`}
            stroke="#59442c"
            strokeWidth="4"
          />
        ) : (
          <>
            <circle
              cx="0"
              cy={top + 73}
              r="10"
              fill="#ded4b9"
              stroke="#6c634d"
            />
            <path d={`M0,${top + 66}v7l5,3`} stroke="#403b2e" fill="none" />
          </>
        )}
        {kind === 'cabildo' && (
          <>
            {[-2, -1, 1, 2].map((i) => (
              <g key={i} transform={`translate(${i * 40} 0)`}>
                <path
                  d="M-18,-3V-29Q0,-53 18,-29V-3"
                  fill="none"
                  stroke="#eee0c1"
                  strokeWidth="5"
                />
                <path d="M-21,-44h42" stroke="#dfceb0" strokeWidth="5" />
              </g>
            ))}
          </>
        )}
        {kind === 'church' && (
          <>
            <path
              d="M-44,-4V-68h10v64M34,-4V-68h10v64"
              fill="#dfd0ac"
              stroke="#9b8b6b"
            />
            <path d="M-48,-68H48" stroke="#eee0bd" strokeWidth="5" />
          </>
        )}
      </>
    );
  } else if (kind === 'smithy') {
    detail = (
      <>
        <path d="M26,-44v-46h16v51Z" fill="#946448" stroke="#594735" />
        <path d="M23,-89h22v-5H23Z" fill="#b18860" />
        <path d="M28,-77h11m-11,12h11m-11,12h11" stroke="#c2966c" />
        <path d="M-30,-31h23v-8" stroke="#59432b" fill="none" strokeWidth="3" />
        <rect
          x="-42"
          y="-32"
          width="22"
          height="17"
          fill="#3b3832"
          stroke="#98784c"
        />
        <path d="M-39,-27h16l-5,4v5h-9v-5Z" fill="#ad9d7b" />
      </>
    );
  } else {
    const text =
      (
        {
          posta: 'POSTA',
          barracks: 'CUARTEL',
          pulperia: 'PULPERÍA',
          warehouse: 'ABASTOS',
          stable: 'CABALLERIZA',
        } as Record<string, string>
      )[kind] ?? '';
    detail = (
      <>
        <path
          d="M-34,-35H34L43,-29H-43Z"
          fill={kind === 'stable' ? '#a28a54' : '#a66543'}
          stroke="#644b31"
        />
        <path d="M-38,-29V-3M38,-29V-3" stroke="#745635" strokeWidth="3" />
        <rect
          x="-29"
          y="-45"
          width="58"
          height="10"
          fill="#624933"
          stroke="#b19361"
        />
        <text
          x="0"
          y="-38"
          fontSize="6"
          letterSpacing=".6"
          textAnchor="middle"
          fill="#e7d6ac"
        >
          {text}
        </text>
        {kind === 'warehouse' && (
          <path
            d="M-14,-4V-29h28V-4M-14,-29L14,-4M14,-29L-14,-4"
            fill="none"
            stroke="#644a30"
            strokeWidth="2"
          />
        )}
      </>
    );
  }
  return [
    {
      key: `architecture-detail-${b.id}`,
      depth:
        Math.max(
          ...b.rooms.flatMap((r: any) => r.cells.map((c: any) => c.x + c.y)),
          b.x + b.y + b.width + b.height,
        ) + 0.3,
      node: (
        <g data-building-kind={kind} pointerEvents="none" transform={transform}>
          {detail}
        </g>
      ),
    },
  ];
}
