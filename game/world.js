import {sectorCash} from './economy.js';
import {propBlocksAt} from './props.js';
import {buildSectorMap} from './maps.js';
import {createBattle} from './tactical.js';

// Re-enter a persistent sector with the current squad, retaining terrain and ground gear.
export function enterSector(request,previous=null){
 const map=buildSectorMap({...request,compactLayout:previous?previous.width===20&&previous.height===16:request.compactLayout});
 if(previous){
   map.width=previous.width;map.height=previous.height;
   for(const key of ['sourceMapId','sourceMapRevision']){if(previous[key]!==undefined)map[key]=previous[key];else delete map[key];}
   map.props=structuredClone(previous.props??map.props);map.tiles=structuredClone(previous.tiles);map.decor=structuredClone(previous.decor??map.decor);map.buildings=structuredClone(previous.buildings??map.buildings);
   // A new occupation creates a garrison. An unfinished engagement retains its survivors.
   if(!request.exploration&&!previous.sectorCleared)map.enemies=structuredClone(previous.units.filter(u=>u.side==='enemy'));
 }
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
 if(previous)state.units.push(...structuredClone(previous.units.filter(u=>u.militia&&u.hp<=0&&!state.units.some(v=>v.id===u.id))));
 const occupied=new Set(state.units.filter(u=>u.side==='enemy'&&u.hp>0&&!u.routed).map(u=>`${u.x},${u.y}`));
 const reserve=(preferred)=>{
   const candidates=state.tiles.filter(t=>!t.blocked&&!propBlocksAt(state,t.x,t.y)&&!occupied.has(`${t.x},${t.y}`));
   candidates.sort((a,b)=>Math.abs(a.x-preferred.x)+Math.abs(a.y-preferred.y)-Math.abs(b.x-preferred.x)-Math.abs(b.y-preferred.y)||a.y-b.y||a.x-b.x);
   if(!candidates[0])throw Error('No queda espacio libre para entrar en el sector.');
   const {x,y}=candidates[0];occupied.add(`${x},${y}`);return{x,y};
 };
 for(const unit of state.units.filter(u=>u.side==='player'&&u.hp>0)){
   const prior=previous?.units.find(v=>v.side==='player'&&v.id===unit.id);
   Object.assign(unit,reserve(prior??unit));
 }
 state.npcs=(map.npcs??[]).map(npc=>({...structuredClone(npc),...reserve(npc)}));
 if(!previous&&!request.sceneId&&sectorCash(request.sector)){
  const leader=state.units.find(u=>u.side==='player'),spot=leader&&state.tiles.find(t=>!t.blocked&&!propBlocksAt(state,t.x,t.y)&&!occupied.has(`${t.x},${t.y}`)&&Math.abs(t.x-leader.x)+Math.abs(t.y-leader.y)===1);
  if(spot)state.groundItems.push({id:`cash:${request.sector}`,type:'money',x:spot.x,y:spot.y,count:sectorCash(request.sector)});
 }
 state.sceneId=request.sceneId??null;state.missionId=request.missionId??request.sceneId??null;
 state.enteredHour=request.hour??0;
 return state;
}
