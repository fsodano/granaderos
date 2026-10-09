import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {marchFatigueRate} from '../game/march-fatigue.js';
import {cellTravelPlan,worldCell} from '../game/world-cells.js';
import {travelLegHours} from '../game/squad-travel.js';
import {completeTestTravel} from './campaign-test-helpers.mjs';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,`${a.type}: ${n.lastError}`);return n;};
const r=(s,id=3)=>s.operativeState[id];
const open=()=>{const s=initialCampaign();for(const sector of Object.values(s.sectors))sector.owner='patriot';return s;};
test('ordinary foot travel accrues fatigue for each actual hour',()=>{
 let s=initialCampaign();const outward=cellTravelPlan(s,'buenos_aires').hours;s=order(s,{type:'travel',sector:'buenos_aires'});assert.equal(s.hour,outward);assert.equal(r(s).fatigue,outward*2);assert.equal(r(s).energy,100-outward*2);
 const total=outward+cellTravelPlan(s,'retiro').hours;s=order(s,{type:'travel',sector:'retiro'});assert.equal(s.hour,total);assert.equal(r(s).fatigue,total*2);assert.equal(r(s).energy,100-total*2);assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);
});
test('terrain, excess carried weight and transport change the hourly effort',()=>{
 const unit={strength:50,weight:0,weapon:0,blade:0};assert.equal(marchFatigueRate(unit),2);assert.equal(marchFatigueRate(unit,{mountain:true}),3);assert.equal(marchFatigueRate({...unit,weight:50}),4);assert.equal(marchFatigueRate({...unit,weight:50},{mode:'carts'}),1);assert.equal(marchFatigueRate({...unit,canMount:true}),1);
 let s=open();s.location='mendoza';s.squads[0].location='mendoza';const route=cellTravelPlan(s,'uspallata'),fatigue=route.path.slice(1).reduce((sum,to,i)=>sum+travelLegHours(route.path[i],to)*([route.path[i],to].some(id=>worldCell(id).biome==='mountain')?3:2),0);assert.ok(fatigue>route.hours*2);s=order(s,{type:'travel',sector:'uspallata'});assert.equal(s.hour,route.hours);assert.equal(r(s).fatigue,fatigue);assert.equal(r(s).energy,100-fatigue);
});
test('a long route stops at a real sector when the squad needs rest',()=>{
 let s=open();const route=cellTravelPlan(s,'humahuaca');let hours=0,arrival;for(let i=1;i<route.path.length;i++){hours+=travelLegHours(route.path[i-1],route.path[i]);arrival=route.path[i];if(hours*2>=80)break;}
 s=order(s,{type:'travel',sector:'humahuaca'});assert.equal(s.location,arrival);assert.notEqual(s.location,'humahuaca');assert.equal(s.hour,hours);assert.equal(r(s).fatigue,hours*2);assert.equal(r(s).energy,100-hours*2);assert.equal(s.squads[0].location,s.location);assert.equal(s.squads[0].journey.reason,'exhausted');
 const before=serializeCampaign(s);assert.match(dispatchCampaign(s,{type:'travel',sector:'humahuaca'}).lastError,/descansar/);assert.equal(serializeCampaign(s),before);
 assert.ok(r(s).asleep);assert.ok(r(s).sleepCollapsed);s=order(s,{type:'wait',hours:24});assert.equal(s.hour,hours+Math.ceil(hours*2/8));assert.ok(!r(s).asleep);assert.equal(r(s).sleepCollapsed,false);s=order(s,{type:'resumeTravel'});s=completeTestTravel(s,{sector:'humahuaca'});assert.equal(s.location,'humahuaca');assert.equal(s.squads[0].journey,undefined);
});
test('travel charges only traveling staff and leaves another squad to recover',()=>{
 let s=initialCampaign();Object.assign(r(s,10),{energy:40,fatigue:40});s=order(s,{type:'createSquad',name:'Marcha',ids:[3]});const hours=cellTravelPlan(s,'buenos_aires').hours;s=order(s,{type:'travel',sector:'buenos_aires'});assert.equal(r(s).fatigue,hours*2);assert.equal(r(s,10).fatigue,40-hours);assert.equal(s.squads[0].location,'retiro');
});
test('contract departure stops charging a soldier who no longer travels',()=>{
 let s=initialCampaign();s=order(s,{type:'createSquad',name:'Contrato breve',ids:[3]});s.contracts[3]={kind:'paid',term:'day',started:0,expiresAt:2,paid:100};s=order(s,{type:'travel',sector:'ensenada'});assert.equal(s.hour,3);assert.equal(r(s).fatigue,6);assert.ok(!s.recruited.includes(3));assert.equal(s.location,'cell-27-30');s=order(s,{type:'wait',hours:2});assert.equal(r(s).fatigue,6,'the departed soldier receives no further march charges');
});
test('an attack march carries its accumulated fatigue into the real deployment',()=>{
 let s=order(initialCampaign(),{type:'travel',sector:'buenos_aires'});const hours=s.hour+travelLegHours(s.location,'san_nicolas');s=order(s,{type:'attack',sector:'san_nicolas'});assert.equal(s.hour,hours);assert.equal(r(s).fatigue,hours*2);assert.equal(s.pendingBattle.squad.find(u=>u.id===3).energy,100-hours*2);const before=structuredClone(r(s));s=order(s,{type:'syncTacticalTime',battleId:s.pendingBattle.id,elapsedSeconds:7200});assert.deepEqual(r(s),before);
});
test('the original campaign march commander activates the documented service benefit',()=>{
 const s=initialCampaign();s.recruited.push(57);const hours=cellTravelPlan(s,'buenos_aires').hours,next=order(s,{type:'travel',sector:'buenos_aires'});assert.equal(r(next).fatigue,0);assert.equal(next.hour,hours);
});
test('exhaustion cannot prevent combat after the squad has already reached hostile territory',()=>{
 let s=initialCampaign();s.location='san_nicolas';s.squads[0].location='san_nicolas';for(const id of s.squad)Object.assign(r(s,id),{fatigue:96,energy:10});s=order(s,{type:'attack',sector:'san_nicolas'});assert.equal(s.hour,0);assert.ok(s.pendingBattle);assert.equal(s.pendingBattle.squad[0].energy,10);
});
