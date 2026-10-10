import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {prepareFreshTucumanAssault} from './fresh-campaign-route.mjs';
import {rosterFor} from '../game/campaign.js';
import {carriedAmmunition} from '../game/campaign-ammunition.js';
import {ammoTypeFor,ammoCount} from '../game/ammo-types.js';
import {addAmmoCounts,unitAmmunitionByType,stackAmmunitionByType} from '../game/physical-ammunition.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {decodeSave} from '../game/save.js';

const sha=value=>createHash('sha256').update(value).digest('hex');
const proof=JSON.parse(readFileSync(new URL('./fixtures/tucuman-earned-ammunition-preparation.provenance.json',import.meta.url)));
const packed=readFileSync(new URL('./fixtures/'+proof.fixture.path,import.meta.url)),raw=gunzipSync(packed);
assert.equal(sha(packed),proof.fixture.gzipSha256);assert.equal(sha(raw),proof.fixture.rawSha256);

// Living scene records are presentation copies. Count current field owners and
// public physical sources, including loaded spare guns and actual dead bodies.
function finiteColumnPool(campaign){
 const roster=rosterFor(campaign),counts={};
 for(const id of proof.fieldIds)addAmmoCounts(counts,unitAmmunitionByType(carriedAmmunition(roster.find(op=>op.id===id),campaign.operativeState[id])));
 for(const row of sectorInventoryModel(campaign,'cordoba',roster,108).entries)addAmmoCounts(counts,stackAmmunitionByType(JSON.parse(row.expected)));
 return counts;
}
const clock=campaign=>({hour:campaign.hour,second:campaign.secondOfHour??0});
const seconds=campaign=>campaign.hour*3600+(campaign.secondOfHour??0);

test('earned Tucuman preparation supplies the whole column once from finite selected-family stock',()=>{
 const input=decodeSave(raw.toString('utf8')).campaign,before=structuredClone(input),checkpoints=new Map(),events=[];
 const directory=process.env.GRANADEROS_TUCUMAN_AMMUNITION_RECEIPT_DIR??mkdtempSync(join(tmpdir(),'granaderos-earned-tucuman-ammunition-'));
 mkdirSync(directory,{recursive:true});
 const priorFailureDirectory=process.env.GRANADEROS_CAMPAIGN_FAILURE_DIR;
 process.env.GRANADEROS_CAMPAIGN_FAILURE_DIR=join(directory,'native-failures');
 const sourceHash=()=>sha(readFileSync(new URL('./fresh-campaign-route.mjs',import.meta.url)));
 const receipt={scope:'One corrected original preparation invocation from an immutable earned input. No full route, battle, seed/controller variant or stock splice.',inputRawSha256:sha(raw),preparationSourceBefore:sourceHash(),target:proof.target,invocations:0,guardEvents:[],startedAt:new Date().toISOString()};
 let result;
 try{
  assert.deepEqual(clock(input),proof.expectedInputClock);
  assert.equal(input.pendingEncounter,null);assert.equal(input.pendingBattle,null);
  assert.deepEqual(input.enemyGroups.filter(group=>!['defeated','withdrawn'].includes(group.status)),[]);
  assert.deepEqual(input.recruited.filter(id=>input.operativeState[id].alive&&!input.operativeState[id].captured),proof.fieldIds);
  for(const id of proof.fieldIds){assert.equal(input.operativeState[id].hp,input.operativeState[id].maxHp);assert.equal(input.operativeState[id].bleeding,0);}
  const report=event=>{
   // This guard stops an unexpected fight before fightNorthernSector executes
   // its controller. It makes no decision in the observed preparation case.
   if(['battleStarted','tucumanRecoveryInterrupted'].includes(event.event)){
    receipt.guardEvents.push(event.event);throw Error('The focused earned preparation cannot execute an unexpected fight.');
   }
   events.push(structuredClone(event));
  };
  receipt.invocations++;
  result=prepareFreshTucumanAssault(input,{artillerySupport:true,report,onCheckpoint:(name,campaign)=>{
   const snapshot=structuredClone(campaign);checkpoints.set(name,snapshot);
   writeFileSync(join(directory,name+'.campaign.json'),JSON.stringify(snapshot)+'\n');
  }});
  writeFileSync(join(directory,'result.campaign.json'),JSON.stringify(result)+'\n');
  assert.deepEqual(input,before,'preparation preserves its independently recorded input');
  assert.equal(sha(readFileSync(new URL('./fixtures/'+proof.fixture.path,import.meta.url))),proof.fixture.gzipSha256);
  const armament=checkpoints.get('tucuman-preliminary-armament-input'),supply=checkpoints.get('tucuman-authoritative-ammunition-input');
  assert.ok(armament&&supply,'the passive checkpoints expose both native finite boundaries');
  assert.deepEqual(clock(armament),proof.expectedArmamentClock);assert.deepEqual(clock(supply),proof.expectedSupplyClock);
  assert.deepEqual(finiteColumnPool(armament),proof.expectedFiniteColumnAndKnownCordobaStocks);
  assert.deepEqual(finiteColumnPool(supply),finiteColumnPool(armament));
  assert.deepEqual(finiteColumnPool(result),finiteColumnPool(armament),'loaded guns, loose rounds and retained stocks conserve every family');
  const diagnosticDirectory=join(directory,'native-failures','ammunition-preparation');
  const outputFile=readdirSync(diagnosticDirectory).find(file=>file.endsWith('-tucuman-preliminary-armament-output.json'));
  assert.ok(outputFile);const armamentOutput=JSON.parse(readFileSync(join(diagnosticDirectory,outputFile)));
  assert.deepEqual(armamentOutput.context.acceptedActions.map(row=>row.action),proof.retainedArmamentOrders,'all original firearm and rest orders remain; ammunition is allocated only at the authoritative boundary');
  assert.deepEqual(finiteColumnPool(armamentOutput.campaign),finiteColumnPool(armament));
  const transactions=events.filter(event=>event.action&&event.family),taken={};
  for(const transaction of transactions){assert.equal(transaction.cost,0);taken[transaction.family]=(taken[transaction.family]??0)+transaction.quantity;}
  assert.deepEqual(taken,{ammoRifle:6,ammoMusket:58});
  assert.equal(result.pendingBattle.sector,'tucuman');assert.equal(result.pendingEncounter,null);
  assert.deepEqual(result.pendingBattle.squad.map(unit=>unit.id).sort((a,b)=>a-b),[...proof.fieldIds].sort((a,b)=>a-b));
  const roster=rosterFor(result),readiness=[];
  for(const id of proof.fieldIds){
   const record=result.operativeState[id],unit=carriedAmmunition(roster.find(op=>op.id===id),record),family=ammoTypeFor(unit),total=unit.loaded+ammoCount(unit,family);
   assert.ok(result.recruited.includes(id)&&record.alive&&!record.captured);
   assert.ok(total>=proof.target,'every actual field owner keeps target 10 compatible rounds');
   assert.ok(unit.loaded>0&&ammoCount(unit,family)>0,'native reloads leave both a load and compatible reserves');
   assert.equal(record.hp,record.maxHp);assert.equal(record.bleeding,0);
   assert.ok(result.contracts[id].paid>0);assert.ok(result.contracts[id].expiresAt>result.hour);
   readiness.push({id,family,loaded:unit.loaded,reserve:ammoCount(unit,family),total,expiresAt:result.contracts[id].expiresAt,paid:result.contracts[id].paid});
  }
  for(const [id,record]of Object.entries(before.operativeState))assert.equal(result.operativeState[id].alive,record.alive,'native preparation retains every earlier death and survivor');
  assert.ok(seconds(result)>seconds(supply));assert.ok(result.resources.treasury>=0);
  assert.deepEqual(events.filter(event=>event.event==='battleFinished'),[]);assert.deepEqual(receipt.guardEvents,[]);
  const chest=result.sectorStates.cordoba.props.find(prop=>prop.id==='cordoba:building:chest:17:1');
  assert.equal(chest.contents.find(stack=>stack.ammoType==='musket_75').count,13);
  assert.equal(chest.contents.find(stack=>stack.ammoType==='rifle_62').count,34);
  assert.equal(sourceHash(),receipt.preparationSourceBefore,'the single preparation runs on a frozen source');
  Object.assign(receipt,{status:'passed',inputClock:clock(before),supplyClock:clock(supply),resultClock:clock(result),treasury:result.resources.treasury,readiness,taken,finitePool:finiteColumnPool(result),pendingAssault:result.pendingBattle.sector,retainedArmamentOrders:proof.retainedArmamentOrders.length});
 }catch(caught){receipt.status='failed';receipt.error={message:caught.message,stack:caught.stack};throw caught;}
 finally{
  if(priorFailureDirectory===undefined)delete process.env.GRANADEROS_CAMPAIGN_FAILURE_DIR;else process.env.GRANADEROS_CAMPAIGN_FAILURE_DIR=priorFailureDirectory;
  receipt.finishedAt=new Date().toISOString();receipt.preparationSourceAfter=sourceHash();receipt.preparationSourceDrift=receipt.preparationSourceBefore!==receipt.preparationSourceAfter;
  writeFileSync(join(directory,'events.json'),JSON.stringify(events)+'\n');
  writeFileSync(join(directory,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
 }
});
