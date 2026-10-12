import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {dispatchCampaign,rosterFor} from '../game/campaign.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {contractExpiresSeconds,contractQuote} from '../game/contracts.js';
import {worldCell,worldOwner} from '../game/world-cells.js';
import {sleepOrderReason} from '../game/sleep.js';
import {prepareRouteBattery} from './route-battery.mjs';
import {saltaBatteryWaypoints} from './salta-route.mjs';

const metadata=JSON.parse(readFileSync(new URL('./fixtures/opening-battery-native-inflight.provenance.json',import.meta.url))),compressed=readFileSync(new URL('./fixtures/'+metadata.fixture,import.meta.url)),raw=gunzipSync(compressed),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.equal(sha(compressed),metadata.gzipSha256);assert.equal(sha(raw),metadata.rawSha256);
const fresh=()=>decodeSave(raw.toString()).campaign,save=campaign=>decodeSave(encodeSave(campaign)).campaign,clock=c=>c.hour*3600+(c.secondOfHour??0);
const order=(c,action)=>{const next=dispatchCampaign(c,action);assert.equal(next.lastError,null,JSON.stringify(action)+': '+next.lastError);return next;};
const crewJourney=c=>c.squads.find(q=>q.id===c.activeSquadId)?.journey;
function renew(c,ids){
 for(const id of ids){
  const r=c.operativeState[id];if(!r.alive)continue;
  const contract=c.contracts[id],expiry=contractExpiresSeconds(contract);if(expiry===null||expiry>clock(c)+2*3600)continue;
  const quote=contractQuote(c,rosterFor(c).find(op=>op.id===id),'day'),cash=c.resources.treasury;
  assert.ok(quote.available&&cash>=quote.price);
  c=order(c,{type:'renewContract',id,term:'day',expectedExpiresAt:contract.expiresAt,expectedExpiresSecond:contract.expiresSecond??0});assert.equal(c.resources.treasury,cash-quote.price);
 }
 return c;
}

test('the earned unbroken battery journey exhausts in a district with an actual stationed enemy and cannot sleep there',()=>{
 const start=fresh(),before=structuredClone(start),ids=start.recruited.filter(id=>start.operativeState[id].alive&&!start.operativeState[id].captured);let c=start;
 assert.deepEqual([c.hour,c.secondOfHour],metadata.clock);assert.equal(c.operativeState[100].fatigue,42);
 for(let hour=0;crewJourney(c)?.status==='moving'&&hour<30;hour++){c=renew(c,ids);c=order(c,{type:'wait',hours:1});if(hour===10)c=save(c);}
 assert.equal(c.location,'cell-26-28');assert.equal(crewJourney(c).reason,'exhausted');assert.equal(c.operativeState[100].fatigue,84);assert.deepEqual([c.hour,c.secondOfHour],[309,1587]);
 assert.equal(worldCell(c.location,c).locality,'buenos_aires');assert.ok(c.enemyGroups.some(group=>group.target==='buenos_aires'&&group.status==='stationed'));
 c=order(c,{type:'cancelTravel',choice:'stop'});const stopped=structuredClone(c),refused=dispatchCampaign(c,{type:'setSleep',operativeId:100,asleep:true});
 assert.equal(refused.lastError,'Dormir requiere un sector seguro.');assert.deepEqual({...refused,lastError:null},{...c,lastError:null});assert.deepEqual(c,stopped);assert.deepEqual(start,before);assert.deepEqual(save(c),c);
});

test('the earned in-flight crew stops at a real rural boundary, sleeps and completes the detour with exact paid strict-save replay',()=>{
 const start=fresh(),before=structuredClone(start),events=[],keepServing=start.recruited.filter(id=>start.operativeState[id].alive&&!start.operativeState[id].captured);
 const {campaign:c,selections}=prepareRouteBattery(start,[],{destination:'ensenada',waypointsFor:saltaBatteryWaypoints,keepServing,report:event=>events.push(event)});
 assert.deepEqual(start,before);assert.deepEqual(selections,[]);assert.equal(c.location,'ensenada');assert.equal(crewJourney(c),undefined);assert.equal(c.pendingBattle,null);assert.equal(c.pendingEncounter,null);
 const stage=events.find(event=>event.event==='routeBatteryRestStage'),rest=events.find(event=>event.event==='routeBatteryDepartureRest');assert.equal(stage.inFlight,true);assert.equal(stage.stage,'cell-22-25');assert.equal(rest.sector,stage.stage);
 assert.equal(worldOwner(start,rest.sector),'neutral');assert.equal(worldCell(rest.sector,start).locality,null);assert.deepEqual(rest.ids,[100]);
 const actions=events.filter(event=>event.action).map(event=>event.action);assert.deepEqual(actions[0],{type:'cancelTravel',choice:'stop'});
 const sleep=actions.findIndex(action=>action.type==='setSleep'&&action.asleep),depart=actions.findIndex(action=>action.type==='travel');assert.ok(sleep>0&&depart>sleep);assert.equal(actions.slice(sleep+1,depart).filter(action=>action.type==='wait').length,6);
 assert.equal(clock(c)-clock(start),33*3600);assert.equal(c.operativeState[100].fatigue,50);assert.equal(c.operativeState[100].energy,50);assert.equal(c.operativeState[100].asleep,false);assert.equal(sleepOrderReason(c,100,true),'');
 assert.deepEqual(c.squad,start.squad);assert.deepEqual(c.contracts[100],start.contracts[100]);
 for(const field of ['hp','maxHp','bleeding','weapon','condition','ammo','carriedLoaded','inventory','medkits','rations','outfit','headwear','legwear'])assert.deepEqual(c.operativeState[100][field],start.operativeState[100][field]);
 // The already marching rear raid occupies Córdoba and loots its actual
 // treasury during these waits. Crew staging does not settle it as a victory.
 assert.equal(c.sectors.cordoba.owner,'royalist');assert.equal(c.enemyGroups.find(group=>group.id==='enemy-group-4').status,'stationed');assert.ok(c.log.some(row=>row.hour===294&&row.text==='Las partidas saquean 150 pesos de la tesorería.'));
 const renewals=events.filter(event=>event.event==='routeBatteryRenewal');assert.equal(c.resources.treasury,start.resources.treasury-renewals.reduce((sum,event)=>sum+event.price,0)-150);
 for(const [id,r]of Object.entries(start.operativeState))if(!r.alive){assert.equal(c.operativeState[id].alive,false);assert.equal(c.operativeState[id].deathMinute,r.deathMinute);}
 // This crew-only boundary does not treat the unresolved remote raid wounds.
 // Their actual deterioration remains in the continued campaign.
 assert.equal(start.operativeState[130].bleeding,2);assert.equal(c.operativeState[130].alive,true);assert.equal(c.operativeState[130].hp,6);assert.equal(c.operativeState[130].bleeding,2);assert.equal(c.operativeState[144].bleeding,start.operativeState[144].bleeding);assert.ok(c.operativeState[144].hp<start.operativeState[144].hp);
 let replay=fresh();for(const [index,action]of actions.entries()){replay=order(replay,action);if(index===Math.floor(actions.length/2))replay=save(replay);}
 assert.deepEqual(save(replay),c);assert.deepEqual(save(c),c);
});
