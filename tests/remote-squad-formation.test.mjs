import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign,operativeLocation} from '../game/campaign.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {strategicClockInterrupt} from '../game/strategic-clock.js';
import {cellTravelPlan} from '../game/world-cells.js';
const order=(s,a)=>{const n=dispatchCampaign(s,a);assert.equal(n.lastError,null,JSON.stringify(a)+': '+n.lastError);return n;};
export function remoteReserve(){let s=order(initialCampaign(),{type:'squad',ids:[3,4]});return order(s,{type:'travel',sector:'buenos_aires'});}
const form={type:'createSquad',name:'Reserva médica',ids:[10],sector:'retiro'};
const physical=s=>({...s,lastError:null});

test('an unassigned reserve forms a squad at its actual remote town and pays normal travel time',()=>{
 const s=remoteReserve(),before=structuredClone(s),n=order(s,form);
 assert.deepEqual(s,before);assert.equal(n.location,'retiro');assert.deepEqual(n.squad,[10]);
 assert.deepEqual(n.squads[0],s.squads[0]);assert.equal(operativeLocation(n,3),'buenos_aires');assert.equal(operativeLocation(n,10),'retiro');
 assert.deepEqual(n.resources,s.resources);assert.deepEqual(n.operativeState,s.operativeState);assert.equal(n.hour,s.hour);assert.equal(n.seed,s.seed);
 assert.deepEqual(decodeSave(encodeSave(n)).campaign,n);
 const arrived=order(n,{type:'travel',sector:'buenos_aires'});assert.equal(arrived.hour,n.hour+cellTravelPlan(n,'buenos_aires').hours);assert.equal(operativeLocation(arrived,10),'buenos_aires');
 assert.deepEqual(arrived.squads[0],n.squads[0]);
});
test('forming a reserve while another squad marches preserves that squad and its complete saved journey',()=>{
 const s=order(remoteReserve(),{type:'travel',sector:'ensenada',queue:true}),before=structuredClone(s),n=order(s,form);
 assert.deepEqual(s,before);assert.deepEqual(n.squads[0],s.squads[0]);assert.deepEqual(n.operativeState,s.operativeState);
 const restored=decodeSave(encodeSave(n)).campaign;assert.deepEqual(restored,n);
 const advanced=order(restored,{type:'wait',hours:12});assert.equal(advanced.squads[0].location,'ensenada');assert.equal(advanced.squads[1].location,'retiro');
});
test('formation rejects mixed locations, unknown sectors, duplicates and travelers atomically',()=>{
 const s=order(remoteReserve(),{type:'travel',sector:'ensenada',queue:true}),before=structuredClone(s);
 for(const a of [{...form,sector:'missing'},{...form,ids:[10,3]},{...form,ids:[3],sector:'buenos_aires'},{...form,ids:[10,10]},{...form,ids:[9999]},{...form,ids:[]},{...form,sector:'cordoba'}]){
  const rejected=dispatchCampaign(s,a);assert.ok(rejected.lastError);assert.deepEqual(physical(rejected),physical(s));assert.deepEqual(s,before);
 }
 // A squad edit cannot use a formation location to move remote members.
 const stationary=remoteReserve(),rejected=dispatchCampaign(stationary,{type:'squad',ids:[10],sector:'retiro'});
 assert.ok(rejected.lastError);assert.deepEqual(physical(rejected),physical(stationary));
});
test('a departing squad stays intact until its requested stop takes effect',()=>{
 let s=order(remoteReserve(),{type:'travel',sector:'ensenada',queue:true});const stop=s.squads[0].journey.path[1];s=order(s,{type:'advanceStrategicTime',seconds:1800});s=order(s,{type:'cancelTravel',choice:'stop'});
 // Stop-after-stage still holds the marching party until it reaches that stage.
 assert.ok(dispatchCampaign(s,{...form,ids:[3],sector:'buenos_aires'}).lastError);
 s=order(s,{type:'advanceStrategicTime',seconds:1800});assert.equal(s.location,stop);const n=order(s,{...form,ids:[3],sector:stop});
 assert.equal(n.location,stop);assert.deepEqual(n.squad,[3]);assert.deepEqual(n.squads[0].members,[4]);
});

test('capacity replacement retires only its arrival notice and preserves the other squad route',()=>{
 const start=initialCampaign(),history=[];let s=start;
 const issue=a=>{history.push(a);s=order(s,a);assert.deepEqual(decodeSave(encodeSave(s)).campaign,s);};
 issue({type:'createSquad',name:'Primera llegada',ids:[3]});
 issue({type:'travel',sector:'buenos_aires',queue:true});
 issue({type:'selectSquad',id:'squad-1'});issue({type:'travel',sector:'buenos_aires',queue:true});
 const beforeArrival=structuredClone(s);issue({type:'wait',hours:24});
 assert.equal(s.hour,cellTravelPlan(start,'buenos_aires').hours);assert.equal(s.travelNotice.events.length,2);assert.match(strategicClockInterrupt(beforeArrival,s),/llega a/);
 const arrival=structuredClone(s.travelNotice);
 issue({type:'selectSquad',id:'squad-2'});issue({type:'squad',ids:[3,4,10]});
 for(let i=0;i<6;i++)issue({...form,name:`Reserva ${i}`,sector:'buenos_aires'});
 issue({type:'selectSquad',id:'squad-2'});issue({type:'travel',sector:'ensenada',queue:true});
 assert.equal(s.squads.length,8);assert.deepEqual(s.travelNotice,arrival);const before=structuredClone(s);
 issue({...form,sector:'buenos_aires'});const n=s;
 assert.equal(n.squads.length,8);assert.equal(n.activeSquadId,'squad-9');
 assert.ok(!n.squads.some(q=>q.id==='squad-1'));
 assert.deepEqual(n.squads.find(q=>q.id==='squad-2'),before.squads.find(q=>q.id==='squad-2'));
 assert.deepEqual(n.travelNotice,{...arrival,events:arrival.events.filter(e=>e.squadId==='squad-2')});
 assert.deepEqual(n.operativeState,before.operativeState);assert.deepEqual(n.resources,before.resources);assert.deepEqual(n.log,before.log);
 assert.equal(n.hour,before.hour);assert.equal(n.secondOfHour,before.secondOfHour);assert.equal(n.seed,before.seed);
 assert.equal(n.location,'buenos_aires');assert.deepEqual(n.squad,[10]);
 let replay=start;for(const a of history)replay=order(decodeSave(encodeSave(replay)).campaign,a);assert.deepEqual(replay,n);
 assert.deepEqual(start,initialCampaign());
});

test('retiring the only noticed arrival leaves no empty notice and preserves its log',()=>{
 let s=order(initialCampaign(),{type:'travel',sector:'buenos_aires'});
 assert.equal(s.travelNotice.events.length,1);const notice=structuredClone(s.travelNotice);
 for(let i=0;i<7;i++)s=order(s,{...form,name:`Reserva ${i}`,ids:[3,4,10],sector:'buenos_aires'});
 assert.equal(s.squads.length,8);assert.deepEqual(s.travelNotice,notice);const before=structuredClone(s);
 const n=order(s,{...form,ids:[3,4,10],sector:'buenos_aires'});
 assert.ok(!n.squads.some(q=>q.id===notice.events[0].squadId));assert.equal(n.travelNotice,null);
 assert.deepEqual(n.log,before.log);assert.ok(n.log.some(entry=>entry.text.includes(notice.events[0].text)));
 assert.deepEqual(n.operativeState,before.operativeState);assert.deepEqual(n.resources,before.resources);
 assert.equal(n.hour,before.hour);assert.equal(n.seed,before.seed);assert.deepEqual(decodeSave(encodeSave(n)).campaign,n);
});

test('save admission still rejects an unknown squad in a real arrival notice',()=>{
 const s=order(initialCampaign(),{type:'travel',sector:'buenos_aires'}),bad=structuredClone(s);
 bad.travelNotice.events[0].squadId='squad-999';
 assert.throws(()=>decodeSave(encodeSave(bad)),/aviso de marcha/);
 assert.deepEqual(decodeSave(encodeSave(s)).campaign,s);
});

test('eight occupied squads still reject another formation without losing personnel',()=>{
 let s=initialCampaign();for(const id of [100,101,102,103,104])s=order(s,{type:'recruitCivic',id,term:'week'});
 s=order(s,{type:'squad',ids:[3]});
 for(const id of [4,10,100,101,102,103,104])s=order(s,{type:'createSquad',name:`Unidad ${id}`,ids:[id]});
 assert.equal(s.squads.length,8);assert.ok(s.squads.every(q=>q.members.length));
 const rejected=dispatchCampaign(s,{type:'createSquad',name:'Novena unidad',ids:[3]});
 assert.match(rejected.lastError,/ocho escuadras/);assert.deepEqual(physical(rejected),physical(s));
});
