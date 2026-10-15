import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readdirSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createBattle,actBattle,presentedActBattle,medicalUsePreview} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {defaultContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {quoteRescuerFirstAid} from './rescued-first-aid-quote.mjs';
import {stabilizeRescued} from './northern-route.mjs';

const save=c=>decodeSave(encodeSave(c)).campaign;
const order=(c,a)=>{const n=dispatchCampaign(c,a);assert.equal(n.lastError,null,n.lastError);return n;};
const clock=c=>c.hour*3600+(c.secondOfHour??0);
const unit=(b,id)=>b.units.find(u=>u.id===id);
const doctor={id:'doctor',x:2,y:2,medical:60,dexterity:75,experienceLevel:4,medkits:4,activeSlot:'medical'};

test('pure actual-physician stroke quotes match paid Native aid, presented results and saved replay without editing wounds or stock',()=>{
 for(const physician of [doctor,{...doctor,medical:20,dexterity:0,experienceLevel:1},{...doctor,medical:91,dexterity:95,experienceLevel:8}]){
  const exploration=physician.medical===20;
  const start=createBattle([physician,{id:'rescuer',x:3,y:2,hp:1,maxHp:100,bleeding:10,bandaged:0}],{width:8,height:8,exploration,enemies:exploration?[]:[{id:'enemy',x:7,y:7,patrol:false,overwatch:false}],hour:12,seed:43});
  const before=structuredClone(start),quote=quoteRescuerFirstAid(unit(start,'doctor'),[unit(start,'rescuer')]);
  assert.deepEqual(start,before);assert.ok(quote.dressings>=1&&quote.dressings<14);
  let battle=start,replay=validateBattleSnapshot(JSON.parse(JSON.stringify(start)));
  for(const plan of quote.patients[0].strokes){
   assert.deepEqual(medicalUsePreview(battle,unit(battle,'doctor'),unit(battle,'rescuer')).treatment,plan);
   const action={type:'heal',unitId:'doctor',targetId:'rescuer'},next=actBattle(battle,action);
   assert.equal(next.lastError,null);assert.deepEqual(presentedActBattle(battle,action).state,next);
   assert.equal(unit(next,'doctor').medkits,unit(battle,'doctor').medkits-plan.dressingsUsed);
   assert.equal(unit(next,'doctor').ap,unit(battle,'doctor').ap-(exploration?0:plan.paCost));
   assert.equal(unit(next,'rescuer').hp,plan.hpAfter);assert.equal(unit(next,'rescuer').bleeding,plan.bleedingAfter);
   replay=validateBattleSnapshot(JSON.parse(JSON.stringify(actBattle(replay,action))));assert.deepEqual(replay,next);battle=next;
  }
  assert.equal(unit(battle,'rescuer').hp,15);assert.equal(unit(battle,'rescuer').bleeding,0);
  if(exploration)assert.ok(battle.elapsedSeconds>start.elapsedSeconds);
  assert.equal(unit(battle,'doctor').medkits,unit(start,'doctor').medkits-quote.dressings);assert.deepEqual(start,before);
 }
});

test('quotation uses Native attribute fallbacks and prices one-HP, near-stable and ordinary bleeding wounds as strokes',()=>{
 const raw={id:7,stats:{medical:60,dexterity:75},xp:300,medkits:0},patients=[{id:1,maxHp:100,hp:1,bleeding:0,bandaged:99},{id:2,maxHp:100,hp:14,bleeding:0,bandaged:86},{id:3,maxHp:100,hp:80,bleeding:3,bandaged:0}],before=structuredClone({raw,patients});
 const quote=quoteRescuerFirstAid(raw,patients);
 assert.equal(quote.physician.experienceLevel,7);assert.equal(quote.physician.dexterity,75);assert.equal(quote.physician.medical,60);
 assert.deepEqual(quote.patients.map(p=>p.dressings),[2,1,1]);assert.equal(quote.dressings,4);
 assert.deepEqual({raw,patients},before,'A prospective supply quote adds no real dressing or recovery.');
 assert.throws(()=>quoteRescuerFirstAid({...raw,medical:0},patients),/actual physician cannot quote/);
 assert.throws(()=>quoteRescuerFirstAid(raw,[{id:'dead',maxHp:100,hp:0,bleeding:0}]),/living rescuer/);
});

// This declaration isolates local care. It does not claim rescue or battle
// acceptance. All wounds, skill and finite linen exist before initialCampaign.
function clinic({kits=3}={}){
 const content=defaultContentPackage();content.headquarters='tucuman';delete content.startingTerritory;
 content.rules.startingTreasury=10000;
 for(const id of [110,112,123]){
  const p=content.characters.find(p=>p.id===`person-${id}`);p.arrivalHours=0;
  p.attributes={...p.attributes,maxHp:100,medical:id===110?60:0,dexterity:75};
  p.startingSupplies={rations:2,torches:0,medkits:id===110?kits:0,boleadoras:0};
  p.startingCondition={hp:id===123?1:id===112?95:100,bleeding:0,bandaged:id===123?99:id===112?5:0,energy:100,fatigue:0};
 }
 const declared=structuredClone(content);let c=initialCampaign(42,content);
 for(const id of [110,112,123])c=order(c,{type:'recruitCivic',id,term:'week'});
 c=order(c,{type:'createSquad',ids:[110,112,123],name:'Clínica de rescate',sector:'tucuman'});
 assert.deepEqual(content,declared);return save(c);
}

test('the actual local clinic spends two Native critical strokes and reserves the released prisoner’s one clinical stroke',()=>{
 const start=clinic(),before=structuredClone(start),result=stabilizeRescued(start,{patients:[112]}),c=result.campaign;
 assert.equal(result.emergencyAidQuote.dressings,2);assert.equal(result.dressingTarget,3);
 assert.equal(result.emergencyAid.usedDressings,2);assert.equal(result.emergencyAid.steps.filter(a=>a.type==='useItem').length,2);
 assert.equal(result.usedDressings,1);assert.equal(c.operativeState[110].medkits,0);
 assert.equal(c.operativeState[123].hp,15);assert.equal(c.operativeState[123].bleeding,0);assert.ok(c.operativeState[112].hp>95);
 for(const id of [110,112,123]){assert.equal(c.operativeState[id].alive,true);assert.ok(c.recruited.includes(id));assert.equal(c.operativeState[id].location,'tucuman');}
 assert.ok(clock(c)>clock(start));assert.equal(c.resources.treasury,start.resources.treasury);assert.deepEqual(c.contracts,start.contracts);
 assert.deepEqual(save(c),c);assert.deepEqual(stabilizeRescued(save(start),{patients:[112]}),result);assert.deepEqual(start,before);
});

test('a genuine one-dressing shortage still refuses and passively records the exact entry and missing-stock state',()=>{
 const start=clinic({kits:2}),before=structuredClone(start),directory=mkdtempSync(join(tmpdir(),'granaderos-rescued-quote-')),prior=process.env.GRANADEROS_CAMPAIGN_FAILURE_DIR;
 process.env.GRANADEROS_CAMPAIGN_FAILURE_DIR=directory;
 try{
  assert.throws(()=>stabilizeRescued(start,{patients:[112]}),/known finite local dressings/);
  const root=join(directory,'strategic-preparation'),captures=readdirSync(root).map(name=>join(root,name)),receipts=captures.map(path=>({path,receipt:JSON.parse(readFileSync(join(path,'receipt.json'),'utf8'))}));
  assert.equal(receipts.length,2);const entry=receipts.find(x=>x.receipt.stage==='preparation-input'),missing=receipts.find(x=>x.receipt.stage==='missing-finite-dressings');assert.ok(entry&&missing);
  assert.deepEqual(JSON.parse(readFileSync(join(entry.path,'campaign.json'),'utf8')),start);
  assert.deepEqual(JSON.parse(readFileSync(join(missing.path,'campaign.json'),'utf8')),start);
  const context=JSON.parse(readFileSync(join(missing.path,'context.json'),'utf8'));
  assert.equal(context.dressingTarget,3);assert.equal(context.emergencyAidQuote.dressings,2);assert.deepEqual(context.orders,[]);assert.equal(missing.receipt.inputCapture,entry.path);
  for(const {receipt}of receipts){assert.equal(receipt.additionalOrders,0);assert.equal(receipt.additionalSynchronization,0);assert.equal(receipt.saveNormalizationPerformed,false);}
  assert.deepEqual(start,before);assert.equal(rosterFor(start).find(op=>op.id===110).medical,60);
 }finally{if(prior===undefined)delete process.env.GRANADEROS_CAMPAIGN_FAILURE_DIR;else process.env.GRANADEROS_CAMPAIGN_FAILURE_DIR=prior;rmSync(directory,{recursive:true,force:true});}
});
