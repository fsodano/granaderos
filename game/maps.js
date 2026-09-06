import {expandSectorMap} from './sector-expansion.js';
import {propBlocksAt} from './props.js';
import {CAMPAIGN_SECTORS} from './data.js';
import {MAP_LIBRARY} from './map-library.js';
import {compileMap} from './compile-map.js';

// Authored tactical plans. Buildings are solid footprints, never walkable painted facades.
// The strategic grid is schematic; these tactical layouts are original gameplay maps,
// not archaeological reconstructions or surveyed historical plans.
export const MAP_IDS = [...CAMPAIGN_SECTORS.map(s=>s.id),'san_lorenzo','yatasto'];
const WIDTH=20,HEIGHT=16;
const clone=value=>JSON.parse(JSON.stringify(value));
const names={yatasto:'Posta de Yatasto · Conferencia del Ejército del Norte',buenos_aires:'Plaza Mayor y Cabildo',retiro:'Cuartel de Retiro',ensenada:'Puerto de Ensenada',san_nicolas:'Paso de San Nicolás',santa_fe:'Puerto de Santa Fe',cordoba:'Talleres de Caroya',mendoza:'Campamento de El Plumerillo',uspallata:'Desfiladero de Uspallata',los_patos:'Senda de Los Patos',tucuman:'La Ciudadela de Tucumán',salta:'Quebradas de Salta',jujuy:'Posta de Jujuy',humahuaca:'Entrada a la Quebrada',san_lorenzo:'Convento de San Carlos · San Lorenzo'};

function plan(id){const doc=MAP_LIBRARY[id];if(!doc)throw Error('No existe un plano para ese sector.');return compileMap(doc);}
const key=p=>`${p.x},${p.y}`;
function connected(tiles,start,props=[]){
 const reached=new Set([key(start)]),queue=[start];while(queue.length){const p=queue.shift();for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const x=p.x+dx,y=p.y+dy,t=tiles[y*WIDTH+x];if(x>=0&&x<WIDTH&&y>=0&&y<HEIGHT&&t&&!t.blocked&&!propBlocksAt({props},x,y)&&!reached.has(key(t))){reached.add(key(t));queue.push(t);}}}return reached;
}
function buildCompactSectorMap(request={}){
 const id=request.sceneId??request.sector??request.id??'san_lorenzo';const authored=plan(id),tiles=authored.tiles;
 const open=tiles.filter(t=>!t.blocked&&!propBlocksAt(authored,t.x,t.y));const component=connected(tiles,open.find(t=>t.x<=2&&t.y>=5)??open[0],authored.props);
 const reserved=new Set(),choose=(preferred,side)=>{
   const candidates=open.filter(t=>component.has(key(t))&&!reserved.has(key(t)));
   candidates.sort((a,b)=>{
     const da=Math.abs(a.x-preferred.x)+Math.abs(a.y-preferred.y),db=Math.abs(b.x-preferred.x)+Math.abs(b.y-preferred.y);
     return da-db||(side==='player'?a.x-b.x:b.x-a.x)||a.y-b.y;
   });
   if(!candidates.length)throw Error('El mapa no tiene posiciones de despliegue suficientes.');
   reserved.add(key(candidates[0]));return{x:candidates[0].x,y:candidates[0].y};
 };
 const squad=(request.squad??[]).map((op,i)=>({...clone(op),...choose({x:id==='san_lorenzo'?2:1,y:id==='san_lorenzo'?(i%2===0?2:12)+Math.floor(i/2):4+i},'player')}));
 const enemyCount=request.enemies?.length??Math.max(3,squad.length+(request.difficulty??1)-1);
 const enemies=Array.from({length:enemyCount},(_,i)=>({id:`enemy-${i}`,name:`Soldado realista ${i+1}`,weapon:i%3===0?1801:1800,marksmanship:50+(request.difficulty??1)*5,morale:60+(request.difficulty??1)*5,...clone(request.enemies?.[i]??{}),...choose({x:id==='santa_fe'?15:id==='san_lorenzo'?15:17,y:3+i%10},'enemy')}));
 const artillery=(request.artillery??Array.from({length:Math.min(request.cannons??0,3)},()=>({type:'bronze4',side:'player',loaded:true,ammo:6}))).map((gun,i)=>({...clone(gun),...choose({x:3,y:4+i*3},'player')}));
 return {...clone(request),sector:request.sceneId?request.sector:id,name:request.name??names[id],width:WIDTH,height:HEIGHT,tiles,decor:authored.decor,props:authored.props,groundItems:authored.groundItems,sourceMapId:authored.sourceMapId,sourceMapRevision:authored.sourceMapRevision,buildings:authored.buildings,lights:authored.lights,squad,enemies,artillery,mapTitle:names[id]};
}

export function buildSectorMap(request={}){const core=buildCompactSectorMap(request);return request.compactLayout===true?core:expandSectorMap(core);}
