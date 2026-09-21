import {sectorDeploymentModel} from './sector-deployment.js';
import {publicLogisticsNotice} from './logistics-attention.js';
import {knownCampaignSectorEquipment} from './sector-inventory.js';
import {publicContractNotice} from './contract-attention.js';
import {squadTravelStatus} from './squad-travel.js';
import {operativeInTransit} from './squads.js';
import {maximumEnergy} from './fatigue.js';
import {canSee,visibleRooms,actionCosts,stealPreview} from './tactical.js';
import {isInteriorVisible} from './tactical-visibility.js';
import {environmentTargetSummary} from './environment-interactions.js';
import {unitCanAct,handSlots,equipmentSlots,aimOptions,orderDescriptors,nearbyLootOptions,civilianMedicalInputAction,targetPreview,heardNoiseModel,fittingInventoryModel} from './ja2-hud.js';
import {CAMPAIGN_SECTORS,RESOURCE_NAMES} from './data.js';
import {rosterFor} from './campaign.js';
import {enemyGroupStatus} from './enemy-groups.js';
import {publicAssignmentNotice} from './assignment-attention.js';
import {spaceKey} from './tactical-space.js';
import {heldGrenade,grenadeThrowCosts,grenadeThrowRange,GRENADE_THROW} from './grenade-throw.js';

// Explicit allowlists: new simulation fields remain private until reviewed here.
const scalar=value=>value===null||['string','number','boolean'].includes(typeof value);
const pick=(value,keys)=>Object.fromEntries(keys.filter(key=>value?.[key]!==undefined&&scalar(value[key])).map(key=>[key,value[key]]));
const POSITION=['x','y','tacticalLevel'];
const ACTOR=['id','name','nickname','side',...POSITION,'hp','maxHp','stance','movementMode','facing','mounted','unconscious','knockedDown','entangled','routed','surrendered','militia','missionAlly'];
const OWN=['ammunitionVersion','ap','maxAP','carriedAP','energy','fatigue','bleeding','bandaged','shock','morale','weapon','blade','condition','bladeCondition','weaponDropped','weaponReady','weaponMode','loaded','reloadProgress','ammo','jammed','medkits','priming','flints','rations','torches','boleadoras','activeSlot','activeItem','leftHandItem','activeTool','activeSupply','stealthMode','agility','dexterity','strength','wisdom','leadership','marksmanship','medical','mechanical','explosives','stealth','experienceLevel','militiaRank','militiaExperience'];
const ITEM=['item','ammoType','kind','grenadeType','outfit','label','name','count','weight','weapon','loaded','reloadProgress','condition','jammed','itemType','toolKey','fittingPattern'];
const ACTION=['type','unitId','targetId','targetKind','item','count','slot','toolKey','supplyKey','stance','movement','enabled',...POSITION,'linkId','aim','hitLocation','groundId','dropIndex','inventoryKey','kind','id','verb','index','destination'];
const ORDERS=new Set(['move','climb','look','stealth','useItem','loot','reload','reprime','weapon','stance','mount','brace','repair','free','endTurn']);
const onField=unit=>!unit.departure&&!unit.fled;
const fittings=value=>value?.bayonet?{bayonet:pick(value.bayonet,['weapon','fittingPattern','condition'])}:{};
const item=stack=>typeof stack==='number'?{count:stack}:{...pick(stack,ITEM),...(stack?.fittings?{fittings:fittings(stack.fittings)}:{})};
const cursor=unit=>unit.equipmentCursor?{equipmentCursor:{sourceId:unit.equipmentCursor.sourceId,stack:item(unit.equipmentCursor.stack)}}:{};
const handMetadata=unit=>Object.fromEntries(['weaponMetadata','bladeMetadata'].filter(key=>unit[key]!==undefined).map(key=>[key,item(unit[key])]));
const inventory=unit=>Object.fromEntries(Object.entries(unit.inventory??{}).map(([key,stack])=>[key,item(stack)]));
const treatmentPreview=preview=>preview?.treatment?{treatment:pick(preview.treatment,['critical','targetHP','hpGain','hpAfter','work','remainingWork','capacity','dressingsUsed','bleedingAfter','bandagedAfter','complete','partial'])}:{};
const fresh=(state,contact)=>contact&&Number.isInteger(contact.turn)&&contact.turn<=state.turn&&state.turn-contact.turn<=3;
const departure=unit=>({...pick(unit,['id','name','nickname','hp','maxHp']),...pick(unit.departure,['edge','destination','elapsedSeconds','mountId'])});

function ownActor(unit){
  return {maximumEnergy:maximumEnergy(unit),...pick(unit,[...ACTOR,...OWN,'weaponFittingPattern','bladeFittingPattern']),weaponFittings:fittings(unit.weaponFittings),...(unit.pocketOrder?{pocketOrder:structuredClone(unit.pocketOrder)}:{}),...cursor(unit),...handMetadata(unit),inventory:inventory(unit),outfit:unit.outfit?item(unit.outfit):null,...(unit.offHand?{offHand:item(unit.offHand)}:{}),...(unit.mount?{mount:pick(unit.mount,['id','stamina','condition'])}:{})};
}

function fittingOrders(state,unit){
  const model=fittingInventoryModel(state,unit);
  return [...model.sources.map(source=>({...pick(source,['item','label','condition','weight']),...pick(source.preview,['valid','reason','pa']),action:pick(source.action,ACTION)})),
    ...(model.attached?.removals??[]).map(option=>({...pick(option,['label','destination']),...pick(option.preview,['valid','reason','pa']),action:pick(option.action,ACTION)}))];
}
function grenadePointOrders(state,unit,targets){
  const seen=new Set();
  return targets.flatMap(target=>{
    const key=spaceKey(target);if(seen.has(key))return [];seen.add(key);
    const point=pick(target,POSITION),preview=targetPreview(state,unit,point,{mode:'throwGrenade'});
    return [{...point,...pick(preview,['name','pa','remaining','chance','chanceLabel','coverNote','attackType','attackLabel','actionLabel','valid','reason','blastRadius','friendlyRisk','blocked','landingLabel']),
      ...(preview.landing?{landing:pick(preview.landing,POSITION)}:{}),action:{type:'throwGrenade',...point,aim:0}}];
  });
}

/** Current shared sight, plus anonymous remembered contact. Never a save payload. */
export function playerKnownBattle(state){
  if(!state)return null;
  if(state.deployment){
    const deployment=sectorDeploymentModel(state);
    return {...pick(state,['sectorId','sectorName','sceneId','missionId','width','height','turn','status','elapsedSeconds']),phase:'deployment',mode:'deployment',deployment,
      units:deployment.units.map(({position,...unit})=>({...unit,side:'player',...(position??{})})),orders:[],npcs:[],contacts:[],tiles:deployment.cells,artillery:[],groundItems:[]};
  }
  const players=state.units.filter(unit=>unit.side==='player'&&onField(unit));
  const actors=players.filter(unit=>unit.hp>0&&!unit.unconscious&&!unit.routed&&!unit.surrendered);
  const revealed=new Set([...(state.revealedRooms??[]),...visibleRooms(state)]);
  const seen=point=>onField(point)&&actors.some(player=>canSee(state,player,point))&&isInteriorVisible(state,point,revealed);
  const visible=state.units.filter(unit=>unit.side!=='player'&&seen(unit));
  const visibleIds=new Set(visible.map(unit=>unit.id));
  const tiles=state.tiles.filter(seen);
  const surfaces=(state.upperSurfaces??[]).filter(seen);
  const knownCells=new Set([...tiles,...surfaces].map(spaceKey));
  const environment=[];
  for(const target of [...tiles.filter(tile=>tile.type==='door'),...(state.props??[]).filter(prop=>prop.type==='chest'&&seen(prop))]){
    const summary=environmentTargetSummary({side:'player'},target),kind=target.type==='door'?'door':'container';
    environment.push({...pick(target,POSITION),...pick(summary,['id','type','label','open','locked','broken']),kind,
      ...(summary.trap?{trap:pick(summary.trap,['type','armed'])}:{}),
      ...(summary.contents?{contents:summary.contents.map((stack,index)=>({...item(stack),index}))}:{})});
  }
  const contacts=players.flatMap(unit=>{
    const known=unit.lastKnownEnemy,noise=heardNoiseModel(state,unit);
    return [...(fresh(state,known)?[{observerId:unit.id,kind:'lastSeen',...pick(known,[...POSITION,'turn']),anonymous:true}]:[]),
      ...(noise?[{observerId:unit.id,kind:'heard',...pick(noise,[...POSITION,'radius','label']),turn:unit.lastHeardNoise.turn,anonymous:true}]:[])];
  });
  const livingTargets=[...players,...visible].filter(unit=>unit.hp>0);
  const visibleNpcs=(state.npcs??[]).filter(seen);
  const orders=actors.filter(unit=>!unit.militia).map(unit=>{
    const grenade=heldGrenade(unit),throwCosts=grenade?grenadeThrowCosts(unit):null,throwPA=state.mode==='exploration'?0:throwCosts?.total;
    const grenadeReady=Boolean(grenade&&unitCanAct(state,unit)&&!unit.equipmentCursor&&!unit.knockedDown&&!unit.mounted&&grenade.record.condition>0&&(state.mode==='exploration'||unit.ap>=throwPA));
    return {unitId:unit.id,canAct:unitCanAct(state,unit),costs:grenade?{...pick(actionCosts(state,unit),['heal','weapon','stance','mount','free','loot','drop','equipLoot']),throwGrenade:throwPA}:pick(actionCosts(state,unit),['fire','aim','reload','reprime','melee','heal','weapon','stance','mount','brace','repair','free','loot','drop','equipLoot']),
    ...(grenade?{grenade:{...item(grenade.record),item:grenade.slot,pa:throwPA,range:pick(grenadeThrowRange(unit,grenade),['maximum']),blastRadius:GRENADE_THROW.radius}}:{}),
    equipment:equipmentSlots(state,unit).map(slot=>({...pick(slot,['slot','label','pa','active','disabled']),action:pick(slot.action,ACTION)})),
    hands:handSlots(state,unit).map(hand=>{const held=hand.item?.startsWith('inventory:')?unit.inventory?.[hand.item.slice(10)]:null;return {...pick(hand,['side','item','blocked','label','weapon','loaded','condition','pa','reason','disabled']),...(held?.kind==='grenade'?{...pick(held,['kind','grenadeType','condition']),count:1}:{}),...(hand.action?{action:pick(hand.action,ACTION)}:{})};}),
    fittings:fittingOrders(state,unit),
    aim:grenade?[]:aimOptions(state,unit).map(option=>pick(option,['level','pa','disabled'])),
    orders:orderDescriptors(state,unit).filter(order=>ORDERS.has(order.id)).map(order=>grenade&&order.id==='useItem'?{id:'useItem',label:'Lanzar granada',kind:'mode',pa:throwPA,disabled:!grenadeReady}:pick(order,['id','label','kind','pa','disabled'])),
    targets:grenade?grenadePointOrders(state,unit,[...livingTargets,...visibleNpcs]):livingTargets.flatMap(target=>{const preview=targetPreview(state,unit,target);return preview?[{targetId:target.id,...treatmentPreview(preview),...pick(preview,['name','pa','remaining','chance','chanceLabel','coverNote','hitLocation','attackType','attackLabel','actionLabel','valid','reason'])}]:[];}),
    medicalTargets:visibleNpcs.flatMap(npc=>{const action=civilianMedicalInputAction(state,unit,npc);if(!action)return [];const preview=targetPreview(state,unit,npc);return [{targetId:npc.id,targetKind:'npc',...treatmentPreview(preview),...pick(preview,['name','pa','remaining','coverNote','actionLabel','valid','reason']),action}];}),
    stealTargets:visible.filter(target=>target.hp>0&&!target.unconscious&&!target.surrendered&&!target.routed).map(target=>({targetId:target.id,...pick(stealPreview(state,unit,target),['pa','valid','reason']),action:{type:'steal',targetId:target.id}})),
    loot:nearbyLootOptions(state,unit).filter(option=>{
      const target=option.action.targetId?state.units.find(target=>target.id===option.action.targetId):option.action.groundId?(state.groundItems??[]).find(target=>target.id===option.action.groundId):(state.droppedWeapons??[])[option.action.dropIndex];
      return target&&seen(target);
    }).map(option=>({...item(option),source:option.source,action:pick(option.action,ACTION)})),
  };});
  const result={...pick(state,['sectorId','sectorName','sceneId','missionId','width','height','turn','phase','mode','status','sectorCleared','night','elapsedSeconds']),weather:pick(state.weather,['rain','humidity']),
    units:[...players.map(ownActor),...visible.map(unit=>pick(unit,ACTOR))],departedPlayers:state.units.filter(unit=>unit.side==='player'&&unit.departure).map(departure),
    npcs:visibleNpcs.map(npc=>pick(npc,['id','name',...POSITION,'hp','maxHp','bleeding','bandaged','unconscious','knockedDown','stance','mission'])),
    tiles:tiles.map(tile=>pick(tile,[...POSITION,'elevation','type','blocked','cover','open','buildingId','roomId'])),
    ...(state.upperSurfaces?{upperSurfaces:surfaces.map(surface=>pick(surface,['id',...POSITION,'elevation','type','kind','blocked','cover','slabThickness','material','buildingId','roomId']))}:{}),
    ...(state.climbLinks?{climbLinks:state.climbLinks.filter(link=>knownCells.has(spaceKey(link.from))&&knownCells.has(spaceKey(link.to))).map(link=>({...pick(link,['id','kind']),from:pick(link.from,POSITION),to:pick(link.to,POSITION)}))}:{}),
    props:(state.props??[]).filter(seen).map(prop=>({...pick(prop,['id','type',...POSITION,'blocksMovement']),...(prop.footprint?{footprint:pick(prop.footprint,['width','height'])}:{})})),
    environment,contacts,orders,
    artillery:(state.artillery??[]).filter(gun=>gun.side==='player'||seen(gun)).map(gun=>pick(gun,gun.side==='player'?['id','side','type',...POSITION,'loaded','ammo','facing','reloadProgress']:['id','side','type',...POSITION,'facing'])),
    groundItems:(state.groundItems??[]).filter(ground=>!ground.heldBy&&ground.count>0&&seen(ground)).map(ground=>({...pick(ground,['id',...POSITION,'type']),...item(ground.stack??ground)})),
    droppedWeapons:(state.droppedWeapons??[]).flatMap((ground,dropIndex)=>!ground.taken&&seen(ground)?[{dropIndex,...pick(ground,POSITION),...item(ground)}]:[]),
    lights:(state.lights??[]).filter(light=>knownCells.has(spaceKey(light))).map(light=>pick(light,[...POSITION,'type','radius','intensity','remainingSeconds'])),
    smoke:(state.smoke??[]).filter(smoke=>knownCells.has(spaceKey(smoke))).map(smoke=>pick(smoke,[...POSITION,'radius'])),
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
    logisticsNotice:publicLogisticsNotice(state),
    assignmentNotice:publicAssignmentNotice(state),
    contractNotice:publicContractNotice(state),
    travelNotice:state.travelNotice?{hour:state.travelNotice.hour,events:state.travelNotice.events.map(e=>pick(e,['squadId','name','sector','text']))}:null,
    resources:pick(state.resources,Object.keys(RESOURCE_NAMES)),reputation:pick(state.reputation,['directory','gauchos','pardos','foreign','indigenous','royalists']),
    sectors:CAMPAIGN_SECTORS.map(sector=>({...pick(sector,['id','name','grid','biome','theater']),...pick(state.sectors[sector.id],['owner','loyalty','fort','damageUntil']),militia:[...(state.sectors[sector.id]?.militia??[])],equipment:knownCampaignSectorEquipment(state,sector.id)})),
    squads:(state.squads??[]).map(squad=>({...pick(squad,['id','name','location']),members:squad.members.filter(id=>knownIds.has(id)),journey:squadTravelStatus(squad)})),
    operatives:roster.map(unit=>{const record=state.operativeState[unit.id];return {inTransit:operativeInTransit(state,unit.id),maximumEnergy:maximumEnergy(record),...pick(unit,['id','name','nickname','weapon','blade',...OWN]),...pick(record,['hp','maxHp','alive','location','assignment','asleep','sleepCollapsed','captured','capturedSector','energy','fatigue','bleeding','bandaged','morale','condition','carriedAmmo','carriedLoaded','carriedReloadProgress','medkits','priming','flints','rations','torches','boleadoras']),weaponFittings:fittings(record.weaponFittings),...pick(record,['activeItem','activeSlot','leftHandItem','weaponFittingPattern','bladeFittingPattern','bladeCondition','toolkitPoints','repairTargetId','repairWeaponId','repairScope']),...(record.pocketOrder?{pocketOrder:structuredClone(record.pocketOrder)}:{}),...cursor(record),...handMetadata(record),inventory:inventory(record),outfit:record.outfit?item(record.outfit):null,...(record.offHand?{offHand:item(record.offHand)}:{}),contract:pick(state.contracts?.[unit.id],['kind','term','started','expiresAt','paid'])};}),
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
