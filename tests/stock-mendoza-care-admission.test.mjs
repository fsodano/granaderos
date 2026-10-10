import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {actBattle} from '../game/tactical.js';
import {stabilizeStockMendozaSurvivors} from './created-cuyo-route.mjs';

const provenance=JSON.parse(readFileSync(new URL('./fixtures/mendoza-earned-survivor-care.provenance.json',import.meta.url),'utf8'));
const bytes=readFileSync(new URL('./fixtures/mendoza-earned-survivor-care.json.gz',import.meta.url));
const digest=value=>createHash('sha256').update(value).digest('hex');
assert.equal(bytes.length,provenance.fixture.bytes);assert.equal(digest(bytes),provenance.fixture.sha256);
const decoded=gunzipSync(bytes);
assert.equal(decoded.length,provenance.fixture.decodedBytes);assert.equal(digest(decoded),provenance.fixture.decodedSha256);
const fixture=JSON.parse(decoded);
const record=(name,value)=>{
 const directory=process.env.GRANADEROS_CARE_CONTROL_DIR;if(!directory)return;
 mkdirSync(directory,{recursive:true});writeFileSync(join(directory,name),JSON.stringify(value,null,2)+'\n');
};

test('the original accepted Mendoza care approach reproduces the captured bleeding death before a dressing is spent',()=>{
 const before=structuredClone(fixture.recordedBeforeBattle),original=structuredClone(before),action=structuredClone(fixture.recordedAction);
 const after=actBattle(before,action);
 record('original-native-control.json',{before,action,after,nativeActionInvocations:1});
 assert.deepEqual(after,fixture.recordedNativeAfter,'the one original native care order retains its entire observed result');
 assert.deepEqual(before,original,'the original input is not modified');
 assert.deepEqual(action,{type:'useItem',unitId:'112',targetId:'129'});
 assert.equal(after.lastError,null);
 assert.equal(before.units.find(u=>u.id==='129').hp,15);
 assert.equal(before.units.find(u=>u.id==='129').bleeding,5);
 assert.equal(after.units.find(u=>u.id==='129').hp,0);
 assert.equal(after.units.find(u=>u.id==='112').medkits,before.units.find(u=>u.id==='112').medkits);
 assert.equal(after.elapsedSeconds-before.elapsedSeconds,26);
});

test('finite hourly care admits the actual local bleeder at 15 HP before any paid approach and preserves real losses',()=>{
 const start=structuredClone(fixture.earnedCampaign),original=structuredClone(start);
 const serving=start.recruited.filter(id=>start.operativeState[id].alive&&!start.operativeState[id].captured);
 const dead=Object.entries(start.operativeState).filter(([,r])=>!r.alive).map(([id])=>Number(id));
 const events=[];let hourly,accepted,stopped,returned,failure;
 try{
  returned=stabilizeStockMendozaSurvivors(start,{returnSector:'mendoza',report:value=>{
   if(value.event==='stockMendozaCareCheckpoint'&&value.stage==='hourly-stabilization')hourly=value;
   if(value.event==='stockMendozaCareStopped')stopped=value;
   if(value.event==='stockMendozaCareAccepted')accepted={orders:value.orders,hourlyDressings:value.hourlyDressings,tacticalDressings:value.tacticalDressings,clinicalPA:value.clinicalPA,renewalCost:value.renewalCost};
   if(['stockMendozaCareOrder','stockMendozaCareAdmissionSupply','stockMendozaCareHour'].includes(value.event))events.push(value);
  }});
 }catch(error){failure={name:error.name,code:error.code??null,message:error.message};throw error;}
 finally{record('corrected-care-control.json',{startingCampaign:start,hourlyCheckpoint:hourly,accepted,stopped,returnedCampaign:returned,failure,events,helperInvocations:1,returnSector:'mendoza'});}
 assert.ok(hourly,'the actual admitted care hour must finish before a tactical approach');
 const h=hourly.campaign,r=h.operativeState[129];
 assert.equal(h.hour,start.hour+1);assert.equal(h.secondOfHour,start.secondOfHour);
 assert.equal(h.pendingBattle,null);assert.equal(h.pendingEncounter,null);assert.equal(h.defeated,false);assert.equal(h.completed,false);
 assert.equal(r.alive,true);assert.equal(r.hp,start.operativeState[129].hp,'stopping the bleed grants no healed HP');
 assert.equal(r.maxHp,start.operativeState[129].maxHp);assert.ok(r.hp<r.maxHp,'the actual wound remains');assert.equal(r.bleeding,0);assert.equal(r.assignment,'active');
 assert.equal(hourly.hourlyDressings,1);
 const careHour=events.find(e=>e.event==='stockMendozaCareHour');
 assert.deepEqual(careHour.doctors,[112]);assert.deepEqual(careHour.patients,[129]);assert.equal(careHour.dressings,1);
 const supply=events.find(e=>e.event==='stockMendozaCareAdmissionSupply');
 assert.equal(supply.doctorId,112);assert.equal(supply.sourceKey,'["body","8","medkits"]');
 assert.equal(supply.sourceBefore-supply.sourceAfter,1);assert.equal(supply.poolBefore-supply.poolAfter,1);
 assert.equal(supply.carriedBefore,0);assert.equal(supply.carriedAfter,1);assert.equal(h.operativeState[112].medkits,0);
 assert.equal(h.operativeState[112].assignment,'active');
 assert.equal(h.operativeState[140].hp,start.operativeState[140].hp-1);assert.equal(h.operativeState[124].hp,start.operativeState[124].hp-1);
 assert.equal(h.operativeState[140].bleeding,2);assert.equal(h.operativeState[124].bleeding,3);
 const beforeHourOrders=events.filter(e=>e.event==='stockMendozaCareOrder'&&e.order<=hourly.orders);
 assert.equal(beforeHourOrders.some(e=>e.kind==='tactical'),false,'local bleeding is stopped before spending tactical time');
 assert.ok(beforeHourOrders.some(e=>e.action.type==='wait'&&e.action.hours===1));
 assert.equal(start.resources.treasury-h.resources.treasury,hourly.renewalCost,'care spends the actual renewal price; existing dressings have no new purchase');
 for(const id of [2,57]){assert.equal(h.operativeState[id].alive,true);assert.equal(h.operativeState[id].hp,start.operativeState[id].hp);assert.equal(returned.operativeState[id].alive,true);}
 for(const id of dead){assert.equal(h.operativeState[id].alive,false);assert.equal(returned.operativeState[id].alive,false);}
 for(const id of serving){const actual=returned.operativeState[id];assert.equal(actual.alive,true);assert.ok(actual.hp>=15);assert.equal(actual.bleeding,0);assert.equal(actual.captured,false);assert.ok(returned.recruited.includes(id));}
 assert.equal(returned.location,'mendoza');assert.equal(returned.defeated,false);assert.equal(returned.completed,false);
 assert.deepEqual(start,original,'finite care retains the entire earned starting campaign');
});
