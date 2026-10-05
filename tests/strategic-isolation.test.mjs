import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {advanceMorale} from '../game/morale.js';
import {strategicIsolationStatus} from '../game/strategic-isolation.js';
import {contractExpiresSeconds} from '../game/contracts.js';

const saved=s=>restoreCampaign(serializeCampaign(s));
const order=(s,a)=>{const before=structuredClone(s),next=dispatchCampaign(s,a);assert.equal(next.lastError,null,`${a.type}: ${next.lastError}`);assert.deepEqual(s,before);return saved(next);};
const op=s=>rosterFor(s).find(o=>o.id===130);
const r=s=>s.operativeState[130];
const stamp=s=>s.hour*3600+(s.secondOfHour??0);
const notices=s=>s.log.filter(e=>e.text.includes('pierde ánimo al quedar sin compañía militar'));

// Declared low-morale, secured subsystem checkpoint, not an earned conquest.
// The independent native acceptance earns the low morale with actual combat.
function prepared({oldPinned=false,morale=40,term='week',royalist=false,extraFriend=false}={}){
 const content=defaultContentPackage();
 if(oldPinned){const person=content.characters.find(c=>c.id==='person-130');person.abilities=person.abilities.filter(a=>a!=='nervous_isolation');}
 let s=initialCampaign(42,content);s.operativeState[130].morale=morale;if(!royalist)s.sectors.buenos_aires.owner='patriot';
 for(const id of [130,110,...(extraFriend?[100]:[])])s=dispatchCampaign(s,{type:'recruitCivic',id,term});
 s=dispatchCampaign(s,{type:'wait',hours:6});assert.equal(s.lastError,null);assert.ok(s.recruited.includes(130));return saved(s);
}
function alone(s){s=order(s,{type:'createSquad',name:'Cejas sola',ids:[130]});s=order(s,{type:'selectSquad',id:'squad-1'});s=order(s,{type:'travel',sector:'buenos_aires',queue:true});return s;}

test('actual hourly rest has a capped loss, rolling-second guard and once-only saved notice',()=>{
 let s=alone(prepared());s=order(s,{type:'assignCare',operativeId:130,assignment:'rest'});
 s=order(s,{type:'advanceStrategicTime',seconds:3600});assert.equal(r(s).morale,39);assert.deepEqual(r(s).strategicIsolation,{loss:1,lastHour:7});assert.equal(notices(s).length,1);
 s=order(s,{type:'advanceStrategicTime',seconds:1800});s=order(s,{type:'wait',hours:1});assert.equal(r(s).morale,38);assert.deepEqual(r(s).strategicIsolation,{loss:2,lastHour:8,lastSecond:1800});
 const paid=structuredClone(r(s).strategicIsolation);s=order(s,{type:'advanceStrategicTime',seconds:1800});assert.equal(stamp(s),9*3600);assert.deepEqual(r(s).strategicIsolation,paid);assert.equal(r(s).morale,38);
 s=order(s,{type:'advanceStrategicTime',seconds:3600});assert.equal(r(s).morale,37);
 for(let i=0;i<26;i++)s=order(s,{type:'wait',hours:1});
 assert.equal(r(s).morale,20);assert.equal(r(s).strategicIsolation.loss,20);assert.equal(r(s).moraleRestHours,0);assert.equal(notices(s).length,1);
 const before=structuredClone(s),loaded=saved(s);assert.deepEqual(loaded,before);assert.equal(strategicIsolationStatus(s,op(s)).active,true);assert.deepEqual(s,before,'reading the capped status cannot reset its budget');
 const after=order(loaded,{type:'wait',hours:6});assert.equal(r(after).morale,20);assert.equal(notices(after).length,1);
});

test('fractional real travel and timed return use own party; only an actual same-cell regroup resets the episode',()=>{
 let s=prepared();s=order(s,{type:'createSquad',name:'Cejas en marcha',ids:[130]});s=order(s,{type:'travel',sector:'buenos_aires',queue:true});
 s=order(s,{type:'advanceStrategicTime',seconds:3600});s=order(s,{type:'advanceStrategicTime',seconds:1800});assert.equal(r(s).morale,39);
 const q=s.squads.find(q=>q.members.includes(130));assert.equal(q.location,'retiro');assert.equal(q.journey.elapsed,1);assert.equal(q.journey.elapsedSecond,1800);
 assert.equal(strategicIsolationStatus(s,op(s)).active,true,'the origin resident has not accompanied the traveling party');
 s=order(s,{type:'cancelTravel',choice:'return'});assert.equal(s.squads.find(q=>q.members.includes(130)).journey.returning,true);
 s=order(s,{type:'advanceStrategicTime',seconds:1800});assert.equal(r(s).morale,38);assert.equal(strategicIsolationStatus(s,op(s)).active,true);
 s=order(s,{type:'advanceStrategicTime',seconds:3600});assert.equal(s.squads.find(q=>q.members.includes(130)).journey,undefined);assert.equal(r(s).morale,37);assert.ok(r(s).strategicIsolation);
 const returned=saved(s),before=structuredClone(returned);assert.equal(strategicIsolationStatus(returned,op(returned)).reason,'companion');assert.deepEqual(returned,before,'status does not clear an episode');
 s=order(returned,{type:'wait',hours:1});assert.equal(r(s).strategicIsolation,undefined);assert.equal(r(s).morale,37,'regroup does not refund the three earned losses');
});

test('separate moving parties do not support each other; a ready assault uses its real target cell',()=>{
 let s=prepared();s=order(s,{type:'createSquad',name:'Primera columna',ids:[130]});s=order(s,{type:'travel',sector:'buenos_aires',queue:true});
 s=order(s,{type:'selectSquad',id:'squad-1'});s=order(s,{type:'travel',sector:'buenos_aires',queue:true});s=order(s,{type:'wait',hours:1});assert.equal(r(s).morale,39);
 assert.equal(strategicIsolationStatus(s,op(s)).active,true);
 s=prepared({royalist:true,extraFriend:true});s=order(s,{type:'createSquad',name:'Límite de ataque',ids:[130]});const first=s.activeSquadId;s=order(s,{type:'attack',sector:'buenos_aires',queue:true});
 for(let i=0;i<12;i++)s=order(s,{type:'wait',hours:1});
 const q=s.squads.find(q=>q.id===first);assert.equal(q.journey.status,'ready');assert.equal(q.location,'retiro');assert.equal(strategicIsolationStatus(s,op(s)).reason,'isolated','stationary origin residents are not at the completed assault target');
 s=order(s,{type:'createSquad',name:'Segunda columna',ids:[110],sector:'retiro'});s=order(s,{type:'attack',sector:'buenos_aires',queue:true});
 for(let i=0;i<12;i++)s=order(s,{type:'wait',hours:1});
 assert.equal(strategicIsolationStatus(s,op(s)).reason,'companion','two ready parties share the actual target');
 s=order(s,{type:'wait',hours:1});assert.equal(r(s).strategicIsolation,undefined);
});

test('real sleep pauses the episode, exact expiry precedes the tick, and old omission remains neutral',()=>{
 let s=alone(prepared({term:'day'}));s=order(s,{type:'wait',hours:1});assert.equal(r(s).morale,39);
 s=order(s,{type:'assignWork',operativeId:130,assignment:'practice',skill:'medical'});s=order(s,{type:'wait',hours:1});assert.ok(r(s).fatigue>0);
 s=order(s,{type:'setSleep',operativeId:130,asleep:true});const receipt=structuredClone(r(s).strategicIsolation),beforeSleep=r(s).morale;s=order(s,{type:'wait',hours:1});assert.deepEqual(r(s).strategicIsolation,receipt);assert.equal(r(s).morale,beforeSleep);assert.ok(r(s).strategicIsolation);
 if(r(s).asleep)s=order(s,{type:'setSleep',operativeId:130,asleep:false});
 const expiry=contractExpiresSeconds(s.contracts[130]);assert.equal(expiry,30*3600);
 while(stamp(s)<expiry-1){const seconds=Math.min(3600,expiry-1-stamp(s)),before=stamp(s);s=order(s,{type:'advanceStrategicTime',seconds});assert.ok(stamp(s)>before);}
 const last=structuredClone(r(s).strategicIsolation),morale=r(s).morale,cash=s.resources.treasury;s=order(s,{type:'advanceStrategicTime',seconds:1});assert.equal(stamp(s),expiry);assert.equal(s.recruited.includes(130),false);assert.equal(s.contracts[130],undefined);assert.equal(r(s).morale,morale);assert.deepEqual(r(s).strategicIsolation,last);assert.equal(s.resources.treasury,cash);
 let old=alone(prepared({oldPinned:true}));old=order(old,{type:'assignCare',operativeId:130,assignment:'rest'});old=order(old,{type:'wait',hours:6});assert.equal(r(old).morale,41);assert.equal(r(old).strategicIsolation,undefined);assert.equal(notices(old).length,0);
});

test('fractional final loss and historical receipts validate strictly; deployed time cannot charge a second fear rule',()=>{
 let s=alone(prepared({morale:.4}));s=order(s,{type:'wait',hours:1});assert.equal(r(s).morale,0);assert.deepEqual(r(s).strategicIsolation,{loss:.4,lastHour:7});
 const good=saved(s);
 for(const change of [v=>v.loss=0,v=>v.loss=20.01,v=>v.loss=null,v=>v.lastHour=8,v=>v.lastSecond=1,v=>v.lastSecond=3600,v=>v.extra=true]){
  const bad=structuredClone(good);change(r(bad).strategicIsolation);assert.throws(()=>saved(bad),/temor estratégico/);
 }
 const stripped=prepared({oldPinned:true});r(stripped).strategicIsolation={loss:.4,lastHour:6};assert.throws(()=>saved(stripped),/temor estratégico/);
 s=order(s,{type:'selectSquad',id:s.squads.find(q=>q.members.includes(130)).id});s=order(s,{type:'visitSector'});assert.equal(Object.hasOwn(s.pendingBattle.squad[0],'strategicIsolation'),false);
 const receipt=structuredClone(r(s).strategicIsolation);s=order(s,{type:'syncTacticalTime',battleId:s.pendingBattle.id,elapsedSeconds:7200});assert.equal(r(s).morale,0);assert.deepEqual(r(s).strategicIsolation,receipt);
 for(const field of ['captured','asleep','unconscious','departure']){const control=structuredClone(good);r(control)[field]=true;assert.equal(strategicIsolationStatus(control,op(control)).eligible,false);}
 const control=structuredClone(good);r(control).hp=14;assert.equal(strategicIsolationStatus(control,op(control)).eligible,false);
 const snapshot=structuredClone(good);assert.deepEqual(advanceMorale(good,rosterFor(good)),[]);assert.equal(r(good).morale,0);assert.deepEqual(r(good).strategicIsolation,r(snapshot).strategicIsolation,'same-hour application cannot create a zero-loss receipt');
});
