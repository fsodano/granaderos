// Trusted historical campaign rules. Reducer services are supplied by the engine.
import catalogue from './catalogue.json' with {type:'json'};
import world from './world.json' with {type:'json'};
const {operatives:OPERATIVES,civicRecruits:CIVIC_RECRUITS}=catalogue;
const CAMPAIGN_SECTORS=world.sectors;
import {enforceHistoricalLoss} from './historical-loss.js';
import {completedTacticalVictory} from '../../game/battle-outcome.js';
import {foundryFor,foundryLocationName} from '../../game/campaign-foundry.js';
import {headquartersFor,headquartersName} from '../../game/campaign-headquarters.js';
import {campaignSectors} from '../../game/campaign-definition.js';
import {coastalRevenue,NORTHERN_AXIS} from './narrative.js';
import {dailyPolitics,applyPolicy,policyStatus,validatePolitics} from './politics.js';
import {treasuryIncomeReason} from '../../game/treasury-rewards.js';
import * as missions from './missions.js';
import * as narrative from './narrative.js';
import * as assault from './mission-assault.js';
import * as losses from './historical-loss.js';
import * as politics from './politics.js';
import {weaponSpecification} from '../../game/weapon-definition.js';
import {WORKSHOP_SECTORS} from './equipment-supply.js';
import {entryFromSector} from '../../game/tactical-exits.js';
export {grenadeSupply,grenadeSupplyReason} from './equipment-supply.js';
const {MISSION_SCENES,YATASTO_NPCS,missionContacts,talkMission,sanLorenzoAlly,validateMissions}=missions;
const need=(ok,message)=>{if(!ok)throw Error(message);};
const copy=value=>structuredClone(value);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
export const id='granaderos-historical-v1';
export const maxPhase=4;
export function chapters(state){
 const foundry=foundryFor(state),customFoundry=state?.contentCampaign?.package.foundry!==undefined;
 return catalogue.phases.map((p,i)=>i===0&&headquartersFor(state)!=='retiro'?{...p,name:`I · Formación en ${headquartersName(state)}`,objective:`Creá tu granadero o recibí a tu primer contratado en ${headquartersName(state)}.`}:i===3&&customFoundry?{...p,name:`IV · Preparativos de ${foundry.name}`,objective:`Organizá ${foundry.name} en ${foundryLocationName(state)}, financiá el ejército con ${foundry.fundingCost} pesos, comprá tres cañones, controlá y fortificá Mendoza y los pasos de Cuyo, y acordá el paso con los pehuenches.`}:i===4&&customFoundry?{...p,name:`V · ${foundry.armyName}`}:p);
}

export {missions,narrative,assault,losses,politics};
export const enemyReserveLimits=Object.freeze({north:120,coast:80,interior:40});
export const enemyReserveError='Las reservas realistas guardadas son inválidas.';
export const enemyGroupLegHours=Object.freeze({north:12,coast:8,interior:6});
export const scenes=MISSION_SCENES;
export const sceneStateKey=id=>id==='yatasto'?'sceneStates':'sectorStates';
export const legacyCityReceipt=event=>event.sectorId==='ensenada'&&event.cityId==='buenos_aires';
export const recruitmentLocalityId=(state,id)=>id==='retiro'?'buenos_aires':id;
// Installed stock keeps the original pay records. A loose editor package or
// an authored monthly-pay change retains its existing calculated weekly pay.
export const weeklyPayFor=(state,operative,definition)=>state.contentCampaign?.package.campaignOrigin&&definition.monthlyPay===operative.monthlyPay&&Number.isFinite(operative.weeklyPay)?operative.weeklyPay:Math.ceil((definition.monthlyPay*7)/30);
export const retreatAxis=()=>NORTHERN_AXIS;
// The upper gorge opens west. Naval columns use the southern shore.
export function invaderEntry(request){
 if(request.enemyCommand==='north'){
  const index=NORTHERN_AXIS.indexOf(request.sector);
  if(index>0)return entryFromSector(NORTHERN_AXIS[index-1],request.sector,null,request);
  if(request.sector==='humahuaca')return {entryEdge:'W',entryAnchor:{x:0,y:8}};
  return {entryEdge:'N',entryAnchor:{x:10,y:0}};
 }
 return request.enemyCommand==='naval'?{entryEdge:'S',entryAnchor:{x:16,y:15}}:{entryEdge:'W',entryAnchor:{x:0,y:8}};
}
export const workshopSectors=()=>WORKSHOP_SECTORS;
export const missionNPCs=YATASTO_NPCS;
export const missionCivilianOperativeId=npc=>npc.id==='yatasto-san-martin'?57:npc.operativeId;
export function onCivilianDeath(state,npc,record,atHour){
 if((missionCivilianOperativeId(npc)===57||npc.id==='yatasto-belgrano')&&!state.completed){
  state.defeated=true;
  if(record.sceneId==='yatasto')state.missions.yatasto={...(state.missions.yatasto??{}),stage:'failed',completed:false};
  state.log.unshift({hour:atHour,text:`${npc.name} ha muerto. La campaña no puede continuar sin este mando.`});state.log=state.log.slice(0,80);
 }
}
export function calendar(s){const day=Math.floor(s.hour/24);return {year:1812+Math.floor((2+Math.floor(day/30))/12),month:(2+Math.floor(day/30))%12+1,day:day%30+1,hour:s.hour%24};}
export function initialState(seed,definitions){
 return {artilleryVersion:1,artilleryCustodyVersion:1,nextArtilleryId:1,civilianState:{version:2,people:{}},hiringArrivals:[],equipmentShipments:[],missions:{},sceneStates:{},missionAllies:{},garrisons:{},nextMilitiaId:20000,quests:{},cityLoyaltyEvents:[],contracts:{},militiaTraining:[],foundMoney:[],skillLearningVersion:1,economyVersion:2,version:1,seed:seed>>>0,hour:0,phase:0,location:'retiro',activeSquadId:'squad-1',squads:[{id:'squad-1',name:'Primera escuadra',members:[],location:'retiro'}],sectorStates:{},resources:{treasury:3200},reputation:{directory:35,gauchos:0,pardos:10,foreign:20,indigenous:0,royalists:-100},sectors:Object.fromEntries(CAMPAIGN_SECTORS.map(x=>[x.id,{owner:x.id==='retiro'?'patriot':'royalist',loyalty:x.id==='retiro'?65:25,militia:[0,0,0],damageUntil:0,fort:0}])),artillerySelection:[],armory:{},loadouts:{},lastConversation:null,conversations:{},officer:null,recruited:[],squad:[],operativeState:Object.fromEntries([...OPERATIVES,...CIVIC_RECRUITS].map(o=>[o.id,{hp:o.maxHp,fatigue:0,alive:true,xp:0,rations:2,torches:2,condition:100,startingCartridgesIssued:false}])),flags:{armyFunded:false,academy:false,sanLorenzo:false,northPact:false,partisanSupply:false,foundry:false,parliament:false,emancipation:false,commission:false,mentoring:false},routes:{posta:false,flotilla:false,carts:false,mules:false},blockade:false,pendingBattle:null,completed:false,defeated:false,log:[{hour:0,text:'Retiro, 1812. Solo el cuartel está bajo tu control. Contratá combatientes, creá tu granadero o combiná ambas opciones para partir.'}],lastError:null};
}
export function recruitmentGate(s,id){
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
    57:[s.phase>=4,`Completa los preparativos de ${foundryFor(s).name}.`],
 };
 const [available,reason]=conditions[id]??[false,'No está disponible.'];return {available,reason:available?'Disponible para incorporarse.':reason};
}
export function progress(s,{hasReadyCombatant,isSupplied,ownedArtilleryCount,note,standing,endingSpeech}){
 enforceHistoricalLoss(s);
  if(s.defeated)return;
  if(s.phase===0&&(s.flags.academy||hasReadyCombatant(s))){s.flags.academy=true;s.phase=1;note(s,'El destacamento está listo para partir. Llegan noticias de un desembarco realista junto a San Lorenzo.');}
  if(s.phase===1&&s.flags.sanLorenzo){s.phase=2;standing(s,'directory',15);note(s,'Victoria en San Lorenzo. San Martín marcha al norte para estudiar la situación del Ejército del Norte.');}
  if(s.phase===2&&s.missions?.yatasto?.completed&&s.sectors.tucuman.owner==='patriot'&&s.flags.northPact&&isSupplied(s,'salta')){s.phase=3;s.flags.mentoring=true;note(s,'En Yatasto, San Martín confía el norte a Güemes. El esfuerzo principal se traslada a Cuyo.');}
  if(s.phase===3&&s.flags.foundry&&s.flags.parliament&&s.flags.armyFunded&&ownedArtilleryCount(s)>=3&&['mendoza','uspallata','los_patos'].every(id=>s.sectors[id].owner==='patriot'&&s.sectors[id].fort>=1)){
    s.phase=4;note(s,`${foundryFor(s).name} alcanza plena capacidad. Tres mil infantes, artillería y pasos seguros: San Martín puede incorporarse al ejército.`);
  }
  if(!s.completed&&s.phase===4&&s.recruited.includes(57)&&Object.values(s.sectors).every(x=>x.owner==='patriot')&&!s.blockade&&!s.pendingBattle&&!s.pendingEncounter&&!s.enemyGroups.some(g=>['marching','waiting','engaged','stationed'].includes(g.status))){s.completed=true;note(s,`¡Campaña concluida! Las provincias están libres y el ${foundryFor(s).armyName} queda preparado para la liberación continental.`);endingSpeech(s);}
  if(s.sectors[headquartersFor(s)].owner!=='patriot'){s.defeated=true;note(s,`El cuartel de ${headquartersName(s)} ha caído. El ejército debe reorganizarse desde una nueva campaña.`);}
}
export function raid(s,theater,forcedTarget,{sector,launchEnemyGroup}){
  const targets=campaignSectors(s).filter(x=>x.theater===theater&&s.sectors[x.id].owner==='patriot'&&x.id!==headquartersFor(s));
  const priorities=theater==='north'?NORTHERN_AXIS:theater==='coast'?['san_nicolas','santa_fe','ensenada','buenos_aires']:['cordoba'];
  targets.sort((a,b)=>theater==='coast'?b.income-a.income:priorities.indexOf(a.id)-priorities.indexOf(b.id));
  const target=forcedTarget?sector(forcedTarget):targets.find(x=>theater!=='interior'||s.sectors[x.id].loyalty<50);if(!target||s.sectors[target.id].owner!=='patriot')return;
  launchEnemyGroup(s,theater,target.id);
}
export function hourlyEvents(s,ctx){
 if(!s.completed&&s.hour%120===0)raid(s,'north',null,ctx);
 if(!s.completed&&s.hour%168===0&&coastalRevenue(s)>=500)raid(s,'coast',null,ctx);
 if(!s.completed&&s.hour%144===0)raid(s,'interior',null,ctx);
}
export const dailyEvents=dailyPolitics;
export const validateDailyState=validatePolitics;
export const validateHistoricalState=enforceHistoricalLoss;
export function payroll(s,paid,{standing}){if(paid)standing(s,'foreign',5);else {standing(s,'foreign',-20);standing(s,'directory',-10);}}
export function paidService(s,{standing}){standing(s,'foreign',5);}
export function diplomacy(s,action,{requireThat,pay,standing,note,sector,add}){

        const kind=action.kind;
        if(kind==='northPact'){requireThat(s.sectors.salta.owner==='patriot','Libera Salta para reunir su Cabildo.');requireThat(!s.flags.northPact,'El pacto del norte ya está firmado.');pay(s,{treasury:300});s.flags.northPact=true;standing(s,'gauchos',45);note(s,'Güemes acepta custodiar el norte con respeto a la autonomía provincial.');}
        else if(kind==='partisanSupply'){requireThat(s.sectors.tucuman.owner==='patriot','Abre una ruta hacia las partidas del norte.');requireThat(!s.flags.partisanSupply,'Las partidas ya recibieron su entrega.');pay(s,{treasury:250});s.flags.partisanSupply=true;standing(s,'gauchos',20);note(s,'Las partidas reciben cincuenta mosquetes. Azurduy ofrece su colaboración.');}
        else if(kind==='parliament'){requireThat(s.sectors.mendoza.owner==='patriot','El parlamento debe prepararse desde Cuyo.');requireThat(!s.flags.parliament,'Los pasos ya cuentan con un acuerdo.');pay(s,{treasury:200});s.flags.parliament=true;standing(s,'indigenous',60);note(s,'El parlamento acuerda el tránsito y respeta la autonomía pehuenche.');}
        else if(kind==='emancipation'){requireThat(!s.flags.emancipation,'El decreto ya fue proclamado.');pay(s,{treasury:150});s.flags.emancipation=true;standing(s,'pardos',30);standing(s,'directory',5);note(s,'El Cabildo proclama la libertad y garantiza la protección de las familias emancipadas.');}
        else if(kind==='commission'){requireThat(s.flags.emancipation,'Primero garantiza la emancipación.');requireThat(!s.flags.commission,'Las comisiones ya fueron otorgadas.');pay(s,{treasury:100});s.flags.commission=true;standing(s,'pardos',20);note(s,'Los batallones de Pardos y Morenos reciben comisiones de oficiales.');}
        else if(kind==='gift'){pay(s,{treasury:80});standing(s,'indigenous',15);note(s,'Una comitiva entrega presentes y renueva los acuerdos de frontera.');}
        else if(kind==='requisition'){requireThat(sector(s.location),'La contribución se solicita en el sector principal de una localidad.');requireThat(policyStatus(s).requisitionReady,'Las estancias necesitan catorce días para recuperarse.');const reason=treasuryIncomeReason(s,200);requireThat(!reason,reason);s.politics??={};s.politics.requisitionAfter=s.hour+336;add(s,{treasury:200});standing(s,'gauchos',-20);standing(s,'directory',-10);s.sectors[s.location].loyalty=Math.max(0,s.sectors[s.location].loyalty-20);note(s,'La requisa abastece al ejército, pero provoca rechazo en la población.');}
        else if(kind==='autonomy'){pay(s,{treasury:80});standing(s,'gauchos',15);standing(s,'directory',-3);note(s,'El ejército reconoce las autoridades provinciales.');}
        else throw Error('No existe esa propuesta diplomática.');
}

export function dispatchAction(s,action,ctx){
 const {requireThat,hasReadyCombatant,dispatchCampaign,prepareDeploymentExits,note}=ctx;
 switch(action.type){
  case 'academy':requireThat(s.flags.academy||hasReadyCombatant(s),'Contratá un combatiente o creá tu granadero para comenzar.');break;
  case 'policy':applyPolicy(s,action.kind);break;
  case 'diplomacy':diplomacy(s,action,ctx);break;
  case 'visitMission':{
   requireThat(action.mission==='yatasto','La escena solicitada no existe.');requireThat(s.location==='tucuman'&&s.phase>=2,'Viajá a Tucumán después de San Lorenzo para acudir a Yatasto.');requireThat(!s.missions.yatasto?.completed,'La conferencia de Yatasto ya concluyó.');
   const entered=dispatchCampaign(s,{type:'visitSector'});requireThat(!entered.lastError,entered.lastError);Object.assign(s,entered);Object.assign(s.pendingBattle,{sceneId:'yatasto',missionId:'yatasto',name:MISSION_SCENES.yatasto.name,npcs:missionContacts(s),garrison:[],artillery:[]});delete s.pendingBattle.exits;prepareDeploymentExits(s,s.pendingBattle);break;
  }
  case 'finishMission':{
   requireThat(s.pendingBattle?.sceneId==='yatasto'&&s.pendingBattle.id===action.battleId,'No hay una conferencia de Yatasto abierta.');requireThat(s.missions.yatasto?.frontier,'Completá los partes, el análisis y el acuerdo de frontera antes de cerrar la conferencia.');
   const result=dispatchCampaign(s,{...action,type:'leaveSector'});requireThat(!result.lastError,result.lastError);Object.assign(s,result);s.missions.yatasto.completed=true;s.missions.yatasto.stage='completed';note(s,'La conferencia de Yatasto concluye. Belgrano entrega el mando y la preparación continental se orienta hacia Cuyo.');break;
  }
  default:throw Error('Esta campaña no ofrece esa orden.');
 }
}
export function conversationContacts(s,request){return request.sceneId==='yatasto'?missionContacts(s):null;}
export function missionConversation(s,npcId,{isSupplied}){need(s.pendingBattle.sceneId==='yatasto','No hay una conferencia pendiente.');return talkMission(s,npcId,isSupplied(s,'salta'));}
export const defaultAttackSector='san_lorenzo';
export function attackDefinition(s,at,{sector}){return at==='san_lorenzo'?{id:at,name:'Combate de San Lorenzo',biome:'river',theater:'coast',anchor:'san_nicolas',mission:true,difficulty:2}:sector(at);}
export function admitAttack(s,at,def,{requireThat,campaignDate}){
 requireThat(!(['uspallata','los_patos'].includes(at)&&campaignDate(s).month>=6&&campaignDate(s).month<=8),'La nieve invernal ha cerrado los pasos.');
 if(def.mission)requireThat(s.phase>=1&&!s.flags.sanLorenzo&&s.sectors.san_nicolas.owner==='patriot','Organiza Retiro y libera San Nicolás antes de combatir en San Lorenzo.');
}
export function attackDifficulty(s,def){return def.difficulty??Math.min(4,1+Math.floor(s.hour/240)+(def.theater==='north'?1:0));}
export function victoryText(request){return `Victoria en ${request.name}. Se recuperan armas y fondos realistas.`;}
export function occupationText(name){return `Los realistas ocupan ${name} y cortan el camino.`;}
export function blockadeText(name){return `La flotilla realista establece un bloqueo en ${name}. Las aduanas reducen sus ingresos.`;}
export const enemyName='realistas';
export const blockaded=(s,sector)=>Boolean(s.blockade&&sector.theater==='coast');
export function clearVictoryBlockade(s,request){if(request.theater==='coast'&&!s.enemyGroups.some(g=>g.theater==='coast'&&['waiting','engaged','stationed'].includes(g.status)))s.blockade=false;}
export function occupySector(s,group,{note,sector}){
 if(group.theater==='coast'){s.blockade=true;note(s,blockadeText(sector(group.target).name));}
 else {if(group.theater==='interior'){const silver=Math.min(150,s.resources.treasury);s.resources.treasury-=silver;note(s,`Las partidas saquean ${silver} pesos de la tesorería.`);}s.sectors[group.target].owner='royalist';note(s,occupationText(sector(group.target).name));}
}
export function prepareAttack(s,request,ids,origin,{recordStrategicArrival}){if(request.sector==='san_lorenzo'){recordStrategicArrival(s,ids,origin,request.sector);request.missionId='san_lorenzo';request.missionAllies=[sanLorenzoAlly(s)];}}
export function missionFailed(request,snapshot){return request.missionId==='san_lorenzo'&&snapshot.units.find(u=>Number(u.id)===57&&u.missionAlly)?.hp<=0;}
export function settleMissionResult(s,request,battleSnapshot,action,{requireThat,note}){
 if(request.missionId!=='san_lorenzo')return action;
 requireThat(battleSnapshot,'San Lorenzo necesita un parte táctico completo.');const commander=battleSnapshot.units.find(u=>Number(u.id)===57&&u.missionAlly);requireThat(commander,'Falta el comandante aliado en el parte.');s.missionAllies.san_lorenzo=copy(commander);
 if(action.outcome==='victory'&&commander.hp>0)requireThat(completedTacticalVictory(battleSnapshot),'La victoria exige derrotar a los realistas y conservar con vida al comandante.');
 if(commander.hp<=0){action={...action,outcome:'defeat'};s.defeated=true;s.missions.san_lorenzo={stage:'failed',completed:false};note(s,'San Martín ha caído en San Lorenzo. La misión y la campaña concluyen con una derrota.');}
 else if(action.outcome==='victory')s.missions.san_lorenzo={stage:'completed',completed:true};
 return action;
}
export function battleOutcome(s,request,outcome,{standing}){
 if(outcome==='victory'){if(request.sector==='san_lorenzo')s.flags.sanLorenzo=true;standing(s,'directory',5);standing(s,'gauchos',request.theater==='north'?10:2);}
 else standing(s,'directory',-5);
}
export function changedFlags(s,previous,{recordCityLoyalty}){for(const [flag,at] of Object.entries({academy:headquartersFor(s),foundry:foundryFor(s).sector,northPact:'salta',partisanSupply:'tucuman',parliament:'mendoza',emancipation:'buenos_aires',commission:'buenos_aires'}))if(s.flags[flag]&&!previous.flags[flag])recordCityLoyalty(s,{sectorId:at,kind:'quest',eventId:`quest-${flag}`});}
export function validateReputation(s){return s.reputation.royalists===-100;}
export function validateStoredScenes(s,{validateSectorSnapshot}){
 return validateMissions(s)&&object(s.sceneStates)&&Object.entries(s.sceneStates).every(([id,b])=>id==='yatasto'&&b.sceneId===id&&validateSectorSnapshot(b))&&object(s.missionAllies)&&Object.entries(s.missionAllies).every(([id,u])=>id==='san_lorenzo'&&object(u)&&u.missionAlly===true&&Number(u.id)===57&&typeof u.name==='string'&&Number.isInteger(u.weapon)&&(u.weapon===0||u.weapon>=1800&&u.weapon<=1813)&&(u.blade===undefined||u.blade===0||Number.isInteger(u.blade)&&u.blade>=1809&&u.blade<=1813)&&Number.isInteger(u.ammo)&&u.ammo>=0&&u.ammo<=100000&&Number.isInteger(u.loaded)&&u.loaded>=0&&u.loaded<=(weaponSpecification(u)?.capacity??0)&&Number.isFinite(u.hp)&&u.hp>=0&&u.hp<=100);
}
export function validatePendingScene(s,b){return (!b.sceneId||(b.sceneId==='yatasto'&&b.sector==='tucuman'&&b.exploration===true))&&(!b.missionAllies||(b.sector==='san_lorenzo'&&Array.isArray(b.missionAllies)&&b.missionAllies.length===1&&Number(b.missionAllies[0].id)===57&&b.missionAllies[0].missionAlly===true));}
export function enemyGroupPlan(s,theater,target){return {command:theater==='north'?'north':theater==='coast'?'naval':'partisans',origin:theater==='north'?'alto_peru':theater==='coast'?'montevideo':'partidas_del_interior',route:theater==='north'?NORTHERN_AXIS.slice(0,NORTHERN_AXIS.indexOf(target)+1):[target]};}
export function enemyOriginName(origin){return origin==='alto_peru'?'Alto Perú':origin==='montevideo'?'Montevideo':'Interior';}
