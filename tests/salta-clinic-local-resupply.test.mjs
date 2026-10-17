import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultContentPackage,validateContentPackage} from '../game/content-package.js';
import {DEFAULT_WORLD} from '../campaigns/default.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {actBattle,presentedActBattle} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {syncBattleTime} from '../game/time.js';
import {stageOpeningRearCover} from './opening-rear-guard.mjs';
import {discoverRouteCache} from './finite-route-equipment.mjs';
import {supplySaltaClinicDoctors} from './salta-clinic-supply.mjs';

const clock=c=>c.hour*3600+(c.secondOfHour??0);
const order=(c,a)=>{const n=dispatchCampaign(c,a);assert.equal(n.lastError,null,JSON.stringify(a)+': '+n.lastError);return n;};
const saved=c=>{const n=decodeSave(encodeSave(c)).campaign;assert.deepEqual(n,c);return n;};
function setup({kits=2,delay=0,price=180,localKits=0,cache=0,threat=false,nearExpiry=false,healthy=false,fullSquads=false}={}){
 const content=defaultContentPackage();content.headquarters='cordoba';content.rules.startingTreasury=20000;content.startingTerritory.tucuman.owner='patriot';content.startingTerritory.cordoba.owner='patriot';content.world=structuredClone(DEFAULT_WORLD);
 for(const at of ['tucuman','cordoba'])content.world.physical.caches[at].contents=content.world.physical.caches[at].contents.filter(row=>row.item!=='medkits');
 if(cache)content.world.physical.caches.tucuman.contents.push({item:'medkits',count:cache,weight:.2});
 // The installed historical scenario releases its ordinary northern raid at hour120.
 for(const p of content.characters){if(p.service==='contract')p.arrivalHours=0;p.startingSupplies={rations:0,torches:0,medkits:0,boleadoras:0};}
 for(const id of [122,130])content.characters.find(p=>p.id===`person-${id}`).arrivalHours=0;
 const patient=content.characters.find(p=>p.id==='person-130');patient.attributes={...patient.attributes,maxHp:66};patient.startingCondition={hp:threat?20:healthy?66:54,bleeding:0,bandaged:threat?46:healthy?0:12,energy:100,fatigue:0};patient.startingSupplies.medkits=localKits;
 const doctor=content.characters.find(p=>p.id==='person-122');doctor.attributes={...doctor.attributes,medical:85};
 const relief=content.characters.find(p=>p.id==='person-100');relief.monthlyPay=price;relief.arrivalHours=delay;relief.startingSupplies.medkits=kits;relief.serviceGuarantee=17;
 if(fullSquads){
  for(const id of [101,102,103,104,105,106,108])content.characters.find(p=>p.id===`person-${id}`).monthlyPay=180;
  const second=content.characters.find(p=>p.id==='person-107');second.startingSupplies.medkits=2;second.monthlyPay=720;
 }
 assert.deepEqual(validateContentPackage(content),[]);const declared=structuredClone(content);let c=initialCampaign(42,content);
 for(const id of [122,130])c=order(c,{type:'recruitCivic',id,term:nearExpiry?'day':threat?'fortnight':'week',destination:'tucuman'});
 c=stageOpeningRearCover(c,{sector:'tucuman'}).campaign;
 if(fullSquads){
  for(const id of [101,102,103,104,105,106,108]){c=order(c,{type:'recruitCivic',id,term:'week',destination:'cordoba'});c=order(c,{type:'createSquad',sector:'cordoba',name:'Servicio local '+id,ids:[id]});}
  const field=c.squads.find(q=>q.location==='cordoba'&&q.members.length&&!q.journey);assert.ok(field);c=order(c,{type:'selectSquad',id:field.id});
  c=order(c,{type:'assignCare',operativeId:130,assignment:'patient'});assert.equal(c.squads.filter(q=>q.members.length).length,8);
 }
 if(cache)c=discoverRouteCache(c,122);
 if(nearExpiry)for(let n=0;c.hour<23&&n<30;n++)c=order(c,{type:'wait',hours:23-c.hour});
 if(threat){for(let n=0;c.hour<120&&n<160;n++)c=order(c,{type:'wait',hours:Math.min(24,120-c.hour)});assert.equal(c.hour,120);const group=c.enemyGroups.find(g=>g.target==='tucuman'&&g.status==='marching');assert.ok(group);for(let n=0;c.hour<group.arrivalAt-1&&n<80;n++)c=order(c,{type:'wait',hours:Math.min(24,group.arrivalAt-1-c.hour)});assert.equal(c.hour,group.arrivalAt-1);assert.equal(c.pendingEncounter,null);}
 assert.deepEqual(content,declared);return saved(c);
}
function replay(start,result){
 let c=start,b=null,shown=null,validated=null;
 for(const row of result.actions){
  if(row.tactical){
   assert.ok(b);b=actBattle(b,row.action);assert.equal(b.lastError,null);shown=presentedActBattle(shown,row.action).state;validated=validateBattleSnapshot(JSON.parse(JSON.stringify(actBattle(validated,row.action))));assert.deepEqual(shown,b);assert.deepEqual(validated,b);
   const synced=syncBattleTime(c,b);assert.equal(synced.error,null);c=synced.campaign;b=synced.battle;shown=structuredClone(b);validated=validateBattleSnapshot(JSON.parse(JSON.stringify(b)));
  }else{
   if(row.action.type==='leaveSector')assert.deepEqual(row.action.sectorState,b);
   c=order(c,row.action);
   if(row.action.type==='visitSector'){b=enterSector(c.pendingBattle,c.sectorStates.tucuman);shown=structuredClone(b);validated=validateBattleSnapshot(JSON.parse(JSON.stringify(b)));}
   if(row.action.type==='leaveSector')b=null;
  }
 }
 assert.deepEqual(c,result.campaign);assert.deepEqual(saved(c),c);
}
const supply=(c,options={})=>supplySaltaClinicDoctors(c,[122],{deadlineSeconds:clock(c)+72*3600,...options});

test('repeat local supply pays one real pack, preserves old posts and spends each dressing on actual current wounds',()=>{
 const start=setup(),before=structuredClone(start),first=supply(start),c=first.campaign,hire=first.hires[0];
 assert.equal(first.supplied,true);assert.equal(first.hires.length,1);assert.equal(hire.id,100);assert.equal(hire.quote.total,contractQuote(start,rosterFor(start).find(op=>op.id===100),'day').total);
 assert.equal(c.resources.treasury,start.resources.treasury-hire.quote.total);assert.equal(c.operativeState[122].medkits,1);assert.equal(c.operativeState[100].medkits,1);
 assert.equal(first.actions.filter(row=>row.action.type==='visitSector').length,1);assert.deepEqual(first.receipts.find(row=>row.kind==='new-relief-cover').initial.units.filter(u=>u.side==='player').map(u=>u.id),['100']);
 for(const id of [122,130])assert.deepEqual(c.operativeState[id].residentPosition,start.operativeState[id].residentPosition);assert.ok(c.operativeState[100].residentPosition.tacticalLevel>0);assert.equal(c.activeSquadId,start.activeSquadId);
 assert.equal(first.actions.some(row=>row.action.type==='travel'),false);assert.deepEqual(start,before);replay(start,first);assert.deepEqual(supply(saved(start)),first);
 let treated=order(order(c,{type:'assignCare',operativeId:122,assignment:'doctor'}),{type:'assignCare',operativeId:130,assignment:'patient'});const at=clock(treated);
 for(let n=0;clock(treated)===at&&n<3;n++)treated=order(treated,{type:'wait',hours:1});assert.equal(clock(treated)-at,3600);assert.equal(treated.operativeState[130].hp,60);assert.equal(treated.operativeState[122].medkits,0);
 const second=supply(treated);assert.equal(second.hires.length,0);assert.equal(second.actions.some(row=>row.action.type==='visitSector'),false);assert.equal(second.donatedDressings,1);assert.equal(second.campaign.operativeState[100].medkits,0);replay(treated,second);
 let done=second.campaign;const next=clock(done);for(let n=0;clock(done)===next&&n<3;n++)done=order(done,{type:'wait',hours:1});assert.equal(done.operativeState[130].hp,66);assert.equal(done.operativeState[122].medkits,0);assert.equal(done.resources.treasury,start.resources.treasury-hire.quote.total);assert.deepEqual(saved(done),done);
});

test('known admitted local stock and the patient own finite pack are used before any paid arrival',()=>{
 for(const options of [{cache:2,kits:0},{localKits:2,kits:0}]){
  const start=setup(options),before=structuredClone(start),result=supply(start,{minimumDressings:2});assert.equal(result.supplied,true);assert.equal(result.hires.length,0);assert.equal(result.actions.some(row=>row.action.type==='recruitCivic'||row.action.type==='travel'||row.action.type==='visitSector'),false);
  assert.equal(result.campaign.resources.treasury,start.resources.treasury);assert.equal(result.campaign.operativeState[122].medkits,2);assert.equal(clock(result.campaign),clock(start));assert.deepEqual(start,before);replay(start,result);
 }
});

test('unaffordable or exhausted actual packs refuse before booking and preserve the exact input',()=>{
 for(const options of [{price:200000},{kits:0}]){
  const start=setup(options),before=structuredClone(start);let error;try{supply(start);}catch(e){error=e;}
  assert.match(error?.message??'',/finite clinic deficit needs a real available paid relief guard/);assert.deepEqual(error.campaign,start);assert.deepEqual(error.clinicLocalSupply.actions,[]);assert.deepEqual(error.clinicLocalSupply.hires,[]);assert.deepEqual(start,before);
 }
});

test('a real delayed local arrival retains actual old service, pays its own terms and stages only its new body',()=>{
 const start=setup({delay:2,nearExpiry:true}),before=structuredClone(start),result=supply(start),c=result.campaign,hire=result.hires[0];assert.equal(result.supplied,true);assert.equal(result.hires.length,1);assert.ok(result.renewals.some(row=>row.id===122));assert.ok(result.renewals.some(row=>row.id===130));
 assert.equal(c.hiringArrivals.length,0);assert.ok(clock(c)>=clock(start)+7200);assert.equal(c.contracts[100].started,start.hour+2);assert.equal(contractExpiresSeconds(c.contracts[100]),(start.hour+26)*3600+(start.secondOfHour??0));
 assert.equal(c.resources.treasury,start.resources.treasury-hire.quote.total-result.renewals.reduce((n,row)=>n+row.quote.price,0));for(const id of [122,130,100])assert.ok(contractExpiresSeconds(c.contracts[id])>clock(c));assert.deepEqual(start,before);replay(start,result);
});

test('a real raid interrupts a paid delayed local booking without a second booking or ignored clock step',()=>{
 const start=setup({delay:8,threat:true}),before=structuredClone(start);let failure;try{supply(start);}catch(error){failure=error;}
 assert.match(failure?.message??'',/actual local supply interruption/);assert.equal(failure.campaign.pendingEncounter.sector,'tucuman');assert.equal(failure.clinicLocalSupply.hires.length,1);assert.equal(failure.clinicLocalSupply.actions.filter(row=>row.action.type==='recruitCivic').length,1);assert.equal(failure.clinicLocalSupply.actions.at(-1).action.type,'wait');
 assert.ok(failure.campaign.hiringArrivals.some(a=>a.operativeId===100));assert.equal(failure.campaign.operativeState[100].medkits,2);assert.equal(failure.campaign.resources.treasury,start.resources.treasury-failure.clinicLocalSupply.hires[0].quote.total);assert.deepEqual(start,before);
 replay(start,{campaign:failure.campaign,actions:failure.clinicLocalSupply.actions});const current=structuredClone(failure.campaign);let again;try{supply(current);}catch(error){again=error;}assert.deepEqual(again.campaign,current);assert.deepEqual(again.clinicLocalSupply.actions,[]);assert.deepEqual(again.clinicLocalSupply.hires,[]);
});


test('a delayed finite pack cannot reset or spend past the actual remaining clinic deadline',()=>{
 const start=setup({delay:2}),before=structuredClone(start),deadline=clock(start)+3600;let failure;try{supply(start,{deadlineSeconds:deadline});}catch(error){failure=error;}
 assert.match(failure?.message??'',/shared 72-hour allowance/);assert.ok(failure.campaign);assert.ok(clock(failure.campaign)<=deadline);assert.equal(failure.clinicLocalSupply.hires.length,1);assert.ok(failure.campaign.hiringArrivals.some(a=>a.operativeId===100));assert.equal(failure.campaign.resources.treasury,start.resources.treasury-failure.clinicLocalSupply.hires[0].quote.total);assert.deepEqual(start,before);replay(start,{campaign:failure.campaign,actions:failure.clinicLocalSupply.actions});
});


test('completed care does not erase the calm physician actual two-dressing defensive reserve',()=>{
 const start=setup({healthy:true,localKits:2,kits:0}),before=structuredClone(start),ordinary=supply(start,{minimumDressings:2});assert.equal(start.operativeState[130].hp,66);assert.equal(ordinary.campaign.operativeState[122].medkits,0);assert.deepEqual(ordinary.actions,[]);assert.deepEqual(ordinary.campaign,start);
 const result=supply(start,{minimumDressings:2,reserveDressings:2});assert.equal(result.supplied,true);assert.equal(result.reserveDressings,2);assert.equal(result.hires.length,0);assert.equal(result.campaign.operativeState[122].medkits,2);assert.equal(result.campaign.operativeState[130].medkits,0);assert.equal(result.donatedDressings,2);assert.equal(result.gatheredDressings,2);assert.equal(result.campaign.resources.treasury,start.resources.treasury);assert.equal(clock(result.campaign),clock(start));for(const id of [122,130])assert.equal(result.campaign.operativeState[id].hp,start.operativeState[id].hp);assert.deepEqual(start,before);replay(start,result);assert.deepEqual(supply(saved(start),{minimumDressings:2,reserveDressings:2}),result);
});


test('an interrupted resolver refusal preserves its later actual accepted Native campaign',()=>{
 const start=setup({delay:8,threat:true}),before=structuredClone(start);let callbackInput,callbackAction,accepted,refusal,failure;
 try{supply(start,{resolveEncounter:current=>{
  callbackInput=structuredClone(current);callbackAction={type:'respondToEncounter',groupId:current.pendingEncounter.groupId,choice:'tactical'};accepted=order(current,callbackAction);assert.equal(accepted.pendingEncounter,null);assert.equal(accepted.pendingBattle.sector,'tucuman');refusal=Error('Declared refusal after actual Native encounter admission.');refusal.campaign=accepted;throw refusal;
 }});}catch(error){failure=error;}
 assert.equal(failure,refusal);assert.ok(accepted);assert.deepEqual(failure.campaign,accepted);assert.notDeepEqual(failure.campaign,callbackInput);assert.equal(failure.campaign.pendingBattle.defenseGroupId,callbackAction.groupId);assert.equal(failure.clinicLocalSupply.hires.length,1);assert.ok(failure.campaign.hiringArrivals.some(a=>a.operativeId===100));assert.deepEqual(start,before);
 replay(start,{campaign:callbackInput,actions:failure.clinicLocalSupply.actions});assert.deepEqual(order(callbackInput,callbackAction),accepted);const initial=enterSector(accepted.pendingBattle,accepted.sectorStates.tucuman),pair=decodeSave(encodeSave(accepted,initial));assert.deepEqual(pair.campaign,accepted);assert.deepEqual(pair.battle,initial);
});

test('eight occupied squads reuse a real local group for two paid solo relief visits without changing old posts or duties',()=>{
 const start=setup({fullSquads:true}),before=structuredClone(start),blocked=dispatchCampaign(start,{type:'createSquad',sector:'tucuman',name:'Novena escuadra',ids:[122]});assert.match(blocked.lastError??'',/ocho escuadras/);
 const result=supply(start,{minimumDressings:4,reserveDressings:4}),c=result.campaign,visits=result.receipts.filter(row=>row.kind==='new-relief-cover');
 assert.equal(result.hires.length,2);assert.equal(visits.length,2);assert.equal(result.actions.some(row=>row.action.type==='createSquad'),false);assert.equal(c.squads.filter(q=>q.members.length).length,8);assert.deepEqual(c.squads,start.squads);assert.equal(c.activeSquadId,start.activeSquadId);assert.deepEqual(c.squad,start.squad);
 for(const id of start.recruited){assert.equal(c.operativeState[id].assignment,start.operativeState[id].assignment);assert.deepEqual(c.operativeState[id].residentPosition,start.operativeState[id].residentPosition);assert.equal(c.operativeState[id].hp,start.operativeState[id].hp);assert.equal(c.operativeState[id].alive,true);assert.equal(c.operativeState[id].captured,false);assert.ok(contractExpiresSeconds(c.contracts[id])===null||contractExpiresSeconds(c.contracts[id])>clock(c));}
 for(const receipt of visits){assert.deepEqual(receipt.initial.units.filter(u=>u.side==='player').map(u=>u.id),[String(receipt.id)]);assert.ok(receipt.steps.some(action=>action.type==='move'));assert.ok(c.operativeState[receipt.id].residentPosition.tacticalLevel>0);assert.equal(c.operativeState[receipt.id].location,'tucuman');}
 assert.equal(c.operativeState[122].medkits,4);assert.equal(result.hires.reduce((n,row)=>n+row.kits,0),4);assert.equal(c.recruited.reduce((n,id)=>n+c.operativeState[id].medkits,0),4);assert.equal(c.resources.treasury,start.resources.treasury-result.hires.reduce((n,row)=>n+row.quote.total,0)-result.renewals.reduce((n,row)=>n+row.quote.price,0));
 assert.deepEqual(start,before);replay(start,result);assert.deepEqual(supply(saved(start),{minimumDressings:4,reserveDressings:4}),result);
});
