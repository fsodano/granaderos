import test from 'node:test';
import assert from 'node:assert/strict';
import {freshCoastalRoute} from './fresh-coastal-fixture.mjs';
import {recoverVisibleRouteDressings} from './route-visible-medical-remains.mjs';
import {saved,visit,leave} from './local-contract-fixture.mjs';
import {order,tactical} from './local-contract-fixture.mjs';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {initialCampaign,rosterFor} from '../game/campaign.js';
import {validateContentPackage} from '../game/content-package.js';
import {dailyTownIncome} from '../game/town-income.js';
import {getReachable,lookPreview} from '../game/tactical.js';
import {spacePoint,sameCell} from '../game/tactical-space.js';
import {meetLocalIncomeRepresentative} from './route-town-income.mjs';

test('public body inspection recovers finite dressings from actual native deaths and retains them across saves and visits',()=>{
 let checkpoint;const stop=new Error('native capital checkpoint complete');
 assert.throws(()=>freshCoastalRoute('local',{onCheckpoint:(sector,campaign)=>{if(sector==='buenos_aires'){checkpoint=campaign;throw stop;}}}),error=>error===stop);
 assert.ok(checkpoint);assert.equal(checkpoint.sectors.buenos_aires.owner,'patriot');
 const before=structuredClone(checkpoint),carrier=checkpoint.squad.find(id=>{const record=checkpoint.operativeState[id];return record.alive&&!record.captured&&record.hp>=15&&!record.unconscious&&!record.routed&&!record.asleep&&record.energy>15;}),bodyStock=campaign=>campaign.sectorStates.buenos_aires.units.filter(u=>u.hp===0&&!u.departure).reduce((sum,u)=>sum+(u.medkits??0),0),stock=bodyStock(checkpoint);
 assert.ok(carrier!==undefined,'ordinary body inspection needs an actual fit survivor, not a fixed wounded identity');
 assert.ok(stock>0,'native combat leaves actual finite corpse dressings');
 const result=recoverVisibleRouteDressings(checkpoint,carrier,1);
 const newlyFallen=result.campaign.sectorStates.buenos_aires.units.filter(unit=>unit.hp===0&&before.sectorStates.buenos_aires.units.find(old=>old.id===unit.id)?.hp>0);
 for(const unit of newlyFallen){const old=before.sectorStates.buenos_aires.units.find(old=>old.id===unit.id);assert.ok(old.bleeding>0,'only an actual unresolved native wound can create another corpse during inspection');assert.equal(unit.medkits,old.medkits,'a new casualty retains its actual carried dressings');}
 const remainingStock=stock-1+newlyFallen.reduce((sum,unit)=>sum+(unit.medkits??0),0);
 assert.deepEqual(checkpoint,before,'inspection does not change the supplied checkpoint');assert.equal(result.collected,1);assert.equal(bodyStock(result.campaign),remainingStock);
 assert.equal(result.campaign.operativeState[carrier].medkits,before.operativeState[carrier].medkits+1);assert.equal(result.campaign.resources.treasury,before.resources.treasury);
 assert.ok(result.evidence.elapsedSeconds>0);assert.ok(result.evidence.actions.some(action=>action.type==='approachLoot'));assert.equal(result.evidence.actions.filter(action=>action.type==='loot').length,1);
 const receipt=result.evidence.receipts[0];assert.equal(receipt.before-receipt.after,1);assert.equal(result.campaign.sectorStates.buenos_aires.units.find(u=>u.id===receipt.bodyId).medkits,receipt.after);
 for(const [id,record]of Object.entries(before.operativeState)){assert.equal(result.campaign.operativeState[id].alive,record.alive);assert.equal(result.campaign.operativeState[id].hp,record.hp);}
 assert.deepEqual(saved({campaign:result.campaign}).campaign,result.campaign);
 assert.deepEqual(recoverVisibleRouteDressings(saved({campaign:before}).campaign,carrier,1),result,'the full saved native checkpoint replays the exact ordinary recovery');
 const again=visit(result.campaign),body=again.battle.units.find(u=>u.id===receipt.bodyId);assert.equal(body.medkits,receipt.after);assert.equal(again.battle.units.find(u=>u.id===String(carrier)).medkits,before.operativeState[carrier].medkits+1);
 const returned=saved({campaign:leave(again)}).campaign;assert.equal(bodyStock(returned),remainingStock);assert.equal(returned.operativeState[carrier].medkits,before.operativeState[carrier].medkits+1);
});

// All health, finite stock, geometry and payment rules are declared before
// compilation. A real trap creates the body; a real conversation earns income.
function midnightRemains({agreement}){
 const d=scaffoldDocuments('declared-remains-midnight'),base=d.content.characters[0];
 d.content.rules.startingTreasury=20000;d.content.rules.deploymentCartridges=0;
 d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];
 d.content.characters=['carrier','fallen'].map(id=>({...structuredClone(base),id,name:id,nickname:id,monthlyPay:30,arrivalHours:0,weapon:null,
  attributes:{...base.attributes,strength:100,medical:0},startingSupplies:{rations:0,torches:0,boleadoras:0,medkits:id==='fallen'?3:0}}));
 const resident=structuredClone(base);delete resident.arrivalHours;
 d.content.characters.push({...resident,id:'representative',name:'Representante',recruitmentSource:'encounter',service:'permanent',monthlyPay:0,weapon:null,
  encounter:{recruitable:false,greeting:'El acuerdo del campamento.',requiredLeadership:0,requiredLiberated:0,requiredSector:null}});
 d.content.placements=[{id:'income-representative',character:'representative',mode:'fixed',sectors:['camp'],moveChance:100,afterDeath:null,delayMin:0,delayMax:0}];
 d.world.incomeSources=[{id:'camp-income',name:'Campamento',source:'Acuerdo local',sectorId:'camp',requiredSectors:['camp'],dailyAmount:8000,representative:{npcId:'authored-representative',name:'Representante',sectorId:'camp'}}];
 d.world.expansion.buildingTargets.camp=0;
 d.maps.camp.props=[{id:'finite-trap',type:'chest',x:6,y:8,footprint:{width:1,height:1},blocksMovement:true}];
 d.world.physical.environment.camp={doors:[],containers:[{selector:{type:'chest',id:'finite-trap'},configuration:{type:'chest',open:false,locked:false,contents:[],trap:{type:'injury',difficulty:100,armed:true,damage:100,breathLoss:0,discoveredBy:[]}}}]};
 const declaration=structuredClone(d),content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);
 let c=initialCampaign(42,content);const people=rosterFor(c),carrier=people.find(p=>p.contentId==='carrier').id,fallen=people.find(p=>p.contentId==='fallen').id;
 c=order(c,{type:'recruitCivic',id:fallen,term:'month'});c=order(c,{type:'squad',ids:[fallen]});let p=visit(c);
 const actor=()=>p.battle.units.find(u=>u.id===String(fallen)),chest=p.battle.props.find(prop=>prop.id==='finite-trap');
 for(let n=0;Math.hypot(actor().x-chest.x,actor().y-chest.y)>1.5&&n<16;n++){
  const point=getReachable(p.battle,actor()).filter(point=>Math.hypot(point.x-chest.x,point.y-chest.y)<=1.5).sort((a,b)=>a.cost-b.cost)[0];assert.ok(point);
  const before=spacePoint(actor());p=saved(tactical(p,{type:'move',unitId:String(fallen),...spacePoint(point)}));assert.equal(sameCell(actor(),before),false);
 }
 assert.ok(Math.hypot(actor().x-chest.x,actor().y-chest.y)<=1.5);
 if(lookPreview(p.battle,actor(),chest).valid)p=saved(tactical(p,{type:'look',unitId:String(fallen),...spacePoint(chest)}));
 p=saved(tactical(p,{type:'useItem',unitId:String(fallen),environment:{kind:'container',id:chest.id,verb:'open'}}));assert.equal(actor().hp,0);assert.equal(actor().medkits,3);
 c=leave(p);assert.equal(c.operativeState[fallen].alive,false);
 c=order(c,{type:'recruitCivic',id:carrier,term:'month'});c=order(c,{type:'squad',ids:[carrier]});
 if(agreement)c=meetLocalIncomeRepresentative(c,{sourceId:'camp-income',operativeId:carrier});
 c=order(c,{type:'assignCare',operativeId:carrier,assignment:'rest'});
 const clock=s=>s.hour*3600+(s.secondOfHour??0),target=(Math.floor(clock(c)/86400)+1)*86400-2;
 for(let n=0;clock(c)<target&&n<32;n++)c=order(c,{type:'advanceStrategicTime',seconds:Math.min(3600,target-clock(c))});
 assert.equal(clock(c),target);assert.equal(c.pendingEncounter,null);assert.equal(c.operativeState[carrier].asleep,false);assert.deepEqual(d,declaration);
 return {campaign:saved({campaign:c}).campaign,carrier,fallen};
}

for(const agreement of [true,false])test(`public finite dressing inspection crosses midnight with ${agreement?'one earned':'no'} daily payment`,()=>{
 const {campaign:start,carrier,fallen}=midnightRemains({agreement}),before=structuredClone(start),result=recoverVisibleRouteDressings(start,carrier,1),c=result.campaign;
 assert.deepEqual(start,before);assert.equal(dailyTownIncome(start),agreement?8000:0);
 assert.equal(result.collected,1);assert.ok(result.evidence.elapsedSeconds>2);assert.equal(result.evidence.incomeDays,1);assert.equal(result.evidence.incomeReceived,agreement?8000:0);
 assert.equal(c.resources.treasury,start.resources.treasury+(agreement?8000:0));assert.equal(c.townIncome.lastPaidDay,start.townIncome.lastPaidDay+1);assert.deepEqual(c.townIncome.activations,start.townIncome.activations);
 assert.equal(c.operativeState[carrier].medkits,start.operativeState[carrier].medkits+1);assert.equal(c.sectorStates.camp.units.find(u=>u.id===String(fallen)).medkits,2);assert.equal(c.operativeState[fallen].alive,false);
 assert.deepEqual(c.contracts,start.contracts);assert.deepEqual(saved({campaign:c}).campaign,c);assert.deepEqual(recoverVisibleRouteDressings(saved({campaign:start}).campaign,carrier,1),result);
});
