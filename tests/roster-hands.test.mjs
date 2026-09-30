import test from 'node:test';import assert from 'node:assert/strict';
import {rosterHands} from '../game/roster-hands.js';
const base=(extra={})=>({id:'p',weapon:1800,loaded:1,ammo:9,condition:81,activeSlot:'primary',weaponMode:'fire',blade:1813,bladeCondition:61,inventory:{},...extra});
const fitting=condition=>({bayonet:{weapon:1811,fittingPattern:'india_socket',instanceId:'socket',condition}});

test('a two-hand firearm has one actual gun, a blocked second hand and no stowed blade',()=>{
 const hands=rosterHands(base());assert.equal(hands.length,2);assert.equal(hands[0].weapon,1800);assert.equal(hands[0].loaded,1);assert.equal(hands[0].closeCombat,false);assert.equal(hands[0].attached,false);assert.match(hands[0].description,/Disparo activo/);
 assert.deepEqual(hands[1],{side:'left',item:null,blocked:true,label:'Ocupada por el arma',description:'Segunda mano: ocupada por el arma de dos manos.',weapon:null,icon:'blocked',closeCombat:false,attached:false,attachments:[]});assert.ok(!hands.some(h=>h.weapon===1813));
});

test('close combat and fitting presence are independent, including a broken fitted bayonet',()=>{
 for(const weaponMode of ['fire','melee'])for(const condition of [100,0]){
  const hands=rosterHands(base({weaponMode,weaponFittings:fitting(condition)}));assert.equal(hands[0].closeCombat,weaponMode==='melee');assert.equal(hands[0].attached,true);assert.equal(hands[0].attachments[0].condition,condition);assert.match(hands[0].description,/Bayoneta para Brown Bess India/);if(!condition)assert.match(hands[0].description,/roto/);
 }
 const bare=rosterHands(base({weaponMode:'melee'}))[0];assert.equal(bare.closeCombat,true);assert.equal(bare.attached,false);
});

test('an inactive held blade and second gun never inherit the active main weapon mode or fittings',()=>{
 let hands=rosterHands(base({weapon:1805,weaponMode:'melee'}));assert.equal(hands[0].closeCombat,true);assert.equal(hands[1].weapon,1813);assert.equal(hands[1].closeCombat,false);assert.equal(hands[1].attached,false);
 hands=rosterHands(base({weapon:1805,blade:0,loaded:0,offHand:{weapon:1808,count:1,weight:1.3,loaded:2,condition:41},leftHandItem:'offhand'}));assert.equal(hands[0].loaded,0);assert.equal(hands[1].loaded,2);assert.equal(hands[1].condition,41);assert.match(hands[1].description,/2 carga\(s\)/);
 const activeBlade=rosterHands(base({weapon:1800,activeSlot:'blade',blade:1813,weaponFittings:fitting(80)}));assert.equal(activeBlade[0].weapon,1813);assert.equal(activeBlade[0].closeCombat,true);assert.equal(activeBlade[0].attached,false);assert.equal(activeBlade[1].weapon,null);
});

test('supplies, tools, objects and empty hands get physical icons without inspecting unrelated equipment',()=>{
 const examples=[
  [{activeSlot:'medical',medkits:2,leftHandItem:'medkits'},'medical','medical'],
  [{activeSlot:'supply',activeSupply:'torches',torches:1,leftHandItem:null},'torch','empty'],
  [{activeSlot:'tool',activeTool:'inventory:key',inventory:{key:{kind:'tool',toolKey:'key',keyId:'gate',count:1,weight:.1}},leftHandItem:null},'key','empty'],
  [{activeSlot:'item',activeItem:'inventory:note',inventory:{note:{name:'Carta',count:1,weight:.1}},leftHandItem:null},'item','empty'],
  [{activeSlot:'unarmed',leftHandItem:null},'empty','empty'],
 ];
 for(const [extra,right,left]of examples){const hands=rosterHands(base(extra));assert.equal(hands[0].icon,right);assert.equal(hands[1].icon,left);assert.ok(hands.every(h=>!h.closeCombat&&!h.attached));}
 const u=base({activeSlot:'unarmed',leftHandItem:null,inventory:new Proxy({},{ownKeys(){throw Error('unheld pack scanned');}})});assert.doesNotThrow(()=>rosterHands(u));
});

test('roster reads neither action previews nor complete soldier snapshots and never mutates held metadata',()=>{
 const u=base({weaponFittings:fitting(0)}),before=structuredClone(u);Object.defineProperty(u,'practiceTiles',{enumerable:true,get(){throw Error('whole soldier cloned');}});
 const hands=rosterHands(u);assert.equal(hands[0].attached,true);hands[0].attachments[0].condition=100;assert.deepEqual(u.weaponFittings,before.weaponFittings);assert.equal(u.loaded,before.loaded);
});
