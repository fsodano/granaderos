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
import {campaignWorld,campaignSectors,campaignCities,campaignPresentation} from '../../game/campaign-definition.js';
import {MAP_MODES,project,sectorPosition,sectorIncome,MAP_TILE_SIZE,mapTilesForSector,mapTileBounds,mapTileOutline} from '../../game/strategic-map.js';
import {worldContext,worldCell,campaignPlace,worldOwner} from '../../game/world-cells.js';
import Horses from './Horses';
import './strategic-map.css';
import './strategic-presence.css';
const icons=[Landmark,Pickaxe,Users,Shield,null,Package];
function geometryPath(geometry:any,projection=project):string{
 const lines=geometry.type==='MultiPolygon'?geometry.coordinates.flat():geometry.type==='Polygon'||geometry.type==='MultiLineString'?geometry.coordinates:[geometry.coordinates];
 return lines.map((ring:number[][])=>ring.map(([lon,lat],i)=>{const p=projection(lon,lat);return `${i?'L':'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`;}).join('')+(geometry.type.includes('Polygon')?'Z':'')).join('');
}
const stockCount=(s:any,id:string)=>knownCampaignSectorEquipment(s,id).reduce((n:number,row:any)=>n+row.count,0);
function PresenceDots({players=0,militia=0,enemies=0,unknown=false,x,y}:{players?:number;militia?:number;enemies?:number;unknown?:boolean;x:number;y:number}){
 const dots=[...Array(players).fill('player'),...Array(militia).fill('militia'),...Array(enemies).fill('enemy')],total=dots.length+Number(unknown);
 const columns=Math.max(1,Math.ceil(Math.sqrt(total))),rows=Math.ceil(total/columns),step=Math.min(4,14/Math.max(columns,rows)),radius=step*.34;
 const point=(index:number)=>({x:x+(index%columns-(columns-1)/2)*step,y:y+(Math.floor(index/columns)-(rows-1)/2)*step});
 return <g aria-hidden="true" pointerEvents="none">{dots.map((side,index)=>{const p=point(index);return <circle key={index} data-presence-dot={side} cx={p.x} cy={p.y} r={radius} fill={side==='player'?'#f4d969':side==='militia'?'#80dba1':'#ef8d86'} stroke="#142018" strokeWidth={radius*.25}/>;})}{unknown&&<text data-enemy-unknown="true" x={point(dots.length).x} y={point(dots.length).y} textAnchor="middle" dominantBaseline="central" fill="#ffaaa3" fontSize={Math.min(12,step*2.2)} fontWeight="bold" stroke="#17221b" strokeWidth="1" paintOrder="stroke">?</text>}</g>;
}
export default function StrategicMap({state:s,battle,selected,onSelect,dispatch,onInspect,onOpenPanel,plotting=false,onHover,previewPath=[],onSquad}:{state:any;battle?:any;selected:string;onSelect:(id:string)=>void;dispatch:(action:any)=>void;onInspect?:(id:string)=>void;onOpenPanel?:()=>void;plotting?:boolean;onHover?:(id:string)=>void;previewPath?:string[];onSquad?:(id:string)=>void}){
 const [mode,setMode]=useState('cities');
 const [management,setManagement]=useState(false);
 const world=campaignWorld(s),geography=world.geography??{land:[],rivers:[]},presentation=campaignPresentation(s),atlas=presentation.atlas??{},projection=(lon:number,lat:number)=>project(lon,lat,s);
 const {WORLD_CELLS,ROAD_CELLS,ROAD_SEGMENTS,roadEdgesForCell}=worldContext(s),CAMPAIGN_SECTORS=campaignSectors(s),CITIES=campaignCities(s),MAP_PLACES=world.places as Record<string,{dx?:number;label?:string}>;
 const position=(id:string)=>{const cell=worldCell(id,s);return cell?{x:cell.x+MAP_TILE_SIZE/2,y:cell.y+MAP_TILE_SIZE/2}:sectorPosition(id,s)!;};
 const selectedCell=worldCell(selected,s)!;
 const presence=new Map(strategicSectorPresence(s,battle).map(row=>[row.sector,row]));
 const marks=(id:string)=>mode==='resources'?`${s.sectors[id]?sectorIncome(s,campaignPlace(id,s)):0} $/día`:mode==='squads'?`${presence.get(id)?.players.length??0} soldados`:mode==='militia'?`${presence.get(id)?.militia??0} milicianos`:mode==='horses'?`${(s.horseState?.horses??[]).filter((h:any)=>!h.returned&&!h.custody&&!operativeInTransit(s,h.assignedTo)&&h.location===id).length} monturas`:mode==='items'?`${stockCount(s,id)} en la celda`:null;
 return <div className="strategy-chart argentina-chart">
 <div className="atlas-heading"><span>{atlas.title??presentation.title??'CAMPAÑA'}</span><span>TEATRO DE OPERACIONES</span></div>
 <svg data-plotting={plotting} onMouseLeave={()=>onHover?.('')} className="argentina-atlas" viewBox="0 0 720 690" role="group" aria-label={atlas.label??'Mapa de campaña'}>
 <defs><clipPath id="atlas-clip"><rect x="36" y="36" width="648" height="588"/></clipPath><pattern id="atlas-grid" width={MAP_TILE_SIZE} height={MAP_TILE_SIZE} x="36" y="36" patternUnits="userSpaceOnUse"><rect width={MAP_TILE_SIZE} height={MAP_TILE_SIZE} fill="none" stroke="#141e16" strokeOpacity=".35" strokeWidth=".8"/></pattern><linearGradient id="atlas-land" x2="1" y2="1"><stop stopColor="#7f7952"/><stop offset=".5" stopColor="#535c3c"/><stop offset="1" stopColor="#9b8d5a"/></linearGradient></defs>
 <rect width="720" height="690" fill="#18211e"/><rect x="36" y="36" width="648" height="588" fill="#25454d"/>
 <g clipPath="url(#atlas-clip)">
 {(geography.land??[]).map((g:any,i:number)=><path key={i} d={geometryPath(g,projection)} fill="url(#atlas-land)" stroke="none"/>)}
 {atlas.mountains&&<path d={atlas.mountains} fill="none" stroke="#c2b59b" strokeOpacity=".25" strokeWidth="34"/>}
 {(geography.rivers??[]).map((g:any,i:number)=><path key={i} d={geometryPath(g,projection)} stroke="#80b1b6" strokeWidth="2.7" fill="none"/>)}
 <rect x="36" y="36" width="648" height="588" fill="url(#atlas-grid)"/>
 <g className="atlas-region-labels">{atlas.labels?.map((label:any,index:number)=><text key={index} x={label.x} y={label.y} transform={label.transform}>{label.text}</text>)}</g>
 <g className="atlas-district-fills" pointerEvents="none" aria-hidden="true">{WORLD_CELLS.filter((tile:any)=>tile.district).map((tile:any)=><rect key={tile.id} x={tile.x} y={tile.y} width={MAP_TILE_SIZE} height={MAP_TILE_SIZE} fill={worldOwner(s,tile.id)==='patriot'?'#7f9e61':'#876448'} fillOpacity=".85"/>)}</g>
 <g className="atlas-roads" pointerEvents="none" aria-hidden="true">{ROAD_SEGMENTS.map(({from,to}:{from:string;to:string})=>{const p=position(from),q=position(to),path=`M${p.x},${p.y}L${q.x},${q.y}`;return <g key={`${from}-${to}`}><path className="atlas-road-bed" d={path}/><path className="atlas-road" data-road="true" data-road-from={from} data-road-to={to} d={path}/></g>;})}</g>
 {WORLD_CELLS.map((tile:any)=>{
 const owner=worldOwner(s,tile.id),active=selectedCell.id===tile.id,row=presence.get(tile.location),counts=strategicPresenceLabel(row,s),road=ROAD_CELLS.has(tile.id),edges=roadEdgesForCell(tile.id);
 const directions:Record<string,string>={N:'norte',E:'este',S:'sur',W:'oeste'};
 const label=[tile.name,owner==='patriot'?(atlas.friendlyLabel??'propio'):owner==='royalist'?(atlas.enemyLabel??'enemigo'):tile.land?'terreno abierto':'agua abierta',road?`Camino conectado al ${edges.map((edge:string)=>directions[edge]).join(', ')}`:null,counts].filter(Boolean).join(' · ');
 const choose=()=>{onSelect(tile.location);onInspect?.(tile.location);};
 return <g key={tile.id} data-map-cell={tile.id} data-map-sector={tile.location} data-road-cell={road} data-road-edges={edges.join('')||undefined} role="button" tabIndex={active?0:-1} aria-pressed={active} aria-label={label} onMouseEnter={()=>onHover?.(tile.location)} onFocus={()=>onHover?.(tile.location)} onClick={choose} onKeyDown={e=>{
  if(e.key==='Enter'||e.key===' '){e.preventDefault();choose();}
  const delta=({ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]} as Record<string,number[]>)[e.key];
  if(delta){e.preventDefault();const next=worldCell(`cell-${tile.col+delta[0]}-${tile.row+delta[1]}`,s);if(next){onSelect(next.location);e.currentTarget.ownerSVGElement?.querySelector<SVGGElement>(`[data-map-cell="${next.id}"]`)?.focus();}}
 }}>
 <title>{label}</title>
 <rect className="atlas-district" data-district={tile.id} x={tile.x} y={tile.y} width={MAP_TILE_SIZE} height={MAP_TILE_SIZE} fill="transparent" stroke="#1c291b" strokeWidth=".5"/>
 {active&&<rect className="atlas-district-selected" x={tile.x+2} y={tile.y+2} width={MAP_TILE_SIZE-4} height={MAP_TILE_SIZE-4} fill="none" stroke="#fff3ad" strokeWidth="2"/>}
 {row&&<g data-sector-presence={tile.location} data-enemy-stale={row.staleEnemy||undefined}><PresenceDots players={row.players.length} militia={row.militia} enemies={row.enemies} unknown={row.unknownEnemy} x={tile.x+MAP_TILE_SIZE/2} y={tile.y+MAP_TILE_SIZE/2}/></g>}
 </g>;})}
 {mode==='cities'&&(atlas.sites??[]).filter((site:any)=>s.sectors[site.id]).map((site:any)=>{const p=projection(site.lon,site.lat);return <g key={site.label} role="button" tabIndex={0} aria-label={`${site.label}, seleccionar sector de misión`} onClick={()=>{onSelect(site.id);onInspect?.(site.id);}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(site.id);onInspect?.(site.id);}}}><rect className="atlas-hit" x={p.x-10} y={p.y-10} width="20" height="20" fill="transparent"/><circle cx={p.x} cy={p.y} r="3" fill="#e6d194"/><text className="atlas-city" x={p.x+14} y={p.y+4} fill="#e6d194">{site.label}</text></g>;})}
 <g className="atlas-routes" pointerEvents="none">{s.squads.filter((q:any)=>q.journey).map((q:any)=>{const j=squadTravelStatus(q,s)!;return <polyline key={q.id} data-squad-route={q.id} points={(j.returning?j.path.slice(0,2):j.path).map((id:string)=>{const p=position(id)!;return `${p.x},${p.y}`;}).join(' ')} fill="none" stroke={q.id===s.activeSquadId?'#e8ce72':'#9dbbb4'} strokeWidth={q.id===s.activeSquadId?3:2} strokeDasharray="7 4"/>;})}{previewPath.length>1&&<polyline data-route-preview="true" points={previewPath.map(id=>{const p=position(id)!;return `${p.x},${p.y}`;}).join(' ')} fill="none" stroke="#fff4a3" strokeWidth="4"/>}</g>
 {s.squads.filter((q:any)=>['moving','ready'].includes(q.journey?.status)).map((q:any)=>{const j=squadTravelStatus(q,s)!,players=strategicTravelPresence(s,q);if(!players.length)return null;const origin=position(q.location)!,next=position(j.path[1])!,fraction=j.elapsed/j.legHours;const x=origin.x+(next.x-origin.x)*fraction,y=origin.y+(next.y-origin.y)*fraction;return <g key={q.id} className="atlas-travel-presence" data-travel-presence={q.id} role={plotting||!onSquad?"img":"button"} tabIndex={plotting||!onSquad?-1:0} pointerEvents={plotting||!onSquad?"none":undefined} aria-label={`${onSquad?'Seleccionar ':''}${q.name} · ${players.length} combatientes en marcha`} onClick={()=>{if(!plotting)onSquad?.(q.id);}} onKeyDown={e=>{if(!plotting&&(e.key==='Enter'||e.key===' ')){e.preventDefault();onSquad?.(q.id);}}}><title>{`${q.name} · ${players.length} combatientes en marcha`}</title><circle data-travel-hit="true" cx={x} cy={y} r="8" fill="transparent"/><PresenceDots players={players.length} x={x} y={y}/></g>;})}
 <g className="atlas-city-boundaries" pointerEvents="none">{CITIES.map((area:any)=><path key={area.id} data-city-boundary={area.id} d={mapTileOutline(area.sectors.flatMap((id:string)=>mapTilesForSector(id,s)))} fill="none" stroke="#dacb93" strokeWidth="1.8"/>)}</g>
 <g pointerEvents="none">{CAMPAIGN_SECTORS.map((d:any)=>{
 const geo=MAP_PLACES[d.id]??{},tiles=mapTilesForSector(d.id,s),cell=worldCell(d.id,s);if(!cell)return null;const bounds=mapTileBounds(tiles.length?tiles:[cell]);
 const left=(geo.dx??0)<0,x=left?bounds.left-8:bounds.right+8;
 const labelPosition=(atlas.labelPositions as Record<string,{edge?:string;offset?:number}>)?.[d.id]??{},y=labelPosition.edge==='bottom'?bounds.bottom+(labelPosition.offset??14):bounds.top+(labelPosition.offset??12);
 const value=marks(d.id),ours=s.sectors[d.id].owner==='patriot';
 return <g key={d.id}><text className="atlas-city" x={x} y={y} textAnchor={left?'end':'start'} fill={ours?'#ccecaa':'#ffe0bd'}>{geo.label??d.name}</text>{value&&<text className="atlas-value" x={x} y={y+14} textAnchor={left?'end':'start'}>{value}</text>}</g>;
 })}</g>
 </g>
 {atlas.longitudes?.map((lon:number)=><text key={lon} x={projection(lon,world.projection.maxLatitude).x} y="25" fill="#c0b68a" fontSize="11" textAnchor="middle">{Math.abs(lon)}° {lon<0?'O':'E'}</text>)}
 {atlas.latitudes?.map((lat:number)=><text key={lat} x="19" y={projection(world.projection.minLongitude,lat).y} fill="#c0b68a" fontSize="10" textAnchor="middle" transform={`rotate(-90 19 ${projection(world.projection.minLongitude,lat).y})`}>{Math.abs(lat)}° {lat<0?'S':'N'}</text>)}
 {geography.argentina&&atlas.referenceLabel&&<g transform="translate(552 52)" pointerEvents="none" opacity=".7"><rect width="117" height="189" fill="#17251f" stroke="#ad9c6c"/><path d={geometryPath(geography.argentina,(lon,lat)=>({x:8+(lon+74)*6,y:8+(-21-lat)*5}))} fill="#9a9868" stroke="#d6c898" strokeWidth=".7"/><rect x="20" y="13" width="88" height="70" fill="#e0c87d22" stroke="#f1d389"/><text x="8" y="178" fill="#e1d1a6" fontSize="10">{atlas.referenceLabel}</text></g>}
 <text x="54" y="650" fill="#d6c895" fontSize="12">N ↑</text>{atlas.scale&&<><path d="M120 641v6h164v-6M202 641v6" stroke="#d6c895" fill="none"/><text x="120" y="665" fill="#d6c895" fontSize="11">0</text><text x="260" y="665" fill="#d6c895" fontSize="11">{atlas.scale}</text></>}<text x="365" y="651" fill="#c8c6aa" fontSize="11">{atlas.legend??'■ Propios   ■ Enemigos · Control de campaña'}</text>
 <text x="365" y="674" fontSize="10" aria-label="Cada punto representa un combatiente; signo de pregunta, fuerza enemiga sin confirmar"><tspan fill="#f4d969">● Propios </tspan><tspan fill="#80dba1">● Milicias </tspan><tspan fill="#ef8d86">● {atlas.enemyLabel??'Enemigos'} · ? Sin cifra</tspan></text>
 </svg>
 <div className="atlas-bottom"><div className="atlas-toolbar" role="group" aria-label="Vistas del mapa">{MAP_MODES.map((m,i)=>{const Icon=icons[i];return <button type="button" key={m.id} title={m.label} aria-label={m.label} aria-pressed={mode===m.id} onClick={()=>{setMode(m.id);setManagement(['resources','items'].includes(m.id));if(['resources','items'].includes(m.id))onOpenPanel?.();}}>{Icon?<Icon size={23} aria-hidden="true"/>:<span className="horse-icon" aria-hidden="true">♞</span>}<span>{m.label}</span></button>;})}</div><div className="atlas-depth" role="group" aria-label="Nivel del mapa"><button type="button" aria-pressed="true" title="Superficie">0</button>{[1,2,3].map(n=><button type="button" disabled key={n} title="Subsuelo no disponible">−{n}</button>)}</div></div>

 {mode==='militia'&&<p className="atlas-help">Seleccioná una localidad. Usá «Milicias» en las órdenes del sector para elegir instructor y entrenar defensores.</p>}

 {mode==='horses'&&<button className="line-button atlas-manage-toggle" aria-expanded={management} onClick={()=>{setManagement(!management);if(!management)onOpenPanel?.();}}>{management?'Cerrar administración':'Administrar esta vista'}</button>}
 {management&&<StrategicPanel title={mode==='resources'?'Ingresos de los puertos':mode==='items'?'Objetos del sector':'Monturas'} onClose={()=>setManagement(false)}>{mode==='resources'?<SectorIncomeTable state={s} onSelect={id=>{onSelect(id);setManagement(false);}}/>:mode==='items'?<SectorInventory key={selected} state={s} sectorId={selected} dispatch={dispatch}/>:<div className="atlas-management"><Horses state={s} dispatch={dispatch}/></div>}</StrategicPanel>}
 <details className="atlas-note"><summary>Lectura del mapa · Caminos: marcha más rápida</summary><p className="atlas-route-help"><span className="atlas-road-key" aria-hidden="true"/>La ruta elige el menor tiempo. Los caminos conectados son más rápidos. Entre sectores vecinos de la misma ciudad: 1 h. Agregá escalas para rodear patrullas conocidas.</p><p>Seleccioná una celda con el ratón o las flechas del teclado. Cada celda terrestre conserva su escena y sus objetos. Los barrios comparten el control de su localidad; sus ingresos, milicias y servicios pertenecen al sector principal. El agua abierta requiere transporte. La geografía y las rutas son una adaptación de campaña, no límites históricos.</p></details>
 </div>;
}
