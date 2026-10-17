import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readdirSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {defaultContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {actBattle,presentedActBattle} from '../game/tactical.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {aidNorthernMissionRelief} from './northern-mission-aid.mjs';
import {visit,sync,leave} from './local-contract-fixture.mjs';

const ids=[110,112,116],clock=c=>c.hour*3600+(c.secondOfHour??0),body=(b,id)=>b.units.find(u=>u.id===String(id));
const order=(c,action)=>{const next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);return next;};
// Wounds, skill and finite stock are current declarations before the factory.
// The ordinary first visit reveals the local terrain without adding supplies.
function clinic({donorKits=3,doctorHp=100,bleeding=2}={}){
 const content=defaultContentPackage();content.headquarters='tucuman';delete content.startingTerritory;content.rules.startingTreasury=10000;
 for(const p of content.characters)p.startingSupplies={rations:2,torches:2,boleadoras:1,...p.startingSupplies,medkits:0};
 for(const id of ids){
  const p=content.characters.find(p=>p.id===`person-${id}`);p.arrivalHours=0;
  p.attributes={...p.attributes,maxHp:100,medical:id===112?90:0,dexterity:90};
  p.startingSupplies={rations:2,torches:0,medkits:id===116?donorKits:0,boleadoras:0};
  p.startingCondition={hp:id===110?6:id===112?doctorHp:100,bleeding:id===110?bleeding:0,bandaged:0,energy:100,fatigue:0};
 }
 const declared=structuredClone(content);let c=initialCampaign(42,content);
 for(const id of ids)c=order(c,{type:'recruitCivic',id,term:'week'});
 c=order(c,{type:'createSquad',ids,name:'Socorro declarado',sector:'tucuman'});
 const p=visit(c),battle=actBattle(p.battle,{type:'explore'});assert.equal(battle.lastError,null);c=leave(sync({campaign:p.campaign,battle}));
 assert.deepEqual(content,declared);return decodeSave(encodeSave(c)).campaign;
}
function replay(start,result){
 let c=structuredClone(start);for(const action of result.stockOrders)c=order(c,action);
 const p=visit(c);assert.deepEqual(p.battle,result.initial);
 let direct=p.battle,presented=structuredClone(p.battle),saved=decodeSave(encodeSave(p.campaign,p.battle));
 for(let index=0;index<result.aid.steps.length;index++){
  const action=result.aid.steps[index];direct=actBattle(direct,action);assert.equal(direct.lastError,null);
  presented=presentedActBattle(presented,JSON.parse(JSON.stringify(action))).state;assert.deepEqual(presented,direct);
  saved.battle=actBattle(saved.battle,JSON.parse(JSON.stringify(action)));assert.equal(saved.battle.lastError,null);
  if(index===Math.floor(result.aid.steps.length/2)){saved=sync(saved);saved=decodeSave(encodeSave(saved.campaign,saved.battle));}
  assert.deepEqual(sync(saved),sync({campaign:p.campaign,battle:direct}));
 }
 assert.deepEqual(direct,result.aid.battle);
 assert.deepEqual(leave(sync({campaign:p.campaign,battle:direct})),result.campaign);
 assert.deepEqual(leave(sync({campaign:saved.campaign,battle:saved.battle})),result.campaign);
}

test('the fit selected medic receives exact local donor surplus and pays finite critical aid with complete current saved replay',()=>{
 for(const bleeding of [2,5]){
 const start=clinic({bleeding}),before=structuredClone(start),events=[];
 assert.equal(start.operativeState[110].hp,6);assert.equal(start.operativeState[110].bleeding,bleeding,'The declared wound must remain exact before relief care.');
 const result=aidNorthernMissionRelief(start,ids,{report:event=>events.push(event)}),c=result.campaign;
 assert.equal(result.physicianId,112);assert.deepEqual(result.urgent,[110]);assert.ok(result.quote.dressings>0&&result.quote.dressings<=2);
 assert.equal(result.stockOrders.length,2);assert.equal(result.stockOrders[0].direction,'drop');assert.equal(result.stockOrders[0].operativeId,116);assert.equal(result.stockOrders[1].direction,'take');assert.equal(result.stockOrders[1].operativeId,112);
 assert.equal(result.stockOrders[0].count,result.quote.dressings);assert.equal(result.stockOrders[1].count,result.quote.dressings);
 assert.equal(c.operativeState[116].medkits,3-result.quote.dressings);assert.ok(c.operativeState[116].medkits>=1);
 assert.equal(body(result.initial,112).medkits,result.quote.dressings);assert.ok(result.aid.steps.some(a=>a.type==='useItem'&&a.targetId==='110'));
 assert.equal(c.operativeState[110].hp,15);assert.equal(c.operativeState[110].bleeding,0);assert.ok(c.operativeState[110].hp<c.operativeState[110].maxHp);
 assert.equal(ids.reduce((n,id)=>n+c.operativeState[id].medkits,0),3-result.quote.dressings);assert.ok(clock(c)>clock(start));assert.equal(clock(c)-clock(start),result.aid.elapsedSeconds);
 assert.equal(c.resources.treasury,start.resources.treasury);assert.deepEqual(c.contracts,start.contracts);assert.deepEqual(c.squad,start.squad);
 for(const id of ids){assert.equal(c.operativeState[id].alive,true);assert.equal(c.operativeState[id].captured,false);assert.equal(c.operativeState[id].location,'tucuman');}
 assert.equal(events.length,1);assert.equal(events[0].stoppedReason,null);assert.deepEqual(events[0].untreated,[]);replay(start,result);assert.deepEqual(start,before);
 }
});

test('an actual one-kit donor reserve refuses shortage before discovery, travel or tactical care and records the unchanged input',()=>{
 const start=clinic({donorKits:1}),before=structuredClone(start),directory=mkdtempSync(join(tmpdir(),'granaderos-mission-aid-')),prior=process.env.GRANADEROS_CAMPAIGN_FAILURE_DIR;
 assert.equal(sectorInventoryModel(start,'tucuman',rosterFor(start),112).entries.filter(r=>r.reachable&&JSON.parse(r.expected).item==='medkits').length,0);
 process.env.GRANADEROS_CAMPAIGN_FAILURE_DIR=directory;
 try{
  assert.throws(()=>aidNorthernMissionRelief(start,ids),/Known finite local dressings/);
  const root=join(directory,'strategic-preparation'),captures=readdirSync(root).map(name=>join(root,name)),record=captures.map(path=>({path,receipt:JSON.parse(readFileSync(join(path,'receipt.json'),'utf8'))}));
  assert.equal(record.length,2);const failure=record.find(r=>r.receipt.stage==='missing-finite-dressings');assert.ok(failure);
  const context=JSON.parse(readFileSync(join(failure.path,'context.json'),'utf8'));assert.equal(context.available,0);assert.deepEqual(context.stockOrders,[]);
  assert.deepEqual(JSON.parse(readFileSync(join(failure.path,'campaign.json'),'utf8')),start);assert.deepEqual(start,before);
 }finally{if(prior===undefined)delete process.env.GRANADEROS_CAMPAIGN_FAILURE_DIR;else process.env.GRANADEROS_CAMPAIGN_FAILURE_DIR=prior;rmSync(directory,{recursive:true,force:true});}
});

test('a genuinely critical selected medic cannot be used as the fit rescuer or consume another survivor’s finite reserve',()=>{
 const start=clinic({doctorHp:14}),before=structuredClone(start);assert.equal(start.operativeState[112].hp,14);
 assert.throws(()=>aidNorthernMissionRelief(start,ids),/fit selected physician/);assert.deepEqual(start,before);
});
