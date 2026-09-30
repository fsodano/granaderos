import {AMMUNITION_TYPES,isAmmunitionStack,validateAmmunitionStack} from './ammunition-types.js';
import {canonicalAmmunitionType,LEGACY_AMMUNITION,legacyWeaponAmmoType} from './ammunition-families.js';

const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const need=(ok,message)=>{if(!ok)throw Error(message);};
const quantity=n=>Number.isSafeInteger(n)&&n>=0&&n<=1e9;
export function groupAmmunitionCounts(counts) {
  need(object(counts),'La cuenta antigua de munición no es válida.');
  const result={};
  for(const [old,n]of Object.entries(counts)){
    const type=canonicalAmmunitionType(old);need(type&&quantity(n),'La cuenta antigua de munición no es válida.');
    result[type]=(result[type]??0)+n;need(quantity(result[type]),'La cuenta agrupada de munición supera el límite.');
  }
  return result;
}
export function groupAmmunitionResources(resources) {
  need(object(resources),'La reserva antigua de munición no es válida.');
  const next={...resources};
  for(const [old]of Object.entries(LEGACY_AMMUNITION)){
    const key=old==='musket_75'?'cartridges':`ammo_${old}`,type=canonicalAmmunitionType(old),target=type==='musket_75'?'cartridges':`ammo_${type}`;
    if(!Object.hasOwn(resources,key))continue;
    need(quantity(resources[key]),'La reserva antigua de munición no es válida.');
    if(key===target)continue;
    need(next[target]===undefined||quantity(next[target]),'La reserva antigua de munición no es válida.');
    next[target]=(next[target]??0)+resources[key];need(quantity(next[target]),'La reserva agrupada de munición supera el límite.');delete next[key];
  }
  return next;
}
export function groupAmmunitionStack(stack) {
  if(!isAmmunitionStack(stack))return stack;
  const type=canonicalAmmunitionType(stack.ammoType);need(type,'El tipo antiguo de munición no es válido.');
  const next={...stack,ammoType:type};
  if(stack.name===LEGACY_AMMUNITION[stack.ammoType].name)next.name=AMMUNITION_TYPES[type].name;
  validateAmmunitionStack(next);return next;
}
export function legacyReserveTotal(unit) {
  return Object.values(unit.inventory??{}).reduce((sum,stack)=>sum+(isAmmunitionStack(stack)?groupAmmunitionStack(stack).count:0),0);
}
export function legacyCompatibleReserve(unit,weapon=unit.weapon) {
  const type=legacyWeaponAmmoType(weapon);let count=0;
  for(const stack of Object.values(unit.inventory??{}))if(isAmmunitionStack(stack)){
    groupAmmunitionStack(stack);if(stack.ammoType===type)count+=stack.count;
  }
  return count;
}
// Keep physical keys and placement references. Two old lots that now share a
// family remain two lots, including custom names, identities and cursor custody.
export function groupUnitAmmunition(unit) {
  need(object(unit)&&unit.ammunitionVersion===1,'La versión antigua de munición no es válida.');
  need(unit.inventory===undefined||object(unit.inventory),'El inventario antiguo no es válido.');
  need(unit.ammo===undefined||unit.ammo===legacyCompatibleReserve(unit),'La reserva antigua no coincide con su inventario.');
  const next={...unit,inventory:Object.fromEntries(Object.entries(unit.inventory??{}).map(([key,stack])=>[key,groupAmmunitionStack(stack)]))};
  if(unit.equipmentCursor)next.equipmentCursor={...unit.equipmentCursor,stack:groupAmmunitionStack(unit.equipmentCursor.stack)};
  return next;
}
export function groupSceneAmmunition(scene) {
  if(!scene)return;
  for(const key of ['groundItems','droppedWeapons'])if(Array.isArray(scene[key]))scene[key]=scene[key].map(groupAmmunitionStack);
  for(const owner of [...(scene.props??[]),...(scene.tiles??[]),...(scene.npcs??[])]){
    for(const key of ['contents','questGifts'])if(Array.isArray(owner[key]))owner[key]=owner[key].map(groupAmmunitionStack);
  }
  for(const key of ['issuedAmmunition','fieldAmmunition','creditedAmmunition'])if(scene[key]!==undefined)scene[key]=groupAmmunitionCounts(scene[key]);
  if(scene.returnLedger?.creditedAmmunition)scene.returnLedger.creditedAmmunition=groupAmmunitionCounts(scene.returnLedger.creditedAmmunition);
  for(const key of ['ammunitionSources','garrisonLootSources','casualtyLootSources'])for(const source of scene[key]??[])if(source.ammunitionByType!==undefined)source.ammunitionByType=groupAmmunitionCounts(source.ammunitionByType);
}

export function groupAmmunitionNotices(state) {
 for(const event of state.logisticsNotice?.events??[])if(event.goods)event.goods=groupAmmunitionResources(event.goods);
 if(state.logisticsAttention?.reported){
  const grouped={};
  for(const [binding,code]of Object.entries(state.logisticsAttention.reported)){
   const parts=JSON.parse(binding);need(Array.isArray(parts)&&parts.length===4&&JSON.stringify(parts)===binding,'El aviso antiguo de munición no es válido.');
   need(Number.isInteger(parts[1])&&parts[1]>=0&&parts[1]<=999,'El índice del aviso antiguo no es válido.');
   if(parts[2]?.goods)parts[2].goods=groupAmmunitionResources(parts[2].goods);
   let next=JSON.stringify(parts);while(Object.hasOwn(grouped,next)){parts[1]++;need(parts[1]<=999,'Demasiados avisos agrupados de munición.');next=JSON.stringify(parts);}
   grouped[next]=code;
  }
  state.logisticsAttention.reported=grouped;
 }
}
