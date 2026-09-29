// Gameplay families deliberately group historical calibers. No loose ignition kit is tracked.
export const AMMO_TYPES=Object.freeze({
 ammoMusket:Object.freeze({name:'Cartuchos de mosquete',art:'/art/supplies/ammo-v1.webp',description:'Munición para mosquetes y tercerolas.',weapons:[1800,1801,1803]}),
 ammoRifle:Object.freeze({name:'Munición de fusil',art:'/art/supplies/ammo-rifle-v1.webp',description:'Bala con parche para fusiles de precisión.',weapons:[1802]}),
 ammoPistol:Object.freeze({name:'Cartuchos de pistola',art:'/art/supplies/ammo-pistol-v1.webp',description:'Munición para pistolas de uno o dos cañones.',weapons:[1805,1806,1808]}),
 ammoShot:Object.freeze({name:'Cargas de perdigones',art:'/art/supplies/ammo-shot-v1.webp',description:'Munición de perdigones para escopetas y trabucos.',weapons:[1804,1807]}),
});
export const AMMO_KEYS=Object.freeze(Object.keys(AMMO_TYPES));
export function ammoTypeFor(value){
 const raw=typeof value==='object'&&value!==null?value.weapon??value.primary??value.template??value.id:value;
 const id=typeof raw==='object'?raw.id:raw;
 const fallback=AMMO_KEYS.find(key=>AMMO_TYPES[key].weapons.includes(id))??null;
 if(!fallback)return null;
 const definition=value?.contentWeapon??value?.weaponMetadata?.contentWeapon??value;
 const authored=definition?.ammunitionFamily;
 return authored===undefined?fallback:Object.hasOwn(AMMO_TYPES,authored)?authored:null;
}
export function ammoStock(unit){
 if(unit?.ammunition!==undefined)return {...unit.ammunition};
 // Unarmed legacy carriers keep their cartridges as musket ammunition.
 return {[ammoTypeFor(unit)??'ammoMusket']:unit?.ammo??0};
}
export function ammoCount(unit,key=ammoTypeFor(unit)){return key?(ammoStock(unit)[key]??0):0;}
export function totalAmmo(unit){return Object.values(ammoStock(unit)).reduce((sum,n)=>sum+n,0);}
export function normalizeAmmo(unit){
 const legacy=unit.ammunition===undefined;unit.ammunition=ammoStock(unit);unit.ammo=totalAmmo(unit);
 if(legacy&&Array.isArray(unit.pocketOrder))unit.pocketOrder=unit.pocketOrder.filter(p=>!['priming','flints'].includes(p.item)).map(p=>p.item==='ammo'?{...p,item:ammoTypeFor(unit)??'ammoMusket'}:p);
 delete unit.priming;delete unit.flints;
 return unit;
}
export function changeAmmo(unit,key,delta){
 if(!Object.hasOwn(AMMO_TYPES,key))throw Error('El tipo de munición no es válido.');
 const next=ammoCount(unit,key)+delta;
 if(!Number.isSafeInteger(next)||next<0||next>1000000)throw Error('La cantidad de munición no es válida.');
 unit.ammunition={...ammoStock(unit),[key]:next};unit.ammo=totalAmmo(unit);
}
export function validateAmmo(unit){
 if(unit.ammunition!==undefined){
  const stock=unit.ammunition;
  if(!stock||typeof stock!=='object'||Array.isArray(stock)||Object.entries(stock).some(([key,n])=>!Object.hasOwn(AMMO_TYPES,key)||!Number.isSafeInteger(n)||n<0||n>1000000))throw Error('La reserva de munición no es válida.');
  if(unit.ammo!==undefined&&unit.ammo!==totalAmmo(unit))throw Error('El total de munición no coincide con sus tipos.');
 }
 normalizeAmmo(unit);
}
export function supplyCount(unit,key){return Object.hasOwn(AMMO_TYPES,key)?ammoCount(unit,key):key==='ammo'?ammoCount(unit):unit?.[key]??0;}
export function changeSupply(unit,key,delta){
 if(key==='ammo')key=ammoTypeFor(unit)??'ammoMusket';
 if(Object.hasOwn(AMMO_TYPES,key))changeAmmo(unit,key,delta);
 else unit[key]=(unit[key]??0)+delta;
}

export function migrateAmmoGround(items=[]){
 return items.filter(g=>!['priming','flints'].includes(g.type)).map(g=>g.type==='ammo'?{...g,type:'ammoMusket'}:g);
}

export function ammunitionForWeapon(value){return AMMO_TYPES[ammoTypeFor(value)]??null;}

// Preserve immutable authored packages; remove obsolete mutable kit counters only.
export function removeIgnitionSupplies(value){
 if(!value||typeof value!=='object')return value;
 delete value.priming;delete value.flints;
 for(const [key,child]of Object.entries(value))if(!['contentCampaign','startingSupplies'].includes(key))removeIgnitionSupplies(child);
 return value;
}

// Strategic ammunition owners also exist outside the loaded scene. Inspect the
// known record collections; inventory keys and authored data are not unit fields.
export function validateStoredAmmo(state){
 const values=value=>value&&typeof value==='object'?Object.values(value):[];
 const list=value=>Array.isArray(value)?value:[];
 const request=state.pendingBattle;
 const records=[...values(state.operativeState),...values(state.missionAllies),
  ...values(state.garrisons).flatMap(list),
  ...list(state.militiaTraining).flatMap(course=>list(course?.trainees)),
  ...['squad','garrison','missionAllies','enemies','ammunitionSources','garrisonLootSources','casualtyLootSources'].flatMap(key=>list(request?.[key]))];
 for(const record of records){
  if(!record||typeof record!=='object'||!Object.hasOwn(record,'ammunition'))continue;
  if(!Number.isSafeInteger(record.ammo))throw Error('El total de munición guardado no es válido.');
  validateAmmo({...record});
 }
}
