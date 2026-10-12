import assert from 'node:assert/strict';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote,contractRenewalQuote,contractExpiresSeconds} from '../game/contracts.js';
import {baseMorale} from '../game/morale.js';
import {sectorInventoryModel,sectorInventorySites} from '../game/sector-inventory.js';
import {applyItemQuantity,inventoryUsage} from '../game/tactical-inventory.js';
import {carriedAmmunition} from '../game/campaign-ammunition.js';
import {ammoTypeFor,ammoCount} from '../game/ammo-types.js';
import {storedArtilleryRecord} from '../game/artillery-transport.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {actBattle} from '../game/tactical.js';
import {syncBattleTime} from '../game/time.js';
import {expandedCapitalWaitNotice} from './created-expanded-capital-return.mjs';
import {prepareRouteBattery} from './route-battery.mjs';
import {saltaBatteryWaypoints} from './salta-route.mjs';
import {recoverRoutePrimary} from './route-owned-equipment.mjs';
import {supplyRouteAmmunition} from './route-ammunition.mjs';
import {supplyRouteDressings} from './route-dressings.mjs';
import {recoverVisibleRouteDressings} from './route-visible-medical-remains.mjs';
import {finishReloadsBeforeMarch} from './pre-march-reload.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0);
const living=c=>c.recruited.filter(id=>c.operativeState[id]?.alive&&!c.operativeState[id].captured);
const guns=c=>[...Object.values(c.artilleryDepots??{}).flat(),...Object.values(c.sectorStates??{}).flatMap(s=>s.artillery??[]),...Object.values(c.sceneStates??{}).flatMap(s=>s.artillery??[]),...(c.artilleryTransfers??[]).map(t=>t.gun)].map(storedArtilleryRecord);
const occupied=(c,at)=>c.enemyGroups.some(g=>g.target===at&&['waiting','engaged','stationed'].includes(g.status));
const medical=(c,at)=>sectorInventorySites(c,at).flatMap(site=>sectorInventoryModel(c,site.id,rosterFor(c)).entries.filter(row=>row.count>0&&JSON.parse(row.expected).item==='medkits').map(row=>({siteId:site.id,...row})));

function activatePrimaries(start,report){
 const rounds=c=>start.squad.reduce((sum,id)=>{const u=carriedAmmunition(rosterFor(c).find(op=>op.id===id),c.operativeState[id]);return sum+u.loaded+ammoCount(u);},0),beforeRounds=rounds(start);
 let c=dispatchCampaign(start,{type:'visitSector'});assert.equal(c.lastError,null);let battle=enterSector(c.pendingBattle,c.sectorStates[c.location]);
 for(const id of start.squad){const u=battle.units.find(unit=>unit.id===String(id)&&unit.side==='player');assert.ok(u&&u.hp===u.maxHp&&!u.weaponDropped);if(u.activeSlot==='primary')continue;const action={type:'weapon',unitId:u.id,slot:'primary'};battle=actBattle(battle,action);assert.equal(battle.lastError,null);report({event:'livingNorthernPrimaryActivated',id,action});}
 const pair=syncBattleTime(c,battle);assert.equal(pair.error,null);c=dispatchCampaign(pair.campaign,{type:'leaveSector',battleId:c.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});assert.equal(c.lastError,null);assert.equal(rounds(c),beforeRounds);for(const id of start.squad)assert.equal(c.operativeState[id].activeSlot,'primary');return c;
}

// This quotation uses public known pools. An unknown corpse is not counted as
// admitted linen; only a later ordinary patrol can establish its contents.
export function livingNorthernSupplyPlan(c,{commanderId=57,hospital='cordoba',dressings=10,rounds=16,maxRestHours=600,logisticsHours=720}={}){
 assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);assert.equal(c.defeated,false);assert.equal(c.completed,false);
 assert.ok(Number.isSafeInteger(dressings)&&dressings>=10);assert.ok(Number.isSafeInteger(rounds)&&rounds>=16);
 assert.ok(Number.isSafeInteger(maxRestHours)&&maxRestHours>0&&maxRestHours<=600);assert.ok(Number.isSafeInteger(logisticsHours)&&logisticsHours>0&&logisticsHours<=720);
 const keepers=living(c),field=keepers.filter(id=>id!==commanderId),roster=rosterFor(c);
 assert.ok(keepers.includes(commanderId)&&field.length>=6&&field.length<=42);assert.equal(c.sectors[hospital].owner,'patriot');assert.ok(!occupied(c,hospital));
 assert.ok(field.some(id=>roster.find(op=>op.id===id).medical>=60),'Keep an actual qualified physician in the surviving field.');
 for(const id of keepers){const r=c.operativeState[id],expiry=contractExpiresSeconds(c.contracts[id]);assert.equal(r.location,hospital);assert.equal(r.hp,r.maxHp);assert.equal(r.bleeding,0);assert.ok(c.contracts[id]&&(expiry===null||expiry>clock(c)));}
 const carried=field.reduce((sum,id)=>sum+(c.operativeState[id].medkits??0),0),need=Math.max(0,field.length*dressings-carried);
 const sources=Object.keys(c.sectors).filter(at=>at!==hospital&&c.sectors[at].owner==='patriot'&&!occupied(c,at)).map(sector=>({sector,knownDressings:medical(c,sector).reduce((sum,row)=>sum+row.count,0)})).filter(row=>row.knownDressings>0).sort((a,b)=>b.knownDressings-a.knownDressings||a.sector.localeCompare(b.sector));
 const serviceDays=Math.ceil((maxRestHours+logisticsHours)/24),dailyService=keepers.reduce((sum,id)=>sum+contractQuote(c,roster.find(op=>op.id===id),'day').price,0);
 return {commanderId,hospital,keepers,field,dressings,rounds,maxRestHours,logisticsHours,carriedDressings:carried,neededDressings:need,sources,knownDressings:sources.reduce((sum,row)=>sum+row.knownDressings,0),unprovedDressings:Math.max(0,need-sources.reduce((sum,row)=>sum+row.knownDressings,0)),dailyService,serviceDays,requiredTreasury:10000+serviceDays*dailyService};
}

// Supply the actual recovered party before requesting another battle. The
// unavailable capital guns keep their original physical custody and charges.
export function prepareLivingCreatedNorthernSupply(start,{report=()=>{},...options}={}){
 const before=structuredClone(start),plan=livingNorthernSupplyPlan(start,options),originalGuns=guns(start),deaths=Object.entries(start.operativeState).filter(([,r])=>!r.alive);
 let c=decodeSave(encodeSave(start)).campaign,phase='retained-rest';const events=[];
 const emit=e=>{events.push(e);report(e);};
 const safe=()=>{assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);assert.equal(c.defeated,false);assert.equal(c.completed,false);assert.deepEqual(living(c),plan.keepers);for(const id of plan.keepers){const r=c.operativeState[id],expiry=contractExpiresSeconds(c.contracts[id]);assert.ok(r.alive&&!r.captured&&r.hp===r.maxHp&&!r.bleeding);assert.ok(expiry===null||expiry>clock(c));for(const slot of ['headwear','outfit','legwear'])assert.deepEqual(r[slot],start.operativeState[id][slot],'The supply journey keeps the actual clothing record.');}for(const[id,r]of deaths){assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[id].deathMinute,r.deathMinute);}assert.deepEqual(guns(c),originalGuns);};
 const issue=action=>{const time=clock(c),cash=c.resources.treasury,next=dispatchCampaign(c,action);if(next.lastError){emit({event:'livingNorthernOrderRefused',phase,action,reason:next.lastError,hour:c.hour,second:c.secondOfHour??0});throw Error(JSON.stringify(action)+' '+next.lastError);}c=next;safe();emit({event:'livingNorthernOrder',phase,action,startSeconds:time,endSeconds:clock(c),treasuryBefore:cash,treasuryAfter:c.resources.treasury});};
 const retain=seconds=>{const until=clock(c)+seconds;for(const id of plan.keepers){let expiry=contractExpiresSeconds(c.contracts[id]);while(expiry!==null&&expiry<=until){const quote=contractRenewalQuote(c,rosterFor(c).find(op=>op.id===id),'day'),cash=c.resources.treasury,action={type:'renewContract',id,term:'day',expectedExpiresAt:c.contracts[id].expiresAt};assert.equal(quote.available,true,quote.reason);issue(action);assert.equal(c.resources.treasury,cash-quote.price);assert.equal(c.contracts[id].expiresAt,quote.expiresAt);assert.equal(c.contracts[id].expiresSecond??0,quote.expiresSecond??0);const next=contractExpiresSeconds(c.contracts[id]);assert.ok(next>expiry);expiry=next;emit({event:'livingNorthernRenewal',phase,id,quote,action});}}};
 const wait=hours=>{assert.ok(Number.isSafeInteger(hours)&&hours>=1&&hours<=24);const until=clock(c)+hours*3600;let pauses=0;for(let attempts=0;clock(c)<until&&attempts<hours+3;attempts++){const time=clock(c),remaining=until-time;assert.equal(remaining%3600,0);retain(remaining+1);issue({type:'wait',hours:remaining/3600});const elapsed=clock(c)-time;assert.ok(elapsed>=0&&elapsed<=remaining);if(!elapsed){const notice=expandedCapitalWaitNotice(c,{startedSeconds:time,requestedHours:remaining/3600});assert.ok(++pauses<=3);emit({event:'livingNorthernWaitPaused',phase,notice,remainingSeconds:until-clock(c)});}else pauses=0;}assert.equal(clock(c),until);};
 const adopt=(name,transform)=>{retain(24*3600+1);const receipts=[],next=transform(c,e=>receipts.push(e));c=next;safe();for(const e of receipts)emit(e);emit({event:'livingNorthernPhaseAdopted',phase,name,hour:c.hour,second:c.secondOfHour??0,treasury:c.resources.treasury});};
 const ready=(id,morale)=>{const r=c.operativeState[id];return !r.asleep&&r.energy===100&&!r.fatigue&&(!morale||r.morale>=baseMorale(rosterFor(c).find(op=>op.id===id)));};
 const rest=(ids,limit,morale=true)=>{for(const operativeId of ids)issue({type:'assignCare',operativeId,assignment:'rest'});const time=clock(c);while(clock(c)-time<limit*3600&&!ids.every(id=>ready(id,morale))){for(const id of ids)if(c.operativeState[id].asleep&&c.operativeState[id].energy===100)issue({type:'setSleep',operativeId:id,asleep:false});if(ids.every(id=>ready(id,morale)))break;wait(1);}assert.ok(ids.every(id=>ready(id,morale)),'The actual force must reach full energy, no fatigue and native base morale within the original rest bound.');emit({event:'livingNorthernRestReady',phase,ids,elapsedSeconds:clock(c)-time});};
 const form=(ids,sector,name)=>{assert.ok(ids.length&&ids.length<=6);issue({type:'createSquad',ids,sector,name});return c.activeSquadId;};
 const move=(id,destination)=>{issue({type:'selectSquad',id});adopt('actual retained public journey',(input,r)=>prepareRouteBattery(input,[],{destination,keepServing:plan.keepers,waypointsFor:saltaBatteryWaypoints,report:r}).campaign);const group=c.squads.find(q=>q.id===id);assert.equal(group.location,destination);assert.equal(group.journey,undefined);for(const member of group.members)assert.equal(c.operativeState[member].location,destination);};
 const kitTotal=()=>plan.field.reduce((sum,id)=>sum+(c.operativeState[id].medkits??0),0);
 try{
  assert.ok(c.resources.treasury>=plan.requiredTreasury,'The real banked treasury must cover the quoted rest/logistics service horizon.');rest(plan.keepers,plan.maxRestHours);emit({event:'livingNorthernPaidRest',plan,campaign:structuredClone(c)});
  const logisticsStart=clock(c);phase='owned-longguns';issue({type:'configureArtillery',types:[]});for(const id of plan.field){const op=rosterFor(c).find(op=>op.id===id);if(c.operativeState[id].weaponDropped||![1800,1801,1802].includes(op.weapon))adopt('real local long gun',(input,r)=>recoverRoutePrimary(input,id,{preferredWeapon:1801,strictPreference:true,replace:true,report:r}));}
  phase='medical-courier';const deficit=Math.max(0,plan.field.length*plan.dressings-kitTotal());
  if(deficit){
   const candidates=plan.field.filter(id=>{try{applyItemQuantity(sectorInventoryModel(c,plan.hospital,rosterFor(c),id).personal,{item:'medkits',count:20,weight:.2});return true;}catch{return false;}}).sort((a,b)=>inventoryUsage(sectorInventoryModel(c,plan.hospital,rosterFor(c),b).personal).free-inventoryUsage(sectorInventoryModel(c,plan.hospital,rosterFor(c),a).personal).free||a-b);
   const ids=candidates.slice(0,Math.ceil(deficit/20));assert.ok(ids.length===Math.ceil(deficit/20)&&ids.length<=6,'Actual courier pockets must hold the requested additional linen.');const group=form(ids,plan.hospital,'Vendas del Norte'),initial=Object.fromEntries(ids.map(id=>[id,c.operativeState[id].medkits??0]));
   for(const source of plan.sources){
    if(kitTotal()>=plan.field.length*plan.dressings)break;assert.ok(c.sectors[source.sector].owner==='patriot'&&!occupied(c,source.sector));move(group,source.sector);rest(ids,48,false);
    for(const id of ids){
     let remaining=Math.min(plan.field.length*plan.dressings-kitTotal(),20-(c.operativeState[id].medkits-initial[id]));
     while(remaining>0){const sourceRow=medical(c,source.sector).find(row=>sectorInventoryModel(c,row.siteId,rosterFor(c),id).entries.some(item=>item.key===row.key&&item.reachable));if(!sourceRow)break;const model=sectorInventoryModel(c,sourceRow.siteId,rosterFor(c),id);let count=Math.min(remaining,sourceRow.count);while(count>0){try{applyItemQuantity(model.personal,{...JSON.parse(sourceRow.expected),count});break;}catch{count--;}}if(!count)break;const old=c.operativeState[id].medkits??0,time=clock(c),cash=c.resources.treasury,pool=()=>sectorInventoryModel(c,sourceRow.siteId,rosterFor(c),id).entries.filter(row=>JSON.parse(row.expected).item==='medkits').reduce((sum,row)=>sum+row.count,0),poolBefore=pool();issue({type:'sectorInventory',sector:sourceRow.siteId,operativeId:id,direction:'take',sourceKey:sourceRow.key,expected:sourceRow.expected,count});assert.equal(c.operativeState[id].medkits,old+count);assert.equal(clock(c),time);assert.equal(c.resources.treasury,cash);assert.equal(pool(),poolBefore-count,'The actual medical pool loses exactly the carried quantity even when an emptied container slot compacts.');emit({event:'livingNorthernMedicalSource',sector:sourceRow.siteId,operativeId:id,sourceKey:sourceRow.key,expected:sourceRow.expected,count,remaining:sourceRow.count-count,knownPoolBefore:poolBefore,knownPoolAfter:pool()});remaining-=count;}
     if(remaining>0){adopt('ordinary visible-remains inspection',(input,r)=>recoverVisibleRouteDressings(input,id,remaining,{report:r}).campaign);rest([id],48,false);}
    }
    // Carry only the same actual source rounds. No occupied-capital pool is
    // consulted, and a missing family remains a public shortage.
    const ammunitionIds=ids.filter(id=>{const u=carriedAmmunition(rosterFor(c).find(op=>op.id===id),c.operativeState[id]),family=ammoTypeFor(u);return family==='ammoMusket'&&u.loaded+ammoCount(u,family)<32;});
    if(ammunitionIds.length&&source.sector==='santa_fe')adopt('finite courier musket reserves',(input,r)=>supplyRouteAmmunition(input,ammunitionIds,{target:32,report:r}).campaign);
   }
   assert.ok(kitTotal()>=plan.field.length*plan.dressings,'Actual known pickups and public visible inspection must supply all original ten-dressing loads.');move(group,plan.hospital);rest(ids,48,false);emit({event:'livingNorthernMedicalCourierReady',ids,carried:kitTotal(),campaign:structuredClone(c)});
  }
  phase='field-loads';const reserves=Object.fromEntries(plan.field.map(id=>[id,plan.dressings]));for(const id of plan.field)if(c.operativeState[id].medkits<plan.dressings)adopt('real carried dressing donation',(input,r)=>supplyRouteDressings(input,id,plan.dressings,{reserves,report:r}));
  // The courier reserves become ordinary loose local sources for the actual
  // recipients. Each drop keeps its ammunition family and physical quantity.
  for(const id of plan.field){const u=carriedAmmunition(rosterFor(c).find(op=>op.id===id),c.operativeState[id]),family=ammoTypeFor(u),surplus=u.loaded+ammoCount(u,family)-plan.rounds;if(surplus>0)issue({type:'ammunition',operativeId:id,family,quantity:surplus,direction:'store'});}
  for(let offset=0;offset<plan.field.length;offset+=6){const ids=plan.field.slice(offset,offset+6),group=form(ids,plan.hospital,'Columna recuperada del Norte');adopt('finite sixteen-round field loads',(input,r)=>supplyRouteAmmunition(input,ids,{target:plan.rounds,report:r}).campaign);for(const operativeId of ids)issue({type:'assignCare',operativeId,assignment:'active'});adopt('ordinary paid reload',(input,r)=>finishReloadsBeforeMarch(input,{report:r}));adopt('ordinary primary activation',activatePrimaries);assert.equal(c.activeSquadId,group);}
  phase='departure-rest';rest(plan.keepers,48);assert.ok(clock(c)-logisticsStart<=plan.logisticsHours*3600,'Complete the actual courier and supply within the quoted logistics horizon.');for(const id of plan.field){const r=c.operativeState[id],u=carriedAmmunition(rosterFor(c).find(op=>op.id===id),r),family=ammoTypeFor(u);assert.ok([1800,1801,1802].includes(u.weapon)&&u.loaded>0&&!u.jammed);assert.ok(u.loaded+ammoCount(u,family)>=plan.rounds);assert.ok(r.medkits>=plan.dressings&&ready(id,true));}assert.equal(c.operativeState[plan.commanderId].location,plan.hospital);assert.deepEqual(c.enemyGroups,start.enemyGroups);assert.deepEqual(c.enemyReserves,start.enemyReserves);assert.deepEqual(start,before);assert.deepEqual(decodeSave(encodeSave(c)).campaign,c);emit({event:'livingNorthernSupplyReady',plan,hour:c.hour,second:c.secondOfHour??0,treasury:c.resources.treasury,campaign:structuredClone(c),scope:'Finite original-readiness supply and retained rest only; physical capital guns stay unavailable under the actual wave7. No northern request, native victory or ending claim.'});return c;
 }catch(error){assert.deepEqual(start,before);emit({event:'livingNorthernSupplyStopped',phase,reason:error.message,input:structuredClone(start),lastObservedCampaign:structuredClone(c),scope:'Actual accepted orders before a whole preparation failure. Diagnostic only; do not adopt as a completed supply phase.'});throw error;}
}

// Native coordinated admission accepts multiple public six-person columns.
// Empty guns behind the actual naval occupation stay in that physical scene.
export function prepareLivingCreatedNorthernRequest(start,{report=()=>{},target='tucuman',commanderId=57,hospital='cordoba',...options}={}){
 const before=structuredClone(start),keepers=living(start),field=keepers.filter(id=>id!==commanderId),originalGuns=guns(start);let c=prepareLivingCreatedNorthernSupply(start,{report,commanderId,hospital,...options});const groups=[];
 const order=action=>{if(action.type==='wait')for(const id of keepers){let expiry=contractExpiresSeconds(c.contracts[id]);while(expiry!==null&&expiry<=clock(c)+action.hours*3600+1){const quote=contractRenewalQuote(c,rosterFor(c).find(op=>op.id===id),'day'),cash=c.resources.treasury,n=dispatchCampaign(c,{type:'renewContract',id,term:'day',expectedExpiresAt:c.contracts[id].expiresAt});assert.equal(n.lastError,null);c=n;assert.equal(c.resources.treasury,cash-quote.price);expiry=contractExpiresSeconds(c.contracts[id]);report({event:'livingNorthernApproachRenewal',id,quote});}}const cash=c.resources.treasury,time=clock(c),n=dispatchCampaign(c,action);assert.equal(n.lastError,null,JSON.stringify(action)+' '+n.lastError);c=n;report({event:'livingNorthernApproachOrder',action,startSeconds:time,endSeconds:clock(c),treasuryBefore:cash,treasuryAfter:c.resources.treasury});};
 order({type:'createSquad',ids:[commanderId],sector:hospital,name:'Reserva del mando'});order({type:'configureArtillery',types:[]});
 for(let offset=0;offset<field.length;offset+=6){const ids=field.slice(offset,offset+6);order({type:'createSquad',ids,sector:hospital,name:'Infantería del Norte'});groups.push(c.activeSquadId);for(const operativeId of ids)order({type:'assignCare',operativeId,assignment:'active'});order({type:'attack',sector:target,queue:true,mode:'posta'});}
 for(let h=0;h<24&&!groups.every(id=>c.squads.find(q=>q.id===id).journey?.status==='ready');h++){assert.equal(c.pendingEncounter,null);order({type:'wait',hours:1});}
 assert.ok(groups.every(id=>c.squads.find(q=>q.id===id).journey?.status==='ready'));order({type:'beginAssault',sector:target});assert.equal(c.pendingBattle.sector,target);assert.deepEqual(c.pendingBattle.squad.map(u=>u.id).sort((a,b)=>a-b),field.slice().sort((a,b)=>a-b));assert.ok(c.pendingBattle.assaultSquads.every(q=>q.members.length<=6));assert.deepEqual(c.pendingBattle.artillery,[]);assert.deepEqual(guns(c),originalGuns);
 for(const id of field){const r=c.operativeState[id],op=rosterFor(c).find(op=>op.id===id),u=carriedAmmunition(op,r);assert.equal(r.hp,r.maxHp);assert.equal(r.bleeding,0);assert.equal(r.energy,100);assert.equal(r.fatigue,0);assert.equal(r.asleep,false);assert.ok(r.morale>=baseMorale(op));assert.equal(r.activeSlot,'primary');assert.ok(u.loaded>0&&!u.jammed&&u.loaded+ammoCount(u)>=16&&r.medkits>=10);}
 assert.deepEqual(living(c),keepers);assert.equal(c.operativeState[commanderId].location,hospital);for(const[id,r]of Object.entries(start.operativeState))if(!r.alive){assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[id].deathMinute,r.deathMinute);}assert.equal(c.blockade,start.blockade);const battle=enterSector(c.pendingBattle,c.sectorStates[target]);assert.deepEqual(decodeSave(encodeSave(c,battle)),{campaign:c,battle});assert.deepEqual(start,before);report({event:'livingNorthernRequestReady',field,keepers,groups,target,hour:c.hour,second:c.secondOfHour??0,treasury:c.resources.treasury,campaign:structuredClone(c),scope:'Actual full-readiness paid infantry request and official paired admission only. Native victory, all remaining northern waves and final coastal group7/end48h remain open.'});return c;
}
