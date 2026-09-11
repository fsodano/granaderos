import {CAMPAIGN_SECTORS} from './data.js';
import {sectorExits,validateSectorExits,boundaryMatches,entryFromSector,validEntry} from './tactical-exits.js';
import {planReturnAmmunition} from './ammunition.js';
import {fieldCapable} from './tactical.js';
import {validateBattleSnapshot} from './validate-battle.js';
import {FITTING_RULES_VERSION,normalizeUnitFittings} from './weapon-fittings.js';

const clone=value=>structuredClone(value);
const need=(ok,message)=>{if(!ok)throw Error(message);};
const sector=id=>CAMPAIGN_SECTORS.find(s=>s.id===id);
export const strategicSector=request=>request.sector==='san_lorenzo'?'san_nicolas':request.sector;
export function recordStrategicArrival(s,ids,fromSector,toSector,sceneId=null){
  const entry=entryFromSector(fromSector,toSector,sceneId);if(!entry)return;
  for(const id of ids){const r=s.operativeState[id];r.location=toSector==='san_lorenzo'?'san_nicolas':toSector;r.arrival={battleId:`travel-${s.hour}-${fromSector}-${sceneId??toSector}`,fromSector,toSector,sceneId,fromScene:null,...clone(entry)};r.residentSector=null;r.residentScene=null;}
}

// Request routes are immutable authority. Later arrivals are queued while a
// deployment is active and are resolved after the actual departures return.
export function prepareDeploymentExits(s,request){
  request.fittingRulesVersion=FITTING_RULES_VERSION;
  for(const unit of [...request.squad,...(request.garrison??[]),...(request.missionAllies??[])])normalizeUnitFittings(unit);
  request.exits=sectorExits(request.sector,request.sceneId??null).filter(e=>s.sectors[e.destination]?.owner==='patriot'&&!s.enemyGroups?.some(g=>g.target===e.destination&&['engaged','stationed'].includes(g.status)));
  request.exitRulesVersion=1;
  request.remains=clone(s.sectorRemains?.[strategicSector(request)]??[]);
  const previous=request.sceneId?s.sceneStates?.[request.sceneId]:s.sectorStates?.[request.sector];
  const bodies=(previous?.units??[]).filter(u=>u.side==='player'&&u.hp<=0&&!u.departure&&(!previous.returnLedger?.entries?.some(e=>e.unitId===u.id)||previous.returnLedger.entries.some(e=>e.unitId===u.id&&e.kind==='dead'&&e.sector===strategicSector(request))));
  request.casualtyLootSources=[...new Map([...bodies,...request.remains.map(r=>r.unit)].map(u=>[String(u.id),{id:String(u.id),side:'player',loaded:u.loaded??0,ammo:u.ammo??0}])).values()];
  for(const u of request.squad){
    const r=s.operativeState[Number(u.id)],arrival=r?.arrival;
    delete u.entryEdge;delete u.entryAnchor;delete u.entryReason;
    if(arrival&&r.location===strategicSector(request)){u.entryEdge=arrival.entryEdge;u.entryAnchor=clone(arrival.entryAnchor);u.entryReason='arrival';}
    else if(r?.residentSector===request.sector&&(r.residentScene??null)===(request.sceneId??null))u.entryReason='resident';
  }
  return request;
}

function departureFor(s,request,snapshot,u){
  if(!u.departure)return null;
  const d=u.departure,e=request.exits.find(e=>e.id===d.exitId);
  need(e&&d.edge===e.edge&&d.destination===e.destination&&boundaryMatches(snapshot,d,e.edge),'La salida no corresponde a una ruta del despliegue.');
  need(Number.isSafeInteger(d.elapsedSeconds)&&d.elapsedSeconds>=0&&d.elapsedSeconds<=(snapshot.elapsedSeconds??0),'El reloj de salida es inválido.');
  need(s.sectors[e.destination]?.owner==='patriot'&&!s.enemyGroups?.some(g=>g.target===e.destination&&['engaged','stationed'].includes(g.status)),'El destino de salida está ocupado.');
  need(d.mountId===null||typeof d.mountId==='string'&&d.mountId===u.mount?.id,'La montura de salida no corresponde al combatiente.');
  return {...clone(d),entryEdge:e.entryEdge,entryAnchor:clone(e.entryAnchor)};
}

export function planDeploymentReturn(s,request,snapshot,outcome){
  need(request.exitRulesVersion===1&&Array.isArray(request.exits),'El despliegue no contiene rutas de salida válidas.');
  need(validateSectorExits(request.sector,request.sceneId??null,request.exits),'Las rutas del despliegue son inválidas.');
  need(validateSectorExits(request.sector,request.sceneId??null,snapshot.exits),'Las rutas tácticas son inválidas.');
  need(JSON.stringify(request.exits)===JSON.stringify(snapshot.exits),'Las rutas tácticas no corresponden al despliegue.');
  const sourceSector=strategicSector(request),players=snapshot.units.filter(u=>u.side==='player');
  const departed=players.filter(u=>u.departure);
  if(request.exploration&&snapshot.status==='active')need(!snapshot.units.some(u=>u.side==='enemy'&&fieldCapable(u)),'La visita tiene un combate pendiente.');
  if(outcome==='retreat')need(snapshot.status==='retreat'&&departed.length>0&&!players.some(fieldCapable),'La retirada necesita salidas físicas y el cierre del combate.');
  const friendly=outcome==='victory'||Boolean(request.exploration&&snapshot.status!=='defeat'&&!snapshot.units.some(u=>u.side==='enemy'&&fieldCapable(u)));
  const classify=(u,auxiliary=false)=>{
    const departure=departureFor(s,request,snapshot,u),at=departure?.destination??sourceSector;
    const kind=u.hp<=0?'dead':departure?'departed':friendly?'resident':auxiliary?'dispersed':'captured';
    return {unitId:String(u.id),kind,sector:at,...(departure?{departure}:{})};
  };
  const entries=request.squad.map(issued=>classify(players.find(u=>String(u.id)===String(issued.id))));
  const auxiliary=[...(request.garrison??[]),...(request.missionAllies??[])].map(issued=>classify(players.find(u=>String(u.id)===String(issued.id)),true));
  return {battleId:request.id,sourceSector,outcome,entries,auxiliary,
    ammunition:planReturnAmmunition(request,snapshot,entries),
    squadChanges:planSquadPartition(s,entries),horseChanges:planMountReturn(s,request,snapshot,entries)};
}

// A member's location is changed only after their original squad is partitioned.
// Overflow becomes a reserve at the actual destination, never a remote merge.
export function planSquadPartition(s,entries){
  const byId=new Map(entries.map(e=>[Number(e.unitId),e])),squads=clone(s.squads);
  let nextId=Math.max(0,...squads.map(q=>Number(q.id.split('-')[1])))+1;
  const splits=[];
  for(const q of squads){
    if(!q.members.some(id=>byId.has(id)))continue;
    const buckets=new Map();
    for(const id of q.members){const e=byId.get(id);if(e&&['dead','captured'].includes(e.kind))continue;const at=e?.sector??q.location;if(!buckets.has(at))buckets.set(at,[]);buckets.get(at).push(id);}
    if(!buckets.size){q.members=[];continue;}
    const retained=[...buckets.keys()].find(at=>buckets.get(at).some(id=>byId.get(id)?.kind==='resident'))??buckets.keys().next().value;
    q.members=buckets.get(retained);q.location=retained;
    for(const [at,members]of buckets)if(at!==retained)splits.push({id:`squad-${nextId++}`,name:`Destacamento ${at}`.slice(0,30),members,location:at});
  }
  squads.push(...splits.slice(0,Math.max(0,8-squads.length)));
  return {squads,activeSquadId:s.activeSquadId};
}

export function planMountReturn(s,request,snapshot,entries){
  const changes=[];
  for(const entry of entries){
    const id=Number(entry.unitId),issued=request.squad.find(u=>Number(u.id)===id),actual=snapshot.units.find(u=>u.side==='player'&&String(u.id)===entry.unitId);
    if(!issued.mount){need(!actual.mount,'La montura no pertenece al despliegue.');continue;}
    const horse=s.horseState.horses.find(h=>h.id===issued.mount.id&&!h.returned&&h.assignedTo===id);
    need(horse&&actual.mount?.id===horse.id,'Falta la montura del combatiente en el parte.');
    const crossed=entry.departure?.mountId===horse.id,at=crossed?entry.sector:strategicSector(request);
    const captured=entry.kind==='captured',available=entry.kind==='resident'||entry.kind==='departed'&&crossed;
    changes.push({id:horse.id,location:at,stamina:actual.mount.stamina,condition:actual.mount.condition,assignedTo:available?id:null,
      custody:captured?{kind:'captured',sector:at,operativeId:id}:available?null:{kind:'field',sector:at,operativeId:id}});
  }
  return changes;
}

export function migrateDeploymentReturns(s){s.sectorRemains??={};for(const r of Object.values(s.operativeState??{}))r.capturedAmmunition??={loaded:0,ammo:0};return s;}
const sameEntry=(a,b)=>Boolean(a&&b&&a.entryEdge===b.entryEdge&&a.entryAnchor?.x===b.entryAnchor?.x&&a.entryAnchor?.y===b.entryAnchor?.y);
const knownExit=id=>[...CAMPAIGN_SECTORS.flatMap(s=>sectorExits(s.id)),...sectorExits('san_lorenzo'),...sectorExits('tucuman','yatasto')].find(e=>e.id===id);
function validateReturnLedger(snapshot){
  if(snapshot.returnLedger===undefined)return;
  const ledger=snapshot.returnLedger,seen=new Set(),friendly=snapshot.status==='victory'||snapshot.mode==='exploration'&&!snapshot.units.some(u=>u.side==='enemy'&&fieldCapable(u));
  need(ledger&&ledger.battleId===snapshot.battleId&&Array.isArray(ledger.entries)&&ledger.entries.length<=snapshot.units.length&&Number.isSafeInteger(ledger.creditedCartridges)&&ledger.creditedCartridges>=0&&ledger.creditedCartridges<=1000000,'El registro del parte es inválido.');
  for(const e of ledger.entries){
    const u=snapshot.units.find(u=>u.id===e?.unitId),source=snapshot.sectorId==='san_lorenzo'?'san_nicolas':snapshot.sectorId;
    need(u?.side==='player'&&!seen.has(e.unitId)&&['dead','resident','departed','captured','dispersed'].includes(e.kind)&&sector(e.sector),'La distribución del parte es inválida.');seen.add(e.unitId);
    need(e.kind==='dead'?u.hp===0:u.hp>0,'La salud y el destino del parte no coinciden.');
    if(e.kind==='resident')need(friendly,'El parte declara residentes en un campo perdido.');
    if(['captured','dispersed'].includes(e.kind))need(!friendly,'El parte declara cautivos en un campo seguro.');
    if(u.departure){const exit=knownExit(u.departure.exitId);need(['departed','dead'].includes(e.kind)&&exit&&exit.destination===e.sector&&e.departure&&['exitId','edge','destination','x','y','elapsedSeconds','mountId'].every(k=>e.departure[k]===u.departure[k])&&sameEntry(e.departure,exit),'La salida del parte es inválida.');}
    else need(e.kind!=='departed'&&e.sector===source&&!e.departure,'La residencia del parte es inválida.');
  }
  const loose=ledger.entries.filter(e=>['resident','departed'].includes(e.kind)).reduce((sum,e)=>{const u=snapshot.units.find(u=>u.id===e.unitId);return sum+(u.militia||u.missionAlly?0:u.loaded+u.ammo);},0);
  need(ledger.creditedCartridges<=loose,'El crédito de munición del parte es inválido.');
}
export function validateDeploymentReturnState(s){
  const object=v=>v&&typeof v==='object'&&!Array.isArray(v),integer=(v,max)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
  migrateDeploymentReturns(s);need(object(s.sectorRemains),'Los restos del campo son inválidos.');
  const seen=new Set();
  for(const [at,records]of Object.entries(s.sectorRemains)){
    need(sector(at)&&Array.isArray(records)&&records.length<=200,'Los restos del campo son inválidos.');
    for(const r of records){
      const key=`${r?.battleId}:${r?.unitId}`;need(object(r)&&typeof r.battleId==='string'&&r.battleId.length<100&&typeof r.unitId==='string'&&r.unit?.id===r.unitId&&r.unit.hp===0&&r.unit.side==='player'&&validEntry(r.entryEdge,r.entryAnchor)&&!seen.has(key),'La identidad de un caído está duplicada o es inválida.');seen.add(key);
      const exit=knownExit(r.unit.departure?.exitId);need(exit&&exit.destination===at&&sameEntry(r,exit),'La llegada del caído no corresponde a su salida.');
      const unit=clone(r.unit);delete unit.departure;
      const rawFields=['hp','maxHp','weapon','condition','jammed','loaded','ammo','inventory','bleeding','bandaged','energy','medkits','fatigue','priming','flints','rations','torches','boleadoras','activeSlot','weaponFittings','weaponFittingPattern','bladeFittingPattern'];need(rawFields.every(k=>Object.hasOwn(unit,k)&&unit[k]!==undefined),'El equipo del caído está incompleto.');
      validateBattleSnapshot({width:20,height:16,units:[unit],tiles:Array.from({length:320},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',blocked:false,cover:0})),status:'defeat'});
    }
  }
  for(const r of Object.values(s.operativeState)){
    r.capturedAmmunition??={loaded:0,ammo:0};
    need(object(r.capturedAmmunition)&&integer(r.capturedAmmunition.loaded,2)&&integer(r.capturedAmmunition.ammo,100000)&&(!r.captured?r.capturedAmmunition.loaded+r.capturedAmmunition.ammo===0:true),'La munición en custodia es inválida.');
    if(r.arrival!=null){
      const a=r.arrival;need(object(a)&&typeof a.battleId==='string'&&a.battleId.length<100&&(sector(a.fromSector)||a.fromSector==='san_lorenzo')&&validEntry(a.entryEdge,a.entryAnchor),'La llegada del combatiente es inválida.');
      const entry=a.exitId?sectorExits(a.fromSector,a.fromScene??null).find(e=>e.id===a.exitId&&e.destination===r.location):entryFromSector(a.fromSector,a.toSector??r.location,a.sceneId??null);
      need(sameEntry(a,entry),'La llegada no corresponde a una ruta física.');
    }
    if(r.residentSector!=null)need(sector(r.residentSector)||r.residentSector==='san_lorenzo','La residencia táctica es inválida.');
    if(r.residentScene!=null)need(r.residentScene==='yatasto'&&r.residentSector==='tucuman','La residencia de escena es inválida.');
  }
  for(const h of s.horseState.horses)if(h.custody!=null)need(object(h.custody)&&['field','captured'].includes(h.custody.kind)&&sector(h.custody.sector)&&h.location===h.custody.sector&&Number.isInteger(h.custody.operativeId)&&s.operativeState[h.custody.operativeId]&&h.assignedTo===null&&!h.returned,'La custodia de la montura es inválida.');
  for(const snapshot of [...Object.values(s.sectorStates??{}),...Object.values(s.sceneStates??{})])validateReturnLedger(snapshot);
  return s;
}
