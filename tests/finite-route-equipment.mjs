import assert from 'node:assert/strict';
import {rosterFor} from '../packages/game/campaign.js';
import {operativeLocation} from '../packages/game/squads.js';
import {sectorInventoryModel,sectorInventorySites} from '../packages/game/sector-inventory.js';
import {applyItemQuantity} from '../packages/game/tactical-inventory.js';
import {finiteCachesFor} from '../packages/game/campaign-physical.js';
import {repairMaterialPoints} from '../packages/game/repair-materials.js';
import {WEAPONS} from '../packages/game/data.js';
import {order,visit,saved} from './local-contract-fixture.mjs';
import {advanceCampaignHours} from './campaign-wait-fixture.mjs';
import {takeFiniteCache,leaveFiniteCache} from './finite-cache-driver.mjs';
import {transportPath} from '../packages/game/logistics.js';
import {contractExpiresSeconds,contractRenewalQuote} from '../packages/game/contracts.js';
import {completeTestTravel} from './campaign-test-helpers.mjs';
import {workAssignmentReason} from '../packages/game/assignments.js';
import {previewStrategicRoute} from '../packages/game/strategic-route.js';
import {cellTravelPlan} from '../packages/game/world-cells.js';
import {tooTiredToMarch} from '../packages/game/march-fatigue.js';

// Public collection at the actual person's location. Temporarily return a
// local squad to service only when it must physically discover its cache.
export function discoverRouteCache(state,operativeId){
 let s=state;const sector=operativeLocation(s,operativeId),cacheId=finiteCachesFor(s)[sector]?.chest;
 if(!cacheId)return s;
 const chest=s.sectorStates[sector]?.props?.find(prop=>prop.id===cacheId);
 if(chest?.open&&chest.knownToPlayer)return s;
 const previous=s.activeSquadId;
 if(s.location!==sector){const local=s.squads.find(q=>q.location===sector&&q.members.length&&!q.journey);assert.ok(local,'an actual local squad must discover the cache');s=order(s,{type:'selectSquad',id:local.id});}
 const assignments=s.squad.map(id=>({id,assignment:s.operativeState[id].assignment??'active'}));
 assert.ok(assignments.every(row=>['active','doctor','militia_doctor','patient','rest'].includes(row.assignment)),'finish actual training or repair work before visiting the cache');
 for(const {id}of assignments)s=order(s,{type:'assignCare',id,assignment:'active'});
 const pair=visit(s),carrier=pair.battle.units.filter(u=>u.side==='player'&&u.hp>=15&&!u.unconscious&&!u.routed&&!u.asleep&&(u.energy??100)>10).sort((a,b)=>b.energy-a.energy)[0];assert.ok(carrier,'a real awake carrier must reach the cache');
 s=leaveFiniteCache(takeFiniteCache(pair,carrier.id,[],{cacheId}));
 for(const {id,assignment}of assignments)if(assignment!=='active'&&(!['doctor','militia_doctor'].includes(assignment)||s.operativeState[id].medkits>0))s=order(s,{type:'assignCare',id,assignment});
 if(previous!==s.activeSquadId)s=order(s,{type:'selectSquad',id:previous});
 return s;
}

// An ordinary shortage can follow a paid discovery visit. Return that accepted
// prefix explicitly; a refused Native order still throws and ends the attempt.
export function attemptCollectRouteItems(state,operativeId,selector,requested,{discover=true,onOrder}={}){
 assert.ok(Number.isSafeInteger(requested)&&requested>0);
 assert.equal(typeof discover,'boolean');assert.ok(onOrder===undefined||typeof onOrder==='function');
 let s=state,collected=0;const sector=operativeLocation(s,operativeId);
 const take=()=>{
  while(collected<requested){
   // A completed mission keeps its own physical loot under the same locality.
   // Use only admitted sites and each scene's normal access checks.
   const source=sectorInventorySites(s,sector).map(site=>{
    const model=sectorInventoryModel(s,site.id,rosterFor(s),operativeId),row=model.entries.find(row=>row.reachable&&row.count>0&&Object.entries(selector).every(([key,value])=>JSON.parse(row.expected)[key]===value));
    return row?{siteId:site.id,model,row}:null;
   }).find(Boolean);
   if(!source)break;const {siteId,model,row}=source,stack=JSON.parse(row.expected);let count=Math.min(row.count,requested-collected);
   while(count>0){try{applyItemQuantity(model.personal,{...stack,count});break;}catch{count--;}}
   if(!count)break;
   const action={type:'sectorInventory',sector:siteId,operativeId,direction:'take',sourceKey:row.key,expected:row.expected,count};s=order(s,action);collected+=count;onOrder?.({campaign:s,action,collected});
  }
 };
 take();if(collected<requested&&discover){s=discoverRouteCache(s,operativeId);take();}
 return {campaign:saved({campaign:s}).campaign,collected,supplied:collected>0};
}

export function collectRouteItems(state,operativeId,selector,requested){
 const result=attemptCollectRouteItems(state,operativeId,selector,requested);
 assert.ok(result.supplied,`finite local equipment or carrying room is exhausted: ${operativeLocation(state,operativeId)} ${JSON.stringify(selector)}`);
 return {campaign:result.campaign,collected:result.collected};
}

// These are remembered finite rows, not permission to take them remotely.
// Even a local actor's quote cannot admit the travelling courier in advance.
export function knownRouteMedicalSources(state,clinic){
 const roster=rosterFor(state),sources=[];
 for(const at of Object.keys(state.sectors)){
  if(at===clinic||state.sectors[at].owner!=='patriot')continue;
  const path=transportPath(state,clinic,at);if(!path)continue;
  const rows=[],seen=new Set();
  for(const site of sectorInventorySites(state,at)){
   const model=sectorInventoryModel(state,site.id,roster,null);
   for(const row of model.entries){
    if(row.count<=0||JSON.parse(row.expected).item!=='medkits')continue;
    const identity=JSON.stringify([at,site.id,row.key]);if(seen.has(identity))continue;seen.add(identity);
    rows.push({siteId:site.id,kind:row.kind,count:row.count,operativeId:model.operativeId,admission:'remembered',accessAdmitted:false});
   }
  }
  const available=rows.reduce((sum,row)=>sum+row.count,0);
  if(available>0)sources.push({at,available,path,rows,admission:'remembered',accessAdmitted:false});
 }
 return sources.sort((a,b)=>b.available-a.available||a.path.length-b.path.length);
}

// Authored discovery is a separate fallback. Never read hidden runtime stock,
// and never replace a discovered exhausted chest with its initial contents.
export function authoredRouteMedicalDiscoveries(state,clinic){
 return Object.entries(finiteCachesFor(state)).flatMap(([at,cache])=>{
  if(at===clinic||state.sectors[at]?.owner!=='patriot')return [];
  const path=transportPath(state,clinic,at);if(!path)return [];
  const snapshot=state.sectorStates[at],chest=snapshot?.props?.find(prop=>prop.id===cache.chest);
  if(snapshot&&(!chest||chest.open&&chest.knownToPlayer))return [];
  const authoredCount=cache.contents.filter(stack=>stack.item==='medkits'&&stack.count>0).reduce((sum,stack)=>sum+stack.count,0);
  return authoredCount>0?[{at,path,authoredCount,admission:'discovery-required',accessAdmitted:false}]:[];
 }).sort((a,b)=>b.authoredCount-a.authoredCount||a.path.length-b.path.length);
}

export function recoverRouteFirearm(state,operativeId){
 let s=state;
 if(!s.operativeState[operativeId].weaponDropped)return s;
 s=discoverRouteCache(s,operativeId);const sector=operativeLocation(s,operativeId),model=()=>sectorInventoryModel(s,sector,rosterFor(s),operativeId);
 let gun=model().carried.find(row=>row.expected&&WEAPONS[JSON.parse(row.expected).weapon]?.capacity>0&&row.equip?.some(option=>option.slot==='primary'&&option.valid));
 if(!gun){const row=model().entries.find(row=>row.reachable&&WEAPONS[JSON.parse(row.expected).weapon]?.capacity>0);assert.ok(row,'a lost gun must be replaced by actual reachable finite equipment');
  const stack=JSON.parse(row.expected);s=order(s,{type:'sectorInventory',sector,operativeId,direction:'take',sourceKey:row.key,expected:row.expected,count:1});gun=model().carried.find(row=>row.expected&&JSON.parse(row.expected).weapon===stack.weapon&&JSON.parse(row.expected).instanceId===stack.instanceId);
 }
 assert.ok(gun);return order(s,{type:'sectorInventory',sector,operativeId,direction:'equip',inventoryKey:gun.inventoryKey,expected:gun.expected,slot:'primary'});
}

export function repairRouteFirearms(state,ids,{maxHours=48}={}){
 // Primary mechanical work restores wear. Ignition failures remain for the
 // ordinary paid reprime in finishReloadsBeforeMarch.
 let s=state;const targets=()=>ids.filter(id=>s.operativeState[id].alive&&!s.operativeState[id].weaponDropped&&s.operativeState[id].condition<100);
 for(let hour=0;targets().length&&hour<maxHours;hour++){
  let target=targets()[0];const site=operativeLocation(s,target);
  let roster=rosterFor(s),mechanic=roster.filter(op=>s.recruited.includes(op.id)&&s.operativeState[op.id].alive&&!s.operativeState[op.id].captured&&operativeLocation(s,op.id)===site&&op.mechanical>=20&&s.operativeState[op.id].hp>=15&&!s.operativeState[op.id].bleeding&&!s.operativeState[op.id].asleep&&s.operativeState[op.id].energy>10).sort((a,b)=>Number(repairMaterialPoints(s.operativeState[b.id])>0)-Number(repairMaterialPoints(s.operativeState[a.id])>0)||b.mechanical-a.mechanical)[0];assert.ok(mechanic,'actual repair needs a qualified available local mechanic');
  if(!repairMaterialPoints(s.operativeState[mechanic.id]))s=collectRouteItems(s,mechanic.id,{kind:'repair-kit'},1).campaign;
  // Cache discovery spends real time. Other work may finish the target,
  // and the selected carrier may no longer be awake or able to work.
  target=targets()[0];if(target===undefined)continue;
  const assignedToTarget=op=>{const r=s.operativeState[op.id];return r.assignment==='repair'&&r.repairTargetId===target&&r.repairScope!=='equipment';};
  roster=rosterFor(s);mechanic=roster.filter(op=>op.mechanical>=20&&!workAssignmentReason(s,op,'repair',{targetId:target,repairScope:'primary'},roster)).sort((a,b)=>Number(assignedToTarget(b))-Number(assignedToTarget(a))||b.mechanical-a.mechanical)[0];
  assert.ok(mechanic,'actual repair needs a current target and an awake local mechanic with finite materials');
  s=order(s,{type:'assignWork',operativeId:mechanic.id,assignment:'repair',targetId:target,repairScope:'primary'});const before=repairMaterialPoints(s.operativeState[mechanic.id]);s=advanceCampaignHours(s,1);assert.ok(repairMaterialPoints(s.operativeState[mechanic.id])<before,'real repair must consume carried material');s=order(s,{type:'assignCare',id:mechanic.id,assignment:'active'});
 }
 assert.deepEqual(targets(),[],'the actual finite repair plan must finish before departure');return s;
}


// When a clinic has exhausted its actual local stock, a paid doctor can carry
// dressings from another controlled cache. Patients stay in their real clinic;
// the journey, rest, contract extensions and source debit are ordinary orders.
export function collectRouteMedicalSupplies(start,operativeId,requested,{report=()=>{},resolveEncounter,mode='march',deadlineSeconds=null}={}){
 let s=start;const clinic=operativeLocation(s,operativeId),previous=s.activeSquadId,home=s.squads.find(q=>q.members.includes(operativeId)&&!q.journey),assignment=s.operativeState[operativeId].assignment;
 try{
 const clock=()=>s.hour*3600+(s.secondOfHour??0);let courierId=null;
 const bounded=deadlineSeconds!==null;
 assert.ok(!bounded||Number.isSafeInteger(deadlineSeconds)&&deadlineSeconds>=clock(),'An absolute medical deadline cannot precede its current accepted prefix.');
 assert.ok(!bounded||mode==='posta','Deadline-bound medical couriers need the ordinary queued posta route.');
 const admit=seconds=>assert.ok(!bounded||clock()+seconds<=deadlineSeconds,'The actual medical courier step must fit the remaining absolute clinic deadline.');
 const admittedPrefix=()=>{
  if(!bounded)return;
  assert.equal(s.pendingEncounter,null,'An actual encounter stops the deadline-bound medical courier.');
  assert.equal(s.pendingBattle,null,'An actual battle stops the deadline-bound medical courier.');
  assert.ok(s.recruited.includes(operativeId)&&s.operativeState[operativeId].alive&&!s.operativeState[operativeId].captured,'The actual deadline-bound courier must remain in living paid service.');
 };
 const issue=action=>{
  admit(action.type==='wait'?action.hours*3600:0);const next=order(s,action);
  if(bounded){s=next;admittedPrefix();}
  return next;
 };
 admittedPrefix();
 const needsRest=()=>s.operativeState[operativeId].asleep||tooTiredToMarch(s.operativeState[operativeId]);
 const retain=(seconds,phase)=>{
  for(const id of s.recruited.filter(id=>s.operativeState[id].alive&&!s.operativeState[id].captured)){
   let contract=s.contracts[id],expiry=contractExpiresSeconds(contract);
   while(expiry!==null&&expiry<=clock()+seconds){
    const quote=contractRenewalQuote(s,rosterFor(s).find(op=>op.id===id),'day');assert.equal(quote.available,true,quote.reason);
    const action={type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0},cash=s.resources.treasury;
    s=issue(action);assert.equal(s.resources.treasury,cash-quote.price);contract=s.contracts[id];
    assert.equal(contract.expiresAt,quote.expiresAt);assert.equal(contract.expiresSecond??0,quote.expiresSecond??0);
    report({event:'medicalCourierRenewal',id,cost:cash-s.resources.treasury,hour:s.hour,secondOfHour:s.secondOfHour??0,phase,action,quote});
    const extended=contractExpiresSeconds(contract);assert.ok(extended>expiry,'An actual courier renewal must extend its paid service.');expiry=extended;
   }
  }
 };
 const selectCourier=()=>{
  if(courierId!==null){if(s.activeSquadId!==courierId)s=issue({type:'selectSquad',id:courierId});return;}
  if(home)s=issue({type:'selectSquad',id:home.id});s=issue({type:'assignCare',id:operativeId,assignment:'active'});
  if(!home||home.members.length>1)s=issue({type:'createSquad',ids:[operativeId],name:'Vendas recuperadas',sector:clinic});
  courierId=s.activeSquadId;
 };
 const encounter=(phase,destination)=>{
  if(!s.pendingEncounter)return;
  assert.ok(!bounded,'An actual encounter stops the deadline-bound medical courier before another elapsed-time action.');
  assert.ok(typeof resolveEncounter==='function','resolve the actual medical courier encounter before continuing care');
  const before=clock();report({event:'medicalCourierEncounter',operativeId,clinic,destination,phase,encounter:structuredClone(s.pendingEncounter),hour:s.hour,secondOfHour:s.secondOfHour??0});
  s=resolveEncounter(s);assert.ok(clock()>=before,'An actual encounter cannot rewind the courier clock.');
  assert.equal(s.pendingEncounter,null,'the actual medical courier encounter must finish before continuing care');assert.equal(s.pendingBattle,null);
  assert.ok(s.recruited.includes(operativeId)&&s.operativeState[operativeId].alive&&!s.operativeState[operativeId].captured,'the actual courier must survive and remain under paid service');
  if(courierId!==null)selectCourier();
 };
 const preparePostaCourier=(location=clinic)=>{
  encounter('readiness',location);
  assert.equal(operativeLocation(s,operativeId),location,location===clinic?'An actual encounter must return the courier to the clinic before quoting departure.':'An actual encounter must return the courier to its current departure before quoting travel.');
  if(!needsRest())return;
  selectCourier();assert.equal(operativeLocation(s,operativeId),location,'The courier must finish real local rest before departure.');
  assert.ok(s.recruited.filter(id=>operativeLocation(s,id)===clinic&&s.operativeState[id].alive).every(id=>!s.operativeState[id].bleeding),'stabilize local bleeding patients before their doctor rests for the journey');
  const began=clock();let hours=0,zeroTimeNotices=0;
  report({event:'medicalCourierRestStarted',operativeId,campaign:structuredClone(s)});
  while(needsRest()){
   assert.ok(hours<48,'The actual posta courier must recover within 48 ordinary rest hours.');
   retain(3601,'readiness');
   if(!s.operativeState[operativeId].asleep){const action={type:'setSleep',operativeId,asleep:true};s=issue(action);report({event:'medicalCourierRestOrder',action,hour:s.hour,secondOfHour:s.secondOfHour??0});}
   const before=clock(),action={type:'wait',hours:1};s=issue(action);const elapsed=clock()-before;
   assert.ok(elapsed>=0&&elapsed<=3600,'An ordinary courier rest order cannot exceed its requested hour.');hours+=elapsed/3600;
   report({event:'medicalCourierRestOrder',action,elapsedSeconds:elapsed,hour:s.hour,secondOfHour:s.secondOfHour??0});
   zeroTimeNotices=elapsed===0?zeroTimeNotices+1:0;assert.ok(zeroTimeNotices<3,'Courier rest stopped after three consecutive zero-time notices.');
   encounter('readiness',location);assert.equal(operativeLocation(s,operativeId),location,location===clinic?'An actual encounter must return the courier to the clinic before quoting departure.':'An actual encounter must return the courier to its current departure before quoting travel.');
  }
  report({event:'medicalCourierReady',operativeId,restHours:hours,elapsedSeconds:clock()-began,campaign:structuredClone(s)});
 };
 const restoreSelection=()=>{
  if(courierId===null)return;
  if(home){const current=s.squads.find(q=>q.id===home.id);assert.ok(current,'The original medical courier squad must remain available.');if(!current.members.includes(operativeId))s=issue({type:'assignToSquad',operativeId,squadId:home.id});}
  if(assignment!=='active')s=issue({type:'assignCare',id:operativeId,assignment});
  if(s.activeSquadId!==previous)s=issue({type:'selectSquad',id:previous});
 };
 if(mode==='posta')preparePostaCourier();
 // Deadline mode admits only remembered stock. It stops before a tactical
 // discovery whose elapsed route cannot be quoted by this strategic helper.
 const acceptedTake=bounded?({campaign})=>{s=campaign;admittedPrefix();}:undefined;
 const local=attemptCollectRouteItems(s,operativeId,{item:'medkits'},requested,{discover:!bounded,onOrder:acceptedTake});s=local.campaign;admittedPrefix();
 if(local.supplied){restoreSelection();return {campaign:saved({campaign:s}).campaign,collected:local.collected};}
 assert.ok(s.recruited.includes(operativeId)&&s.operativeState[operativeId].alive,'the actual courier must be serving');
 assert.ok(s.recruited.filter(id=>operativeLocation(s,id)===clinic&&s.operativeState[id].alive).every(id=>!s.operativeState[id].bleeding),'stabilize local bleeding patients before their doctor leaves for dressings');
 selectCourier();if(mode==='posta')preparePostaCourier();
 const known=knownRouteMedicalSources(s,clinic),sources=known.length||bounded?known:authoredRouteMedicalDiscoveries(s,clinic);
 const source=sources[0];assert.ok(source,bounded?'No remembered finite medical source is admitted before the absolute clinic deadline; tactical discovery remains unresolved.':'no controlled finite medical source remains for an actual courier');
 // Walking couriers retain the original budget before completeTestTravel
 // performs ordinary sleep recovery. Public previews correctly reject sleep.
 // Explicit posta trips use the actual named-town route and its travel price.
 const outward=mode==='march'?cellTravelPlan({...s,location:clinic},source.at):previewStrategicRoute(s,courierId,source.at,mode);
 const returnPreview={...s,squads:s.squads.map(q=>q.id===courierId?{...q,location:source.at}:q)};
 const returning=mode==='march'?cellTravelPlan({...s,location:source.at},clinic):previewStrategicRoute(returnPreview,courierId,clinic,mode);
 if(mode==='march'){assert.equal(outward.reason,null);assert.equal(returning.reason,null);}
 else{assert.equal(outward.valid,true,outward.reason);assert.equal(returning.valid,true,returning.reason);}
 admit((outward.hours+returning.hours)*3600);
 const horizon=(outward.hours+returning.hours+24)*3600;retain(horizon,'journey');
 const travel=at=>{
  if(bounded){
   preparePostaCourier(operativeLocation(s,operativeId));
   const quote=previewStrategicRoute(s,courierId,at,mode);assert.equal(quote.valid,true,quote.reason);admit(quote.hours*3600);
   s=issue({...quote.action,queue:true});let notices=0;
   for(let attempt=0;s.squads.find(q=>q.id===courierId)?.journey&&attempt<240;attempt++){
    assert.equal(s.squads.find(q=>q.id===courierId).journey.status,'moving','A stopped bounded medical courier needs an actual response.');
    const before=clock();s=issue({type:'wait',hours:1});encounter('journey',at);
    notices=clock()===before?notices+1:0;assert.ok(notices<3,'The bounded medical courier stops after three zero-time notices.');
   }
   assert.equal(s.squads.find(q=>q.id===courierId)?.journey,undefined,'The actual bounded medical courier must finish its admitted journey.');
   assert.equal(operativeLocation(s,operativeId),at);assert.equal(s.pendingBattle,null);preparePostaCourier(at);return;
  }
  for(let leg=0;leg<32;leg++){
   s=completeTestTravel(s,{sector:at,mode});
   if(s.pendingEncounter){
    encounter('journey',at);
    continue;
   }
   assert.equal(s.pendingBattle,null);assert.equal(s.location,at);assert.ok(s.recruited.includes(operativeId),'the real courier must remain under paid service');return;
  }
  assert.fail('the actual medical courier journey must finish within the bounded encounter plan');
 };
 const departure=s.hour*3600+(s.secondOfHour??0);travel(source.at);
 const found=attemptCollectRouteItems(s,operativeId,{item:'medkits'},requested,{discover:!bounded,onOrder:acceptedTake});s=found.campaign;admittedPrefix();
 assert.ok(found.supplied,`finite local equipment or carrying room is exhausted: ${operativeLocation(s,operativeId)} ${JSON.stringify({item:'medkits'})}`);
 travel(clinic);
 restoreSelection();
 report({event:'finiteMedicalCourier',operativeId,clinic,source:source.at,quantity:found.collected,mode,outward,returning,elapsedSeconds:s.hour*3600+(s.secondOfHour??0)-departure});
 return {campaign:saved({campaign:s}).campaign,collected:found.collected};
 }catch(error){report({event:'medicalCourierStopped',operativeId,reason:error.message,campaign:structuredClone(s)});error.campaign=s;throw error;}
}
