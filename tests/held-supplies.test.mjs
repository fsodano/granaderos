import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,supplyUsePreview,weaponFor,hasFirearm} from '../game/tactical.js';
import {heldSupply} from '../game/held-supplies.js';
import {extractItemQuantity,transferItemQuantity} from '../game/tactical-inventory.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {dispatchCampaign} from '../game/campaign.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';

const field=(unit={},sector={})=>createBattle([{id:'p',x:2,y:2,...unit},{id:'ally',x:2,y:3}],{width:20,height:8,tiles:Array.from({length:160},(_,i)=>({x:i%20,y:Math.floor(i/20),type:'grass',blocked:false,cover:0})),enemies:[{id:'e',x:7,y:2,overwatch:false,mounted:true}],...sector});
const order=(state,action)=>{const next=actBattle(state,{unitId:'p',...action});assert.equal(next.lastError,null);return next;};
const rejection=(state,action)=>{const next=actBattle(state,{unitId:'p',...action});assert.ok(next.lastError);for(const key of ['units','groundItems','lights','seed','elapsedSeconds','turn','phase','tiles'])assert.deepEqual(next[key],state[key],key);return next;};

test('held torches use normal targeting with finite supplies and paid equip/use costs',()=>{
 let s=field({torches:2});const original=structuredClone(s);
 s=order(s,{type:'weapon',slot:'supply',supplyKey:'torches'});
 assert.equal(s.units[0].ap,original.units[0].ap-4);assert.equal(weaponFor(s.units[0]).name,'Antorcha');assert.equal(hasFirearm(s.units[0]),false);
 assert.equal(supplyUsePreview(s,s.units[0],{x:5,y:3}).cost,10);
 s=order(s,{type:'useItem',x:5,y:3});assert.equal(s.units[0].torches,1);assert.equal(s.units[0].ap,original.units[0].ap-14);
 assert.equal(s.lights.length,1);assert.deepEqual([s.lights[0].x,s.lights[0].y],[5,3]);assert.equal(s.units[0].loaded,original.units[0].loaded);
 s=order(s,{type:'useItem',targetId:'ally'});assert.equal(s.units[0].torches,0);assert.equal(s.units[0].activeSlot,'unarmed');assert.equal(s.units[0].activeSupply,undefined);
 assert.doesNotThrow(()=>validateBattleSnapshot(s));assert.deepEqual(original.units[0].torches,2);
});

test('held boleadoras use a seen enemy, preserve gun rounds and leave one recoverable object',()=>{
 let s=field({boleadoras:1});s=order(s,{type:'weapon',slot:'supply',supplyKey:'boleadoras'});
 assert.equal(supplyUsePreview(s,s.units[0],s.units[2]).allowed,true);
 s=order(s,{type:'useItem',targetId:'e'});
 assert.equal(s.units[2].mounted,false);assert.equal(s.units[2].entangled,true);assert.equal(s.units[0].loaded,1);
 assert.equal(s.units[0].boleadoras,0);assert.equal(s.units[0].activeSlot,'unarmed');assert.equal(s.groundItems.length,1);assert.equal(s.groundItems[0].count,1);
 assert.doesNotThrow(()=>validateBattleSnapshot(s));
});

test('ration targeting is self-only, pays time or AP and does not heal wounds',()=>{
 let s=field({energy:65,fatigue:15,hp:70,bandaged:30,rations:1});s=order(s,{type:'weapon',slot:'supply',supplyKey:'rations'});
 assert.equal(supplyUsePreview(s,s.units[0],s.units[1]).allowed,false);rejection(s,{type:'useItem',targetId:'ally'});
 const ap=s.units[0].ap;s=order(s,{type:'useItem',targetId:'p'});assert.equal(s.units[0].ap,ap-10);assert.equal(s.units[0].hp,70);assert.equal(s.units[0].energy,85);assert.equal(s.units[0].fatigue,5);assert.equal(s.units[0].activeSupply,undefined);
 let free=field({energy:50,rations:1},{exploration:true,enemies:[]});free=order(free,{type:'weapon',slot:'supply',supplyKey:'rations'});const before=free.elapsedSeconds,freeAP=free.units[0].ap;
 free=order(free,{type:'useItem',targetId:'p'});assert.ok(free.elapsedSeconds>before);assert.equal(free.units[0].ap,freeAP);
 const rested=field({activeSlot:'supply',activeSupply:'rations'});assert.equal(supplyUsePreview(rested,rested.units[0],rested.units[0]).allowed,false);rejection(rested,{type:'useItem',targetId:'p'});
});

test('invalid equip, target, AP and direct blade requests are atomic',()=>{
 let s=field({torches:0});rejection(s,{type:'weapon',slot:'supply',supplyKey:'torches'});rejection(s,{type:'weapon',slot:'supply',supplyKey:'ammo'});
 s=order(s,{type:'weapon',slot:'supply',supplyKey:'boleadoras'});rejection(s,{type:'melee',targetId:'e'});rejection(s,{type:'charge',targetId:'e'});
 s.units[0].ap=11;assert.equal(supplyUsePreview(s,s.units[0],s.units[2]).allowed,false);rejection(s,{type:'useItem',targetId:'e'});
 let torch=field({activeSlot:'supply',activeSupply:'torches'});torch.tiles.find(t=>t.x===5&&t.y===3).blocked=true;
 rejection(torch,{type:'useItem',x:5,y:3});rejection(torch,{type:'useItem',x:19,y:7});
 torch.props=[{id:'chest',type:'chest',x:4,y:3,width:1,height:1}];rejection(torch,{type:'useItem',x:4,y:3});
});

test('legacy and held throws reject unseen enemy identities without consuming supplies',()=>{
 let s=field({activeSlot:'supply',activeSupply:'boleadoras',facing:6});s.units[1].facing=6;
 assert.equal(supplyUsePreview(s,s.units[0],s.units[2]).allowed,false);
 rejection(s,{type:'useItem',targetId:'e'});rejection(s,{type:'boleadoras',targetId:'e'});
 s=order(s,{type:'weapon',slot:'supply',supplyKey:'torches'});rejection(s,{type:'useItem',targetId:'e'});
 // An explicit anonymous ground location remains a legal area-lighting choice.
 s=order(s,{type:'useItem',x:7,y:2});assert.equal(s.lights.length,1);
});

test('dropping or passing the final held supply clears only its own hand state',()=>{
 const s=field({activeSlot:'supply',activeSupply:'torches',torches:2});
 const one=extractItemQuantity(s.units[0],'torches',1);assert.equal(heldSupply(one.unit).count,1);
 const last=transferItemQuantity(one.unit,s.units[1],'torches',1);assert.equal(last.source.activeSlot,'unarmed');assert.equal(last.source.activeSupply,undefined);assert.equal(last.target.torches,3);
 const other=extractItemQuantity(s.units[0],'rations',2);assert.equal(other.unit.activeSupply,'torches');
 let dropped=order(s,{type:'drop',item:'torches',count:2});assert.equal(dropped.units[0].activeSlot,'unarmed');assert.equal(dropped.groundItems[0].count,2);
 dropped=order(dropped,{type:'loot',groundId:dropped.groundItems[0].id,count:2});assert.equal(dropped.units[0].torches,2);assert.equal(dropped.units[0].activeSlot,'unarmed');
});

test('saved held supplies preserve the choice and reject phantom or stale hands',()=>{
 const s=field({activeSlot:'supply',activeSupply:'torches',torches:1});assert.equal(validateBattleSnapshot(JSON.parse(JSON.stringify(s))).units[0].activeSupply,'torches');
 for(const change of [u=>u.torches=0,u=>u.activeSupply='ammo',u=>u.activeSlot='primary',u=>u.activeTool='inventory:key']){const bad=structuredClone(s);change(bad.units[0]);assert.throws(()=>validateBattleSnapshot(bad));}
 const equipped=order(s,{type:'weapon',slot:'primary'});assert.equal(equipped.units[0].activeSupply,undefined);assert.doesNotThrow(()=>validateBattleSnapshot(equipped));
});

test('campaign report, save and reentry preserve the selected finite supply',()=>{
 let c=dispatchCampaign(initialCampaign(),{type:'visitSector'});let battle=enterSector(c.pendingBattle);
 battle=actBattle(battle,{type:'weapon',unitId:'4',slot:'supply',supplyKey:'torches'});assert.equal(battle.lastError,null);
 let pair=syncBattleTime(c,battle);assert.equal(pair.error,null);pair=decodeSave(encodeSave(pair.campaign,pair.battle));
 assert.equal(pair.battle.units.find(u=>u.id==='4').activeSupply,'torches');
 c=dispatchCampaign(pair.campaign,{type:'leaveSector',battleId:pair.campaign.pendingBattle.id,sectorState:pair.battle,survivors:pair.battle.units.filter(u=>u.side==='player')});assert.equal(c.lastError,null);
 c=decodeSave(encodeSave(c)).campaign;assert.equal(c.operativeState[4].activeSupply,'torches');
 c=dispatchCampaign(c,{type:'visitSector'});battle=enterSector(c.pendingBattle,c.sectorStates[c.location]);assert.equal(battle.units.find(u=>u.id==='4').activeSupply,'torches');assert.equal(battle.units.find(u=>u.id==='4').torches,2);
});
