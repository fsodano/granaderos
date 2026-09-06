export const WALL_COLOURS: Record<
  string,
  { base: string; trim: string; shadow: string }
> = {
  adobe: { base: '#b49a71', trim: '#cab48e', shadow: '#776448' },
  limewash: { base: '#ded8c5', trim: '#eee6d1', shadow: '#aaa18a' },
  ochre: { base: '#c5a36e', trim: '#e4d3ab', shadow: '#8f754f' },
  stone: { base: '#928f80', trim: '#c5bd9f', shadow: '#5e635c' },
  brick: { base: '#a17258', trim: '#cfb490', shadow: '#6f5140' },
};
const hash = (x: number, y: number) =>
  (Math.imul(x + 91, 374761393) ^ Math.imul(y + 31, 668265263)) >>> 0;
export function WallSurface({
  finish,
  height,
  x,
  y,
}: {
  finish: string;
  height: number;
  x: number;
  y: number;
}) {
  const c = WALL_COLOURS[finish] ?? WALL_COLOURS.limewash;
  const masonry = finish === 'stone' || finish === 'brick',
    rows = Math.ceil(height / (finish === 'brick' ? 5 : 10));
  return (
    <g data-wall-finish={finish}>
      <rect y={-height} width="40" height={height} fill={c.base} />
      {masonry ? (
        Array.from({ length: rows }, (_, row) => {
          const h = height / rows,
            cols = finish === 'brick' ? 4 : 3,
            w = 40 / cols,
            offset = row % 2 ? w / 2 : 0;
          return (
            <g key={row}>
              {Array.from({ length: cols + 1 }, (_, col) => {
                const a = Math.max(0, col * w - offset),
                  b = Math.min(40, (col + 1) * w - offset),
                  n = hash(x * 41 + col, y * 31 + row);
                return b > a ? (
                  <rect
                    key={col}
                    x={a + 0.3}
                    y={-height + row * h + 0.35}
                    width={Math.max(0.1, b - a - 0.6)}
                    height={h - 0.7}
                    rx={finish === 'stone' ? 1 : 0.25}
                    fill={n % 3 ? c.base : c.trim}
                    stroke={c.shadow}
                    strokeWidth=".45"
                    opacity={0.6 + (n % 4) * 0.08}
                  />
                ) : null;
              })}
            </g>
          );
        })
      ) : (
        <>
          {Array.from({ length: 7 }, (_, i) => {
            const n = hash(x * 37 + i, y * 53),
              a = n % 37,
              z = -2 - (n % Math.max(1, height - 4));
            return (
              <path
                key={i}
                d={`M${a},${z}h${2 + (n % 5)}`}
                stroke={i % 2 ? c.shadow : c.trim}
                strokeWidth=".65"
                opacity=".14"
              />
            );
          })}
          {height > 15 && finish === 'adobe' && (
            <path
              d={`M${7 + (hash(x, y) % 20)},-31l-2,6 3,4 -1,5`}
              stroke={c.shadow}
              opacity=".4"
              strokeWidth=".5"
              fill="none"
            />
          )}
        </>
      )}
    </g>
  );
}
export function Opening({
  type,
  style,
  open,
  trim,
}: {
  type: string;
  style: string;
  open?: boolean;
  trim: string;
}) {
  const door = type === 'door',
    arched = style === 'arched',
    small = style === 'small';
  const l = door && ['double', 'barn'].includes(style) ? 6 : small ? 15 : 11,
    r = 40 - l,
    bottom = door ? 0 : small ? -20 : -13,
    top = door ? -33 : small ? -30 : -32;
  const shape = arched
    ? `M${l},${bottom}V${top + 9}Q20,${top - 9} ${r},${top + 9}V${bottom}Z`
    : `M${l},${bottom}V${top}H${r}V${bottom}Z`;
  return (
    <g data-opening-style={style}>
      <path
        d={shape}
        fill="#292d25"
        stroke={trim}
        strokeWidth={arched ? 3.5 : 2.5}
      />
      {door ? (
        <g
          transform={
            open
              ? `translate(${l} 0) skewY(-25) scale(.18 1) translate(${-l} 0)`
              : undefined
          }
        >
          <path
            d={shape}
            fill={
              style === 'panelled'
                ? '#66533d'
                : style === 'barn'
                  ? '#80654a'
                  : '#75604a'
            }
            stroke="#4f4130"
            strokeWidth=".7"
          />
          {style === 'panelled' ? (
            <>
              {[l + 2, 21].map((a) => (
                <g key={a}>
                  {[-28, -15].map((z) => (
                    <rect
                      key={z}
                      x={a}
                      y={z}
                      width="6"
                      height="10"
                      fill="#534533"
                      stroke="#a18b62"
                      strokeWidth=".6"
                    />
                  ))}
                </g>
              ))}
            </>
          ) : (
            <>
              {Array.from({ length: 5 }, (_, i) => {
                const a = l + ((r - l) * (i + 1)) / 6;
                return (
                  <path
                    key={i}
                    d={`M${a},${arched ? -23 : top + 1}V-1`}
                    stroke="#443a2b"
                    strokeWidth=".6"
                  />
                );
              })}
              <path
                d={`M${l + 1},-24H${r - 1}M${l + 1},-7H${r - 1}`}
                stroke="#4b4435"
                strokeWidth="1.3"
              />
            </>
          )}
          {['double', 'barn', 'arched'].includes(style) && (
            <path d="M20,-25V0" stroke="#382f25" strokeWidth="1" />
          )}
          {style === 'barn' && (
            <path
              d={`M${l + 1},-29L19,-2M21,-2L${r - 1},-29`}
              stroke="#baa077"
              strokeWidth="1.5"
            />
          )}
          <circle
            cx={['double', 'arched', 'barn'].includes(style) ? 18 : r - 3}
            cy="-13"
            r=".8"
            fill="#b2a173"
          />
        </g>
      ) : (
        <>
          {style === 'shutters' ? (
            <>
              {[l, r - 6].map((a) => (
                <g key={a}>
                  <rect
                    x={a}
                    y={top + 1}
                    width="6"
                    height={bottom - top - 2}
                    fill="#65705a"
                    stroke="#434a3b"
                    strokeWidth=".8"
                  />
                  <path
                    d={`M${a + 1},${top + 5}h4m-4,5h4m-4,5h4`}
                    stroke="#a8ac84"
                    strokeWidth=".8"
                  />
                </g>
              ))}
            </>
          ) : style === 'lattice' ? (
            <>
              {Array.from({ length: 4 }, (_, i) => (
                <g key={i}>
                  <path
                    d={`M${l + 1 + i * 4},${top + 1}l${Math.min(8, r - l - i * 4 - 1)},${Math.min(12, (r - l - i * 4 - 1) * 1.5)}`}
                    stroke="#b29970"
                    strokeWidth="1"
                  />
                  <path
                    d={`M${r - 1 - i * 4},${top + 1}l-${Math.min(8, r - l - i * 4 - 1)},${Math.min(12, (r - l - i * 4 - 1) * 1.5)}`}
                    stroke="#b29970"
                    strokeWidth="1"
                  />
                </g>
              ))}
            </>
          ) : (
            <>
              {[16, 20, 24]
                .filter((a) => a > l && a < r)
                .map((a) => (
                  <path
                    key={a}
                    d={`M${a},${arched ? top + 6 : top + 1}V${bottom - 1}`}
                    stroke="#767c68"
                    strokeWidth=".8"
                  />
                ))}
              {!small && (
                <path
                  d={`M${l + 1},-22H${r - 1}`}
                  stroke="#767c68"
                  strokeWidth=".8"
                />
              )}
            </>
          )}
          <path
            d={`M${l - 2},${bottom}H${r + 2}`}
            stroke={trim}
            strokeWidth="2.5"
          />
        </>
      )}
    </g>
  );
}
