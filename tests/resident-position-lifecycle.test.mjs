import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {WORLD_CELLS,adjacentCells} from '../game/world-cells.js';
import {surfaceAt} from '../game/tactical-space.js';
import {fundedRouteContent} from './funded-route-fixture.mjs';
import {stageRouteRoofDefenders} from './route-roof-defenders.mjs';
import {visit,leave} from './local-contract-fixture.mjs';

const save=s=>restoreCampaign(serializeCampaign(s));
const order=(s,a)=>{const before=serializeCampaign(s),n=dispatchCampaign(s,a);assert.equal(n.lastError,null,n.lastError);assert.equal(serializeCampaign(s),before);assert.ok(save(n));return n;};
function staged(){
 const content=fundedRouteContent();content.headquarters='cordoba';content.startingTerritory.cordoba={owner:'patriot',loyalty:65};let s=initialCampaign(42,content);
 for(const id of [110,114,115,123])s=order(s,{type:'recruitCivic',id,term:'week'});
 for(let i=0;s.hiringArrivals.length&&i<24;i++)s=order(s,{type:'wait',hours:1});assert.equal(s.hiringArrivals.length,0);
 for(const ids of [[110,114],[115,123]])s=order(s,{type:'createSquad',name:'Guardia',ids,sector:'cordoba'});
 return stageRouteRoofDefenders(s,[110,114,115,123]);
}

test('strict saved resident points require their real source terrain and cannot alter a deployment request',()=>{
 const s=staged(),id=110,point=s.operativeState[id].residentPosition;assert.equal(point.tacticalLevel,1);assert.ok(surfaceAt(s.sectorStates.cordoba,point));assert.ok(!s.sectorStates.cordoba.units.some(u=>u.id===String(id)),'another actual squad owns the latest scene snapshot');
 for(const change of [r=>r.residentPosition.x=-1,r=>r.residentPosition.y=Infinity,r=>r.residentPosition.tacticalLevel=9,r=>r.residentPosition.x=.5,r=>r.residentPosition.extra=true,r=>r.residentPosition={x:0,y:0,tacticalLevel:1},r=>r.residentSector='retiro']){const bad=structuredClone(s);change(bad.operativeState[id]);const before=structuredClone(bad);assert.throws(()=>save(bad),/residente/);assert.deepEqual(bad,before);}
 const squad=s.squads.find(q=>q.members.includes(id));let n=order(s,{type:'selectSquad',id:squad.id});n=order(n,{type:'visitSector'});for(const change of [u=>u.residentPosition.x++,u=>delete u.residentPosition,u=>{delete u.residentPosition;delete u.entryReason;}]){const bad=structuredClone(n);change(bad.pendingBattle.squad.find(u=>u.id===id));assert.throws(()=>save(bad),/residente desplegado/);}
 const old=structuredClone(s);for(const r of Object.values(old.operativeState))delete r.residentPosition;assert.ok(save(old),'older valid saves retain their existing scene fallback');
 const older=structuredClone(s),actual=older.operativeState[115].residentPosition;delete older.operativeState[115].residentPosition;let continued=order(save(older),{type:'selectSquad',id:squad.id});continued=save(leave(visit(continued)));assert.deepEqual(continued.operativeState[115].residentPosition,actual,'an admitted return preserves the last real point in an older shared scene');
});

test('a ground resident request rejects a null physical level instead of failing later at entry',()=>{
 let s=order(initialCampaign(8),{type:'createOfficer',name:'Isabel',answers:{origin:'workshop',doctrine:'line_marksman',crisis:'rescue'}});s=save(leave(visit(s)));assert.equal(s.operativeState[1000].residentPosition.tacticalLevel,undefined);s=order(s,{type:'visitSector'});s.pendingBattle.squad.find(u=>u.id===1000).residentPosition.tacticalLevel=null;assert.throws(()=>save(s),/residente desplegado/);
});

test('a real city departure clears only the departing squad points and the other squad retains its roof placement',()=>{
 let s=staged();const squad=s.squads.find(q=>q.members.includes(110)),others=s.squads.find(q=>q.members.includes(115)),points=structuredClone(s.operativeState[115].residentPosition);s=order(s,{type:'selectSquad',id:squad.id});
 const district=WORLD_CELLS.find(c=>c.locality==='cordoba'&&!c.anchor&&adjacentCells('cordoba',c.location));assert.ok(district);const start=s.hour*3600+(s.secondOfHour??0);s=order(s,{type:'travel',sector:district.location});assert.equal(s.hour*3600+s.secondOfHour-start,3600);for(const id of squad.members){assert.equal(s.operativeState[id].residentPosition,undefined);assert.equal(s.operativeState[id].residentSector,null);}assert.deepEqual(s.operativeState[115].residentPosition,points);
 s=order(save(s),{type:'selectSquad',id:others.id});const p=visit(s);assert.deepEqual(p.battle.units.find(u=>u.id==='115').residentPosition,undefined);assert.deepEqual({x:p.battle.units.find(u=>u.id==='115').x,y:p.battle.units.find(u=>u.id==='115').y,tacticalLevel:p.battle.units.find(u=>u.id==='115').tacticalLevel},points);assert.ok(save(leave(p)));
});
