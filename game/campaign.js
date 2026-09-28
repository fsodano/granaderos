import {dialogueForNPC,chooseDialogue,validateSavedDialogues} from './content-dialogue.js';
import {acknowledgeCivilians,transferCivilian,validateCampaignCivilians,migrateCampaignCivilians} from './campaign-civilians.js';
import {synchronizeCampaignPresence,validateCampaignPresence,acknowledgeSuccessionDeaths} from './campaign-presence.js';
import {gainsExperience,characterForOperative,isWorldCharacter} from './content-character-ids.js';
import {campaignPlace,worldCell,locationId,validWorldLocation,worldOwner,cellTravelPlan,cellTravelReason,cellStepHours,adjacentCells} from './world-cells.js';
import {compactCellScene,expandCellScene,cellSceneSaveReplacer} from './cell-scene-storage.js';
import {validateForceWeapon} from './content-force-equipment.js';
import {weaponSaveReplacer,weaponSpecification,validateWeaponCarrier,validateWeaponReferences,setWeaponDefinition} from './weapon-definition.js';
import {usesAuthoredEquipment,addArmoryStock,equipArmoryItem,validateArmoryItems} from './armory-items.js';
import {hiringArrivalReason,hiringArrivalOptions,pendingHire,hireArrivalOrder,advanceHireArrivals,redirectHire,cancelHireArrival,validateHireArrivals} from './hiring-arrivals.js';
import {attachCampaignContent,validateCampaignContent} from './campaign-content.js';
import {MISSION_SCENES,YATASTO_NPCS,missionContacts,missionStatus,talkMission,sanLorenzoAlly,validateMissions} from './missions.js';
export {MISSION_SCENES,missionStatus} from './missions.js';
import {dailyIncome,artilleryCount,collectSectorCash} from './economy.js';
export {dailyIncome,incomeSources,incomeSummary} from './economy.js';
import {speechFor} from './characters.js';
import {prepareGarrison,returnGarrison,validGarrisons} from './garrison.js';
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
import {returnAmmunition} from './ammunition.js';
import {ENCOUNTERS,encounterDefinitions,canRecruitEncounter,encounterForOperative,encountersFor,encounterRequirements,encounterHireTerms} from './encounters.js';
export {ENCOUNTERS,encountersFor} from './encounters.js';
import {migrateSquads,activeSquad,operativeLocation,synchronizeSquad,validateSectorSnapshot,validatePersonalInventory} from './squads.js';
export {activeSquad,operativeLocation} from './squads.js';
import {isImportedEquipment,deliverEquipmentShipments,validEquipmentShipments,EQUIPMENT_CATALOG,equipmentCatalog,refillCost,firearmRepairCost,deployedArtillery} from './equipment.js';
export {EQUIPMENT_CATALOG,armoryInventory,refillCost,firearmRepairCost} from './equipment.js';
import {ROYALIST_COMMANDS,NORTHERN_AXIS,coastalRevenue,royalistIntel,mentorDispatch,oppositionFor} from './narrative.js';
export {ROYALIST_COMMANDS,royalistIntel,mentorDispatch} from './narrative.js';
import {rosterFor as baseRosterFor,CIVIC_RECRUITS,civicStatus as baseCivicStatus,createOfficerRecord} from './recruitment.js';
export {CIVIC_RECRUITS} from './recruitment.js';
export function civicStatus(s,id,local=false){return baseCivicStatus(s,id);}
import {OPERATIVES, WEAPONS, CAMPAIGN_SECTORS, FACTIONS, PHASES, RESOURCE_NAMES} from './data.js';
export {OPERATIVES, WEAPONS, CAMPAIGN_SECTORS, FACTIONS, PHASES, RESOURCE_NAMES};
export function rosterFor(s){return baseRosterFor(s).map(o=>{const record=s.operativeState?.[o.id]??{};return {...o,...(s.loadouts?.[o.id]??{}),...(record.weaponMetadata?{weaponMetadata:record.weaponMetadata}:{}),...Object.fromEntries(TRAINABLE_SKILLS.map(skill=>[skill,Math.min(100,(o[skill]??0)+(record.trainedStats?.[skill]??0))])),strength:Math.max(o.strength,Math.min(100,record.strength??o.strength))};});}
export function deploymentCost(s){const roster=rosterFor(s);return s.squad.reduce((total,id)=>total+(weaponSpecification(roster.find(o=>o.id===id))?.capacity?10:0),0);}
function returnTraining(s,id,report){validateTraining(report);for(const field of ['trainedStats','skillPractice'])if(report[field]!==undefined)s.operativeState[id][field]=clone(report[field]);}
function returnEquipment(s,id,report,snapshot){
 requireThat(s.operativeState[id].deathMinute===undefined||report.hp===0,'Una muerte confirmada no puede revertirse en el parte.');
 const actual=snapshot?.units.find(u=>u.side==='player'&&Number(u.id)===id);if(!actual)return;
 validateWeaponCarrier(actual);validateWeaponReferences(s,actual);
 if(report.inventory!==undefined)requireThat(JSON.stringify(report.inventory)===JSON.stringify(actual.inventory),'El inventario del parte no coincide con el sector.');
 const record=s.operativeState[id];
 record.medkits=actual.medkits??0;record.bleeding=actual.bleeding??0;
 s.loadouts[id]={...s.loadouts[id],weapon:actual.weaponDropped?0:actual.weapon,...(actual.blade===undefined?{}:{blade:actual.blade})};
 setWeaponDefinition(record,actual.weaponDropped?{}:actual);record.jammed=actual.weaponDropped?false:Boolean(actual.jammed);
 record.inventory=clone(validatePersonalInventory(actual.inventory));
}
function removeFromService(s,id){
  const location=operativeLocation(s,id);s.operativeState[id].location=location;s.recruited=s.recruited.filter(x=>x!==id);s.squad=s.squad.filter(x=>x!==id);for(const squad of s.squads)squad.members=squad.members.filter(x=>x!==id);
  for(const course of s.militiaTraining.filter(t=>t.trainerId===id)){if(course.rank>0&&s.sectors[course.sector].owner==='patriot')s.sectors[course.sector].militia[course.rank-1]+=course.count;}s.militiaTraining=s.militiaTraining.filter(t=>t.trainerId!==id);delete s.contracts[id];
}
function signContract(s,op,term){
  const quote=contractQuote(s,op,term??'day');requireThat(quote.available,quote.reason);pay(s,{treasury:quote.price});s.contracts[op.id]={kind:quote.permanent?'patriot':'paid',term:term??'day',started:s.hour,expiresAt:quote.expiresAt,paid:quote.price};
}
function receiveHire(s,arrival,joinSquad=true){
  const id=arrival.operativeId,op=rosterFor(s).find(o=>o.id===id);
  s.contracts[id]={kind:arrival.permanent?'patriot':'paid',term:arrival.term,started:s.hour,expiresAt:arrival.permanent?null:s.hour+arrival.serviceHours,paid:arrival.paid};
  s.recruited.push(id);s.operativeState[id].location=arrival.destination;
  if(joinSquad&&!s.pendingBattle&&s.location===arrival.destination&&s.squad.length<6)s.squad.push(id);
  note(s,`${op.name} llega a ${sector(arrival.destination).name} y comienza su servicio.`);
  if(s.contentCampaign){const line=speechFor(op,'hired');if(line?.trim())note(s,`${op.name}: «${line}»`);}
}
function receiveDueHires(s,joinSquad=true){advanceHireArrivals(s,arrival=>receiveHire(s,arrival,joinSquad));}
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
export function initialCampaign(seed=1812,content=null){
  const state={civilianState:{version:1,people:{}},hiringArrivals:[],equipmentShipments:[],missions:{},sceneStates:{},missionAllies:{},garrisons:{},nextMilitiaId:20000,quests:{},cityLoyaltyEvents:[],contracts:{},militiaTraining:[],foundMoney:[],economyVersion:2,version:1,seed:seed>>>0,hour:0,phase:0,location:'retiro',activeSquadId:'squad-1',squads:[{id:'squad-1',name:'Primera escuadra',members:[],location:'retiro'}],sectorStates:{},resources:{treasury:3200},reputation:{directory:35,gauchos:0,pardos:10,foreign:20,indigenous:0,royalists:-100},sectors:Object.fromEntries(CAMPAIGN_SECTORS.map(x=>[x.id,{owner:x.id==='retiro'?'patriot':'royalist',loyalty:x.id==='retiro'?65:25,militia:[0,0,0],damageUntil:0,fort:0}])),artillerySelection:[],armory:{},loadouts:{},lastConversation:null,conversations:{},officer:null,recruited:[],squad:[],operativeState:Object.fromEntries([...OPERATIVES,...CIVIC_RECRUITS].map(o=>[o.id,{hp:o.maxHp,fatigue:0,alive:true,xp:0,priming:50,flints:4,rations:2,torches:2,condition:100}])),flags:{armyFunded:false,academy:false,sanLorenzo:false,northPact:false,partisanSupply:false,foundry:false,parliament:false,emancipation:false,commission:false,mentoring:false},routes:{posta:false,flotilla:false,carts:false,mules:false},blockade:false,pendingBattle:null,completed:false,defeated:false,log:[{hour:0,text:'Retiro, 1812. Solo el cuartel está bajo tu control. Contratá combatientes, creá tu granadero o combiná ambas opciones para partir.'}],lastError:null};
  if(content!==null)attachCampaignContent(state,content);
  return state;
}
export function isSupplied(s,id){
  if(s.sectors[id]?.owner!=='patriot'||s.sectors.retiro.owner!=='patriot')return false;
  const visited=new Set(['retiro']),queue=['retiro'];
  while(queue.length){const here=queue.shift();for(const next of sector(here).neighbors){if(!visited.has(next)&&s.sectors[next].owner==='patriot'){visited.add(next);queue.push(next);}}}
  return visited.has(id);
}
export function recruitmentStatus(s,id,local=false){
  if(s.recruited.includes(id))return {available:false,reason:'Ya se encuentra en tus filas.'};
  if(!s.operativeState[id]?.alive)return {available:false,reason:'Ha caído en combate.'};
  const character=characterForOperative(s,id);
  if(character&&isWorldCharacter(character)){
    const reason=!character.encounter.recruitable?'Este habitante no es un recluta.':s.operativeState[id].captured?'Este habitante está cautivo.':!local?'Buscá a este habitante en el mapa y hablá con él o ella.':null;
    return {available:!reason,reason:reason??'Disponible para incorporarse.'};
  }
  const conditions={
    3:[true,''],4:[true,''],10:[true,''],
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
  return {recruits:OPERATIVES.map(o=>({...o,...recruitmentStatus(s,o.id)})),destinations:CAMPAIGN_SECTORS.filter(x=>x.id!==s.location),phase:PHASES[s.phase]};
}
function hasReadyCombatant(s){return s.recruited.some(id=>s.operativeState[id]?.alive&&s.operativeState[id].hp>0&&!s.operativeState[id].captured);}
function progress(s){
  if(s.completed)return;
  if(s.phase===0&&(s.flags.academy||hasReadyCombatant(s))){s.flags.academy=true;s.phase=1;note(s,'El destacamento está listo para partir. Llegan noticias de un desembarco realista junto a San Lorenzo.');}
  if(s.phase===1&&s.flags.sanLorenzo){s.phase=2;standing(s,'directory',15);note(s,'Victoria en San Lorenzo. San Martín marcha al norte para estudiar la situación del Ejército del Norte.');}
  if(s.phase===2&&s.missions?.yatasto?.completed&&s.sectors.tucuman.owner==='patriot'&&s.flags.northPact&&isSupplied(s,'salta')){s.phase=3;s.flags.mentoring=true;note(s,'En Yatasto, San Martín confía el norte a Güemes. El esfuerzo principal se traslada a Cuyo.');}
  if(s.phase===3&&s.flags.foundry&&s.flags.parliament&&s.flags.armyFunded&&artilleryCount(s)>=3&&['mendoza','uspallata','los_patos'].every(id=>s.sectors[id].owner==='patriot'&&s.sectors[id].fort>=1)){
    s.phase=4;note(s,'El Plumerillo alcanza plena capacidad. Tres mil infantes, artillería y pasos seguros: San Martín puede incorporarse al ejército.');
  }
  if(!s.completed&&s.phase===4&&s.recruited.includes(57)&&Object.values(s.sectors).every(x=>x.owner==='patriot')&&!s.blockade&&!s.pendingBattle){s.completed=true;note(s,'¡Campaña concluida! Las provincias están libres y el Ejército de los Andes queda preparado para la liberación continental.');for(const op of rosterFor(s).filter(o=>s.recruited.includes(o.id)&&s.operativeState[o.id]?.alive)){const line=speechFor(op,'ending');if(line?.trim())note(s,`${op.name}: «${line}»`);}}
  if(s.sectors.retiro.owner!=='patriot'){s.defeated=true;note(s,'El cuartel de Retiro ha caído. El ejército debe reorganizarse desde una nueva campaña.');}
}
function raid(s,theater,forcedTarget=null){
  const targets=CAMPAIGN_SECTORS.filter(x=>x.theater===theater&&s.sectors[x.id].owner==='patriot'&&x.id!=='retiro');
  if(!targets.length)return;
  const priorities=theater==='north'?NORTHERN_AXIS:theater==='coast'?['san_nicolas','santa_fe','ensenada','buenos_aires']:['cordoba'];
  targets.sort((a,b)=>theater==='coast'?b.income-a.income:priorities.indexOf(a.id)-priorities.indexOf(b.id));
  const target=forcedTarget?sector(forcedTarget):targets.find(x=>theater!=='interior'||s.sectors[x.id].loyalty<50);if(!target||s.sectors[target.id].owner!=='patriot')return;if(s.pendingBattle&&(s.pendingBattle.sector===target.id||s.location===target.id)){s.deferredRaids??=[];s.deferredRaids.push({theater,target:target.id});note(s,`Una incursión espera la resolución del combate en ${target.name}.`);return;}
  const command=ROYALIST_COMMANDS.find(c=>c.id===(theater==='north'?'north':theater==='coast'?'naval':'partisans'));
  note(s,theater==='north'?`Pezuela ordena a la vanguardia de Pío Tristán avanzar sobre ${target.name} por el corredor de Humahuaca.`:theater==='coast'?`Romarate dirige una incursión contra ${target.name}: la recaudación aduanera atrae a la flotilla de Montevideo.`:`Las partidas leales a la Corona aprovechan el descontento de ${target.name} para atacar los convoyes del interior.`);
  const region=s.sectors[target.id],strength=3+Math.floor(s.hour/240);
  const defense=region.militia.reduce((v,n,i)=>v+n*(i+1),0)+region.fort*4+((s.squads??[{location:s.location,members:s.squad}]).filter(q=>q.location===target.id).reduce((n,q)=>n+q.members.length*2,0))+(theater==='north'&&s.flags.northPact?5:0);
  if(defense>=strength){recordCityLoyalty(s,{sectorId:target.id,kind:'defense',eventId:`raid-${theater}-${s.hour}`});note(s,`La guarnición de ${target.name} rechazó la incursión de ${command.name}.`);return;}
  region.damageUntil=s.hour+24*14;recordCityLoyalty(s,{sectorId:target.id,kind:'defeat',eventId:`raid-${theater}-${s.hour}`});
  if(theater==='coast'){s.blockade=true;note(s,`La flotilla de Romarate bloquea ${target.name}. Las aduanas reducen sus ingresos.`);}
  else {if(theater==='interior'){const silver=Math.min(150,s.resources.treasury);s.resources.treasury-=silver;note(s,`Las partidas saquean ${silver} pesos. La pérdida de Córdoba interrumpe el Camino Real y los convoyes de Cuyo.`);}region.owner='royalist';region.militia=[0,0,0];if(s.garrisons)delete s.garrisons[target.id];note(s,`Los realistas recuperan ${target.name} y cortan las rutas de abastecimiento.`);}
}
function deployed(s,id){return s.pendingBattle?.squad?.some(u=>Number(u.id)===Number(id));}
function releaseDeferred(s){if(s.pendingBattle)return;for(const id of [...s.recruited])if(s.contracts?.[id]?.departurePending){removeFromService(s,id);note(s,'Un voluntario cumple su contrato y deja el destacamento.');}const raids=s.deferredRaids??[];s.deferredRaids=[];for(const r of raids)raid(s,r.theater,r.target);}
function tick(s,hours,{joinArrivals=true}={}){
  requireThat(Number.isInteger(hours)&&hours>=1&&hours<=240,'El avance debe ser de 1 a 240 horas.');
  for(let i=0;i<hours;i++){
    s.hour++;for(const id of [...s.recruited]){const contract=s.contracts?.[id];if(contract?.expiresAt!==null&&contract?.expiresAt!==undefined&&contract.expiresAt<=s.hour){if(deployed(s,id)){contract.departurePending=true;continue;}const name=rosterFor(s).find(o=>o.id===id)?.name??'Un combatiente';removeFromService(s,id);note(s,`${name} concluye su contrato y deja el destacamento. Su hoja de servicio queda disponible.`);}}
    for(const course of [...(s.militiaTraining??[])]){
      if(s.sectors[course.sector].owner!=='patriot'){s.militiaTraining=s.militiaTraining.filter(t=>t!==course);note(s,'La ocupación enemiga dispersa un curso de milicias.');continue;}
      if(!s.operativeState[course.trainerId]?.alive||operativeLocation(s,course.trainerId)!==course.sector||!isSupplied(s,course.sector)||!militiaEligibility(s,course.sector).eligible)continue;
      course.remaining--;if(course.remaining<=0){s.sectors[course.sector].militia[course.rank]+=course.count;s.militiaTraining=s.militiaTraining.filter(t=>t!==course);note(s,`Tres milicianos completan su instrucción en ${sector(course.sector).name}.`);}
    }
    deliverEquipmentShipments(s);
    if(s.hour%24===0){
      dailyPolitics(s);
      const income=dailyIncome(s);
      for(const def of CAMPAIGN_SECTORS)if(isSupplied(s,def.id))s.sectors[def.id].loyalty=Math.min(100,s.sectors[def.id].loyalty+1);
      add(s,{treasury:income});
      for(const id of s.recruited){const op=s.operativeState[id];if(op.alive&&!deployed(s,id)&&isSupplied(s,operativeLocation(s,id))){op.hp=Math.min(rosterFor(s).find(o=>o.id===id).maxHp,op.hp+5);op.fatigue=Math.max(0,op.fatigue-10);}}
      note(s,`Las estancias y aduanas aportaron ${income} pesos a la tesorería.`);
    }
    if(s.hour%720===0){const payroll=s.recruited.filter(id=>s.contracts?.[id]?.kind==='legacy').reduce((sum,id)=>sum+rosterFor(s).find(o=>o.id===id).monthlyPay,0);if(payroll>0){if(s.resources.treasury>=payroll){s.resources.treasury-=payroll;standing(s,'foreign',5);note(s,`Se abonaron ${payroll} pesos en estipendios mensuales.`);}else{standing(s,'foreign',-20);standing(s,'directory',-10);note(s,'La tesorería no pudo abonar los sueldos. Los voluntarios reclaman el pago.');}}}
    if(!s.completed&&s.hour%120===0)raid(s,'north');
    if(!s.completed&&s.hour%168===0&&coastalRevenue(s)>=500)raid(s,'coast');
    if(!s.completed&&s.hour%144===0)raid(s,'interior');
    receiveDueHires(s,joinArrivals);synchronizeSquad(s);synchronizeCampaignPresence(s);progress(s);if(s.defeated)break;
  }
}
function travelPath(s,from,to){
  const queue=[[from]],seen=new Set([from]);while(queue.length){const path=queue.shift(),last=path.at(-1);if(last===to)return path;for(const id of sector(last).neighbors)if(!seen.has(id)&&s.sectors[id].owner==='patriot'){seen.add(id);queue.push([...path,id]);}}return null;
}
export function dispatchCampaign(previous,action){
  const s=migrateSquads(clone(previous));s.lastError=null;s.militiaTraining??=[];s.missions??={};s.sceneStates??={};s.missionAllies??={};s.quests??={};migrateContracts(s);
  try{
    requireThat(action&&typeof action.type==='string','La orden no es válida.');
    requireThat(!s.defeated||s.pendingBattle&&['syncTacticalTime','leaveSector','battleResult'].includes(action.type),'La campaña ha terminado. Inicia otra campaña para continuar.');
    requireThat(!s.completed||['syncTacticalTime','wait','travel','visitSector','leaveSector','talkNPC','createSquad','selectSquad','squad','equip','resupply','repairWeapon','purchaseEquipment','transport','militia','cancelMilitia','renewContract','dismiss','redirectHire','cancelHireArrival'].includes(action.type),'La campaña está ganada. Puedes recorrer las provincias y atender a tus escuadras.');
    requireThat(!s.pendingBattle||['battleResult','leaveSector','talkNPC','finishMission','syncTacticalTime'].includes(action.type),'Hay una batalla pendiente. Resuélvela antes de dar nuevas órdenes.');
    if(['travel','attack','visitSector'].includes(action.type))requireThat(!s.squad.some(id=>militiaAssignment(s,id)),'Un instructor de la escuadra está asignado a las milicias. Cancelá su curso o dejalo en una escuadra de guarnición.');
    switch(action.type){
      case 'syncTacticalTime':{
        requireThat(s.pendingBattle&&s.pendingBattle.id===action.battleId,'El reloj no corresponde al despliegue.');
        const elapsed=action.elapsedSeconds,previous=s.pendingBattle.syncedSeconds??0;
        requireThat(Number.isSafeInteger(elapsed)&&elapsed>=previous&&elapsed-previous<=864000,'El tiempo táctico es inválido.');
        const snapshot=action.sectorState?validateSectorSnapshot(action.sectorState):null;
        if(snapshot)requireThat(snapshot.elapsedSeconds===elapsed,'El parte y el reloj no coinciden.');
        const seconds=(s.secondOfHour??0)+elapsed-previous,hours=Math.floor(seconds/3600);
        s.secondOfHour=seconds%3600;if(hours)tick(s,hours);
        // A death is confirmed at this tactical checkpoint, after its time has elapsed.
        if(snapshot){acknowledgeCivilians(s,snapshot);acknowledgeSuccessionDeaths(s,snapshot);}
        s.pendingBattle.syncedSeconds=elapsed;break;
      }
      case 'wait':tick(s,action.hours??24);break;
      case 'academy':requireThat(s.flags.academy||hasReadyCombatant(s),'Contratá un combatiente o creá tu granadero para comenzar.');break;
      case 'purchaseEquipment':{
        const item=equipmentCatalog(s).find(o=>String(o.item)===String(action.item)),quantity=action.quantity??1;
        requireThat(item&&Number.isInteger(quantity)&&quantity>0&&quantity<=100,'El pedido de armamento es inválido.');
        requireThat(s.sectors.retiro.owner==='patriot'&&isSupplied(s,'retiro'),'La sala de armas de Retiro está incomunicada.');
        if(isImportedEquipment(item)){requireThat(s.sectors.ensenada.owner==='patriot'&&s.reputation.foreign>=0,'El pedido requiere Ensenada libre y comerciantes dispuestos a negociar.');s.equipmentShipments??=[];requireThat(s.equipmentShipments.length<1000,'Hay demasiados pedidos pendientes.');pay(s,{treasury:tradeQuote(s,item.price)*quantity});const delay=72+Math.floor(random(s)*49);s.equipmentShipments.push({item:item.item,quantity,due:s.hour+delay});note(s,`Pedido de ${quantity} × ${item.name}: arribo en ${delay} horas, sujeto al bloqueo.`);break;}
        pay(s,{treasury:item.price*quantity});s.armory??={};addArmoryStock(s,item,quantity);
        note(s,`La sala de armas entrega ${quantity} × ${item.name}.`);break;
      }
      case 'configureArtillery':{
        const types=action.types;requireThat(Array.isArray(types)&&types.length<=3&&types.every(t=>['bronze4','field8','swivel'].includes(t)),'Seleccioná hasta tres piezas de artillería.');
        const total=artilleryCount(s);
        requireThat(types.length<=total,'No hay suficientes piezas disponibles en el campamento.');
        for(const type of ['bronze4','field8','swivel'])requireThat(types.filter(t=>t===type).length<=(s.armory?.[type]??0),'No disponés de tantas piezas de ese modelo.');
        s.artillerySelection=[...types];note(s,'La batería prepara las piezas elegidas para la próxima operación.');break;
      }
      case 'equip':{
        const id=Number(action.operativeId),itemId=Number(action.itemId),slot=action.slot,op=rosterFor(s).find(o=>o.id===id);
        if(usesAuthoredEquipment(s)){requireThat(op&&s.recruited.includes(id)&&s.operativeState[id].alive,'El combatiente no está disponible.');requireThat(['weapon','blade'].includes(slot),'Elegí el arma principal o el arma blanca.');const item=equipArmoryItem(s,op,action);note(s,`${op.name} recibe ${weaponSpecification(item).name}.`);break;}
        requireThat(op&&s.recruited.includes(id)&&s.operativeState[id].alive,'El combatiente no está disponible.');requireThat(['weapon','blade'].includes(slot),'Elegí el arma principal o el arma blanca.');
        requireThat(Number.isInteger(itemId)&&itemId>=1800&&itemId<=1813&&(slot!=='blade'||itemId>=1809),'Esta arma no corresponde a ese espacio.');
        requireThat(op[slot]!==itemId,'El combatiente ya lleva esa arma.');requireThat((s.armory?.[itemId]??0)>0,'No quedan unidades de esa arma en la armería.');
        s.armory[itemId]--;s.armory[op[slot]]=(s.armory[op[slot]]??0)+1;s.loadouts??={};s.loadouts[id]={...(s.loadouts[id]??{}),[slot]:itemId};note(s,`${op.name} recibe ${WEAPONS[itemId].name}.`);break;
      }
      case 'resupply':case 'repairWeapon':{
        const id=Number(action.operativeId),op=rosterFor(s).find(o=>o.id===id),record=s.operativeState[id];requireThat(op&&s.recruited.includes(id)&&record.alive,'El combatiente no está disponible.');
        requireThat(['retiro','cordoba','mendoza'].includes(s.location)&&s.sectors[s.location].owner==='patriot'&&isSupplied(s,s.location),'Debes llegar a un taller comunicado en Retiro, Córdoba o Mendoza.');
        const cost=action.type==='resupply'?refillCost(record):firearmRepairCost(record);requireThat(cost>0,action.type==='resupply'?'Las provisiones ya están completas.':'El arma ya está en perfecto estado.');pay(s,{treasury:cost});
        if(action.type==='resupply'){record.priming=Math.max(50,record.priming??50);record.flints=Math.max(4,record.flints??4);record.rations=Math.max(2,record.rations??2);record.torches=Math.max(2,record.torches??2);record.medkits=Math.max(2,record.medkits??2);note(s,`${op.name} recibe vendas, sílex, cargas de cebo y raciones por ${cost} pesos.`);}else{record.condition=100;note(s,`La maestranza repara el arma de ${op.name} por ${cost} pesos.`);}break;
      }
      case 'createOfficer':{
        requireThat(!s.officer,'El Cabildo ya ha designado a tu oficial.');requireThat(s.sectors.retiro.owner==='patriot','El cuartel de Retiro está ocupado.');
        const op=createOfficerRecord(action.name,action.answers,action.profile);const creationCost=action.profile?.version===2?0:300;pay(s,{treasury:creationCost});s.officer={name:op.name,answers:clone(action.answers),...(action.profile?{profile:clone(action.profile)}:{})};s.contracts[op.id]={kind:'patriot',term:'month',started:s.hour,expiresAt:null,paid:creationCost};s.operativeState[op.id]={hp:op.maxHp,fatigue:0,alive:true,xp:0,priming:50,flints:4,rations:2,torches:2,condition:100};s.recruited.push(op.id);s.operativeState[op.id].location=s.location;if(s.squad.length<6)s.squad.push(op.id);note(s,`${op.name} aprueba el examen y recibe su comisión de oficial.`);break;
      }
      case 'recruitCivic':{
        const id=Number(action.id),status=civicStatus(s,id);requireThat(status.available,status.reason);
        const options=hiringArrivalOptions(s),destination=action.destination??(options.some(o=>o.id===s.location)?s.location:options[0]?.id);
        const reason=hiringArrivalReason(s,destination);requireThat(!reason,reason);
        const op=rosterFor(s).find(o=>o.id===id),term=action.term??'day',quote=contractQuote(s,op,term);
        requireThat(quote.available,quote.reason);pay(s,{treasury:quote.price});
        const arrival=hireArrivalOrder(s,op,term,quote,destination);
        if(arrival.travelHours){s.hiringArrivals??=[];s.hiringArrivals.push(arrival);note(s,`${op.name} viaja a ${sector(destination).name}. Llegada prevista en ${arrival.travelHours} horas; el contrato empieza al llegar.`);}
        else receiveHire(s,arrival);
        break;
      }
      case 'redirectHire':redirectHire(s,action.id,action.destination);note(s,'Se cambia el destino de llegada. El viaje comienza de nuevo, sin otro pago.');break;
      case 'cancelHireArrival':cancelHireArrival(s,action.id);note(s,'Se cancela la llegada y se devuelve el anticipo.');break;
      case 'recruit':throw Error('Los oficiales históricos se incorporan mediante encuentros personales.');
      case 'renewContract':{
        const id=Number(action.id),op=rosterFor(s).find(o=>o.id===id),current=s.contracts[id];requireThat(op&&s.recruited.includes(id)&&current,'El combatiente no tiene un contrato activo.');requireThat(current.kind!=='patriot','Este oficial sirve por la causa y no necesita renovación.');const quote=contractQuote(s,op,action.term??'day');requireThat(quote.available,quote.reason);pay(s,{treasury:quote.price});s.contracts[id]={kind:'paid',term:action.term??'day',started:s.hour,expiresAt:quote.expiresAt,paid:quote.price};note(s,`${op.name} renueva su servicio por ${quote.hours/24} días.`);break;
      }
      case 'dismiss':{const id=Number(action.id);requireThat(s.recruited.includes(id),'El combatiente no está contratado.');requireThat(id!==1000,'Tu oficial dirige la campaña y no puede ser despedido.');removeFromService(s,id);note(s,'El combatiente deja el servicio sin devolución del anticipo.');break;}
      case 'createSquad':case 'squad':{
        const ids=action.ids;requireThat(Array.isArray(ids)&&ids.length>0&&ids.length<=6&&new Set(ids).size===ids.length&&ids.every(id=>s.recruited.includes(id)&&s.operativeState[id].alive),'Seleccioná entre uno y seis combatientes disponibles.');
        requireThat(ids.every(id=>operativeLocation(s,id)===s.location),'Los combatientes deben reunirse en el mismo sector antes de cambiar de escuadra.');
        if(action.type==='createSquad'){requireThat(s.squads.length<8,'El ejército ya tiene ocho escuadras.');requireThat(typeof action.name==='string'&&action.name.trim().length>=2&&action.name.trim().length<=30&&!/[<>]/.test(action.name),'Escribí un nombre de escuadra de entre2 y30 caracteres.');}
        for(const squad of s.squads)if(squad.id!==s.activeSquadId||action.type==='createSquad')squad.members=squad.members.filter(id=>!ids.includes(id));
        if(action.type==='createSquad'){const id=`squad-${Math.max(0,...s.squads.map(q=>Number(q.id.split('-')[1])))+1}`;s.squads.push({id,name:action.name.trim(),members:[...ids],location:s.location});s.activeSquadId=id;}
        for(const id of s.squad)if(!ids.includes(id))s.operativeState[id].location=s.location;
        s.squad=[...ids];break;
      }
      case 'selectSquad':{const squad=s.squads.find(q=>q.id===action.id);requireThat(squad,'La escuadra no existe.');s.activeSquadId=squad.id;s.squad=[...squad.members];s.location=squad.location;break;}
      case 'talkNPC':{
        requireThat(s.pendingBattle,'Primero entrá al sector.');const snapshot=validateSectorSnapshot(action.sectorState),npc=(s.pendingBattle.sceneId==='yatasto'?missionContacts(s):encountersFor(s,s.pendingBattle.sector)).find(n=>n.id===action.npcId&&n.sector===s.pendingBattle.sector),id=Number(action.unitId),actor=rosterFor(s).find(o=>o.id===id),unit=snapshot.units.find(u=>u.side==='player'&&Number(u.id)===id),local=snapshot.npcs?.find(n=>n.id===action.npcId);
        acknowledgeCivilians(s,snapshot);requireThat(npc&&actor&&unit&&local&&(local.hp??100)>0&&!local.unconscious&&s.squad.includes(id)&&unit.hp>0&&!unit.unconscious,'El interlocutor no está disponible en este sector.');requireThat(snapshot.mode==='exploration'||snapshot.status==='victory'||snapshot.sectorCleared,'Terminá el combate antes de conversar.');requireThat(Number.isInteger(local.x)&&Number.isInteger(local.y)&&Math.abs(unit.x-local.x)+Math.abs(unit.y-local.y)<=1,'Acercá al combatiente al interlocutor para hablar.');
        requireThat(['friendly','direct','recruit','quest','mission','dialogue'].includes(action.approach),'La forma de dirigirse al interlocutor es inválida.');
        const quest=questForNPC(s,npc.id);let text=npc.greeting+(quest&&quest.status!=='completed'?` ${quest.offer}`:''),outcome='conversation',dialogue=null;
        if(action.approach==='dialogue'){dialogue=chooseDialogue(s,npc,action.dialogueChoice,action.dialogueNode,snapshot);text=dialogue.text;outcome='dialogue';}
        if(action.approach==='direct'){
          const terms=`un mando con ${npc.requiredLeadership} de liderazgo y ${npc.requiredLiberated} localidades seguras`,hireTerms=encounterHireTerms(s,npc);
          const service=hireTerms.length?`Puedo incorporarme por contrato: ${hireTerms.map(q=>`${q.name.toLowerCase()}, ${q.price} pesos`).join('; ')}.`:'Puedo incorporarme sin paga.';
          text=!canRecruitEncounter(npc)?npc.greeting:npc.recruitable===undefined?`Para incorporarme necesito ${terms} y que se cumplan mis compromisos regionales.`:`${service} Necesito ${terms}.${npc.requiredSector?` También debe estar liberada ${sector(npc.requiredSector).name}.`:''}`;
        }
        if(action.approach==='mission'){requireThat(s.pendingBattle.sceneId==='yatasto','No hay una conferencia pendiente.');text=talkMission(s,npc.id,isSupplied(s,'salta'));outcome='mission';}
        if(action.approach==='quest'){
          requireThat(quest,'Este interlocutor no tiene un encargo pendiente.');requireThat(quest.status!=='completed','El encargo ya fue cumplido.');
          if(quest.status==='unoffered'){s.quests[quest.id]={status:'offered',offeredAt:s.hour,completedAt:null};text=quest.offer;outcome='questOffered';}
          else{requireThat(quest.conditionMet,'Primero asegurá las localidades indicadas en el encargo.');add(s,{treasury:quest.reward});s.quests[quest.id]={...s.quests[quest.id],status:'completed',completedAt:s.hour};recordCityLoyalty(s,{sectorId:quest.sector,kind:'quest',eventId:`npc-${quest.id}`});text=quest.delivery;outcome='questCompleted';note(s,`Encargo cumplido: ${quest.title}. Pago recibido: ${quest.reward} pesos.`);}
        }
        if(action.approach==='recruit'){
          requireThat(canRecruitEncounter(npc),'Este habitante no es un recluta.');requireThat(!s.recruited.includes(npc.operativeId),'Este combatiente ya se incorporó.');const reason=encounterRequirements(s,npc,actor);requireThat(!reason,reason);
          const gate=recruitmentStatus(s,npc.operativeId,true);requireThat(gate.available,gate.reason);const op=rosterFor(s).find(o=>o.id===npc.operativeId);signContract(s,op,action.term);s.recruited.push(op.id);transferCivilian(s,local);s.operativeState[op.id].location=s.location;if(s.squad.length<6){s.squad.push(op.id);s.pendingBattle.squad.push({...clone(op),...clone(s.operativeState[op.id]),loaded:0,ammo:0});}const line=s.contentCampaign?speechFor(op,'hired'):'Acepto servir junto a ustedes.';text=`${line?.trim()?line+' ':''}${op.name} se incorpora a la fuerza patriota.`;outcome='recruited';note(s,text);
        }
        s.conversations??={};s.conversations[npc.id]={...s.conversations[npc.id],...(dialogue?{dialogueNode:dialogue.node}:{}),met:true,lastApproach:action.approach,hour:s.hour,sector:s.pendingBattle.sector};s.lastConversation={npcId:npc.id,speaker:npc.name,text,outcome,...(dialogue?{dialogueNode:dialogue.node}:{}),operativeId:npc.operativeId??null,options:[...(dialogueForNPC(s,npc)?['dialogue']:[]),...(canRecruitEncounter(npc)&&!s.recruited.includes(npc.operativeId)?['friendly','direct','recruit']:['friendly','direct']),...(s.pendingBattle.sceneId==='yatasto'?['mission']:[]),...(questForNPC(s,npc.id)&&questForNPC(s,npc.id).status!=='completed'?['quest']:[])]};break;
      }
      case 'visitMission':{
        requireThat(action.mission==='yatasto','La escena solicitada no existe.');requireThat(s.location==='tucuman'&&s.phase>=2,'Viajá a Tucumán después de San Lorenzo para acudir a Yatasto.');requireThat(!s.missions.yatasto?.completed,'La conferencia de Yatasto ya concluyó.');
        const entered=dispatchCampaign(s,{type:'visitSector'});requireThat(!entered.lastError,entered.lastError);Object.assign(s,entered);Object.assign(s.pendingBattle,{sceneId:'yatasto',missionId:'yatasto',name:MISSION_SCENES.yatasto.name,npcs:missionContacts(s),garrison:[],artillery:[]});break;
      }
      case 'finishMission':{
        requireThat(s.pendingBattle?.sceneId==='yatasto'&&s.pendingBattle.id===action.battleId,'No hay una conferencia de Yatasto abierta.');requireThat(s.missions.yatasto?.frontier,'Completá los partes, el análisis y el acuerdo de frontera antes de cerrar la conferencia.');
        const result=dispatchCampaign(s,{...action,type:'leaveSector'});requireThat(!result.lastError,result.lastError);Object.assign(s,result);s.missions.yatasto.completed=true;s.missions.yatasto.stage='completed';note(s,'La conferencia de Yatasto concluye. Belgrano entrega el mando y la preparación continental se orienta hacia Cuyo.');break;
      }
      case 'visitSector':{
        const at=locationId(action.sector??s.location);requireThat(at===s.location,'La escuadra debe viajar al sector antes de entrar.');requireThat(validWorldLocation(at)&&worldOwner(s,at)!=='royalist','El sector está ocupado; prepará un ataque.');requireThat(s.squad.length>0,'La escuadra no tiene combatientes.');const def=campaignPlace(at),allocated={};let issued=0;for(const id of s.squad){const capacity=weaponSpecification(rosterFor(s).find(o=>o.id===id))?.capacity??0,rounds=capacity?10:0;allocated[id]={loaded:Math.min(capacity,rounds),ammo:Math.max(0,rounds-capacity)};issued+=rounds;}pay(s,{treasury:issued});
        s.pendingBattle={id:`visit-${at}-${s.hour}-${s.seed}`,sector:at,name:def.name,biome:def.biome,theater:def.theater,seed:s.seed,exploration:true,night:s.hour%24<6||s.hour%24>=20,issuedCartridges:issued,ammunitionSources:(s.sectorStates[at]?.units??[]).filter(u=>u.side==='enemy').map(u=>({id:u.id,ammo:u.ammo??0,loaded:u.loaded??0})),wasRoyalist:false,npcs:encountersFor(s,at),squad:s.squad.map(id=>({...clone(rosterFor(s).find(o=>o.id===id)),...clone(s.operativeState[id]),...allocated[id],canMount:true})),enemies:[],artillery:[],weather:{rain:false,humidity:def.theater==='coast'?.8:.3}};s.pendingBattle.garrison=prepareGarrison(s,at);s.pendingBattle.garrisonLootSources=(s.sectorStates[at]?.units??[]).filter(u=>u.militia&&u.hp<=0).map(u=>({id:u.id,ammo:u.ammo??0,loaded:u.loaded??0}));note(s,`La escuadra entra en ${def.name} para reconocer el lugar y hablar con sus habitantes.`);break;
      }
      case 'leaveSector':{
        requireThat(s.pendingBattle?.exploration&&action.battleId===s.pendingBattle.id,'La visita no corresponde al sector abierto.');const snapshot=validateSectorSnapshot(action.sectorState);const visit=s.pendingBattle;acknowledgeCivilians(s,snapshot);
        if(!sector(visit.sector))requireThat(snapshot.sectorId===visit.sector&&snapshot.sourceMapId===visit.sector,'El parte no corresponde a la celda abierta.');
        const reports=(action.survivors??[]).filter(r=>!snapshot.units.some(u=>u.militia&&Number(u.id)===Number(r.id)));returnGarrison(s,visit,snapshot);requireThat(Array.isArray(reports)&&new Set(reports.map(r=>Number(r.id))).size===reports.length,'El parte de la escuadra es inválido.');s.resources.treasury+=returnAmmunition(visit,reports,snapshot);if(visit.sceneId)s.sceneStates[visit.sceneId]=clone(snapshot);else s.sectorStates[visit.sector]=clone(compactCellScene(snapshot));
        for(const report of reports){const id=Number(report.id);returnTraining(s,id,report);requireThat(s.squad.includes(id),'El combatiente no pertenece a la visita.');returnEquipment(s,id,report,snapshot);for(const [field,max]of Object.entries({hp:rosterFor(s).find(o=>o.id===id).maxHp,energy:100,weight:1000,strength:100,strengthTraining:10000,priming:100000,flints:100000,rations:100000,torches:100000,condition:100,fatigue:100,boleadoras:100000})){if(report[field]!==undefined){requireThat(Number.isFinite(report[field])&&report[field]>=0&&report[field]<=max,'El estado del combatiente es inválido.');s.operativeState[id][field]=report[field];}}s.operativeState[id].alive=s.operativeState[id].hp>0;if(report.inventory!==undefined){validatePersonalInventory(report.inventory);s.operativeState[id].inventory=clone(report.inventory);}}
        s.squad=s.squad.filter(id=>s.operativeState[id].alive);if(!s.completed&&!s.recruited.some(id=>s.operativeState[id].alive))s.defeated=true;collectSectorCash(s,snapshot);s.pendingBattle=null;note(s,'La escuadra vuelve a la carta de operaciones.');break;
      }
      case 'travel':{
        requireThat(s.squad.length>0,'No hay combatientes en esta escuadra.');
        const destination=locationId(action.sector);requireThat(destination,'El destino no existe.');action={...action,sector:destination};
        if(!sector(s.location)||!sector(destination)){
          requireThat((action.mode??'march')==='march','Las postas, carretas y flotillas necesitan una ruta entre localidades. Para esta celda, elegí marcha a pie.');
          const plan=cellTravelPlan(s,destination);requireThat(!plan.reason,plan.reason);requireThat(plan.path.length>1,'La escuadra ya está en esa celda.');
          for(const next of plan.path.slice(1)){
            const reason=cellTravelReason(s,next);if(reason){note(s,`La marcha se detiene: ${reason}`);break;}
            // Consume each leg before changing position. Contract departures
            // remain at the last reached cell; arriving hires never join en route.
            for(let hour=0;hour<cellStepHours(next)&&s.squad.length&&!s.defeated;hour++)tick(s,1,{joinArrivals:false});
            if(!s.squad.length||s.defeated){note(s,'La marcha se interrumpe antes de alcanzar la siguiente celda.');break;}
            const blocked=cellTravelReason(s,next);if(blocked){note(s,`La marcha se detiene: ${blocked}`);break;}
            s.location=next;synchronizeSquad(s);
            for(const id of s.squad)s.operativeState[id].fatigue=Math.min(90,s.operativeState[id].fatigue+(s.recruited.includes(57)?0:worldCell(next).biome==='mountain'?4:2));
          }
          note(s,`La escuadra queda en ${campaignPlace(s.location).name}.`);break;
        }
        requireThat(s.squad.length>0,'La escuadra no tiene combatientes para marchar.');
        requireThat(sector(action.sector),'El destino no existe.');requireThat(s.sectors[action.sector].owner==='patriot','Primero debes liberar el destino.');const path=travelPath(s,s.location,action.sector);requireThat(path,'Los realistas cortan la ruta de tránsito.');
        const mode=action.mode??'march';requireThat(['march','posta','flotilla','carts'].includes(mode),'Medio de transporte desconocido.');
        if(mode!=='march')requireThat(s.routes[mode],'Debes organizar ese transporte.');
        if(mode==='flotilla')requireThat(!s.blockade&&path.every(id=>sector(id).theater==='coast'),'La flotilla requiere una ruta costera sin bloqueo.');
        const mountain=path.some(id=>sector(id).biome==='mountain');requireThat(!(path.some(id=>['uspallata','los_patos'].includes(id))&&campaignDate(s).month>=6&&campaignDate(s).month<=8),'La nieve invernal ha cerrado los pasos.');
        if(mode==='posta')pay(s,{treasury:10*Math.max(1,path.length-1)});
        const hours=Math.max(1,Math.ceil((path.length-1)*(mode==='posta'?4:mode==='flotilla'?5:mode==='carts'?18:12)*(mountain?1.5:1)));tick(s,hours,{joinArrivals:false});if(!s.squad.length){note(s,'La marcha se cancela al terminar el último contrato.');break;}const openPath=[];for(const id of path){if(s.sectors[id].owner!=='patriot')break;openPath.push(id);}s.location=openPath.at(-1)??s.location;if(s.location!==action.sector)note(s,'El avance se detiene: una incursión cortó la ruta durante la marcha.');
        for(const id of s.squad)s.operativeState[id].fatigue=Math.min(90,s.operativeState[id].fatigue+(s.recruited.includes(57)?0:mountain?20:8));note(s,`El destacamento llega a ${sector(s.location).name}.`);break;
      }
      case 'transport':requireThat(['posta','flotilla','carts','mules'].includes(action.mode),'Transporte desconocido.');requireThat(!s.routes[action.mode],'Ese transporte ya está organizado.');pay(s,action.mode==='posta'?{treasury:150}:action.mode==='flotilla'?{treasury:400}:action.mode==='mules'?{treasury:120}:{treasury:180});s.routes[action.mode]=true;note(s,'La nueva red de transporte queda disponible.');break;
      case 'fundArmy':requireThat(s.flags.foundry,'Primero organizá El Plumerillo.');requireThat(!s.flags.armyFunded,'El ejército ya está financiado.');pay(s,{treasury:3000});s.flags.armyFunded=true;note(s,'Se abonan 3000 pesos para instruir y equipar al Ejército de los Andes.');break;
      case 'foundry':requireThat(s.sectors.mendoza.owner==='patriot'&&s.recruited.includes(2),'Libera Mendoza e incorpora a Beltrán.');requireThat(!s.flags.foundry,'El Plumerillo ya está organizado.');pay(s,{treasury:500});s.flags.foundry=true;note(s,'Beltrán organiza El Plumerillo.');break;
      case 'policy':{applyPolicy(s,action.kind);break;}
      case 'diplomacy':{
        const kind=action.kind;
        if(kind==='northPact'){requireThat(s.sectors.salta.owner==='patriot','Libera Salta para reunir su Cabildo.');requireThat(!s.flags.northPact,'El pacto del norte ya está firmado.');pay(s,{treasury:300});s.flags.northPact=true;standing(s,'gauchos',45);note(s,'Güemes acepta custodiar el norte con respeto a la autonomía provincial.');}
        else if(kind==='partisanSupply'){requireThat(s.sectors.tucuman.owner==='patriot','Abre una ruta hacia las partidas del norte.');requireThat(!s.flags.partisanSupply,'Las partidas ya recibieron su entrega.');pay(s,{treasury:250});s.flags.partisanSupply=true;standing(s,'gauchos',20);note(s,'Las partidas reciben cincuenta mosquetes. Azurduy ofrece su colaboración.');}
        else if(kind==='parliament'){requireThat(s.sectors.mendoza.owner==='patriot','El parlamento debe prepararse desde Cuyo.');requireThat(!s.flags.parliament,'Los pasos ya cuentan con un acuerdo.');pay(s,{treasury:200});s.flags.parliament=true;standing(s,'indigenous',60);note(s,'El parlamento acuerda el tránsito y respeta la autonomía pehuenche.');}
        else if(kind==='emancipation'){requireThat(!s.flags.emancipation,'El decreto ya fue proclamado.');pay(s,{treasury:150});s.flags.emancipation=true;standing(s,'pardos',30);standing(s,'directory',5);note(s,'El Cabildo proclama la libertad y garantiza la protección de las familias emancipadas.');}
        else if(kind==='commission'){requireThat(s.flags.emancipation,'Primero garantiza la emancipación.');requireThat(!s.flags.commission,'Las comisiones ya fueron otorgadas.');pay(s,{treasury:100});s.flags.commission=true;standing(s,'pardos',20);note(s,'Los batallones de Pardos y Morenos reciben comisiones de oficiales.');}
        else if(kind==='gift'){pay(s,{treasury:80});standing(s,'indigenous',15);note(s,'Una comitiva entrega presentes y renueva los acuerdos de frontera.');}
        else if(kind==='requisition'){requireThat(sector(s.location),'La contribución se solicita en el sector principal de una localidad.');requireThat(policyStatus(s).requisitionReady,'Las estancias necesitan catorce días para recuperarse.');s.politics??={};s.politics.requisitionAfter=s.hour+336;add(s,{treasury:200});standing(s,'gauchos',-20);standing(s,'directory',-10);s.sectors[s.location].loyalty=Math.max(0,s.sectors[s.location].loyalty-20);note(s,'La requisa abastece al ejército, pero provoca rechazo en la población.');}
        else if(kind==='autonomy'){pay(s,{treasury:80});standing(s,'gauchos',15);standing(s,'directory',-3);note(s,'El ejército reconoce las autoridades provinciales.');}
        else throw Error('No existe esa propuesta diplomática.');break;
      }
      case 'militia':{
        const at=action.sector??s.location,rank=Number(action.rank??0),trainerId=Number(action.trainerId),trainer=rosterFor(s).find(o=>o.id===trainerId);
        requireThat(s.sectors[at]?.owner==='patriot'&&isSupplied(s,at),'La instrucción necesita un sector propio y abastecido.');requireThat([0,1,2].includes(rank),'Grado de milicia inválido.');const eligibility=militiaEligibility(s,at);requireThat(eligibility.eligible,eligibility.reason);
        requireThat(trainer&&s.recruited.includes(trainerId)&&s.operativeState[trainerId]?.alive&&operativeLocation(s,trainerId)===at,'Elegí un instructor contratado y presente en el sector.');
        requireThat(trainer.leadership>=30,'El instructor necesita al menos 30 de liderazgo.');requireThat(!militiaAssignment(s,trainerId),'El instructor ya dirige otro curso.');requireThat(!s.militiaTraining.some(t=>t.sector===at),'Ya hay un curso activo en ese sector.');
        const region=s.sectors[at];requireThat(rank===0||region.militia[rank-1]>=MILITIA_COHORT,'La promoción necesita tres milicianos del grado anterior.');requireThat(rank>0||region.militia.reduce((a,b)=>a+b,0)+MILITIA_COHORT<=MILITIA_LIMIT,'La guarnición admite hasta sesenta milicianos.');
        const course=militiaCourse(trainer,rank);pay(s,course.cost);if(rank>0)region.militia[rank-1]-=course.count;
        s.militiaTraining.push({sector:at,rank,trainerId,count:course.count,remaining:course.hours,duration:course.hours,started:s.hour});note(s,`${trainer.name} inicia un curso de milicias de ${course.hours} horas en ${sector(at).name}.`);break;
      }
      case 'cancelMilitia':{
        const course=s.militiaTraining.find(t=>t.sector===action.sector);requireThat(course,'No hay un curso activo en ese sector.');if(course.rank>0&&s.sectors[course.sector].owner==='patriot')s.sectors[course.sector].militia[course.rank-1]+=course.count;s.militiaTraining=s.militiaTraining.filter(t=>t!==course);note(s,'Se suspende el curso. Los soldados regresan a su grado anterior; los suministros de instrucción ya se consumieron.');break;
      }
      case 'fortify':{const at=action.sector??s.location;requireThat(s.sectors[at]?.owner==='patriot','Solo puedes fortificar sectores propios.');requireThat(s.sectors[at].fort<3,'El sector ya tiene la máxima fortificación.');pay(s,{treasury:150});s.sectors[at].fort++;note(s,`Se refuerzan las defensas de ${sector(at).name}.`);break;}
      case 'attack':{
        const at=action.sector??'san_lorenzo',san=at==='san_lorenzo',def=san?{id:at,name:'Combate de San Lorenzo',biome:'river',theater:'coast'}:sector(at);
        requireThat(def,'No existe ese campo de batalla.');requireThat(san?s.location==='san_nicolas':(s.location===at||def.neighbors.includes(s.location)||!sector(s.location)&&adjacentCells(s.location,at)),'La escuadra debe marchar a un sector vecino antes de atacar.');requireThat(!(['uspallata','los_patos'].includes(at)&&campaignDate(s).month>=6&&campaignDate(s).month<=8),'La nieve invernal ha cerrado los pasos.');requireThat(s.squad.some(id=>s.operativeState[id].alive&&s.operativeState[id].hp>0),'No hay combatientes disponibles.');
        if(san)requireThat(s.phase>=1&&!s.flags.sanLorenzo&&s.sectors.san_nicolas.owner==='patriot','Organiza Retiro y libera San Nicolás antes de combatir en San Lorenzo.');
        else {requireThat(s.sectors[at].owner==='royalist'||(s.blockade&&def.theater==='coast'),'El sector ya está bajo control patriota.');requireThat(def.neighbors.some(id=>s.sectors[id].owner==='patriot'&&isSupplied(s,id)),'Debes abrir una ruta hasta el frente.');}
        const origin=s.location;if(!san&&s.location!==at){tick(s,12,{joinArrivals:false});if(!s.squad.length){note(s,'El despliegue se cancela: no quedan contratos vigentes en la escuadra.');break;}s.location=at;}
        const allocated={};let issued=0;
        for(const id of s.squad){const op=rosterFor(s).find(o=>o.id===id),capacity=weaponSpecification(op)?.capacity??0,rounds=capacity?10:0;allocated[id]={loaded:Math.min(capacity,rounds),ammo:Math.max(0,rounds-capacity)};issued+=rounds;}
        pay(s,{treasury:issued});
        s.pendingBattle={id:`${at}-${s.hour}-${s.seed}`,origin,sector:at,name:def.name,biome:def.biome,theater:def.theater,seed:Math.floor(random(s)*4294967296),issuedCartridges:issued,wasRoyalist:!san&&s.sectors[at].owner==='royalist',npcs:encountersFor(s,at),squad:s.squad.map(id=>({...clone(rosterFor(s).find(o=>o.id===id)),...clone(s.operativeState[id]),...allocated[id],canMount:true,poncho:true})),difficulty:san?2:Math.min(4,1+Math.floor(s.hour/240)+(def.theater==='north'?1:0)),weather:{rain:def.biome==='wetland'||random(s)<0.2,humidity:def.theater==='coast'?0.8:0.3},cannons:artilleryCount(s)};s.pendingBattle.artillery=deployedArtillery({...s,location:origin});Object.assign(s.pendingBattle,oppositionFor(s.pendingBattle,s));const retainedEnemies=s.sectorStates[at];if(retainedEnemies&&!retainedEnemies.sectorCleared)s.pendingBattle.ammunitionSources=retainedEnemies.units.filter(u=>u.side==='enemy').map(u=>({id:u.id,ammo:u.ammo??0,loaded:u.loaded??0}));if(san){s.pendingBattle.missionId='san_lorenzo';s.pendingBattle.missionAllies=[sanLorenzoAlly(s)];}s.pendingBattle.garrison=prepareGarrison(s,at);s.pendingBattle.garrisonLootSources=(s.sectorStates[at]?.units??[]).filter(u=>u.militia&&u.hp<=0).map(u=>({id:u.id,ammo:u.ammo??0,loaded:u.loaded??0}));note(s,`El destacamento se despliega para ${def.name}. Mando enemigo: ${s.pendingBattle.enemyCommander}.`);break;
      }
      case 'battleResult':{
        requireThat(s.pendingBattle&&!s.pendingBattle.exploration,'No hay batalla de conquista pendiente.');requireThat(action.battleId===s.pendingBattle.id,'El resultado no corresponde a la batalla pendiente.');requireThat(['victory','defeat','retreat'].includes(action.outcome),'Resultado de batalla inválido.');const request=s.pendingBattle;
        const survivors=(action.survivors??[]).filter(r=>!request.garrison?.some(g=>g.id===Number(r.id))&&!request.missionAllies?.some(g=>g.id===Number(r.id))&&!action.sectorState?.units?.some(u=>u.militia&&Number(u.id)===Number(r.id)));requireThat(Array.isArray(survivors),'El parte de bajas es inválido.');
        requireThat(survivors.every(x=>x&&request.squad.some(o=>o.id===Number(x.id))&&Number.isFinite(x.hp)&&x.hp>=0)&&new Set(survivors.map(x=>Number(x.id))).size===survivors.length,'El parte de bajas contiene combatientes o heridas inválidos.');
        const battleSnapshot=action.sectorState?validateSectorSnapshot(action.sectorState):null;if(request.missionId==='san_lorenzo'){requireThat(battleSnapshot,'San Lorenzo necesita un parte táctico completo.');const commander=battleSnapshot.units.find(u=>Number(u.id)===57&&u.missionAlly);requireThat(commander,'Falta el comandante aliado en el parte.');s.missionAllies.san_lorenzo=clone(commander);if(action.outcome==='victory'&&commander.hp>0)requireThat(battleSnapshot.status==='victory','La victoria exige derrotar a los realistas y conservar con vida al comandante.');if(commander.hp<=0){action={...action,outcome:'defeat'};s.defeated=true;s.missions.san_lorenzo={stage:'failed',completed:false};note(s,'San Martín ha caído en San Lorenzo. La misión y la campaña concluyen con una derrota.');}else if(action.outcome==='victory')s.missions.san_lorenzo={stage:'completed',completed:true};}if(battleSnapshot)acknowledgeCivilians(s,battleSnapshot);returnGarrison(s,request,battleSnapshot);s.resources.treasury+=returnAmmunition(request,survivors,battleSnapshot);
        for(const id of s.squad){const report=survivors.find(x=>Number(x.id)===id);if(report){returnTraining(s,id,report);returnEquipment(s,id,report,battleSnapshot);const max=rosterFor(s).find(o=>o.id===id).maxHp;s.operativeState[id].hp=Math.max(0,Math.min(max,Number(report.hp)||0));s.operativeState[id].alive=s.operativeState[id].hp>0;for(const [field,limit] of Object.entries({priming:100000,flints:100000,rations:100000,torches:100000,condition:100,fatigue:100,energy:100,weight:1000,strength:100,strengthTraining:10000,boleadoras:100000}))if(report[field]!==undefined){requireThat(Number.isFinite(report[field])&&report[field]>=0&&report[field]<=limit,'El parte de suministros es inválido.');s.operativeState[id][field]=report[field];}if(report.inventory!==undefined)s.operativeState[id].inventory=clone(validatePersonalInventory(report.inventory));}else if(action.outcome!=='retreat'){s.operativeState[id].hp=0;s.operativeState[id].alive=false;}}
        for(const id of s.squad)if(gainsExperience(s,rosterFor(s).find(o=>o.id===id))&&s.operativeState[id].alive){
          const before=rosterFor(s).find(o=>o.id===id),xp=action.outcome==='victory'?60:action.outcome==='defeat'?20:10;
          s.operativeState[id].xp=(s.operativeState[id].xp??0)+xp;const after=rosterFor(s).find(o=>o.id===id);
          if(after.level>before.level){s.operativeState[id].maxHp=after.maxHp;s.operativeState[id].hp+=after.maxHp-before.maxHp;note(s,`${after.name} mejora su instrucción tras el combate: grado${after.level}.`);}
        }
        if(action.outcome==='victory'){
          recordCityLoyalty(s,{sectorId:request.sector==='san_lorenzo'?'san_nicolas':request.sector,kind:'victory',eventId:request.id});if(request.sector==='san_lorenzo')s.flags.sanLorenzo=true;
          else {const region=s.sectors[request.sector];region.owner='patriot';region.loyalty=Math.max(50,region.loyalty);region.damageUntil=0;}
          if(request.theater==='coast')s.blockade=false;if(request.wasRoyalist||request.sector==='san_lorenzo')add(s,{treasury:250});standing(s,'directory',5);standing(s,'gauchos',request.theater==='north'?10:2);note(s,`Victoria en ${request.name}. Se recuperan armas y fondos realistas.`);
        }else{s.location=request.origin??s.location;standing(s,'directory',-5);note(s,`El destacamento se retira de ${request.name}.`);}
        if(action.sectorState)s.sectorStates[request.sector]=clone(validateSectorSnapshot(action.sectorState));
        collectSectorCash(s,battleSnapshot);s.pendingBattle=null;s.squad=s.squad.filter(id=>s.operativeState[id].alive);if(!s.squad.length){const reserve=s.recruited.filter(id=>s.operativeState[id].alive&&operativeLocation(s,id)===s.location);s.squad=reserve.slice(0,6);if(!s.recruited.some(id=>s.operativeState[id].alive)){s.defeated=true;note(s,'No quedan combatientes. La campaña ha terminado.');}}break;
      }
      default:throw Error('Orden desconocida.');
    }
    releaseDeferred(s);receiveDueHires(s);synchronizeSquad(s);synchronizeCampaignPresence(s);progress(s);
    for(const [flag,at] of Object.entries({academy:'retiro',foundry:'mendoza',northPact:'salta',partisanSupply:'tucuman',parliament:'mendoza',emancipation:'buenos_aires',commission:'buenos_aires'}))if(s.flags[flag]&&!previous.flags[flag])recordCityLoyalty(s,{sectorId:at,kind:'quest',eventId:`quest-${flag}`});
    return s;
  }catch(error){const rejected=clone(previous);rejected.lastError=error.message;return rejected;}
}
export function serializeCampaign(s){return JSON.stringify(s,cellSceneSaveReplacer(weaponSaveReplacer(s)));}
export function restoreCampaign(text){
  requireThat(typeof text==='string'&&text.length<=5_000_000,'El archivo de campaña no es compatible.');
  const s=JSON.parse(text);validateCampaignContent(s);const base=initialCampaign();
  const integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
  const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  requireThat(object(s)&&s.version===1&&integer(s.hour,0,24*365*100)&&integer(s.phase,0,4)&&integer(s.seed,0,4294967295)&&validWorldLocation(s.location),'El archivo de campaña no es compatible.');
  requireThat(!['production','shipments','depots','convoys','horseState'].some(key=>key in s),'Esta partida contiene sistemas retirados. Iniciá una campaña nueva.');
  requireThat(s.economyVersion===2,'Esta partida usa la economía anterior. Iniciá una campaña nueva.');
  requireThat(Array.isArray(s.foundMoney)&&new Set(s.foundMoney).size===s.foundMoney.length&&s.foundMoney.every(id=>sector(id)),'El registro de fondos es inválido.');
  s.equipmentShipments??=[];requireThat(validEquipmentShipments(s),'Los pedidos de armas guardados son inválidos.');
  requireThat(object(s.resources)&&Object.keys(base.resources).every(k=>integer(s.resources[k],0,1e9)),'La tesorería del archivo es inválida.');
  requireThat(object(s.reputation)&&Object.keys(base.reputation).every(k=>integer(s.reputation[k],-100,100))&&s.reputation.royalists===-100,'Las relaciones del archivo son inválidas.');
  requireThat(object(s.sectors)&&Object.keys(s.sectors).length===13&&CAMPAIGN_SECTORS.every(d=>{const r=s.sectors[d.id];return object(r)&&['patriot','royalist'].includes(r.owner)&&integer(r.loyalty,0,100)&&integer(r.fort,0,3)&&integer(r.damageUntil,0,1e9)&&Array.isArray(r.militia)&&r.militia.length===3&&r.militia.every(x=>integer(x,0,100000));}),'El mapa del archivo es inválido.');
  s.militiaTraining??=[];
  requireThat(Array.isArray(s.militiaTraining)&&s.militiaTraining.length<=13&&new Set(s.militiaTraining.map(t=>t?.sector)).size===s.militiaTraining.length&&new Set(s.militiaTraining.map(t=>t?.trainerId)).size===s.militiaTraining.length&&s.militiaTraining.every(t=>object(t)&&sector(t.sector)&&integer(t.rank,0,2)&&Number.isInteger(t.trainerId)&&baseRosterFor(s).some(o=>o.id===t.trainerId)&&s.recruited?.includes(t.trainerId)&&t.count===3&&integer(t.duration,1,96)&&integer(t.remaining,1,t.duration)&&integer(t.started,0,s.hour)),'Los cursos de milicias guardados son inválidos.');
  // Version1 migration: old saves did not contain civic volunteers or a custom officer.
  if(s.officer===undefined)s.officer=null;
  requireThat(s.officer===null||(object(s.officer)&&typeof s.officer.name==='string'&&object(s.officer.answers)),'El examen guardado es inválido.');
  if(s.officer)createOfficerRecord(s.officer.name,s.officer.answers,s.officer.profile);
  requireThat(object(s.operativeState),'Las hojas de servicio son inválidas.');
  for(const op of s.contentCampaign?[]:CIVIC_RECRUITS)s.operativeState[op.id]??={hp:op.maxHp,fatigue:0,alive:true,xp:0,priming:50,flints:4,rations:2,torches:2,condition:100};
  for(const op of Object.values(s.operativeState)){requireThat(object(op),'Las hojas de servicio son inválidas.');validateTraining(op);for(const k of ['medkits','bleeding'])if(op[k]!==undefined)requireThat(Number.isInteger(op[k]),'Los suministros y heridas guardados son inválidos.');op.xp??=0;if(op.inventory!==undefined)validatePersonalInventory(op.inventory);for(const [field,limit]of Object.entries({energy:100,bleeding:10,medkits:1000000,weight:1000,strength:100,strengthTraining:10000,boleadoras:100000})){if(op[field]!==undefined)requireThat(Number.isFinite(op[field])&&op[field]>=0&&op[field]<=limit,'El estado físico guardado es inválido.');}for(const [field,baseline] of Object.entries({priming:50,flints:4,rations:2,torches:2,condition:100})){op[field]??=baseline;requireThat(integer(op[field],0,field==='condition'?100:100000),'Los suministros guardados son inválidos.');}requireThat(integer(op.xp,0,1e7),'La experiencia guardada es inválida.');}
  for(const op of rosterFor(s))validateWeaponCarrier({...s.operativeState[op.id],weapon:op.weapon});
  s.missions??={};s.sceneStates??={};s.missionAllies??={};requireThat(validateMissions(s)&&object(s.sceneStates)&&Object.entries(s.sceneStates).every(([id,b])=>id==='yatasto'&&b.sceneId===id&&validateSectorSnapshot(b))&&object(s.missionAllies)&&Object.entries(s.missionAllies).every(([id,u])=>id==='san_lorenzo'&&object(u)&&u.missionAlly===true&&Number(u.id)===57&&typeof u.name==='string'&&Number.isInteger(u.weapon)&&(u.weapon===0||u.weapon>=1800&&u.weapon<=1813)&&Number.isInteger(u.blade)&&u.blade>=1809&&u.blade<=1813&&Number.isInteger(u.ammo)&&u.ammo>=0&&u.ammo<=100000&&Number.isInteger(u.loaded)&&u.loaded>=0&&u.loaded<=(weaponSpecification(u)?.capacity??0)&&Number.isFinite(u.hp)&&u.hp>=0&&u.hp<=100),'Las escenas guardadas son inválidas.');
  s.garrisons??={};s.nextMilitiaId??=20000;requireThat(validGarrisons(s),'Las guarniciones guardadas son inválidas.');
  s.quests??={};requireThat(validateQuests(s.quests,s.hour),'Los encargos guardados son inválidos.');
  s.lastConversation??=null;s.conversations??={};
  requireThat(object(s.conversations)&&Object.entries(s.conversations).every(([id,c])=>[...encounterDefinitions(s),...YATASTO_NPCS].some(n=>n.id===id)&&object(c)&&c.met===true&&['friendly','direct','recruit','quest','mission','dialogue'].includes(c.lastApproach)&&integer(c.hour,0,1e9)&&(c.sector===undefined||validWorldLocation(c.sector)||c.sector==='san_lorenzo')),'Las conversaciones guardadas son inválidas.');
  requireThat(s.lastConversation===null||(object(s.lastConversation)&&[...encounterDefinitions(s),...YATASTO_NPCS].some(n=>n.id===s.lastConversation.npcId)&&typeof s.lastConversation.text==='string'&&s.lastConversation.text.length<2000&&typeof s.lastConversation.speaker==='string'&&s.lastConversation.speaker.length<=100&&Array.isArray(s.lastConversation.options)&&s.lastConversation.options.every(o=>['friendly','direct','recruit','quest','mission','dialogue'].includes(o))),'El diálogo guardado es inválido.');
  validateSavedDialogues(s,encounterDefinitions(s));
  s.armory??={};s.loadouts??={};s.artillerySelection??=[];requireThat(Array.isArray(s.artillerySelection)&&s.artillerySelection.length<=3&&s.artillerySelection.every(t=>['bronze4','field8','swivel'].includes(t)),'La batería guardada es inválida.');
  requireThat(object(s.armory)&&Object.entries(s.armory).every(([key,v])=>[...equipmentCatalog(s),...EQUIPMENT_CATALOG].some(o=>String(o.item)===key)&&integer(v,0,100000)),'La armería guardada es inválida.');validateArmoryItems(s);
  requireThat(object(s.loadouts)&&Object.entries(s.loadouts).every(([id,slots])=>baseRosterFor(s).some(o=>o.id===Number(id))&&object(slots)&&Object.entries(slots).every(([slot,v])=>['weapon','blade'].includes(slot)&&(v===0&&slot==='weapon'||integer(v,slot==='blade'?1809:1800,1813)))),'Los equipos guardados son inválidos.');
  s.cityLoyaltyEvents??=[];requireThat(validCityLoyaltyEvents(s.cityLoyaltyEvents),'El registro de lealtad es inválido.');
  migrateContracts(s);requireThat(object(s.contracts)&&Object.entries(s.contracts).every(([id,c])=>s.recruited.includes(Number(id))&&object(c)&&(c.departurePending===undefined||typeof c.departurePending==='boolean')&&['paid','patriot','legacy'].includes(c.kind)&&['day','week','month'].includes(c.term)&&integer(c.started,0,s.hour)&&(c.expiresAt===null?c.kind!=='paid':integer(c.expiresAt,c.departurePending&&deployed(s,Number(id))?0:s.hour+1,1e9))&&integer(c.paid,0,1e9))&&s.recruited.every(id=>s.contracts[id]),'Los contratos guardados son inválidos.');
  for(const id of s.recruited){const c=characterForOperative(s,id);if(!c||!isWorldCharacter(c))continue;const contract=s.contracts[id];requireThat(c.service==='contract'?contract.kind==='paid'&&contract.expiresAt!==null:contract.kind==='patriot'&&contract.expiresAt===null&&contract.paid===0,'El contrato del habitante no coincide con su servicio.');}
  const ids=rosterFor(s).map(o=>o.id),validIds=values=>Array.isArray(values)&&new Set(values).size===values.length&&values.every(id=>ids.includes(id));
  requireThat(validIds(s.recruited)&&validIds(s.squad)&&s.squad.length<=6&&s.squad.every(id=>s.recruited.includes(id)),'El destacamento del archivo es inválido.');
  requireThat(s.recruited.every(id=>characterForOperative(s,id)?.encounter?.recruitable!==false),'Un habitante no reclutable no puede estar en la escuadra.');
  requireThat(object(s.operativeState)&&rosterFor(s).every(o=>{const r=s.operativeState[o.id];return object(r)&&integer(r.hp,0,o.maxHp)&&integer(r.fatigue,0,100)&&typeof r.alive==='boolean'&&r.alive===(r.hp>0)&&(r.location===undefined||validWorldLocation(r.location));}),'Las hojas de servicio son inválidas.');
  // Older authored saves retained the initial ceiling after gaining a level.
  for(const op of rosterFor(s))if(s.operativeState[op.id].maxHp!==undefined)s.operativeState[op.id].maxHp=op.maxHp;
  validateHireArrivals(s,rosterFor(s));
  requireThat(object(s.flags)&&Object.keys(base.flags).every(k=>typeof s.flags[k]==='boolean')&&object(s.routes)&&Object.keys(base.routes).every(k=>typeof s.routes[k]==='boolean'),'Los acuerdos del archivo son inválidos.');
  requireThat(['blockade','completed','defeated'].every(k=>typeof s[k]==='boolean')&&Array.isArray(s.log)&&s.log.length<=80&&s.log.every(p=>object(p)&&integer(p.hour,0,1e9)&&typeof p.text==='string'&&p.text.length<=1000),'El registro del archivo es inválido.');
  if(s.pendingBattle!==null){const b=s.pendingBattle;requireThat((!b.sceneId||(b.sceneId==='yatasto'&&b.sector==='tucuman'&&b.exploration===true))&&(!b.missionAllies||(b.sector==='san_lorenzo'&&Array.isArray(b.missionAllies)&&b.missionAllies.length===1&&Number(b.missionAllies[0].id)===57&&b.missionAllies[0].missionAlly===true)),'La escena pendiente es inválida.');requireThat(object(b)&&typeof b.id==='string'&&b.id.length<100&&(validWorldLocation(b.sector)||b.sector==='san_lorenzo')&&integer(b.seed,0,4294967295)&&Array.isArray(b.squad)&&b.squad.length<=6&&b.squad.every(o=>object(o)&&s.squad.includes(o.id)&&integer(o.loaded,0,weaponSpecification(o)?.capacity??0)&&integer(o.ammo,0,10)&&integer(o.hp,1,100)),'La batalla guardada es inválida.');if(!sector(b.sector)&&b.sector!=='san_lorenzo')requireThat(b.exploration===true&&b.sector===s.location,'La visita guardada no corresponde a la celda actual.');if(b.origin!==undefined)requireThat(validWorldLocation(b.origin),'El origen del despliegue es inválido.');}

  for(const unit of [...(s.pendingBattle?.squad??[]),...(s.pendingBattle?.missionAllies??[]),...Object.values(s.missionAllies??{})])validateWeaponCarrier(unit);
  for(const unit of [...(s.pendingBattle?.enemies??[]),...(s.pendingBattle?.garrison??[])])validateForceWeapon(unit);
  migrateSquads(s);
  requireThat(Array.isArray(s.squads)&&s.squads.length>0&&s.squads.length<=8&&new Set(s.squads.map(q=>q.id)).size===s.squads.length&&s.squads.every(q=>object(q)&&typeof q.id==='string'&&/^squad-[1-9][0-9]*$/.test(q.id)&&typeof q.name==='string'&&q.name.length<=30&&validWorldLocation(q.location)&&validIds(q.members)&&q.members.length<=6&&q.members.every(id=>s.recruited.includes(id))),'Las escuadras guardadas son inválidas.');
  const assigned=s.squads.flatMap(q=>q.members);requireThat(new Set(assigned).size===assigned.length,'Un combatiente no puede pertenecer a dos escuadras.');const selected=s.squads.find(q=>q.id===s.activeSquadId);requireThat(selected&&selected.location===s.location&&JSON.stringify(selected.members)===JSON.stringify(s.squad),'La escuadra activa del archivo es inválida.');
  requireThat(object(s.sectorStates)&&Object.entries(s.sectorStates).every(([id,snapshot])=>(validWorldLocation(id)||id==='san_lorenzo')&&validateSectorSnapshot(expandCellScene(snapshot))&&(sector(id)||id==='san_lorenzo'||snapshot.sectorId===id&&snapshot.sourceMapId===id)),'Los sectores guardados son inválidos.');
  for(const [id,snapshot]of Object.entries(s.sectorStates))s.sectorStates[id]=compactCellScene(snapshot);
  requireThat(!s.pendingBattle||s.pendingBattle.syncedSeconds===undefined||(Number.isSafeInteger(s.pendingBattle.syncedSeconds)&&s.pendingBattle.syncedSeconds>=0),'El reloj del despliegue es inválido.');requireThat(Number.isInteger(s.secondOfHour??0)&&(s.secondOfHour??0)>=0&&(s.secondOfHour??0)<3600,'El reloj guardado es inválido.');requireThat(s.deferredRaids===undefined||(Array.isArray(s.deferredRaids)&&s.deferredRaids.length<=1000&&s.deferredRaids.every(r=>object(r)&&['north','coast','interior'].includes(r.theater)&&sector(r.target))),'Las incursiones pendientes son inválidas.');validatePolitics(s);requireThat(s.economyVersion===2&&Object.keys(s.resources).length===1,'La economía guardada es inválida.');if(migrateCampaignCivilians(s))synchronizeCampaignPresence(s);validateCampaignCivilians(s);validateCampaignPresence(s);s.lastError=null;return s;
}
