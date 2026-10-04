import {CRITICAL_HEALTH,isUnconscious} from './actor-condition.js';
import {isWorldCharacter,isContractCharacter} from './content-character-ids.js';
import {encounterDefinitions} from './encounters.js';
import {civilianIncidents} from './civilian-harm.js';
import {receiveCorrespondence} from './correspondence.js';

export const CIVILIAN_CONSCIENCE='civilian_conscience';
const need=ok=>{if(!ok)throw Error('La objeción de servicio no corresponde al incidente civil del despliegue.');};
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const identity=value=>typeof value==='string'&&value.length>0&&value.length<=120&&!/[<>\x00-\x1f]/u.test(value);
const idOf=actor=>Number.isSafeInteger(Number(actor?.id))&&Number(actor.id)>=0&&String(Number(actor.id))===String(actor.id)?Number(actor.id):null;
const explicit=actor=>Array.isArray(actor?.abilities)&&actor.abilities.includes(CIVILIAN_CONSCIENCE);
const keyOf=npc=>npc.operativeId===undefined?`npc-${npc.id}`:`person-${npc.operativeId}`;
const same=(a,b)=>a===undefined&&b===undefined||a!==undefined&&b!==undefined&&JSON.stringify(a)===JSON.stringify(b);
const capable=actor=>actor?.side==='player'&&!actor.militia&&actor.hp>=CRITICAL_HEALTH&&!isUnconscious(actor)&&!actor.unconscious&&!actor.asleep&&!actor.sleepCollapsed&&!actor.captured&&!actor.departure&&!actor.fled&&!actor.surrendered&&!actor.routed;
const unarmed=npc=>!npc.weapon&&!npc.blade&&!npc.civilianWeapons?.primary&&!npc.civilianWeapons?.blade;
export const conductObserverDefinition=character=>Boolean(character&&character.service==='contract'&&(isContractCharacter(character)||isWorldCharacter(character)));

// This is explicit fictional authoring metadata, never inferred from a name,
// portrait, list membership or a historical military role.
export function conductNoncombatantDefinition(character,placement){
 return Boolean(character&&isWorldCharacter(character)&&character.service==='permanent'&&character.monthlyPay===0&&character.weapon===null&&character.blade===undefined&&character.encounter?.recruitable===false&&placement?.mode==='fixed');
}
export function isConductNoncombatant(npc){
 return Boolean(npc?.noncombatant===true&&unarmed(npc)&&!npc.detention&&!npc.prisoner&&!npc.hostile&&!npc.aggressive&&!npc.missionAlly&&(npc.operativeId===undefined||npc.contentId&&npc.recruitable===false));
}
export function issueConductObservers(units){
 const ids=units.filter(actor=>actor.hp>0&&!actor.militia&&actor.side!=='enemy'&&idOf(actor)!==null&&explicit(actor)).map(idOf);
 return ids.length?{conductObserverIds:ids}:{};
}
// Only the canonical newly joined body is admitted. Existing retained actors
// are never inferred into an older or initially neutral encounter.
export function addIssuedConductObserver(snapshot,actor){
 need(Array.isArray(snapshot?.units)&&snapshot.units.includes(actor)&&actor.side==='player'&&!actor.militia&&actor.hp>0&&idOf(actor)!==null);
 if(!explicit(actor))return snapshot;
 const ids=snapshot.conductObserverIds??[];if(!ids.includes(idOf(actor))){need(ids.length<200);snapshot.conductObserverIds=[...ids,idOf(actor)];}
 return snapshot;
}
export function validateConductObservers(snapshot){
 if(snapshot.conductObserverIds===undefined)return;
 const ids=snapshot.conductObserverIds;
 need(Array.isArray(ids)&&Object.keys(ids).length===ids.length&&ids.length>0&&ids.length<=200&&new Set(ids).size===ids.length&&[...ids].every(id=>Number.isSafeInteger(id)&&id>=0));
 need(ids.every(id=>snapshot.units?.some(actor=>idOf(actor)===id&&actor.side==='player'&&!actor.militia&&explicit(actor))));
}
export function validateServiceObjection(record){
 need(object(record));
 if(!Object.hasOwn(record,'serviceObjection'))return record;
 const receipt=record.serviceObjection;
 need(object(receipt)&&Object.keys(receipt).length===3&&['kind','civilianKey','attackerId'].every(key=>Object.hasOwn(receipt,key))&&receipt.kind==='civilian-killing'&&identity(receipt.civilianKey)&&/^(npc-|person-).+/.test(receipt.civilianKey)&&identity(receipt.attackerId));
 return record;
}

// Private references exist only between this capture and the actual positive
// HP -> zero direct impact. Bleeding and later corpse discovery never call it.
export function captureServiceObjection(state,npc,source,{intentional=false,canObserve}={}){
 const actual=source&&state.units?.find(actor=>String(actor.id)===String(source.id));
 if(!intentional||!actual||actual.side!=='player'||actual.militia||actual.hp<=0||!state.npcs?.includes(npc)||!isConductNoncombatant(npc)||(npc.hp??100)<=0||npc.departure||npc.fled||typeof canObserve!=='function')return null;
 return {npc,hp:npc.hp??100,source:actual,witnesses:state.units.filter(actor=>state.conductObserverIds?.includes(idOf(actor))&&explicit(actor)&&capable(actor)&&actor.serviceObjection===undefined&&canObserve(actor,actual)&&canObserve(actor,npc))};
}
export function applyServiceObjection(state,captured){
 if(!captured||captured.hp<=0||captured.npc.hp!==0||!state.npcs?.includes(captured.npc))return [];
 const death=civilianIncidents(captured.npc).find(event=>event.kind==='death');
 if(!death||death.side!=='player'||death.militia||!death.intentional||death.attackerId!==String(captured.source.id))return [];
 const reactions=[];
 for(const actor of captured.witnesses){
  if(!state.units.includes(actor)||actor.serviceObjection!==undefined)continue;
  actor.serviceObjection={kind:'civilian-killing',civilianKey:keyOf(captured.npc),attackerId:String(captured.source.id)};
  reactions.push({unit:actor,civilian:captured.npc,text:`${actor.name}: No acepto la muerte de ${captured.npc.name}. Cumpliré el plazo pagado, pero no aceptaré otro contrato.`});
 }
 return reactions;
}

function retains(previous,current){if(previous?.serviceObjection!==undefined)need(same(previous.serviceObjection,current?.serviceObjection));}
function pinned(operative,actor){validateServiceObjection(actor);if(actor.serviceObjection!==undefined)need(explicit(operative));}
function deathMatches(npc,receipt){
 if(!npc||npc.hp!==0||keyOf(npc)!==receipt.civilianKey)return false;
 return civilianIncidents(npc).some(event=>event.kind==='death'&&event.side==='player'&&!event.militia&&event.intentional&&event.attackerId===receipt.attackerId);
}
function definitionFor(state,receipt){return encounterDefinitions(state).find(npc=>keyOf(npc)===receipt.civilianKey);}
function acknowledgedDeath(state,receipt){
 const person=state.civilianState?.people?.[receipt.civilianKey],definition=definitionFor(state,receipt);
 return Boolean(person&&definition&&person.npcId===definition.id&&isConductNoncombatant(definition)&&deathMatches({...definition,...person.health},receipt));
}
function deathProof(state,snapshot,receipt,request,{acknowledged=false}={}){
 const initial=request.npcs?.find(npc=>keyOf(npc)===receipt.civilianKey),dead=snapshot.npcs?.find(npc=>keyOf(npc)===receipt.civilianKey);
 const definition=definitionFor(state,receipt);
 need(definition&&isConductNoncombatant(definition)&&initial&&initial.id===definition.id&&initial.operativeId===definition.operativeId&&initial.contentId===definition.contentId&&isConductNoncombatant(initial)&&isConductNoncombatant(dead)&&deathMatches(dead,receipt));
 need(acknowledged?acknowledgedDeath(state,receipt):(initial.hp??100)>0);
 const original=[...(request.squad??[]),...(request.garrison??[]),...(request.missionAllies??[])].find(actor=>String(actor.id)===receipt.attackerId),actual=snapshot.units?.find(actor=>String(actor.id)===receipt.attackerId);
 need(original?.hp>0&&!original.militia&&original.side!=='enemy'&&actual?.side==='player'&&!actual.militia);
}
function validateSnapshot(state,snapshot,roster,request,authority){
 need(request&&Array.isArray(snapshot?.units));validateConductObservers(snapshot);
 need(same(snapshot.conductObserverIds,issueConductObservers(request.squad??[]).conductObserverIds));
 if(snapshot.conductObserverIds!==undefined){
  const definitions=encounterDefinitions(state);
  for(const initial of request.npcs??[]){
   const definition=definitions.find(npc=>npc.id===initial.id),actual=snapshot.npcs?.find(npc=>npc.id===initial.id);
   // Prisoners and mission contacts cannot be noncombatants for this rule.
   const expected=definition?.noncombatant;
   need(initial.noncombatant===expected&&actual&&actual.noncombatant===expected);
  }
 }
 for(const issued of request.squad??[]){
  const actor=snapshot.units.find(unit=>unit.side==='player'&&String(unit.id)===String(issued.id)),operative=roster.find(op=>op.id===Number(issued.id));need(actor&&operative);pinned(operative,actor);
  retains(state.operativeState?.[operative.id],actor);retains(issued,actor);
  retains(authority?.units?.find(unit=>unit.side==='player'&&String(unit.id)===String(issued.id)),actor);
  if(actor.serviceObjection!==undefined&&state.operativeState?.[operative.id]?.serviceObjection===undefined){need(snapshot.conductObserverIds?.includes(operative.id));deathProof(state,snapshot,actor.serviceObjection,request,{acknowledged:issued.serviceObjection!==undefined});}
 }
 for(const actor of snapshot.units.filter(unit=>!request.squad?.some(issued=>String(issued.id)===String(unit.id)))){
  validateServiceObjection(actor);if(actor.serviceObjection===undefined)continue;
  const operative=roster.find(op=>op.id===idOf(actor));need(operative&&actor.side==='player'&&!actor.militia);pinned(operative,actor);need(same(actor.serviceObjection,state.operativeState?.[operative.id]?.serviceObjection));
 }
}
export function validateServiceObjectionContext(state,snapshot,roster,request=state.pendingBattle){
 // A stored resume is itself admitted without using its own records as proof.
 // Only then may it require an ordinary successor to retain its receipt.
 const resume=request?.resumeSnapshot;
 if(resume)validateSnapshot(state,resume,roster,request,null);
 validateSnapshot(state,snapshot,roster,request,resume??null);
}
export function validateCampaignServiceObjections(state,roster){
 for(const operative of roster){
  const record=state.operativeState?.[operative.id];need(record);pinned(operative,record);
  if(record.serviceObjection!==undefined){
   need(acknowledgedDeath(state,record.serviceObjection));
  }
 }
 const request=state.pendingBattle;
 for(const issued of request?.squad??[]){
  const operative=roster.find(op=>op.id===Number(issued.id));need(operative);pinned(operative,issued);retains(state.operativeState?.[operative.id],issued);
  if(issued.serviceObjection!==undefined&&state.operativeState?.[operative.id]?.serviceObjection===undefined){
   need(issueConductObservers(request.squad).conductObserverIds?.includes(operative.id));
   need(acknowledgedDeath(state,issued.serviceObjection));
  }
 }
 for(const scene of [...Object.values(state.sectorStates??{}),...Object.values(state.sceneStates??{})])for(const actor of scene.units??[]){
  validateServiceObjection(actor);if(actor.serviceObjection===undefined)continue;
  const operative=roster.find(op=>op.id===idOf(actor));need(operative&&actor.side==='player'&&!actor.militia);pinned(operative,actor);
  const personal=state.operativeState?.[operative.id],issued=request?.squad?.find(unit=>String(unit.id)===String(actor.id));need(same(actor.serviceObjection,personal?.serviceObjection)||same(actor.serviceObjection,issued?.serviceObjection));
 }
 if(request?.resumeSnapshot)validateSnapshot(state,request.resumeSnapshot,roster,request,null);
}
export function retainServiceObjections(request,snapshot){
 for(const issued of request.squad??[]){const actual=snapshot.units.find(actor=>actor.side==='player'&&String(actor.id)===String(issued.id));if(actual?.serviceObjection!==undefined)issued.serviceObjection=structuredClone(actual.serviceObjection);}
}
export function returnServiceObjection(state,id,report){
 const personal=state.operativeState[id];retains(personal,report);if(report.serviceObjection!==undefined)personal.serviceObjection=structuredClone(report.serviceObjection);
}
export function hasPendingServiceObjections(state,snapshot){
 return (snapshot?.units??[]).some(actor=>actor.side==='player'&&actor.serviceObjection!==undefined&&(!same(actor.serviceObjection,state.pendingBattle?.squad?.find(unit=>String(unit.id)===String(actor.id))?.serviceObjection)||!same(actor.serviceObjection,state.operativeState?.[Number(actor.id)]?.serviceObjection)));
}
export function serviceObjectionReason(state,operative){
 if(!operative||!explicit(operative))return null;
 const receipt=state?.operativeState?.[operative.id]?.serviceObjection??state?.pendingBattle?.squad?.find(unit=>String(unit.id)===String(operative.id))?.serviceObjection;
 return receipt?`${operative.name} no acepta contratarse ni renovar después de presenciar la muerte intencional de un civil no combatiente. Cumplirá el plazo ya pagado.`:null;
}
export function receiveServiceObjectionCorrespondence(state,operative){
 const record=state.operativeState?.[operative?.id],contract=state.contracts?.[operative?.id],now=state.hour*3600+(state.secondOfHour??0),expiry=contract?.expiresAt==null?null:contract.expiresAt*3600+(contract.expiresSecond??0);
 if(!operative||!explicit(operative)||!record?.serviceObjection||!state.recruited?.includes(operative.id)||record.alive!==true||!capable({...record,side:'player'})||!contract||expiry!==null&&expiry<=now)return null;
 const id=`service-objection:${operative.id}`;if(state.correspondence?.some(message=>message.id===id))return null;
 const person=state.civilianState?.people?.[record.serviceObjection.civilianKey],victim=person&&encounterDefinitions(state).find(npc=>npc.id===person.npcId);need(victim&&acknowledgedDeath(state,record.serviceObjection));
 receiveCorrespondence(state,{id,sender:operative.name,subject:'Una objeción al mando',text:`Vi la muerte de ${victim.name}. No acepto esa orden. Cumpliré el plazo pagado, pero no aceptaré otro contrato.`});
 return id;
}
