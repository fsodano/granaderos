'use client';
import {useState} from 'react';
import {Landmark,Pickaxe,Users,Shield,Package} from 'lucide-react';
import geography from '../../game/strategic-geography.json';
import {MAP_PLACES,MAP_MODES,project,sectorPosition,sectorIncome,MAP_TILE_SIZE,mapTilesForSector,mapTileBounds,mapTileOutline} from '../../game/strategic-map.js';
import {CAMPAIGN_SECTORS} from '../../game/campaign.js';
import {CITIES,getCityStatus} from '../../game/cities.js';
import Squads from './Squads';
import Armory from './Armory';
import './strategic-map.css';
const icons=[Landmark,Pickaxe,Users,Shield,null,Package];
function geometryPath(geometry:any,projection=project):string{
 const lines=geometry.type==='MultiPolygon'?geometry.coordinates.flat():geometry.type==='Polygon'||geometry.type==='MultiLineString'?geometry.coordinates:[geometry.coordinates];
 return lines.map((ring:number[][])=>ring.map(([lon,lat],i)=>{const p=projection(lon,lat);return `${i?'L':'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`;}).join('')+(geometry.type.includes('Polygon')?'Z':'')).join('');
}
const groundStock=(s:any,id:string)=>s.sectorStates?.[id]?.groundItems??[];
const stockCount=(s:any,id:string)=>groundStock(s,id).reduce((n:number,item:any)=>n+(item.count??1),0);
export default function StrategicMap({state:s,selected,onSelect,dispatch}:{state:any;selected:string;onSelect:(id:string)=>void;dispatch:(action:any)=>void}){
 const [mode,setMode]=useState('cities');
 const [districtId,setDistrictId]=useState('');
 const selectedTiles=mapTilesForSector(selected);
 const district=selectedTiles.find(t=>t.id===districtId)??selectedTiles[0];
 const total=CAMPAIGN_SECTORS.reduce((n,d)=>n+sectorIncome(s,d),0);
 const def=CAMPAIGN_SECTORS.find(d=>d.id===selected)!;
 const city=getCityStatus(s,selected);
 const marks=(id:string)=>mode==='resources'?`${sectorIncome(s,CAMPAIGN_SECTORS.find(d=>d.id===id)) } $/día`:mode==='squads'?`${s.squads.filter((q:any)=>q.location===id).reduce((n:number,q:any)=>n+q.members.length,0)} soldados`:mode==='militia'?`${s.sectors[id].militia.reduce((a:number,b:number)=>a+b,0)} milicianos`:mode==='horses'?(s.routes.posta?'Postas organizadas':'Sin red de postas'):mode==='items'?`${stockCount(s,id)} en el sector`:null;
 return <div className="strategy-chart argentina-chart">
 <div className="atlas-heading"><span>PROVINCIAS UNIDAS · 1812–1817</span><span>TEATRO DE OPERACIONES</span></div>
 <svg className="argentina-atlas" viewBox="0 0 720 690" role="group" aria-label="Mapa geográfico de la campaña en las Provincias Unidas">
 <defs><clipPath id="atlas-clip"><rect x="36" y="36" width="648" height="588"/></clipPath><pattern id="atlas-grid" width={MAP_TILE_SIZE} height={MAP_TILE_SIZE} x="36" y="36" patternUnits="userSpaceOnUse"><rect width={MAP_TILE_SIZE} height={MAP_TILE_SIZE} fill="none" stroke="#141e16" strokeOpacity=".35" strokeWidth=".8"/></pattern><linearGradient id="atlas-land" x2="1" y2="1"><stop stopColor="#7f7952"/><stop offset=".5" stopColor="#535c3c"/><stop offset="1" stopColor="#9b8d5a"/></linearGradient></defs>
 <rect width="720" height="690" fill="#18211e"/><rect x="36" y="36" width="648" height="588" fill="#25454d"/>
 <g clipPath="url(#atlas-clip)">
 {geography.land.map((g,i)=><path key={i} d={geometryPath(g)} fill="url(#atlas-land)" stroke="none"/>)}
 <path d={[-22,-23,-24,-25,-26,-27,-28,-29,-30,-31,-32,-33,-34,-35,-36].map((lat,i)=>{const p=project(-67.4-(i*.24),lat);return `${i?'L':'M'}${p.x},${p.y}`;}).join(' ')} fill="none" stroke="#c2b59b" strokeOpacity=".25" strokeWidth="34"/>
 {geography.rivers.map((g,i)=><path key={i} d={geometryPath(g)} stroke="#80b1b6" strokeWidth="2.7" fill="none"/>)}
 <rect x="36" y="36" width="648" height="588" fill="url(#atlas-grid)"/>
 <g className="atlas-region-labels"><text x="90" y="350" transform="rotate(-83 90 350)">CORDILLERA DE LOS ANDES</text><text x="297" y="542">PAMPAS</text><text x="362" y="178">GRAN CHACO</text><text x="125" y="451">CUYO</text><text x="550" y="490" transform="rotate(28 550 490)">RÍO DE LA PLATA</text><text x="590" y="573">ATLÁNTICO</text><text x="50" y="550" transform="rotate(-90 50 550)">CHILE</text></g>
 {mode==='squads'&&CAMPAIGN_SECTORS.flatMap(d=>d.neighbors.filter(id=>d.id<id).map(id=>{const p=sectorPosition(d.id)!,q=sectorPosition(id)!;return <path key={`${d.id}-${id}`} d={`M${p.x},${p.y}L${q.x},${q.y}`} stroke="#dfd3a1" strokeWidth="1.4" strokeDasharray="4 5" fill="none"/>;}))}
 {mode==='cities'&&[{id:'san_nicolas',label:'San Lorenzo · 1813',lon:-60.73,lat:-32.75},{id:'tucuman',label:'Posta de Yatasto · 1814',lon:-64.97,lat:-25.68}].map(site=>{const p=project(site.lon,site.lat);return <g key={site.label} role="button" tabIndex={0} aria-label={`${site.label}, seleccionar sector de misión`} onClick={()=>onSelect(site.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(site.id);}}}><rect className="atlas-hit" x={p.x-10} y={p.y-10} width="20" height="20" fill="transparent"/><circle cx={p.x} cy={p.y} r="3" fill="#e6d194"/><text className="atlas-city" x={p.x+14} y={p.y+4} fill="#e6d194">{site.label}</text></g>;})}
 {CAMPAIGN_SECTORS.map(d=>{
 const ours=s.sectors[d.id].owner==='patriot';
 return <g key={d.id} data-map-sector={d.id}>{mapTilesForSector(d.id).map(tile=>{
 const active=selected===d.id&&district.id===tile.id;
 const choose=()=>{setDistrictId(tile.id);onSelect(d.id);};
 return <g key={tile.id} role="button" tabIndex={0} aria-pressed={active} aria-label={`${MAP_PLACES[d.id as keyof typeof MAP_PLACES].label} · ${tile.name} · ${ours?'patriota':'realista'}`} onClick={choose} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose();}}}>
 <title>{`${tile.name} · ${d.name} · Sector ${d.grid}`}</title>
 <rect className="atlas-district" data-district={tile.id} x={tile.x} y={tile.y} width={MAP_TILE_SIZE} height={MAP_TILE_SIZE} fill={ours?'#7f9e61':'#876448'} fillOpacity={tile.urban?'.85':'.5'} stroke="#1c291b" strokeWidth=".8"/>
 {active&&<rect className="atlas-district-selected" x={tile.x+2} y={tile.y+2} width={MAP_TILE_SIZE-4} height={MAP_TILE_SIZE-4} fill="none" stroke="#fff3ad" strokeWidth="2"/>}
 {s.location===d.id&&tile.id===mapTilesForSector(d.id)[0].id&&<circle cx={tile.x+MAP_TILE_SIZE/2} cy={tile.y+MAP_TILE_SIZE/2} r="2.5" fill="#fff"/>}
 </g>;})}</g>;})}
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
 <g transform="translate(552 52)"><rect width="117" height="189" fill="#17251f" stroke="#ad9c6c"/><path d={geometryPath(geography.argentina,(lon,lat)=>({x:8+(lon+74)*6,y:8+(-21-lat)*5}))} fill="#9a9868" stroke="#d6c898" strokeWidth=".7"/><rect x="20" y="13" width="88" height="70" fill="#e0c87d22" stroke="#f1d389"/><text x="8" y="178" fill="#e1d1a6" fontSize="10">Argentina · referencia</text></g>
 <text x="54" y="650" fill="#d6c895" fontSize="12">N ↑</text><path d="M120 641v6h164v-6M202 641v6" stroke="#d6c895" fill="none"/><text x="120" y="665" fill="#d6c895" fontSize="11">0</text><text x="260" y="665" fill="#d6c895" fontSize="11">500 km</text><text x="365" y="651" fill="#c8c6aa" fontSize="11">■ Patriotas   ■ Realistas · Control de campaña</text>
 </svg>
 <div className="atlas-bottom"><div className="atlas-toolbar" role="group" aria-label="Vistas del mapa">{MAP_MODES.map((m,i)=>{const Icon=icons[i];return <button type="button" key={m.id} title={m.label} aria-label={m.label} aria-pressed={mode===m.id} onClick={()=>setMode(m.id)}>{Icon?<Icon size={23} aria-hidden="true"/>:<span className="horse-icon" aria-hidden="true">♞</span>}<span>{m.label}</span></button>;})}</div><div className="atlas-depth" role="group" aria-label="Nivel del mapa"><button type="button" aria-pressed="true" title="Superficie">0</button>{[1,2,3].map(n=><button type="button" disabled key={n} title="Subsuelo no disponible">−{n}</button>)}</div></div>
 <div className="atlas-readout" aria-live="polite"><strong>{MAP_PLACES[selected as keyof typeof MAP_PLACES].label} · {district.name}</strong>{mode==='cities'?<span>{city?`${city.loyalty}% lealtad · ${city.sectors.flatMap(id=>mapTilesForSector(id)).length} casillas urbanas · ${city.sectors.length-city.uncontrolled.length}/${city.sectors.length} sectores controlados`:'Paso rural · Sin núcleo urbano'}</span>:mode==='resources'?<span>{def.asset} · {sectorIncome(s,def)} pesos/día · Total: {total} pesos/día</span>:<span>{marks(selected)}</span>}</div>
 {mode==='resources'&&<div className="atlas-table"><table><caption>Ingresos diarios actuales · pesos</caption><thead><tr><th>Localidad</th><th>Base</th><th>Aporte</th></tr></thead><tbody>{CAMPAIGN_SECTORS.map(d=><tr key={d.id}><td><button onClick={()=>onSelect(d.id)}>{MAP_PLACES[d.id as keyof typeof MAP_PLACES].label}</button></td><td>{d.income}</td><td>{sectorIncome(s,d)}</td></tr>)}</tbody></table><p>El aporte incluye ocupación, daños, bloqueo. No incluye gastos.</p></div>}
 {mode==='militia'&&<p className="atlas-help">Seleccioná una localidad. Usá «Milicias» en las órdenes del sector para elegir instructor y entrenar defensores.</p>}
 {mode==='items'&&<div className="atlas-stock"><h3>Objetos en {MAP_PLACES[selected as keyof typeof MAP_PLACES].label}</h3>{groundStock(s,selected).map((item:any)=><p key={item.id}>{item.name??item.item??item.type}: {item.count??1}</p>)}{!stockCount(s,selected)&&<p>Sin objetos registrados en el suelo. Explorá el sector para encontrarlos.</p>}</div>}
 <MapManagement mode={mode} state={s} dispatch={dispatch}/>
 <p className="atlas-note">Geografía aproximada. Los sectores, rutas y ocupaciones son una adaptación de campaña; no representan fronteras ni control histórico. Las ciudades se amplían en casillas de barrios; los barrios de un mismo sector comparten control, ingresos y mapa táctico. El recuadro usa el contorno continental actual como referencia.</p>
 </div>;
}
function MapManagement({mode,state,dispatch}:{mode:string;state:any;dispatch:(action:any)=>void}){return <div className="atlas-management">{mode==='squads'&&<Squads state={state} dispatch={dispatch}/ >}{mode==='horses'&&<><h3>Postas y transporte</h3><p>Organizá una red de postas para viajar a caballo entre sectores controlados.</p>{[{id:"posta",name:"Postas de chasques",cost:150},{id:"carts",name:"Carretas de Cuyo",cost:180},{id:"mules",name:"Mulas de los Andes",cost:120},{id:"flotilla",name:"Flotilla del Plata",cost:400}].map(route=><button key={route.id} className="line-button" disabled={state.routes[route.id]||Boolean(state.pendingBattle)||state.resources.treasury<route.cost} onClick={()=>dispatch({type:"transport",mode:route.id})}>{route.name} · {state.routes[route.id]?"Organizada":`${route.cost} pesos`}</button>)}<Squads state={state} dispatch={dispatch}/></>}{mode==='items'&&<><Armory state={state} dispatch={dispatch}/></>}</div>;}
