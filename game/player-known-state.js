import {knownSectorEquipment} from './sector-inventory.js';
import {publicContractNotice} from './contract-attention.js';
import {squadTravelStatus} from './squad-travel.js';
import {operativeInTransit} from './squads.js';
import {maximumEnergy} from './fatigue.js';
import {canSee,visibleRooms,actionCosts,stealPreview} from './tactical.js';
import {isInteriorVisible} from './tactical-visibility.js';
import {environmentTargetSummary} from './environment-interactions.js';
import {unitCanAct,equipmentSlots,aimOptions,orderDescriptors,nearbyLootOptions,targetPreview,heardNoiseModel,fittingInventoryModel} from './ja2-hud.js';
import {CAMPAIGN_SECTORS,RESOURCE_NAMES} from './data.js';
import {rosterFor} from './campaign.js';
import {enemyGroupStatus} from './enemy-groups.js';
import {publicAssignmentNotice} from './assignment-attention.js';

// Explicit allowlists: new simulation fields remain private until reviewed here.
const scalar=value=>value===null||['string','number','boolean'].includes(typeof value);
const pick=(value,keys)=>Object.fromEntries(keys.filter(key=>value?.[key]!==undefined&&scalar(value[key])).map(key=>[key,value[key]]));
const ACTOR=['id','name','nickname','side','x','y','hp','maxHp','stance','movementMode','facing','mounted','unconscious','knockedDown','entangled','routed','surrendered','militia','missionAlly'];
const OWN=['ap','maxAP','carriedAP','energy','fatigue','bleeding','bandaged','shock','morale','weapon','blade','condition','bladeCondition','weaponDropped','weaponReady','loaded','reloadProgress','ammo','jammed','medkits','priming','flints','rations','torches','boleadoras','activeSlot','activeTool','activeSupply','stealthMode','agility','dexterity','strength','wisdom','leadership','marksmanship','medical','mechanical','explosives','stealth','experienceLevel','militiaRank','militiaExperience'];
const ITEM=['item','label','name','count','weight','weapon','loaded','reloadProgress','condition','jammed','itemType','toolKey','fittingPattern'];
const ACTION=['type','unitId','targetId','item','count','slot','toolKey','supplyKey','stance','movement','enabled','x','y','aim','hitLocation','groundId','dropIndex','inventoryKey','kind','id','verb','index','destination'];
const ORDERS=new Set(['move','look','stealth','useItem','loot','reload','reprime','weapon','stance','mount','brace','repair','free','endTurn']);
const pointKey=point=>`${point.x},${point.y}`;
const onField=unit=>!unit.departure&&!unit.fled;
const fittings=value=>value?.bayonet?{bayonet:pick(value.bayonet,['weapon','fittingPattern','condition'])}:{};
const item=stack=>typeof stack==='number'?{count:stack}:{...pick(stack,ITEM),...(stack?.fittings?{fittings:fittings(stack.fittings)}:{})};
const inventory=unit=>Object.fromEntries(Object.entries(unit.inventory??{}).map(([key,stack])=>[key,item(stack)]));
const fresh=(state,contact)=>contact&&Number.isInteger(contact.turn)&&contact.turn<=state.turn&&state.turn-contact.turn<=3;
const departure=unit=>({...pick(unit,['id','name','nickname','hp','maxHp']),...pick(unit.departure,['edge','destination','elapsedSeconds','mountId'])});

function ownActor(unit){
  return {maximumEnergy:maximumEnergy(unit),...pick(unit,[...ACTOR,...OWN,'weaponFittingPattern','bladeFittingPattern']),weaponFittings:fittings(unit.weaponFittings),inventory:inventory(unit),...(unit.mount?{mount:pick(unit.mount,['id','stamina','condition'])}:{})};
}

function fittingOrders(state,unit){
  const model=fittingInventoryModel(state,unit);
  return [...model.sources.map(source=>({...pick(source,['item','label','condition','weight']),...pick(source.preview,['valid','reason','pa']),action:pick(source.action,ACTION)})),
    ...(model.attached?.removals??[]).map(option=>({...pick(option,['label','destination']),...pick(option.preview,['valid','reason','pa']),action:pick(option.action,ACTION)}))];
}

/** Current shared sight, plus anonymous remembered contact. Never a save payload. */
export function playerKnownBattle(state){
  if(!state)return null;
  const players=state.units.filter(unit=>unit.side==='player'&&onField(unit));
  const actors=players.filter(unit=>unit.hp>0&&!unit.unconscious&&!unit.routed&&!unit.surrendered);
  const revealed=new Set([...(state.revealedRooms??[]),...visibleRooms(state)]);
  const seen=point=>onField(point)&&actors.some(player=>canSee(state,player,point))&&isInteriorVisible(state,point,revealed);
  const visible=state.units.filter(unit=>unit.side!=='player'&&seen(unit));
  const visibleIds=new Set(visible.map(unit=>unit.id));
  const tiles=state.tiles.filter(seen);
  const knownCells=new Set(tiles.map(pointKey));
  const environment=[];
  for(const target of [...tiles.filter(tile=>tile.type==='door'),...(state.props??[]).filter(prop=>prop.type==='chest'&&seen(prop))]){
    const summary=environmentTargetSummary({side:'player'},target),kind=target.type==='door'?'door':'container';
    environment.push({...pick(target,['x','y']),...pick(summary,['id','type','label','open','locked','broken']),kind,
      ...(summary.trap?{trap:pick(summary.trap,['type','armed'])}:{}),
      ...(summary.contents?{contents:summary.contents.map((stack,index)=>({...item(stack),index}))}:{})});
  }
  const contacts=players.flatMap(unit=>{
    const known=unit.lastKnownEnemy,noise=heardNoiseModel(state,unit);
    return [...(fresh(state,known)?[{observerId:unit.id,kind:'lastSeen',...pick(known,['x','y','turn']),anonymous:true}]:[]),
      ...(noise?[{observerId:unit.id,kind:'heard',...pick(noise,['x','y','radius','label']),turn:unit.lastHeardNoise.turn,anonymous:true}]:[])];
  });
  const livingTargets=[...players,...visible].filter(unit=>unit.hp>0);
  const orders=actors.filter(unit=>!unit.militia).map(unit=>({unitId:unit.id,canAct:unitCanAct(state,unit),costs:pick(actionCosts(state,unit),['fire','aim','reload','reprime','melee','heal','weapon','stance','mount','brace','repair','free','loot','drop','equipLoot']),
    equipment:equipmentSlots(state,unit).map(slot=>({...pick(slot,['slot','label','pa','active','disabled']),action:pick(slot.action,ACTION)})),
    fittings:fittingOrders(state,unit),
    aim:aimOptions(state,unit).map(option=>pick(option,['level','pa','disabled'])),
    orders:orderDescriptors(state,unit).filter(order=>ORDERS.has(order.id)).map(order=>pick(order,['id','label','kind','pa','disabled'])),
    targets:livingTargets.flatMap(target=>{const preview=targetPreview(state,unit,target);return preview?[{targetId:target.id,...pick(preview,['name','pa','remaining','chance','chanceLabel','coverNote','hitLocation','attackType','attackLabel','actionLabel','valid','reason'])}]:[];}),
    stealTargets:visible.filter(target=>target.hp>0&&!target.unconscious&&!target.surrendered&&!target.routed).map(target=>({targetId:target.id,...pick(stealPreview(state,unit,target),['pa','valid','reason']),action:{type:'steal',targetId:target.id}})),
    loot:nearbyLootOptions(state,unit).filter(option=>{
      const target=option.action.targetId?state.units.find(target=>target.id===option.action.targetId):option.action.groundId?(state.groundItems??[]).find(target=>target.id===option.action.groundId):(state.droppedWeapons??[])[option.action.dropIndex];
      return target&&seen(target);
    }).map(option=>({...item(option),source:option.source,action:pick(option.action,ACTION)})),
  }));
  const result={...pick(state,['sectorId','sectorName','sceneId','missionId','width','height','turn','phase','mode','status','sectorCleared','night','elapsedSeconds']),weather:pick(state.weather,['rain','humidity']),
    units:[...players.map(ownActor),...visible.map(unit=>pick(unit,ACTOR))],departedPlayers:state.units.filter(unit=>unit.side==='player'&&unit.departure).map(departure),
    npcs:(state.npcs??[]).filter(seen).map(npc=>pick(npc,['id','name','x','y','hp','mission'])),
    tiles:tiles.map(tile=>pick(tile,['x','y','type','blocked','cover','open','buildingId','roomId'])),
    props:(state.props??[]).filter(seen).map(prop=>({...pick(prop,['id','type','x','y','blocksMovement']),...(prop.footprint?{footprint:pick(prop.footprint,['width','height'])}:{})})),
    environment,contacts,orders,
    artillery:(state.artillery??[]).filter(gun=>gun.side==='player'||seen(gun)).map(gun=>pick(gun,gun.side==='player'?['id','side','type','x','y','loaded','ammo','facing']:['id','side','type','x','y','facing'])),
    groundItems:(state.groundItems??[]).filter(ground=>!ground.heldBy&&ground.count>0&&seen(ground)).map(ground=>({...pick(ground,['id','x','y','type']),...item(ground.stack??ground)})),
    droppedWeapons:(state.droppedWeapons??[]).flatMap((ground,dropIndex)=>!ground.taken&&seen(ground)?[{dropIndex,...pick(ground,['x','y']),...item(ground)}]:[]),
    lights:(state.lights??[]).filter(light=>knownCells.has(pointKey(light))).map(light=>pick(light,['x','y','type','radius','intensity','remainingSeconds'])),
    smoke:(state.smoke??[]).filter(smoke=>knownCells.has(pointKey(smoke))).map(smoke=>pick(smoke,['x','y','radius'])),
    exits:(state.exits??[]).map(exit=>pick(exit,['id','edge','destination'])),
    interrupt:state.phase==='interrupt'&&state.interrupt?.side==='player'?{side:'player',unitIds:players.filter(unit=>unitCanAct(state,unit)).map(unit=>unit.id),...(visibleIds.has(state.interrupt.enemyId)?{enemyId:state.interrupt.enemyId}:{})}:null,
  };
  return result;
}

/** Player-owned campaign records and the strategic reports shown by the UI. */
export function playerKnownCampaign(state){
  if(!state)return null;
  const knownIds=new Set([...(state.recruited??[]),...Object.entries(state.operativeState??{}).filter(([,record])=>record.captured).map(([id])=>Number(id))]);
  const roster=rosterFor(state).filter(unit=>knownIds.has(unit.id));
  return {...pick(state,['hour','secondOfHour','phase','location','activeSquadId','blockade','completed','defeated']),
    assignmentNotice:publicAssignmentNotice(state),
    contractNotice:publicContractNotice(state),
    travelNotice:state.travelNotice?{hour:state.travelNotice.hour,events:state.travelNotice.events.map(e=>pick(e,['squadId','name','sector','text']))}:null,
    resources:pick(state.resources,Object.keys(RESOURCE_NAMES)),reputation:pick(state.reputation,['directory','gauchos','pardos','foreign','indigenous','royalists']),
    sectors:CAMPAIGN_SECTORS.map(sector=>({...pick(sector,['id','name','grid','biome','theater']),...pick(state.sectors[sector.id],['owner','loyalty','fort','damageUntil']),militia:[...(state.sectors[sector.id]?.militia??[])],equipment:knownSectorEquipment(state.sectorStates?.[sector.id])})),
    squads:(state.squads??[]).map(squad=>({...pick(squad,['id','name','location']),members:squad.members.filter(id=>knownIds.has(id)),journey:squadTravelStatus(squad)})),
    operatives:roster.map(unit=>{const record=state.operativeState[unit.id];return {inTransit:operativeInTransit(state,unit.id),maximumEnergy:maximumEnergy(record),...pick(unit,['id','name','nickname','weapon','blade',...OWN]),...pick(record,['hp','maxHp','alive','location','assignment','asleep','sleepCollapsed','captured','capturedSector','energy','fatigue','bleeding','bandaged','morale','condition','carriedAmmo','medkits','priming','flints','rations','torches','boleadoras']),weaponFittings:fittings(record.weaponFittings),...pick(record,['weaponFittingPattern','bladeFittingPattern','bladeCondition','toolkitPoints','repairTargetId','repairWeaponId','repairScope']),inventory:inventory(record),contract:pick(state.contracts?.[unit.id],['kind','term','started','expiresAt','paid'])};}),
    flags:pick(state.flags,['academy','sanLorenzo','northPact','partisanSupply','foundry','parliament','emancipation','commission','mentoring']),
    horses:(state.horseState?.horses??[]).map(horse=>({...pick(horse,['id','name','location','assignedTo','stamina','condition','feed','hired','hireUntil','returned','pregnantUntil']),...(horse.custody?{custody:pick(horse.custody,['kind','sector','operativeId'])}:{})})),
    enemyReports:(state.enemyGroups??[]).filter(group=>['marching','waiting','engaged','stationed'].includes(group.status)).map(group=>pick(enemyGroupStatus(state,group),['id','name','commander','strength','location','destination','remaining','status','crossingAt'])),
    pendingEncounter:state.pendingEncounter?pick(state.pendingEncounter,['groupId','sector','arrivedAt']):null,
    pendingBattle:state.pendingBattle?{...pick(state.pendingBattle,['sector','sceneId','name','exploration']),resumeAvailable:Boolean(state.pendingBattle.resumeSnapshot)}:null,
  };
}

export function playerKnownState({campaign,battle,screen}){
  return {screen,campaign:playerKnownCampaign(campaign),battle:playerKnownBattle(battle)};
}

// Reducer admission still supplies its text reason. Never serialize an error
// object (which could contain an actor or an authoritative state snapshot).
export function playerKnownError(value){
  return typeof value==='string'?value:'La orden no se pudo completar.';
}
