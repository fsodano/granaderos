import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {contractQuote} from '../game/contracts.js';
import {carriedAmmunition,migrateStartingCartridges} from '../game/campaign-ammunition.js';
import {AMMUNITION_FAMILIES} from '../game/ammunition-families.js';
import {ammoTypeFor} from '../game/ammo-types.js';
import {personalPockets} from '../game/personal-pockets.js';
import {previewStrategicRoute} from '../game/strategic-route.js';
import {enterSector} from '../game/world.js';
import {actBattle} from '../game/tactical.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {order,saved,sync,leave} from './local-contract-fixture.mjs';

const fresh=()=>initialCampaign(8,defaultContentPackage());
const restored=campaign=>decodeSave(encodeSave(campaign)).campaign;
const actor=(state,id)=>carriedAmmunition(rosterFor(state).find(op=>op.id===id),state.operativeState[id]);
function assertAllowance(state,id,family){
 const u=actor(state,id),r=state.operativeState[id];
 assert.equal(r.startingCartridgesIssued,true);assert.equal(u.loaded,1);assert.equal(u.ammo,9);assert.equal(r.carriedAmmo,10);assert.equal(ammoTypeFor(u),family);
 const pockets=personalPockets(u);assert.equal(pockets.overflow.length,0);
 assert.deepEqual(pockets.items.filter(item=>item.kind==='ammunition').map(({ammoType,count})=>({ammoType,count})),[{ammoType:AMMUNITION_FAMILIES[family].type,count:9}]);
}

test('an actual 3200-peso Kerr hire brings a loaded charge and nine physical spare cartridges through queued assault and save',()=>{
 let s=fresh();const quote=contractQuote(s,rosterFor(s).find(op=>op.id===113),'week');assert.equal(quote.available,true);assert.equal(quote.price,1134);
 s=order(s,{type:'recruitCivic',id:113,term:'week'});assert.equal(s.resources.treasury,3200-quote.price);assert.equal(s.operativeState[113].startingCartridgesIssued,false);assert.equal(s.recruited.includes(113),false);
 s=order(restored(s),{type:'wait',hours:6});assertAllowance(s,113,'ammoShot');const cash=s.resources.treasury;
 const route=previewStrategicRoute(s,s.activeSquadId,'buenos_aires');assert.equal(route.valid,true);s=order(s,route.action);s=order(restored(s),{type:'wait',hours:12});assert.equal(s.squads[0].journey.status,'ready');
 s=order(s,{type:'beginAssault',sector:'buenos_aires'});assert.equal(s.resources.treasury,cash);assertAllowance(s,113,'ammoShot');
 assert.deepEqual([s.pendingBattle.squad[0].loaded,s.pendingBattle.squad[0].ammo],[1,9]);assert.equal(s.pendingBattle.issuedCartridges,10);
 const p=saved({campaign:s,battle:enterSector({...s.pendingBattle,hour:s.hour,secondOfHour:s.secondOfHour??0})});assert.deepEqual([p.battle.units[0].loaded,p.battle.units[0].ammo],[1,9]);assertAllowance(p.campaign,113,'ammoShot');
});

test('each default firearm family arrives with compatible finite cartridges in the personal pockets',()=>{
 for(const family of Object.keys(AMMUNITION_FAMILIES)){
  let s=fresh();const op=rosterFor(s).find(op=>ammoTypeFor(op)===family&&op.id>=100&&op.id<1000&&contractQuote(s,op,'week').available&&contractQuote(s,op,'week').price<=s.resources.treasury);assert.ok(op,`${family} has an affordable actual default hire`);
  s=order(s,{type:'recruitCivic',id:op.id,term:'week'});s=order(restored(s),{type:'wait',hours:6});assertAllowance(s,op.id,family);assertAllowance(restored(s),op.id,family);
 }
});

for(const oldFlag of [undefined,true])test(`a never-served older candidate with ${oldFlag===undefined?'no issue flag':'the old auto-issued flag'} receives cartridges only on actual arrival`,()=>{
 let s=fresh();for(const r of Object.values(s.operativeState)){if(oldFlag===undefined)delete r.startingCartridgesIssued;else r.startingCartridgesIssued=true;}
 s=restored(s);assert.equal(s.operativeState[113].startingCartridgesIssued,false);assert.equal(s.operativeState[113].carriedAmmo,0);
 s=order(s,{type:'recruitCivic',id:113,term:'week'});s=order(restored(s),{type:'wait',hours:6});assertAllowance(s,113,'ammoShot');
 const once=restored(s);assert.deepEqual(restored(once),once);s=order(once,{type:'renewContract',id:113,term:'day'});assertAllowance(s,113,'ammoShot');
});

test('an older pending first hire is repaired before arrival without receiving ammunition at booking or cancellation',()=>{
 let s=order(fresh(),{type:'recruitCivic',id:113,term:'week'});s.operativeState[113].startingCartridgesIssued=true;s=restored(s);assert.equal(s.operativeState[113].startingCartridgesIssued,false);assert.equal(s.operativeState[113].carriedAmmo,0);
 const cancelled=order(s,{type:'cancelHireArrival',id:113});assert.equal(cancelled.resources.treasury,3200);assert.equal(cancelled.operativeState[113].carriedAmmo,0);
 s=order(s,{type:'wait',hours:6});assertAllowance(s,113,'ammoShot');
});

test('real spent ammunition stays spent through old-save admission, renewal, reentry and rehire',()=>{
 let s=order(fresh(),{type:'recruitCivic',id:110,term:'week'});s=order(s,{type:'wait',hours:6});s=order(s,{type:'visitSector'});let p=saved({campaign:s,battle:enterSector({...s.pendingBattle,hour:s.hour})});
 for(let count=0;count<80&&p.battle.units[0].loaded+p.battle.units[0].ammo>0;count++){
  const u=p.battle.units[0],action=u.jammed?{type:'reprime'}:u.loaded?{type:'firePoint',x:u.x+2,y:u.y}:{type:'reload'};
  const battle=actBattle(p.battle,{unitId:u.id,...action});assert.equal(battle.lastError,null,battle.lastError);p=sync({campaign:p.campaign,battle});
 }
 assert.equal(p.battle.units[0].loaded+p.battle.units[0].ammo,0);s=leave(saved(p));assert.equal(s.operativeState[110].carriedAmmo,0);
 delete s.operativeState[110].startingCartridgesIssued;s=restored(s);assert.equal(s.operativeState[110].startingCartridgesIssued,true);assert.equal(s.operativeState[110].carriedAmmo,0);
 s=order(s,{type:'renewContract',id:110,term:'day'});s=order(s,{type:'visitSector'});p=saved({campaign:s,battle:enterSector({...s.pendingBattle,hour:s.hour,secondOfHour:s.secondOfHour??0},s.sectorStates.retiro)});assert.equal(p.battle.units[0].loaded+p.battle.units[0].ammo,0);s=leave(p);
 s=order(s,{type:'dismiss',id:110});s=restored(s);assert.equal(s.operativeState[110].startingCartridgesIssued,true);assert.equal(s.operativeState[110].carriedAmmo,0);
 s=order(s,{type:'recruitCivic',id:110,term:'day'});s=order(s,{type:'wait',hours:6});assert.equal(s.operativeState[110].startingCartridgesIssued,true);assert.equal(s.operativeState[110].carriedAmmo,0);
});

test('an empty serving or previously equipped record is never treated as a pristine unserved candidate',()=>{
 for(const patch of [{location:'retiro'},{carriedLoaded:0},{outfit:null},{serviceEquipmentReturn:{}},{xp:1},{captureSequence:1}]){
  const s=fresh();Object.assign(s.operativeState[113],patch);delete s.operativeState[113].startingCartridgesIssued;migrateStartingCartridges(s);assert.equal(s.operativeState[113].startingCartridgesIssued,true);assert.equal(s.operativeState[113].carriedAmmo,0);
 }
 let s=order(fresh(),{type:'recruitCivic',id:113,term:'week'});s=order(s,{type:'wait',hours:6});const original=structuredClone(s.operativeState[113]);delete s.operativeState[113].startingCartridgesIssued;
 s=restored(s);assert.deepEqual(s.operativeState[113],original);
 const bad=fresh();bad.operativeState[113].startingCartridgesIssued='true';assert.throws(()=>restored(bad),/entrega inicial/);assert.ok(dispatchCampaign(bad,{type:'wait',hours:1}).lastError);
});
