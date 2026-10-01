import {OPERATIVES} from './data.js';
import {CIVIC_RECRUITS} from './civic-recruits.js';
import {authoredRoster} from './content-roster.js';
import {weaponRecord,weaponSpecification,validateWeaponCarrier,setWeaponDefinition,validateWeaponReferences} from './weapon-definition.js';
import {canonicalContent} from './content-identity.js';
const need=(ok)=>{if(!ok)throw Error('Las armas del habitante no coinciden con su equipo.');};
export const civilianWeaponSlots=['primary','blade'];
export function civilianWeaponsFor(s,id){
 const base=authoredRoster(s,[...OPERATIVES,...CIVIC_RECRUITS]).find(o=>o.id===id),record=s.operativeState[id];
 if(!base||!record||record.serviceEquipmentReturn)return {version:1,primary:null,blade:null};
 const carrier={...base,...record,...s.loadouts[id],loaded:record.carriedLoaded??0,...(record.carriedReloadProgress?{reloadProgress:record.carriedReloadProgress}:{})};
 return {version:1,primary:carrier.weapon?weaponRecord(carrier):null,blade:carrier.blade?weaponRecord(carrier,'blade'):null};
}
export function validateCivilianWeapons(value){
 need(value&&typeof value==='object'&&Object.keys(value).length===3&&value.version===1&&civilianWeaponSlots.every(k=>Object.hasOwn(value,k)));
 for(const slot of civilianWeaponSlots){const gun=value[slot];if(gun===null)continue;
  need(gun&&typeof gun==='object'&&gun.count===1&&Number.isFinite(gun.weight)&&gun.weight>=0&&gun.weight<=30&&weaponSpecification(gun)&&Number.isInteger(gun.loaded)&&gun.loaded>=0&&gun.loaded<=(weaponSpecification(gun).capacity??0)&&Number.isFinite(gun.condition)&&gun.condition>=0&&gun.condition<=100);
  need(Object.keys(gun).every(k=>['count','weapon','weight','loaded','condition','jammed','reloadProgress','contentWeapon','ammunitionChoice'].includes(k)));
  if(slot==='blade')need(gun.weapon>=1809&&gun.weapon<=1813);
  validateWeaponCarrier(gun);
 }
}
export function acknowledgeCivilianWeapons(s,id,previous,n){
 n.civilianWeapons??=structuredClone(previous.civilianWeapons);
 validateCivilianWeapons(n.civilianWeapons);validateWeaponReferences(s,n.civilianWeapons);
 for(const slot of civilianWeaponSlots){const before=previous.civilianWeapons[slot],after=n.civilianWeapons[slot];
  need(after===null||canonicalContent(after)===canonicalContent(before));
  if(before&&!after){
   need(id!==undefined&&s.operativeState[id]);
   const record=s.operativeState[id],key=slot==='primary'?'weapon':'blade';
   s.loadouts[id]={...s.loadouts[id],[key]:0};
   setWeaponDefinition(record,{},slot);
   if(slot==='primary'){record.carriedLoaded=0;delete record.carriedReloadProgress;record.jammed=false;}
   // Each acknowledged source can leave this resident once during this scene.
   s.pendingBattle.civilianWeaponRecoveries??=[];
   s.pendingBattle.civilianWeaponRecoveries.push({npcId:n.id,slot,gun:structuredClone(before)});
  }
 }
}
export function validateCivilianWeaponRecoveries(s){
 const records=s.pendingBattle?.civilianWeaponRecoveries;if(records===undefined)return;
 need(Array.isArray(records)&&records.length<=4000);const keys=new Set();
 for(const r of records){need(r&&Object.keys(r).length===3&&typeof r.npcId==='string'&&civilianWeaponSlots.includes(r.slot));need(Object.values(s.civilianState.people).some(p=>p.npcId===r.npcId));const key=`${r.npcId}:${r.slot}`;need(!keys.has(key));keys.add(key);validateCivilianWeapons({version:1,primary:null,blade:null,[r.slot]:r.gun});validateWeaponReferences(s,r.gun);}
}
