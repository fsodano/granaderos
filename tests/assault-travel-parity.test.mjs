import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign} from '../game/campaign.js';
import {travelLegHours} from '../game/squad-travel.js';
const order=(s,a)=>{const next=dispatchCampaign(s,a);assert.equal(next.lastError,null,JSON.stringify(a)+': '+next.lastError);return next;};
for(const [origin,target] of [['buenos_aires','san_nicolas'],['jujuy','humahuaca']])for(const mode of ['march','posta','carts',...(origin==='buenos_aires'?['flotilla']:[])])test(`immediate and queued assaults charge the same ${mode} from ${origin}`,()=>{
 const start=initialCampaign(45);
 for(const id of ['buenos_aires','cordoba','tucuman','salta','jujuy'])start.sectors[id].owner='patriot';
 start.location=origin;start.squads[0].location=origin;
 for(const id of start.squad)start.operativeState[id].location=origin;
 start.routes[mode]=true;start.blockade=false;
 const before=structuredClone(start),hours=travelLegHours(origin,target,mode);
 const immediate=order(start,{type:'attack',sector:target,mode});
 let queued=order(start,{type:'attack',sector:target,mode,queue:true});
 for(let h=0;h<hours;h++)queued=order(queued,{type:'wait',hours:1});
 assert.equal(queued.squads[0].journey.status,'ready');
 queued=order(queued,{type:'beginAssault',sector:target});
 assert.deepEqual(start,before,'neither dispatch mutates the starting campaign');
 assert.equal(immediate.hour-start.hour,hours);
 assert.equal(queued.hour,immediate.hour);
 assert.equal(immediate.resources.horses,queued.resources.horses,'posta must consume the same remount stock');
 for(const id of start.squad){
  const direct=immediate.operativeState[id],scheduled=queued.operativeState[id];
  for(const key of ['energy','fatigue','hp','alive'])assert.equal(direct[key],scheduled[key],`${id}: ${key}`);
 }
 assert.deepEqual(immediate.pendingBattle.squad.map(u=>[u.id,u.energy,u.fatigue]),queued.pendingBattle.squad.map(u=>[u.id,u.energy,u.fatigue]));
});

for(const [name,mode,change,reason] of [
 ['unknown transport','teleport',()=>{},/desconocido/],
 ['unavailable carts','carts',s=>{s.routes.carts=false;},/transporte/],
 ['missing remounts','posta',s=>{s.routes.posta=true;s.resources.horses=0;},/remudas/],
 ['blockaded flotilla','flotilla',s=>{s.routes.flotilla=true;s.blockade=true;},/transporte/],
 ['sleeping soldier','march',s=>{s.operativeState[3].asleep=true;},/durmiendo/],
])test(`both assault paths reject ${name} without spending resources`,()=>{
 const start=initialCampaign(45);start.location='buenos_aires';start.squads[0].location=start.location;
 for(const id of start.squad)start.operativeState[id].location=start.location;
 change(start);const before=structuredClone(start);
 for(const queue of [false,true]){
  const rejected=dispatchCampaign(start,{type:'attack',sector:'san_nicolas',mode,queue});
  assert.match(rejected.lastError,reason);
  assert.deepEqual(rejected.resources,start.resources);assert.deepEqual(rejected.squads,start.squads);
  assert.equal(rejected.hour,start.hour);assert.equal(rejected.pendingBattle,null);
 }
 assert.deepEqual(start,before);
});
