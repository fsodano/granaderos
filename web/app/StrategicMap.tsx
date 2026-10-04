'use client';
import SectorInventory from './SectorInventory';
import StrategicPanel from './StrategicPanel';
import {knownCampaignSectorEquipment} from '../../game/sector-inventory.js';
import {SectorIncomeTable} from './SectorIncome';
import {operativeInTransit} from '../../game/squads.js';
import {squadTravelStatus} from '../../game/squad-travel.js';
import {strategicSectorPresence,strategicPresenceLabel,strategicTravelPresence} from '../../game/strategic-presence.js';
import {useState} from 'react';
import {Landmark,Pickaxe,Users,Shield,Package} from 'lucide-react';
import geography from '../../game/strategic-geography.json';
import {MAP_PLACES,MAP_MODES,project,sectorPosition,sectorIncome,MAP_TILE_SIZE,mapTilesForSector,mapTileBounds,mapTileOutline} from '../../game/strategic-map.js';
import {CAMPAIGN_SECTORS} from '../../game/campaign.js';
import {WORLD_CELLS,worldCell,campaignPlace,worldOwner} from '../../game/world-cells.js';
import {CITIES} from '../../game/cities.js';
import Horses from './Horses';
import './strategic-map.css';
import './strategic-presence.css';
const icons=[Landmark,Pickaxe,Users,Shield,null,Package];
function geometryPath(geometry:any,projection=project):string{
 const lines=geometry.type==='MultiPolygon'?geometry.coordinates.flat():geometry.type==='Polygon'||geometry.type==='MultiLineString'?geometry.coordinates:[geometry.coordinates];
 return lines.map((ring:number[][])=>ring.map(([lon,lat],i)=>{const p=projection(lon,lat);return `${i?'L':'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`;}).join('')+(geometry.type.includes('Polygon')?'Z':'')).join('');
}
const stockCount=(s:any,id:string)=>knownCampaignSectorEquipment(s,id).reduce((n:number,row:any)=>n+row.count,0);
const position=(id:string)=>{const cell=worldCell(id);return cell?{x:cell.x+MAP_TILE_SIZE/2,y:cell.y+MAP_TILE_SIZE/2}:sectorPosition(id)!;};
function PresenceDots({players=0,militia=0,enemies=0,unknown=false,x,y}:{players?:number;militia?:number;enemies?:number;unknown?:boolean;x:number;y:number}){
 const dots=[...Array(players).fill('player'),...Array(militia).fill('militia'),...Array(enemies).fill('enemy')],total=dots.length+Number(unknown);
 const columns=Math.max(1,Math.ceil(Math.sqrt(total))),rows=Math.ceil(total/columns),step=Math.min(4,14/Math.max(columns,rows)),radius=step*.34;
 const point=(index:number)=>({x:x+(index%columns-(columns-1)/2)*step,y:y+(Math.floor(index/columns)-(rows-1)/2)*step});
 return <g aria-hidden="true" pointerEvents="none">{dots.map((side,index)=>{const p=point(index);return <circle key={index} data-presence-dot={side} cx={p.x} cy={p.y} r={radius} fill={side==='player'?'#f4d969':side==='militia'?'#80dba1':'#ef8d86'} stroke="#142018" strokeWidth={radius*.25}/>;})}{unknown&&<text data-enemy-unknown="true" x={point(dots.length).x} y={point(dots.length).y} textAnchor="middle" dominantBaseline="central" fill="#ffaaa3" fontSize={Math.min(12,step*2.2)} fontWeight="bold" stroke="#17221b" strokeWidth="1" paintOrder="stroke">?</text>}</g>;
}
export default function StrategicMap({state:s,battle,selected,onSelect,dispatch,onInspect,onOpenPanel,plotting=false,onHover,previewPath=[],onSquad}:{state:any;battle?:any;selected:string;onSelect:(id:string)=>void;dispatch:(action:any)=>void;onInspect?:(id:string)=>void;onOpenPanel?:()=>void;plotting?:boolean;onHover?:(id:string)=>void;previewPath?:string[];onSquad?:(id:string)=>void}){
 const [mode,setMode]=useState('cities');
 const [management,setManagement]=useState(false);
 const selectedCell=worldCell(selected)!;
 const presence=new Map(strategicSectorPresence(s,battle).map(row=>[row.sector,row]));
 const marks=(id:string)=>mode==='resources'?`${s.sectors[id]?sectorIncome(s,campaignPlace(id)):0} $/día`:mode==='squads'?`${presence.get(id)?.players.length??0} soldados`:mode==='militia'?`${presence.get(id)?.militia??0} milicianos`:mode==='horses'?`${(s.horseState?.horses??[]).filter((h:any)=>!h.returned&&!h.custody&&!operativeInTransit(s,h.assignedTo)&&h.location===id).length} monturas`:mode==='items'?`${stockCount(s,id)} en la celda`:null;
 return <div className="strategy-chart argentina-chart">
 <div className="atlas-heading"><span>PROVINCIAS UNIDAS · 1812–1817</span><span>TEATRO DE OPERACIONES</span></div>
 <svg data-plotting={plotting} onMouseLeave={()=>onHover?.('')} className="argentina-atlas" viewBox="0 0 720 690" role="group" aria-label="Mapa geográfico de la campaña en las Provincias Unidas">
 <defs><clipPath id="atlas-clip"><rect x="36" y="36" width="648" height="588"/></clipPath><pattern id="atlas-grid" width={MAP_TILE_SIZE} height={MAP_TILE_SIZE} x="36" y="36" patternUnits="userSpaceOnUse"><rect width={MAP_TILE_SIZE} height={MAP_TILE_SIZE} fill="none" stroke="#141e16" strokeOpacity=".35" strokeWidth=".8"/></pattern><linearGradient id="atlas-land" x2="1" y2="1"><stop stopColor="#7f7952"/><stop offset=".5" stopColor="#535c3c"/><stop offset="1" stopColor="#9b8d5a"/></linearGradient></defs>
 <rect width="720" height="690" fill="#18211e"/><rect x="36" y="36" width="648" height="588" fill="#25454d"/>
 <g clipPath="url(#atlas-clip)">
 {geography.land.map((g,i)=><path key={i} d={geometryPath(g)} fill="url(#atlas-land)" stroke="none"/>)}
 <path d={[-22,-23,-24,-25,-26,-27,-28,-29,-30,-31,-32,-33,-34,-35,-36].map((lat,i)=>{const p=project(-67.4-(i*.24),lat);return `${i?'L':'M'}${p.x},${p.y}`;}).join(' ')} fill="none" stroke="#c2b59b" strokeOpacity=".25" strokeWidth="34"/>
 {geography.rivers.map((g,i)=><path key={i} d={geometryPath(g)} stroke="#80b1b6" strokeWidth="2.7" fill="none"/>)}
 <rect x="36" y="36" width="648" height="588" fill="url(#atlas-grid)"/>
 <g className="atlas-region-labels"><text x="90" y="350" transform="rotate(-83 90 350)">CORDILLERA DE LOS ANDES</text><text x="297" y="542">PAMPAS</text><text x="362" y="178">GRAN CHACO</text><text x="125" y="451">CUYO</text><text x="550" y="490" transform="rotate(28 550 490)">RÍO DE LA PLATA</text><text x="590" y="573">ATLÁNTICO</text><text x="50" y="550" transform="rotate(-90 50 550)">CHILE</text></g>
 {CAMPAIGN_SECTORS.flatMap(d=>d.neighbors.filter(id=>d.id<id).map(id=>{const p=position(d.id),q=position(id);return <path key={`${d.id}-${id}`} d={`M${p.x},${p.y}L${q.x},${q.y}`} stroke="#dfd3a1" strokeWidth="1.4" data-road="true" strokeDasharray="4 5" fill="none"/>;}))}
 {WORLD_CELLS.map(tile=>{
 const owner=worldOwner(s,tile.id),active=selectedCell.id===tile.id,row=presence.get(tile.location),counts=strategicPresenceLabel(row);
 const label=[tile.name,owner==='patriot'?'patriota':owner==='royalist'?'realista':tile.land?'terreno abierto':'agua abierta',counts].filter(Boolean).join(' · ');
 const choose=()=>{onSelect(tile.location);onInspect?.(tile.location);};
 return <g key={tile.id} data-map-cell={tile.id} data-map-sector={tile.location} role="button" tabIndex={active?0:-1} aria-pressed={active} aria-label={label} onMouseEnter={()=>onHover?.(tile.location)} onFocus={()=>onHover?.(tile.location)} onClick={choose} onKeyDown={e=>{
  if(e.key==='Enter'||e.key===' '){e.preventDefault();choose();}
  const delta=({ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]} as Record<string,number[]>)[e.key];
  if(delta){e.preventDefault();const next=worldCell(`cell-${tile.col+delta[0]}-${tile.row+delta[1]}`);if(next){onSelect(next.location);e.currentTarget.ownerSVGElement?.querySelector<SVGGElement>(`[data-map-cell="${next.id}"]`)?.focus();}}
 }}>
 <title>{label}</title>
 <rect className="atlas-district" data-district={tile.id} x={tile.x} y={tile.y} width={MAP_TILE_SIZE} height={MAP_TILE_SIZE} fill={tile.district?(owner==='patriot'?'#7f9e61':'#876448'):'transparent'} fillOpacity={tile.district?'.85':1} stroke="#1c291b" strokeWidth=".5"/>
 {active&&<rect className="atlas-district-selected" x={tile.x+2} y={tile.y+2} width={MAP_TILE_SIZE-4} height={MAP_TILE_SIZE-4} fill="none" stroke="#fff3ad" strokeWidth="2"/>}
 {row&&<g data-sector-presence={tile.location} data-enemy-stale={row.staleEnemy||undefined}><PresenceDots players={row.players.length} militia={row.militia} enemies={row.enemies} unknown={row.unknownEnemy} x={tile.x+MAP_TILE_SIZE/2} y={tile.y+MAP_TILE_SIZE/2}/></g>}
 </g>;})}
 {mode==='cities'&&[{id:'san_nicolas',label:'San Lorenzo · 1813',lon:-60.73,lat:-32.75},{id:'tucuman',label:'Posta de Yatasto · 1814',lon:-64.97,lat:-25.68}].map(site=>{const p=project(site.lon,site.lat);return <g key={site.label} role="button" tabIndex={0} aria-label={`${site.label}, seleccionar sector de misión`} onClick={()=>{onSelect(site.id);onInspect?.(site.id);}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(site.id);onInspect?.(site.id);}}}><rect className="atlas-hit" x={p.x-10} y={p.y-10} width="20" height="20" fill="transparent"/><circle cx={p.x} cy={p.y} r="3" fill="#e6d194"/><text className="atlas-city" x={p.x+14} y={p.y+4} fill="#e6d194">{site.label}</text></g>;})}
 <g className="atlas-routes" pointerEvents="none">{s.squads.filter((q:any)=>q.journey).map((q:any)=>{const j=squadTravelStatus(q)!;return <polyline key={q.id} data-squad-route={q.id} points={(j.returning?j.path.slice(0,2):j.path).map((id:string)=>{const p=position(id)!;return `${p.x},${p.y}`;}).join(' ')} fill="none" stroke={q.id===s.activeSquadId?'#e8ce72':'#9dbbb4'} strokeWidth={q.id===s.activeSquadId?3:2} strokeDasharray="7 4"/>;})}{previewPath.length>1&&<polyline data-route-preview="true" points={previewPath.map(id=>{const p=position(id)!;return `${p.x},${p.y}`;}).join(' ')} fill="none" stroke="#fff4a3" strokeWidth="4"/>}</g>
 {s.squads.filter((q:any)=>['moving','ready'].includes(q.journey?.status)).map((q:any)=>{const j=squadTravelStatus(q)!,players=strategicTravelPresence(s,q);if(!players.length)return null;const origin=position(q.location)!,next=position(j.path[1])!,fraction=j.elapsed/j.legHours;const x=origin.x+(next.x-origin.x)*fraction,y=origin.y+(next.y-origin.y)*fraction;return <g key={q.id} className="atlas-travel-presence" data-travel-presence={q.id} role={plotting||!onSquad?"img":"button"} tabIndex={plotting||!onSquad?-1:0} pointerEvents={plotting||!onSquad?"none":undefined} aria-label={`${onSquad?'Seleccionar ':''}${q.name} · ${players.length} combatientes en marcha`} onClick={()=>{if(!plotting)onSquad?.(q.id);}} onKeyDown={e=>{if(!plotting&&(e.key==='Enter'||e.key===' ')){e.preventDefault();onSquad?.(q.id);}}}><title>{`${q.name} · ${players.length} combatientes en marcha`}</title><circle data-travel-hit="true" cx={x} cy={y} r="8" fill="transparent"/><PresenceDots players={players.length} x={x} y={y}/></g>;})}
 <g className="atlas-city-boundaries" pointerEvents="none">{CITIES.map(area=><path key={area.id} data-city-boundary={area.id} d={mapTileOutline(area.sectors.flatMap(id=>mapTilesForSector(id)))} fill="none" stroke="#dacb93" strokeWidth="1.8"/>)}</g>
 <g pointerEvents="none">{CAMPAIGN_SECTORS.map(d=>{
 const geo=MAP_PLACES[d.id as keyof typeof MAP_PLACES],bounds=mapTileBounds(mapTilesForSector(d.id));
 const left=geo.dx<0,x=left?bounds.left-8:bounds.right+8;
 const y=d.id==='retiro'?bounds.top-7:d.id==='ensenada'?bounds.top+12:d.id==='buenos_aires'?bounds.bottom+14:d.id==='los_patos'?bounds.top-9:bounds.top+12;
 const value=marks(d.id),ours=s.sectors[d.id].owner==='patriot';
 return <g key={d.id}><text className="atlas-city" x={x} y={y} textAnchor={left?'end':'start'} fill={ours?'#ccecaa':'#ffe0bd'}>{geo.label}</text>{value&&<text className="atlas-value" x={x} y={y+14} textAnchor={left?'end':'start'}>{value}</text>}</g>;
 })}</g>
 </g>
 {[-70,-68,-66,-64,-62,-60,-58,-56].map(lon=><text key={lon} x={project(lon,-22).x} y="25" fill="#c0b68a" fontSize="11" textAnchor="middle">{Math.abs(lon)}° O</text>)}
 {[-24,-26,-28,-30,-32,-34].map(lat=><text key={lat} x="19" y={project(-72,lat).y} fill="#c0b68a" fontSize="10" textAnchor="middle" transform={`rotate(-90 19 ${project(-72,lat).y})`}>{Math.abs(lat)}° S</text>)}
 <g transform="translate(552 52)" pointerEvents="none" opacity=".7"><rect width="117" height="189" fill="#17251f" stroke="#ad9c6c"/><path d={geometryPath(geography.argentina,(lon,lat)=>({x:8+(lon+74)*6,y:8+(-21-lat)*5}))} fill="#9a9868" stroke="#d6c898" strokeWidth=".7"/><rect x="20" y="13" width="88" height="70" fill="#e0c87d22" stroke="#f1d389"/><text x="8" y="178" fill="#e1d1a6" fontSize="10">Argentina · referencia</text></g>
 <text x="54" y="650" fill="#d6c895" fontSize="12">N ↑</text><path d="M120 641v6h164v-6M202 641v6" stroke="#d6c895" fill="none"/><text x="120" y="665" fill="#d6c895" fontSize="11">0</text><text x="260" y="665" fill="#d6c895" fontSize="11">500 km</text><text x="365" y="651" fill="#c8c6aa" fontSize="11">■ Patriotas   ■ Realistas · Control de campaña</text>
 <text x="365" y="674" fontSize="10" aria-label="Cada punto representa un combatiente; signo de pregunta, fuerza enemiga sin confirmar"><tspan fill="#f4d969">● Propios </tspan><tspan fill="#80dba1">● Milicias </tspan><tspan fill="#ef8d86">● Realistas · ? Sin cifra</tspan></text>
 </svg>
 <div className="atlas-bottom"><div className="atlas-toolbar" role="group" aria-label="Vistas del mapa">{MAP_MODES.map((m,i)=>{const Icon=icons[i];return <button type="button" key={m.id} title={m.label} aria-label={m.label} aria-pressed={mode===m.id} onClick={()=>{setMode(m.id);setManagement(['resources','items'].includes(m.id));if(['resources','items'].includes(m.id))onOpenPanel?.();}}>{Icon?<Icon size={23} aria-hidden="true"/>:<span className="horse-icon" aria-hidden="true">♞</span>}<span>{m.label}</span></button>;})}</div><div className="atlas-depth" role="group" aria-label="Nivel del mapa"><button type="button" aria-pressed="true" title="Superficie">0</button>{[1,2,3].map(n=><button type="button" disabled key={n} title="Subsuelo no disponible">−{n}</button>)}</div></div>

 {mode==='militia'&&<p className="atlas-help">Seleccioná una localidad. Usá «Milicias» en las órdenes del sector para elegir instructor y entrenar defensores.</p>}

 {mode==='horses'&&<button className="line-button atlas-manage-toggle" aria-expanded={management} onClick={()=>{setManagement(!management);if(!management)onOpenPanel?.();}}>{management?'Cerrar administración':'Administrar esta vista'}</button>}
 {management&&<StrategicPanel title={mode==='resources'?'Ingresos de los puertos':mode==='items'?'Objetos del sector':'Monturas'} onClose={()=>setManagement(false)}>{mode==='resources'?<SectorIncomeTable state={s} onSelect={id=>{onSelect(id);setManagement(false);}}/>:mode==='items'?<SectorInventory key={selected} state={s} sectorId={selected} dispatch={dispatch}/>:<div className="atlas-management"><Horses state={s} dispatch={dispatch}/></div>}</StrategicPanel>}
 <details className="atlas-note"><summary>Lectura del mapa · Caminos: marcha más rápida</summary><p>Seleccioná una celda con el ratón o las flechas del teclado. Cada celda terrestre conserva su escena y sus objetos. Los barrios comparten el control de su localidad; sus ingresos, milicias y servicios pertenecen al sector principal. El agua abierta requiere transporte. La geografía y las rutas son una adaptación de campaña, no límites históricos.</p></details>
 </div>;
}
