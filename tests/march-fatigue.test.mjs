import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {marchFatigueRate} from '../game/march-fatigue.js';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,`${a.type}: ${n.lastError}`);return n;};
const r=(s,id=3)=>s.operativeState[id];
const open=()=>{const s=initialCampaign();for(const sector of Object.values(s.sectors))sector.owner='patriot';return s;};
test('ordinary foot travel accrues fatigue for each actual hour',()=>{
 let s=order(initialCampaign(),{type:'travel',sector:'buenos_aires'});assert.equal(s.hour,12);assert.equal(r(s).fatigue,24);assert.equal(r(s).energy,76);
 s=order(s,{type:'travel',sector:'retiro'});assert.equal(s.hour,24);assert.equal(r(s).fatigue,48);assert.equal(r(s).energy,52);assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);
});
test('terrain, excess carried weight and transport change the hourly effort',()=>{
 const unit={strength:50,weight:0,weapon:0,blade:0};assert.equal(marchFatigueRate(unit),2);assert.equal(marchFatigueRate(unit,{mountain:true}),3);assert.equal(marchFatigueRate({...unit,weight:50}),4);assert.equal(marchFatigueRate({...unit,weight:50},{mode:'carts'}),1);assert.equal(marchFatigueRate({...unit,canMount:true}),1);
 let s=open();s.location='mendoza';s.squads[0].location='mendoza';s=order(s,{type:'travel',sector:'uspallata'});assert.equal(s.hour,18);assert.equal(r(s).fatigue,54);assert.equal(r(s).energy,46);
});
test('a long route stops at a real sector when the squad needs rest',()=>{
 let s=open();s=order(s,{type:'travel',sector:'humahuaca'});assert.notEqual(s.location,'humahuaca');assert.equal(s.hour,48);assert.equal(r(s).fatigue,96);assert.equal(r(s).energy,10);assert.equal(s.squads[0].location,s.location);assert.equal(s.squads[0].journey.reason,'exhausted');
 const before=serializeCampaign(s);assert.match(dispatchCampaign(s,{type:'travel',sector:'humahuaca'}).lastError,/descansar/);assert.equal(serializeCampaign(s),before);
 assert.ok(r(s).asleep);assert.ok(r(s).sleepCollapsed);s=order(s,{type:'wait',hours:24});assert.equal(s.hour,60);assert.ok(!r(s).asleep);assert.equal(r(s).sleepCollapsed,false);s=order(s,{type:'resumeTravel'});s=order(s,{type:'wait',hours:72});assert.equal(s.location,'humahuaca');
});
test('travel charges only traveling staff and leaves another squad to recover',()=>{
 let s=initialCampaign();Object.assign(r(s,10),{energy:40,fatigue:40});s=order(s,{type:'createSquad',name:'Marcha',ids:[3]});s=order(s,{type:'travel',sector:'buenos_aires'});assert.equal(r(s).fatigue,24);assert.equal(r(s,10).fatigue,28);assert.equal(s.squads[0].location,'retiro');
});
test('contract departure stops charging a soldier who no longer travels',()=>{
 let s=initialCampaign();s=order(s,{type:'createSquad',name:'Contrato breve',ids:[3]});s.contracts[3]={kind:'paid',term:'day',started:0,expiresAt:6,paid:100};s=order(s,{type:'travel',sector:'buenos_aires'});assert.equal(r(s).fatigue,24);assert.ok(!s.recruited.includes(3));assert.equal(s.location,'buenos_aires');
});
test('an attack march carries its accumulated fatigue into the real deployment',()=>{
 let s=order(initialCampaign(),{type:'travel',sector:'buenos_aires'});s=order(s,{type:'attack',sector:'san_nicolas'});assert.equal(s.hour,24);assert.equal(r(s).fatigue,48);assert.equal(s.pendingBattle.squad.find(u=>u.id===3).energy,52);const before=structuredClone(r(s));s=order(s,{type:'syncTacticalTime',battleId:s.pendingBattle.id,elapsedSeconds:7200});assert.deepEqual(r(s),before);
});
test('the original campaign march commander activates the documented service benefit',()=>{
 const s=initialCampaign();s.recruited.push(57);const next=order(s,{type:'travel',sector:'buenos_aires'});assert.equal(r(next).fatigue,0);assert.equal(next.hour,12);
});
test('exhaustion cannot prevent combat after the squad has already reached hostile territory',()=>{
 let s=initialCampaign();s.location='san_nicolas';s.squads[0].location='san_nicolas';for(const id of s.squad)Object.assign(r(s,id),{fatigue:96,energy:10});s=order(s,{type:'attack',sector:'san_nicolas'});assert.equal(s.hour,0);assert.ok(s.pendingBattle);assert.equal(s.pendingBattle.squad[0].energy,10);
});
