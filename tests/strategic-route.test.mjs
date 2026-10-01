import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {initialCampaign as freshCampaign,dispatchCampaign} from '../game/campaign.js';
import {previewStrategicRoute} from '../game/strategic-route.js';
import {encodeSave,decodeSave} from '../game/save.js';
const order=(s,a)=>{const next=dispatchCampaign(s,a);assert.equal(next.lastError,null);return next;};
test('map preview is read-only, queues the real multi-sector route and waits for the clock',()=>{
 let s=initialCampaign();const original=structuredClone(s);
 const preview=previewStrategicRoute(s,s.activeSquadId,'ensenada');
 assert.equal(preview.valid,true);assert.equal(preview.hours,24);assert.deepEqual(preview.path,['retiro','buenos_aires','ensenada']);assert.deepEqual(s,original);
 // Sector snapshots can be large; preview must never traverse or copy them.
 Object.defineProperty(s,'sectorStates',{get(){throw Error('Preview touched tactical snapshots');},configurable:true});
 assert.equal(previewStrategicRoute(s,s.activeSquadId,'ensenada').valid,true);
 s=order(original,preview.action);assert.equal(s.hour,0);assert.equal(s.location,'retiro');assert.deepEqual(s.squads[0].journey.path,preview.path);
 s=decodeSave(encodeSave(s,null)).campaign;s=order(s,{type:'wait',hours:1});assert.equal(s.hour,1);assert.equal(s.location,'retiro');assert.equal(s.squads[0].journey.elapsed,1);
});
test('a selected second squad gets the plotted route without changing the first squad',()=>{
 let s=order(initialCampaign(),{type:'createSquad',name:'Reserva',ids:[10]});
 const reserve=s.squads.find(q=>q.name==='Reserva');s=order(s,{type:'selectSquad',id:reserve.id});
 const first=structuredClone(s.squads[0]),preview=previewStrategicRoute(s,reserve.id,'buenos_aires');assert.equal(preview.valid,true);
 s=order(s,preview.action);assert.deepEqual(s.squads[0],first);assert.deepEqual(s.squads.find(q=>q.id===reserve.id).journey.path,['retiro','buenos_aires']);
});
test('blocked route previews explain why, remain read-only and never replace an existing march',()=>{
 const base=initialCampaign();
 for(const [change,destination,pattern] of [
  [s=>{s.pendingBattle={id:'active'};},'buenos_aires',/táctico/],
  [s=>{s.pendingEncounter={};},'buenos_aires',/encuentro/],
  [s=>{s.operativeState[3].asleep=true;},'buenos_aires',/durmiendo/],
  [s=>{s.operativeState[3].assignment='doctor';},'buenos_aires',/asignación/],
  [()=>{},'retiro',/ya está/],
  [()=>{},'salta',/frente|vecino/],
 ]){const s=structuredClone(base);change(s);const before=structuredClone(s),p=previewStrategicRoute(s,s.activeSquadId,destination);assert.equal(p.valid,false);assert.match(p.reason,pattern);assert.deepEqual(s,before);}
 const s=order(base,{type:'travel',sector:'buenos_aires',queue:true}),before=structuredClone(s);
 assert.match(previewStrategicRoute(s,s.activeSquadId,'ensenada').reason,/ruta anterior/);assert.deepEqual(s,before);
 assert.equal(previewStrategicRoute(freshCampaign(),'squad-1','buenos_aires').valid,false);
});
test('an adjacent enemy destination previews an assault and arrives at the boundary before combat',()=>{
 let s=initialCampaign();s.sectors.buenos_aires.owner='royalist';const p=previewStrategicRoute(s,s.activeSquadId,'buenos_aires');assert.equal(p.valid,true);assert.equal(p.action.type,'attack');assert.equal(p.hours,12);
 s=order(s,p.action);assert.equal(s.pendingBattle,null);assert.equal(s.location,'retiro');s=order(s,{type:'wait',hours:12});assert.equal(s.squads[0].journey.status,'ready');assert.equal(s.location,'retiro');assert.equal(s.pendingBattle,null);
});
test('transport preview uses the selected transport duration and rejects unavailable transport',()=>{
 const s=initialCampaign();assert.equal(previewStrategicRoute(s,s.activeSquadId,'buenos_aires','posta').valid,false);
 s.routes.posta=true;assert.equal(previewStrategicRoute(s,s.activeSquadId,'ensenada','posta').hours,8);
});
