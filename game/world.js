import {militiaArrivalTerrain} from './militia-arrival.js';
import {seedCivilianHealth} from './civilian-health.js';
import {sectorCash} from './economy.js';
import {propBlocksAt} from './props.js';
import {buildSectorMap} from './maps.js';
import {createBattle} from './tactical.js';
import {worldCell} from './world-cells.js';
import {expandCellScene} from './cell-scene-storage.js';
import {retainedMilitaryBodies} from './military-remains.js';

// Re-enter a persistent sector with the current squad, retaining terrain and ground gear.
export function enterSector(request,previous=null){
 previous=expandCellScene(previous);
 if(previous&&worldCell(request.sector)?.anchor===false&&(previous.sectorId!==request.sector||previous.sourceMapId!==request.sector))throw Error('La escena guardada pertenece a otra celda.');
 const map=buildSectorMap({...request,compactLayout:previous?previous.width===20&&previous.height===16:request.compactLayout});
 if(previous){
   map.width=previous.width;map.height=previous.height;
   for(const key of ['sourceMapId','sourceMapRevision']){if(previous[key]!==undefined)map[key]=previous[key];else delete map[key];}
   map.props=structuredClone(previous.props??map.props);map.tiles=structuredClone(previous.tiles);map.decor=structuredClone(previous.decor??map.decor);map.buildings=structuredClone(previous.buildings??map.buildings);
   // A new occupation creates a garrison. An unfinished engagement retains its survivors.
   if(!request.exploration&&!previous.sectorCleared)map.enemies=structuredClone(previous.units.filter(u=>u.side==='enemy'));
 }
 // Restore stationed full-map coordinates after template placement and scaling.
 const stationed=(request.artillery??[]).filter(g=>g.stationed),reserved=new Set(stationed.map(g=>`${g.x},${g.y}`));
 map.artillery=map.artillery.map(gun=>{
  const old=stationed.find(g=>g.id===gun.id);if(old)return structuredClone(old);
  const candidates=map.tiles.filter(t=>!t.blocked&&!t.buildingId&&t.type!=='water'&&!propBlocksAt(map,t.x,t.y)&&!reserved.has(`${t.x},${t.y}`));
  candidates.sort((a,b)=>Math.abs(a.x-gun.x)+Math.abs(a.y-gun.y)-Math.abs(b.x-gun.x)-Math.abs(b.y-gun.y)||a.y-b.y||a.x-b.x);if(!candidates.length)throw Error('No queda espacio para la artillería.');
  const {x,y}=candidates[0];reserved.add(`${x},${y}`);return {...gun,x,y};
 });
 const state=createBattle([...map.squad,...(map.garrison??[]),...(map.missionAllies??[])],map);
 if(previous){
   for(const unit of state.units.filter(u=>u.side==='player'&&u.hp>0)){const old=previous.units.find(u=>u.id===unit.id&&u.side==='player');for(const key of ['practiceTiles','ridingPracticeTiles'])if(old?.[key])unit[key]=structuredClone(old[key]);}
   for(const key of ['groundItems','droppedWeapons','revealedRooms'])state[key]=structuredClone(previous[key]??[]);
   const elapsed=Math.max(0,(request.hour??0)-(previous.savedHour??previous.enteredHour??request.hour??0));
   // One strategic hour advances six ten-minute tactical light intervals.
   const elapsedSeconds=Math.max(0,elapsed*3600+(request.secondOfHour??0)-(previous.savedSecond??0));const ticks=Math.floor(elapsedSeconds/600);
   state.lights=structuredClone(previous.lights??map.lights??[]).map(light=>Number.isFinite(light.turns)?{...light,remainingSeconds:Math.max(0,(light.remainingSeconds??light.turns*600)-elapsedSeconds),turns:Math.max(0,Math.ceil(((light.remainingSeconds??light.turns*600)-elapsedSeconds)/600)),age:(light.age||0)+ticks}:light).filter(light=>light.turns!==0);
   if(!request.exploration&&!previous.sectorCleared)state.units=state.units.filter(u=>u.side==='player').concat(structuredClone(previous.units.filter(u=>u.side==='enemy')));
 }
 for(const body of retainedMilitaryBodies(previous,state.units,request.sector))if(!state.units.some(u=>u.id===body.id))state.units.push(body);
 const occupied=new Set(state.units.filter(u=>u.side==='enemy'&&u.hp>0&&!u.routed).map(u=>`${u.x},${u.y}`));
 const reserve=(preferred,terrain=state.tiles,ordered=false)=>{
   const candidates=terrain.filter(t=>!t.blocked&&!propBlocksAt(state,t.x,t.y)&&!occupied.has(`${t.x},${t.y}`));
   if(!ordered)candidates.sort((a,b)=>Math.abs(a.x-preferred.x)+Math.abs(a.y-preferred.y)-Math.abs(b.x-preferred.x)-Math.abs(b.y-preferred.y)||a.y-b.y||a.x-b.x);
   if(!candidates[0])throw Error('No queda espacio libre para entrar en el sector.');
   const {x,y}=candidates[0];occupied.add(`${x},${y}`);return{x,y};
 };
 const arrivalAreas=new Map();
 for(const unit of state.units.filter(u=>u.side==='player'&&u.hp>0)){
   if(unit.militiaArrival){
     const route=`${unit.militiaArrival.from}:${unit.militiaArrival.to}`;
     if(!arrivalAreas.has(route))arrivalAreas.set(route,militiaArrivalTerrain(state,unit));
     const arrival=arrivalAreas.get(route);Object.assign(unit,reserve(arrival.anchor,arrival.cells,true));delete unit.militiaArrival;continue;
   }
   const prior=previous?.units.find(v=>v.side==='player'&&v.id===unit.id);
   Object.assign(unit,reserve(prior??unit));
 }
 state.npcs=(map.npcs??[]).map(npc=>{
   const old=previous?.npcs?.find(n=>n.id===npc.id&&n.presenceRevision===npc.presenceRevision),resident=structuredClone({...npc,...old});
   if(npc.civilianHealthVersion===1){for(const k of ['civilianHealthVersion','maxHp','hp','energy','unconscious','civilianWoundVersion','civilianWoundSeconds','bleeding','bandaged','bleedSource','civilianHarm','civilianFirstAid']){delete resident[k];if(npc[k]!==undefined)resident[k]=structuredClone(npc[k]);}}
   else Object.assign(resident,seedCivilianHealth(resident,{maxHp:resident.maxHp??100,hp:resident.hp??100,energy:resident.energy??100}));
   if(resident.ai){delete resident.ai.threat;delete resident.ai.safeAfter;resident.ai.activity='roaming';}
   delete resident.lastMovePath;resident.stance=resident.hp===0||resident.unconscious?'prone':'standing';resident.movementMode=resident.stance==='prone'?'prone':'walk';
   return resident.hp===0?resident:{...resident,...reserve(resident)};
 });

 if(!previous&&!request.sceneId&&sectorCash(request.sector)){
  const leader=state.units.find(u=>u.side==='player'),spot=leader&&state.tiles.find(t=>!t.blocked&&!propBlocksAt(state,t.x,t.y)&&!occupied.has(`${t.x},${t.y}`)&&Math.abs(t.x-leader.x)+Math.abs(t.y-leader.y)===1);
  if(spot)state.groundItems.push({id:`cash:${request.sector}`,type:'money',x:spot.x,y:spot.y,count:sectorCash(request.sector)});
 }
 state.sceneId=request.sceneId??null;state.missionId=request.missionId??request.sceneId??null;
 state.enteredHour=request.hour??0;
 return state;
}
