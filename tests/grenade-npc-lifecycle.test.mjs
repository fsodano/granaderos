import {withCarriedGrenades,assertTradeRejected} from './commerce-gear-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor,isSupplied} from '../game/campaign.js';
import {grenadeOffer,grenadeStock} from '../game/equipment.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {extractItemQuantity} from '../game/tactical-inventory.js';
import {createBattle,actBattle,getGrenadeThrowVisual} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {advanceNpc} from '../game/npc-ai.js';
import {enterSector} from '../game/world.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';

const order=(s,a)=>{const next=dispatchCampaign(s,a);assert.equal(next.lastError,null,next.lastError);return next;};
const save=s=>decodeSave(encodeSave(s)).campaign;
const flat=()=>Array.from({length:120},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0}));
const health=n=>({hp:n.hp,energy:n.energy,unconscious:n.unconscious});
function armedVisit(){
 let s=initialCampaign(8);
 // A Cuyo checkpoint opens the existing supplied corridor. The soldier is
 // hired, travels, carries one declared existing grenade and equips that physical item.
 s.phase=3;for(const id of ['buenos_aires','cordoba','mendoza'])s.sectors[id].owner='patriot';
 s=order(s,{type:'recruitCivic',id:110,term:'week'});s=order(s,{type:'travel',sector:'mendoza'});
 assertTradeRejected(s,grenadeOffer(s,rosterFor(s).find(o=>o.id===110),isSupplied).action);s=withCarriedGrenades(s,110,1);
 const u=sectorInventoryModel(s,'mendoza',rosterFor(s),110).personal,item='inventory:grenade:arsenal';
 s=order(s,{type:'sectorInventory',sector:'mendoza',operativeId:110,direction:'equip',slot:'mainhand',inventoryKey:item,expected:JSON.stringify(extractItemQuantity(u,item,1).stack)});
 return order(s,{type:'visitSector'});
}

test('actual blast wounds, unconsciousness and death survive live save, report and sector reentry without standing the NPC up',()=>{
 for(const condition of ['healthy',60,40]){
  let s=armedVisit();const request=s.pendingBattle,initialHp=condition==='healthy'?request.npcs[0].maxHp:condition;
  // Known pre-existing wounds isolate the three outcomes of the same blast.
  // Only the targeted resident starts wounded; the grenade remains finite carried stock.
  let b=createBattle(request.squad.map(u=>({...u,x:1,y:2})),{...request,seed:45,width:12,height:10,tiles:flat(),enemies:[],props:[],
   npcs:request.npcs.map((n,i)=>({...n,x:i?10:5,y:i?6+i:2,...(i?{}:{hp:initialHp,energy:100,unconscious:false})}))});
  const npcId=b.npcs[0].id,before=structuredClone(b);
  b=actBattle(b,{type:'throwGrenade',unitId:'110',x:5,y:2});assert.equal(b.lastError,null);assert.equal(getGrenadeThrowVisual(before,b)?.detonated,true);
  const wounded=b.npcs.find(n=>n.id===npcId),expected=health(wounded);
  assert.equal(wounded.hp,Math.max(0,initialHp-55));assert.equal(wounded.energy,55);assert.equal(wounded.unconscious,initialHp===60);if(initialHp<=60){assert.equal(wounded.stance,'prone');assert.equal(wounded.movementMode,'prone');}
  assert.equal(b.units[0].inventory['grenade:arsenal'],undefined);assert.equal(grenadeStock(s),6);
  const synced=syncBattleTime(s,b);assert.equal(synced.error,null);({campaign:s,battle:b}=decodeSave(encodeSave(synced.campaign,synced.battle)));assert.deepEqual(health(b.npcs.find(n=>n.id===npcId)),expected);
  s=order(s,{type:'leaveSector',battleId:s.pendingBattle.id,sectorState:b,survivors:b.units.filter(u=>u.side==='player')});
  s=save(s);assert.deepEqual(health(s.sectorStates.mendoza.npcs.find(n=>n.id===npcId)),expected);
  s=order(s,{type:'visitSector'});b=enterSector(s.pendingBattle,s.sectorStates.mendoza);const returned=b.npcs.find(n=>n.id===npcId);
  assert.deepEqual(health(returned),expected);assert.equal(grenadeStock(s),6);
  if(initialHp<=60){assert.equal(returned.stance,'prone');assert.equal(returned.movementMode,'prone');const position={x:returned.x,y:returned.y};advanceNpc(b,returned);assert.deepEqual({x:returned.x,y:returned.y},position);}
  assert.doesNotThrow(()=>decodeSave(encodeSave(s,b)));
 }
});

test('NPC health admission keeps healthy legacy defaults and the old dead-trap flag but rejects incoherent living state',()=>{
 const field=patch=>createBattle([{id:'p',x:1,y:2}],{width:12,height:10,tiles:flat(),exploration:true,enemies:[],npcs:[{id:'civil',name:'Vecina',x:5,y:2,...patch}]});
 const legacy=field();validateBattleSnapshot(legacy);assert.deepEqual(['hp','energy','unconscious'].map(key=>legacy.npcs[0][key]),[100,100,false]);
 for(const patch of [{hp:100,energy:100},{hp:0,energy:0},{hp:5,energy:100},{hp:80,energy:0}])assert.doesNotThrow(()=>validateBattleSnapshot(field(patch)),JSON.stringify(patch));
 for(const patch of [{hp:5},{energy:0}])assert.equal(validateBattleSnapshot(field(patch)).npcs[0].unconscious,true);
 // Old trap snapshots used either corpse flag. New scenes normalize it.
 for(const unconscious of [false,true]){const old=field({hp:0,energy:0});delete old.npcs[0].civilianHealthVersion;delete old.npcs[0].maxHp;old.npcs[0].unconscious=unconscious;assert.doesNotThrow(()=>validateBattleSnapshot(old));}
 // Test save admission directly: constructing a scene normalizes initial health.
 for(const patch of [{hp:-1},{hp:101},{hp:null},{energy:-1},{energy:101},{energy:'bad'},{unconscious:'bad'},{unconscious:null},{hp:5,unconscious:false},{hp:100,energy:0,unconscious:false},{hp:100,energy:100,unconscious:true}]){const bad=field();Object.assign(bad.npcs[0],patch);assert.throws(()=>validateBattleSnapshot(bad),JSON.stringify(patch));}
});
