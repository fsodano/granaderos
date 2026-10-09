import {validateQuestWithdrawals} from './quest-withdrawal.js';
import {militiaArrivalTerrain} from './militia-arrival.js';
import {revealFiniteArsenal} from './finite-artillery-arsenals.js';
import {placeInvaders} from './invader-entry.js';
import {sectorCash} from './economy.js';
import {worldCell} from './world-cells.js';
import {expandCellScene} from './cell-scene-storage.js';
import {retainedMilitaryBodies} from './military-remains.js';
import {placeDetainedPrisoners} from './detention.js';
import {exteriorComponent,entryTerrainCells} from './sector-entry.js';
import {beginSectorDeployment} from './sector-deployment.js';
import {spaceKey,surfacesAtLevel,tacticalLevel,validateTacticalSpace} from './tactical-space.js';
import {physicalEntryAnchor} from './sector-expansion.js';
import {authoredEnvironment} from './environment-interactions.js';
import {propBlocksAt} from './props.js';
import {buildSectorMap} from './maps.js';
import {createBattle,initializeBattlePerception} from './tactical.js';
import {validEntry,validateSectorExits} from './tactical-exits.js';
import {validateBattleSnapshot} from './validate-battle.js';
import {validateQuestGifts} from './quests.js';
import {validateQuestBeneficiaries,validateQuestBeneficiaryContext} from './quest-beneficiaries.js';
import {migrateCivilianHealth,civilianMaxHp} from './civilian-health.js';
import {civilianIncidents} from './civilian-harm.js';
import {issueConductObservers} from './service-objections.js';

const key=spaceKey;
const clearEncounter=unit=>{
 for(const field of ['lastKnownEnemy','lastHeardNoise','lastTargetId','lastShotPosition','patrolTurn','lastInvestigatedTurn','nervousIsolationWarned','enclosedRoomFearWarned'])delete unit[field];
 for(const field of ['reactionTurn','reactionSpent','interceptTurn','parryTurn','counterTurn','braceTurn'])unit[field]=0;
 return unit;
};
const sourceRecord=(previous,unit,sector)=>{
 if(unit.departure)return false;
 const entry=previous?.returnLedger?.entries?.find(e=>e.unitId===unit.id);
 const owner=sector==='san_lorenzo'?'san_nicolas':sector;
 return !entry||entry.sector===owner&&['resident','dead'].includes(entry.kind);
};

// Re-enter a persistent sector with the current squad, retaining terrain and ground gear.
export function enterSector(request,previous=null,{placement=false}={}){
 previous=expandCellScene(previous);
 if(previous&&worldCell(request.sector)?.anchor===false&&(previous.sectorId!==request.sector||previous.sourceMapId!==request.sector))throw Error('La escena guardada pertenece a otra celda.');
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
   for(const field of ['sourceMapId','sourceMapRevision']){if(previous[field]!==undefined)map[field]=previous[field];else delete map[field];}
   // Missing rural props never backfill a newly authored cache. Keep the
   // existing legacy landmark fallback for maps outside physical world cells.
   map.props=structuredClone(previous.props??(map.worldCell?[]:map.props));map.tiles=structuredClone(previous.tiles);map.decor=structuredClone(previous.decor??map.decor);map.buildings=structuredClone(previous.buildings??map.buildings);
   for(const field of ['upperSurfaces','climbLinks'])if(previous[field]!==undefined)map[field]=structuredClone(previous[field]);else delete map[field];
   // A new occupation creates a garrison. An unfinished engagement retains its survivors.
   if(!request.defenseGroupId&&!request.occupationGroupIds?.length&&!request.exploration&&!previous.sectorCleared)map.enemies=structuredClone(previous.units.filter(u=>u.side==='enemy'&&!u.departure)).map(clearEncounter);
 }
 // Stationed artillery keeps coordinates from the saved full-size map. Apply
 // them after map expansion; otherwise each reentry scales its position again.
 const stationed=(request.artillery??[]).filter(g=>g.stationed),occupiedGuns=new Set(stationed.map(key));
 map.artillery=map.artillery.map(gun=>{
   const old=stationed.find(g=>g.id===gun.id);if(old)return structuredClone(old);
   if(occupiedGuns.has(key(gun))||!map.tiles.some(t=>t.x===gun.x&&t.y===gun.y&&!t.blocked&&!t.buildingId&&t.type!=='water'&&!propBlocksAt(map,t.x,t.y))){const open=map.tiles.filter(t=>!t.blocked&&!t.buildingId&&t.type!=='water'&&!propBlocksAt(map,t.x,t.y)&&!occupiedGuns.has(key(t)));open.sort((a,b)=>Math.abs(a.x-gun.x)+Math.abs(a.y-gun.y)-Math.abs(b.x-gun.x)-Math.abs(b.y-gun.y)||a.y-b.y||a.x-b.x);if(!open.length)throw Error('No queda espacio para desplegar la pieza.');gun={...gun,x:open[0].x,y:open[0].y};}
   occupiedGuns.add(key(gun));return gun;
 });
 // Deployment intent does not establish contact. Resolve sight only after final placement.
 let state=createBattle([...map.squad,...(map.garrison??[]),...(map.missionAllies??[])],{...map,exploration:true,deferContact:true});
 // Only the owned issued squad carries this service consequence. Auxiliary
 // actors and retained bodies do not gain authority from scene membership.
 delete state.conductObserverIds;Object.assign(state,issueConductObservers(request.squad??[]));
 if(request.errandDefinitions!==undefined)state.errandDefinitions=structuredClone(request.errandDefinitions);
 if(request.questWithdrawals!==undefined)state.questWithdrawals=structuredClone(request.questWithdrawals);else delete state.questWithdrawals;
 validateQuestWithdrawals(state.questWithdrawals,state);
 if(request.questBeneficiaries!==undefined)state.questBeneficiaries=structuredClone(request.questBeneficiaries);
 validateQuestBeneficiaries(state.questBeneficiaries,state);
 if(request.roadsideDiscoveryDefinitions!==undefined)state.roadsideDiscoveryDefinitions=structuredClone(request.roadsideDiscoveryDefinitions);
 // Retained garrisons also start a new encounter clock. Their wounds and gear
 // persist, but remembered targets and reaction counters belong to the old visit.
 for(const unit of state.units)clearEncounter(unit);
 for(const field of ['upperSurfaces','climbLinks'])if(map[field]!==undefined)state[field]=structuredClone(map[field]);
 if(previous){
   // Tile histories belong to this sector. The person's practice RNG comes
   // from the current request and can have advanced in another sector.
   for(const unit of state.units.filter(u=>u.side==='player'&&u.hp>0)){const old=previous.units.find(u=>u.id===unit.id&&u.side==='player');for(const key of ['practiceTiles','ridingPracticeTiles'])if(old?.[key]!==undefined)unit[key]=structuredClone(old[key]);}
   for(const key of ['groundItems','droppedWeapons','revealedRooms'])state[key]=structuredClone(previous[key]??[]);
   const elapsed=Math.max(0,(request.hour??0)-(previous.savedHour??previous.enteredHour??request.hour??0));
   // One strategic hour advances six ten-minute tactical light intervals.
   const elapsedSeconds=Math.max(0,elapsed*3600+(request.secondOfHour??0)-(previous.savedSecond??0));const ticks=Math.floor(elapsedSeconds/600);
   state.lights=structuredClone(previous.lights??map.lights??[]).map(light=>Number.isFinite(light.turns)?{...light,remainingSeconds:Math.max(0,(light.remainingSeconds??light.turns*600)-elapsedSeconds),turns:Math.max(0,Math.ceil(((light.remainingSeconds??light.turns*600)-elapsedSeconds)/600)),age:(light.age||0)+ticks}:light).filter(light=>light.turns!==0);
   // createBattle has normalized the retained enemy conditions and new turn budget.
 }
 if(previous)for(const raw of retainedMilitaryBodies({...previous,units:previous.units.filter(u=>sourceRecord(previous,u,request.sector))},state.units,request.sector)){
   if(!state.units.some(u=>u.id===raw.id)){const retained=clearEncounter(raw);delete retained.griefCompanionIds;state.units.push(retained);}
 }
 const queued=[];const remainsIds=new Set();
 for(const record of request.remains??[]){
   if(!record||typeof record.battleId!=='string'||typeof record.unitId!=='string'||!record.unit||record.unit.id!==record.unitId||record.unit.hp!==0||record.unit.side!=='player'||remainsIds.has(record.unitId))throw Error('Los restos pendientes no son válidos.');
   remainsIds.add(record.unitId);
   const existing=state.units.find(u=>u.id===record.unitId);
   if(existing){if(existing.hp>0)throw Error('El soldado figura vivo y entre los restos pendientes.');continue;}
   const corpse=clearEncounter(structuredClone(record.unit));delete corpse.departure;delete corpse.griefCompanionIds;
   // Arrival relocates this clone to another field. The original record and
   // source scene retain its departure route; those paths are not movements
   // on the destination terrain.
   delete corpse.lastMovePath;delete corpse.fleePath;
   const arrival=record.entryEdge?record:corpse.arrival??record.arrival;
   corpse.entryReason='arrival';corpse.entryEdge=arrival?.entryEdge??corpse.entryEdge;corpse.entryAnchor=arrival?.entryAnchor??corpse.entryAnchor;
   queued.push(corpse);state.units.push(corpse);
 }
 const issuedEnemies=new Set(map.enemies.map(u=>String(u.id)));
 const invaders=request.defenseGroupId?state.units.filter(u=>u.side==='enemy'&&u.hp>0&&!u.departure&&!u.fled&&issuedEnemies.has(u.id)):[];
 const arrivingEnemyIds=new Set(invaders.map(u=>u.id));
 const occupied=new Set(state.units.filter(u=>u.side==='enemy'&&u.hp>0&&!u.departure&&!u.fled&&!arrivingEnemyIds.has(u.id)).map(key));
 const reserve=(preferred,terrain=null,ordered=false)=>{
   const level=tacticalLevel(preferred),candidates=(terrain??surfacesAtLevel(state,level)).filter(t=>!t.blocked&&!propBlocksAt(state,t.x,t.y,level)&&!occupied.has(key(t)));
   if(!ordered)candidates.sort((a,b)=>Math.abs(a.x-preferred.x)+Math.abs(a.y-preferred.y)-Math.abs(b.x-preferred.x)-Math.abs(b.y-preferred.y)||a.y-b.y||a.x-b.x);
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
   if(npc.detention||residents.some(current=>current.id===npc.id))continue;
   const harmed=(civilianIncidents(npc).length>0||(npc.hp??civilianMaxHp(npc))<civilianMaxHp(npc)||(npc.energy??100)<100||npc.bleeding>0)&&!state.units.some(unit=>unit.side==='player'&&npc.operativeId!==undefined&&Number(unit.id)===npc.operativeId);
   if(harmed||npc.escort||(npc.operativeId===undefined||npc.recruitable===false)&&npc.questGifts?.length&&validateQuestGifts(npc,state).length)residents.push(structuredClone(npc));
 }
 state.npcs=residents.map(npc=>{
   const old=previous?.npcs?.find(n=>n.id===npc.id&&n.presenceRevision===npc.presenceRevision),authored=state.npcs.find(n=>n.id===npc.id),resident=structuredClone({...npc,...authored,...old});
   if(npc.civilianHealthVersion===1){
     for(const field of ['civilianHealthVersion','maxHp','hp','energy','unconscious','civilianWoundVersion','civilianWoundSeconds','bleeding','bandaged','bleedSource','civilianHarm','civilianFirstAid','civilianSupplies','civilianWeapons']){
       delete resident[field];if(npc[field]!==undefined)resident[field]=structuredClone(npc[field]);
     }
   }else if(old&&npc.operativeId!==undefined&&old.civilianHealthVersion===undefined)Object.assign(resident,migrateCivilianHealth(structuredClone(old),npc));
   if(resident.ai){delete resident.ai.threat;delete resident.ai.safeAfter;resident.ai.activity='roaming';}
   delete resident.lastMovePath;
   const incapacitated=(resident.hp??100)<=0||resident.unconscious;
   resident.stance=incapacitated?'prone':'standing';resident.movementMode=incapacitated?'prone':'walk';
   return resident.hp===0?resident:{...resident,...reserve(resident)};
 });
 const arriving=[],arrivalAreas=new Map();
 for(const unit of state.units.filter(u=>u.side==='player'&&(u.hp>0||queued.includes(u)))){
   if(unit.militiaArrival){
     const route=`${unit.militiaArrival.from}:${unit.militiaArrival.to}`;
     if(!arrivalAreas.has(route))arrivalAreas.set(route,militiaArrivalTerrain(state,unit));
     const arrival=arrivalAreas.get(route);Object.assign(unit,reserve(arrival.anchor,arrival.cells,true));delete unit.militiaArrival;continue;
   }
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
     const candidates=entryTerrainCells(state,unit,unit.entryEdge,component).filter(t=>!occupied.has(key(t)));
     candidates.sort((a,b)=>Math.abs(a.x-anchor.x)+Math.abs(a.y-anchor.y)-Math.abs(b.x-anchor.x)-Math.abs(b.y-anchor.y)||(a.type==='road'?0:1)-(b.type==='road'?0:1)||a.y-b.y||a.x-b.x);
     if(!candidates.length)throw Error('No queda espacio en el borde de entrada. La llegada sigue pendiente.');
     Object.assign(unit,{x:candidates[0].x,y:candidates[0].y});
     if(unit.hp>0)unit.facing={N:4,E:6,S:0,W:2}[unit.entryEdge];
     occupied.add(key(unit));
   }
   // Newly issued pieces travel with the arriving detachment. Map-template
   // positions belong only to resident guns, not to a battery entering from
   // the opposite edge of the expanded sector.
   const crew=arriving.find(u=>u.hp>0&&!u.militia&&!u.missionAlly);
   if(crew){
     const fixed=new Set(stationed.map(g=>g.id));
     const gunCells=new Set([...occupied,...state.artillery.filter(g=>fixed.has(g.id)||g.side!=='player').map(key)]);
     const boundary=entryTerrainCells(state,crew,crew.entryEdge,component);
     // Narrow roads can use every boundary cell for the arriving soldiers.
     // Reserve the connected two-cell entry apron for their gun carriages.
     const entries=state.tiles.filter(p=>component.has(key(p))&&boundary.some(e=>Math.max(Math.abs(p.x-e.x),Math.abs(p.y-e.y))<=2));
     for(const gun of state.artillery.filter(g=>g.side==='player'&&!fixed.has(g.id))){
       const cells=entries.filter(p=>!gunCells.has(key(p))).sort((a,b)=>Math.abs(a.x-crew.x)+Math.abs(a.y-crew.y)-Math.abs(b.x-crew.x)-Math.abs(b.y-crew.y)||a.y-b.y||a.x-b.x);
       if(!cells.length)throw Error('No queda espacio para la batería en el borde de llegada.');
       Object.assign(gun,{x:cells[0].x,y:cells[0].y});gunCells.add(key(gun));
     }
   }
 }
 if(request.detainedPrisoners?.length){
   state=placeDetainedPrisoners(state,request.detainedPrisoners);
   for(const npc of state.npcs)if(npc.hp>0&&!npc.departure)occupied.add(key(npc));
 }
 state.sceneId=request.sceneId??null;state.missionId=request.missionId??request.sceneId??null;
 if(request.finiteArtilleryArsenal)state.finiteArtilleryArsenal=structuredClone(request.finiteArtilleryArsenal);
 revealFiniteArsenal(state);
 if(!previous&&!request.sceneId&&sectorCash(request.sector)){
   const leader=state.units.find(u=>u.side==='player'&&u.hp>0),spot=leader&&state.tiles.find(t=>!t.blocked&&!propBlocksAt(state,t.x,t.y)&&!occupied.has(key(t))&&Math.abs(t.x-leader.x)+Math.abs(t.y-leader.y)===1);
   if(spot)state.groundItems.push({id:`cash:${request.sector}`,type:'money',x:spot.x,y:spot.y,count:sectorCash(request.sector)});
 }
 // Prisoner placement clones the battle. Select arrivals from the current
 // state so the final scene receives their positions and patrol origins.
 placeInvaders(state,state.units.filter(u=>arrivingEnemyIds.has(u.id)),request,occupied);
 state.enteredHour=request.hour??0;
 for(const unit of state.units)if(unit.side==='enemy'){
   if(request.defenseGroupId&&unit.hp>0)unit.assaultPatrol=true;
   else delete unit.assaultPatrol; // A later occupation is a guard post again.
 }
 const selecting=placement&&!request.exploration&&beginSectorDeployment(state,request),deferred=new Set(state.deployment?.units.map(u=>u.id)??[]);
 // Residents receive their cover now; arriving defenders receive it only at
 // their committed cells, never at the unused automatic arrival positions.
 if(request.defenseGroupId&&request.defenseFort>0)for(const unit of state.units.filter(u=>u.side==='player'&&u.hp>0&&!deferred.has(u.id))){const tile=state.tiles.find(t=>t.x===unit.x&&t.y===unit.y);tile.cover=Math.max(tile.cover??0,Math.min(3,request.defenseFort)*10);}
 // Campaign admission binds the issued choices to saved records. This scene
 // builder has only that request; use its admitted map to check local custody.
 const issuedQuests=Object.fromEntries(Object.entries(request.questBeneficiaries??{}).map(([id,beneficiaryId])=>[id,{beneficiaryId}]));
 for(const [id,deliveredCount]of Object.entries(request.questWithdrawals??{}))issuedQuests[id]={...issuedQuests[id],status:'withdrawn',withdrawal:{deliveredCount}};
 validateQuestBeneficiaryContext({errandDefinitions:request.errandDefinitions,quests:issuedQuests},state,{request});
 if(selecting)return validateBattleSnapshot(state);
 return initializeBattlePerception(validateBattleSnapshot(state));
}
