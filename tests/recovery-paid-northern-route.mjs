import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor,civicStatus,firearmRepairCost,isSupplied,incomeSummary} from '../game/campaign.js';
import {contractQuote} from '../game/contracts.js';
import {equipmentCatalogItem} from '../game/equipment-catalog.js';
import {ammunitionUnitPrice} from '../game/ammunition-market-rules.js';
import {careRules} from '../game/campaign-care-rules.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {readItemStack,inventoryUsage} from '../game/tactical-inventory.js';
import {availableAmmunition} from '../game/ammunition-types.js';
import {carriedAmmunition} from '../game/campaign-ammunition.js';
import {ammoTypeFor,ammoCount} from '../game/ammo-types.js';
import {AMMUNITION_FAMILIES} from '../game/ammunition-families.js';
import {doctorRate} from '../game/medical-care.js';
import {artillerySupplyPreview} from '../game/campaign-artillery.js';
import {BLADES,actBattle,getReachable,artilleryCrewPlan,artilleryCosts,artilleryReloadPreview,planReadyMainHand} from '../game/tactical.js';
import {enterSector} from '../game/world.js';
import {playerKnownBattle} from '../game/player-known-state.js';
import {syncBattleTime} from '../game/time.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';
import {prepareFinalAssault} from './final-campaign-route.mjs';
import {fightNorthernSector} from './northern-route.mjs';
import {prepareSurvivorHumahuaca} from './forward-survivor-final.mjs';
import {survivorBatteryController} from './forward-survivor-battery.mjs';
import {deployHighPassBattery} from './command-reserve-driver.mjs';
import {recoveryBronzeControls,recoveryJujuyControls} from './recovery-paid-battery-driver.mjs';
import {preparedDefenseZeroAidQuietSearch} from './recovery-jujuy-defense-driver.mjs';


const knownGroundRoutes=(b,u)=>{
 const known=playerKnownBattle(b),cells=new Set(known.tiles.filter(p=>!p.blocked&&(p.tacticalLevel??0)===0).map(p=>`${p.x},${p.y}`));
 const view={...b,tiles:known.tiles,props:known.props,npcs:known.npcs,upperSurfaces:known.upperSurfaces??[],climbLinks:known.climbLinks??[],units:b.units.filter(v=>v.side==='player'||known.units.some(w=>w.id===v.id))};
 return getReachable(view,u).filter(p=>(p.tacticalLevel??0)===0&&p.path.every(v=>(v.tacticalLevel??0)===0&&cells.has(`${v.x},${v.y}`)));
};

const FIELD=[0,5,123,128,138,142],HIGH_PASS_FIELD=[0,5,123,128,142];
const clone=c=>decodeSave(encodeSave(c)).campaign;
const clock=c=>({hour:c.hour,second:c.secondOfHour,treasury:c.resources.treasury});
const GEAR_FIELDS=['inventory','weaponDropped','carriedLoaded','carriedReloadProgress','ammunitionVersion','ammo','carriedAmmo','rations','torches','medkits','headwear','outfit','legwear','condition','bladeCondition','offHand','weaponFittings','weaponFittingPattern','bladeFittingPattern','equipmentCursor','activeItem','leftHandItem','toolkitPoints','boleadoras'];
const gear=(c,ids)=>Object.fromEntries(ids.map(id=>[id,{loadout:c.loadouts[id]??null,fields:Object.fromEntries(GEAR_FIELDS.map(key=>[key,c.operativeState[id][key]??null]))}]));

export function verifyRecoveryForward(c,start,deadline,{fieldIds=c.squad,front=null}={}){
 assert.ok(c.hour<=deadline,'the original prepaid forward deadline never resets');assert.equal(c.defeated,false);
 assert.ok(c.operativeState[57].alive&&!c.operativeState[57].captured);
 for(const[id,r]of Object.entries(start.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false,'every earlier actual death remains permanent');
 for(const id of fieldIds){const r=c.operativeState[id],q=c.contracts[id];assert.ok(r.alive&&!r.captured&&c.recruited.includes(id));assert.ok(q?.expiresAt==null||q.expiresAt>deadline,'actual paid terms cover the same absolute deadline');if(front)assert.equal(r.location,front);}
}

// Earn the complete quoted reserve before expensive service begins. The two
// bounded stages retain the accepted daily/expiry payment boundaries, actual
// naval occupations, original equipment, and quoted physician renewals.
export function earnRecoveryNorthernReserve(start,{report=()=>{}}={}){
 let c=clone(start);const original=clone(start),live=[0,5,123,57],initialGear=gear(c,live),begin=clock(c),events=[],payments=[],renewals=[];
 assert.equal(Object.values(c.operativeState).filter(r=>!r.alive).length,55,'the actual capital prefix retains every recorded casualty');
 assert.deepEqual(c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured).sort((a,b)=>a-b),[0,5,57,123]);
 const day=id=>contractQuote(c,rosterFor(c).find(op=>op.id===id),'day'),week=id=>contractQuote(c,rosterFor(c).find(op=>op.id===id),'week');
 for(const id of [128,138,142]){assert.ok(c.operativeState[id].alive&&!c.operativeState[id].captured&&!c.recruited.includes(id));assert.equal(day(id).available,true);}
 const guns=[['bronze4',6],['swivel',4],['field8',1]],gunCost=guns.reduce((n,[type,count])=>n+count*equipmentCatalogItem(type,c).price,0),dressings=careRules(c).dressingPrice,rounds=ammunitionUnitPrice(c,'cordoba','ammoMusket');
 const firstTarget=[128,138,142].reduce((n,id)=>n+2*week(id).price,0)+gunCost+60*dressings+96*rounds+2*week(123).price+2*day(138).price+6*150+4*10;
 const target=24*day(128).price+22*day(138).price+28*day(142).price+28*day(123).price+gunCost+120*dressings+288*rounds+36*20+18*10+6*150+16*10;
 assert.equal(firstTarget,65560);assert.equal(target,107436,'complete live quoted reserve');
 const protect=()=>{assert.ok(!c.pendingBattle&&!c.pendingEncounter&&!c.defeated,'real encounters cannot be suppressed');for(const id of live)assert.ok(c.operativeState[id].alive&&!c.operativeState[id].captured&&c.recruited.includes(id));for(const[id,r]of Object.entries(original.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);assert.deepEqual(gear(c,live),initialGear);};
 const order=action=>{const before=clock(c),priorLog=new Set(c.log.map(r=>JSON.stringify(r))),requestedIncome=incomeSummary(c),n=dispatchCampaign(c,action);assert.equal(n.lastError,null,JSON.stringify(action)+n.lastError);c=n;protect();const logs=c.log.filter(r=>!priorLog.has(JSON.stringify(r))),entry={action,before,after:clock(c),cashDelta:c.resources.treasury-before.treasury,requestedIncome,logs};events.push(entry);for(const row of logs){const m=row.text.match(/^Las estancias y aduanas aportaron (\d+) pesos a la tesorería\.$/);if(m)payments.push({hour:row.hour,amount:Number(m[1])});}return entry;};
 const ensureTerm=hours=>{const q=c.contracts[123];if(q.expiresAt<=c.hour+hours){const quote=week(123);assert.equal(quote.available,true);const entry=order({type:'renewContract',id:123,term:'week',expectedExpiresAt:q.expiresAt});assert.equal(-entry.cashDelta,quote.price);assert.equal(c.contracts[123].expiresAt,quote.expiresAt);renewals.push({hour:c.hour,price:quote.price,expiresAt:quote.expiresAt});}};
 const wait=hours=>{protect();ensureTerm(hours);order({type:'wait',hours});};
 ensureTerm(24);order({type:'assignCare',operativeId:57,assignment:'rest'});const returning=c.squads.find(q=>q.members.includes(123));assert.equal(returning.location,'buenos_aires');order({type:'selectSquad',id:returning.id});assert.deepEqual([...c.squad].sort((a,b)=>a-b),[0,5,123]);for(const operativeId of [0,5,123])if(c.operativeState[operativeId].assignment!=='active')order({type:'assignCare',operativeId,assignment:'active'});order({type:'travel',sector:'cordoba',queue:true,mode:'posta'});for(let h=0;h<48&&c.squads.find(q=>q.id===returning.id).journey;h++)wait(1);assert.ok(!c.squads.find(q=>q.id===returning.id).journey);for(const id of live)assert.equal(c.operativeState[id].location,'cordoba');for(const operativeId of live)order({type:'assignCare',operativeId,assignment:'rest'});c=clone(c);
 let stagnant=0;while(c.resources.treasury<firstTarget&&c.hour-begin.hour<1440){const hours=Math.max(1,Math.min(24-c.hour%24,c.contracts[123].expiresAt-c.hour,1440-(c.hour-begin.hour))),hour=c.hour;wait(hours);stagnant=c.hour===hour?stagnant+1:0;assert.ok(stagnant<=4);}
 c=clone(c);
 const earn=(amount,hoursBound)=>{const began=c.hour;let stalled=0;for(;;){if(c.resources.treasury>=amount){ensureTerm(96);if(c.resources.treasury>=amount)break;}const remaining=hoursBound-(c.hour-began);assert.ok(remaining>0,'bounded actual income must fund the quoted reserve');const hours=Math.min(24-c.hour%24,c.contracts[123].expiresAt-c.hour,remaining);assert.ok(hours>0);ensureTerm(hours);const hour=c.hour;order({type:'wait',hours});stalled=c.hour===hour?stalled+1:0;assert.ok(stalled<=4);}};
 earn(firstTarget,2400-(c.hour-begin.hour));c=clone(c);report({event:'recoveryFirstReserveEarned',campaign:c,target:firstTarget,events});earn(target,2520);
 assert.ok(c.contracts[123].expiresAt>c.hour+96);for(const id of live){const r=c.operativeState[id];assert.equal(r.hp,r.maxHp);assert.equal(r.bleeding,0);assert.equal(r.energy,100);assert.equal(r.fatigue,0);assert.equal(r.assignment,'rest');}
 assert.equal(c.resources.treasury,begin.treasury+payments.reduce((n,r)=>n+r.amount,0)-renewals.reduce((n,r)=>n+r.price,0)-10,'only real daily income, actual paid renewals and the physical trip change treasury');assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);report({event:'recoveryFullReserveEarned',campaign:c,target,events,payments,renewals});return c;
}

export function preparePaidRecoveryColumn(startCampaign,{report=()=>{}}={}){
const original=clone(startCampaign);
const selected=[128,138,142],targetMorale=50;

let c=decodeSave(encodeSave(original)).campaign;
const events=[],kit=[],oldDead=Object.entries(original.operativeState).filter(([,r])=>!r.alive).map(([id])=>Number(id)),retained=c.recruited.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured),start={hour:c.hour,second:c.secondOfHour,treasury:c.resources.treasury};
assert.deepEqual(retained,[0,57,5,123]);assert.ok(!c.pendingBattle&&!c.pendingEncounter);
const order=action=>{
 const before={hour:c.hour,second:c.secondOfHour,treasury:c.resources.treasury};
 const next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify({action,error:next.lastError}));c=next;
 events.push({action,before,after:{hour:c.hour,second:c.secondOfHour,treasury:c.resources.treasury},cost:before.treasury-c.resources.treasury});
 for(const id of oldDead)assert.equal(c.operativeState[id].alive,false,'each accepted earlier casualty remains dead');
 assert.ok(retained.every(id=>c.operativeState[id].alive),'each accepted survivor remains alive');
};
const model=id=>sectorInventoryModel(c,'cordoba',rosterFor(c),id);
const collect=(id,source,count)=>{
 const before={hour:c.hour,second:c.secondOfHour,treasury:c.resources.treasury};
 order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'take',sourceKey:source.key,expected:source.expected,count});
 const remaining=model(id).entries.find(row=>row.key===source.key)?.count??0;
 assert.equal(remaining,source.count-count);assert.deepEqual({hour:c.hour,second:c.secondOfHour,treasury:c.resources.treasury},before);
 const receipt={id,sourceKey:source.key,sourceCount:source.count,count,remaining,stack:{...JSON.parse(source.expected),count},...before};kit.push(receipt);return receipt;
};

 const commandSquad=c.squads.find(q=>q.members.includes(57));assert.ok(commandSquad);order({type:'selectSquad',id:commandSquad.id});assert.equal(c.location,'cordoba');
 const quotes=selected.map(id=>{const op=rosterFor(c).find(o=>o.id===id),status=civicStatus(c,id),r=c.operativeState[id],term='week';assert.equal(status.available,true,status.reason);assert.equal(r.hp,r.maxHp);return {id,term,medical:op.medical,marksmanship:op.marksmanship,startingMorale:r.morale,day:contractQuote(c,op,'day'),week:contractQuote(c,op,'week'),hire:contractQuote(c,op,term)};});
 for(const q of quotes.filter(q=>q.id===142)){const before=c.resources.treasury;order({type:'recruitCivic',id:q.id,term:q.term,destination:'cordoba'});assert.equal(c.resources.treasury,before-q.hire.price);assert.ok(c.recruited.includes(q.id));assert.equal(c.operativeState[q.id].location,'cordoba');assert.equal(c.contracts[q.id].expiresAt,c.hour+q.hire.hours);}
 const equipFiniteKit=id=>{
  order({type:'assignCare',operativeId:id,assignment:'active'});
  for(const slot of ['headwear','outfit','legwear','blade','primary']){
   const personal=model(id).personal;
   if(slot==='primary'&&personal.weapon&&!personal.weaponDropped)continue;
   if(slot==='blade'&&personal.blade)continue;
   if(!['primary','blade'].includes(slot)&&personal[slot]?.condition>0)continue;
   const matches=stack=>slot==='primary'?[1800,1801,1802].includes(stack.weapon)&&stack.condition>0:slot==='blade'?!!BLADES[stack.weapon]&&stack.condition>0:stack.kind==='outfit'&&stack.outfit===({headwear:'hat',outfit:'poncho',legwear:'trousers'})[slot]&&stack.condition>0;
   const source=model(id).entries.find(row=>row.reachable&&matches(JSON.parse(row.expected)));assert.ok(source,'actual finite local '+slot+' must be reachable for '+id);
   const receipt=collect(id,source,1),{item,...record}=receipt.stack;
   const carried=model(id).carried.find(row=>row.inventoryKey&&row.equip?.some(choice=>choice.slot===slot&&choice.valid)&&JSON.stringify(JSON.parse(row.expected))===JSON.stringify(record));assert.ok(carried,'the exact collected finite kit must be equipable');
   order({type:'sectorInventory',sector:'cordoba',operativeId:id,direction:'equip',inventoryKey:carried.inventoryKey,expected:carried.expected,slot});
   if(['primary','blade'].includes(slot))assert.deepEqual(readItemStack(model(id).personal,slot,1),{item:'weapon',...record});
   else assert.deepEqual(c.operativeState[id][slot],record);
  }
  for(const [item,target]of [['medkits',10],['rations',2]]){
   while(c.operativeState[id][item]<target){const source=model(id).entries.find(row=>row.reachable&&JSON.parse(row.expected).item===item);if(!source&&item==='medkits'){const quantity=target-c.operativeState[id][item],before={stock:c.merchants.cordoba.supplies.medkits,treasury:c.resources.treasury,count:c.operativeState[id].medkits};order({type:'purchaseMedicalSupplies',operativeId:id,quantity});assert.equal(c.merchants.cordoba.supplies.medkits,before.stock-quantity);assert.equal(c.operativeState[id].medkits,before.count+quantity);assert.equal(c.resources.treasury,before.treasury-quantity*10);break;}assert.ok(source,'finite local '+item+' must remain');collect(id,source,Math.min(source.count,target-c.operativeState[id][item]));}
  }
  while(availableAmmunition(model(id).personal,'musket_75')<16){const source=model(id).entries.find(row=>row.reachable&&JSON.parse(row.expected).ammoType==='musket_75');assert.ok(source,'finite local loose musket rounds must remain');collect(id,source,Math.min(source.count,16-availableAmmunition(model(id).personal,'musket_75')));}
 };
 for(const id of selected.filter(id=>c.recruited.includes(id)))equipFiniteKit(id);
 const front=[0,5,123],field=[...front,...selected];
 const frontOrigin=c.operativeState[front[0]].location;assert.ok(front.every(id=>c.operativeState[id].location===frontOrigin));
 order({type:'createSquad',name:'Regreso físico del puerto',ids:front,sector:frontOrigin});
 for(const operativeId of front)order({type:'assignCare',operativeId,assignment:'active'});
 if(frontOrigin!=='cordoba')order({type:'travel',sector:'cordoba',mode:'posta',queue:true});const returning=c.activeSquadId;
 order({type:'selectSquad',id:commandSquad.id});
 c=decodeSave(encodeSave(c)).campaign;
 for(const id of [57,...selected.filter(id=>c.recruited.includes(id))])order({type:'assignCare',operativeId:id,assignment:'rest'});
 let frontReady=false;const guns=[],needs={bronze4:6,swivel:4,field8:1};const moraleHours=id=>Math.max(0,(targetMorale-original.operativeState[id].morale)*6-(original.operativeState[id].moraleRestHours??0));const firstRest=moraleHours(142);const hireOffsets=Object.fromEntries(selected.map(id=>[id,Math.max(0,firstRest-moraleHours(id))]));
 const ordinaryJobs=()=>{
  if(!frontReady&&!c.squads.find(q=>q.id===returning).journey){
   for(const id of front){assert.equal(c.operativeState[id].location,'cordoba');equipFiniteKit(id);if(firearmRepairCost(c.operativeState[id]))order({type:'repairWeapon',operativeId:id});order({type:'assignCare',operativeId:id,assignment:'rest'});}frontReady=true;
  }
  for(const id of selected.filter(id=>!c.recruited.includes(id)&&c.hour-start.hour>=hireOffsets[id])){const q=contractQuote(c,rosterFor(c).find(o=>o.id===id),'week');assert.equal(q.available,true);const before=c.resources.treasury;order({type:'recruitCivic',id,term:'week',destination:'cordoba'});assert.equal(c.resources.treasury,before-q.price);assert.equal(c.contracts[id].expiresAt,c.hour+q.hours);equipFiniteKit(id);order({type:'assignCare',operativeId:id,assignment:'rest'});}for(const[type,target]of Object.entries(needs))if((c.armory[type]??0)<target&&c.merchants.cordoba.stock[type]){const stock=c.merchants.cordoba.stock[type],armory=c.armory[type]??0,money=c.resources.treasury;order({type:'purchaseEquipment',item:type});assert.equal(c.merchants.cordoba.stock[type],stock-1);assert.equal(c.armory[type],armory+1);guns.push({type,hour:c.hour,cost:money-c.resources.treasury,stockBefore:stock,stockAfter:stock-1});}
 };
 const renewFor=hours=>{for(const id of [...retained,...selected]){let contract=c.contracts[id];while(c.recruited.includes(id)&&contract?.expiresAt!=null&&contract.expiresAt<=c.hour+hours){const missing=c.hour+hours-contract.expiresAt;const quote=contractQuote(c,rosterFor(c).find(o=>o.id===id),'week');order({type:'renewContract',id,term:missing>=quote.hours?'week':'day',expectedExpiresAt:contract.expiresAt});contract=c.contracts[id];}}};
 const ready=()=>frontReady&&Object.entries(needs).every(([type,count])=>(c.armory[type]??0)>=count)&&selected.every(id=>c.recruited.includes(id))&&((c.hour+4)%24>=6&&(c.hour+4)%24<=12)&&field.every(id=>{const r=c.operativeState[id];return r.alive&&!r.captured&&r.hp===r.maxHp&&!r.bleeding&&r.morale>=targetMorale&&r.energy===100&&!r.fatigue&&!r.asleep;});
 ordinaryJobs();
 for(let h=0;h<320&&!ready();h++){
  assert.ok(!c.pendingBattle&&!c.pendingEncounter,'an actual pending attack must be resolved before more private rest');renewFor(1);const hour=c.hour;order({type:'wait',hours:1});assert.ok(c.hour>hour||c.assignmentAttention?.notice||c.contractAttention?.notice||c.logisticsNotice,'an unchanged public wait must expose an actual attention notice');ordinaryJobs();
 }
 assert.ok(ready(),'bounded ordinary rest must reach the stated morale and energy');
 const readyState={hour:c.hour,second:c.secondOfHour,treasury:c.resources.treasury,elapsedHours:c.hour-start.hour,paid:events.reduce((n,e)=>n+Math.max(0,e.cost),0),contracts:Object.fromEntries([...retained,...selected].map(id=>[id,c.contracts[id]??null])),morale:Object.fromEntries(selected.map(id=>[id,c.operativeState[id].morale]))};
 const plannedDeadline=start.hour+320+336,bufferHours=plannedDeadline-c.hour;assert.ok(bufferHours>=336);renewFor(bufferHours);assert.ok([...retained,...selected].every(id=>c.contracts[id]?.expiresAt==null||c.contracts[id].expiresAt>plannedDeadline),'every real paid term must cover the bounded entire suffix');
 const result={start,selected,targetMorale,hireOffsets,quotes,readyState,bufferHours,plannedDeadline,final:{hour:c.hour,second:c.secondOfHour,treasury:c.resources.treasury,paid:events.reduce((n,e)=>n+Math.max(0,e.cost),0),actors:[...retained,...selected].map(id=>({id,alive:c.operativeState[id].alive,location:c.operativeState[id].location,hp:c.operativeState[id].hp,maxHp:c.operativeState[id].maxHp,bleeding:c.operativeState[id].bleeding,morale:c.operativeState[id].morale,energy:c.operativeState[id].energy,expiresAt:c.contracts[id]?.expiresAt,primary:rosterFor(c).find(o=>o.id===id).weapon,kit:c.operativeState[id].medkits})),oldDead},kit,events};
 order({type:'createSquad',sector:'cordoba',name:'Columna pagada del Norte',ids:field});
 order({type:'configureArtillery',types:[]});for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'active'});c=finishReloadsBeforeMarch(c);verifyRecoveryForward(c,original,plannedDeadline,{fieldIds:field});
 order({type:'configureArtillery',types:['bronze4','bronze4','bronze4']});
 report({event:'recoveryPaidColumnStaged',campaign:c,result});
 c=prepareFinalAssault(c,{staging:'cordoba',target:'tucuman',fieldIds:field});verifyRecoveryForward(c,original,plannedDeadline,{fieldIds:field});
 assert.equal(c.operativeState[57].location,'cordoba');assert.ok(c.pendingBattle);assert.equal(c.pendingBattle.squad.length,6);
 result.guns=guns;result.staged=result.final;result.final={hour:c.hour,second:c.secondOfHour,treasury:c.resources.treasury,field:c.pendingBattle.squad.map(u=>({id:u.id,hp:u.hp,energy:u.energy,morale:u.morale})),artillery:c.pendingBattle.artillery};
 const save=encodeSave(c,enterSector(c.pendingBattle,c.sectorStates.tucuman));assert.deepEqual(decodeSave(save).campaign,c);assert.deepEqual(decodeSave(encodeSave(original)).campaign,original);
 report({event:'recoveryPaidColumnReady',campaign:c,result});return {campaign:c,deadline:plannedDeadline,result};
}

export function preparePaidRecoveryForward(start,{target,deadline,report=()=>{}}){
assert.ok(['salta','jujuy'].includes(target));
const original=clone(start);let c=decodeSave(encodeSave(original)).campaign;const staging=target==='salta'?'tucuman':'salta';assert.equal(c.location,staging);assert.equal(c.sectors[staging].owner,'patriot');assert.equal(c.operativeState[57].location,'cordoba');const field=c.squad.filter(id=>id!==57&&c.operativeState[id].alive&&!c.operativeState[id].captured);assert.equal(field.length,6);const retained=[57,...field],events=[];assert.ok(Number.isInteger(deadline)&&deadline>c.hour);const types=target==='salta'?['bronze4','bronze4','bronze4']:['swivel','swivel','swivel'];assert.ok((c.armory[types[0]]??0)>=3,'three genuine unused purchased guns remain');
const order=a=>{if(a.type==='wait')for(const id of retained)assert.ok(c.contracts[id]?.expiresAt==null||c.contracts[id].expiresAt>c.hour+a.hours,'real prepayment must cover wait');const before={hour:c.hour,second:c.secondOfHour,cash:c.resources.treasury},next=dispatchCampaign(c,a);assert.equal(next.lastError,null,JSON.stringify(a)+next.lastError);c=next;events.push({action:a,before,after:{hour:c.hour,second:c.secondOfHour,cash:c.resources.treasury}});assert.ok(c.hour<=deadline,'bounded entire forward clock');for(const[id,s]of Object.entries(original.operativeState))if(!s.alive)assert.equal(c.operativeState[id].alive,false);for(const id of retained)assert.ok(c.operativeState[id].alive&&!c.operativeState[id].captured);assert.equal(c.pendingEncounter,null,'an actual forward encounter needs tactical resolution');};
const assertForwardBound=()=>{assert.ok(c.hour<=deadline,'same absolute forward deadline after nested helper');for(const id of retained){const r=c.operativeState[id];assert.ok(r.alive&&!r.captured,'actual retained actor remains');assert.ok(c.recruited.includes(id),'actual retained actor still serving');const q=c.contracts[id];assert.ok(q?.expiresAt==null||q.expiresAt>deadline,'actual prepayment covers the same fixed deadline');}for(const[id,r]of Object.entries(original.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);};assertForwardBound();
const model=id=>sectorInventoryModel(c,staging,rosterFor(c),id);
const take=(id,row,count)=>{const before={hour:c.hour,second:c.secondOfHour,cash:c.resources.treasury};order({type:'sectorInventory',sector:staging,operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count});assert.equal(model(id).entries.find(r=>r.key===row.key)?.count??0,row.count-count);assert.deepEqual({hour:c.hour,second:c.secondOfHour,cash:c.resources.treasury},before);};
const kits=(id,amount)=>{for(let n=0;n<80&&c.operativeState[id].medkits<amount;n++){const row=model(id).entries.find(r=>r.reachable&&JSON.parse(r.expected).item==='medkits');assert.ok(row,'actual reachable battlefield/courier dressings');take(id,row,Math.min(row.count,amount-c.operativeState[id].medkits));}};
const patients=field.filter(id=>c.operativeState[id].hp<c.operativeState[id].maxHp||c.operativeState[id].bleeding),doctors=rosterFor(c).filter(o=>field.includes(o.id)&&!patients.includes(o.id)&&o.medical>=20&&c.operativeState[o.id].medkits>0).sort((a,b)=>b.medical-a.medical).slice(0,2).map(o=>o.id);assert.ok(!patients.length||doctors.length,'a real healthy field doctor remains');for(const operativeId of field)order({type:'assignCare',operativeId,assignment:patients.includes(operativeId)?'patient':doctors.includes(operativeId)&&patients.length?'doctor':'rest'});
order({type:'createSquad',name:'Entrega de batería pagada',ids:[57],sector:'cordoba'});const courier=c.activeSquadId;order({type:'assignCare',operativeId:57,assignment:'active'});const quantity=Math.min(20,c.merchants.cordoba.supplies.medkits);if(quantity){const before=c.resources.treasury,stock=c.merchants.cordoba.supplies.medkits,count=c.operativeState[57].medkits;order({type:'purchaseMedicalSupplies',operativeId:57,quantity});assert.equal(c.resources.treasury,before-quantity*10);assert.equal(c.merchants.cordoba.supplies.medkits,stock-quantity);assert.equal(c.operativeState[57].medkits,count+quantity);}order({type:'configureArtillery',types:[]});order({type:'travel',sector:staging,queue:true,mode:'posta'});
for(let h=0;h<48&&c.squads.find(q=>q.id===courier).journey;h++)order({type:'wait',hours:1});assert.equal(c.operativeState[57].location,staging);if(quantity){const before=c.operativeState[57].medkits;order({type:'sectorInventory',sector:staging,operativeId:57,direction:'drop',item:'medkits',count:quantity});assert.equal(c.operativeState[57].medkits,before-quantity);}order({type:'travel',sector:'cordoba',queue:true,mode:'posta'});order({type:'createSquad',name:'Columna retenida del Norte',ids:field,sector:staging});
for(let h=0;h<120&&field.some(id=>c.operativeState[id].hp<c.operativeState[id].maxHp||c.operativeState[id].bleeding);h++){for(const id of doctors)if(c.operativeState[id].medkits<2)kits(id,8);order({type:'wait',hours:1});}assert.ok(field.every(id=>c.operativeState[id].hp===c.operativeState[id].maxHp&&!c.operativeState[id].bleeding));for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
const arrivalGood=()=>target==='salta'?(c.hour+4)%24>=6&&(c.hour+4)%24<=12:(c.hour+4)%24===18;for(let h=0;h<48&&(c.squads.find(q=>q.id===courier).journey||!arrivalGood()||field.some(id=>c.operativeState[id].energy<100||c.operativeState[id].fatigue||c.operativeState[id].asleep));h++)order({type:'wait',hours:1});assert.equal(c.operativeState[57].location,'cordoba');assert.ok(arrivalGood());assert.ok(field.every(id=>c.operativeState[id].energy===100&&!c.operativeState[id].fatigue&&!c.operativeState[id].asleep));
for(const id of field){const op=rosterFor(c).find(o=>o.id===id);if(c.operativeState[id].weaponDropped||![1800,1801].includes(op.weapon)||c.operativeState[id].condition<95){const row=model(id).entries.find(r=>{const i=JSON.parse(r.expected);return r.reachable&&[1800,1801].includes(i.weapon)&&i.loaded===1&&i.condition===100&&!i.jammed;});assert.ok(row,'actual unworn loaded battlefield rifle');const keys=new Set(model(id).carried.map(r=>r.inventoryKey)),item=JSON.parse(row.expected);take(id,row,1);const carried=model(id).carried.find(r=>!keys.has(r.inventoryKey)&&JSON.parse(r.expected).weapon===item.weapon&&JSON.parse(r.expected).condition===item.condition);assert.ok(carried);order({type:'sectorInventory',sector:staging,operativeId:id,direction:'equip',inventoryKey:carried.inventoryKey,expected:carried.expected,slot:'primary'});}const rounds=()=>{const u=carriedAmmunition(rosterFor(c).find(o=>o.id===id),c.operativeState[id]);return u.loaded+ammoCount(u,ammoTypeFor({...u,activeSlot:'primary'}));};for(let n=0;n<80&&rounds()<16;n++){const row=model(id).entries.find(r=>r.reachable&&JSON.parse(r.expected).kind==='ammunition'&&JSON.parse(r.expected).ammoType==='musket_75');assert.ok(row,'finite compatible local musket rounds');take(id,row,Math.min(row.count,16-rounds()));}order({type:'assignCare',operativeId:id,assignment:'active'});}
order({type:'configureArtillery',types:[]});c=finishReloadsBeforeMarch(c);assertForwardBound();assert.equal(c.pendingEncounter,null);assert.equal(c.location,staging);for(const id of field)assert.equal(c.operativeState[id].location,staging);order({type:'configureArtillery',types});const before=c.armory[types[0]];c=prepareFinalAssault(c,{staging,target,fieldIds:field});assertForwardBound();assert.equal(c.pendingEncounter,null);assert.equal(c.operativeState[57].location,'cordoba');assert.equal(c.armory[types[0]],before-3);assert.equal(c.pendingBattle.squad.length,6);const battle=enterSector(c.pendingBattle,c.sectorStates[target]);assert.deepEqual(decodeSave(encodeSave(c,battle)),{campaign:c,battle});report({event:'recoveryPrepaidForwardReady',campaign:c,target,staging,field,patients,doctors,deadline,events});return c;
}

export function rejoinRecoveryWoundedSupport(result,start,{deadline,report=()=>{}}){
let c=clone(result.campaign);const field=FIELD;assert.ok(c.hour<=deadline,'same absolute forward deadline after battle');assert.equal(c.defeated,false);assert.equal(c.operativeState[57].alive,true);assert.equal(c.operativeState[57].location,'cordoba');assert.equal(c.sectors.jujuy.owner,'patriot');for(const[id,r]of Object.entries(start.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);const survivors=field.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured);for(const id of survivors){assert.ok(c.recruited.includes(id));assert.equal(c.operativeState[id].location,id===142?'salta':'jujuy');const q=c.contracts[id];assert.ok(q?.expiresAt==null||q.expiresAt>deadline);}
assert.deepEqual(survivors,[0,5,123,128,142]);assert.equal(c.operativeState[138].alive,false);assert.equal(c.operativeState[142].hp,26);const beforeRejoin=decodeSave(encodeSave(c)).campaign,beforeCash=c.resources.treasury,beforeHour=c.hour;const rejoinOrders=[],payments=[];
for(const action of [{type:'createSquad',name:'Regreso del socorro',ids:[142],sector:'salta'},{type:'travel',sector:'jujuy',mode:'posta',queue:true}]){const cash=c.resources.treasury;c=dispatchCampaign(c,action);assert.equal(c.lastError,null);assert.equal(c.resources.treasury,cash);rejoinOrders.push({action,hour:c.hour,cost:cash-c.resources.treasury});}
const rejoinSquad=c.activeSquadId;
for(let h=0;h<6;h++){const at=c.hour+1,payment=at%24===0,daily=payment?incomeSummary({...c,hour:at}).daily:0,cash=c.resources.treasury,fee=h===0?10:0;const action={type:'wait',hours:1};c=dispatchCampaign(c,action);assert.equal(c.lastError,null);assert.equal(c.hour,at);assert.equal(c.pendingEncounter,null,'real return must have no unresolved encounter');assert.equal(c.pendingBattle,null);assert.equal(c.resources.treasury,cash-fee+daily,'each real hour pays only quoted posta fee and quoted daily income');if(payment)payments.push({hour:at,daily});rejoinOrders.push({action,hour:c.hour,fee,daily,cost:cash-c.resources.treasury});}
assert.ok(c.squads.some(q=>q.id===rejoinSquad));assert.ok(c.squads.find(q=>q.id===rejoinSquad).journey==null,'actual return journey is complete');assert.equal(c.operativeState[142].location,'jujuy');assert.equal(c.hour-beforeHour,6);assert.equal(rejoinOrders.reduce((n,r)=>n+(r.fee??0),0),10);assert.equal(c.resources.treasury,beforeCash-10+payments.reduce((n,p)=>n+p.daily,0));const receipts=c.log.filter(e=>e.hour>beforeHour&&/^Las estancias y aduanas aportaron \d+ pesos a la tesorería\.$/.test(e.text)).reverse().map(e=>({hour:e.hour,daily:Number(e.text.match(/aportaron (\d+) pesos/)[1])}));assert.deepEqual(receipts,payments);assert.equal(c.operativeState[142].hp,26);c=dispatchCampaign(c,{type:'squad',ids:survivors});assert.equal(c.lastError,null);assert.deepEqual(c.squad,survivors);assert.ok(c.hour<=deadline);for(const id of survivors){assert.equal(c.operativeState[id].location,'jujuy');assert.ok(c.recruited.includes(id));assert.ok(c.contracts[id]?.expiresAt==null||c.contracts[id].expiresAt>deadline);}report({event:'actualWoundedSupportRejoined',hours:c.hour-beforeHour,fee:10,income:payments.reduce((n,p)=>n+p.daily,0),netCashChange:c.resources.treasury-beforeCash,hour:c.hour,hp:c.operativeState[142].hp,field:c.squad});verifyRecoveryForward(c,start,deadline,{fieldIds:HIGH_PASS_FIELD,front:'jujuy'});report({event:'recoveryWoundedSupportReturned',campaign:c,rejoinOrders,payments});return c;
}

class RecoveryRaidPreparation extends Error{constructor(campaign,receipt){super('Actual incoming column requires preparation');this.campaign=campaign;this.receipt=receipt;}}
// Keep the actual Jujuy survivors at their hospital. A paid physical courier
// purchases the still-unused high-pass battery and delivers finite dressings.
export function prepareRecoveryHighPassUntilRaid(start,{deadline,report=()=>{}}){
 let c=decodeSave(encodeSave(start)).campaign;
 assert.equal(c.location,'jujuy');assert.equal(c.sectors.jujuy.owner,'patriot');
 const living=c.squad.filter(id=>c.operativeState[id].alive&&!c.operativeState[id].captured),roster=rosterFor(c);
 const reserve=[...living].sort((a,b)=>c.operativeState[a].morale-c.operativeState[b].morale||a-b)[0];
 const operators=living.filter(id=>id!==reserve).sort((a,b)=>roster.find(op=>op.id===b).marksmanship-roster.find(op=>op.id===a).marksmanship);
 const light=operators[1];
 const field=[...operators.filter(id=>id!==light),light,reserve];
 assert.ok(field.length>=5&&field.length<=6,'the battery needs four actual living crew members and one rear reserve');
 const patients=field.filter(id=>c.operativeState[id].hp<c.operativeState[id].maxHp||c.operativeState[id].bleeding);
 const doctors=rosterFor(c).filter(op=>field.includes(op.id)&&!patients.includes(op.id)&&op.medical>=20).sort((a,b)=>b.medical-a.medical).slice(0,2).map(op=>op.id),doctor=doctors[0];
 assert.ok(doctor,'actual wounded survivors require a stable local doctor');
 const events=[];let gatheredDressings=0;const pause=()=>assert.equal(c.pendingEncounter,null,'an actual northern encounter must receive its normal defense');
 const order=a=>{
  const incoming=c.enemyGroups.find(g=>g.status==='marching'&&g.target==='jujuy'&&g.arrivalAt>c.hour);if(a.type==='wait'&&incoming&&c.hour>=incoming.arrivalAt-4)throw new RecoveryRaidPreparation(c,{field,patients,doctor,doctors,reserve,light,gatheredDressings,events,arrivalAt:incoming.arrivalAt,groupId:incoming.id});
  if(a.type==='wait'){
   if(patients.some(id=>c.operativeState[id].hp<c.operativeState[id].maxHp))for(const id of doctors)if(c.operativeState[id].medkits<2)gather(id,i=>i.item==='medkits',8,()=>c.operativeState[id].medkits);
   for(const id of field){let q=c.contracts[id];while(q?.expiresAt!=null&&q.expiresAt<=c.hour+a.hours){order({type:'renewContract',id,term:'day',expectedExpiresAt:q.expiresAt});q=c.contracts[id];}}
  }
  const cash=c.resources.treasury,n=dispatchCampaign(c,a);assert.equal(n.lastError,null,JSON.stringify(a)+n.lastError);c=n;verifyRecoveryForward(c,start,deadline,{fieldIds:field});
  events.push({action:a,hour:c.hour,cost:cash-c.resources.treasury});
  if(a.type==='wait')redistributePatientDressings();
 };
 const inventory=id=>sectorInventoryModel(c,'jujuy',rosterFor(c),id);
 const gather=(id,test,target,current)=>{
  for(let step=0;step<100&&current()<target;step++){
   const row=inventory(id).entries.find(row=>row.reachable&&test(JSON.parse(row.expected)));
   assert.ok(row,'the cleared map retains the actual finite reachable supplies');
   const count=Math.min(row.count,target-current());order({type:'sectorInventory',sector:'jujuy',operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count});
   assert.equal(inventory(id).entries.find(r=>r.key===row.key)?.count??0,row.count-count);
   if(test({item:'medkits'}))gatheredDressings+=count;
  }
  assert.ok(current()>=target);
 };
 const redistributePatientDressings=()=>{
  for(const id of patients){
   const count=Math.max(0,c.operativeState[id].medkits-2);if(!count||inventory(id).reason)continue;
   const recipient=[...doctors].sort((a,b)=>c.operativeState[a].medkits-c.operativeState[b].medkits||a-b)[0],before=clock(c),donorBefore=c.operativeState[id].medkits,doctorBefore=c.operativeState[recipient].medkits,keys=new Set(inventory(recipient).entries.map(row=>row.key));
   order({type:'sectorInventory',sector:'jujuy',operativeId:id,direction:'drop',item:'medkits',count});assert.equal(c.operativeState[id].medkits,2);
   const row=inventory(recipient).entries.find(row=>!keys.has(row.key)&&row.reachable&&JSON.parse(row.expected).item==='medkits'&&row.count===count);assert.ok(row,'the actual conscious patient can drop finite surplus within the healthy doctor route');
   order({type:'sectorInventory',sector:'jujuy',operativeId:recipient,direction:'take',sourceKey:row.key,expected:row.expected,count});assert.equal(c.operativeState[recipient].medkits,doctorBefore+count);assert.equal(inventory(recipient).entries.find(r=>r.key===row.key)?.count??0,0);assert.deepEqual(clock(c),before);
   report({event:'recoveryActualPatientDressingTransfer',donor:id,recipient,count,sourceKey:row.key,expected:row.expected,donorBefore,donorAfter:2,doctorBefore,doctorAfter:c.operativeState[recipient].medkits,...before});
  }
 };
 try{
 redistributePatientDressings();
 if(patients.length)for(const id of doctors)gather(id,i=>i.item==='medkits',8,()=>c.operativeState[id].medkits);
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:patients.includes(operativeId)?'patient':doctors.includes(operativeId)&&patients.length?'doctor':'rest'});
 if(patients.some(id=>c.operativeState[id].medkits>2&&inventory(id).reason))order({type:'wait',hours:1});
 assert.ok(patients.every(id=>c.operativeState[id].medkits<=2),'real care makes the critical donor conscious before his actual finite surplus is collected');
 const front=c.activeSquadId;
 assert.equal(c.operativeState[57].location,'cordoba');assert.ok(c.operativeState[57].alive);
 order({type:'createSquad',name:'Socorro del paso',ids:[57],sector:'cordoba'});const courier=c.activeSquadId;
 for(const item of ['field8','swivel'])assert.equal(c.armory[item],1,'exact unused owned high-pass piece');
 const slowRate=Math.min(...doctors.map(id=>doctorRate(rosterFor(c).find(op=>op.id===id),c))),careDemand=patients.reduce((n,id)=>n+Math.ceil((c.operativeState[id].maxHp-c.operativeState[id].hp)/slowRate),0);
 const carriedKits=field.reduce((n,id)=>n+c.operativeState[id].medkits,0),reachableKits=inventory(doctor).entries.filter(row=>row.reachable&&JSON.parse(row.expected).item==='medkits').reduce((n,row)=>n+row.count,0);
 const medical=Math.max(8,careDemand+2*field.length-carriedKits-reachableKits),medicalPrice=careRules(c).dressingPrice;
 assert.ok(Number.isInteger(medical)&&medical<=c.merchants.cordoba.supplies.medkits,'actual finite merchant stock covers conservative care and two retained kits each');
 const shipmentQuote={doctors,slowRate,careDemand,retainedKits:2*field.length,carriedKits,reachableKits,quantity:medical,unitPrice:medicalPrice,cost:medical*medicalPrice};
 const beforeMedical={cash:c.resources.treasury,stock:c.merchants.cordoba.supplies.medkits,kits:c.operativeState[57].medkits};
 order({type:'purchaseMedicalSupplies',operativeId:57,quantity:medical});assert.equal(c.resources.treasury,beforeMedical.cash-shipmentQuote.cost);assert.equal(c.merchants.cordoba.supplies.medkits,beforeMedical.stock-medical);assert.equal(c.operativeState[57].medkits,beforeMedical.kits+medical);
 report({event:'recoveryQuotedFiniteCareShipment',shipmentQuote});
 order({type:'configureArtillery',types:[]});order({type:'assignCare',operativeId:57,assignment:'active'});
 order({type:'travel',sector:'jujuy',queue:true,mode:'posta'});
 for(let h=0;h<80&&c.squads.find(q=>q.id===courier).journey;h++){pause();assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 assert.equal(c.location,'jujuy');assert.equal(c.operativeState[57].location,'jujuy');assert.ok(!c.squads.find(q=>q.id===courier).journey,'actual finite shipment arrives before waiting for full patient recovery');
 if(medical){const before=c.operativeState[57].medkits;order({type:'sectorInventory',sector:'jujuy',operativeId:57,direction:'drop',item:'medkits',count:medical});assert.equal(c.operativeState[57].medkits,before-medical);}
 order({type:'travel',sector:'cordoba',queue:true,mode:'posta'});order({type:'selectSquad',id:front});
 for(let h=0;h<80&&field.some(id=>c.operativeState[id].hp<c.operativeState[id].maxHp||c.operativeState[id].bleeding);h++){pause();order({type:'wait',hours:1});}
 assert.ok(field.every(id=>c.operativeState[id].hp===c.operativeState[id].maxHp&&!c.operativeState[id].bleeding),'both actual doctors complete finite care before the real raid preparation');
 for(const id of field){
  const count=Math.max(0,2-c.operativeState[id].medkits);if(!count)continue;
  const donor=field.find(other=>other!==id&&c.operativeState[other].medkits>=2+count);assert.ok(donor,'the actual field retains enough finite dressings for two each');
  const before=clock(c),donorBefore=c.operativeState[donor].medkits,recipientBefore=c.operativeState[id].medkits,keys=new Set(inventory(id).entries.map(row=>row.key));
  order({type:'sectorInventory',sector:'jujuy',operativeId:donor,direction:'drop',item:'medkits',count});assert.equal(c.operativeState[donor].medkits,donorBefore-count);
  const row=inventory(id).entries.find(row=>!keys.has(row.key)&&row.reachable&&JSON.parse(row.expected).item==='medkits'&&row.count===count);assert.ok(row,'the actual recipient can reach the exact retained dressing transfer');
  order({type:'sectorInventory',sector:'jujuy',operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count});assert.equal(c.operativeState[id].medkits,recipientBefore+count);assert.equal(inventory(id).entries.find(r=>r.key===row.key)?.count??0,0);assert.deepEqual(clock(c),before);
  report({event:'recoveryActualRetainedDressingTransfer',donor,recipient:id,count,sourceKey:row.key,expected:row.expected,donorBefore,donorAfter:c.operativeState[donor].medkits,recipientBefore,recipientAfter:c.operativeState[id].medkits,...before});
 }
 assert.ok(field.every(id=>c.operativeState[id].medkits>=2),'two actual retained field dressings each before the raid');
 for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});
 const ready=()=>!c.squads.find(q=>q.id===courier).journey&&field.every(id=>!c.operativeState[id].fatigue&&c.operativeState[id].energy===100&&!c.operativeState[id].asleep)&&(c.hour+6)%24===12;
 for(let h=0;h<48&&!ready();h++){pause();assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}assert.ok(ready());
 for(const id of field){
  const op=rosterFor(c).find(o=>o.id===id);
  if(c.operativeState[id].weaponDropped||![1800,1801].includes(op.weapon)||c.operativeState[id].condition<95){
   const row=inventory(id).entries.find(r=>{const i=JSON.parse(r.expected);return r.reachable&&[1800,1801].includes(i.weapon)&&i.loaded===1&&i.condition===100&&!i.jammed;});assert.ok(row);
   const weapon=JSON.parse(row.expected).weapon,keys=new Set(inventory(id).carried.map(r=>r.inventoryKey));
   order({type:'sectorInventory',sector:'jujuy',operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count:1});
   const gun=inventory(id).carried.find(r=>r.inventoryKey&&!keys.has(r.inventoryKey)&&JSON.parse(r.expected).weapon===weapon);assert.ok(gun);
   order({type:'sectorInventory',sector:'jujuy',operativeId:id,direction:'equip',inventoryKey:gun.inventoryKey,expected:gun.expected,slot:'primary'});
  }
  if(rosterFor(c).find(o=>o.id===id).ammunitionChoice==='ammoShot'){if(c.operativeState[id].carriedLoaded)order({type:'unloadAmmunition',operativeId:id});order({type:'selectAmmunitionLoad',operativeId:id,family:'ammoMusket'});}
  const rounds=()=>{const u=carriedAmmunition(rosterFor(c).find(o=>o.id===id),c.operativeState[id]);return u.loaded+ammoCount(u,ammoTypeFor({...u,activeSlot:'primary'}));};
  gather(id,i=>i.kind==='ammunition'&&i.ammoType==='musket_75',16,rounds);
  gather(id,i=>i.item==='medkits',2,()=>c.operativeState[id].medkits);
  order({type:'assignCare',operativeId:id,assignment:'active'});
 }
 c=finishReloadsBeforeMarch(c);verifyRecoveryForward(c,start,deadline,{fieldIds:field});order({type:'configureArtillery',types:['field8','swivel']});
 c=prepareFinalAssault(c,{staging:'jujuy',target:'humahuaca',fieldIds:field});verifyRecoveryForward(c,start,deadline,{fieldIds:field});
 assert.equal(c.operativeState[57].location,'cordoba');assert.ok(c.operativeState[57].alive);
 for(const[id,r]of Object.entries(start.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);
 const battle=enterSector(c.pendingBattle,c.sectorStates.humahuaca);assert.deepEqual(decodeSave(encodeSave(c,battle)),{campaign:c,battle});
 report({event:'survivorHumahuacaReady',hour:c.hour,treasury:c.resources.treasury,field,patients,doctor,doctors,reserve,light,gatheredDressings,events});return {kind:'assault',campaign:c};
 }catch(error){if(!(error instanceof RecoveryRaidPreparation))throw error;verifyRecoveryForward(error.campaign,start,deadline,{fieldIds:field,front:'jujuy'});assert.equal(error.campaign.operativeState[57].location,'cordoba');for(const id of field){const r=error.campaign.operativeState[id];assert.equal(r.hp,r.maxHp);assert.equal(r.bleeding,0);assert.equal(r.energy,100);assert.equal(r.fatigue,0);assert.ok(r.medkits>=2);}report({event:'recoveryHighPassActualRaidStaging',campaign:error.campaign,...error.receipt});return {kind:'raid',campaign:error.campaign,receipt:error.receipt};}
}

export function prepareRecoveryJujuyRaid(start,{deadline,report=()=>{}}){
let c=clone(start);const initial=structuredClone(c),field=[0,5,123,128,142],events=[],tactical=[];const incoming=c.enemyGroups.find(g=>g.status==='marching'&&g.target==='jujuy');assert.ok(incoming);const arrival=incoming.arrivalAt;assert.equal(arrival-c.hour,4);assert.deepEqual(c.squad,field);assert.equal(c.armory.field8,1);assert.equal(c.armory.swivel,1);assert.equal(c.operativeState[138].alive,false);assert.equal(incoming.units.length,30,'the actual new column retains all thirty guards');
function order(a){const cash=c.resources.treasury,oldHour=c.hour;c=dispatchCampaign(c,a);assert.equal(c.lastError,null,JSON.stringify(a)+' '+c.lastError);assert.ok(c.hour<=deadline);for(const id of field)assert.ok(c.recruited.includes(id)&&c.operativeState[id].alive);events.push({action:a,hour:c.hour,second:c.secondOfHour,cashBefore:cash,cashAfter:c.resources.treasury,hours:c.hour-oldHour});}
for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'active'});order({type:'configureArtillery',types:[]});
for(const gun of c.sectorStates.jujuy.artillery.filter(g=>g.side==='player')){const count=6-gun.ammo;if(count<=0)continue;const q=artillerySupplyPreview(c,'jujuy',gun.id,count,isSupplied);assert.equal(q.valid,true);const before=c.resources.treasury;order(q.action);assert.equal(before-c.resources.treasury,q.cost);assert.equal(c.sectorStates.jujuy.artillery.find(g=>g.id===gun.id).ammo,6);}
while(c.sectors.jujuy.fort<3){const cash=c.resources.treasury;order({type:'fortify',sector:'jujuy'});assert.equal(cash-c.resources.treasury,150);}
order({type:'visitSector'});let b=enterSector(c.pendingBattle,c.sectorStates.jujuy);assert.equal(b.mode,'exploration');assert.ok(!b.units.some(u=>u.side==='enemy'&&u.hp>=15&&!u.routed&&!u.departure&&!u.surrendered));const beforeVisit=structuredClone(b),operators=[['5','piece-24'],['128','piece-25'],['142','piece-26']];
function act(action){const before=b;b=actBattle(b,action);assert.equal(b.lastError,null,JSON.stringify(action)+' '+b.lastError);tactical.push({action,elapsedSeconds:b.elapsedSeconds-before.elapsedSeconds,elapsed:b.elapsedSeconds,energy:b.units.filter(u=>u.side==='player').map(u=>({id:u.id,energy:u.energy,hp:u.hp}))});assert.ok(b.elapsedSeconds<7200,'actual visit fits before incoming column');}
for(const[id,x,y]of[['0',48,24],['123',50,25],['5',51,24],['128',52,23],['142',47,23]]){const u=b.units.find(u=>u.id===id);assert.ok(u&&!u.departure);const p=knownGroundRoutes(b,u).find(p=>p.x===x&&p.y===y&&(p.tacticalLevel??0)===0);assert.ok(p,'actual ground path to owned defense post '+id);if(p.cost>0)act({type:'move',unitId:id,x,y,tacticalLevel:0});}
for(const[id,gid]of operators){const u=b.units.find(u=>u.id===id),g=b.artillery.find(g=>g.id===gid);assert.deepEqual(artilleryCrewPlan(b,u,g,artilleryCosts(b,u,g).fire),{crew:[id],reason:null});if(!g.loaded){assert.equal(artilleryReloadPreview(b,u,g).valid,true);act({type:'artilleryReload',unitId:id,artilleryId:gid});}}
const woundedReturn=b.units.find(u=>u.id==='142');if(!woundedReturn.loaded){act({type:'reload',unitId:'142'});assert.equal(b.units.find(u=>u.id==='142').loaded,1);}
for(const old of beforeVisit.units.filter(u=>u.side==='player')){const now=b.units.find(u=>u.id===old.id);const inventory=structuredClone(old.inventory);if(old.id==='142'&&!old.loaded){const key=Object.keys(inventory).find(k=>inventory[k].kind==='ammunition'&&inventory[k].ammoType===AMMUNITION_FAMILIES[ammoTypeFor(old)]?.type);assert.ok(key&&inventory[key].count>0);inventory[key].count--;assert.equal(now.loaded,1);}assert.deepEqual(now.inventory,inventory,'exact inventory except142 real cartridge moved into barrel');for(const key of ['hp','headwear','outfit','legwear','blade','bladeCondition','medkits','rations','torches','boleadoras'])assert.deepEqual(now[key],old[key],old.id+' finite '+key);}
assert.ok(b.artillery.filter(g=>g.side==='player').every(g=>g.loaded&&g.ammo>=5));const pair=syncBattleTime(c,b);assert.equal(pair.error,null);c=pair.campaign;b=pair.battle;assert.deepEqual(decodeSave(encodeSave(c,b)),{campaign:c,battle:b});order({type:'leaveSector',battleId:c.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});assert.equal(c.pendingBattle,null);assert.ok(c.hour<arrival);for(const g of c.sectorStates.jujuy.artillery.filter(g=>g.side==='player'&&g.ammo<6)){const q=artillerySupplyPreview(c,'jujuy',g.id,6-g.ammo,isSupplied);assert.equal(q.valid,true);const cash=c.resources.treasury;order(q.action);assert.equal(cash-c.resources.treasury,q.cost);}assert.ok(c.sectorStates.jujuy.artillery.filter(g=>g.side==='player').every(g=>g.loaded&&g.ammo===6));
for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'rest'});while(c.hour<arrival-1){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}for(const operativeId of field)order({type:'assignCare',operativeId,assignment:'active'});while(!c.pendingEncounter){assert.ok(c.hour<arrival);order({type:'wait',hours:1});}assert.equal(c.pendingEncounter.groupId,incoming.id);assert.equal(c.pendingEncounter.arrivedAt,arrival);for(const id of field){assert.equal(c.operativeState[id].hp,c.operativeState[id].maxHp);assert.equal(c.operativeState[id].bleeding,0);assert.equal(c.operativeState[id].energy,100);assert.equal(c.operativeState[id].fatigue,0);assert.equal(c.operativeState[id].location,'jujuy');if(c.contracts[id].expiresAt!=null)assert.ok(c.contracts[id].expiresAt>deadline);}order({type:'respondToEncounter',groupId:incoming.id,choice:'tactical'});assert.equal(c.pendingBattle.squad.length,5);assert.equal(c.pendingBattle.defenseGroupId,incoming.id);const entered=enterSector(c.pendingBattle,c.sectorStates.jujuy);for(const[id,gid]of operators){const u=entered.units.find(u=>u.id===id),g=entered.artillery.find(g=>g.id===gid);assert.deepEqual(artilleryCrewPlan(entered,u,g,artilleryCosts(entered,u,g).fire),{crew:[id],reason:null});assert.equal(u.x,g.x);assert.equal(u.y,g.y);}for(const[id,r]of Object.entries(initial.operativeState))if(!r.alive)assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[57].location,'cordoba');assert.equal(c.armory.field8,1);assert.equal(c.armory.swivel,1);assert.deepEqual(decodeSave(encodeSave(c,entered)),{campaign:c,battle:entered});report({event:'recoveryActualJujuyRaidReady',campaign:c,actualArrival:arrival,events,tactical,operators});return c;
}

export function prepareRecoveryMedicalStock(initial,{deadline,report=()=>{}}){
let start=clone(initial);const field=HIGH_PASS_FIELD;
const originalMedical=structuredClone(start),doctor=123,rate=doctorRate(rosterFor(start).find(op=>op.id===doctor),start),target=2+field.reduce((n,id)=>n+Math.ceil((start.operativeState[id].maxHp-start.operativeState[id].hp)/rate),0),transfers=[];
const model=id=>sectorInventoryModel(start,'jujuy',rosterFor(start),id),carriedKits=field.reduce((n,id)=>n+start.operativeState[id].medkits,0),reachableKits=model(doctor).entries.filter(row=>row.reachable&&JSON.parse(row.expected).item==='medkits').reduce((n,row)=>n+row.count,0),medicalQuantity=10;
assert.ok(carriedKits+reachableKits+medicalQuantity>=target-2+2*field.length,'actual custody and the finite ten-kit shipment cover quoted care and two retained kits each');assert.ok(start.merchants.cordoba.supplies.medkits>=medicalQuantity,'the actual supplier has the complete ten-kit shipment');
report({event:'recoveryPostRaidFiniteCareQuote',doctor,rate,careDemand:target-2,retainedKits:2*field.length,carriedKits,reachableKits,medicalQuantity,merchantStock:start.merchants.cordoba.supplies.medkits,unitPrice:careRules(start).dressingPrice,cost:medicalQuantity*careRules(start).dressingPrice});
const order=a=>{const n=dispatchCampaign(start,a);assert.equal(n.lastError,null,JSON.stringify(a)+n.lastError);start=n;verifyRecoveryForward(start,originalMedical,deadline,{fieldIds:field,front:'jujuy'});assert.equal(start.hour,originalMedical.hour);assert.equal(start.secondOfHour,originalMedical.secondOfHour);assert.equal(start.resources.treasury,originalMedical.resources.treasury);};
for(const id of field.filter(id=>id!==doctor)){
 if(start.operativeState[doctor].medkits>=target)break;const count=Math.min(Math.max(0,start.operativeState[id].medkits-2),target-start.operativeState[doctor].medkits);if(!count)continue;
 const prior=start.operativeState[id].medkits,priorDoctor=start.operativeState[doctor].medkits,before=sectorInventoryModel(start,'jujuy',rosterFor(start),doctor),keys=new Set(before.entries.map(r=>r.key));
 order({type:'sectorInventory',sector:'jujuy',operativeId:id,direction:'drop',item:'medkits',count});assert.equal(start.operativeState[id].medkits,prior-count);
 const model=sectorInventoryModel(start,'jujuy',rosterFor(start),doctor),row=model.entries.find(r=>!keys.has(r.key)&&r.reachable&&JSON.parse(r.expected).item==='medkits'&&r.count===count);assert.ok(row,'doctor can reach the exact dropped real dressings');
 order({type:'sectorInventory',sector:'jujuy',operativeId:doctor,direction:'take',sourceKey:row.key,expected:row.expected,count});assert.equal(start.operativeState[doctor].medkits,priorDoctor+count);assert.equal(sectorInventoryModel(start,'jujuy',rosterFor(start),doctor).entries.find(r=>r.key===row.key)?.count??0,0);
 transfers.push({donor:id,recipient:doctor,count,sourceKey:row.key,expected:row.expected,donorBefore:prior,donorAfter:start.operativeState[id].medkits,doctorBefore:priorDoctor,doctorAfter:start.operativeState[doctor].medkits});
}
assert.equal(field.reduce((n,id)=>n+start.operativeState[id].medkits,0),carriedKits);
const gathered=[];
for(let step=0;step<100&&start.operativeState[doctor].medkits<target;step++){
 const row=model(doctor).entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='medkits');if(!row)break;
 const count=Math.min(row.count,target-start.operativeState[doctor].medkits),before=start.operativeState[doctor].medkits;
 order({type:'sectorInventory',sector:'jujuy',operativeId:doctor,direction:'take',sourceKey:row.key,expected:row.expected,count});assert.equal(start.operativeState[doctor].medkits,before+count);assert.equal(model(doctor).entries.find(r=>r.key===row.key)?.count??0,row.count-count);gathered.push({sourceKey:row.key,expected:row.expected,count,sourceBefore:row.count,sourceAfter:row.count-count});
}
assert.ok(start.operativeState[doctor].medkits+medicalQuantity>=target,'current finite doctor stock plus the paid physical shipment covers actual care');assert.equal(field.reduce((n,id)=>n+start.operativeState[id].medkits,0),carriedKits+gathered.reduce((n,row)=>n+row.count,0));assert.deepEqual(decodeSave(encodeSave(start)).campaign,start);
report({event:'actualFiniteMedicalRedistribution',rate,target,transfers,gathered,medicalQuantity});
const backupDrops=[];
for(const id of field){
 const op=rosterFor(start).find(op=>op.id===id),record=start.operativeState[id],willReplace=record.weaponDropped||![1800,1801].includes(op.weapon)||record.condition<95;
 // The worn primary takes a pocket when replaced, and the new primary
 // needs another pocket when the soldier takes his real dressings in hand.
 const requiredFreeLarge=1+Number(willReplace&&!record.weaponDropped),freeLarge=()=>inventoryUsage(carriedAmmunition(rosterFor(start).find(op=>op.id===id),start.operativeState[id])).slots.filter(slot=>slot.size==='large'&&!slot.entry).length;
 for(let step=0;step<8&&freeLarge()<requiredFreeLarge;step++){
 const beforeFree=freeLarge(),model=sectorInventoryModel(start,'jujuy',rosterFor(start),id),row=model.carried.filter(r=>r.inventoryKey&&[1800,1801].includes(JSON.parse(r.expected??'{}').weapon)&&r.count===1).sort((a,b)=>(a.condition??0)-(b.condition??0))[0];assert.ok(row,'an actual redundant stored rifle can release the required large pocket');
 const stack=JSON.parse(row.expected),keys=new Set(model.entries.map(r=>r.key));order({type:'sectorInventory',sector:'jujuy',operativeId:id,direction:'drop',item:row.item,count:1});
 const after=sectorInventoryModel(start,'jujuy',rosterFor(start),id);assert.equal(after.carried.some(r=>r.inventoryKey===row.inventoryKey),false);const ground=after.entries.find(r=>!keys.has(r.key)&&r.reachable&&JSON.parse(r.expected).weapon===stack.weapon&&JSON.parse(r.expected).condition===stack.condition&&r.count===1);assert.ok(ground,'old real spare rifle remains under local physical custody');
 const actual=JSON.parse(ground.expected);for(const key of['weapon','count','weight','condition','loaded','jammed'])assert.deepEqual(actual[key],stack[key]);assert.ok(freeLarge()>beforeFree);backupDrops.push({id,item:row.item,inventoryKey:row.inventoryKey,stack,sourceKey:ground.key,expected:ground.expected,freeLargeBefore:beforeFree,freeLargeAfter:freeLarge(),requiredFreeLarge});
 }
 assert.ok(freeLarge()>=requiredFreeLarge,'actual large pockets cover replacement and the medical hand action');
}
assert.deepEqual(decodeSave(encodeSave(start)).campaign,start);
report({event:'recoveryFiniteSpareRifleDrop',backupDrops});return start;
}

// The fresh test calls this from its real cleared-capital outcome. No saved
// fixture, cached victory, hidden actor or synthetic resource enters the route.
export function continuePaidSurvivorNorthernRoute(start,{report=()=>{}}={}){
 const reserve=earnRecoveryNorthernReserve(start,{report}),paid=preparePaidRecoveryColumn(reserve,{report}),deadline=paid.deadline;
 assert.equal(deadline,reserve.hour+320+336);
 const recaptured=fightNorthernSector(paid.campaign,'tucuman',{...recoveryBronzeControls({report}),report});
 verifyRecoveryForward(recaptured.campaign,start,deadline,{fieldIds:FIELD,front:'tucuman'});assert.equal(recaptured.campaign.operativeState[57].location,'cordoba');report({event:'recoveryTucumanAccepted',campaign:recaptured.campaign});
 const saltaReady=preparePaidRecoveryForward(recaptured.campaign,{target:'salta',deadline,report});
 const returnedSalta=fightNorthernSector(saltaReady,'salta',{...recoveryBronzeControls({report}),report});
 verifyRecoveryForward(returnedSalta.campaign,start,deadline,{fieldIds:FIELD,front:'salta'});assert.equal(returnedSalta.campaign.operativeState[57].location,'cordoba');report({event:'recoverySaltaAccepted',campaign:returnedSalta.campaign});
 const jujuyReady=preparePaidRecoveryForward(returnedSalta.campaign,{target:'jujuy',deadline,report});
 const firstJujuy=fightNorthernSector(jujuyReady,'jujuy',{...recoveryJujuyControls({report}),report});
 let forward=rejoinRecoveryWoundedSupport(firstJujuy,jujuyReady,{deadline,report});
 const suffix=continueRecoveryJujuySuffix(forward,{baseline:start,deadline,report});
 return {...suffix,deadline,reserve,recaptured,returnedSalta,firstJujuy};
}

// The admitted Jujuy result retains its real wounds, departure, terms and loss.
export function continueRecoveryJujuySuffix(start,{baseline=start,deadline,report=()=>{}}){
 let forward=start;verifyRecoveryForward(forward,baseline,deadline,{fieldIds:HIGH_PASS_FIELD,front:'jujuy'});
 const staged=prepareRecoveryHighPassUntilRaid(forward,{deadline,report});assert.equal(staged.kind,'raid','the real approaching thirty-man column must be resolved');
 const raidReady=prepareRecoveryJujuyRaid(staged.campaign,{deadline,report});
 const raid=fightNorthernSector(raidReady,'jujuy',{controller:preparedDefenseZeroAidQuietSearch({report}),report});
 forward=raid.campaign;verifyRecoveryForward(forward,baseline,deadline,{fieldIds:HIGH_PASS_FIELD,front:'jujuy'});assert.equal(forward.enemyGroups.find(g=>g.id===raidReady.pendingBattle.defenseGroupId).status,'defeated');assert.equal(forward.operativeState[138].alive,false);report({event:'recoveryJujuyRaidAccepted',campaign:forward});
 const medical=prepareRecoveryMedicalStock(forward,{deadline,report}),finalEvents=[];
 const humahuacaReady=prepareSurvivorHumahuaca(medical,{useOwnedBattery:true,medicalQuantity:10,earlyDelivery:true,preferSteadyHeavyCrew:true,report:event=>{finalEvents.push(event);report(event);}});
 verifyRecoveryForward(humahuacaReady,baseline,deadline,{fieldIds:HIGH_PASS_FIELD,front:'humahuaca'});assert.equal(humahuacaReady.operativeState[57].location,'cordoba');
 const finalColumn=finalEvents.find(e=>e.event==='survivorHumahuacaReady');assert.equal(finalColumn.field.length,5);
 for(const id of HIGH_PASS_FIELD){const r=humahuacaReady.operativeState[id],u=carriedAmmunition(rosterFor(humahuacaReady).find(op=>op.id===id),r);assert.equal(r.hp,r.maxHp);assert.equal(r.bleeding,0);assert.equal(r.energy,100);assert.ok(r.medkits>=2);assert.ok(u.loaded+ammoCount(u,ammoTypeFor({...u,activeSlot:'primary'}))>=16);}
 assert.equal(humahuacaReady.hour%24,12);assert.deepEqual(humahuacaReady.pendingBattle.artillery.filter(g=>!g.stationed).map(g=>g.type),['field8','swivel']);
 const enteredHighPass=enterSector(humahuacaReady.pendingBattle,humahuacaReady.sectorStates.humahuaca),beforeMedicalPreview=structuredClone(enteredHighPass);
 for(const unit of enteredHighPass.units.filter(unit=>unit.side==='player'))assert.doesNotThrow(()=>planReadyMainHand(unit,'medkits'),'actual field pack can stow its primary for finite first aid');
 assert.deepEqual(enteredHighPass,beforeMedicalPreview,'medical hand preview cannot change actual custody');
 report({event:'recoveryHumahuacaAcceptedReady',campaign:humahuacaReady});
 const humahuaca=fightNorthernSector(humahuacaReady,'humahuaca',{controller:survivorBatteryController({reserveId:finalColumn.reserve,lightId:finalColumn.light,heavyIds:finalColumn.field.filter(id=>id!==finalColumn.reserve&&id!==finalColumn.light)}),deploy:b=>deployHighPassBattery(b,{reserveId:finalColumn.reserve,lightId:finalColumn.light}),report});
 verifyRecoveryForward(humahuaca.campaign,baseline,deadline,{fieldIds:HIGH_PASS_FIELD,front:'humahuaca'});assert.equal(humahuaca.campaign.operativeState[57].location,'cordoba');assert.equal(humahuaca.campaign.sectors.humahuaca.owner,'patriot');assert.equal(humahuaca.campaign.operativeState[138].alive,false);assert.deepEqual(decodeSave(encodeSave(humahuaca.campaign)).campaign,humahuaca.campaign);report({event:'recoveryHumahuacaAccepted',campaign:humahuaca.campaign});
 return {deadline,jujuy:{...raid,campaign:forward},humahuacaReady,humahuaca,raid};
}
