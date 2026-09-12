import {validatePocketOrder} from './inventory-pockets.js';
import {prepareSectorArtillery,validateArtilleryDeployment,validateArtilleryReport,settleSectorArtillery,ownedArtilleryCount,supplyStationedArtillery} from './campaign-artillery.js';
import {recordLogisticsNotice,validateLogisticsNotice} from './logistics-attention.js';
import {moveSectorItem} from './sector-inventory.js';
import {initialContractAttention,migrateContractAttention,reconcileContractAttention,collectContractAttention,validateContractAttention} from './contract-attention.js';
import {totalSectorIncome} from './sector-income.js';
import {queueSquadTravel,cancelSquadTravel,resumeSquadTravel,advanceSquadTravel,validateSquadTravel,readyAssaultSquads,arriveForAssault,validateAssaultDeployment} from './squad-travel.js';
import {gainFatigue,needsCollapseRecovery} from './fatigue.js';
import {advanceMarchFatigue,tooTiredToMarch} from './march-fatigue.js';
import {assertSaveSize} from './save-limits.js';
import {MISSION_SCENES,YATASTO_NPCS,missionStatus,talkMission,sanLorenzoAlly,validateMissions} from './missions.js';
export {MISSION_SCENES,missionStatus} from './missions.js';
import {MATERIAL_STOCK,materialYield,productionHours,migrateMaterials} from './industry.js';
import {speechFor} from './characters.js';
import {prepareGarrison,returnGarrison,validGarrisons,reserveMilitiaTrainees,returnMilitiaTrainees,validMilitiaTrainees} from './garrison.js';
import {tradeQuote,applyPolicy,dailyPolitics,validatePolitics,policyStatus} from './politics.js';
export {tradeQuote,policyStatus} from './politics.js';
import {questForNPC,validateQuests} from './quests.js';
export {questForNPC,NPC_QUESTS} from './quests.js';
import {recordCityLoyalty,validCityLoyaltyEvents} from './cities.js';
import {contractQuote,contractStatus,migrateContracts} from './contracts.js';
export {contractQuote,contractStatus,CONTRACT_TERMS} from './contracts.js';
import {validateTraining,TRAINABLE_SKILLS} from './skill-training.js';
import {militiaCourse,militiaAssignment,MILITIA_COHORT,MILITIA_LIMIT,militiaEligibility} from './militia.js';
export {militiaCourse,militiaAssignment} from './militia.js';
import {initialHorseState,migrateHorseState,applyHorseAction,mountForOperative} from './horses.js';
import {fieldCapable} from './tactical.js';
import {prepareDeploymentExits,planDeploymentReturn,recordStrategicArrival,migrateDeploymentReturns,validateDeploymentReturnState} from './deployment-return.js';
import {validateSectorExits} from './tactical-exits.js';
import {CARE_ASSIGNMENTS,MEDICAL_KIT_PRICE,migrateMedicalCare,assignMedicalCare,advanceMedicalCare,returnMedicalCare,validateMedicalCare} from './medical-care.js';
import {WORK_ASSIGNMENTS,TOOLKIT_PRICE,TOOLKIT_POINTS,migrateAssignments,assignWork,advanceAssignments,validateAssignments,militiaAssignmentIssue} from './assignments.js';
import {assignmentStates,migrateAssignmentAttention,validateAssignmentAttention,collectAssignmentAttention,reconcileAssignmentAttention,militiaCompletionAttention,militiaCancellationAttention,sleepAttention} from './assignment-attention.js';
import {migrateMorale,deploymentMorale,returnMorale,recordPayMorale,recordCasualtyMorale,recordBattleMorale,advanceMorale,validateMorale} from './morale.js';
import {migrateEnemyGroups,launchEnemyGroup,advanceEnemyGroups,delayCrossingEnemyGroups,haltEnemyGroupsAt,queueEnemyEncounter,localDefenderIds,localDefenderCount,retreatDestinations,occupyingGroups,recordEnemyGroupResult,validateEnemyGroups} from './enemy-groups.js';
import {setSleep,prepareSleep,finishSleepHour,SLEEP_ISSUE_TEXT} from './sleep.js';
import {autoResolve} from './auto-resolve.js';
import {ENCOUNTERS,encounterForOperative,encountersFor,encounterRequirements} from './encounters.js';
export {ENCOUNTERS,encountersFor} from './encounters.js';
import {canReassignOperative,migrateSquads,activeSquad,operativeLocation,operativeInTransit,travelingOperatives,synchronizeSquad,validateSectorSnapshot,validatePersonalInventory} from './squads.js';
export {activeSquad,operativeLocation} from './squads.js';
import {clearCarriedLoading,setCarriedLoading,isImportedEquipment,deliverEquipmentShipments,validEquipmentShipments,EQUIPMENT_CATALOG,refillCost,firearmRepairCost,deployedArtillery,migrateEquipment,advanceMerchants,merchantStatus,addEquipment,storeEquipment,takeEquipment,resaleQuote,returnEquipment,validateEquipment,equipmentInventoryUsage,allocateEquipmentAmmo,equipmentCatalogItem,equipmentLabel,medicalSupplyStock,validateEquipmentOwnership,USED_EQUIPMENT_LIMIT,usedEquipmentOffers} from './equipment.js';
import {FITTING_RULES_VERSION} from './weapon-fittings.js';
export {EQUIPMENT_CATALOG,armoryInventory,refillCost,firearmRepairCost} from './equipment.js';
import {planTransfer,convoyStatus} from './logistics.js';
export {TRANSPORT_OPTIONS,transferOptions,inventoryAt,cargoWeight} from './logistics.js';
import {ROYALIST_COMMANDS,NORTHERN_AXIS,coastalRevenue,royalistIntel,mentorDispatch,oppositionFor} from './narrative.js';
export {ROYALIST_COMMANDS,royalistIntel,mentorDispatch} from './narrative.js';
import {rosterFor as baseRosterFor,CIVIC_RECRUITS,civicStatus as baseCivicStatus,createOfficerRecord} from './recruitment.js';
export {CIVIC_RECRUITS} from './recruitment.js';
export function civicStatus(s,id,local=false){const op=CIVIC_RECRUITS.find(o=>o.id===Number(id));return {available:Boolean(op&&!s.recruited.includes(Number(id))&&s.operativeState[Number(id)]?.alive&&!s.operativeState[Number(id)]?.captured),reason:s.operativeState[Number(id)]?.captured?'Está prisionero. Liberá el sector donde está detenido.':op?'Disponible por contrato en el escritorio.':'No existe ese voluntario.'};}
import {OPERATIVES, WEAPONS, CAMPAIGN_SECTORS, FACTIONS, PHASES, RECIPES, RESOURCE_NAMES} from './data.js';
export {OPERATIVES, WEAPONS, CAMPAIGN_SECTORS, FACTIONS, PHASES, RECIPES, RESOURCE_NAMES};
export function rosterFor(s){return baseRosterFor(s).map(o=>{const record=s.operativeState?.[o.id]??{};return {...o,...(s.loadouts?.[o.id]??{}),...Object.fromEntries(TRAINABLE_SKILLS.map(skill=>[skill,Math.min(100,(o[skill]??0)+(record.trainedStats?.[skill]??0))])),strength:Math.max(o.strength,Math.min(100,record.strength??o.strength))};});}
function returnTraining(s,id,report){validateTraining(report);for(const field of ['trainedStats','skillPractice'])if(report[field]!==undefined)s.operativeState[id][field]=clone(report[field]);}
function returnMount(s,id,report){if(!report.mount)return;const horse=s.horseState?.horses.find(h=>h.id===report.mount.id&&h.assignedTo===id&&!h.returned);requireThat(horse,'La montura no pertenece al combatiente.');for(const field of ['stamina','condition']){requireThat(Number.isFinite(report.mount[field])&&report.mount[field]>=0&&report.mount[field]<=100,'El estado de la montura es inválido.');horse[field]=report.mount[field];}}
function removeFromService(s,id){
  s.operativeState[id].assignment='active';s.operativeState[id].asleep=false;s.operativeState[id].sleepCollapsed=false;s.operativeState[id].recoveryHours=0;
  const location=operativeLocation(s,id);s.operativeState[id].location=location;s.recruited=s.recruited.filter(x=>x!==id);s.squad=s.squad.filter(x=>x!==id);for(const squad of s.squads){squad.members=squad.members.filter(x=>x!==id);if(!squad.members.length)delete squad.journey;}
  for(const horse of s.horseState.horses)if(horse.assignedTo===id)horse.assignedTo=null;
  for(const course of s.militiaTraining.filter(t=>t.trainerId===id)){returnMilitiaTrainees(s,course);}s.militiaTraining=s.militiaTraining.filter(t=>t.trainerId!==id);delete s.contracts[id];
}
function signContract(s,op,term){
  requireThat(!s.operativeState[op.id]?.captured,'El combatiente está prisionero; primero liberá su sector.');const quote=contractQuote(s,op,term??'day');requireThat(quote.available,quote.reason);pay(s,{treasury:quote.price});s.contracts[op.id]={kind:quote.permanent?'patriot':'paid',term:term??'day',started:s.hour,expiresAt:quote.expiresAt,paid:quote.price};
}
function moveMounts(s,destination,hours){for(const horse of s.horseState?.horses??[])if(!horse.returned&&s.squad.includes(horse.assignedTo)){horse.location=destination;horse.stamina=Math.max(0,horse.stamina-Math.ceil(hours*2));}}
const clone = value => JSON.parse(JSON.stringify(value));
const clamp = value => Math.max(-100,Math.min(100,value));
export function campaignDate(s){const day=Math.floor(s.hour/24);return {year:1812+Math.floor((2+Math.floor(day/30))/12),month:(2+Math.floor(day/30))%12+1,day:day%30+1,hour:s.hour%24};}
const sector = id => CAMPAIGN_SECTORS.find(s=>s.id===id);
const random = s => {s.seed=(Math.imul(1664525,s.seed)+1013904223)>>>0;return s.seed/4294967296;};
const note = (s,text) => {s.log.unshift({hour:s.hour,text});s.log=s.log.slice(0,80);};
const requireThat = (test,message) => {if(!test)throw Error(message);};
const pay = (s,cost) => {for(const [key,value] of Object.entries(cost))requireThat(s.resources[key]>=value,`Faltan recursos: ${RESOURCE_NAMES[key]??key} (${value}).`);for(const [key,value] of Object.entries(cost))s.resources[key]-=value;};
const add = (s,values) => {for(const [key,value] of Object.entries(values))s.resources[key]=(s.resources[key]??0)+value;};
const standing = (s,id,value) => {if(id!=='royalists')s.reputation[id]=clamp(s.reputation[id]+value);};
export function initialCampaign(seed=1812){
  return migrateDeploymentReturns(migrateEnemyGroups(migrateEquipment(migrateMorale(migrateAssignments(migrateMedicalCare({logisticsNotice:null,contractAttention:initialContractAttention(),assignmentAttention:{version:1,reported:{},notice:null},equipmentShipments:[],missions:{},sceneStates:{},missionAllies:{},garrisons:{},nextMilitiaId:20000,quests:{},cityLoyaltyEvents:[],contracts:{},militiaTraining:[],horseState:initialHorseState(),version:1,seed:seed>>>0,hour:0,phase:0,location:'retiro',activeSquadId:'squad-1',squads:[{id:'squad-1',name:'Primera escuadra',members:[],location:'retiro'}],sectorStates:{},resources:{...MATERIAL_STOCK,treasury:3200,horses:35,powder:100,copper:35,textiles:240,infantry:0,muskets:90,sabres:25,cartridges:300,uniforms:0,cannons:0,ponchos:6},reputation:{directory:35,gauchos:0,pardos:10,foreign:20,indigenous:0,royalists:-100},sectors:Object.fromEntries(CAMPAIGN_SECTORS.map(x=>[x.id,{owner:['buenos_aires','retiro','ensenada'].includes(x.id)?'patriot':'royalist',loyalty:['buenos_aires','retiro','ensenada'].includes(x.id)?65:25,militia:[0,0,0],damageUntil:0,fort:0}])),artillerySelection:[],armory:{},loadouts:{},lastConversation:null,conversations:{},officer:null,recruited:[],squad:[],operativeState:Object.fromEntries([...OPERATIVES,...CIVIC_RECRUITS].map(o=>[o.id,{hp:o.maxHp,fatigue:0,alive:true,xp:0,priming:50,flints:4,rations:2,torches:2,condition:100}])),flags:{academy:false,sanLorenzo:false,northPact:false,partisanSupply:false,foundry:false,parliament:false,emancipation:false,commission:false,mentoring:false},production:[],shipments:[],depots:{},convoys:[],routes:{posta:false,flotilla:false,carts:false,mules:false},blockade:false,pendingBattle:null,completed:false,defeated:false,log:[{hour:0,text:'Buenos Aires, 1812. El Cabildo encomienda la formación de los Granaderos. Prepará tu hoja de servicio y reuní a los primeros voluntarios.'}],lastError:null},[...OPERATIVES,...CIVIC_RECRUITS]),[...OPERATIVES,...CIVIC_RECRUITS]),[...OPERATIVES,...CIVIC_RECRUITS]))));
}
export function isSupplied(s,id){
  if(s.sectors[id]?.owner!=='patriot')return false;
  const visited=new Set(['buenos_aires']),queue=['buenos_aires'];
  while(queue.length){const here=queue.shift();for(const next of sector(here).neighbors){if(!visited.has(next)&&s.sectors[next].owner==='patriot'){visited.add(next);queue.push(next);}}}
  return visited.has(id);
}
export function recruitmentStatus(s,id,local=false){
  if(s.recruited.includes(id))return {available:false,reason:'Ya se encuentra en tus filas.'};
  if(!s.operativeState[id]?.alive)return {available:false,reason:'Ha caído en combate.'};
  if(s.operativeState[id]?.captured)return {available:false,reason:'Está prisionero. Liberá el sector donde está detenido.'};
  const conditions={
    0:[s.flags.northPact,'Acuerda la defensa autónoma del norte.'],
    1:[s.flags.partisanSupply,'Entrega 50 mosquetes a las partidas del norte.'],
    2:[s.sectors.mendoza.owner==='patriot','Libera Mendoza.'],
    5:[s.reputation.foreign>=30&&!s.blockade,'Asegura el comercio y eleva a 30 el prestigio entre los extranjeros.'],
    6:[s.flags.sanLorenzo,'Vence en San Lorenzo.'],
    7:[s.flags.emancipation&&s.reputation.pardos>=30,'Proclama la emancipación y eleva a 30 el apoyo de Pardos y Morenos.'],
    8:[s.flags.northPact,'Acuerda la defensa autónoma del norte.'],
    9:[s.sectors.cordoba.owner==='patriot'&&s.reputation.gauchos>=10,'Libera Córdoba y respeta a las milicias provinciales.'],
    11:[s.sectors.cordoba.owner==='patriot','Libera Córdoba.'],
    57:[s.phase>=4,'Completa los preparativos de El Plumerillo.'],
  };
  if(!local&&encounterForOperative(id))return {available:false,reason:`Buscá a ${encounterForOperative(id).name} en su localidad y hablá con él o ella.`};
  const [available,reason]=conditions[id]??[false,'No está disponible.'];return {available,reason:available?'Disponible para incorporarse.':reason};
}
export function campaignObjectives(s){
  return PHASES.map((p,i)=>({...p,complete:i<s.phase||(i===4&&s.completed),active:i===s.phase&&!s.completed}));
}
export function availableActions(s){
  return {recruits:OPERATIVES.map(o=>({...o,...recruitmentStatus(s,o.id)})),destinations:CAMPAIGN_SECTORS.filter(x=>x.id!==s.location),recipes:Object.entries(RECIPES).map(([id,r])=>({id,...r})),phase:PHASES[s.phase]};
}
function progress(s){
  if(s.completed)return;
  if(s.phase===0&&s.flags.academy){s.phase=1;note(s,'La academia de Retiro está organizada. Llegan noticias de un desembarco realista junto a San Lorenzo.');}
  if(s.phase===1&&s.flags.sanLorenzo){s.phase=2;standing(s,'directory',15);note(s,'Victoria en San Lorenzo. San Martín marcha al norte para estudiar la situación del Ejército del Norte.');}
  if(s.phase===2&&s.missions?.yatasto?.completed&&s.sectors.tucuman.owner==='patriot'&&s.flags.northPact&&isSupplied(s,'salta')){s.phase=3;s.flags.mentoring=true;note(s,'En Yatasto, San Martín confía el norte a Güemes. El esfuerzo principal se traslada a Cuyo.');}
  if(s.phase===3&&s.flags.foundry&&s.flags.parliament&&s.resources.infantry>=3000&&ownedArtilleryCount(s)>=3&&['mendoza','uspallata','los_patos'].every(id=>s.sectors[id].owner==='patriot'&&s.sectors[id].fort>=1)){
    s.phase=4;note(s,'El Plumerillo alcanza plena capacidad. Tres mil infantes, artillería y pasos seguros: San Martín puede incorporarse al ejército.');
  }
  if(!s.completed&&s.phase===4&&s.recruited.includes(57)&&Object.values(s.sectors).every(x=>x.owner==='patriot')&&!s.blockade&&!s.pendingBattle&&!s.pendingEncounter&&!s.enemyGroups.some(g=>['marching','waiting','engaged','stationed'].includes(g.status))){s.completed=true;note(s,'¡Campaña concluida! Las provincias están libres y el Ejército de los Andes queda preparado para la liberación continental.');for(const op of rosterFor(s).filter(o=>s.recruited.includes(o.id)&&s.operativeState[o.id]?.alive)){const line=speechFor(op,'ending');if(line)note(s,`${op.name}: «${line}»`);}}
  if(s.sectors.buenos_aires.owner!=='patriot'){s.defeated=true;note(s,'La capital ha caído. El ejército debe reorganizarse desde una nueva campaña.');}
}
function raid(s,theater,forcedTarget=null){
  const targets=CAMPAIGN_SECTORS.filter(x=>x.theater===theater&&s.sectors[x.id].owner==='patriot'&&x.id!=='retiro');
  const priorities=theater==='north'?NORTHERN_AXIS:theater==='coast'?['san_nicolas','santa_fe','ensenada','buenos_aires']:['cordoba'];
  targets.sort((a,b)=>theater==='coast'?b.income-a.income:priorities.indexOf(a.id)-priorities.indexOf(b.id));
  const target=forcedTarget?sector(forcedTarget):targets.find(x=>theater!=='interior'||s.sectors[x.id].loyalty<50);if(!target||s.sectors[target.id].owner!=='patriot')return;
  const group=launchEnemyGroup(s,theater,target.id);if(!group)return;
  note(s,theater==='north'?`Pezuela ordena a la vanguardia de Pío Tristán avanzar sobre ${target.name} por Humahuaca.`:theater==='coast'?`Romarate dirige una incursión contra ${target.name}: la recaudación aduanera atrae a la flotilla de Montevideo.`:`Las partidas leales a la Corona marchan contra ${target.name} y los convoyes de Cuyo.`);
  note(s,`${group.initialStrength} realistas en marcha. Llegada prevista en ${group.arrivalAt-s.hour} horas.`);
}
function loseSectorToGroup(s,group){
  const region=s.sectors[group.target];region.damageUntil=s.hour+24*14;recordCityLoyalty(s,{sectorId:group.target,kind:'defeat',eventId:group.id});
  if(group.theater==='coast'){s.blockade=true;note(s,`La flotilla realista establece un bloqueo en ${sector(group.target).name}. Las aduanas reducen sus ingresos.`);}
  else {if(group.theater==='interior'){const powder=Math.min(20,s.resources.powder),silver=Math.min(150,s.resources.treasury);s.resources.powder-=powder;s.resources.treasury-=silver;note(s,`Las partidas saquean ${silver} pesos y ${powder} cargas de pólvora y cortan los convoyes de Cuyo.`);}region.owner='royalist';region.militia=[0,0,0];delete s.garrisons[group.target];note(s,`Los realistas ocupan ${sector(group.target).name} y cortan la ruta de abastecimiento.`);}
  region.militia=[0,0,0];delete s.garrisons[group.target];group.status='stationed';group.resolvedAt=s.hour;
}
function addDefenseHistory(s,group,outcome,casualties,text,extra={}){s.encounterHistory.unshift({groupId:group.id,sector:group.target,hour:s.hour,outcome,casualties,text,...extra});s.encounterHistory=s.encounterHistory.slice(0,40);}
function settleEnemyEncounters(s,options={}){
  if(s.pendingBattle||s.pendingEncounter)return;
  for(const group of s.enemyGroups.filter(g=>g.status==='waiting').sort((a,b)=>a.arrivalAt-b.arrivalAt)){
    if(s.sectors[group.target].owner!=='patriot'&&!localDefenderCount(s,group.target,{exclude:options.traveling??[]})){group.status='stationed';group.resolvedAt=s.hour;continue;}
    if(!localDefenderCount(s,group.target,{exclude:options.traveling??[]})){loseSectorToGroup(s,group);addDefenseHistory(s,group,'defeat',[],`${sector(group.target).name} no tenía defensores presentes.`);continue;}
    queueEnemyEncounter(s);note(s,`¡Contacto en ${sector(group.target).name}! Elegí defensa táctica, resolución automática o retirada.`);break;
  }
}
function meetEnemyGroups(s,at){
  // A battle already in progress owns its enemy roster until its report returns.
  if(s.pendingBattle?.sector===at)return;
  haltEnemyGroupsAt(s,at);
  for(const group of occupyingGroups(s,at)){group.status='waiting';group.resolvedAt=null;}
}
function relocateDefenders(s,ids,destination,moralePenalty=5){
  for(const id of ids){recordStrategicArrival(s,[id],operativeLocation(s,id),destination);const r=s.operativeState[id];r.location=destination;r.assignment='active';r.asleep=false;r.recoveryHours=0;r.energy=Math.max(0,r.energy-10);gainFatigue(r,8);r.morale=Math.max(0,r.morale-moralePenalty);}
  for(const squad of s.squads)if(squad.members.some(id=>ids.includes(id))){delete squad.journey;squad.location=destination;if(squad.id===s.activeSquadId)s.location=destination;}
  for(const horse of s.horseState.horses)if(ids.includes(horse.assignedTo))horse.location=destination;
}
function captureOperatives(s,ids,at,ammunition={}){
  for(const id of ids){const r=s.operativeState[id],contract=clone(s.contracts[id]);removeFromService(s,id);Object.assign(r,{captured:true,capturedSector:at,capturedAt:s.hour,capturedContract:contract,capturedAmmunition:clone(ammunition[id]??{loaded:0,ammo:0}),location:at});}
  if(ids.length)note(s,`${ids.map(id=>rosterFor(s).find(o=>o.id===id).nickname).join(', ')} quedan prisioneros en ${sector(at).name}.`);
}
function releaseCaptives(s,at){
  for(const h of s.horseState.horses)if(h.custody?.kind==='field'&&h.location===at){h.custody=null;h.assignedTo=null;}
  for(const op of rosterFor(s)){
    const r=s.operativeState[op.id];if(!r.captured||r.capturedSector!==at)continue;
    const held=r.capturedAmmunition??{loaded:0,ammo:0};
    s.resources.cartridges+=held.ammo+(held.preserveLoading?0:held.loaded);if(held.preserveLoading){r.carriedAmmo=(r.carriedAmmo??0)+held.loaded;setCarriedLoading(r,{weapon:op.weapon,...held});}r.capturedAmmunition={loaded:0,ammo:0};
    for(const h of s.horseState.horses)if(h.custody?.kind==='captured'&&h.custody.operativeId===op.id){h.custody=null;h.assignedTo=null;}
    const contract=clone(r.capturedContract),remaining=contract.expiresAt===null?null:Math.max(0,contract.expiresAt-r.capturedAt);delete contract.departurePending;
    Object.assign(r,{asleep:false,captured:false,capturedSector:null,capturedAt:null,capturedContract:null,location:at,arrival:null,residentSector:at,residentScene:null,assignment:r.hp<r.maxHp||r.bleeding?'patient':'rest'});
    if(remaining===0){r.assignment='active';note(s,`${op.name} queda libre en ${sector(at).name}. Su contrato había terminado y puede volver a contratarse.`);continue;}
    if(remaining!==null)contract.expiresAt=s.hour+remaining;s.contracts[op.id]=contract;s.recruited.push(op.id);if(s.location===at&&s.squad.length<6)s.squad.push(op.id);note(s,`${op.name} vuelve al servicio tras la liberación de ${sector(at).name}. Conserva sus heridas y equipo.`);
  }
}
function prepareDefense(s,group,{excludeMercs=false}={}){
  const at=group.target,def=sector(at),ids=excludeMercs?[]:localDefenderIds(s,at),allocated={},localAmmo=s.depots?.[at]?.cartridges??0;let stock=s.resources.cartridges+localAmmo;
  for(const q of s.squads)if(q.members.some(id=>ids.includes(id)))delete q.journey;
  for(const id of ids){s.operativeState[id].assignment='active';s.operativeState[id].asleep=false;s.operativeState[id].recoveryHours=0;allocated[id]=allocateEquipmentAmmo(s,rosterFor(s).find(o=>o.id===id),stock);stock-=allocated[id].loaded+allocated[id].ammo-(s.operativeState[id].carriedAmmo??0);if(s.operativeState[id].carriedAmmo!==undefined)s.operativeState[id].carriedAmmo=0;clearCarriedLoading(s.operativeState[id]);}
  const issued=s.resources.cartridges+localAmmo-stock,fromDepot=Math.min(localAmmo,issued);s.resources.cartridges-=issued-fromDepot;if(fromDepot)s.depots[at].cartridges-=fromDepot;
  const request={id:`defense-${group.id}-${s.hour}`,sector:at,origin:s.location,name:`Defensa de ${def.name}`,biome:def.biome,theater:def.theater,seed:group.seed,hour:s.hour,secondOfHour:s.secondOfHour??0,defenseGroupId:group.id,defenseFort:s.sectors[at].owner==='patriot'?s.sectors[at].fort:0,issuedCartridges:Object.values(allocated).reduce((sum,u)=>sum+u.loaded+u.ammo,0),wasRoyalist:s.sectors[at].owner==='royalist',difficulty:1,squad:ids.map(id=>({...clone(rosterFor(s).find(o=>o.id===id)),...clone(s.operativeState[id]),...deploymentMorale(s,id),...allocated[id],...(mountForOperative(s.horseState,id)??{horse:false,canMount:false})})),enemies:clone(group.units),garrison:prepareGarrison(s,at),artillery:[],weather:{rain:false,humidity:def.theater==='coast'?.8:.3},enemyCommand:group.command,enemyCommander:ROYALIST_COMMANDS.find(c=>c.id===group.command).commander};
  group.status='engaged';s.pendingEncounter=null;s.pendingBattle=prepareDeploymentExits(s,prepareSectorArtillery(s,request));return request;
}
function finishDefense(s,request,outcome,snapshot,plan){
  const group=recordEnemyGroupResult(s,request.defenseGroupId,snapshot,outcome),ids=request.squad.map(u=>Number(u.id)),casualties=ids.filter(id=>!s.operativeState[id].alive);const captured=plan.entries.filter(e=>e.kind==='captured').map(e=>Number(e.unitId));
  if(outcome==='victory'){if(request.wasRoyalist&&!s.enemyGroups.some(g=>g.target===group.target&&['waiting','engaged','stationed'].includes(g.status))){s.sectors[group.target].owner='patriot';releaseCaptives(s,group.target);}recordCityLoyalty(s,{sectorId:group.target,kind:'defense',eventId:group.id});if(group.theater==='coast'&&!s.enemyGroups.some(g=>g.theater==='coast'&&g.status==='stationed'))s.blockade=false;note(s,`La defensa de ${sector(group.target).name} rechaza a ${group.initialStrength} realistas.`);}
  else loseSectorToGroup(s,group);
  for(const squad of s.squads)squad.members=squad.members.filter(id=>s.operativeState[id].alive&&!s.operativeState[id].captured);s.squad=s.squad.filter(id=>s.operativeState[id].alive&&!s.operativeState[id].captured);
  const militiaCasualties=(request.garrison??[]).filter(u=>snapshot.units.find(v=>String(v.id)===String(u.id))?.hp<=0).map(u=>u.id),militiaDispersed=outcome==='victory'?0:(request.garrison?.length??0)-militiaCasualties.length;const text=`${sector(group.target).name}: ${outcome==='victory'?'defensa victoriosa':outcome==='retreat'?'retirada':'defensa derrotada'}. ${casualties.length} granaderos y ${militiaCasualties.length} milicianos caídos; ${captured.length} prisioneros${militiaDispersed?`; ${militiaDispersed} milicianos dispersos`:''}.`;addDefenseHistory(s,group,outcome,casualties,text,{captured,militiaCasualties,militiaDispersed,dispositions:clone(plan.entries)});note(s,text);s.sectorStates[group.target]=clone(snapshot);s.pendingBattle=null;
  if(!s.recruited.some(id=>s.operativeState[id].alive))s.defeated=true;
}
function applyTacticalTime(s,request,elapsed){
  const previous=request.syncedSeconds??0;requireThat(Number.isSafeInteger(elapsed)&&elapsed>=previous&&elapsed-previous<=864000,'El tiempo táctico es inválido.');const seconds=(s.secondOfHour??0)+elapsed-previous,hours=Math.floor(seconds/3600);s.secondOfHour=seconds%3600;if(hours)tick(s,hours);request.syncedSeconds=elapsed;
}
function resolveDefenseAutomatically(s,request){
  const result=autoResolve(request,s.sectorStates[request.sector]??null);applyTacticalTime(s,request,result.battle.elapsedSeconds??0);result.battle.syncedSeconds=request.syncedSeconds;result.battle.savedHour=s.hour;result.battle.savedSecond=s.secondOfHour;
  if(result.outcome===null){request.resumeSnapshot=clone(result.battle);note(s,'La resolución automática continúa pendiente. Retomá el combate y ayudá a quienes aún no pudieron salir.');return;}
  const next=dispatchCampaign(s,{type:'battleResult',battleId:request.id,outcome:result.outcome,survivors:result.battle.units.filter(u=>u.side==='player'),sectorState:result.battle});requireThat(!next.lastError,next.lastError);Object.assign(s,next);
}
function completedTacticalVictory(snapshot){
  const playersRemain=snapshot.units.some(u=>u.side==='player'&&fieldCapable(u)),enemiesRemain=snapshot.units.some(u=>u.side==='enemy'&&fieldCapable(u));
  const clearedExploration=snapshot.status==='active'&&snapshot.mode==='exploration'&&snapshot.phase==='player'&&snapshot.sectorCleared===true&&!snapshot.enemyTurn&&!snapshot.interrupt&&!snapshot.reactionStack;
  return playersRemain&&!enemiesRemain&&(snapshot.status==='victory'||clearedExploration);
}
function completeDeploymentReport(s,request,action){
  requireThat(action.sectorState&&Array.isArray(action.survivors),'El despliegue necesita un estado táctico completo y un parte de todos los combatientes.');
  const raw=action.sectorState,snapshot=validateSectorSnapshot(raw),ids=request.squad.map(u=>String(u.id));
  requireThat(snapshot.battleId===request.id&&snapshot.sectorId===request.sector&&(snapshot.sceneId??null)===(request.sceneId??null),'El estado táctico no corresponde al despliegue y sector pendientes.');
  const previous=request.sceneId?s.sceneStates[request.sceneId]:s.sectorStates[request.sector];
  const auxiliary=[...(request.garrison??[]),...(request.missionAllies??[])].map(u=>String(u.id)),known=new Set([...ids,...auxiliary]),corpses=[...(previous?.units??[]).filter(u=>u.side==='player'&&u.hp<=0),...(request.remains??[]).map(r=>r.unit)].map(u=>String(u.id)),received=action.survivors.map(u=>u&&String(u.id));
  requireThat(action.survivors.every(u=>u&&typeof u==='object'&&!Array.isArray(u))&&new Set(received).size===received.length&&received.every(id=>known.has(id)||corpses.includes(id))&&ids.every(id=>received.includes(id)),'El parte debe incluir exactamente a todos los combatientes desplegados, vivos o caídos.');
  const players=snapshot.units.filter(u=>u.side==='player');
  requireThat([...ids,...auxiliary,...(request.remains??[]).map(r=>r.unitId)].every(id=>players.some(u=>u.id===id))&&players.every(u=>known.has(u.id)||(u.hp<=0&&corpses.includes(u.id))),'El estado táctico contiene una escuadra incompleta o ajena al despliegue.');
  const source=!request.exploration&&!request.defenseGroupId&&!request.occupationGroupIds?.length&&previous&&!previous.sectorCleared?previous.units.filter(u=>u.side==='enemy'&&!u.departure):request.enemies??[],enemyIds=new Set(source.map(u=>String(u.id))),enemies=snapshot.units.filter(u=>u.side==='enemy');
  const oldEnemyBodies=(previous?.units??[]).filter(u=>u.side==='enemy'&&u.hp<=0&&!u.departure);
  requireThat([...enemyIds].every(id=>enemies.some(u=>u.id===id))&&enemies.every(u=>enemyIds.has(u.id)||u.hp<=0&&oldEnemyBodies.some(old=>old.id===u.id||u.originalUnitId===old.id&&u.id.startsWith(`corpse:${previous.battleId??request.sector}:${old.id}`))),'El estado táctico no incluye a todos los enemigos del despliegue.');
  const required=['hp','maxHp','weapon','condition','jammed','loaded','ammo','inventory','bleeding','bandaged','energy','medkits','fatigue','priming','flints','rations','torches','boleadoras','activeSlot'];
  if(request.fittingRulesVersion===FITTING_RULES_VERSION){requireThat(raw.fittingRulesVersion===FITTING_RULES_VERSION,'El parte no contiene la versión de accesorios del despliegue.');required.push('weaponFittings','weaponFittingPattern','bladeFittingPattern');}
  for(const id of known){const unit=raw.units.find(u=>u.side==='player'&&String(u.id)===id);requireThat(unit&&required.every(key=>Object.hasOwn(unit,key)&&unit[key]!==undefined),'El equipo y la salud del combatiente están incompletos.');}
  const commander=snapshot.units.find(u=>Number(u.id)===57&&u.missionAlly),missionFailed=request.missionId==='san_lorenzo'&&commander?.hp<=0,able=side=>snapshot.units.some(u=>u.side===side&&fieldCapable(u));
  requireThat(request.exploration||missionFailed||(action.outcome==='victory'?completedTacticalVictory(snapshot):action.outcome==='retreat'?snapshot.status==='retreat'&&!able('player')&&snapshot.units.some(u=>u.side==='player'&&u.departure):snapshot.status===action.outcome&&!able('player')),'El resultado no corresponde al desenlace táctico.');
  validateArtilleryReport(request,snapshot);
  return {snapshot,reports:ids.map(id=>players.find(u=>u.id===id))};
}
function applyReturnedOperative(s,request,report){
  const id=Number(report.id),op=rosterFor(s).find(o=>o.id===id);returnMount(s,id,report);returnTraining(s,id,report);returnEquipment(s,id,report);returnMedicalCare(s,id,report,op);returnMorale(s,id,report,request.squad.find(u=>Number(u.id)===id));
  for(const [field,max]of Object.entries({energy:100,weight:1000,strength:100,strengthTraining:10000,priming:100000,flints:100000,rations:100000,torches:100000,condition:100,fatigue:100,boleadoras:100000}))if(report[field]!==undefined){requireThat(Number.isFinite(report[field])&&report[field]>=0&&report[field]<=max,'El estado del combatiente es inválido.');s.operativeState[id][field]=report[field];}
  if(s.operativeState[id].sleepCollapsed&&!needsCollapseRecovery(s.operativeState[id]))s.operativeState[id].sleepCollapsed=false;
  s.operativeState[id].inventory=clone(validatePersonalInventory(report.inventory));
  validatePocketOrder(report.pocketOrder);if(report.pocketOrder===undefined)delete s.operativeState[id].pocketOrder;else s.operativeState[id].pocketOrder=clone(report.pocketOrder);
}
function commitDeploymentReturn(s,request,snapshot,plan){
  applyTacticalTime(s,request,snapshot.elapsedSeconds??0);snapshot.syncedSeconds=request.syncedSeconds;snapshot.savedHour=s.hour;snapshot.savedSecond=s.secondOfHour;
  for(const entry of plan.entries){const id=Number(entry.unitId),unit=snapshot.units.find(u=>u.side==='player'&&u.id===entry.unitId);applyReturnedOperative(s,request,unit);const r=s.operativeState[id];r.location=entry.sector;
    clearCarriedLoading(r);const loading=plan.ammunition.carried[id];if(loading){r.carriedAmmo=(r.carriedAmmo??0)+loading.loaded;setCarriedLoading(r,{weapon:unit.weapon,...loading});}
    r.arrival=entry.kind==='departed'?{battleId:request.id,fromSector:request.sector,fromScene:request.sceneId??null,exitId:entry.departure.exitId,entryEdge:entry.departure.entryEdge,entryAnchor:clone(entry.departure.entryAnchor)}:null;
    r.residentSector=entry.kind==='resident'?request.sector:null;r.residentScene=entry.kind==='resident'?(request.sceneId??null):null;
  }
  s.resources.cartridges+=plan.ammunition.creditedCartridges;
  if(request.exploration)recordCasualtyMorale(s,plan.entries.filter(e=>e.kind==='dead').map(e=>Number(e.unitId)),request.squad.map(u=>Number(u.id)));else recordBattleMorale(s,request,plan.outcome,snapshot);
  const captured=plan.entries.filter(e=>e.kind==='captured').map(e=>Number(e.unitId));captureOperatives(s,captured,plan.sourceSector,plan.ammunition.custody);
  s.squads=clone(plan.squadChanges.squads);const selected=s.squads.find(q=>q.id===s.activeSquadId);s.squad=[...selected.members];s.location=selected.location;
  for(const change of plan.horseChanges)Object.assign(s.horseState.horses.find(h=>h.id===change.id),clone(change));
  for(const h of s.horseState.horses)if(h.custody?.kind==='field'&&s.sectors[h.location]?.owner==='patriot'&&!occupyingGroups(s,h.location).length&&plan.outcome!=='defeat')h.custody=null;
  returnGarrison(s,request,snapshot,plan.auxiliary);
  settleSectorArtillery(snapshot,plan.outcome);
  snapshot.returnLedger={battleId:request.id,entries:clone([...plan.entries,...plan.auxiliary]),creditedCartridges:plan.ammunition.creditedCartridges};
  const delivered=new Set((request.remains??[]).map(r=>`${r.battleId}:${r.unitId}`));s.sectorRemains[plan.sourceSector]=(s.sectorRemains[plan.sourceSector]??[]).filter(r=>!delivered.has(`${r.battleId}:${r.unitId}`));
  for(const e of [...plan.entries,...plan.auxiliary].filter(e=>e.kind==='dead'&&e.departure)){
    const unit=clone(snapshot.units.find(u=>u.id===e.unitId));delete unit.entryEdge;delete unit.entryAnchor;delete unit.entryReason;s.sectorRemains[e.sector]??=[];s.sectorRemains[e.sector].push({battleId:request.id,unitId:e.unitId,unit,entryEdge:e.departure.entryEdge,entryAnchor:clone(e.departure.entryAnchor)});
  }
  if(request.sceneId)s.sceneStates[request.sceneId]=clone(snapshot);else s.sectorStates[request.sector]=clone(snapshot);
}
function deployed(s,id){return s.pendingBattle?.squad?.some(u=>Number(u.id)===Number(id));}
function advanceCampaignHorses(s){
 const held=s.horseState.horses.filter(h=>deployed(s,h.assignedTo)||operativeInTransit(s,h.assignedTo));
 s.horseState=applyHorseAction(s.horseState,{type:'advance',hour:s.hour});
 for(const h of held){const next=s.horseState.horses.find(v=>v.id===h.id);Object.assign(next,{stamina:h.stamina,condition:Math.min(h.condition,next.condition),assignedTo:h.assignedTo,returned:Boolean(h.returned)});}
}
function releaseDeferred(s){if(s.pendingBattle)return;if(s.horseState.horses.some(h=>h.hired&&!h.returned&&h.hireUntil<=s.hour))advanceCampaignHorses(s);for(const id of [...s.recruited])if(s.contracts?.[id]?.departurePending&&!operativeInTransit(s,id)){removeFromService(s,id);note(s,'Un voluntario cumple su contrato y deja el destacamento.');}const raids=s.deferredRaids??[];s.deferredRaids=[];for(const r of raids)launchEnemyGroup(s,r.theater,r.target,{immediate:true});settleEnemyEncounters(s);}
function assignmentContext(s,options={}){
  const unsafe=s.recruited.filter(id=>s.enemyGroups.some(g=>['waiting','engaged','stationed'].includes(g.status)&&g.target===operativeLocation(s,id)));
  return {...options,isSupplied,unsafe,traveling:[...(options.traveling??[]),...travelingOperatives(s),...unsafe]};
}
function pauseForAssignments(s,hours,advancedHours,extraEvents=[]){
  const events=collectAssignmentAttention(s,assignmentStates(s,rosterFor(s),assignmentContext(s)),extraEvents);
  if(!events.length)return false;
  s.assignmentAttention.notice={hour:s.hour,requestedHours:hours,advancedHours,events};
  note(s,`El avance se detuvo tras ${advancedHours} de ${hours} horas: hay novedades en las asignaciones.`);
  return true;
}
function pauseForContracts(s,hours,advancedHours,extra=[]){
  const events=collectContractAttention(s,extra);
  if(!events.length)return false;
  s.contractAttention.notice={hour:s.hour,requestedHours:hours,advancedHours,events};
  note(s,`El avance se detuvo tras ${advancedHours} de ${hours} horas: hay contratos por revisar.`);
  return true;
}
function recordSleepEvents(s,events){
  return events.map(event=>{note(s,`${rosterFor(s).find(op=>op.id===event.id).nickname}: ${SLEEP_ISSUE_TEXT[event.code]}`);return sleepAttention(s,event);});
}
function tick(s,hours,options={}){
  requireThat(Number.isInteger(hours)&&hours>=1&&hours<=240,'El avance debe ser de 1 a 240 horas.');
  const sleepEvents=recordSleepEvents(s,prepareSleep(s,rosterFor(s),assignmentContext(s,options)));
  if(options.pauseOnAssignments){
    // A second explicit wait acknowledges the notice. The reported task markers
    // prevent an unchanged shortage from trapping the clock at the same hour.
    s.assignmentAttention.notice=null;s.travelNotice=null;s.contractAttention.notice=null;s.logisticsNotice=null;
    const assignmentPause=pauseForAssignments(s,hours,0,sleepEvents),contractPause=pauseForContracts(s,hours,0);
    if(assignmentPause||contractPause)return;
  }
  for(let i=0;i<hours;i++){
    const assignmentEvents=[],contractEvents=[],logisticsEvents=[],militiaWorked=[];
    s.hour++;for(const id of [...s.recruited]){const contract=s.contracts?.[id];if(contract?.expiresAt!==null&&contract?.expiresAt!==undefined&&contract.expiresAt<=s.hour){if(s.operativeState[id]?.alive&&!s.operativeState[id].captured)contractEvents.push({operativeId:id,expiresAt:contract.expiresAt,code:'expired'});if(deployed(s,id)||operativeInTransit(s,id)){contract.departurePending=true;continue;}const name=rosterFor(s).find(o=>o.id===id)?.name??'Un combatiente';removeFromService(s,id);note(s,`${name} concluye su contrato y deja el destacamento. Su hoja de servicio queda disponible.`);}}advanceCampaignHorses(s);
    for(const course of [...(s.militiaTraining??[])]){
      if(s.sectors[course.sector].owner!=='patriot'){s.militiaTraining=s.militiaTraining.filter(t=>t!==course);assignmentEvents.push(militiaCancellationAttention(course));note(s,'La ocupación enemiga dispersa un curso de milicias.');continue;}
      if(militiaAssignmentIssue(s,course,{isSupplied}))continue;
      const trainer=s.operativeState[course.trainerId];if(trainer){trainer.energy=Math.max(0,trainer.energy-3);gainFatigue(trainer,2);militiaWorked.push(course.trainerId);}
      course.remaining--;if(course.remaining<=0){if(course.rank>0)returnMilitiaTrainees(s,course,true);else s.sectors[course.sector].militia[0]+=course.count;s.militiaTraining=s.militiaTraining.filter(t=>t!==course);assignmentEvents.push(militiaCompletionAttention(course));note(s,`Tres milicianos completan su instrucción en ${sector(course.sector).name}.`);}
    }
    for(const convoy of [...(s.convoys??[])])if(convoyStatus(s,convoy).ready){
      const inventory=convoy.destination==='reserve'?s.resources:(s.depots[convoy.destination]??={});
      for(const [key,value] of Object.entries(convoy.goods))inventory[key]=(inventory[key]??0)+value;
      s.convoys.splice(s.convoys.indexOf(convoy),1);logisticsEvents.push({kind:'convoy',sector:convoy.destination,goods:clone(convoy.goods)});note(s,`El convoy entrega sus pertrechos en ${convoy.destination==='reserve'?'la reserva de Buenos Aires':sector(convoy.destination).name}.`);
    }
    logisticsEvents.push(...deliverEquipmentShipments(s));advanceMerchants(s,isSupplied);
    for(const task of [...s.production])if(task.due<=s.hour&&s.sectors[task.sector].owner==='patriot'&&isSupplied(s,task.sector)){add(s,task.yield);s.production.splice(s.production.indexOf(task),1);logisticsEvents.push({kind:'production',sector:task.sector,name:task.name,goods:clone(task.yield)});note(s,`La maestranza completó: ${task.name}.`);}
    for(const shipment of [...s.shipments])if(shipment.due<=s.hour&&!s.blockade&&s.sectors.ensenada.owner==='patriot'){add(s,shipment.goods);s.shipments.splice(s.shipments.indexOf(shipment),1);logisticsEvents.push({kind:'shipment',sector:'ensenada',goods:clone(shipment.goods)});note(s,'Arribó un cargamento de contrabando a Ensenada.');}
    advanceMarchFatigue(s,rosterFor(s).map(op=>({...op,...(mountForOperative(s.horseState,op.id)??{})})),options);
    const careOptions=assignmentContext(s,options);const deaths=advanceMedicalCare(s,rosterFor(s),careOptions);advanceAssignments(s,rosterFor(s),careOptions);recordCasualtyMorale(s,deaths);advanceMorale(s,rosterFor(s),careOptions);
    for(const id of deaths){
      s.operativeState[id].location=operativeLocation(s,id);
      for(const squad of s.squads)squad.members=squad.members.filter(member=>member!==id);
      s.squad=s.squad.filter(member=>member!==id);
      for(const horse of s.horseState.horses)if(horse.assignedTo===id)horse.assignedTo=null;
      for(const course of s.militiaTraining.filter(t=>t.trainerId===id))returnMilitiaTrainees(s,course);
      s.militiaTraining=s.militiaTraining.filter(t=>t.trainerId!==id);
      note(s,`${rosterFor(s).find(o=>o.id===id).name} fallece por sus heridas.`);
    }
    if(deaths.length&&!s.recruited.some(id=>s.operativeState[id].alive))s.defeated=true;
    if(s.hour%24===0){
      dailyPolitics(s);
      const income=totalSectorIncome(s,isSupplied);
      // Pay using the current loyalty, then improve next day's cooperation.
      for(const def of CAMPAIGN_SECTORS){const region=s.sectors[def.id];if(region.owner==='patriot'&&isSupplied(s,def.id))region.loyalty=Math.min(100,region.loyalty+1);}
      add(s,{treasury:income,textiles:s.sectors.cordoba.owner==='patriot'?50:20,copper:1,horses:2,...materialYield(s,isSupplied)});
      note(s,`Las estancias y aduanas aportaron ${income} pesos a la tesorería.`);
    }
    if(s.hour%720===0){const ids=s.recruited.filter(id=>s.operativeState[id].alive&&s.contracts?.[id]?.kind==='legacy'),payroll=ids.reduce((sum,id)=>sum+rosterFor(s).find(o=>o.id===id).monthlyPay,0);if(payroll>0){if(s.resources.treasury>=payroll){s.resources.treasury-=payroll;recordPayMorale(s,ids,true);standing(s,'foreign',5);note(s,`Se abonaron ${payroll} pesos en estipendios mensuales.`);}else{recordPayMorale(s,ids,false);standing(s,'foreign',-20);standing(s,'directory',-10);note(s,'La tesorería no pudo abonar los sueldos. Los voluntarios reclaman el pago.');}}}
    if(!s.completed&&s.hour%120===0)raid(s,'north');
    if(!s.completed&&s.hour%168===0&&coastalRevenue(s)>=500)raid(s,'coast');
    if(!s.completed&&s.hour%144===0)raid(s,'interior');
    assignmentEvents.push(...recordSleepEvents(s,finishSleepHour(s,rosterFor(s),{...assignmentContext(s,options),working:militiaWorked})));
    delayCrossingEnemyGroups(s,{elapsedHour:1,travelLeg:options.traveling?.length?options.travelLeg:null});
    const travelAttention=advanceSquadTravel(s,rosterFor(s),{note,onArrival:q=>meetEnemyGroups(s,q.location),releaseAtArrival:q=>{for(const id of [...q.members])if(s.contracts[id]?.departurePending){removeFromService(s,id);note(s,'Un voluntario cumple su contrato y deja la escuadra al llegar.');}}});
    advanceEnemyGroups(s);
    for(const q of s.squads)if(q.journey?.status==='moving'&&q.journey.elapsed===0&&s.enemyGroups.some(g=>g.target===q.location&&['waiting','engaged','stationed'].includes(g.status))){q.journey.status='paused';q.journey.reason='contact';}
    settleEnemyEncounters(s,options);progress(s);
    assignmentEvents.push(...recordSleepEvents(s,prepareSleep(s,rosterFor(s),assignmentContext(s,options))));
    // Finish every hourly subsystem before stopping an explicit wait. Travel
    // and tactical synchronization must process their complete durations.
    const assignmentPause=options.pauseOnAssignments&&pauseForAssignments(s,hours,i+1,assignmentEvents);
    const contractPause=options.pauseOnAssignments&&pauseForContracts(s,hours,i+1,contractEvents);
    const logisticsPause=options.pauseOnAssignments&&recordLogisticsNotice(s,hours,i+1,logisticsEvents);
    if(logisticsPause)note(s,`El avance se detuvo tras ${i+1} de ${hours} horas: se completó una producción o entrega.`);
    if(s.defeated||s.pendingEncounter&&!s.pendingBattle&&!options.traveling||assignmentPause||contractPause||logisticsPause||options.pauseOnAssignments&&travelAttention)break;
  }
}
function travelPath(s,from,to){
  const queue=[[from]],seen=new Set([from]);while(queue.length){const path=queue.shift(),last=path.at(-1);if(last===to)return path;for(const id of sector(last).neighbors)if(!seen.has(id)&&s.sectors[id].owner==='patriot'){seen.add(id);queue.push([...path,id]);}}return null;
}
function prepareAttack(s,at,origin,ids,assaultSquads=null){
 if(at!=='san_lorenzo')haltEnemyGroupsAt(s,at,'stationed');
 const san=at==='san_lorenzo',def=san?{id:at,name:'Combate de San Lorenzo',biome:'river',theater:'coast'}:sector(at);
  const allocated={},sources=assaultSquads??[{origin,members:ids}];
  for(const group of sources){const localAmmo=s.depots?.[group.origin]?.cartridges??0;let stock=s.resources.cartridges+localAmmo;
    for(const id of group.members){allocated[id]=allocateEquipmentAmmo(s,rosterFor(s).find(o=>o.id===id),stock);stock-=allocated[id].loaded+allocated[id].ammo-(s.operativeState[id].carriedAmmo??0);if(s.operativeState[id].carriedAmmo!==undefined)s.operativeState[id].carriedAmmo=0;clearCarriedLoading(s.operativeState[id]);}
    const used=s.resources.cartridges+localAmmo-stock,fromDepot=Math.min(localAmmo,used);pay(s,{cartridges:used-fromDepot});if(fromDepot)s.depots[group.origin].cartridges-=fromDepot;
  }
  pay(s,{powder:3});
        s.pendingBattle={id:`${at}-${s.hour}-${s.seed}`,origin,sector:at,hour:s.hour,secondOfHour:s.secondOfHour??0,name:def.name,biome:def.biome,theater:def.theater,seed:Math.floor(random(s)*4294967296),issuedCartridges:Object.values(allocated).reduce((sum,u)=>sum+u.loaded+u.ammo,0),wasRoyalist:!san&&s.sectors[at].owner==='royalist',squad:ids.map(id=>({...clone(rosterFor(s).find(o=>o.id===id)),...clone(s.operativeState[id]),...deploymentMorale(s,id),...allocated[id],...(mountForOperative(s.horseState,id)??{horse:false,canMount:false}),poncho:s.resources.ponchos>=ids.length})),difficulty:san?2:Math.min(4,1+Math.floor(s.hour/240)+(def.theater==='north'?1:0)),weather:{rain:def.biome==='wetland'||random(s)<0.2,humidity:def.theater==='coast'?0.8:0.3},cannons:s.resources.cannons+(s.depots?.[at]?.cannons??0)};s.pendingBattle.artillery=deployedArtillery({...s,location:origin});Object.assign(s.pendingBattle,oppositionFor(assaultSquads?{...s.pendingBattle,squad:s.pendingBattle.squad.slice(0,6)}:s.pendingBattle));const occupying=san?[]:occupyingGroups(s,at);if(occupying.length){s.pendingBattle.occupationGroupIds=occupying.map(g=>g.id);s.pendingBattle.enemies=occupying.flatMap(g=>clone(g.units));}if(san){recordStrategicArrival(s,ids,origin,at);s.pendingBattle.missionId='san_lorenzo';s.pendingBattle.missionAllies=[sanLorenzoAlly(s)];}s.pendingBattle.garrison=prepareGarrison(s,at);s.pendingBattle.garrisonLootSources=(s.sectorStates[at]?.units??[]).filter(u=>u.militia&&u.hp<=0).map(u=>({id:u.id,ammo:u.ammo??0,loaded:u.loaded??0}));note(s,`El destacamento se despliega para ${def.name}. Mando enemigo: ${s.pendingBattle.enemyCommander}.`);
  if(assaultSquads)s.pendingBattle.assaultSquads=clone(assaultSquads);
}
export function dispatchCampaign(previous,action){
  const s=migrateSquads(clone(previous));s.logisticsNotice??=null;s.horseState??={...initialHorseState(),hour:s.hour};s.lastError=null;s.militiaTraining??=[];s.missions??={};s.sceneStates??={};s.missionAllies??={};s.quests??={};migrateContracts(s);migrateMedicalCare(s,rosterFor(s));migrateAssignments(s,rosterFor(s));migrateAssignmentAttention(s);migrateContractAttention(s);migrateMorale(s,rosterFor(s));migrateEquipment(s);migrateEnemyGroups(s);migrateDeploymentReturns(s);
  try{
    requireThat(action&&typeof action.type==='string','La orden no es válida.');
    requireThat(!s.defeated,'La campaña ha terminado. Inicia otra campaña para continuar.');
    requireThat(!s.completed||['syncTacticalTime','wait','setSleep','assignCare','assignWork','purchaseToolkits','purchaseMedicalSupplies','horseAction','travel','cancelTravel','resumeTravel','beginAssault','visitSector','leaveSector','talkNPC','createSquad','selectSquad','squad','equip','resupply','repairWeapon','purchaseEquipment','purchaseUsedEquipment','sellEquipment','supplyTransfer','supplyArtillery','transport','militia','cancelMilitia','renewContract','dismiss'].includes(action.type),'La campaña está ganada. Puedes recorrer las provincias y atender a tus escuadras y estancias.');
    requireThat(!s.pendingEncounter||['respondToEncounter','selectSquad'].includes(action.type),'Hay un encuentro pendiente. Elegí cómo responder antes de continuar.');
    requireThat(!s.pendingBattle||['battleResult','leaveSector','talkNPC','finishMission','syncTacticalTime'].includes(action.type),'Hay una batalla pendiente. Resuélvela antes de dar nuevas órdenes.');
    if(['travel','attack','visitSector'].includes(action.type))requireThat(!s.squad.some(id=>militiaAssignment(s,id)),'Un instructor de la escuadra está asignado a las milicias. Cancelá su curso o dejalo en una escuadra de guarnición.');
    if(['travel','attack','visitSector'].includes(action.type))requireThat(s.squad.every(id=>s.operativeState[id].assignment==='active'),'Hay combatientes en atención o descanso. Devolvelos al servicio o dejalos en otra escuadra antes de marchar.');
    if(['travel','attack','visitSector'].includes(action.type)){
      requireThat(!s.squad.some(id=>s.operativeState[id].asleep&&needsCollapseRecovery(s.operativeState[id])),'La escuadra necesita descansar: hay combatientes que todavía no pueden despertar.');
      requireThat(s.squad.every(id=>!s.operativeState[id].asleep),'Hay combatientes durmiendo. Despertalos o dejalos en otra escuadra antes de marchar.');
    }
    if(['travel','attack','visitSector','visitMission'].includes(action.type))requireThat(!activeSquad(s).journey,'Terminá o cancelá la ruta antes de entrar en un sector.');
    const targetId=Number(action.operativeId??action.trainerId??(action.type==='dismiss'?action.id:NaN));
    if(Number.isFinite(targetId))requireThat(!operativeInTransit(s,targetId),'El combatiente está en camino. Esperá su llegada.');
    if(['squad','recruitCivic','createOfficer'].includes(action.type))requireThat(!activeSquad(s).journey,'Esperá la llegada o cancelá la ruta antes de reorganizar la escuadra.');
    switch(action.type){
      case 'sectorInventory':note(s,moveSectorItem(s,action,rosterFor(s)));break;
      case 'syncTacticalTime':{requireThat(s.pendingBattle&&s.pendingBattle.id===action.battleId,'El reloj no corresponde al despliegue.');applyTacticalTime(s,s.pendingBattle,action.elapsedSeconds);delete s.pendingBattle.resumeSnapshot;break;}
      case 'respondToEncounter':{
        const encounter=s.pendingEncounter,group=s.enemyGroups.find(g=>g.id===action.groupId);requireThat(encounter&&group&&encounter.groupId===group.id&&group.status==='waiting','El encuentro ya no está pendiente.');requireThat(['tactical','auto','retreat'].includes(action.choice),'La respuesta al encuentro es inválida.');
        if(action.choice==='retreat'){
          const ids=localDefenderIds(s,group.target),exits=retreatDestinations(s,group.target);requireThat(ids.length&&exits.includes(action.destination),'No hay una ruta de retirada disponible para los granaderos.');relocateDefenders(s,ids,action.destination);s.pendingEncounter=null;
          if(s.sectors[group.target].militia.some(n=>n>0))resolveDefenseAutomatically(s,prepareDefense(s,group,{excludeMercs:true}));
          else {loseSectorToGroup(s,group);addDefenseHistory(s,group,'retreat',[],`Los granaderos abandonan ${sector(group.target).name} y llegan a ${sector(action.destination).name}.`);note(s,s.encounterHistory[0].text);}
        }else {const request=prepareDefense(s,group);if(action.choice==='auto')resolveDefenseAutomatically(s,request);else note(s,`La defensa de ${sector(group.target).name} espera órdenes en el sector táctico.`);}break;
      }
      case 'wait':tick(s,action.hours??24,{pauseOnAssignments:true});break;
      case 'setSleep':{
        const op=rosterFor(s).find(o=>o.id===Number(action.operativeId));requireThat(op,'El combatiente no existe.');setSleep(s,op.id,action.asleep);note(s,`${op.name}: ${action.asleep?'se acuesta; conserva su asignación':'se despierta'}.`);break;
      }
      case 'assignCare':{
        const op=rosterFor(s).find(o=>o.id===Number(action.operativeId));requireThat(op,'El combatiente no existe.');assignMedicalCare(s,op,action.assignment);note(s,`${op.name}: ${CARE_ASSIGNMENTS[action.assignment].toLowerCase()}.`);break;
      }
      case 'assignWork':{
        const roster=rosterFor(s),op=roster.find(o=>o.id===Number(action.operativeId));requireThat(op,'El combatiente no existe.');assignWork(s,op,action,roster);note(s,`${op.name}: ${WORK_ASSIGNMENTS[action.assignment].toLowerCase()}.`);break;
      }
      case 'purchaseToolkits':{
        const id=Number(action.operativeId),quantity=action.quantity??1,record=s.operativeState[id];
        requireThat(s.recruited.includes(id)&&record.alive&&operativeLocation(s,id)===s.location,'El combatiente debe estar presente en esta localidad.');
        requireThat(['retiro','cordoba','mendoza'].includes(s.location)&&s.sectors[s.location].owner==='patriot'&&isSupplied(s,s.location),'Las herramientas se compran en una maestranza propia y abastecida.');
        requireThat(Number.isInteger(quantity)&&quantity>=1&&quantity<=20&&record.toolkitPoints+quantity*TOOLKIT_POINTS<=100000,'Elegí entre 1 y 20 juegos de herramientas.');pay(s,{treasury:TOOLKIT_PRICE*quantity});record.toolkitPoints+=TOOLKIT_POINTS*quantity;note(s,`La maestranza entrega ${TOOLKIT_POINTS*quantity} puntos de herramientas.`);break;
      }
      case 'purchaseMedicalSupplies':{
        const id=Number(action.operativeId),quantity=action.quantity??1,op=rosterFor(s).find(o=>o.id===id),record=s.operativeState[id];
        requireThat(op&&s.recruited.includes(id)&&record.alive&&operativeLocation(s,id)===s.location,'El combatiente debe estar presente en esta localidad.');
        requireThat(['retiro','cordoba','mendoza'].includes(s.location)&&s.sectors[s.location].owner==='patriot'&&isSupplied(s,s.location),'Los botiquines se compran en una maestranza propia y abastecida.');
        requireThat(Number.isInteger(quantity)&&quantity>=1&&quantity<=20&&record.medkits+quantity<=100000,'Elegí entre 1 y 20 botiquines.');requireThat(quantity<=medicalSupplyStock(s),'La maestranza no tiene suficientes botiquines.');requireThat(!equipmentInventoryUsage(s,op).overloaded&&!equipmentInventoryUsage(s,op,{medkits:record.medkits+quantity}).overloaded,'No queda espacio para los botiquines. Retirá objetos antes de comprar más.');pay(s,{treasury:MEDICAL_KIT_PRICE*quantity});record.medkits+=quantity;s.merchants[s.location].supplies.medkits-=quantity;s.merchants[s.location].cash=Math.min(1e9,s.merchants[s.location].cash+MEDICAL_KIT_PRICE*quantity);note(s,`${op.name} recibe ${quantity} botiquines por ${MEDICAL_KIT_PRICE*quantity} pesos.`);break;
      }
      case 'academy':requireThat(!s.flags.academy,'La academia ya está organizada.');pay(s,{treasury:300,horses:20,muskets:40,textiles:60});s.flags.academy=true;note(s,'Se funda la academia de Granaderos en Retiro.');break;
      case 'horseAction':{
        const order=action.order;requireThat(order&&['acquire','hire','feed','assign','unassign','breed'].includes(order.type),'La orden de caballada es inválida.');
        requireThat(s.sectors[s.location]?.owner==='patriot','La caballada requiere una localidad segura.');
        if(order.name!==undefined)requireThat(typeof order.name==='string'&&order.name.trim().length>0&&order.name.length<=30&&!/[<>]/.test(order.name),'El nombre de la montura es inválido.');
        if(order.horseId)requireThat(s.horseState?.horses.some(h=>h.id===order.horseId&&h.location===s.location),'La montura está en otra localidad.');
        if(order.type==='assign')requireThat(s.recruited.includes(order.operativeId)&&s.operativeState[order.operativeId].alive&&operativeLocation(s,order.operativeId)===s.location,'El jinete debe estar presente en la localidad.');
        requireThat(!operativeInTransit(s,order.operativeId)&&!s.horseState.horses.some(h=>[order.horseId,order.sireId].includes(h.id)&&operativeInTransit(s,h.assignedTo)),'La montura o su jinete están en camino.');
        const horses=applyHorseAction(s.horseState,{...order,location:s.location,funds:s.resources.treasury});requireThat(!horses.lastError,horses.lastError);pay(s,{treasury:horses.cost??0});s.horseState=horses;note(s,horses.log[0]??'La orden de caballada quedó cumplida.');break;
      }
      case 'purchaseEquipment':{
        const item=equipmentCatalogItem(action.item),quantity=action.quantity??1;
        requireThat(item&&Number.isInteger(quantity)&&quantity>0&&quantity<=100,'El pedido de armamento es inválido.');
        const market=merchantStatus(s,item,isSupplied);requireThat(market.available,market.reason);requireThat(quantity<=market.stock,'El comerciante no tiene suficientes existencias.');
        const merchant=s.merchants[market.sector];
        if(isImportedEquipment(item)){s.equipmentShipments??=[];requireThat(s.equipmentShipments.length<1000,'Hay demasiados pedidos pendientes.');pay(s,{treasury:tradeQuote(s,item.price)*quantity});merchant.stock[item.item]-=quantity;const delay=72+Math.floor(random(s)*49);s.equipmentShipments.push({item:item.item,quantity,due:s.hour+delay});note(s,`Pedido de ${quantity} × ${item.name}: arribo en ${delay} horas, sujeto al bloqueo.`);break;}
        pay(s,{treasury:item.price*quantity});addEquipment(s,item.stockKey??item.item,quantity);merchant.stock[item.stockKey??item.item]-=quantity;merchant.cash=Math.min(1000000000,merchant.cash+item.price*quantity);
        if(item.category==='artillery')s.resources.cannons+=quantity;note(s,`La sala de armas entrega ${quantity} × ${item.name}.`);break;
      }
      case 'sellEquipment':{
        const instance=s.armoryItems.find(item=>item.id===action.instanceId);requireThat(instance,'Ese ejemplar ya no está disponible en la armería.');
        const market=merchantStatus(s,null,isSupplied);requireThat(market.available,market.reason);
        const price=resaleQuote(instance);requireThat(price>0,'El comerciante no compra armas sin valor de servicio.');const merchant=s.merchants[s.location];requireThat(merchant.cash>=price,'El comerciante no tiene fondos suficientes; su caja se repone con el tiempo.');
        requireThat((merchant.usedItems?.length??0)<USED_EQUIPMENT_LIMIT,'El comerciante no puede guardar más armas usadas.');
        merchant.usedItems??=[];merchant.usedItems.push(takeEquipment(s,instance.item,instance.id));merchant.cash-=price;s.resources.treasury+=price;note(s,`Se vende ${equipmentLabel(instance)}, estado ${instance.condition}%, por ${price} pesos.`);break;
      }
      case 'purchaseUsedEquipment':{
        requireThat(action.sector===s.location,'Debes estar en la maestranza que ofrece ese ejemplar.');
        const offer=usedEquipmentOffers(s,isSupplied).find(offer=>offer.instance.id===action.instanceId);
        requireThat(offer,'Ese ejemplar ya no está disponible en el comercio.');requireThat(offer.available,offer.reason);
        const merchant=s.merchants[s.location],index=merchant.usedItems.findIndex(item=>item.id===action.instanceId);
        pay(s,{treasury:offer.quote.total});const [instance]=merchant.usedItems.splice(index,1);
        s.armoryItems.push(instance);s.armory[instance.item]=(s.armory[instance.item]??0)+1;
        merchant.cash=Math.min(1000000000,merchant.cash+offer.quote.total);
        note(s,`Se compra ${equipmentLabel(instance)} usado, estado ${instance.condition}%, por ${offer.quote.total} pesos.`);break;
      }
      case 'supplyArtillery':{const delivered=supplyStationedArtillery(s,action,isSupplied);note(s,`La pieza recibe ${delivered.count} municiones de reserva. Debe cargarse en el campo.`);break;}
      case 'configureArtillery':{
        const types=action.types;requireThat(Array.isArray(types)&&types.length<=3&&types.every(t=>['bronze4','field8','swivel'].includes(t)),'Seleccioná hasta tres piezas de artillería.');
        const total=s.resources.cannons+(s.depots?.[s.location]?.cannons??0),special=(s.armory?.field8??0)+(s.armory?.swivel??0);
        requireThat(types.length<=total,'No hay suficientes piezas disponibles en el campamento.');
        for(const type of ['bronze4','field8','swivel'])requireThat(types.filter(t=>t===type).length<=(type==='bronze4'?Math.max(s.armory?.bronze4??0,total-special):(s.armory?.[type]??0)),'No disponés de tantas piezas de ese modelo.');
        s.artillerySelection=[...types];note(s,'La batería prepara las piezas elegidas para la próxima operación.');break;
      }
      case 'equip':{
        const id=Number(action.operativeId),itemId=Number(action.itemId),slot=action.slot,op=rosterFor(s).find(o=>o.id===id);
        requireThat(op&&s.recruited.includes(id)&&s.operativeState[id].alive,'El combatiente no está disponible.');requireThat(['weapon','blade'].includes(slot),'Elegí el arma principal o el arma blanca.');
        requireThat(operativeLocation(s,id)===s.location,'El combatiente debe estar presente para recibir el arma.');
        requireThat(Number.isInteger(itemId)&&itemId>=1800&&itemId<=1813&&(slot!=='blade'||itemId>=1809),'Esta arma no corresponde a ese espacio.');
        requireThat(op[slot]!==itemId||action.instanceId!==undefined||s.operativeState[id].weaponDropped,'El combatiente ya lleva esa arma.');requireThat((s.armory?.[itemId]??0)>0,'No quedan unidades de esa arma en la armería.');
        const record=s.operativeState[id],incoming=takeEquipment(s,itemId,action.instanceId),outgoingLoaded=record.carriedLoaded??0;
        if(WEAPONS[op[slot]]&&!(slot==='weapon'&&record.weaponDropped))storeEquipment(s,op[slot],{condition:slot==='weapon'?record.condition:record.bladeCondition??100,jammed:slot==='weapon'?(record.jammed??false):false,instanceId:record[slot==='weapon'?'weaponInstanceId':'bladeInstanceId'],fittingPattern:record[slot==='weapon'?'weaponFittingPattern':'bladeFittingPattern'],fittings:slot==='weapon'?record.weaponFittings:{},...(slot==='weapon'&&record.carriedLoaded!==undefined?{loaded:record.carriedLoaded,reloadProgress:record.carriedReloadProgress}:{})});
        s.loadouts??={};s.loadouts[id]={...(s.loadouts[id]??{}),[slot]:itemId};
        if(slot==='weapon'){
          if(record.carriedLoaded!==undefined||incoming.loaded!==undefined||incoming.reloadProgress!==undefined)record.carriedAmmo=(record.carriedAmmo??0)-outgoingLoaded+(incoming.loaded??0);
          if(incoming.loaded!==undefined||incoming.reloadProgress!==undefined)setCarriedLoading(record,{weapon:itemId,loaded:incoming.loaded??0,reloadProgress:incoming.reloadProgress});else clearCarriedLoading(record);
          record.condition=incoming.condition;record.jammed=incoming.jammed;record.weaponDropped=false;record.activeSlot='primary';delete record.activeTool;delete record.activeSupply;record.weaponFittings=clone(incoming.fittings??{});record.weaponFittingPattern=incoming.fittingPattern??null;if(incoming.instanceId!==undefined)record.weaponInstanceId=incoming.instanceId;else delete record.weaponInstanceId;}
        else {record.bladeCondition=incoming.condition;record.bladeFittingPattern=incoming.fittingPattern??null;if(incoming.instanceId!==undefined)record.bladeInstanceId=incoming.instanceId;else delete record.bladeInstanceId;}
        note(s,`${op.name} recibe ${equipmentLabel(incoming)}, estado ${incoming.condition}%.`);break;
      }
      case 'resupply':case 'repairWeapon':{
        const id=Number(action.operativeId),op=rosterFor(s).find(o=>o.id===id),record=s.operativeState[id];requireThat(op&&s.recruited.includes(id)&&record.alive,'El combatiente no está disponible.');
        requireThat(operativeLocation(s,id)===s.location,'El combatiente debe estar presente en la maestranza.');
        requireThat(['retiro','cordoba','mendoza'].includes(s.location)&&s.sectors[s.location].owner==='patriot'&&isSupplied(s,s.location),'Debes llegar a una maestranza abastecida.');
        if(action.type==='repairWeapon')requireThat(op.weapon>0&&!record.weaponDropped,'El combatiente no lleva un arma reparable.');
        if(action.type==='resupply')requireThat(!equipmentInventoryUsage(s,op).overloaded&&!equipmentInventoryUsage(s,op,{priming:Math.max(50,record.priming??50),flints:Math.max(4,record.flints??4),rations:Math.max(2,record.rations??2),torches:Math.max(2,record.torches??2)}).overloaded,'No queda espacio para reponer las provisiones. Retirá objetos antes de recibir más.');
        const cost=action.type==='resupply'?refillCost(record):firearmRepairCost(record);requireThat(cost>0,action.type==='resupply'?'Las provisiones ya están completas.':'El arma ya está en perfecto estado.');pay(s,{treasury:cost});
        if(action.type==='resupply'){record.priming=Math.max(50,record.priming??50);record.flints=Math.max(4,record.flints??4);record.rations=Math.max(2,record.rations??2);record.torches=Math.max(2,record.torches??2);note(s,`${op.name} recibe sílex, cargas de cebo y raciones por ${cost} pesos.`);}else{record.condition=100;note(s,`La maestranza repara el arma de ${op.name} por ${cost} pesos.`);}break;
      }
      case 'createOfficer':{
        requireThat(!s.officer,'El Cabildo ya ha designado a tu oficial.');requireThat(s.sectors.buenos_aires.owner==='patriot','El Cabildo de Buenos Aires está ocupado.');
        const op=createOfficerRecord(action.name,action.answers,action.profile);const creationCost=action.profile?.version===2?0:300;pay(s,{treasury:creationCost});s.officer={name:op.name,answers:clone(action.answers),...(action.profile?{profile:clone(action.profile)}:{})};s.contracts[op.id]={kind:'patriot',term:'month',started:s.hour,expiresAt:null,paid:creationCost};s.operativeState[op.id]={hp:op.maxHp,fatigue:0,alive:true,xp:0,priming:50,flints:4,rations:2,torches:2,condition:100};s.recruited.push(op.id);s.operativeState[op.id].location=s.location;if(s.squad.length<6)s.squad.push(op.id);note(s,`${op.name} aprueba el examen y recibe su comisión de oficial.`);break;
      }
      case 'recruitCivic':{

        const id=Number(action.id);requireThat(CIVIC_RECRUITS.some(o=>o.id===id)&&!s.recruited.includes(id)&&s.operativeState[id]?.alive,'El voluntario no está disponible.');const op=rosterFor(s).find(o=>o.id===id);signContract(s,op,action.term);s.operativeState[id]??={hp:op.maxHp,fatigue:0,alive:true,xp:0,priming:50,flints:4,rations:2,torches:2,condition:100};s.recruited.push(id);s.operativeState[id].location=s.location;if(s.squad.length<6)s.squad.push(id);note(s,`${op.name} se alista mediante el boletín del Cabildo.`);break;
      }
      case 'recruit':throw Error('Los oficiales históricos se incorporan mediante encuentros personales.');
      case 'renewContract':{
        const id=Number(action.id),op=rosterFor(s).find(o=>o.id===id),current=s.contracts[id];requireThat(op&&s.recruited.includes(id)&&current,'El combatiente no tiene un contrato activo.');requireThat(action.expectedExpiresAt===undefined||action.expectedExpiresAt===current.expiresAt,'El contrato cambió. Revisá la nueva fecha antes de renovar.');requireThat(current.kind!=='patriot','Este oficial sirve por la causa y no necesita renovación.');const quote=contractQuote(s,op,action.term??'day');requireThat(quote.available,quote.reason);pay(s,{treasury:quote.price});s.contracts[id]={kind:'paid',term:action.term??'day',started:s.hour,expiresAt:quote.expiresAt,paid:quote.price};recordPayMorale(s,[id],true);note(s,`${op.name} renueva su servicio por ${quote.hours/24} días.`);break;
      }
      case 'dismiss':{const id=Number(action.id);requireThat(s.recruited.includes(id),'El combatiente no está contratado.');requireThat(id!==1000,'Tu oficial dirige la campaña y no puede ser despedido.');removeFromService(s,id);note(s,'El combatiente deja el servicio sin devolución del anticipo.');break;}
      case 'createSquad':case 'squad':{
        const creating=action.type==='createSquad',at=creating?(action.sector??s.location):s.location,ids=action.ids;
        requireThat(sector(at),'La localidad de formación no existe.');
        requireThat(Array.isArray(ids)&&ids.length>0&&ids.length<=6&&new Set(ids).size===ids.length&&ids.every(id=>canReassignOperative(s,id)),'Seleccioná entre uno y seis combatientes disponibles, sin una ruta pendiente.');
        requireThat(ids.every(id=>operativeLocation(s,id)===at),'Los combatientes deben reunirse en el mismo sector antes de cambiar de escuadra.');
        if(creating){requireThat(s.squads.length<8,'El ejército ya tiene ocho escuadras.');requireThat(typeof action.name==='string'&&action.name.trim().length>=2&&action.name.trim().length<=30&&!/[<>]/.test(action.name),'Escribí un nombre de escuadra de entre 2 y 30 caracteres.');}
        // Leave all other members at their actual location before selecting the
        // newly formed squad. Other squads and their routes stay in place.
        if(!creating)for(const id of s.squad)if(!ids.includes(id))s.operativeState[id].location=s.location;
        for(const squad of s.squads)if(squad.id!==s.activeSquadId||creating){squad.members=squad.members.filter(id=>!ids.includes(id));if(!squad.members.length)delete squad.journey;}
        if(creating){const id=`squad-${Math.max(0,...s.squads.map(q=>Number(q.id.split('-')[1])))+1}`;s.squads.push({id,name:action.name.trim(),members:[...ids],location:at});s.activeSquadId=id;s.location=at;}
        s.squad=[...ids];break;
      }
      case 'selectSquad':{const squad=s.squads.find(q=>q.id===action.id);requireThat(squad,'La escuadra no existe.');s.activeSquadId=squad.id;s.squad=[...squad.members];s.location=squad.location;break;}
      case 'talkNPC':{
        requireThat(s.pendingBattle,'Primero entrá al sector.');const snapshot=validateSectorSnapshot(action.sectorState),npc=(s.pendingBattle.sceneId==='yatasto'?YATASTO_NPCS:ENCOUNTERS).find(n=>n.id===action.npcId&&n.sector===s.pendingBattle.sector),id=Number(action.unitId),actor=rosterFor(s).find(o=>o.id===id),unit=snapshot.units.find(u=>u.side==='player'&&Number(u.id)===id),local=snapshot.npcs?.find(n=>n.id===action.npcId);
        requireThat(npc&&actor&&unit&&local&&s.squad.includes(id)&&unit.hp>0&&!unit.departure,'El interlocutor no está disponible en este sector.');requireThat(snapshot.mode==='exploration'||snapshot.status==='victory'||snapshot.sectorCleared,'Terminá el combate antes de conversar.');requireThat(Number.isInteger(local.x)&&Number.isInteger(local.y)&&Math.abs(unit.x-local.x)+Math.abs(unit.y-local.y)<=1,'Acercá al combatiente al interlocutor para hablar.');
        requireThat(['friendly','direct','recruit','quest','mission'].includes(action.approach),'La forma de dirigirse al interlocutor es inválida.');
        const quest=questForNPC(s,npc.id);let text=npc.greeting+(quest&&quest.status!=='completed'?` ${quest.offer}`:''),outcome='conversation';
        if(action.approach==='direct')text=npc.operativeId!==undefined?`Para incorporarme necesito un mando con ${npc.requiredLeadership} de liderazgo, ${npc.requiredLiberated} localidades seguras y que se cumplan mis compromisos regionales.`:npc.greeting;
        if(action.approach==='mission'){requireThat(s.pendingBattle.sceneId==='yatasto','No hay una conferencia pendiente.');text=talkMission(s,npc.id,isSupplied(s,'salta'));outcome='mission';}
        if(action.approach==='quest'){
          requireThat(quest,'Este interlocutor no tiene un encargo pendiente.');requireThat(quest.status!=='completed','El encargo ya fue cumplido.');
          if(quest.status==='unoffered'){s.quests[quest.id]={status:'offered',offeredAt:s.hour,completedAt:null};text=quest.offer;outcome='questOffered';}
          else{requireThat(quest.conditionMet,'Primero asegurá las localidades indicadas en el encargo.');pay(s,quest.cost);s.quests[quest.id]={...s.quests[quest.id],status:'completed',completedAt:s.hour};recordCityLoyalty(s,{sectorId:quest.sector,kind:'quest',eventId:`npc-${quest.id}`});text=quest.delivery;outcome='questCompleted';note(s,`Encargo cumplido: ${quest.title}. La ciudad reconoce el servicio.`);}
        }
        if(action.approach==='recruit'){
          requireThat(npc.operativeId!==undefined,'Este habitante no es un recluta.');requireThat(!s.recruited.includes(npc.operativeId),'Este combatiente ya se incorporó.');const reason=encounterRequirements(s,npc,actor);requireThat(!reason,reason);
          const gate=npc.operativeId>=100?civicStatus(s,npc.operativeId,true):recruitmentStatus(s,npc.operativeId,true);requireThat(gate.available,gate.reason);const op=rosterFor(s).find(o=>o.id===npc.operativeId);signContract(s,op,action.term);s.recruited.push(op.id);s.operativeState[op.id].location=s.location;if(s.squad.length<6){s.squad.push(op.id);s.pendingBattle.squad.push({...clone(op),...clone(s.operativeState[op.id]),...deploymentMorale(s,op.id),loaded:0,ammo:0});}text=`Acepto servir junto a ustedes. ${op.name} se incorpora a la fuerza patriota.`;outcome='recruited';note(s,text);
        }
        s.conversations??={};s.conversations[npc.id]={met:true,lastApproach:action.approach,hour:s.hour};s.lastConversation={npcId:npc.id,speaker:npc.name,text,outcome,operativeId:npc.operativeId??null,options:[...(npc.operativeId!==undefined&&!s.recruited.includes(npc.operativeId)?['friendly','direct','recruit']:['friendly','direct']),...(s.pendingBattle.sceneId==='yatasto'?['mission']:[]),...(questForNPC(s,npc.id)&&questForNPC(s,npc.id).status!=='completed'?['quest']:[])]};break;
      }
      case 'visitMission':{
        requireThat(action.mission==='yatasto','La escena solicitada no existe.');requireThat(s.location==='tucuman'&&s.phase>=2,'Viajá a Tucumán después de San Lorenzo para acudir a Yatasto.');requireThat(!s.missions.yatasto?.completed,'La conferencia de Yatasto ya concluyó.');
        const entered=dispatchCampaign(s,{type:'visitSector'});requireThat(!entered.lastError,entered.lastError);Object.assign(s,entered);Object.assign(s.pendingBattle,{sceneId:'yatasto',missionId:'yatasto',name:MISSION_SCENES.yatasto.name,npcs:clone(YATASTO_NPCS),garrison:[],artillery:[]});if(!s.squad.every(id=>s.operativeState[id].residentScene==='yatasto'))recordStrategicArrival(s,s.squad,'tucuman','tucuman','yatasto');prepareDeploymentExits(s,s.pendingBattle);break;
      }
      case 'finishMission':{
        requireThat(s.pendingBattle?.sceneId==='yatasto'&&s.pendingBattle.id===action.battleId,'No hay una conferencia de Yatasto abierta.');requireThat(s.missions.yatasto?.frontier,'Completá los partes, el análisis y el acuerdo de frontera antes de cerrar la conferencia.');
        const result=dispatchCampaign(s,{...action,type:'leaveSector'});requireThat(!result.lastError,result.lastError);Object.assign(s,result);s.missions.yatasto.completed=true;s.missions.yatasto.stage='completed';note(s,'La conferencia de Yatasto concluye. Belgrano entrega el mando y la preparación continental se orienta hacia Cuyo.');break;
      }
      case 'visitSector':{
        requireThat(!occupyingGroups(s,action.sector??s.location).length,'Hay tropas realistas en el sector. Prepará un contraataque.');
        const at=action.sector??s.location;requireThat(at===s.location,'La escuadra debe viajar al sector antes de entrar.');requireThat(s.sectors[at]?.owner==='patriot','El sector está ocupado; prepará un ataque.');requireThat(s.squad.length>0,'La escuadra no tiene combatientes.');const def=sector(at),allocated={},localAmmo=s.depots?.[at]?.cartridges??0;let stock=s.resources.cartridges+localAmmo;for(const id of s.squad){allocated[id]=allocateEquipmentAmmo(s,rosterFor(s).find(o=>o.id===id),stock);stock-=allocated[id].loaded+allocated[id].ammo-(s.operativeState[id].carriedAmmo??0);if(s.operativeState[id].carriedAmmo!==undefined)s.operativeState[id].carriedAmmo=0;clearCarriedLoading(s.operativeState[id]);}const issued=s.resources.cartridges+localAmmo-stock,fromDepot=Math.min(localAmmo,issued);s.resources.cartridges-=issued-fromDepot;if(fromDepot)s.depots[at].cartridges-=fromDepot;
        s.pendingBattle={id:`visit-${at}-${s.hour}-${s.seed}`,sector:at,hour:s.hour,secondOfHour:s.secondOfHour??0,name:def.name,biome:def.biome,theater:def.theater,seed:s.seed,exploration:true,night:s.hour%24<6||s.hour%24>=20,issuedCartridges:Object.values(allocated).reduce((sum,u)=>sum+u.loaded+u.ammo,0),ammunitionSources:(s.sectorStates[at]?.units??[]).filter(u=>u.side==='enemy').map(u=>({id:u.id,side:'enemy',ammo:u.ammo??0,loaded:u.loaded??0})),wasRoyalist:false,npcs:encountersFor(s,at),squad:s.squad.map(id=>({...clone(rosterFor(s).find(o=>o.id===id)),...clone(s.operativeState[id]),...deploymentMorale(s,id),...allocated[id],...(mountForOperative(s.horseState,id)??{horse:false,canMount:false})})),enemies:[],artillery:[],weather:{rain:false,humidity:def.theater==='coast'?.8:.3}};s.pendingBattle.garrison=prepareGarrison(s,at);s.pendingBattle.garrisonLootSources=(s.sectorStates[at]?.units??[]).filter(u=>u.militia&&u.hp<=0).map(u=>({id:u.id,ammo:u.ammo??0,loaded:u.loaded??0}));note(s,`La escuadra entra en ${def.name} para reconocer el lugar y hablar con sus habitantes.`);break;
      }
      case 'leaveSector':{
        requireThat(s.pendingBattle?.exploration&&action.battleId===s.pendingBattle.id,'La visita no corresponde al sector abierto.');const visit=s.pendingBattle,{snapshot}=completeDeploymentReport(s,visit,action),outcome=snapshot.status==='retreat'?'retreat':snapshot.status==='defeat'?'defeat':'visit',plan=planDeploymentReturn(s,visit,snapshot,outcome);
        commitDeploymentReturn(s,visit,snapshot,plan);
        if(!s.completed&&!s.recruited.some(id=>s.operativeState[id].alive))s.defeated=true;s.pendingBattle=null;note(s,'La escuadra vuelve a la carta de operaciones.');break;
      }
      case 'cancelTravel':{const q=s.squads.find(q=>q.id===(action.squadId??s.activeSquadId));cancelSquadTravel(q,action.choice);note(s,`${q.name}: se modifica la ruta de marcha.`);break;}
      case 'resumeTravel':{const q=s.squads.find(q=>q.id===(action.squadId??s.activeSquadId));resumeSquadTravel(s,q);note(s,`${q.name}: retoma la marcha.`);break;}
      case 'travel':{
        if(action.queue===true){const q=activeSquad(s);queueSquadTravel(s,q,{...action,intent:'travel'});note(s,`${q.name}: ruta ordenada hacia ${sector(action.sector).name}. Avanzá el reloj para marchar.`);break;}

        requireThat(!s.squad.some(id=>tooTiredToMarch(s.operativeState[id])),'La escuadra necesita descansar antes de marchar.');
        requireThat(s.squad.length>0,'No hay combatientes en esta escuadra.');
        requireThat(s.squad.length>0,'La escuadra no tiene combatientes para marchar.');
        requireThat(sector(action.sector),'El destino no existe.');requireThat(s.sectors[action.sector].owner==='patriot','Primero debes liberar el destino.');const path=travelPath(s,s.location,action.sector);requireThat(path,'Los realistas cortan la ruta de tránsito.');
        const mode=action.mode??'march';requireThat(['march','posta','flotilla','carts'].includes(mode),'Medio de transporte desconocido.');
        if(mode!=='march')requireThat(s.routes[mode],'Debes organizar ese transporte.');
        if(mode==='flotilla')requireThat(!s.blockade&&path.every(id=>sector(id).theater==='coast'),'La flotilla requiere una ruta costera sin bloqueo.');
        const mountain=path.some(id=>sector(id).biome==='mountain');requireThat(!(path.some(id=>['uspallata','los_patos'].includes(id))&&campaignDate(s).month>=6&&campaignDate(s).month<=8),'La nieve invernal ha cerrado los pasos.');
        for(let leg=1;leg<path.length;leg++){
          if(s.squad.some(id=>tooTiredToMarch(s.operativeState[id]))){recordSleepEvents(s,prepareSleep(s,rosterFor(s),{...assignmentContext(s),stoppedTravel:[...s.squad]}));note(s,'La escuadra detiene la ruta por agotamiento. Descansá antes de continuar.');break;}
          if(mode==='posta')pay(s,{horses:1});const hours=Math.ceil((mode==='posta'?4:mode==='flotilla'?5:mode==='carts'?18:12)*([path[leg-1],path[leg]].some(id=>sector(id).biome==='mountain')?1.5:1));
          tick(s,hours,{traveling:[...s.squad],travelLeg:{from:path[leg-1],to:path[leg],arrivalAt:s.hour+hours},mode,mountain:[path[leg-1],path[leg]].some(id=>sector(id).biome==='mountain')});if(!s.squad.length){note(s,'La marcha se cancela al terminar el último contrato.');break;}
          if(s.sectors[path[leg]].owner!=='patriot'||occupyingGroups(s,path[leg]).length){note(s,'El avance se detiene: una incursión cortó la ruta durante la marcha.');break;}
          recordStrategicArrival(s,s.squad,path[leg-1],path[leg]);s.location=path[leg];moveMounts(s,s.location,hours);for(const id of s.squad)s.operativeState[id].location=s.location;synchronizeSquad(s);meetEnemyGroups(s,s.location);settleEnemyEncounters(s);
          if(s.pendingEncounter){note(s,'La escuadra completa esta etapa y detiene la marcha ante el contacto enemigo.');break;}
        }
        note(s,`El destacamento llega a ${sector(s.location).name}.`);break;
      }
      case 'supplyTransfer':{
        const plan=planTransfer(s,action);pay(s,{horses:plan.remounts});s.depots??={};s.convoys??=[];
        const inventory=plan.source==='reserve'?s.resources:s.depots[plan.source];for(const [key,value]of Object.entries(plan.goods))inventory[key]-=value;
        s.convoys.push({id:`convoy-${s.hour}-${s.seed}-${s.convoys.length}`,source:plan.source,destination:plan.destination,mode:plan.id,goods:plan.goods,due:plan.due});note(s,`Sale un convoy de ${plan.name.toLowerCase()}: ${plan.weight.toFixed(1)} kg de pertrechos, ${plan.hours} horas de camino.`);break;
      }
      case 'transport':requireThat(['posta','flotilla','carts','mules'].includes(action.mode),'Transporte desconocido.');requireThat(!s.routes[action.mode],'Ese transporte ya está organizado.');pay(s,action.mode==='posta'?{treasury:150,horses:10}:action.mode==='flotilla'?{treasury:400,cannons:1}:action.mode==='mules'?{treasury:120,horses:2}:{treasury:180,horses:4});s.routes[action.mode]=true;note(s,'La nueva red de transporte queda disponible.');break;
      case 'produce':{
        const recipe=RECIPES[action.recipe];requireThat(recipe,'La maestranza no conoce ese producto.');const at=action.sector??s.location;
        requireThat(['retiro','cordoba','mendoza'].includes(at)&&s.sectors[at].owner==='patriot'&&isSupplied(s,at),'La producción requiere una maestranza propia y abastecida.');
        if(['cannon','infantry'].includes(action.recipe))requireThat(s.flags.foundry&&at==='mendoza','Esta producción requiere la fundición de El Plumerillo.');
        requireThat(s.production.filter(p=>p.sector===at).length<3,'La maestranza ya tiene tres encargos.');pay(s,recipe.cost);s.production.push({id:`${s.hour}-${s.production.length}-${s.seed}`,sector:at,name:recipe.name,due:s.hour+productionHours(s,recipe,isSupplied),yield:clone(recipe.yield)});note(s,`Encargo iniciado: ${recipe.name}.`);break;
      }
      case 'foundry':requireThat(s.sectors.mendoza.owner==='patriot'&&s.recruited.includes(2),'Libera Mendoza e incorpora a Beltrán.');requireThat(!s.flags.foundry,'La fundición ya funciona.');pay(s,{treasury:500,copper:20});s.flags.foundry=true;note(s,'Beltrán pone en marcha la fundición de El Plumerillo.');break;
      case 'contraband':{
        requireThat(s.sectors.ensenada.owner==='patriot','El puerto de Ensenada está ocupado.');requireThat(s.reputation.foreign>=0,'Los comerciantes rechazan los tratos con el ejército.');
        const offers={arms:{price:250,goods:{muskets:50,cartridges:100}},supplies:{price:180,goods:{powder:40,textiles:120,copper:10}},materials:{price:160,goods:{timber:30,scrapIron:20,lead:20,leather:30,saltpeter:30,charcoal:20,sulfur:10}},mounts:{price:150,goods:{horses:15}},winter:{price:100,goods:{ponchos:6}}};const offer=offers[action.offer??'arms'];requireThat(offer,'Ese cargamento no está disponible.');pay(s,{treasury:tradeQuote(s,offer.price)});const delay=72+Math.floor(random(s)*49);s.shipments.push({due:s.hour+delay,goods:clone(offer.goods)});standing(s,'foreign',5);note(s,`El cargamento llegará en ${delay} horas, si el puerto permanece abierto.`);break;
      }
      case 'policy':{applyPolicy(s,action.kind);break;}
      case 'diplomacy':{
        const kind=action.kind;
        if(kind==='northPact'){requireThat(s.sectors.salta.owner==='patriot','Libera Salta para reunir su Cabildo.');requireThat(!s.flags.northPact,'El pacto del norte ya está firmado.');pay(s,{muskets:20,horses:10,powder:10});s.flags.northPact=true;standing(s,'gauchos',45);note(s,'Güemes acepta custodiar el norte con respeto a la autonomía provincial.');}
        else if(kind==='partisanSupply'){requireThat(s.sectors.tucuman.owner==='patriot','Abre una ruta hacia las partidas del norte.');requireThat(!s.flags.partisanSupply,'Las partidas ya recibieron su entrega.');pay(s,{muskets:50});s.flags.partisanSupply=true;standing(s,'gauchos',20);note(s,'Las partidas reciben cincuenta mosquetes. Azurduy ofrece su colaboración.');}
        else if(kind==='parliament'){requireThat(s.sectors.mendoza.owner==='patriot','El parlamento debe prepararse desde Cuyo.');requireThat(!s.flags.parliament,'Los pasos ya cuentan con un acuerdo.');pay(s,{treasury:200,textiles:60,sabres:10});s.flags.parliament=true;standing(s,'indigenous',60);note(s,'El parlamento acuerda el tránsito y respeta la autonomía pehuenche.');}
        else if(kind==='emancipation'){requireThat(!s.flags.emancipation,'El decreto ya fue proclamado.');pay(s,{treasury:150});s.flags.emancipation=true;standing(s,'pardos',30);standing(s,'directory',5);note(s,'El Cabildo proclama la libertad y garantiza la protección de las familias emancipadas.');}
        else if(kind==='commission'){requireThat(s.flags.emancipation,'Primero garantiza la emancipación.');requireThat(!s.flags.commission,'Las comisiones ya fueron otorgadas.');pay(s,{treasury:100});s.flags.commission=true;standing(s,'pardos',20);note(s,'Los batallones de Pardos y Morenos reciben comisiones de oficiales.');}
        else if(kind==='gift'){pay(s,{treasury:80,textiles:20});standing(s,'indigenous',15);note(s,'Una comitiva entrega presentes y renueva los acuerdos de frontera.');}
        else if(kind==='requisition'){requireThat(policyStatus(s).requisitionReady,'Las estancias necesitan catorce días para recuperarse.');s.politics??={};s.politics.requisitionAfter=s.hour+336;add(s,{treasury:200,horses:5});standing(s,'gauchos',-20);standing(s,'directory',-10);s.sectors[s.location].loyalty=Math.max(0,s.sectors[s.location].loyalty-20);note(s,'La requisa abastece al ejército, pero provoca rechazo en la población.');}
        else if(kind==='autonomy'){pay(s,{treasury:80});standing(s,'gauchos',15);standing(s,'directory',-3);note(s,'El ejército reconoce las autoridades provinciales.');}
        else throw Error('No existe esa propuesta diplomática.');break;
      }
      case 'militia':{
        const at=action.sector??s.location,rank=Number(action.rank??0),trainerId=Number(action.trainerId),trainer=rosterFor(s).find(o=>o.id===trainerId);
        requireThat(s.sectors[at]?.owner==='patriot'&&isSupplied(s,at),'La instrucción necesita un sector propio y abastecido.');requireThat([0,1].includes(rank),'Los veteranos ascienden por experiencia de combate, no por instrucción.');const eligibility=militiaEligibility(s,at);requireThat(eligibility.eligible,eligibility.reason);
        requireThat(trainer&&s.recruited.includes(trainerId)&&s.operativeState[trainerId]?.alive&&operativeLocation(s,trainerId)===at,'Elegí un instructor contratado y presente en el sector.');
        requireThat(s.operativeState[trainerId].assignment==='active','El instructor debe volver al servicio antes de entrenar milicias.');
        requireThat(trainer.leadership>=30,'El instructor necesita al menos 30 de liderazgo.');requireThat(!militiaAssignment(s,trainerId),'El instructor ya dirige otro curso.');requireThat(!s.militiaTraining.some(t=>t.sector===at),'Ya hay un curso activo en ese sector.');
        const region=s.sectors[at];requireThat(rank===0||region.militia[rank-1]>=MILITIA_COHORT,'La promoción necesita tres milicianos del grado anterior.');requireThat(rank>0||region.militia.reduce((a,b)=>a+b,0)+MILITIA_COHORT<=MILITIA_LIMIT,'La guarnición admite hasta sesenta milicianos.');
        const course=militiaCourse(trainer,rank);pay(s,course.cost);const trainees=rank>0?reserveMilitiaTrainees(s,at,rank,course.count):undefined;if(rank>0)region.militia[rank-1]-=course.count;
        s.militiaTraining.push({...(trainees?{trainees}:{}),sector:at,rank,trainerId,count:course.count,remaining:course.hours,duration:course.hours,started:s.hour});note(s,`${trainer.name} inicia un curso de milicias de ${course.hours} horas en ${sector(at).name}.`);break;
      }
      case 'cancelMilitia':{
        const course=s.militiaTraining.find(t=>t.sector===action.sector);requireThat(course,'No hay un curso activo en ese sector.');returnMilitiaTrainees(s,course);s.militiaTraining=s.militiaTraining.filter(t=>t!==course);note(s,'Se suspende el curso. Los soldados regresan a su grado anterior; los suministros de instrucción ya se consumieron.');break;
      }
      case 'fortify':{const at=action.sector??s.location;requireThat(s.sectors[at]?.owner==='patriot','Solo puedes fortificar sectores propios.');requireThat(s.sectors[at].fort<3,'El sector ya tiene la máxima fortificación.');pay(s,{treasury:150,sabres:5});s.sectors[at].fort++;note(s,`Se refuerzan las defensas de ${sector(at).name}.`);break;}
      case 'beginAssault':{
        const at=action.sector,groups=readyAssaultSquads(s,at),origin=groups[0].location,manifest=arriveForAssault(s,groups,at),ids=manifest.flatMap(q=>q.members);haltEnemyGroupsAt(s,at,'stationed');
        if(s.sectors[at].owner==='patriot'&&!occupyingGroups(s,at).length&&!(s.blockade&&sector(at).theater==='coast')){for(const id of ids)if(s.contracts[id]?.departurePending)removeFromService(s,id);note(s,`Las escuadras entran en ${sector(at).name}; el sector ya está libre.`);break;}
        prepareAttack(s,at,origin,ids,manifest);break;
      }
      case 'attack':{
        const at=action.sector??'san_lorenzo',san=at==='san_lorenzo',def=san?{id:at,name:'Combate de San Lorenzo',biome:'river',theater:'coast'}:sector(at);
        requireThat(at===s.location||!s.squad.some(id=>tooTiredToMarch(s.operativeState[id])),'La escuadra necesita descansar antes de atacar.');
        requireThat(def,'No existe ese campo de batalla.');requireThat(san?s.location==='san_nicolas':(s.location===at||def.neighbors.includes(s.location)),'La escuadra debe marchar a un sector vecino antes de atacar.');requireThat(!(['uspallata','los_patos'].includes(at)&&campaignDate(s).month>=6&&campaignDate(s).month<=8),'La nieve invernal ha cerrado los pasos.');requireThat(s.squad.some(id=>s.operativeState[id].alive&&s.operativeState[id].hp>0),'No hay combatientes disponibles.');
        if(san)requireThat(s.phase>=1&&!s.flags.sanLorenzo&&s.sectors.san_nicolas.owner==='patriot','Organiza Retiro y libera San Nicolás antes de combatir en San Lorenzo.');
        else {requireThat(s.sectors[at].owner==='royalist'||(s.blockade&&def.theater==='coast'),'El sector ya está bajo control patriota.');requireThat(def.neighbors.some(id=>s.sectors[id].owner==='patriot'&&isSupplied(s,id)),'Debes abrir una ruta hasta el frente.');}
        if(action.queue===true&&!san&&s.location!==at){queueSquadTravel(s,activeSquad(s),{...action,intent:'attack'});note(s,`La escuadra prepara su avance al límite de ${def.name}.`);break;}
        const origin=s.location;if(!san&&s.location!==at){tick(s,12,{traveling:[...s.squad],travelLeg:{from:origin,to:at,arrivalAt:s.hour+12},mode:'march',mountain:sector(origin)?.biome==='mountain'||def.biome==='mountain'});if(!s.squad.length){note(s,'El despliegue se cancela: no quedan contratos vigentes en la escuadra.');break;}recordStrategicArrival(s,s.squad,origin,at);s.location=at;moveMounts(s,at,12);synchronizeSquad(s);haltEnemyGroupsAt(s,at,'stationed');if(s.pendingEncounter){note(s,'El avance se detiene al llegar: hay una defensa pendiente.');break;}}
        prepareAttack(s,at,origin,s.squad);break;
      }
      case 'battleResult':{
        requireThat(s.pendingBattle&&!s.pendingBattle.exploration,'No hay batalla de conquista pendiente.');requireThat(action.battleId===s.pendingBattle.id,'El resultado no corresponde a la batalla pendiente.');requireThat(['victory','defeat','retreat'].includes(action.outcome),'Resultado de batalla inválido.');const request=s.pendingBattle;
        const {snapshot:battleSnapshot}=completeDeploymentReport(s,request,action);if(request.missionId==='san_lorenzo'){requireThat(battleSnapshot,'San Lorenzo necesita un parte táctico completo.');const commander=battleSnapshot.units.find(u=>Number(u.id)===57&&u.missionAlly);requireThat(commander,'Falta el comandante aliado en el parte.');s.missionAllies.san_lorenzo=clone(commander);if(action.outcome==='victory'&&commander.hp>0)requireThat(completedTacticalVictory(battleSnapshot),'La victoria exige derrotar a los realistas y conservar con vida al comandante.');if(commander.hp<=0){action={...action,outcome:'defeat'};s.defeated=true;s.missions.san_lorenzo={stage:'failed',completed:false};note(s,'San Martín ha caído en San Lorenzo. La misión y la campaña concluyen con una derrota.');}else if(action.outcome==='victory')s.missions.san_lorenzo={stage:'completed',completed:true};}const plan=planDeploymentReturn(s,request,battleSnapshot,action.outcome);commitDeploymentReturn(s,request,battleSnapshot,plan);
        for(const id of request.squad.map(u=>Number(u.id)))if((id===1000||CIVIC_RECRUITS.some(o=>o.id===id))&&s.operativeState[id].alive){
          const before=rosterFor(s).find(o=>o.id===id),xp=action.outcome==='victory'?60:action.outcome==='defeat'?20:10;
          s.operativeState[id].xp=(s.operativeState[id].xp??0)+xp;const after=rosterFor(s).find(o=>o.id===id);
          if(after.level>before.level){const growth=after.maxHp-before.maxHp;s.operativeState[id].maxHp+=growth;if(s.operativeState[id].hp===before.maxHp)s.operativeState[id].hp+=growth;note(s,`${after.name} mejora su instrucción tras el combate: grado${after.level}.`);}
        }
        if(request.defenseGroupId){finishDefense(s,request,action.outcome,battleSnapshot,plan);break;}
        for(const groupId of request.occupationGroupIds??[])recordEnemyGroupResult(s,groupId,battleSnapshot,action.outcome);
        if(action.outcome==='victory'){
          recordCityLoyalty(s,{sectorId:request.sector==='san_lorenzo'?'san_nicolas':request.sector,kind:'victory',eventId:request.id});if(request.sector==='san_lorenzo')s.flags.sanLorenzo=true;
          else {const region=s.sectors[request.sector];region.owner='patriot';region.loyalty=Math.max(50,region.loyalty);region.damageUntil=0;releaseCaptives(s,request.sector);}
          if(request.theater==='coast'&&!s.enemyGroups.some(g=>g.theater==='coast'&&g.status==='stationed'))s.blockade=false;if(request.wasRoyalist||request.sector==='san_lorenzo')add(s,{treasury:250,muskets:15,cartridges:80});standing(s,'directory',5);standing(s,'gauchos',request.theater==='north'?10:2);note(s,`Victoria en ${request.name}. Se recuperan armas y fondos realistas.`);
        }else{standing(s,'directory',-5);note(s,`El destacamento se retira de ${request.name}.`);}
        s.sectorStates[request.sector]=clone(battleSnapshot);
        s.pendingBattle=null;s.squad=s.squad.filter(id=>s.operativeState[id].alive);if(!s.squad.length){const reserve=s.recruited.filter(id=>s.operativeState[id].alive&&operativeLocation(s,id)===s.location);s.squad=reserve.slice(0,6);if(!s.recruited.some(id=>s.operativeState[id].alive)){s.defeated=true;note(s,'No quedan combatientes. La campaña ha terminado.');}}break;
      }
      default:throw Error('Orden desconocida.');
    }
    for(const [flag,at] of Object.entries({academy:'retiro',foundry:'mendoza',northPact:'salta',partisanSupply:'tucuman',parliament:'mendoza',emancipation:'buenos_aires',commission:'buenos_aires'}))if(s.flags[flag]&&!previous.flags[flag])recordCityLoyalty(s,{sectorId:at,kind:'quest',eventId:`quest-${flag}`});
    delayCrossingEnemyGroups(s);
    if(s.pendingBattle&&!previous.pendingBattle)prepareSectorArtillery(s,s.pendingBattle);
    if(s.pendingBattle&&!s.pendingBattle.exits)prepareDeploymentExits(s,s.pendingBattle);releaseDeferred(s);synchronizeSquad(s);migrateMedicalCare(s,rosterFor(s));migrateAssignments(s,rosterFor(s));migrateMorale(s,rosterFor(s));migrateEquipment(s);migrateEnemyGroups(s);validateDeploymentReturnState(s);validateEquipmentOwnership(s,rosterFor(s));progress(s);if(Object.keys(s.assignmentAttention.reported).length)reconcileAssignmentAttention(s,assignmentStates(s,rosterFor(s),assignmentContext(s)));reconcileContractAttention(s);return s;
  }catch(error){const rejected=clone(previous);rejected.lastError=error.message;return rejected;}
}
export function serializeCampaign(s){return JSON.stringify(s);}
export function restoreCampaign(text){
  assertSaveSize(text);
  const s=JSON.parse(text),base=initialCampaign();
  const integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
  const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  requireThat(object(s)&&s.version===1&&integer(s.hour,0,24*365*100)&&integer(s.phase,0,4)&&integer(s.seed,0,4294967295)&&sector(s.location),'El archivo de campaña no es compatible.');
  migrateEnemyGroups(s);s.equipmentShipments??=[];requireThat(validEquipmentShipments(s),'Los pedidos de armas guardados son inválidos.');
  migrateMaterials(s);requireThat(object(s.resources)&&Object.keys(base.resources).every(k=>integer(s.resources[k],0,1e9)),'La tesorería del archivo es inválida.');
  requireThat(object(s.reputation)&&Object.keys(base.reputation).every(k=>integer(s.reputation[k],-100,100))&&s.reputation.royalists===-100,'Las relaciones del archivo son inválidas.');
  requireThat(object(s.sectors)&&Object.keys(s.sectors).length===13&&CAMPAIGN_SECTORS.every(d=>{const r=s.sectors[d.id];return object(r)&&['patriot','royalist'].includes(r.owner)&&integer(r.loyalty,0,100)&&integer(r.fort,0,3)&&integer(r.damageUntil,0,1e9)&&Array.isArray(r.militia)&&r.militia.length===3&&r.militia.every(x=>integer(x,0,100000));}),'El mapa del archivo es inválido.');
  s.militiaTraining??=[];
  requireThat(Array.isArray(s.militiaTraining)&&s.militiaTraining.length<=13&&new Set(s.militiaTraining.map(t=>t?.sector)).size===s.militiaTraining.length&&new Set(s.militiaTraining.map(t=>t?.trainerId)).size===s.militiaTraining.length&&s.militiaTraining.every(t=>object(t)&&sector(t.sector)&&integer(t.rank,0,2)&&integer(t.trainerId,0,1000)&&s.recruited?.includes(t.trainerId)&&t.count===3&&integer(t.duration,1,96)&&integer(t.remaining,1,t.duration)&&integer(t.started,0,s.hour)),'Los cursos de milicias guardados son inválidos.');
  // Version1 migration: old saves did not contain civic volunteers or a custom officer.
  if(s.officer===undefined)s.officer=null;
  requireThat(s.officer===null||(object(s.officer)&&typeof s.officer.name==='string'&&object(s.officer.answers)),'El examen guardado es inválido.');
  if(s.officer)createOfficerRecord(s.officer.name,s.officer.answers,s.officer.profile);
  requireThat(object(s.operativeState),'Las hojas de servicio son inválidas.');
  if(s.fittingRulesVersion!==undefined){requireThat(s.fittingRulesVersion===FITTING_RULES_VERSION,'La versión de accesorios es inválida.');for(const r of Object.values(s.operativeState))requireThat(object(r)&&object(r.weaponFittings)&&Object.hasOwn(r,'weaponFittingPattern')&&Object.hasOwn(r,'bladeFittingPattern'),'Los accesorios guardados del combatiente están incompletos.');}
  for(const op of CIVIC_RECRUITS)s.operativeState[op.id]??={hp:op.maxHp,fatigue:0,alive:true,xp:0,priming:50,flints:4,rations:2,torches:2,condition:100};
  for(const op of Object.values(s.operativeState)){requireThat(object(op),'Las hojas de servicio son inválidas.');validateTraining(op);validatePocketOrder(op.pocketOrder);op.xp??=0;if(op.inventory!==undefined)validatePersonalInventory(op.inventory);for(const [field,limit]of Object.entries({energy:100,weight:1000,strength:100,strengthTraining:10000,boleadoras:100000})){if(op[field]!==undefined)requireThat(Number.isFinite(op[field])&&op[field]>=0&&op[field]<=limit,'El estado físico guardado es inválido.');}for(const [field,baseline] of Object.entries({priming:50,flints:4,rations:2,torches:2,condition:100})){op[field]??=baseline;requireThat(integer(op[field],0,field==='condition'?100:100000),'Los suministros guardados son inválidos.');}requireThat(integer(op.xp,0,1e7),'La experiencia guardada es inválida.');}
  s.depots??={};s.convoys??=[];requireThat(object(s.routes),'Las rutas guardadas son inválidas.');s.routes.mules??=false;
  requireThat(object(s.depots)&&Object.entries(s.depots).every(([id,goods])=>sector(id)&&object(goods)&&Object.entries(goods).every(([key,v])=>key in base.resources&&integer(v,0,1e9))),'Los depósitos guardados son inválidos.');
  requireThat(Array.isArray(s.convoys)&&s.convoys.length<=1000&&s.convoys.every(c=>object(c)&&typeof c.id==='string'&&(c.source==='reserve'||sector(c.source))&&(c.destination==='reserve'||sector(c.destination))&&['posta','carts','flotilla','mules'].includes(c.mode)&&integer(c.due,0,1e9)&&object(c.goods)&&Object.entries(c.goods).every(([key,v])=>key in base.resources&&integer(v,1,1e9))),'Los convoyes guardados son inválidos.');
  s.missions??={};s.sceneStates??={};s.missionAllies??={};requireThat(validateMissions(s)&&object(s.sceneStates)&&Object.entries(s.sceneStates).every(([id,b])=>id==='yatasto'&&b.sceneId===id&&validateSectorSnapshot(b))&&object(s.missionAllies)&&Object.entries(s.missionAllies).every(([id,u])=>id==='san_lorenzo'&&object(u)&&u.missionAlly===true&&Number(u.id)===57&&typeof u.name==='string'&&Number.isInteger(u.weapon)&&(u.weapon===0||u.weapon>=1800&&u.weapon<=1813)&&(u.blade===undefined||Number.isInteger(u.blade)&&(u.blade===0||u.blade>=1809&&u.blade<=1813))&&Number.isInteger(u.ammo)&&u.ammo>=0&&u.ammo<=100000&&Number.isInteger(u.loaded)&&u.loaded>=0&&u.loaded<=2&&Number.isFinite(u.hp)&&u.hp>=0&&u.hp<=100),'Las escenas guardadas son inválidas.');
  s.garrisons??={};s.nextMilitiaId??=20000;requireThat(validGarrisons(s),'Las guarniciones guardadas son inválidas.');
  const traineeIds=s.militiaTraining.flatMap(course=>(course.trainees??[]).map(u=>u.id));requireThat(new Set(traineeIds).size===traineeIds.length&&s.militiaTraining.every(course=>validMilitiaTrainees(s,course)),'Los milicianos en instrucción son inválidos.');
  s.quests??={};requireThat(validateQuests(s.quests,s.hour),'Los encargos guardados son inválidos.');
  s.lastConversation??=null;s.conversations??={};
  requireThat(object(s.conversations)&&Object.entries(s.conversations).every(([id,c])=>[...ENCOUNTERS,...YATASTO_NPCS].some(n=>n.id===id)&&object(c)&&c.met===true&&['friendly','direct','recruit','quest','mission'].includes(c.lastApproach)&&integer(c.hour,0,1e9)),'Las conversaciones guardadas son inválidas.');
  requireThat(s.lastConversation===null||(object(s.lastConversation)&&[...ENCOUNTERS,...YATASTO_NPCS].some(n=>n.id===s.lastConversation.npcId)&&typeof s.lastConversation.text==='string'&&s.lastConversation.text.length<2000&&typeof s.lastConversation.speaker==='string'&&s.lastConversation.speaker.length<100&&Array.isArray(s.lastConversation.options)&&s.lastConversation.options.every(o=>['friendly','direct','recruit','quest','mission'].includes(o))),'El diálogo guardado es inválido.');
  s.armory??={};s.loadouts??={};s.artillerySelection??=[];requireThat(Array.isArray(s.artillerySelection)&&s.artillerySelection.length<=3&&s.artillerySelection.every(t=>['bronze4','field8','swivel'].includes(t)),'La batería guardada es inválida.');
  requireThat(object(s.armory)&&Object.entries(s.armory).every(([key,v])=>EQUIPMENT_CATALOG.some(o=>String(o.item)===key)&&integer(v,0,100000)),'La armería guardada es inválida.');
  requireThat(object(s.loadouts)&&Object.entries(s.loadouts).every(([id,slots])=>baseRosterFor(s).some(o=>o.id===Number(id))&&object(slots)&&Object.entries(slots).every(([slot,v])=>['weapon','blade'].includes(slot)&&(v===0||integer(v,slot==='blade'?1809:1800,1813)))),'Los equipos guardados son inválidos.');
  s.cityLoyaltyEvents??=[];requireThat(validCityLoyaltyEvents(s.cityLoyaltyEvents),'El registro de lealtad es inválido.');
  migrateContracts(s);requireThat(object(s.contracts)&&Object.entries(s.contracts).every(([id,c])=>s.recruited.includes(Number(id))&&object(c)&&(c.departurePending===undefined||typeof c.departurePending==='boolean')&&['paid','patriot','legacy'].includes(c.kind)&&['day','week','month'].includes(c.term)&&integer(c.started,0,s.hour)&&(c.expiresAt===null?c.kind!=='paid':integer(c.expiresAt,c.departurePending&&(deployed(s,Number(id))||operativeInTransit(s,Number(id)))?0:s.hour+1,1e9))&&integer(c.paid,0,1e9))&&s.recruited.every(id=>s.contracts[id]),'Los contratos guardados son inválidos.');
  const ids=rosterFor(s).map(o=>o.id),validIds=values=>Array.isArray(values)&&new Set(values).size===values.length&&values.every(id=>ids.includes(id));
  requireThat(validIds(s.recruited)&&validIds(s.squad)&&s.squad.length<=6&&s.squad.every(id=>s.recruited.includes(id)),'El destacamento del archivo es inválido.');
  requireThat(object(s.operativeState)&&rosterFor(s).every(o=>{const r=s.operativeState[o.id];return object(r)&&integer(r.hp,0,o.maxHp)&&integer(r.fatigue,0,100)&&typeof r.alive==='boolean'&&r.alive===(r.hp>0);}),'Las hojas de servicio son inválidas.');
  requireThat(object(s.flags)&&Object.keys(base.flags).every(k=>typeof s.flags[k]==='boolean')&&object(s.routes)&&Object.keys(base.routes).every(k=>typeof s.routes[k]==='boolean'),'Los acuerdos del archivo son inválidos.');
  const resources=values=>object(values)&&Object.entries(values).every(([k,v])=>k in base.resources&&integer(v,0,100000));
  requireThat(Array.isArray(s.production)&&s.production.length<=9&&s.production.every(p=>object(p)&&typeof p.name==='string'&&p.name.length<100&&sector(p.sector)&&integer(p.due,0,1e9)&&resources(p.yield)),'La producción del archivo es inválida.');
  requireThat(Array.isArray(s.shipments)&&s.shipments.length<=1000&&s.shipments.every(p=>object(p)&&integer(p.due,0,1e9)&&resources(p.goods)),'Los cargamentos del archivo son inválidos.');
  requireThat(['blockade','completed','defeated'].every(k=>typeof s[k]==='boolean')&&Array.isArray(s.log)&&s.log.length<=80&&s.log.every(p=>object(p)&&integer(p.hour,0,1e9)&&typeof p.text==='string'&&p.text.length<=1000),'El registro del archivo es inválido.');
  if(s.pendingBattle!==null){const b=s.pendingBattle;requireThat((!b.sceneId||(b.sceneId==='yatasto'&&b.sector==='tucuman'&&b.exploration===true))&&(!b.missionAllies||(b.sector==='san_lorenzo'&&Array.isArray(b.missionAllies)&&b.missionAllies.length===1&&Number(b.missionAllies[0].id)===57&&b.missionAllies[0].missionAlly===true)),'La escena pendiente es inválida.');requireThat(object(b)&&typeof b.id==='string'&&b.id.length<100&&(sector(b.sector)||b.sector==='san_lorenzo')&&integer(b.seed,0,4294967295)&&Array.isArray(b.squad)&&b.squad.length<=(b.defenseGroupId?rosterFor(s).length:b.assaultSquads?48:6)&&new Set(b.squad.map(o=>o.id)).size===b.squad.length&&b.squad.every(o=>object(o)&&(b.defenseGroupId||b.assaultSquads?s.recruited.includes(o.id)&&operativeLocation(s,o.id)===b.sector:s.squad.includes(o.id))&&integer(o.loaded,0,2)&&integer(o.ammo,0,10)&&integer(o.hp,1,100)),'La batalla guardada es inválida.');}
  if(s.pendingBattle)for(const unit of s.pendingBattle.squad){requireThat(unit.preserveLoading===undefined||typeof unit.preserveLoading==='boolean','El estado de carga del despliegue es inválido.');const op=rosterFor(s).find(o=>o.id===Number(unit.id)),maxHp=unit.maxHp??op.maxHp;requireThat(integer(maxHp,1,op.maxHp)&&unit.hp<=maxHp,'La salud del despliegue guardado es inválida.');for(const [field,limit] of Object.entries({bleeding:100,bandaged:maxHp-unit.hp,energy:100}))if(unit[field]!==undefined)requireThat(Number.isFinite(unit[field])&&unit[field]>=0&&unit[field]<=limit,'Las heridas del despliegue guardado son inválidas.');if(unit.medkits!==undefined)requireThat(integer(unit.medkits,0,100000),'Los botiquines del despliegue guardado son inválidos.');}
  s.horseState??={...initialHorseState(),hour:s.hour};
  requireThat(object(s.horseState)&&s.horseState.version===1&&integer(s.horseState.hour,0,s.hour)&&integer(s.horseState.nextId,1,100000)&&Array.isArray(s.horseState.horses)&&s.horseState.horses.length<=10000&&new Set(s.horseState.horses.map(h=>h?.id)).size===s.horseState.horses.length&&Array.isArray(s.horseState.log)&&s.horseState.log.length<=40&&s.horseState.log.every(t=>typeof t==='string'&&t.length<1000),'La caballada guardada es inválida.');
  requireThat(s.horseState.horses.every(h=>object(h)&&typeof h.id==='string'&&typeof h.name==='string'&&h.name.length<=60&&['mare','stallion'].includes(h.sex)&&sector(h.location)&&integer(h.bornAt,-1000000,s.hour)&&typeof h.hired==='boolean'&&(h.returned===undefined||typeof h.returned==='boolean')&&(h.pregnantUntil===null||integer(h.pregnantUntil,0,1e9))&&(h.hireUntil===null||integer(h.hireUntil,0,1e9))&&Number.isFinite(h.stamina)&&h.stamina>=0&&h.stamina<=100&&Number.isFinite(h.condition)&&h.condition>=0&&h.condition<=100&&integer(h.feed,0,100000)&&(h.assignedTo===null||s.recruited.includes(h.assignedTo))),'Los caballos guardados son inválidos.');
  const mounts=s.horseState.horses.filter(h=>!h.returned&&h.assignedTo!==null).map(h=>h.assignedTo);requireThat(new Set(mounts).size===mounts.length,'Un jinete no puede tener dos monturas asignadas.');
  migrateSquads(s);
  requireThat(Array.isArray(s.squads)&&s.squads.length>0&&s.squads.length<=8&&new Set(s.squads.map(q=>q.id)).size===s.squads.length&&s.squads.every(q=>object(q)&&typeof q.id==='string'&&/^squad-[1-9][0-9]*$/.test(q.id)&&typeof q.name==='string'&&q.name.length<=30&&sector(q.location)&&validIds(q.members)&&q.members.length<=6&&q.members.every(id=>s.recruited.includes(id))),'Las escuadras guardadas son inválidas.');
  validateSquadTravel(s);validateAssaultDeployment(s);
  const assigned=s.squads.flatMap(q=>q.members);requireThat(new Set(assigned).size===assigned.length,'Un combatiente no puede pertenecer a dos escuadras.');const selected=s.squads.find(q=>q.id===s.activeSquadId);requireThat(selected&&selected.location===s.location&&JSON.stringify(selected.members)===JSON.stringify(s.squad),'La escuadra activa del archivo es inválida.');
  requireThat(object(s.sectorStates)&&Object.entries(s.sectorStates).every(([id,snapshot])=>(sector(id)||id==='san_lorenzo')&&validateSectorSnapshot(snapshot)),'Los sectores guardados son inválidos.');
  if(s.pendingBattle&&(s.pendingBattle.hour!==undefined||s.pendingBattle.secondOfHour!==undefined))requireThat(Number.isSafeInteger(s.pendingBattle.hour)&&s.pendingBattle.hour>=0&&(s.pendingBattle.secondOfHour===undefined||Number.isInteger(s.pendingBattle.secondOfHour)&&s.pendingBattle.secondOfHour>=0&&s.pendingBattle.secondOfHour<3600),'La hora inicial del despliegue es inválida.');
  requireThat(!s.pendingBattle||s.pendingBattle.syncedSeconds===undefined||(Number.isSafeInteger(s.pendingBattle.syncedSeconds)&&s.pendingBattle.syncedSeconds>=0),'El reloj del despliegue es inválido.');requireThat(Number.isInteger(s.secondOfHour??0)&&(s.secondOfHour??0)>=0&&(s.secondOfHour??0)<3600,'El reloj guardado es inválido.');requireThat(s.deferredRaids===undefined||(Array.isArray(s.deferredRaids)&&s.deferredRaids.length<=1000&&s.deferredRaids.every(r=>object(r)&&['north','coast','interior'].includes(r.theater)&&sector(r.target))),'Las incursiones pendientes son inválidas.');validatePolitics(s);validateMedicalCare(s,rosterFor(s));validateAssignments(s,rosterFor(s));validateAssignmentAttention(s,rosterFor(s));validateLogisticsNotice(s);validateArtilleryDeployment(s.pendingBattle);validateContractAttention(s,rosterFor(s));validateMorale(s,rosterFor(s));validateEquipment(s,rosterFor(s));validateEnemyGroups(s,rosterFor(s));validateDeploymentReturnState(s);if(s.pendingBattle){if(s.pendingBattle.exits===undefined)prepareDeploymentExits(s,s.pendingBattle);requireThat(s.pendingBattle.exitRulesVersion===1&&validateSectorExits(s.pendingBattle.sector,s.pendingBattle.sceneId??null,s.pendingBattle.exits),'Las salidas guardadas son inválidas.');if(s.pendingBattle.resumeSnapshot){const b=validateSectorSnapshot(s.pendingBattle.resumeSnapshot);requireThat(b.battleId===s.pendingBattle.id&&b.sectorId===s.pendingBattle.sector&&(b.sceneId??null)===(s.pendingBattle.sceneId??null)&&b.syncedSeconds===(s.pendingBattle.syncedSeconds??0),'La resolución pendiente es inválida.');}}s.lastError=null;return s;
}
