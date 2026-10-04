import {approachNPC} from './approach-npc.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultContentPackage,encodeContentPackage,parseContentPackage,validateContentPackage} from '../game/content-package.js';
import {campaignContentReport} from '../game/campaign-content.js';
import {DEFAULT_CHARACTER_SUPPLIES} from '../game/character-supplies.js';
import {initialCampaign,rosterFor,dispatchCampaign} from '../game/campaign.js';
import {encountersFor} from '../game/encounters.js';
import {actBattle,getReachable} from '../game/tactical.js';
import {sectorInventoryModel} from '../game/sector-inventory.js';
import {SUPPLY_ITEMS} from '../game/tactical-inventory.js';
import {order,saved,visit,tactical,leave,localPackage,localId,readyLocal,hireLocal,localNPC,sync} from './local-contract-fixture.mjs';
const allocation={rations:3,torches:1,medkits:0,boleadoras:0};
const supplies=o=>Object.fromEntries(Object.keys(DEFAULT_CHARACTER_SUPPLIES).map(k=>[k,o[k]]));
const person=(d,id=110)=>d.characters.find(c=>c.id===`person-${id}`);
const unit=(p,id)=>p.battle.units.find(u=>u.id===String(id));
const emptySupplies=Object.fromEntries(Object.keys(DEFAULT_CHARACTER_SUPPLIES).map(k=>[k,0]));
const returnedSupplyRows=(s,site,id)=>sectorInventoryModel(s,site,rosterFor(s),id).entries.filter(row=>(row.key.startsWith('ground:service-return-')||row.kind==='serviceReturn')&&Object.hasOwn(DEFAULT_CHARACTER_SUPPLIES,JSON.parse(row.expected).item));
const returnedPackets=rows=>rows.map(row=>JSON.parse(row.expected)).sort((a,b)=>a.item.localeCompare(b.item));
const expectedPackets=counts=>Object.entries(counts).filter(([,count])=>count>0).map(([item,count])=>({item,count,weight:SUPPLY_ITEMS[item].weight})).sort((a,b)=>a.item.localeCompare(b.item));
function collectReturnedSupplies(s,site,id){
 const rows=returnedSupplyRows(s,site,id),before=supplies(s.operativeState[id]);
 for(const row of rows){
  assert.ok(row.reachable,row.reason);const stack=JSON.parse(row.expected),receipt={type:'sectorInventory',sector:site,operativeId:id,direction:'take',sourceKey:row.key,expected:row.expected,count:row.count};
  s=order(s,receipt);assert.equal(s.operativeState[id][stack.item],before[stack.item]+stack.count);
  const rejected=dispatchCampaign(s,receipt);assert.ok(rejected.lastError);assert.deepEqual({...rejected,lastError:null},s,'the exact return source cannot be collected twice');
 }
 assert.equal(returnedSupplyRows(s,site,id).length,0);return saved({campaign:s}).campaign;
}

test('starting supplies accept only complete bounded integer allocations and old packages keep their defaults',()=>{
 const d=defaultContentPackage();assert.equal(person(d).startingSupplies,undefined);
 for(const bad of [null,[],{},allocation.rations,{...allocation,torches:-1},{...allocation,rations:1.5},{...allocation,torches:1001},{...allocation,medkits:'2'},{...allocation,ammo:10},{...allocation,boleadoras:Infinity}]){
  person(d).startingSupplies=bad;assert.ok(validateContentPackage(d).some(e=>e.includes('startingSupplies')));assert.throws(()=>initialCampaign(42,d));
 }
 person(d).startingSupplies=allocation;assert.deepEqual(campaignContentReport(d).blocked,[]);
 const imported=parseContentPackage(encodeContentPackage(d));assert.deepEqual(person(imported).startingSupplies,allocation);
 let s=saved({campaign:initialCampaign(42,imported)}).campaign;assert.deepEqual(supplies(s.operativeState[110]),allocation);
 delete person(d).startingSupplies;s=order(initialCampaign(42,d),{type:'recruitCivic',id:110,term:'day'});s=order(s,{type:'wait',hours:6});assert.deepEqual(supplies(unit(visit(s),110)),DEFAULT_CHARACTER_SUPPLIES);
});

test('paid arrivals use the authored supplies and consumption survives saves, renewal, dismissal and rehire',()=>{
 const d=defaultContentPackage();person(d).startingSupplies=allocation;
 let s=initialCampaign(42,d);assert.ok(!encountersFor(s,'retiro').some(n=>n.operativeId===110));
 s=order(s,{type:'recruitCivic',id:110,term:'day'});assert.ok(!s.recruited.includes(110));assert.deepEqual(supplies(s.operativeState[110]),allocation);
 s=order(saved({campaign:s}).campaign,{type:'wait',hours:6});let p=visit(s);assert.deepEqual(supplies(unit(p,110)),allocation);
 const u=unit(p,110);p=tactical(p,{type:'weapon',unitId:u.id,slot:'supply',supplyKey:'torches'});p=tactical(p,{type:'throwTorch',unitId:u.id,x:u.x,y:u.y});p=saved(p);
 const consumed={...allocation,torches:0};assert.deepEqual(supplies(unit(p,110)),consumed);
 const rejected=actBattle(p.battle,{type:'throwTorch',unitId:u.id,x:u.x,y:u.y});assert.ok(rejected.lastError);assert.deepEqual(rejected.units,p.battle.units);
 s=leave(p);assert.deepEqual(supplies(s.operativeState[110]),consumed);
 s=order(s,{type:'renewContract',id:110,term:'day'});assert.deepEqual(supplies(s.operativeState[110]),consumed);
 s=order(s,{type:'dismiss',id:110});assert.ok(!encountersFor(s,'retiro').some(n=>n.operativeId===110));assert.deepEqual(supplies(s.operativeState[110]),emptySupplies);
 const returned=returnedPackets(returnedSupplyRows(s,'retiro',110)),sequence=s.serviceEquipmentReturns.nextId;assert.deepEqual(returned,expectedPackets(consumed));s=saved({campaign:s}).campaign;assert.deepEqual(returnedPackets(returnedSupplyRows(s,'retiro',110)),returned);
 s=order(s,{type:'recruitCivic',id:110,term:'day'});s=order(s,{type:'wait',hours:6});p=visit(saved({campaign:s}).campaign);assert.deepEqual(supplies(unit(p,110)),emptySupplies);
 s=leave(p);assert.equal(s.serviceEquipmentReturns.nextId,sequence);assert.deepEqual(returnedPackets(returnedSupplyRows(s,'retiro',110)),returned);s=collectReturnedSupplies(s,'retiro',110);assert.deepEqual(supplies(s.operativeState[110]),consumed);
 p=visit(s);assert.deepEqual(supplies(unit(p,110)),consumed);s=leave(saved(p));const money=s.resources.treasury,rejectedRefill=dispatchCampaign(s,{type:'resupply',operativeId:110});assert.match(rejectedRefill.lastError,/comercio/);assert.equal(rejectedRefill.resources.treasury,money);assert.deepEqual(supplies(rejectedRefill.operativeState[110]),consumed);
 assert.deepEqual(person(d).startingSupplies,allocation,'mutable campaign supplies do not edit the content package');
});

test('a physically recruited resident returns its finite allocation locally and can collect it after rehire',()=>{
 const d=localPackage();d.characters.find(c=>c.id==='alma-contract').startingSupplies={...allocation,medkits:5,boleadoras:4};
 let p=hireLocal(readyLocal(undefined,d)),id=localId(p.campaign);const initial={...allocation,medkits:5,boleadoras:4};assert.deepEqual(supplies(unit(p,id)),initial);
 const u=unit(p,id);p=tactical(p,{type:'weapon',unitId:u.id,slot:'supply',supplyKey:'torches'});p=tactical(p,{type:'throwTorch',unitId:u.id,x:u.x,y:u.y});let s=leave(saved(p));const consumed={...initial,torches:0};assert.deepEqual(supplies(s.operativeState[id]),consumed);
 const site=s.location;s=order(s,{type:'dismiss',id});assert.deepEqual(supplies(s.operativeState[id]),emptySupplies);const returned=returnedPackets(returnedSupplyRows(s,site,id)),sequence=s.serviceEquipmentReturns.nextId;assert.deepEqual(returned,expectedPackets(consumed));
 p=visit(saved({campaign:s}).campaign);const n=localNPC(p.battle),speaker=p.battle.units.find(u=>u.side==='player');assert.deepEqual(supplies(n.civilianSupplies),emptySupplies);p=sync({campaign:p.campaign,battle:approachNPC(p.battle,speaker.id,n.id)});p=hireLocal(p);assert.deepEqual(supplies(unit(p,id)),emptySupplies);
 s=leave(saved(p));assert.equal(s.serviceEquipmentReturns.nextId,sequence);assert.deepEqual(returnedPackets(returnedSupplyRows(s,site,id)),returned);s=collectReturnedSupplies(s,site,id);assert.deepEqual(supplies(s.operativeState[id]),consumed);p=visit(s);assert.deepEqual(supplies(unit(p,id)),consumed);assert.ok(saved(p));assert.deepEqual(d.characters.find(c=>c.id==='alma-contract').startingSupplies,initial);
});

test('zero supplies also survive historical in-person recruitment',()=>{
 const d=defaultContentPackage();person(d,3).startingSupplies=Object.fromEntries(Object.keys(DEFAULT_CHARACTER_SUPPLIES).map(k=>[k,0]));person(d).arrivalHours=0;
 let s=order(initialCampaign(42,d),{type:'recruitCivic',id:110,term:'week'}),p=visit(s);const npc=p.battle.npcs.find(n=>n.operativeId===3),speaker=unit(p,110);assert.ok(npc);
 p=sync({campaign:p.campaign,battle:approachNPC(p.battle,speaker.id,npc.id)});
 s=order(p.campaign,{type:'talkNPC',npcId:npc.id,unitId:speaker.id,approach:'recruit',sectorState:p.battle});assert.ok(s.recruited.includes(3));assert.deepEqual(supplies(s.pendingBattle.squad.find(u=>u.id===3)),person(d,3).startingSupplies);
});
