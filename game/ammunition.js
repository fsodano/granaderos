import {WEAPONS} from './data.js';

// Ammunition already on the field is separate from newly issued cartridges.
// Count loose rounds and charges in finite ground weapons and containers.
export function fieldAmmunition(snapshot){
 const rounds=stack=>stack.item==='ammo'?stack.count??0:stack.weapon!==undefined?(stack.loaded??0)*(stack.count??1):0;
 return (snapshot?.groundItems??[]).reduce((sum,g)=>sum+(g.heldBy?0:rounds(g)),0)
  +(snapshot?.droppedWeapons??[]).reduce((sum,g)=>sum+(g.taken?0:g.loaded??0),0)
  +[...(snapshot?.props??[]),...(snapshot?.tiles??[])].reduce((sum,c)=>sum+(c.contents??[]).reduce((n,item)=>n+rounds(item),0),0);
}
export function storedWeaponAmmunition(units){
 return units.reduce((total,u)=>total+Object.values(u.inventory??{}).reduce((sum,item)=>sum+(item?.weapon!==undefined?(item.loaded??0)*(item.count??1):0),0),0);
}
const recoveredEquipmentAmmunition=(request,snapshot)=>{
 const ids=new Set((request.squad??[]).map(u=>String(u.id))),carriers=(snapshot?.units??[]).filter(u=>u.side==='player'&&ids.has(String(u.id)));
 // Net the field and the squad's pack charges together: moving a loaded gun
 // between them cannot produce another cartridge allowance.
 return Math.max(0,(request.fieldCartridges??0)+(request.storedCartridges??0)-fieldAmmunition(snapshot)-storedWeaponAmmunition(carriers));
};

export function returnAmmunition(request,reports,snapshot){
 let looted=snapshot?recoveredEquipmentAmmunition(request,snapshot):0;
 if(snapshot){
  for(const source of [...(request.garrison??[]),...(request.garrisonLootSources??[]),...(request.missionAllies??[])]){const current=snapshot.units.find(u=>(u.militia||u.missionAlly)&&String(u.id)===String(source.id));if(current&&(current.hp<=0||current.unconscious||current.routed))looted+=Math.max(0,(source.ammo??0)+(source.loaded??0)-(current.ammo??0)-(current.loaded??0));}
  for(const source of request.ammunitionSources??request.enemies??[]){const current=snapshot.units.find(u=>u.side==='enemy'&&String(u.id)===String(source.id));if(current&&(current.hp<=0||current.unconscious||current.routed))looted+=Math.max(0,(source.ammo??12)-(current.ammo??0));}
 }
 let returned=0;
 for(const report of reports){
  if(report.hp<=0)continue;
  const issued=request.squad.find(o=>o.id===Number(report.id));if(!issued)continue;
  const count=Math.max(0,Math.floor(report.loaded??0))+Math.max(0,Math.floor(report.ammo??0));if(!Number.isFinite(count)||count>100000)throw Error('La munición del parte es inválida.');
  if(snapshot&&report.loaded!==undefined&&report.ammo!==undefined){const actual=snapshot.units.find(u=>u.side==='player'&&Number(u.id)===Number(report.id));if(actual&&(Number(actual.loaded??0)!==Number(report.loaded??0)||Number(actual.ammo??0)!==Number(report.ammo??0)))throw Error('El parte de munición no coincide con el sector.');}
  returned+=Math.min(count,(issued.loaded??0)+(issued.ammo??0)+looted);
 }
 return Math.min((request.issuedCartridges??0)+looted,returned);
}

// One shared ceiling applies to every destination. Captive ammunition remains
// with its owner and must not enter the campaign cartridge reserve on this return.
export function planReturnAmmunition(request,snapshot,entries){
 let loot=recoveredEquipmentAmmunition(request,snapshot);const seen=new Set();
 for(const source of [...(request.garrison??[]),...(request.garrisonLootSources??[]),...(request.missionAllies??[]),...(request.casualtyLootSources??[])]){
  const key=`player:${source.id}`;if(seen.has(key))continue;seen.add(key);
  const u=snapshot.units.find(u=>u.side==='player'&&String(u.id)===String(source.id));if(u)loot+=Math.max(0,(source.ammo??0)+(source.loaded??0)-(u.ammo??0)-(u.loaded??0));
 }
 for(const source of request.ammunitionSources??request.enemies??[]){const key=`enemy:${source.id}`;if(seen.has(key))continue;seen.add(key);const u=snapshot.units.find(u=>u.side==='enemy'&&String(u.id)===String(source.id));if(u&&(u.hp<=0||u.unconscious||u.routed||u.surrendered)){const loaded=source.loaded??WEAPONS[source.weapon??source.primary??1800]?.capacity??0;loot+=Math.max(0,(source.ammo??12)+loaded-(u.ammo??0)-(u.loaded??0));}}
 const custody={},carried={},returned=entries.reduce((sum,e)=>{
  const u=snapshot.units.find(u=>u.side==='player'&&String(u.id)===e.unitId),rounds=(u.loaded??0)+(u.ammo??0);
  if(!Number.isSafeInteger(rounds)||rounds<0||rounds>100000)throw Error('La munición del parte es inválida.');
  const preserveLoading=!u.weaponDropped&&WEAPONS[u.weapon]?.capacity>0&&request.squad.find(source=>String(source.id)===e.unitId)?.preserveLoading===true;
  const loading=preserveLoading?{loaded:u.loaded,...(u.reloadProgress?{reloadProgress:u.reloadProgress}:{})}:null;
  if(e.kind==='captured')custody[e.unitId]={loaded:u.loaded,ammo:u.ammo,...(loading?{preserveLoading:true,...(u.reloadProgress?{reloadProgress:u.reloadProgress}:{})}:{})};
  if(loading&&['resident','departed'].includes(e.kind))carried[e.unitId]=loading;
  return sum+(['resident','departed'].includes(e.kind)?rounds:0);
 },0);
 const allowance=Math.min((request.issuedCartridges??0)+loot,returned),retained=Object.values(carried).reduce((sum,u)=>sum+u.loaded,0);
 if(retained>allowance)throw Error('La carga conservada supera la munición del despliegue.');
 return {creditedCartridges:allowance-retained,custody,carried};
}
