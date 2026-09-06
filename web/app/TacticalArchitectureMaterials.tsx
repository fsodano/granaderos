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
export const ARCHITECTURE_TEXTURE_SIZE: Record<string, [number, number]> = {
 plaster: [240, 160], stone: [120, 50], brick: [120, 60], wood: [80, 100],
};
export function ArchitectureDefs(){return <defs>
 {Object.entries(ARCHITECTURE_TEXTURE_SIZE).map(([name,[width,height]])=><pattern key={name} id={`architecture-${name}`} patternUnits="userSpaceOnUse" width={width} height={height}><image href={`/art/architecture-${name}-v2.png`} width={width} height={height} preserveAspectRatio="none"/></pattern>)}
 <linearGradient id="architecture-reveal" x1="0" y1="0" x2="1" y2=".6"><stop stopColor="#17170f"/><stop offset="1" stopColor="#4b4a36"/></linearGradient>
 <linearGradient id="architecture-edge-shadow" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#211c11" stopOpacity=".6"/><stop offset="1" stopColor="#211c11" stopOpacity="0"/></linearGradient>
 </defs>;}
export function WallSurface({finish,height,x,y,offset=0}:{finish:string;height:number;x:number;y:number;offset?:number}){
 const c=WALL_COLOURS[finish]??WALL_COLOURS.limewash;
 const material=finish==='stone'?'stone':finish==='brick'?'brick':'plaster';
 // Sample a continuous facade run instead of restarting the image at every tile.
 const sample=((x+y)*40+offset)%240;
 return <g data-wall-finish={finish}>
  <rect y={-height} width="40" height={height} fill={c.base}/>
  <g transform={`translate(${-sample} 0)`}><rect x={sample} y={-height} width="40" height={height} fill={`url(#architecture-${material})`} opacity={material==='plaster'?.85:.92}/></g>
  {['adobe','ochre'].includes(finish)&&<rect y={-height} width="40" height={height} fill={c.base} opacity={finish==='adobe'?.48:.34} style={{mixBlendMode:'multiply'}}/>}
  <rect y={-height} width="40" height="7" fill="url(#architecture-edge-shadow)" opacity=".26"/>
 </g>;
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
  const l = door && ['double', 'barn', 'arched'].includes(style) ? 6 : small ? 15 : 11,
    r = 40 - l,
    bottom = door ? 0 : small ? -20 : -13,
    top = door ? -33 : small ? -30 : arched ? -38 : -32;
  const shape = arched
    ? `M${l},${bottom}V${top+(r-l)/2}A${(r-l)/2},${(r-l)/2} 0 0 1 ${r},${top+(r-l)/2}V${bottom}Z`
    : `M${l},${bottom}V${top}H${r}V${bottom}Z`;
  return (
    <g data-opening-style={style}>
      <path d={shape} fill="none" stroke="#675942" strokeWidth={arched?7:5}/>
      <path
        d={shape}
        fill="url(#architecture-reveal)"
        stroke={trim}
        strokeWidth={arched ? 3.5 : 2.5}
      />
      <path d={`M${l+1},${bottom-1}V${arched?top+(r-l)/2:top+1}`} stroke="#171a13" strokeWidth="2" opacity=".8"/>
      {arched&&Array.from({length:9},(_,i)=>{const a=Math.PI+i*Math.PI/8,cx=20,cy=top+(r-l)/2,ra=(r-l)/2;return <path key={i} d={`M${cx+Math.cos(a)*(ra+1.5)},${cy+Math.sin(a)*(ra+1.5)}L${cx+Math.cos(a)*(ra+3)},${cy+Math.sin(a)*(ra+3)}`} stroke="#7c6b4f" strokeWidth=".5" opacity=".65"/>;})}
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
              'url(#architecture-wood)'
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
                      fill="#443927"
                      stroke="#9c8058"
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
