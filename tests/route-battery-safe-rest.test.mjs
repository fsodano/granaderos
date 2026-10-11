import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {dispatchCampaign} from '../game/campaign.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {worldOwner} from '../game/world-cells.js';
import {sleepOrderReason} from '../game/sleep.js';
import {prepareRouteBattery} from './route-battery.mjs';
import {saltaBatteryWaypoints} from './salta-route.mjs';

const provenance=JSON.parse(readFileSync(new URL('./fixtures/opening-salta-native.provenance.json',import.meta.url),'utf8'));
const name='opening-salta-native-detour.save.json.gz',metadata=provenance.fixtures[name];
const compressed=readFileSync(new URL('./fixtures/'+name,import.meta.url)),raw=gunzipSync(compressed),sha=value=>createHash('sha256').update(value).digest('hex');
assert.equal(sha(compressed),metadata.gzipSha256);assert.equal(sha(raw),metadata.rawSha256);
const fresh=()=>decodeSave(raw.toString()).campaign,save=s=>decodeSave(encodeSave(s)).campaign,clock=s=>s.hour*3600+(s.secondOfHour??0);
const order=(s,action)=>{const next=dispatchCampaign(s,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);return next;};

// The retained native input has 64 fatigue, 36 energy and a paid single crew
// member. These controls add ordinary orders only, without editing its state.
test('the earned unrested detour exhausts before arrival and cannot sleep while the actual journey is moving',()=>{
 const start=fresh(),input=structuredClone(start),waypoints=saltaBatteryWaypoints(start,'ensenada');
 let campaign=order(start,{type:'travel',sector:'ensenada',queue:true,mode:'march',waypoints});
 const moving=structuredClone(campaign),rejected=dispatchCampaign(campaign,{type:'setSleep',operativeId:100,asleep:true});
 assert.equal(rejected.lastError,'El combatiente está en camino. Esperá su llegada.');assert.deepEqual({...rejected,lastError:null},{...campaign,lastError:null});assert.deepEqual(campaign,moving);
 for(let hour=0;hour<24;hour++){campaign=order(campaign,{type:'wait',hours:1});if(hour===11)campaign=save(campaign);}
 const journey=campaign.squads.find(q=>q.id===campaign.activeSquadId).journey;
 assert.equal(campaign.location,'cell-26-27');assert.equal(journey.status,'paused');assert.equal(journey.reason,'exhausted');assert.notEqual(campaign.location,'ensenada');assert.deepEqual(start,input);
});

test('the same earned crew sleeps at its admitted departure point and finishes the real detour with exact paid-state save replay',()=>{
 const start=fresh(),input=structuredClone(start),events=[];
 assert.equal(sleepOrderReason(start,100,true),'');assert.equal(start.location,'cell-24-28');assert.equal(worldOwner(start,start.location),'neutral');
 // An empty battery selection isolates its existing crew-travel stage. No gun
 // delivery, Salta victory or treatment of the remote patients is claimed.
 const result=prepareRouteBattery(start,[],{destination:'ensenada',waypointsFor:saltaBatteryWaypoints,report:event=>events.push(event)}),campaign=result.campaign;
 assert.deepEqual(start,input);assert.deepEqual(result.selections,[]);assert.equal(campaign.location,'ensenada');assert.equal(campaign.squads.find(q=>q.id===campaign.activeSquadId).journey,undefined);
 const rest=events.filter(event=>event.event==='routeBatteryDepartureRest');assert.equal(rest.length,1);assert.deepEqual(rest[0].ids,[100]);assert.equal(rest[0].sector,start.location);assert.equal(rest[0].plannedHours,20);
 const actions=events.filter(event=>event.action).map(event=>event.action),sleep=actions.findIndex(action=>action.type==='setSleep'&&action.asleep),depart=actions.findIndex(action=>action.type==='travel');
 assert.equal(sleep,0);assert.ok(depart>sleep);assert.equal(actions.slice(sleep+1,depart).filter(action=>action.type==='wait').length,8);assert.equal(clock(campaign)-clock(start),28*3600);
 assert.deepEqual(campaign.squad,start.squad);assert.deepEqual(campaign.contracts[100],start.contracts[100]);assert.equal(campaign.contracts[100].kind,'paid');assert.ok(campaign.contracts[100].paid>0);assert.equal(campaign.resources.treasury,start.resources.treasury);
 for(const field of ['hp','maxHp','bleeding','weapon','condition','ammo','carriedLoaded','inventory','medkits','rations','outfit','headwear','legwear'])assert.deepEqual(campaign.operativeState[100][field],start.operativeState[100][field],`the actual crew keeps finite ${field}`);
 assert.equal(campaign.operativeState[100].fatigue,40);assert.equal(campaign.operativeState[100].energy,60);
 for(const [id,record]of Object.entries(start.operativeState)){
  if(!record.alive){assert.equal(campaign.operativeState[id].alive,false);assert.equal(campaign.operativeState[id].deathMinute,record.deathMinute);}
  else if(!campaign.operativeState[id].alive)assert.ok(record.bleeding>0,'only the unresolved earned bleeding can create another death during these waits');
 }
 let replay=fresh();for(const [index,action]of actions.entries()){replay=order(replay,action);if(index===Math.floor(actions.length/2))replay=save(replay);}
 assert.deepEqual(save(replay),campaign);assert.deepEqual(save(campaign),campaign);assert.equal(campaign.pendingBattle,null);assert.equal(campaign.pendingEncounter,null);
});
