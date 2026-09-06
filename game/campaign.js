import {MISSION_SCENES,YATASTO_NPCS,missionStatus,talkMission,sanLorenzoAlly,validateMissions} from './missions.js';
export {MISSION_SCENES,missionStatus} from './missions.js';
import {MATERIAL_STOCK,materialYield,productionHours,migrateMaterials} from './industry.js';
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
import {initialHorseState,migrateHorseState,applyHorseAction,mountForOperative} from './horses.js';
import {returnAmmunition} from './ammunition.js';
import {ENCOUNTERS,encounterForOperative,encountersFor,encounterRequirements} from './encounters.js';
export {ENCOUNTERS,encountersFor} from './encounters.js';
import {migrateSquads,activeSquad,operativeLocation,synchronizeSquad,validateSectorSnapshot,validatePersonalInventory} from './squads.js';
export {activeSquad,operativeLocation} from './squads.js';
import {isImportedEquipment,deliverEquipmentShipments,validEquipmentShipments,EQUIPMENT_CATALOG,refillCost,firearmRepairCost,deployedArtillery} from './equipment.js';
export {EQUIPMENT_CATALOG,armoryInventory,refillCost,firearmRepairCost} from './equipment.js';
import {planTransfer,convoyStatus} from './logistics.js';
export {TRANSPORT_OPTIONS,transferOptions,inventoryAt,cargoWeight} from './logistics.js';
import {ROYALIST_COMMANDS,NORTHERN_AXIS,coastalRevenue,royalistIntel,mentorDispatch,oppositionFor} from './narrative.js';
export {ROYALIST_COMMANDS,royalistIntel,mentorDispatch} from './narrative.js';
import {rosterFor as baseRosterFor,CIVIC_RECRUITS,civicStatus as baseCivicStatus,createOfficerRecord} from './recruitment.js';
export {CIVIC_RECRUITS} from './recruitment.js';
export function civicStatus(s,id,local=false){const op=CIVIC_RECRUITS.find(o=>o.id===Number(id));return {available:Boolean(op&&!s.recruited.includes(Number(id))&&s.operativeState[Number(id)]?.alive),reason:op?'Disponible por contrato en el escritorio.':'No existe ese voluntario.'};}
import {OPERATIVES, WEAPONS, CAMPAIGN_SECTORS, FACTIONS, PHASES, RECIPES, RESOURCE_NAMES} from './data.js';
export {OPERATIVES, WEAPONS, CAMPAIGN_SECTORS, FACTIONS, PHASES, RECIPES, RESOURCE_NAMES};
export function rosterFor(s){return baseRosterFor(s).map(o=>{const record=s.operativeState?.[o.id]??{};return {...o,...(s.loadouts?.[o.id]??{}),...Object.fromEntries(TRAINABLE_SKILLS.map(skill=>[skill,Math.min(100,(o[skill]??0)+(record.trainedStats?.[skill]??0))])),strength:Math.max(o.strength,Math.min(100,record.strength??o.strength))};});}
function returnTraining(s,id,report){validateTraining(report);for(const field of ['trainedStats','skillPractice'])if(report[field]!==undefined)s.operativeState[id][field]=clone(report[field]);}
function returnMount(s,id,report){if(!report.mount)return;const horse=s.horseState?.horses.find(h=>h.id===report.mount.id&&h.assignedTo===id&&!h.returned);requireThat(horse,'La montura no pertenece al combatiente.');for(const field of ['stamina','condition']){requireThat(Number.isFinite(report.mount[field])&&report.mount[field]>=0&&report.mount[field]<=100,'El estado de la montura es inválido.');horse[field]=report.mount[field];}}
function removeFromService(s,id){
  const location=operativeLocation(s,id);s.operativeState[id].location=location;s.recruited=s.recruited.filter(x=>x!==id);s.squad=s.squad.filter(x=>x!==id);for(const squad of s.squads)squad.members=squad.members.filter(x=>x!==id);
  for(const horse of s.horseState.horses)if(horse.assignedTo===id)horse.assignedTo=null;
  for(const course of s.militiaTraining.filter(t=>t.trainerId===id)){if(course.rank>0&&s.sectors[course.sector].owner==='patriot')s.sectors[course.sector].militia[course.rank-1]+=course.count;}s.militiaTraining=s.militiaTraining.filter(t=>t.trainerId!==id);delete s.contracts[id];
}
function signContract(s,op,term){
  const quote=contractQuote(s,op,term??'day');requireThat(quote.available,quote.reason);pay(s,{treasury:quote.price});s.contracts[op.id]={kind:quote.permanent?'patriot':'paid',term:term??'day',started:s.hour,expiresAt:quote.expiresAt,paid:quote.price};
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
  return {equipmentShipments:[],missions:{},sceneStates:{},missionAllies:{},garrisons:{},nextMilitiaId:20000,quests:{},cityLoyaltyEvents:[],contracts:{},militiaTraining:[],horseState:initialHorseState(),version:1,seed:seed>>>0,hour:0,phase:0,location:'retiro',activeSquadId:'squad-1',squads:[{id:'squad-1',name:'Primera escuadra',members:[],location:'retiro'}],sectorStates:{},resources:{...MATERIAL_STOCK,treasury:3200,horses:35,powder:100,copper:35,textiles:240,infantry:0,muskets:90,sabres:25,cartridges:300,uniforms:0,cannons:0,ponchos:6},reputation:{directory:35,gauchos:0,pardos:10,foreign:20,indigenous:0,royalists:-100},sectors:Object.fromEntries(CAMPAIGN_SECTORS.map(x=>[x.id,{owner:['buenos_aires','retiro','ensenada'].includes(x.id)?'patriot':'royalist',loyalty:['buenos_aires','retiro','ensenada'].includes(x.id)?65:25,militia:[0,0,0],damageUntil:0,fort:0}])),artillerySelection:[],armory:{},loadouts:{},lastConversation:null,conversations:{},officer:null,recruited:[],squad:[],operativeState:Object.fromEntries([...OPERATIVES,...CIVIC_RECRUITS].map(o=>[o.id,{hp:o.maxHp,fatigue:0,alive:true,xp:0,priming:50,flints:4,rations:2,torches:2,condition:100}])),flags:{academy:false,sanLorenzo:false,northPact:false,partisanSupply:false,foundry:false,parliament:false,emancipation:false,commission:false,mentoring:false},production:[],shipments:[],depots:{},convoys:[],routes:{posta:false,flotilla:false,carts:false,mules:false},blockade:false,pendingBattle:null,completed:false,defeated:false,log:[{hour:0,text:'Buenos Aires, 1812. El Cabildo encomienda la formación de los Granaderos. Prepará tu hoja de servicio y reuní a los primeros voluntarios.'}],lastError:null};
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
  if(s.phase===3&&s.flags.foundry&&s.flags.parliament&&s.resources.infantry>=3000&&s.resources.cannons>=3&&['mendoza','uspallata','los_patos'].every(id=>s.sectors[id].owner==='patriot'&&s.sectors[id].fort>=1)){
    s.phase=4;note(s,'El Plumerillo alcanza plena capacidad. Tres mil infantes, artillería y pasos seguros: San Martín puede incorporarse al ejército.');
  }
  if(!s.completed&&s.phase===4&&s.recruited.includes(57)&&Object.values(s.sectors).every(x=>x.owner==='patriot')&&!s.blockade&&!s.pendingBattle){s.completed=true;note(s,'¡Campaña concluida! Las provincias están libres y el Ejército de los Andes queda preparado para la liberación continental.');for(const op of rosterFor(s).filter(o=>s.recruited.includes(o.id)&&s.operativeState[o.id]?.alive)){const line=speechFor(op,'ending');if(line)note(s,`${op.name}: «${line}»`);}}
  if(s.sectors.buenos_aires.owner!=='patriot'){s.defeated=true;note(s,'La capital ha caído. El ejército debe reorganizarse desde una nueva campaña.');}
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
  else {if(theater==='interior'){const lost=Math.min(20,s.resources.powder);s.resources.powder-=lost;const silver=Math.min(150,s.resources.treasury);s.resources.treasury-=silver;note(s,`Las partidas saquean ${silver} pesos y ${lost} cargas de pólvora. La pérdida de Córdoba interrumpe el Camino Real y los convoyes de Cuyo.`);}region.owner='royalist';region.militia=[0,0,0];if(s.garrisons)delete s.garrisons[target.id];note(s,`Los realistas recuperan ${target.name} y cortan las rutas de abastecimiento.`);}
}
function deployed(s,id){return s.pendingBattle?.squad?.some(u=>Number(u.id)===Number(id));}
function releaseDeferred(s){if(s.pendingBattle)return;if(s.horseState.horses.some(h=>h.hired&&!h.returned&&h.hireUntil<=s.hour))s.horseState=applyHorseAction(s.horseState,{type:'advance',hour:s.hour});for(const id of [...s.recruited])if(s.contracts?.[id]?.departurePending){removeFromService(s,id);note(s,'Un voluntario cumple su contrato y deja el destacamento.');}const raids=s.deferredRaids??[];s.deferredRaids=[];for(const r of raids)raid(s,r.theater,r.target);}
function tick(s,hours){
  requireThat(Number.isInteger(hours)&&hours>=1&&hours<=240,'El avance debe ser de 1 a 240 horas.');
  for(let i=0;i<hours;i++){
    s.hour++;for(const id of [...s.recruited]){const contract=s.contracts?.[id];if(contract?.expiresAt!==null&&contract?.expiresAt!==undefined&&contract.expiresAt<=s.hour){if(deployed(s,id)){contract.departurePending=true;continue;}const name=rosterFor(s).find(o=>o.id===id)?.name??'Un combatiente';removeFromService(s,id);note(s,`${name} concluye su contrato y deja el destacamento. Su hoja de servicio queda disponible.`);}}const heldHorses=s.horseState.horses.filter(h=>deployed(s,h.assignedTo));s.horseState=applyHorseAction(s.horseState,{type:'advance',hour:s.hour});for(const h of heldHorses){const index=s.horseState.horses.findIndex(v=>v.id===h.id);s.horseState.horses[index]={...s.horseState.horses[index],stamina:h.stamina,condition:Math.min(h.condition,s.horseState.horses[index].condition),assignedTo:h.assignedTo,returned:Boolean(h.returned)};}
    for(const course of [...(s.militiaTraining??[])]){
      if(s.sectors[course.sector].owner!=='patriot'){s.militiaTraining=s.militiaTraining.filter(t=>t!==course);note(s,'La ocupación enemiga dispersa un curso de milicias.');continue;}
      if(!s.operativeState[course.trainerId]?.alive||operativeLocation(s,course.trainerId)!==course.sector||!isSupplied(s,course.sector)||!militiaEligibility(s,course.sector).eligible)continue;
      course.remaining--;if(course.remaining<=0){s.sectors[course.sector].militia[course.rank]+=course.count;s.militiaTraining=s.militiaTraining.filter(t=>t!==course);note(s,`Tres milicianos completan su instrucción en ${sector(course.sector).name}.`);}
    }
    for(const convoy of [...(s.convoys??[])])if(convoyStatus(s,convoy).ready){
      const inventory=convoy.destination==='reserve'?s.resources:(s.depots[convoy.destination]??={});
      for(const [key,value] of Object.entries(convoy.goods))inventory[key]=(inventory[key]??0)+value;
      s.convoys.splice(s.convoys.indexOf(convoy),1);note(s,`El convoy entrega sus pertrechos en ${convoy.destination==='reserve'?'la reserva de Buenos Aires':sector(convoy.destination).name}.`);
    }
    deliverEquipmentShipments(s);
    for(const task of [...s.production])if(task.due<=s.hour&&s.sectors[task.sector].owner==='patriot'&&isSupplied(s,task.sector)){add(s,task.yield);s.production.splice(s.production.indexOf(task),1);note(s,`La maestranza completó: ${task.name}.`);}
    for(const shipment of [...s.shipments])if(shipment.due<=s.hour&&!s.blockade&&s.sectors.ensenada.owner==='patriot'){add(s,shipment.goods);s.shipments.splice(s.shipments.indexOf(shipment),1);note(s,'Arribó un cargamento de contrabando a Ensenada.');}
    if(s.hour%24===0){
      dailyPolitics(s);
      let income=0;
      for(const def of CAMPAIGN_SECTORS){const region=s.sectors[def.id];if(region.owner==='patriot'){income+=Math.floor(def.income*(region.damageUntil>s.hour?0.25:1)*(def.theater==='coast'&&s.blockade?0.25:1)*(isSupplied(s,def.id)?1:0.5));if(isSupplied(s,def.id))region.loyalty=Math.min(100,region.loyalty+1);}}
      add(s,{treasury:income,textiles:s.sectors.cordoba.owner==='patriot'?50:20,copper:1,horses:2,...materialYield(s,isSupplied)});
      for(const id of s.recruited){const op=s.operativeState[id];if(op.alive&&!deployed(s,id)&&isSupplied(s,operativeLocation(s,id))){op.hp=Math.min(rosterFor(s).find(o=>o.id===id).maxHp,op.hp+5);op.fatigue=Math.max(0,op.fatigue-10);}}
      note(s,`Las estancias y aduanas aportaron ${income} pesos a la tesorería.`);
    }
    if(s.hour%720===0){const payroll=s.recruited.filter(id=>s.contracts?.[id]?.kind==='legacy').reduce((sum,id)=>sum+rosterFor(s).find(o=>o.id===id).monthlyPay,0);if(payroll>0){if(s.resources.treasury>=payroll){s.resources.treasury-=payroll;standing(s,'foreign',5);note(s,`Se abonaron ${payroll} pesos en estipendios mensuales.`);}else{standing(s,'foreign',-20);standing(s,'directory',-10);note(s,'La tesorería no pudo abonar los sueldos. Los voluntarios reclaman el pago.');}}}
    if(!s.completed&&s.hour%120===0)raid(s,'north');
    if(!s.completed&&s.hour%168===0&&coastalRevenue(s)>=500)raid(s,'coast');
    if(!s.completed&&s.hour%144===0)raid(s,'interior');
    progress(s);if(s.defeated)break;
  }
}
function travelPath(s,from,to){
  const queue=[[from]],seen=new Set([from]);while(queue.length){const path=queue.shift(),last=path.at(-1);if(last===to)return path;for(const id of sector(last).neighbors)if(!seen.has(id)&&s.sectors[id].owner==='patriot'){seen.add(id);queue.push([...path,id]);}}return null;
}
export function dispatchCampaign(previous,action){
  const s=migrateSquads(clone(previous));s.horseState??={...initialHorseState(),hour:s.hour};s.lastError=null;s.militiaTraining??=[];s.missions??={};s.sceneStates??={};s.missionAllies??={};s.quests??={};migrateContracts(s);
  try{
    requireThat(action&&typeof action.type==='string','La orden no es válida.');
    requireThat(!s.defeated,'La campaña ha terminado. Inicia otra campaña para continuar.');
    requireThat(!s.completed||['syncTacticalTime','wait','horseAction','travel','visitSector','leaveSector','talkNPC','createSquad','selectSquad','squad','equip','resupply','repairWeapon','purchaseEquipment','supplyTransfer','transport','militia','cancelMilitia','renewContract','dismiss'].includes(action.type),'La campaña está ganada. Puedes recorrer las provincias y atender a tus escuadras y estancias.');
    requireThat(!s.pendingBattle||['battleResult','leaveSector','talkNPC','finishMission','syncTacticalTime'].includes(action.type),'Hay una batalla pendiente. Resuélvela antes de dar nuevas órdenes.');
    if(['travel','attack','visitSector'].includes(action.type))requireThat(!s.squad.some(id=>militiaAssignment(s,id)),'Un instructor de la escuadra está asignado a las milicias. Cancelá su curso o dejalo en una escuadra de guarnición.');
    switch(action.type){
      case 'syncTacticalTime':{requireThat(s.pendingBattle&&s.pendingBattle.id===action.battleId,'El reloj no corresponde al despliegue.');const elapsed=action.elapsedSeconds,previous=s.pendingBattle.syncedSeconds??0;requireThat(Number.isSafeInteger(elapsed)&&elapsed>=previous&&elapsed-previous<=864000,'El tiempo táctico es inválido.');const seconds=(s.secondOfHour??0)+elapsed-previous;const hours=Math.floor(seconds/3600);s.secondOfHour=seconds%3600;if(hours)tick(s,hours);s.pendingBattle.syncedSeconds=elapsed;break;}
      case 'wait':tick(s,action.hours??24);break;
      case 'academy':requireThat(!s.flags.academy,'La academia ya está organizada.');pay(s,{treasury:300,horses:20,muskets:40,textiles:60});s.flags.academy=true;note(s,'Se funda la academia de Granaderos en Retiro.');break;
      case 'horseAction':{
        const order=action.order;requireThat(order&&['acquire','hire','feed','assign','unassign','breed'].includes(order.type),'La orden de caballada es inválida.');
        requireThat(s.sectors[s.location]?.owner==='patriot','La caballada requiere una localidad segura.');
        if(order.name!==undefined)requireThat(typeof order.name==='string'&&order.name.trim().length>0&&order.name.length<=30&&!/[<>]/.test(order.name),'El nombre de la montura es inválido.');
        if(order.horseId)requireThat(s.horseState?.horses.some(h=>h.id===order.horseId&&h.location===s.location),'La montura está en otra localidad.');
        if(order.type==='assign')requireThat(s.recruited.includes(order.operativeId)&&s.operativeState[order.operativeId].alive&&operativeLocation(s,order.operativeId)===s.location,'El jinete debe estar presente en la localidad.');
        const horses=applyHorseAction(s.horseState,{...order,location:s.location,funds:s.resources.treasury});requireThat(!horses.lastError,horses.lastError);pay(s,{treasury:horses.cost??0});s.horseState=horses;note(s,horses.log[0]??'La orden de caballada quedó cumplida.');break;
      }
      case 'purchaseEquipment':{
        const item=EQUIPMENT_CATALOG.find(o=>String(o.item)===String(action.item)),quantity=action.quantity??1;
        requireThat(item&&Number.isInteger(quantity)&&quantity>0&&quantity<=100,'El pedido de armamento es inválido.');
        requireThat(s.sectors.retiro.owner==='patriot'&&isSupplied(s,'retiro'),'La sala de armas de Retiro está incomunicada.');
        if(isImportedEquipment(item)){requireThat(s.sectors.ensenada.owner==='patriot'&&s.reputation.foreign>=0,'El pedido requiere Ensenada libre y comerciantes dispuestos a negociar.');s.equipmentShipments??=[];requireThat(s.equipmentShipments.length<1000,'Hay demasiados pedidos pendientes.');pay(s,{treasury:tradeQuote(s,item.price)*quantity});const delay=72+Math.floor(random(s)*49);s.equipmentShipments.push({item:item.item,quantity,due:s.hour+delay});note(s,`Pedido de ${quantity} × ${item.name}: arribo en ${delay} horas, sujeto al bloqueo.`);break;}
        pay(s,{treasury:item.price*quantity});s.armory??={};s.armory[item.item]=(s.armory[item.item]??0)+quantity;
        if(item.category==='artillery')s.resources.cannons+=quantity;note(s,`La sala de armas entrega ${quantity} × ${item.name}.`);break;
      }
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
        requireThat(Number.isInteger(itemId)&&itemId>=1800&&itemId<=1813&&(slot!=='blade'||itemId>=1809),'Esta arma no corresponde a ese espacio.');
        requireThat(op[slot]!==itemId,'El combatiente ya lleva esa arma.');requireThat((s.armory?.[itemId]??0)>0,'No quedan unidades de esa arma en la armería.');
        s.armory[itemId]--;s.armory[op[slot]]=(s.armory[op[slot]]??0)+1;s.loadouts??={};s.loadouts[id]={...(s.loadouts[id]??{}),[slot]:itemId};note(s,`${op.name} recibe ${WEAPONS[itemId].name}.`);break;
      }
      case 'resupply':case 'repairWeapon':{
        const id=Number(action.operativeId),op=rosterFor(s).find(o=>o.id===id),record=s.operativeState[id];requireThat(op&&s.recruited.includes(id)&&record.alive,'El combatiente no está disponible.');
        requireThat(['retiro','cordoba','mendoza'].includes(s.location)&&s.sectors[s.location].owner==='patriot'&&isSupplied(s,s.location),'Debes llegar a una maestranza abastecida.');
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
        requireThat(s.pendingBattle,'Primero entrá al sector.');const snapshot=validateSectorSnapshot(action.sectorState),npc=(s.pendingBattle.sceneId==='yatasto'?YATASTO_NPCS:ENCOUNTERS).find(n=>n.id===action.npcId&&n.sector===s.pendingBattle.sector),id=Number(action.unitId),actor=rosterFor(s).find(o=>o.id===id),unit=snapshot.units.find(u=>u.side==='player'&&Number(u.id)===id),local=snapshot.npcs?.find(n=>n.id===action.npcId);
        requireThat(npc&&actor&&unit&&local&&s.squad.includes(id)&&unit.hp>0,'El interlocutor no está disponible en este sector.');requireThat(snapshot.mode==='exploration'||snapshot.status==='victory'||snapshot.sectorCleared,'Terminá el combate antes de conversar.');requireThat(Number.isInteger(local.x)&&Number.isInteger(local.y)&&Math.abs(unit.x-local.x)+Math.abs(unit.y-local.y)<=1,'Acercá al combatiente al interlocutor para hablar.');
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
          const gate=npc.operativeId>=100?civicStatus(s,npc.operativeId,true):recruitmentStatus(s,npc.operativeId,true);requireThat(gate.available,gate.reason);const op=rosterFor(s).find(o=>o.id===npc.operativeId);signContract(s,op,action.term);s.recruited.push(op.id);s.operativeState[op.id].location=s.location;if(s.squad.length<6){s.squad.push(op.id);s.pendingBattle.squad.push({...clone(op),...clone(s.operativeState[op.id]),loaded:0,ammo:0});}text=`Acepto servir junto a ustedes. ${op.name} se incorpora a la fuerza patriota.`;outcome='recruited';note(s,text);
        }
        s.conversations??={};s.conversations[npc.id]={met:true,lastApproach:action.approach,hour:s.hour};s.lastConversation={npcId:npc.id,speaker:npc.name,text,outcome,operativeId:npc.operativeId??null,options:[...(npc.operativeId!==undefined&&!s.recruited.includes(npc.operativeId)?['friendly','direct','recruit']:['friendly','direct']),...(s.pendingBattle.sceneId==='yatasto'?['mission']:[]),...(questForNPC(s,npc.id)&&questForNPC(s,npc.id).status!=='completed'?['quest']:[])]};break;
      }
      case 'visitMission':{
        requireThat(action.mission==='yatasto','La escena solicitada no existe.');requireThat(s.location==='tucuman'&&s.phase>=2,'Viajá a Tucumán después de San Lorenzo para acudir a Yatasto.');requireThat(!s.missions.yatasto?.completed,'La conferencia de Yatasto ya concluyó.');
        const entered=dispatchCampaign(s,{type:'visitSector'});requireThat(!entered.lastError,entered.lastError);Object.assign(s,entered);Object.assign(s.pendingBattle,{sceneId:'yatasto',missionId:'yatasto',name:MISSION_SCENES.yatasto.name,npcs:clone(YATASTO_NPCS),garrison:[],artillery:[]});break;
      }
      case 'finishMission':{
        requireThat(s.pendingBattle?.sceneId==='yatasto'&&s.pendingBattle.id===action.battleId,'No hay una conferencia de Yatasto abierta.');requireThat(s.missions.yatasto?.frontier,'Completá los partes, el análisis y el acuerdo de frontera antes de cerrar la conferencia.');
        const result=dispatchCampaign(s,{...action,type:'leaveSector'});requireThat(!result.lastError,result.lastError);Object.assign(s,result);s.missions.yatasto.completed=true;s.missions.yatasto.stage='completed';note(s,'La conferencia de Yatasto concluye. Belgrano entrega el mando y la preparación continental se orienta hacia Cuyo.');break;
      }
      case 'visitSector':{
        const at=action.sector??s.location;requireThat(at===s.location,'La escuadra debe viajar al sector antes de entrar.');requireThat(s.sectors[at]?.owner==='patriot','El sector está ocupado; prepará un ataque.');requireThat(s.squad.length>0,'La escuadra no tiene combatientes.');const def=sector(at),allocated={},localAmmo=s.depots?.[at]?.cartridges??0;let stock=s.resources.cartridges+localAmmo;for(const id of s.squad){const capacity=WEAPONS[rosterFor(s).find(o=>o.id===id).weapon]?.capacity??0,rounds=capacity?Math.min(10,stock):0;allocated[id]={loaded:Math.min(capacity,rounds),ammo:Math.max(0,rounds-capacity)};stock-=rounds;}const issued=s.resources.cartridges+localAmmo-stock,fromDepot=Math.min(localAmmo,issued);s.resources.cartridges-=issued-fromDepot;if(fromDepot)s.depots[at].cartridges-=fromDepot;
        s.pendingBattle={id:`visit-${at}-${s.hour}-${s.seed}`,sector:at,name:def.name,biome:def.biome,theater:def.theater,seed:s.seed,exploration:true,night:s.hour%24<6||s.hour%24>=20,issuedCartridges:issued,ammunitionSources:(s.sectorStates[at]?.units??[]).filter(u=>u.side==='enemy').map(u=>({id:u.id,ammo:u.ammo??0})),wasRoyalist:false,npcs:encountersFor(s,at),squad:s.squad.map(id=>({...clone(rosterFor(s).find(o=>o.id===id)),...clone(s.operativeState[id]),...allocated[id],...(mountForOperative(s.horseState,id)??{horse:false,canMount:false})})),enemies:[],artillery:[],weather:{rain:false,humidity:def.theater==='coast'?.8:.3}};s.pendingBattle.garrison=prepareGarrison(s,at);s.pendingBattle.garrisonLootSources=(s.sectorStates[at]?.units??[]).filter(u=>u.militia&&u.hp<=0).map(u=>({id:u.id,ammo:u.ammo??0,loaded:u.loaded??0}));note(s,`La escuadra entra en ${def.name} para reconocer el lugar y hablar con sus habitantes.`);break;
      }
      case 'leaveSector':{
        requireThat(s.pendingBattle?.exploration&&action.battleId===s.pendingBattle.id,'La visita no corresponde al sector abierto.');const snapshot=validateSectorSnapshot(action.sectorState);const visit=s.pendingBattle;
        const reports=(action.survivors??[]).filter(r=>!snapshot.units.some(u=>u.militia&&Number(u.id)===Number(r.id)));returnGarrison(s,visit,snapshot);requireThat(Array.isArray(reports)&&new Set(reports.map(r=>Number(r.id))).size===reports.length,'El parte de la escuadra es inválido.');s.resources.cartridges+=returnAmmunition(visit,reports,snapshot);if(visit.sceneId)s.sceneStates[visit.sceneId]=clone(snapshot);else s.sectorStates[visit.sector]=clone(snapshot);
        for(const report of reports){const id=Number(report.id);returnMount(s,id,report);returnTraining(s,id,report);requireThat(s.squad.includes(id),'El combatiente no pertenece a la visita.');for(const [field,max]of Object.entries({hp:rosterFor(s).find(o=>o.id===id).maxHp,energy:100,weight:1000,strength:100,strengthTraining:10000,priming:100000,flints:100000,rations:100000,torches:100000,condition:100,fatigue:100,boleadoras:100000})){if(report[field]!==undefined){requireThat(Number.isFinite(report[field])&&report[field]>=0&&report[field]<=max,'El estado del combatiente es inválido.');s.operativeState[id][field]=report[field];}}s.operativeState[id].alive=s.operativeState[id].hp>0;if(report.inventory!==undefined){validatePersonalInventory(report.inventory);s.operativeState[id].inventory=clone(report.inventory);}}
        s.squad=s.squad.filter(id=>s.operativeState[id].alive);if(!s.completed&&!s.recruited.some(id=>s.operativeState[id].alive))s.defeated=true;s.pendingBattle=null;note(s,'La escuadra vuelve a la carta de operaciones.');break;
      }
      case 'travel':{
        requireThat(s.squad.length>0,'No hay combatientes en esta escuadra.');
        requireThat(s.squad.length>0,'La escuadra no tiene combatientes para marchar.');
        requireThat(sector(action.sector),'El destino no existe.');requireThat(s.sectors[action.sector].owner==='patriot','Primero debes liberar el destino.');const path=travelPath(s,s.location,action.sector);requireThat(path,'Los realistas cortan la ruta de tránsito.');
        const mode=action.mode??'march';requireThat(['march','posta','flotilla','carts'].includes(mode),'Medio de transporte desconocido.');
        if(mode!=='march')requireThat(s.routes[mode],'Debes organizar ese transporte.');
        if(mode==='flotilla')requireThat(!s.blockade&&path.every(id=>sector(id).theater==='coast'),'La flotilla requiere una ruta costera sin bloqueo.');
        const mountain=path.some(id=>sector(id).biome==='mountain');requireThat(!(path.some(id=>['uspallata','los_patos'].includes(id))&&campaignDate(s).month>=6&&campaignDate(s).month<=8),'La nieve invernal ha cerrado los pasos.');
        if(mode==='posta')pay(s,{horses:Math.max(1,path.length-1)});
        const hours=Math.max(1,Math.ceil((path.length-1)*(mode==='posta'?4:mode==='flotilla'?5:mode==='carts'?18:12)*(mountain?1.5:1)));tick(s,hours);if(!s.squad.length){note(s,'La marcha se cancela al terminar el último contrato.');break;}const openPath=[];for(const id of path){if(s.sectors[id].owner!=='patriot')break;openPath.push(id);}s.location=openPath.at(-1)??s.location;moveMounts(s,s.location,hours);if(s.location!==action.sector)note(s,'El avance se detiene: una incursión cortó la ruta durante la marcha.');
        for(const id of s.squad)s.operativeState[id].fatigue=Math.min(90,s.operativeState[id].fatigue+(s.recruited.includes(57)?0:mountain?20:8));note(s,`El destacamento llega a ${sector(s.location).name}.`);break;
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
      case 'fortify':{const at=action.sector??s.location;requireThat(s.sectors[at]?.owner==='patriot','Solo puedes fortificar sectores propios.');requireThat(s.sectors[at].fort<3,'El sector ya tiene la máxima fortificación.');pay(s,{treasury:150,sabres:5});s.sectors[at].fort++;note(s,`Se refuerzan las defensas de ${sector(at).name}.`);break;}
      case 'attack':{
        const at=action.sector??'san_lorenzo',san=at==='san_lorenzo',def=san?{id:at,name:'Combate de San Lorenzo',biome:'river',theater:'coast'}:sector(at);
        requireThat(def,'No existe ese campo de batalla.');requireThat(san?s.location==='san_nicolas':(s.location===at||def.neighbors.includes(s.location)),'La escuadra debe marchar a un sector vecino antes de atacar.');requireThat(!(['uspallata','los_patos'].includes(at)&&campaignDate(s).month>=6&&campaignDate(s).month<=8),'La nieve invernal ha cerrado los pasos.');requireThat(s.squad.some(id=>s.operativeState[id].alive&&s.operativeState[id].hp>0),'No hay combatientes disponibles.');
        if(san)requireThat(s.phase>=1&&!s.flags.sanLorenzo&&s.sectors.san_nicolas.owner==='patriot','Organiza Retiro y libera San Nicolás antes de combatir en San Lorenzo.');
        else {requireThat(s.sectors[at].owner==='royalist'||(s.blockade&&def.theater==='coast'),'El sector ya está bajo control patriota.');requireThat(def.neighbors.some(id=>s.sectors[id].owner==='patriot'&&isSupplied(s,id)),'Debes abrir una ruta hasta el frente.');}
        const origin=s.location;if(!san&&s.location!==at){tick(s,12);if(!s.squad.length){note(s,'El despliegue se cancela: no quedan contratos vigentes en la escuadra.');break;}s.location=at;moveMounts(s,at,12);}
        const allocated={};const localAmmo=s.depots?.[origin]?.cartridges??0;let stock=s.resources.cartridges+localAmmo;
        for(const id of s.squad){const op=rosterFor(s).find(o=>o.id===id),capacity=WEAPONS[op.weapon]?.capacity??0;const rounds=capacity?Math.min(10,stock):0;allocated[id]={loaded:Math.min(capacity,rounds),ammo:Math.max(0,rounds-capacity)};stock-=rounds;}
        const issued=s.resources.cartridges+localAmmo-stock,fromDepot=Math.min(localAmmo,issued);pay(s,{cartridges:issued-fromDepot,powder:3});if(fromDepot)s.depots[origin].cartridges-=fromDepot;
        s.pendingBattle={id:`${at}-${s.hour}-${s.seed}`,origin,sector:at,name:def.name,biome:def.biome,theater:def.theater,seed:Math.floor(random(s)*4294967296),issuedCartridges:issued,wasRoyalist:!san&&s.sectors[at].owner==='royalist',squad:s.squad.map(id=>({...clone(rosterFor(s).find(o=>o.id===id)),...clone(s.operativeState[id]),...allocated[id],...(mountForOperative(s.horseState,id)??{horse:false,canMount:false}),poncho:s.resources.ponchos>=s.squad.length})),difficulty:san?2:Math.min(4,1+Math.floor(s.hour/240)+(def.theater==='north'?1:0)),weather:{rain:def.biome==='wetland'||random(s)<0.2,humidity:def.theater==='coast'?0.8:0.3},cannons:s.resources.cannons+(s.depots?.[s.location]?.cannons??0)};s.pendingBattle.artillery=deployedArtillery({...s,location:origin});Object.assign(s.pendingBattle,oppositionFor(s.pendingBattle));if(san){s.pendingBattle.missionId='san_lorenzo';s.pendingBattle.missionAllies=[sanLorenzoAlly(s)];}s.pendingBattle.garrison=prepareGarrison(s,at);s.pendingBattle.garrisonLootSources=(s.sectorStates[at]?.units??[]).filter(u=>u.militia&&u.hp<=0).map(u=>({id:u.id,ammo:u.ammo??0,loaded:u.loaded??0}));note(s,`El destacamento se despliega para ${def.name}. Mando enemigo: ${s.pendingBattle.enemyCommander}.`);break;
      }
      case 'battleResult':{
        requireThat(s.pendingBattle&&!s.pendingBattle.exploration,'No hay batalla de conquista pendiente.');requireThat(action.battleId===s.pendingBattle.id,'El resultado no corresponde a la batalla pendiente.');requireThat(['victory','defeat','retreat'].includes(action.outcome),'Resultado de batalla inválido.');const request=s.pendingBattle;
        const survivors=(action.survivors??[]).filter(r=>!request.garrison?.some(g=>g.id===Number(r.id))&&!request.missionAllies?.some(g=>g.id===Number(r.id))&&!action.sectorState?.units?.some(u=>u.militia&&Number(u.id)===Number(r.id)));requireThat(Array.isArray(survivors),'El parte de bajas es inválido.');
        requireThat(survivors.every(x=>x&&request.squad.some(o=>o.id===Number(x.id))&&Number.isFinite(x.hp)&&x.hp>=0)&&new Set(survivors.map(x=>Number(x.id))).size===survivors.length,'El parte de bajas contiene combatientes o heridas inválidos.');
        const battleSnapshot=action.sectorState?validateSectorSnapshot(action.sectorState):null;if(request.missionId==='san_lorenzo'){requireThat(battleSnapshot,'San Lorenzo necesita un parte táctico completo.');const commander=battleSnapshot.units.find(u=>Number(u.id)===57&&u.missionAlly);requireThat(commander,'Falta el comandante aliado en el parte.');s.missionAllies.san_lorenzo=clone(commander);if(action.outcome==='victory'&&commander.hp>0)requireThat(battleSnapshot.status==='victory','La victoria exige derrotar a los realistas y conservar con vida al comandante.');if(commander.hp<=0){action={...action,outcome:'defeat'};s.defeated=true;s.missions.san_lorenzo={stage:'failed',completed:false};note(s,'San Martín ha caído en San Lorenzo. La misión y la campaña concluyen con una derrota.');}else if(action.outcome==='victory')s.missions.san_lorenzo={stage:'completed',completed:true};}returnGarrison(s,request,battleSnapshot);s.resources.cartridges+=returnAmmunition(request,survivors,battleSnapshot);
        for(const id of s.squad){const report=survivors.find(x=>Number(x.id)===id);if(report){returnMount(s,id,report);returnTraining(s,id,report);const max=rosterFor(s).find(o=>o.id===id).maxHp;s.operativeState[id].hp=Math.max(0,Math.min(max,Number(report.hp)||0));s.operativeState[id].alive=s.operativeState[id].hp>0;for(const [field,limit] of Object.entries({priming:100000,flints:100000,rations:100000,torches:100000,condition:100,fatigue:100,energy:100,weight:1000,strength:100,strengthTraining:10000,boleadoras:100000}))if(report[field]!==undefined){requireThat(Number.isFinite(report[field])&&report[field]>=0&&report[field]<=limit,'El parte de suministros es inválido.');s.operativeState[id][field]=report[field];}if(report.inventory!==undefined)s.operativeState[id].inventory=clone(validatePersonalInventory(report.inventory));}else if(action.outcome!=='retreat'){s.operativeState[id].hp=0;s.operativeState[id].alive=false;}}
        for(const id of s.squad)if((id===1000||CIVIC_RECRUITS.some(o=>o.id===id))&&s.operativeState[id].alive){
          const before=rosterFor(s).find(o=>o.id===id),xp=action.outcome==='victory'?60:action.outcome==='defeat'?20:10;
          s.operativeState[id].xp=(s.operativeState[id].xp??0)+xp;const after=rosterFor(s).find(o=>o.id===id);
          if(after.level>before.level){s.operativeState[id].hp+=after.maxHp-before.maxHp;note(s,`${after.name} mejora su instrucción tras el combate: grado${after.level}.`);}
        }
        if(action.outcome==='victory'){
          recordCityLoyalty(s,{sectorId:request.sector==='san_lorenzo'?'san_nicolas':request.sector,kind:'victory',eventId:request.id});if(request.sector==='san_lorenzo')s.flags.sanLorenzo=true;
          else {const region=s.sectors[request.sector];region.owner='patriot';region.loyalty=Math.max(50,region.loyalty);region.damageUntil=0;}
          if(request.theater==='coast')s.blockade=false;if(request.wasRoyalist||request.sector==='san_lorenzo')add(s,{treasury:250,muskets:15,cartridges:80});standing(s,'directory',5);standing(s,'gauchos',request.theater==='north'?10:2);note(s,`Victoria en ${request.name}. Se recuperan armas y fondos realistas.`);
        }else{s.location=request.origin??s.location;moveMounts(s,s.location,0);standing(s,'directory',-5);note(s,`El destacamento se retira de ${request.name}.`);}
        if(action.sectorState)s.sectorStates[request.sector]=clone(validateSectorSnapshot(action.sectorState));
        s.pendingBattle=null;s.squad=s.squad.filter(id=>s.operativeState[id].alive);if(!s.squad.length){const reserve=s.recruited.filter(id=>s.operativeState[id].alive&&operativeLocation(s,id)===s.location);s.squad=reserve.slice(0,6);if(!s.recruited.some(id=>s.operativeState[id].alive)){s.defeated=true;note(s,'No quedan combatientes. La campaña ha terminado.');}}break;
      }
      default:throw Error('Orden desconocida.');
    }
    for(const [flag,at] of Object.entries({academy:'retiro',foundry:'mendoza',northPact:'salta',partisanSupply:'tucuman',parliament:'mendoza',emancipation:'buenos_aires',commission:'buenos_aires'}))if(s.flags[flag]&&!previous.flags[flag])recordCityLoyalty(s,{sectorId:at,kind:'quest',eventId:`quest-${flag}`});
    releaseDeferred(s);synchronizeSquad(s);progress(s);return s;
  }catch(error){const rejected=clone(previous);rejected.lastError=error.message;return rejected;}
}
export function serializeCampaign(s){return JSON.stringify(s);}
export function restoreCampaign(text){
  requireThat(typeof text==='string'&&text.length<=2_000_000,'El archivo de campaña no es compatible.');
  const s=JSON.parse(text),base=initialCampaign();
  const integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
  const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  requireThat(object(s)&&s.version===1&&integer(s.hour,0,24*365*100)&&integer(s.phase,0,4)&&integer(s.seed,0,4294967295)&&sector(s.location),'El archivo de campaña no es compatible.');
  s.equipmentShipments??=[];requireThat(validEquipmentShipments(s),'Los pedidos de armas guardados son inválidos.');
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
  for(const op of CIVIC_RECRUITS)s.operativeState[op.id]??={hp:op.maxHp,fatigue:0,alive:true,xp:0,priming:50,flints:4,rations:2,torches:2,condition:100};
  for(const op of Object.values(s.operativeState)){requireThat(object(op),'Las hojas de servicio son inválidas.');validateTraining(op);op.xp??=0;if(op.inventory!==undefined)validatePersonalInventory(op.inventory);for(const [field,limit]of Object.entries({energy:100,weight:1000,strength:100,strengthTraining:10000,boleadoras:100000})){if(op[field]!==undefined)requireThat(Number.isFinite(op[field])&&op[field]>=0&&op[field]<=limit,'El estado físico guardado es inválido.');}for(const [field,baseline] of Object.entries({priming:50,flints:4,rations:2,torches:2,condition:100})){op[field]??=baseline;requireThat(integer(op[field],0,field==='condition'?100:100000),'Los suministros guardados son inválidos.');}requireThat(integer(op.xp,0,1e7),'La experiencia guardada es inválida.');}
  s.depots??={};s.convoys??=[];requireThat(object(s.routes),'Las rutas guardadas son inválidas.');s.routes.mules??=false;
  requireThat(object(s.depots)&&Object.entries(s.depots).every(([id,goods])=>sector(id)&&object(goods)&&Object.entries(goods).every(([key,v])=>key in base.resources&&integer(v,0,1e9))),'Los depósitos guardados son inválidos.');
  requireThat(Array.isArray(s.convoys)&&s.convoys.length<=1000&&s.convoys.every(c=>object(c)&&typeof c.id==='string'&&(c.source==='reserve'||sector(c.source))&&(c.destination==='reserve'||sector(c.destination))&&['posta','carts','flotilla','mules'].includes(c.mode)&&integer(c.due,0,1e9)&&object(c.goods)&&Object.entries(c.goods).every(([key,v])=>key in base.resources&&integer(v,1,1e9))),'Los convoyes guardados son inválidos.');
  s.missions??={};s.sceneStates??={};s.missionAllies??={};requireThat(validateMissions(s)&&object(s.sceneStates)&&Object.entries(s.sceneStates).every(([id,b])=>id==='yatasto'&&b.sceneId===id&&validateSectorSnapshot(b))&&object(s.missionAllies)&&Object.entries(s.missionAllies).every(([id,u])=>id==='san_lorenzo'&&object(u)&&u.missionAlly===true&&Number(u.id)===57&&typeof u.name==='string'&&Number.isInteger(u.weapon)&&u.weapon>=1800&&u.weapon<=1813&&Number.isInteger(u.blade)&&u.blade>=1809&&u.blade<=1813&&Number.isInteger(u.ammo)&&u.ammo>=0&&u.ammo<=100000&&Number.isInteger(u.loaded)&&u.loaded>=0&&u.loaded<=2&&Number.isFinite(u.hp)&&u.hp>=0&&u.hp<=100),'Las escenas guardadas son inválidas.');
  s.garrisons??={};s.nextMilitiaId??=20000;requireThat(validGarrisons(s),'Las guarniciones guardadas son inválidas.');
  s.quests??={};requireThat(validateQuests(s.quests,s.hour),'Los encargos guardados son inválidos.');
  s.lastConversation??=null;s.conversations??={};
  requireThat(object(s.conversations)&&Object.entries(s.conversations).every(([id,c])=>[...ENCOUNTERS,...YATASTO_NPCS].some(n=>n.id===id)&&object(c)&&c.met===true&&['friendly','direct','recruit','quest','mission'].includes(c.lastApproach)&&integer(c.hour,0,1e9)),'Las conversaciones guardadas son inválidas.');
  requireThat(s.lastConversation===null||(object(s.lastConversation)&&[...ENCOUNTERS,...YATASTO_NPCS].some(n=>n.id===s.lastConversation.npcId)&&typeof s.lastConversation.text==='string'&&s.lastConversation.text.length<2000&&typeof s.lastConversation.speaker==='string'&&s.lastConversation.speaker.length<100&&Array.isArray(s.lastConversation.options)&&s.lastConversation.options.every(o=>['friendly','direct','recruit','quest','mission'].includes(o))),'El diálogo guardado es inválido.');
  s.armory??={};s.loadouts??={};s.artillerySelection??=[];requireThat(Array.isArray(s.artillerySelection)&&s.artillerySelection.length<=3&&s.artillerySelection.every(t=>['bronze4','field8','swivel'].includes(t)),'La batería guardada es inválida.');
  requireThat(object(s.armory)&&Object.entries(s.armory).every(([key,v])=>EQUIPMENT_CATALOG.some(o=>String(o.item)===key)&&integer(v,0,100000)),'La armería guardada es inválida.');
  requireThat(object(s.loadouts)&&Object.entries(s.loadouts).every(([id,slots])=>baseRosterFor(s).some(o=>o.id===Number(id))&&object(slots)&&Object.entries(slots).every(([slot,v])=>['weapon','blade'].includes(slot)&&integer(v,slot==='blade'?1809:1800,1813))),'Los equipos guardados son inválidos.');
  s.cityLoyaltyEvents??=[];requireThat(validCityLoyaltyEvents(s.cityLoyaltyEvents),'El registro de lealtad es inválido.');
  migrateContracts(s);requireThat(object(s.contracts)&&Object.entries(s.contracts).every(([id,c])=>s.recruited.includes(Number(id))&&object(c)&&(c.departurePending===undefined||typeof c.departurePending==='boolean')&&['paid','patriot','legacy'].includes(c.kind)&&['day','week','month'].includes(c.term)&&integer(c.started,0,s.hour)&&(c.expiresAt===null?c.kind!=='paid':integer(c.expiresAt,c.departurePending&&deployed(s,Number(id))?0:s.hour+1,1e9))&&integer(c.paid,0,1e9))&&s.recruited.every(id=>s.contracts[id]),'Los contratos guardados son inválidos.');
  const ids=rosterFor(s).map(o=>o.id),validIds=values=>Array.isArray(values)&&new Set(values).size===values.length&&values.every(id=>ids.includes(id));
  requireThat(validIds(s.recruited)&&validIds(s.squad)&&s.squad.length<=6&&s.squad.every(id=>s.recruited.includes(id)),'El destacamento del archivo es inválido.');
  requireThat(object(s.operativeState)&&rosterFor(s).every(o=>{const r=s.operativeState[o.id];return object(r)&&integer(r.hp,0,o.maxHp)&&integer(r.fatigue,0,100)&&typeof r.alive==='boolean'&&r.alive===(r.hp>0);}),'Las hojas de servicio son inválidas.');
  requireThat(object(s.flags)&&Object.keys(base.flags).every(k=>typeof s.flags[k]==='boolean')&&object(s.routes)&&Object.keys(base.routes).every(k=>typeof s.routes[k]==='boolean'),'Los acuerdos del archivo son inválidos.');
  const resources=values=>object(values)&&Object.entries(values).every(([k,v])=>k in base.resources&&integer(v,0,100000));
  requireThat(Array.isArray(s.production)&&s.production.length<=9&&s.production.every(p=>object(p)&&typeof p.name==='string'&&p.name.length<100&&sector(p.sector)&&integer(p.due,0,1e9)&&resources(p.yield)),'La producción del archivo es inválida.');
  requireThat(Array.isArray(s.shipments)&&s.shipments.length<=1000&&s.shipments.every(p=>object(p)&&integer(p.due,0,1e9)&&resources(p.goods)),'Los cargamentos del archivo son inválidos.');
  requireThat(['blockade','completed','defeated'].every(k=>typeof s[k]==='boolean')&&Array.isArray(s.log)&&s.log.length<=80&&s.log.every(p=>object(p)&&integer(p.hour,0,1e9)&&typeof p.text==='string'&&p.text.length<=1000),'El registro del archivo es inválido.');
  if(s.pendingBattle!==null){const b=s.pendingBattle;requireThat((!b.sceneId||(b.sceneId==='yatasto'&&b.sector==='tucuman'&&b.exploration===true))&&(!b.missionAllies||(b.sector==='san_lorenzo'&&Array.isArray(b.missionAllies)&&b.missionAllies.length===1&&Number(b.missionAllies[0].id)===57&&b.missionAllies[0].missionAlly===true)),'La escena pendiente es inválida.');requireThat(object(b)&&typeof b.id==='string'&&b.id.length<100&&(sector(b.sector)||b.sector==='san_lorenzo')&&integer(b.seed,0,4294967295)&&Array.isArray(b.squad)&&b.squad.length<=6&&b.squad.every(o=>object(o)&&s.squad.includes(o.id)&&integer(o.loaded,0,2)&&integer(o.ammo,0,10)&&integer(o.hp,1,100)),'La batalla guardada es inválida.');}
  s.horseState??={...initialHorseState(),hour:s.hour};
  requireThat(object(s.horseState)&&s.horseState.version===1&&integer(s.horseState.hour,0,s.hour)&&integer(s.horseState.nextId,1,100000)&&Array.isArray(s.horseState.horses)&&s.horseState.horses.length<=10000&&new Set(s.horseState.horses.map(h=>h?.id)).size===s.horseState.horses.length&&Array.isArray(s.horseState.log)&&s.horseState.log.length<=40&&s.horseState.log.every(t=>typeof t==='string'&&t.length<1000),'La caballada guardada es inválida.');
  requireThat(s.horseState.horses.every(h=>object(h)&&typeof h.id==='string'&&typeof h.name==='string'&&h.name.length<=60&&['mare','stallion'].includes(h.sex)&&sector(h.location)&&integer(h.bornAt,-1000000,s.hour)&&typeof h.hired==='boolean'&&(h.returned===undefined||typeof h.returned==='boolean')&&(h.pregnantUntil===null||integer(h.pregnantUntil,0,1e9))&&(h.hireUntil===null||integer(h.hireUntil,0,1e9))&&Number.isFinite(h.stamina)&&h.stamina>=0&&h.stamina<=100&&Number.isFinite(h.condition)&&h.condition>=0&&h.condition<=100&&integer(h.feed,0,100000)&&(h.assignedTo===null||s.recruited.includes(h.assignedTo))),'Los caballos guardados son inválidos.');
  const mounts=s.horseState.horses.filter(h=>!h.returned&&h.assignedTo!==null).map(h=>h.assignedTo);requireThat(new Set(mounts).size===mounts.length,'Un jinete no puede tener dos monturas asignadas.');
  migrateSquads(s);
  requireThat(Array.isArray(s.squads)&&s.squads.length>0&&s.squads.length<=8&&new Set(s.squads.map(q=>q.id)).size===s.squads.length&&s.squads.every(q=>object(q)&&typeof q.id==='string'&&/^squad-[1-9][0-9]*$/.test(q.id)&&typeof q.name==='string'&&q.name.length<=30&&sector(q.location)&&validIds(q.members)&&q.members.length<=6&&q.members.every(id=>s.recruited.includes(id))),'Las escuadras guardadas son inválidas.');
  const assigned=s.squads.flatMap(q=>q.members);requireThat(new Set(assigned).size===assigned.length,'Un combatiente no puede pertenecer a dos escuadras.');const selected=s.squads.find(q=>q.id===s.activeSquadId);requireThat(selected&&selected.location===s.location&&JSON.stringify(selected.members)===JSON.stringify(s.squad),'La escuadra activa del archivo es inválida.');
  requireThat(object(s.sectorStates)&&Object.entries(s.sectorStates).every(([id,snapshot])=>(sector(id)||id==='san_lorenzo')&&validateSectorSnapshot(snapshot)),'Los sectores guardados son inválidos.');
  requireThat(!s.pendingBattle||s.pendingBattle.syncedSeconds===undefined||(Number.isSafeInteger(s.pendingBattle.syncedSeconds)&&s.pendingBattle.syncedSeconds>=0),'El reloj del despliegue es inválido.');requireThat(Number.isInteger(s.secondOfHour??0)&&(s.secondOfHour??0)>=0&&(s.secondOfHour??0)<3600,'El reloj guardado es inválido.');requireThat(s.deferredRaids===undefined||(Array.isArray(s.deferredRaids)&&s.deferredRaids.length<=1000&&s.deferredRaids.every(r=>object(r)&&['north','coast','interior'].includes(r.theater)&&sector(r.target))),'Las incursiones pendientes son inválidas.');validatePolitics(s);s.lastError=null;return s;
}
