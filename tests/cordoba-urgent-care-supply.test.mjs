import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readdirSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {scaffoldDocuments} from '../game/campaign-scaffold.js';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {validateContentPackage} from '../game/content-package.js';
import {initialCampaign,rosterFor} from '../game/campaign.js';
import {contractQuote,contractExpiresSeconds} from '../game/contracts.js';
import {order,saved} from './local-contract-fixture.mjs';
import {discoverRouteCache} from './finite-route-equipment.mjs';
import {stabilizeCordobaMedicalRear} from './cordoba-medical-rear-guard.mjs';

const sector='cordoba',clock=c=>c.hour*3600+(c.secondOfHour??0);
const allIssues=c=>Object.values(c.operativeState).reduce((sum,r)=>sum+r.medkits,0);
const cache=c=>c.sectorStates[sector]?.props.find(prop=>prop.id==='urgent-finite-linen');
const localStock=c=>(cache(c)?.contents??[]).filter(stack=>stack.item==='medkits').reduce((sum,stack)=>sum+stack.count,0);

// All wounds, skills, finite issues, prices, map supplies and the optional
// three-person raid are declared before compilation/factory. Patients are
// not hired until the healthy scout has completed any real cache discovery.
function setup({initialKits=0,reliefCount=3,reliefSkills=null,knownKits=0,raid=false,stable=false}={}){
 const d=JSON.parse(JSON.stringify(scaffoldDocuments('declared-cordoba-urgent-care')).replaceAll('watch-post',sector));
 const base=d.content.characters[0];d.content.rules.startingTreasury=20000;d.content.startingTerritory[sector].owner='patriot';
 d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];d.world.expansion.buildingTargets={camp:0,[sector]:0};
 d.world.arrivalFacilities[sector]=['barracks'];d.content.arrivalSites.push({sector,facilities:['barracks']});
 const names=['clinic-doctor','patient-critical','patient-bleeding',...Array.from({length:reliefCount},(_,i)=>'relief-'+i)];
 d.content.characters=names.map((id,i)=>({...structuredClone(base),id,name:id,nickname:id,monthlyPay:i<3?300:30*(i-2),serviceGuarantee:0,arrivalHours:0,weapon:null,
  attributes:{...base.attributes,maxHp:80,medical:i===0?90:i>=3?(reliefSkills?.[i-3]??65):0},startingSupplies:{rations:0,torches:0,boleadoras:0,medkits:i===0?initialKits:i>=3?2:0},
  startingCondition:{hp:i===1?(stable?15:5):i===2?15:80,bleeding:!stable&&(i===1||i===2)?4:0,bandaged:0,energy:100,fatigue:0}}));
 if(knownKits){d.maps[sector].props=[{id:'urgent-finite-linen',type:'chest',x:5,y:12,footprint:{width:1,height:1},blocksMovement:true}];d.world.physical.caches[sector]={chest:'urgent-finite-linen',contents:[{item:'medkits',count:knownKits,weight:.2}]};}
 d.world.enemyStrategy={version:1,theaters:{frontier:{legHours:1,reserve:raid?3:0,raidEveryHours:raid?1:240,axis:[sector]}}};
 const declaration=structuredClone(d),content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);let c=initialCampaign(42,content);
 const people=rosterFor(c),id=key=>people.find(person=>person.contentId===key).id,doctor=id('clinic-doctor'),patients=[id('patient-critical'),id('patient-bleeding')],relief=names.slice(3).map(id),hires=[];
 const hire=person=>{const quote=contractQuote(c,rosterFor(c).find(op=>op.id===person),'week'),cash=c.resources.treasury;assert.equal(quote.available,true);c=order(c,{type:'recruitCivic',id:person,term:'week',destination:sector});assert.equal(c.resources.treasury,cash-quote.total);hires.push({id:person,quote});};
 hire(doctor);c=order(c,{type:'createSquad',sector,ids:[doctor],name:'Médico local'});
 if(knownKits){c=discoverRouteCache(c,doctor);assert.equal(cache(c).knownToPlayer,true);assert.equal(cache(c).open,true);assert.equal(localStock(c),knownKits);}
 for(const person of patients)hire(person);c=order(c,{type:'squad',ids:[doctor,...patients]});
 assert.ok(relief.every(person=>!c.recruited.includes(person)));assert.equal(c.hiringArrivals.length,0);assert.equal(c.pendingEncounter,null);assert.equal(c.pendingBattle,null);assert.deepEqual(d,declaration);
 return {campaign:saved({campaign:c}).campaign,doctor,patients,relief,hires,declaration};
}

function verifyCare(start,result){
 const c=result.campaign,r=result.receipt;
 assert.ok(r.ticks.length>0&&r.ticks.length<=12);assert.equal(clock(c)-clock(start),r.ticks.length*3600);
 assert.equal(allIssues(c)+localStock(c),allIssues(start)+localStock(start)-r.dressingsSpent);
 assert.equal(r.dressingsSpent,r.ticks.reduce((sum,tick)=>sum+tick.dressingsSpent,0));
 assert.equal(c.resources.treasury,start.resources.treasury-r.hires.reduce((sum,hire)=>sum+hire.quote.total,0)-r.renewals.reduce((sum,row)=>sum+row.quote.price,0));
 assert.equal(new Set(r.hires.map(hire=>hire.id)).size,r.hires.length);assert.equal(r.hire,r.hires[0]??null);
 for(const person of r.local){assert.ok(c.recruited.includes(person));assert.equal(c.operativeState[person].alive,true);assert.equal(c.operativeState[person].captured,false);assert.ok(c.operativeState[person].hp>=15);assert.equal(c.operativeState[person].bleeding,0);assert.ok(contractExpiresSeconds(c.contracts[person])>clock(start)+13*3600);}
 for(const hire of r.hires){assert.equal(hire.arrival.travelHours,0);assert.equal(hire.quote.hours,24);assert.equal(hire.debited,hire.quote.total);assert.ok(r.local.includes(hire.id));}
 assert.equal(c.pendingEncounter,null);assert.equal(c.pendingBattle,null);assert.equal(c.defeated,false);saved({campaign:c});
}

function refused(start){
 const output=mkdtempSync(join(tmpdir(),'cordoba-urgent-care-raw-')),previous=process.env.GRANADEROS_CAMPAIGN_FAILURE_DIR;let failure;
 process.env.GRANADEROS_CAMPAIGN_FAILURE_DIR=output;
 try{stabilizeCordobaMedicalRear(start);}catch(error){failure=error;}finally{if(previous===undefined)delete process.env.GRANADEROS_CAMPAIGN_FAILURE_DIR;else process.env.GRANADEROS_CAMPAIGN_FAILURE_DIR=previous;}
 assert.ok(failure);const directory=join(output,'strategic-preparation'),leaf=readdirSync(directory).find(name=>name.includes('stabilizeCordobaMedicalRear-preparation-failure'));assert.ok(leaf);
 const read=name=>JSON.parse(readFileSync(join(directory,leaf,name),'utf8')),error=read('error.json'),context=read('context.json'),actual=read('campaign.json'),receipt=read('receipt.json');
 assert.equal(error.message,failure.message);assert.deepEqual(actual,JSON.parse(JSON.stringify(failure.campaign)));assert.deepEqual(context.receipt,JSON.parse(JSON.stringify(failure.cordobaMedicalRearUrgentCare)));
 assert.equal(receipt.additionalOrders,0);assert.equal(receipt.additionalSynchronization,0);assert.equal(receipt.saveNormalizationPerformed,false);assert.equal(receipt.settlementExecuted,false);
 // These failed outputs are plain-inspected only. No Native query, codec,
 // save, replay, second order or helper invocation consumes them.
 return failure;
}

test('fresh acute patients keep actual finite care after each two-kit paid relief issue exhausts',()=>{
 const s=setup(),start=s.campaign,before=structuredClone(start),result=stabilizeCordobaMedicalRear(start),r=result.receipt;
 verifyCare(start,result);assert.equal(r.hires.length,3);assert.deepEqual(r.hires.map(hire=>hire.id),s.relief);assert.equal(r.dressingsSpent,5);assert.equal(r.ticks.length,5);
 assert.ok(r.admissions.some(row=>row.hour>start.hour&&row.local.some(person=>person.medkits===0&&person.issue?.code==='no_medkits')));
 assert.equal(result.campaign.operativeState[s.relief[2]].medkits,1);assert.deepEqual(start,before);
 assert.deepEqual(stabilizeCordobaMedicalRear(saved({campaign:before}).campaign),result,'The successful fresh save repeats the actual paid care, issues and clock.');
});

test('an already supplied serving physician completes urgent care without another hire or finite transfer',()=>{
 const s=setup({initialKits:5,reliefCount:0}),start=s.campaign,before=structuredClone(start),result=stabilizeCordobaMedicalRear(start);
 verifyCare(start,result);assert.deepEqual(result.receipt.hires,[]);assert.deepEqual(result.receipt.linen,[]);assert.equal(result.receipt.dressingsSpent,5);assert.equal(result.campaign.operativeState[s.doctor].medkits,0);assert.deepEqual(start,before);
});

test('a known discovered local chest refills one actual dressing per needed care hour without a paid replacement',()=>{
 const s=setup({knownKits:5,reliefCount:0}),start=s.campaign,before=structuredClone(start),result=stabilizeCordobaMedicalRear(start),r=result.receipt;
 verifyCare(start,result);assert.deepEqual(r.hires,[]);assert.equal(r.linen.length,5);assert.ok(r.linen.every(row=>row.count===1&&row.kind==='container'));assert.equal(localStock(result.campaign),0);assert.equal(r.dressingsSpent,5);assert.deepEqual(start,before);
});

test('a genuinely exhausted issue stops with its actual two-hour paid prefix and raw supply admission reasons',()=>{
 const s=setup({reliefCount:1}),start=s.campaign,before=structuredClone(start),failure=refused(start),r=failure.cordobaMedicalRearUrgentCare;
 assert.match(failure.message,/supplied serving physician/);assert.equal(r.completed,false);assert.equal(r.hires.length,1);assert.equal(r.ticks.length,2);assert.equal(clock(failure.campaign)-clock(start),7200);assert.equal(r.admissions.at(-1).doctors.length,0);
 assert.ok(r.admissions.at(-1).local.some(person=>person.issue?.code==='no_medkits'));assert.equal(failure.campaign.operativeState[s.relief[0]].medkits,0);assert.equal(failure.campaign.resources.treasury,start.resources.treasury-r.hires[0].quote.total);assert.ok(failure.campaign.operativeState[s.patients[0]].hp<15);assert.deepEqual(start,before);
});

test('a declared real raid interrupts urgent care at the accepted wait without another supply or roster action',()=>{
 const s=setup({initialKits:5,reliefCount:0,raid:true}),start=s.campaign,before=structuredClone(start),failure=refused(start),r=failure.cordobaMedicalRearUrgentCare;
 assert.match(failure.message,/actual interruption/);assert.equal(r.completed,false);assert.ok(failure.campaign.pendingEncounter);assert.equal(r.orders.at(-1).type,'wait');assert.equal(clock(failure.campaign)-clock(start),7200);assert.deepEqual(r.hires,[]);assert.deepEqual(start,before);
});

test('a stable current cohort needs no additional urgent treatment, time, hires or finite supplies',()=>{
 const s=setup({stable:true,reliefCount:0}),start=s.campaign,before=structuredClone(start),result=stabilizeCordobaMedicalRear(start),c=result.campaign,r=result.receipt;
 assert.deepEqual(r.ticks,[]);assert.deepEqual(r.hires,[]);assert.deepEqual(r.linen,[]);assert.equal(r.dressingsSpent,0);assert.equal(clock(c),clock(start));assert.equal(c.resources.treasury,start.resources.treasury);assert.deepEqual(c.contracts,start.contracts);assert.equal(allIssues(c),allIssues(start));
 for(const id of start.recruited){assert.equal(c.operativeState[id].alive,true);assert.equal(c.operativeState[id].hp,start.operativeState[id].hp);assert.equal(c.operativeState[id].bleeding,0);assert.equal(c.operativeState[id].assignment,'rest');}assert.deepEqual(start,before);saved({campaign:c});
});

test('a Native-minimum physician gives the last finite treatment after two higher-skill issues exhaust',()=>{
 const s=setup({reliefSkills:[65,65,20]}),start=s.campaign,before=structuredClone(start),result=stabilizeCordobaMedicalRear(start),r=result.receipt;
 verifyCare(start,result);assert.deepEqual(r.hires.map(hire=>hire.id),s.relief);assert.equal(r.dressingsSpent,5);assert.equal(r.ticks.length,5);
 assert.deepEqual(r.ticks.map(tick=>tick.doctors),[[s.relief[0]],[s.relief[0]],[s.relief[1]],[s.relief[1]],[s.relief[2]]]);
 assert.deepEqual(s.declaration.content.characters.filter(person=>person.id.startsWith('relief-')).map(person=>person.attributes.medical),[65,65,20]);
 assert.equal(rosterFor(start).find(person=>person.id===s.relief[2]).medical,20);
 for(const id of s.relief.slice(0,2))assert.equal(result.campaign.operativeState[id].medkits,0);
 assert.equal(result.campaign.operativeState[s.relief[2]].medkits,1);assert.equal(result.campaign.operativeState[s.patients[1]].hp,17);assert.deepEqual(start,before);
});

// This independent notice case declares the exhaustion and wound before the
// factory. The healthy physician, patient and reserve enter paid service.
function noticeCareSetup(){
 const d=JSON.parse(JSON.stringify(scaffoldDocuments('cordoba-zero-time-care-notice')).replaceAll('watch-post',sector)),base=d.content.characters[0];
 d.content.rules.startingTreasury=20000;d.content.startingTerritory[sector].owner='patriot';d.content.campaignStory.chapters[0].conditions=[{type:'day',min:100,max:null}];d.world.expansion.buildingTargets={camp:0,[sector]:0};d.world.arrivalFacilities[sector]=['barracks'];d.content.arrivalSites.push({sector,facilities:['barracks']});
 d.content.characters=['notice-doctor','notice-patient','notice-reserve'].map((id,i)=>({...structuredClone(base),id,name:id,nickname:id,monthlyPay:30,serviceGuarantee:0,arrivalHours:0,weapon:null,attributes:{...base.attributes,maxHp:80,medical:i===1?0:90},startingSupplies:{rations:0,torches:0,boleadoras:0,medkits:i===0?2:i===2?1:0},startingCondition:{hp:i===1?15:i===2?50:80,bleeding:i===1?1:0,bandaged:0,energy:i===2?0:100,fatigue:0}}));
 d.world.enemyStrategy={version:1,theaters:{frontier:{legHours:1,reserve:0,raidEveryHours:240,axis:[sector]}}};
 const declaration=structuredClone(d),content=compileCampaignPackage(d.manifest,d);assert.deepEqual(validateContentPackage(content),[]);let c=initialCampaign(42,content);const people=rosterFor(c),id=key=>people.find(person=>person.contentId===key).id,doctor=id('notice-doctor'),patient=id('notice-patient'),reserve=id('notice-reserve');
 for(const person of [doctor,patient,reserve]){const quote=contractQuote(c,rosterFor(c).find(op=>op.id===person),'week'),cash=c.resources.treasury;c=order(c,{type:'recruitCivic',id:person,term:'week',destination:sector});assert.equal(c.resources.treasury,cash-quote.total);}
 c=order(c,{type:'createSquad',sector,ids:[doctor,patient,reserve],name:'Atención y descanso reales'});assert.deepEqual(d,declaration);return {campaign:saved({campaign:c}).campaign,doctor,patient,reserve};
}

test('a real zero-time sleep notice preserves finite linen before the next ordinary wait pays one actual care hour',()=>{
 const s=noticeCareSetup(),start=s.campaign,before=structuredClone(start),result=stabilizeCordobaMedicalRear(start),c=result.campaign,r=result.receipt;
 assert.equal(start.operativeState[s.reserve].energy,0);assert.equal(start.operativeState[s.reserve].asleep,false);assert.equal(start.operativeState[s.patient].bleeding,1);verifyCare(start,result);
 assert.equal(r.attentionNotices.length,1);const notice=r.attentionNotices[0];assert.equal(notice.from,clock(start));assert.equal(notice.to,notice.from);assert.equal(notice.dressingsSpent,0);assert.deepEqual(notice.doctors,[s.doctor]);assert.ok(notice.attention.some(row=>row.kind==='assignment'&&row.notice.advancedHours===0&&row.notice.events.some(event=>event.operativeId===s.reserve&&event.code==='sleep_started')));
 assert.equal(r.orders.filter(action=>action.type==='wait').length,2);assert.equal(r.ticks.length,1);assert.equal(r.dressingsSpent,1);assert.equal(clock(c)-clock(start),3600);assert.equal(c.operativeState[s.doctor].medkits,1);assert.equal(c.operativeState[s.reserve].medkits,1);assert.equal(c.operativeState[s.reserve].hp,start.operativeState[s.reserve].hp);assert.equal(c.operativeState[s.reserve].asleep,true);assert.ok(c.operativeState[s.reserve].energy>0&&c.operativeState[s.reserve].energy<100);assert.equal(c.operativeState[s.patient].bleeding,0);assert.deepEqual(c.squads,start.squads);assert.deepEqual(c.contracts,start.contracts);assert.deepEqual(start,before);
 let replay=saved({campaign:start}).campaign;for(const action of r.orders)replay=order(replay,action);assert.deepEqual(replay,c);saved({campaign:c});assert.deepEqual(stabilizeCordobaMedicalRear(saved({campaign:start}).campaign),result);
});
