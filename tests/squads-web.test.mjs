import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign as dispatch,restoreCampaign,serializeCampaign,operativeLocation} from '../game/campaign.js';
import {buildSectorMap} from '../game/maps.js';
import {createBattle} from '../game/tactical.js';
const order=(s,a)=>{const n=dispatch(s,a);assert.equal(n.lastError,null,n.lastError);return n;};
test('two persistent squads travel independently and cannot teleport members',()=>{
 let s=order(initialCampaign(),{type:'createSquad',name:'Segunda escuadra',ids:[10]});assert.deepEqual(s.squads[0].members,[3,4]);assert.equal(s.squads.length,2);s=order(s,{type:'travel',sector:'buenos_aires'});assert.equal(s.squads[1].location,'buenos_aires');assert.equal(s.squads[0].location,'retiro');assert.equal(operativeLocation(s,3),'retiro');assert.ok(dispatch(s,{type:'squad',ids:[3,10]}).lastError);
 s=order(s,{type:'selectSquad',id:'squad-1'});assert.equal(s.location,'retiro');assert.deepEqual(s.squad,[3,4]);assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);
});
test('remote attacks reject; genuine march and frontier entry advance time and location',()=>{
 let s=initialCampaign();assert.ok(dispatch(s,{type:'attack',sector:'san_nicolas'}).lastError);s=order(s,{type:'travel',sector:'buenos_aires'});const before=s.hour;s=order(s,{type:'attack',sector:'san_nicolas'});assert.equal(s.hour,before+12);assert.equal(s.location,'san_nicolas');assert.equal(s.squads[0].location,'san_nicolas');
 s=order(s,{type:'battleResult',battleId:s.pendingBattle.id,outcome:'retreat',survivors:s.pendingBattle.squad.map(o=>({id:o.id,hp:o.hp}))});assert.equal(s.location,'buenos_aires');
});
test('friendly tactical visits preserve sector and inventory without capture rewards',()=>{
 let s=order(initialCampaign(),{type:'visitSector',sector:'retiro'});assert.equal(s.pendingBattle.exploration,true);assert.deepEqual(s.pendingBattle.enemies,[]);const request=s.pendingBattle,map=buildSectorMap(request),battle=createBattle(map.squad,map),cash=s.resources.treasury;
 battle.units[0].inventory={'weapon:1801:enemy-1':{count:1,weight:4,weapon:1801,loaded:1,condition:90}};
 s=order(s,{type:'leaveSector',battleId:request.id,sectorState:battle,survivors:battle.units.filter(o=>o.side==='player').map(o=>({id:o.id,hp:o.hp,energy:60,inventory:o.inventory??{}}))});assert.equal(s.resources.treasury,cash);assert.equal(s.pendingBattle,null);assert.equal(s.operativeState[3].energy,60);assert.ok(s.sectorStates.retiro);assert.deepEqual(restoreCampaign(serializeCampaign(s)),s);
 s=order(s,{type:'visitSector'});assert.equal(s.pendingBattle.squad.find(o=>o.id===3).inventory['weapon:1801:enemy-1'].weapon,1801);
});
test('legacy single squad saves migrate and duplicates are rejected',()=>{
 const old=initialCampaign();delete old.squads;delete old.activeSquadId;delete old.sectorStates;const s=restoreCampaign(JSON.stringify(old));assert.equal(s.squads.length,1);assert.deepEqual(s.squads[0].members,[3,4,10]);s.squads.push({id:'squad-2',name:'Otra escuadra',members:[3],location:'retiro'});assert.throws(()=>restoreCampaign(serializeCampaign(s)));
});

test('sector persistence rejects malformed tiles and object arrays before rendering',()=>{
 const s=order(initialCampaign(),{type:'visitSector'}),map=buildSectorMap(s.pendingBattle),battle=createBattle(map.squad,map);
 for(const mutate of [b=>b.tiles[0]=null,b=>b.tiles[0].x=999,b=>b.tiles[1]={...b.tiles[0]},b=>b.smoke=null,b=>b.units[0].x=-1]){const malformed=structuredClone(battle);mutate(malformed);const result=dispatch(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:malformed,survivors:[]});assert.ok(result.lastError);assert.equal(result.pendingBattle.id,s.pendingBattle.id);}
});
