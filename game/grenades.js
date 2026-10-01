// Historical form, authored game balance: no modern fragmentation, incendiary
// or chemical variants and no implicit issue to a new recruit.
export const GRENADE_TYPES=Object.freeze({
 arsenal:Object.freeze({id:'arsenal',name:'Granada de arsenal',weight:1,stackLimit:2}),
});
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const need=(ok,message)=>{if(!ok)throw Error(message);};
export const isGrenadeStack=value=>object(value)&&value.kind==='grenade';
export function validateGrenadeStack(stack){
 if(!isGrenadeStack(stack))return false;
 const spec=typeof stack.grenadeType==='string'&&Object.hasOwn(GRENADE_TYPES,stack.grenadeType)?GRENADE_TYPES[stack.grenadeType]:null;
 need(spec,'El tipo de granada no es válido.');
 need(Number.isSafeInteger(stack.count)&&stack.count>=0&&stack.count<=1000000,'La cantidad de granadas no es válida.');
 need(stack.weight===spec.weight,'El peso de la granada no es válido.');
 need(typeof stack.name==='string'&&stack.name.trim().length>0&&stack.name.length<=100&&!/[<>\x00-\x1f]/u.test(stack.name),'El nombre de la granada no es válido.');
 need(typeof stack.condition==='number'&&Number.isFinite(stack.condition)&&stack.condition>=0&&stack.condition<=100,'La condición de la granada no es válida.');
 need(Object.keys(stack).every(key=>!['__proto__','constructor','prototype'].includes(key)),'Los datos de la granada no son válidos.');
 need(['weapon','loaded','reloadProgress','loadedAmmoType','reloadAmmoType','ammoType','jammed','fittings','fittingPattern','toolKey','itemType','outfit','damage','radius','blastDamage','blastRadius','fuse','fuseSeconds'].every(key=>stack[key]===undefined),'La granada no puede contener datos de otro equipo o modificar la explosión.');
 if(stack.instanceId!==undefined)need(typeof stack.instanceId==='string'&&stack.instanceId.length>0&&stack.instanceId.length<=100&&!/[<>\x00-\x1f]/u.test(stack.instanceId)&&!['__proto__','constructor','prototype'].includes(stack.instanceId)&&stack.count<=1,'Una granada identificada debe conservarse por separado.');
 return true;
}
export function makeGrenadeStack(grenadeType='arsenal',count=1,metadata={}){
 need(typeof grenadeType==='string'&&Object.hasOwn(GRENADE_TYPES,grenadeType),'El tipo de granada no es válido.');
 need(object(metadata),'Los datos de la granada no son válidos.');
 const spec=GRENADE_TYPES[grenadeType],stack={...structuredClone(metadata),kind:'grenade',grenadeType,count,weight:spec.weight,name:metadata.name??spec.name,condition:metadata.condition??100};
 validateGrenadeStack(stack);return stack;
}
