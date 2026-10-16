import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {validateContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote} from '../game/contracts.js';
import {doctorRate} from '../game/medical-care.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {applyItemQuantity,SUPPLY_ITEMS} from '../game/tactical-inventory.js';
import {actBattle,presentedActBattle,getReachable,lookPreview} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {spacePoint,sameCell} from '../game/tactical-space.js';
import {wallEdgeCells} from '../game/wall-geometry.js';
import {syncBattleTime} from '../game/time.js';
import {order,visit,saved,leave} from './local-contract-fixture.mjs';
import {takeFiniteCache,leaveFiniteCache} from './finite-cache-driver.mjs';
import {stageRouteRoofDefenders} from './route-roof-defenders.mjs';
import {supplyNorthernConvalescentDressing} from './northern-route.mjs';

const sector='cordoba',cacheId='convalescence-cache',clock=c=>c.hour*3600+(c.secondOfHour??0);
const inventory=(c,id)=>sectorInventoryModel(c,sector,rosterFor(c),id);
const unit=(b,id)=>b.units.find(u=>u.id===String(id));
function step(pair,action){
 const before=structuredClone(pair.battle),battle=actBattle(pair.battle,action);assert.equal(battle.lastError,null,JSON.stringify(action)+': '+battle.lastError);
 assert.deepEqual(presentedActBattle(pair.battle,action).state,battle);assert.deepEqual(actBattle(validateBattleSnapshot(JSON.parse(JSON.stringify(pair.battle))),action),battle);assert.deepEqual(pair.battle,before);
 const next=syncBattleTime(pair.campaign,battle);assert.equal(next.error,null);return saved(next);
}
function move(pair,id,target){
 for(let n=0;!sameCell(unit(pair.battle,id),target)&&n<64;n++){
  const actor=unit(pair.battle,id),route=getReachable(pair.battle,actor,{stopAt:p=>sameCell(p,target)})[0];assert.ok(route?.path.length,JSON.stringify({from:spacePoint(actor),target}));
  const before=spacePoint(actor);pair=step(pair,{type:'move',unitId:String(id),...spacePoint(route.path[0])});assert.notDeepEqual(spacePoint(unit(pair.battle,id)),before);
 }
 assert.ok(sameCell(unit(pair.battle,id),target));return pair;
}

// Every wound, supply, partition and public roof is declared before validation
// and the factory. Service, scene knowledge and posts are earned by real orders.
function setup({donorKits=14,donorHP=44,donorBleeding=0,donorAssignment='active',roofs=true,rations=0,closed=false,named=false}={}){
 const d=scaffoldDocuments('northern-convalescent-dressings');
 for(const key of ['content','world','maps'])d[key]=JSON.parse(JSON.stringify(d[key]).replaceAll('"camp"','"cordoba"').replaceAll('camp:','cordoba:'));
 const base=d.content.characters[0];d.content.rules.startingTreasury=10000;d.content.rules.deploymentCartridges=0;
 d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];d.world.expansion.buildingTargets={[sector]:0,'watch-post':0};
 d.content.characters=Array.from({length:3},(_,i)=>({...structuredClone(base),id:'care-'+i,name:'Persona '+i,nickname:'Persona '+i,weapon:null,monthlyPay:30,arrivalHours:0,
  attributes:{...base.attributes,maxHp:70,medical:i===0?80:i===1?91:0},startingSupplies:{rations:0,torches:0,medkits:i===1?donorKits:i===2?2:0,boleadoras:0},
  startingCondition:{hp:i===1?donorHP:i===2?60:70,bleeding:i===1?donorBleeding:0,bandaged:i===1?(donorBleeding?0:70-donorHP):i===2?10:0,energy:100,fatigue:0}}));
 if(named)d.content.campaignRoles.foundryEngineer='care-1';
 if(roofs){
  d.maps[sector].upperSurfaces=Array.from({length:15},(_,i)=>({id:'care-roof-'+i,x:8+i%5,y:4+Math.floor(i/5),tacticalLevel:1,elevation:3,type:'floor',kind:'roof',blocked:false,cover:20}));
  d.maps[sector].climbLinks=[{id:'care-climb',kind:'climb',from:{x:8,y:7,tacticalLevel:0},to:{x:8,y:6,tacticalLevel:1}}];
 }
 if(rations||closed){
  d.maps[sector].props=[{id:cacheId,type:'chest',x:closed?14:5,y:8,footprint:{width:1,height:1},blocksMovement:true}];
  d.world.physical.caches[sector]={chest:cacheId,contents:closed?[{item:'medkits',count:3,weight:.2}]:[{item:'rations',count:rations,weight:.5}]};
 }
 if(closed)d.maps[sector].wallEdges=Array.from({length:16},(_,y)=>({id:y===8?'care-gate':'care-partition-'+y,axis:'y',x:9,y,tacticalLevel:0,type:y===8?'door':'wall',material:'adobe',blocked:y!==8,blocksSight:y!==8,cover:y===8?0:40,...(y===8?{doorId:'care-gate',open:true,locked:false}:{})}));
 const declaration=structuredClone(d),content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);
 let c=initialCampaign(8,content);const ids=rosterFor(c).map(op=>op.id),[doctor,donor,patient]=ids,initialCash=c.resources.treasury,hires=[];
 for(const id of ids){const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'week'),cash=c.resources.treasury;assert.equal(quote.available,true);assert.ok(quote.total>0);c=order(c,{type:'recruitCivic',id,term:'week'});assert.equal(cash-c.resources.treasury,quote.total);hires.push({id,quote});}
 assert.equal(initialCash-c.resources.treasury,hires.reduce((sum,row)=>sum+row.quote.total,0));
 c=order(c,{type:'createSquad',sector,ids:[doctor,patient],name:'Convalecencia'});const clinic=c.activeSquadId;
 c=order(c,{type:'createSquad',sector,ids:[donor],name:'Retaguardia médica'});const rear=c.activeSquadId;c=order(c,{type:'selectSquad',id:clinic});
 if(rations||closed){
  let pair=takeFiniteCache(visit(c),doctor,[],{cacheId});
  if(closed){
   const gate=pair.battle.wallEdges.find(edge=>edge.doorId==='care-gate'),left=wallEdgeCells(gate).find(point=>point.x<gate.x);assert.ok(left);
   pair=move(pair,doctor,left);const facing=wallEdgeCells(gate).find(point=>point.x===gate.x);
   if(lookPreview(pair.battle,unit(pair.battle,doctor),facing).valid)pair=step(pair,{type:'look',unitId:String(doctor),...spacePoint(facing)});
   pair=step(pair,{type:'door',unitId:String(doctor),doorId:'care-gate',open:false});c=saved({campaign:leave(pair)}).campaign;
  }else c=leaveFiniteCache(pair);
 }else c=saved({campaign:leave(visit(c))}).campaign;
 const beforeRoof=clock(c),events=[];
 if(roofs){c=stageRouteRoofDefenders(c,ids,{report:e=>events.push(e)});assert.ok(clock(c)>beforeRoof);assert.equal(events.filter(e=>e.event==='routeRoofDefenders').at(-1).positions.length,3);assert.equal(new Set(ids.map(id=>JSON.stringify(spacePoint(c.operativeState[id].residentPosition)))).size,3);}
 c=order(c,{type:'assignCare',operativeId:patient,assignment:'patient'});
 if(donorAssignment==='practice')c=order(c,{type:'assignWork',operativeId:donor,assignment:'practice',skill:'marksmanship'});
 else if(donorAssignment!=='active')c=order(c,{type:'assignCare',operativeId:donor,assignment:donorAssignment});
 assert.equal(c.activeSquadId,clinic);assert.deepEqual(c.squads.find(q=>q.id===rear).members,[donor]);assert.equal(c.operativeState[doctor].medkits,0);assert.deepEqual(d,declaration);
 return {campaign:saved({campaign:c}).campaign,doctor,donor,patient,ids,clinic,rear,hires};
}
const supply=(c,s,options={})=>supplyNorthernConvalescentDressing(c,s.doctor,{deploying:[s.doctor,s.patient],patients:[s.patient],deadlineSeconds:clock(c)+96*3600,...options});
function replay(start,result){let c=saved({campaign:start}).campaign;for(const action of result.receipt.orders)c=saved({campaign:order(c,action)}).campaign;assert.deepEqual(c,result.campaign);return c;}
const received=r=>r.receipt.takes.reduce((sum,row)=>sum+row.count,0),internal=r=>r.receipt.donations.filter(row=>row.internal).reduce((sum,row)=>sum+row.count,0);

test('a paid stable rear physician donates finite surplus outside deploying without changing any post or duty, then real care debits it once',()=>{
 const s=setup(),start=s.campaign,before=structuredClone(start),result=supply(start,s),c=result.campaign;
 assert.equal(result.supplied,true);assert.equal(result.receipt.reserves[s.donor],2);assert.equal(c.operativeState[s.donor].medkits,13);assert.equal(c.operativeState[s.doctor].medkits,1);assert.equal(c.operativeState[s.patient].medkits,2);
 assert.equal(result.receipt.donations.length,1);assert.equal(result.receipt.donations[0].donor,s.donor);assert.equal(result.receipt.donations[0].internal,false);assert.equal(received(result),1);assert.equal(internal(result),0);
 for(const id of s.ids){assert.deepEqual(c.operativeState[id].residentPosition,start.operativeState[id].residentPosition);assert.equal(c.operativeState[id].assignment,start.operativeState[id].assignment);assert.equal(c.operativeState[id].hp,start.operativeState[id].hp);}
 assert.equal(s.ids.reduce((sum,id)=>sum+c.operativeState[id].medkits,0),s.ids.reduce((sum,id)=>sum+start.operativeState[id].medkits,0));assert.deepEqual(c.squads,start.squads);assert.deepEqual(c.contracts,start.contracts);assert.equal(c.activeSquadId,start.activeSquadId);assert.equal(clock(c),clock(start));assert.equal(c.resources.treasury,start.resources.treasury);
 replay(start,result);assert.deepEqual(supply(saved({campaign:start}).campaign,s),result);assert.deepEqual(saved({campaign:c}).campaign,c);
 const assigned=order(c,{type:'assignCare',operativeId:s.doctor,assignment:'doctor'}),treated=order(assigned,{type:'wait',hours:1});
 assert.equal(treated.operativeState[s.doctor].medkits,0);assert.equal(treated.operativeState[s.patient].hp,c.operativeState[s.patient].hp+doctorRate(rosterFor(c).find(op=>op.id===s.doctor),c));assert.ok(clock(treated)>clock(c)&&clock(treated)-clock(c)<=3600);
 const deploying=[s.doctor,s.patient],used=deploying.reduce((sum,id)=>sum+start.operativeState[id].medkits-treated.operativeState[id].medkits,0)+received(result)-internal(result);assert.equal(used,1,'an external acquisition and its actual clinical debit are counted once');
 assert.deepEqual(saved({campaign:treated}).campaign,treated);assert.deepEqual(order(order(replay(start,result),{type:'assignCare',operativeId:s.doctor,assignment:'doctor'}),{type:'wait',hours:1}),treated);assert.deepEqual(start,before);
});

test('an internal finite donation gives no external stock credit and each serving donor retains its own last dressing',()=>{
 const s=setup({donorHP:70}),start=s.campaign,deploying=s.ids,result=supply(start,s,{deploying}),c=result.campaign;
 assert.equal(result.supplied,true);assert.equal(result.receipt.reserves[s.donor],1);assert.equal(received(result),1);assert.equal(internal(result),1);
 const receivedCredit=deploying.reduce((sum,id)=>sum+start.operativeState[id].medkits-c.operativeState[id].medkits,0)+received(result)-internal(result);assert.equal(receivedCredit,0);replay(start,result);
 const floor=setup({donorKits:1,donorHP:70}),refused=supply(floor.campaign,floor,{deploying:floor.ids});assert.equal(refused.supplied,false);assert.deepEqual(refused.receipt.orders,[]);assert.deepEqual(refused.campaign,floor.campaign);
});

test('current patients, acute bodies, working obligations, named duties and each active doctor stroke keep their finite reserves',()=>{
 for(const options of [{donorAssignment:'patient'},{donorBleeding:1,roofs:false},{donorAssignment:'practice'},{named:true},{donorKits:2},{donorKits:1,donorHP:70,donorAssignment:'doctor'}]){
  const s=setup(options),before=structuredClone(s.campaign),deploying=options.donorAssignment==='doctor'?s.ids:[s.doctor,s.patient],result=supply(s.campaign,s,{deploying});
  assert.equal(result.supplied,false,JSON.stringify(options));assert.equal(result.receipt.reserves[s.donor],s.campaign.operativeState[s.donor].medkits);assert.deepEqual(result.receipt.orders,[]);assert.deepEqual(result.campaign,s.campaign);assert.deepEqual(s.campaign,before);assert.equal(result.receipt.details?.availability??result.receipt.details?.reason,'no-reachable-stock');
 }
});

test('a genuinely full Native recipient pack refuses before a rear physician drops any dressing',()=>{
 const s=setup({rations:100,roofs:false,donorHP:70});let start=s.campaign;const model=inventory(start,s.doctor),row=model.entries.find(row=>row.reachable&&JSON.parse(row.expected).item==='rations');assert.ok(row);
 let fill=0;for(let count=1;count<=row.count;count++){let packed;try{packed=applyItemQuantity(model.personal,{...JSON.parse(row.expected),count});}catch{break;}try{applyItemQuantity(packed,{item:'medkits',count:1,weight:SUPPLY_ITEMS.medkits.weight});}catch{fill=count;break;}}
 assert.ok(fill);start=order(start,{type:'sectorInventory',sector,operativeId:s.doctor,direction:'take',sourceKey:row.key,expected:row.expected,count:fill});const before=structuredClone(start);let expected;try{applyItemQuantity(inventory(start,s.doctor).personal,{item:'medkits',count:1,weight:SUPPLY_ITEMS.medkits.weight});}catch(error){expected=error;}assert.ok(expected);
 let failure;try{supply(start,s);}catch(error){failure=error;}assert.equal(failure?.message,expected.message);assert.deepEqual(failure.northernConvalescentDressing.orders,[]);assert.deepEqual(failure.campaign,start);assert.equal(failure.campaign.operativeState[s.donor].medkits,14);assert.deepEqual(start,before);
});

test('known finite linen behind an actually closed door remains inaccessible and discover false spends no time or stock',()=>{
 const s=setup({donorKits:2,donorHP:70,closed:true,roofs:false}),start=s.campaign,before=structuredClone(start),rows=inventory(start,s.doctor).entries.filter(row=>JSON.parse(row.expected).item==='medkits');assert.equal(rows.reduce((sum,row)=>sum+row.count,0),3);assert.ok(rows.every(row=>!row.reachable));
 const result=supply(start,s);assert.equal(result.supplied,false);assert.equal(result.receipt.details.availability,'inaccessible-stock');assert.equal(result.receipt.details.inaccessibleCount,3);assert.deepEqual(result.receipt.orders,[]);assert.deepEqual(result.campaign,start);assert.deepEqual(start,before);replay(start,result);
});

test('an accepted donation followed by a callback refusal retains that actual prefix without claiming an unreceived dressing',()=>{
 const s=setup(),start=s.campaign,before=structuredClone(start),stop=Error('stop after the accepted donation');let failure;
 try{supply(start,s,{report:event=>{if(event.event==='routeDressingDonation')throw stop;}});}catch(error){failure=error;}
 assert.strictEqual(failure,stop);assert.equal(failure.northernConvalescentDressing.supplied,false);assert.equal(failure.northernConvalescentDressing.orders.length,1);assert.equal(failure.northernConvalescentDressing.orders[0].direction,'drop');assert.equal(failure.northernConvalescentDressing.donations.length,1);assert.deepEqual(failure.northernConvalescentDressing.takes,[]);
 assert.equal(failure.campaign.operativeState[s.donor].medkits,start.operativeState[s.donor].medkits-1);assert.equal(failure.campaign.operativeState[s.doctor].medkits,0);assert.equal(failure.campaign.resources.treasury,start.resources.treasury);assert.equal(clock(failure.campaign),clock(start));assert.equal(failure.campaign.sectorStates[sector].groundItems.filter(row=>!row.taken&&row.item==='medkits').reduce((sum,row)=>sum+row.count,0),1);assert.deepEqual(failure.campaign.squads,start.squads);assert.deepEqual(start,before);
 // The error campaign is inspected only as plain data. It is never queried,
 // saved, resumed or used as the input of another game action.
});

test('the fixed care deadline and an actual pending visit refuse before any donation rather than restarting recovery',()=>{
 const s=setup(),start=s.campaign,before=structuredClone(start);let failure;try{supply(start,s,{deadlineSeconds:clock(start)});}catch(error){failure=error;}
 assert.match(failure?.message??'',/96-hour/);assert.deepEqual(failure.northernConvalescentDressing.orders,[]);assert.deepEqual(failure.campaign,start);assert.deepEqual(start,before);
 const ready=order(start,{type:'assignCare',operativeId:s.patient,assignment:'active'}),pending=order(ready,{type:'visitSector'}),pendingBefore=structuredClone(pending);let blocked;try{supply(pending,s);}catch(error){blocked=error;}
 assert.ok(blocked);assert.deepEqual(blocked.northernConvalescentDressing.orders,[]);assert.deepEqual(blocked.campaign,pending);assert.deepEqual(pending,pendingBefore);
});
