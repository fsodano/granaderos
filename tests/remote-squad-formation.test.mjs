import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign,operativeLocation} from '../game/campaign.js';
import {encodeSave,decodeSave} from '../game/save.js';
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
 const arrived=order(n,{type:'travel',sector:'buenos_aires'});assert.equal(arrived.hour,n.hour+12);assert.equal(operativeLocation(arrived,10),'buenos_aires');
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
 let s=order(remoteReserve(),{type:'travel',sector:'ensenada',queue:true});s=order(s,{type:'wait',hours:1});s=order(s,{type:'cancelTravel',choice:'stop'});
 // Stop-after-stage still holds the marching party until it reaches that stage.
 assert.ok(dispatchCampaign(s,{...form,ids:[3],sector:'buenos_aires'}).lastError);
 s=order(s,{type:'wait',hours:12});const n=order(s,{...form,ids:[3],sector:'ensenada'});
 assert.equal(n.location,'ensenada');assert.deepEqual(n.squad,[3]);assert.deepEqual(n.squads[0].members,[4]);
});
