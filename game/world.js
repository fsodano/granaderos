import {spaceKey,surfacesAtLevel,tacticalLevel,validateTacticalSpace} from './tactical-space.js';
import {physicalEntryAnchor} from './sector-expansion.js';
import {authoredEnvironment} from './environment-interactions.js';
import {propBlocksAt} from './props.js';
import {buildSectorMap} from './maps.js';
import {createBattle,initializeBattlePerception,movementStepCost} from './tactical.js';
import {boundaryMatches,inwardFromBoundary,validEntry,validateSectorExits} from './tactical-exits.js';
import {validateBattleSnapshot} from './validate-battle.js';
import {validateQuestGifts} from './quests.js';

const key=spaceKey;
const clearEncounter=unit=>{
 for(const field of ['lastKnownEnemy','lastHeardNoise','lastTargetId','lastShotPosition','patrolTurn','lastInvestigatedTurn'])delete unit[field];
 for(const field of ['reactionTurn','reactionSpent','interceptTurn','parryTurn','counterTurn','braceTurn'])unit[field]=0;
 return unit;
};
const sourceRecord=(previous,unit,sector)=>{
 if(unit.departure)return false;
 const entry=previous?.returnLedger?.entries?.find(e=>e.unitId===unit.id);
 const owner=sector==='san_lorenzo'?'san_nicolas':sector;
 return !entry||entry.sector===owner&&['resident','dead'].includes(entry.kind);
};

// Buildings cannot become an arrival fallback. The largest exterior component
// is the authored road network on these schematic maps, including saved breaches.
function exteriorComponent(state,unit){
 const open=state.tiles.filter(t=>!t.blocked&&!t.buildingId&&!propBlocksAt(state,t.x,t.y)),available=new Map(open.map(t=>[key(t),t])),seen=new Set();let largest=new Set();
 for(const start of open){
  if(seen.has(key(start)))continue;
  const component=new Set([key(start)]),queue=[start];seen.add(key(start));
  for(let i=0;i<queue.length;i++)for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
   const next=available.get(key({x:queue[i].x+dx,y:queue[i].y+dy}));
   if(next&&!seen.has(key(next))&&Number.isFinite(movementStepCost(state,unit,queue[i],next))){seen.add(key(next));component.add(key(next));queue.push(next);}
  }
  if(component.size>largest.size)largest=component;
 }
 return largest;
}

// Re-enter a persistent sector with the current squad, retaining terrain and ground gear.
export function enterSector(request,previous=null){
 if(request.exits!==undefined&&!validateSectorExits(request.sector,request.sceneId??null,request.exits))throw Error('Las salidas no corresponden a este sector.');
 if(previous)validateTacticalSpace(previous);
 const map=buildSectorMap({...request,compactLayout:previous?previous.width===20&&previous.height===16:request.compactLayout},{restorePrevious:Boolean(previous)});
 if(!previous){
   const metadata=authoredEnvironment(request.sceneId??request.sector,map);
   for(const patch of metadata.doors){const door=map.tiles.find(t=>t.doorId===patch.id);if(door)Object.assign(door,patch,{blocked:!patch.open,blocksSight:!patch.open});}
   for(const patch of metadata.containers){const chest=map.props.find(p=>p.id===patch.id);if(chest)Object.assign(chest,patch);}
 }
 if(previous){
   map.width=previous.width;map.height=previous.height;
   map.props=structuredClone(previous.props??map.props);map.tiles=structuredClone(previous.tiles);map.decor=structuredClone(previous.decor??map.decor);map.buildings=structuredClone(previous.buildings??map.buildings);
   for(const field of ['upperSurfaces','climbLinks'])if(previous[field]!==undefined)map[field]=structuredClone(previous[field]);else delete map[field];
   // A new occupation creates a garrison. An unfinished engagement retains its survivors.
   if(!request.defenseGroupId&&!request.occupationGroupIds?.length&&!request.exploration&&!previous.sectorCleared)map.enemies=structuredClone(previous.units.filter(u=>u.side==='enemy'&&!u.departure)).map(clearEncounter);
 }
 // Stationed artillery keeps coordinates from the saved full-size map. Apply
 // them after map expansion; otherwise each reentry scales its position again.
 const stationed=(request.artillery??[]).filter(g=>g.stationed),occupiedGuns=new Set(stationed.map(key));
 map.artillery=map.artillery.map(gun=>{
   const old=stationed.find(g=>g.id===gun.id);if(old)return structuredClone(old);
   if(occupiedGuns.has(key(gun))){const open=map.tiles.filter(t=>!t.blocked&&!propBlocksAt(map,t.x,t.y)&&!occupiedGuns.has(key(t)));open.sort((a,b)=>Math.abs(a.x-gun.x)+Math.abs(a.y-gun.y)-Math.abs(b.x-gun.x)-Math.abs(b.y-gun.y)||a.y-b.y||a.x-b.x);if(!open.length)throw Error('No queda espacio para desplegar la pieza.');gun={...gun,x:open[0].x,y:open[0].y};}
   occupiedGuns.add(key(gun));return gun;
 });
 // Deployment intent does not establish contact. Resolve sight only after final placement.
 const state=createBattle([...map.squad,...(map.garrison??[]),...(map.missionAllies??[])],{...map,exploration:true,deferContact:true});
 for(const field of ['upperSurfaces','climbLinks'])if(map[field]!==undefined)state[field]=structuredClone(map[field]);
 if(previous){
   for(const unit of state.units.filter(u=>u.side==='player'&&u.hp>0)){const old=previous.units.find(u=>u.id===unit.id&&u.side==='player');for(const key of ['practiceTiles','ridingPracticeTiles'])if(old?.[key])unit[key]=structuredClone(old[key]);}
   for(const key of ['groundItems','droppedWeapons','revealedRooms'])state[key]=structuredClone(previous[key]??[]);
   const elapsed=Math.max(0,(request.hour??0)-(previous.savedHour??previous.enteredHour??request.hour??0));
   // One strategic hour advances six ten-minute tactical light intervals.
   const elapsedSeconds=Math.max(0,elapsed*3600+(request.secondOfHour??0)-(previous.savedSecond??0));const ticks=Math.floor(elapsedSeconds/600);
   state.lights=structuredClone(previous.lights??map.lights??[]).map(light=>Number.isFinite(light.turns)?{...light,remainingSeconds:Math.max(0,(light.remainingSeconds??light.turns*600)-elapsedSeconds),turns:Math.max(0,Math.ceil(((light.remainingSeconds??light.turns*600)-elapsedSeconds)/600)),age:(light.age||0)+ticks}:light).filter(light=>light.turns!==0);
   // createBattle has normalized the retained enemy conditions and new turn budget.
 }
 if(previous)for(const raw of previous.units.filter(u=>u.hp<=0&&sourceRecord(previous,u,request.sector))){
   const existing=state.units.find(u=>u.id===raw.id);
   if(existing?.hp<=0)continue;
   // A fresh enemy garrison may reuse enemy-0; its earlier corpse remains lootable.
   if(existing&&raw.side!=='enemy')throw Error('Un soldado fallecido no puede volver a entrar vivo.');
   const corpse=clearEncounter(structuredClone(raw));
   if(existing){corpse.originalUnitId=corpse.id;corpse.id=`corpse:${previous.battleId??request.sector}:${corpse.id}`;let suffix=1;const base=corpse.id;while(state.units.some(u=>u.id===corpse.id)||previous.units.some(u=>u.id===corpse.id))corpse.id=`${base}:${suffix++}`;}
   state.units.push(corpse);
 }
 const queued=[];const remainsIds=new Set();
 for(const record of request.remains??[]){
   if(!record||typeof record.battleId!=='string'||typeof record.unitId!=='string'||!record.unit||record.unit.id!==record.unitId||record.unit.hp!==0||record.unit.side!=='player'||remainsIds.has(record.unitId))throw Error('Los restos pendientes no son válidos.');
   remainsIds.add(record.unitId);
   const existing=state.units.find(u=>u.id===record.unitId);
   if(existing){if(existing.hp>0)throw Error('El soldado figura vivo y entre los restos pendientes.');continue;}
   const corpse=clearEncounter(structuredClone(record.unit));delete corpse.departure;
   const arrival=record.entryEdge?record:corpse.arrival??record.arrival;
   corpse.entryReason='arrival';corpse.entryEdge=arrival?.entryEdge??corpse.entryEdge;corpse.entryAnchor=arrival?.entryAnchor??corpse.entryAnchor;
   queued.push(corpse);state.units.push(corpse);
 }
 const occupied=new Set(state.units.filter(u=>u.side==='enemy'||u.hp<=0&&!queued.includes(u)).map(key));
 const reserve=(preferred)=>{
   const level=tacticalLevel(preferred),candidates=surfacesAtLevel(state,level).filter(t=>!t.blocked&&!propBlocksAt(state,t.x,t.y,level)&&!occupied.has(key(t)));
   candidates.sort((a,b)=>Math.abs(a.x-preferred.x)+Math.abs(a.y-preferred.y)-Math.abs(b.x-preferred.x)-Math.abs(b.y-preferred.y)||a.y-b.y||a.x-b.x);
   if(!candidates[0])throw Error('No queda espacio libre para entrar en el sector.');
   const {x,y}=candidates[0];occupied.add(key(candidates[0]));return{x,y,...(preferred.tacticalLevel===undefined&&level===0?{}:{tacticalLevel:level})};
 };
 // Keep residents and their routines when the squad returns. Rebase temporary
 // fear reports to the new encounter clock; recruitment still controls presence.
 const residents=[...(map.npcs??[])];
 // Combat requests can omit a civilian roster. A delivered object still has
 // its original local owner; saved coordinates already belong to the full map.
 // Explicit rosters control presence, especially after named recruitment.
 if(request.npcs===undefined)for(const npc of previous?.npcs??[]){
   if(npc.operativeId!==undefined||!npc.questGifts?.length||residents.some(current=>current.id===npc.id))continue;
   if(validateQuestGifts(npc).length)residents.push(structuredClone(npc));
 }
 state.npcs=residents.map(npc=>{
   const old=previous?.npcs?.find(n=>n.id===npc.id),authored=state.npcs.find(n=>n.id===npc.id),resident=structuredClone({...npc,...authored,...old});
   if(resident.ai){delete resident.ai.threat;delete resident.ai.safeAfter;resident.ai.activity='roaming';}
   delete resident.lastMovePath;resident.stance='standing';resident.movementMode='walk';
   return {...resident,...reserve(resident)};
 });
 const arriving=[];
 for(const unit of state.units.filter(u=>u.side==='player'&&(u.hp>0||queued.includes(u)))){
   if(unit.entryReason!==undefined&&!['arrival','resident'].includes(unit.entryReason))throw Error('El motivo de entrada no es válido.');
   if(unit.entryReason==='arrival'){
     if(unit.tacticalLevel!==undefined)unit.tacticalLevel=0;
     if(!validEntry(unit.entryEdge,unit.entryAnchor))throw Error('La entrada necesita un borde y una posición válidos.');
     arriving.push(unit);continue;
   }
   if(unit.entryEdge!==undefined||unit.entryAnchor!==undefined)throw Error('La posición de entrada necesita un traslado explícito.');
   const prior=unit.entryReason==='resident'?previous?.units.find(v=>v.side==='player'&&v.id===unit.id&&sourceRecord(previous,v,request.sector)):null;
   Object.assign(unit,reserve(prior??unit));
 }
 if(arriving.length){
   const component=exteriorComponent(state,arriving[0]);
   for(const unit of arriving){
     const anchor=physicalEntryAnchor(unit.entryEdge,unit.entryAnchor,state.width,state.height,state.sceneId??state.sectorId);
     const candidates=state.tiles.filter(t=>boundaryMatches(state,t,unit.entryEdge)&&component.has(key(t))&&!occupied.has(key(t))&&Number.isFinite(movementStepCost(state,unit,t,inwardFromBoundary(t,unit.entryEdge))));
     candidates.sort((a,b)=>Math.abs(a.x-anchor.x)+Math.abs(a.y-anchor.y)-Math.abs(b.x-anchor.x)-Math.abs(b.y-anchor.y)||(a.type==='road'?0:1)-(b.type==='road'?0:1)||a.y-b.y||a.x-b.x);
     if(!candidates.length)throw Error('No queda espacio en el borde de entrada. La llegada sigue pendiente.');
     Object.assign(unit,{x:candidates[0].x,y:candidates[0].y});
     if(unit.hp>0)unit.facing={N:4,E:6,S:0,W:2}[unit.entryEdge];
     occupied.add(key(unit));
   }
 }
 if(request.defenseGroupId&&request.defenseFort>0)for(const unit of state.units.filter(u=>u.side==='player'&&u.hp>0)){const tile=state.tiles.find(t=>t.x===unit.x&&t.y===unit.y);tile.cover=Math.max(tile.cover??0,Math.min(3,request.defenseFort)*10);}
 state.sceneId=request.sceneId??null;state.missionId=request.missionId??request.sceneId??null;
 state.enteredHour=request.hour??0;
 return initializeBattlePerception(validateBattleSnapshot(state));
}
