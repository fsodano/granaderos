import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchCampaign} from '../game/campaign.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {buildSectorMap} from '../game/maps.js';
import {createBattle,actBattle,endTurn,getReachable} from '../game/tactical.js';
import {encodeSave,decodeSave} from '../game/save.js';
function deployed(){const campaign=dispatchCampaign(dispatchCampaign(initialCampaign(),{type:'travel',sector:'buenos_aires'}),{type:'attack',sector:'san_nicolas'});const map=buildSectorMap(campaign.pendingBattle);return {campaign,battle:createBattle(map.squad,map)};}

test('campaign and authored battle save round-trip keeps the next enemy turn deterministic',()=>{
 const {campaign,battle}=deployed();const u=battle.units.find(u=>u.side==='player');const p=getReachable(battle,u).find(p=>p.cost===8);
 const moved=actBattle(battle,{type:'move',unitId:u.id,x:p.x,y:p.y});
 const restored=decodeSave(encodeSave(campaign,moved));assert.deepEqual(restored,{campaign,battle:moved});assert.deepEqual(endTurn(restored.battle),endTurn(moved));
 assert.deepEqual(decodeSave(encodeSave(initialCampaign())),{campaign:initialCampaign(),battle:null});
});
test('save rejects malformed data before it can enter the renderer or tactical rules',()=>{
 const sample=deployed();const mutations=[
 x=>x.battle.units[0].weapon={name:'forged'},x=>x.battle.units[0].morale=null,
 x=>x.battle.units[0].loaded=100,x=>x.battle.units[0].ammo=.5,
 x=>x.battle.units[0].stance='flying',x=>x.battle.units[0].activeSlot='unknown',
 x=>x.battle.smoke=[{x:1,y:1,radius:'huge',turns:3}],x=>x.battle.log=[{}],
 x=>x.battle.tiles[0].type='unknown',x=>x.battle.tiles[0].blocked='false',
 x=>x.battle.artillery=[{x:1,y:1,type:'unknown'}],x=>x.battle.decor=[{x:1,y:1,width:100,height:2,type:'convent'}],
 x=>x.battle.units[0].x=-1,x=>x.battle.sectorId='salta',x=>x.battle=null,
 ];
 for(const mutate of mutations){const altered=structuredClone(sample);mutate(altered);assert.throws(()=>decodeSave(encodeSave(altered.campaign,altered.battle)));}
 for(const text of ['no JSON','{}','x'.repeat(5000001)])assert.throws(()=>decodeSave(text));
});
