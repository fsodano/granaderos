import {CRITICAL_HEALTH,isUnconscious} from './actor-condition.js';
export {CRITICAL_HEALTH} from './actor-condition.js';
export const isCivilianUnconscious=isUnconscious;

// One loaded civilian phase. Waking cannot heal wounds, move the actor, grant
// combat AP or resume an expired/departed presence. Unloaded breath does not tick.
export const CIVILIAN_BREATH_RECOVERY=10;
export function recoverCivilianBreath(npc){
 if(npc.civilianHealthVersion!==1||npc.hp<=0||npc.departure)return;
 npc.energy=Math.min(100,npc.energy+CIVILIAN_BREATH_RECOVERY);
 npc.unconscious=isUnconscious(npc);
}


const need=(ok,message)=>{if(!ok)throw Error(message);};
const unknownOrigin=()=>({attackerId:null,side:'unknown',militia:false,intentional:false});

// Historical harm receipts retain their original HP values. This version
// identifies the current physical scale, not a rewrite of those receipts.
export const civilianMaxHp=npc=>npc?.maxHp??100;
export const civilianRestoredHp=npc=>npc?.civilianFirstAid?.hpRestored??0;
export function validateCivilianHealth(npc){
 const maxHp=civilianMaxHp(npc),hp=npc.hp??maxHp;
 need(Number.isInteger(maxHp)&&maxHp>0&&maxHp<=100&&Number.isFinite(hp)&&hp>=0&&hp<=maxHp,'La escala de salud civil no es válida.');
 if(npc.maxHp!==undefined||npc.civilianHealthVersion!==undefined)need(npc.civilianHealthVersion===1&&npc.maxHp!==undefined,'La versión de salud civil no es válida.');
 if(npc.civilianHealthVersion===1){
  need(Number.isFinite(npc.energy)&&npc.energy>=0&&npc.energy<=100,'La energía civil no es válida.');
  need(typeof npc.unconscious==='boolean'&&npc.unconscious===isUnconscious(npc),'La consciencia civil no coincide con su salud.');
 }
 if(npc.civilianFirstAid!==undefined){
  const aid=npc.civilianFirstAid;
  need(hp<=Math.min(CRITICAL_HEALTH,maxHp),'La estabilización civil supera el límite crítico.');
  need(aid&&typeof aid==='object'&&!Array.isArray(aid)&&Object.keys(aid).length===2&&aid.version===1&&Object.hasOwn(aid,'hpRestored')&&Number.isFinite(aid.hpRestored)&&aid.hpRestored>0&&aid.hpRestored<=1e7&&npc.civilianWoundVersion===1,'La estabilización civil no es válida.');
 }
 return npc;
}

export function seedCivilianHealth(npc,service){
 const maxHp=service?.maxHp??100,hp=service?.hp??maxHp,energy=service?.energy??100;
 const result={...npc,civilianHealthVersion:1,maxHp,hp,energy,unconscious:isUnconscious({hp,energy})};
 if(service&&(hp<maxHp||(service.bleeding??0)>0)){
  // A former soldier's injury has no civilian responsibility receipt. Its
  // unknown origin prevents an invented accusation if it later proves fatal.
  if(hp>0){result.civilianWoundVersion=1;result.bleeding=service.bleeding??0;result.bandaged=Math.min(service.bandaged??0,maxHp-hp);if(result.bleeding)result.bleedSource=unknownOrigin();}
 }
 return result;
}

export function migrateCivilianHealth(npc,service,{currentContact=true}={}){
 if(npc.civilianHealthVersion!==undefined||npc.maxHp!==undefined)return validateCivilianHealth(npc);
 const oldHp=npc.hp??100;
 need(Number.isFinite(oldHp)&&oldHp>=0&&oldHp<=100,'La salud civil anterior no es válida.');
 const maxHp=service?.maxHp??100;
 let hp=oldHp>0?(service?Math.max(1,Math.ceil(maxHp-(100-oldHp))):oldHp):0;
 if(service&&currentContact)hp=Math.min(hp,service.hp);
 const energy=Math.min(npc.energy??100,currentContact?service?.energy??100:100);
 Object.assign(npc,{civilianHealthVersion:1,maxHp,hp,energy,unconscious:isUnconscious({hp,energy})});
 if(npc.civilianWoundVersion===1){npc.bandaged=Math.min(npc.bandaged??((npc.bleeding??0)>0?0:100-oldHp),maxHp-hp);}
 else if(service&&currentContact&&hp>0&&(service.bleeding??0)>0){
  npc.civilianWoundVersion=1;npc.bleeding=service.bleeding??0;npc.bandaged=Math.min(service.bandaged??0,maxHp-hp);
  if(npc.bleeding)npc.bleedSource=unknownOrigin();
 }
 if(hp<=0){if(npc.bleeding!==undefined)npc.bleeding=0;delete npc.bleedSource;}
 return validateCivilianHealth(npc);
}
