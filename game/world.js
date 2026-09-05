import {buildSectorMap} from './maps.js';
import {createBattle} from './tactical.js';

// Re-enter a persistent sector with the current squad, retaining terrain and ground gear.
export function enterSector(request,previous=null){
 const map=buildSectorMap(request);
 if(previous){
   map.tiles=structuredClone(previous.tiles);map.decor=structuredClone(previous.decor??map.decor);
   // A new occupation creates a garrison. An unfinished engagement retains its survivors.
   if(!request.exploration&&!previous.sectorCleared)map.enemies=structuredClone(previous.units.filter(u=>u.side==='enemy'));
 }
 const state=createBattle(map.squad,map);
 if(previous){
   for(const key of ['groundItems','droppedWeapons','lights'])state[key]=structuredClone(previous[key]??[]);
   if(!request.exploration&&!previous.sectorCleared)state.units=state.units.filter(u=>u.side==='player').concat(structuredClone(previous.units.filter(u=>u.side==='enemy')));
 }
 const occupied=new Set(state.units.filter(u=>u.side==='enemy'&&u.hp>0&&!u.routed).map(u=>`${u.x},${u.y}`));
 const reserve=(preferred)=>{
   const candidates=state.tiles.filter(t=>!t.blocked&&!occupied.has(`${t.x},${t.y}`));
   candidates.sort((a,b)=>Math.abs(a.x-preferred.x)+Math.abs(a.y-preferred.y)-Math.abs(b.x-preferred.x)-Math.abs(b.y-preferred.y)||a.y-b.y||a.x-b.x);
   if(!candidates[0])throw Error('No queda espacio libre para entrar en el sector.');
   const {x,y}=candidates[0];occupied.add(`${x},${y}`);return{x,y};
 };
 for(const unit of state.units.filter(u=>u.side==='player')){
   const prior=previous?.units.find(v=>v.side==='player'&&v.id===unit.id);
   Object.assign(unit,reserve(prior??unit));
 }
 state.npcs=(request.npcs??[]).map(npc=>({...structuredClone(npc),...reserve(npc)}));
 state.enteredHour=request.hour??0;
 return state;
}
