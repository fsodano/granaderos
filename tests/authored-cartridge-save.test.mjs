import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultContentPackage} from '../game/content-package.js';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {actBattle,getReachable} from '../game/tactical.js';
import {order,saved,sync,leave} from './local-contract-fixture.mjs';

function ready(rounds){const d=defaultContentPackage();d.rules.deploymentCartridges=rounds;d.characters.find(c=>c.id==='person-110').arrivalHours=0;return order(initialCampaign(8,d),{type:'recruitCivic',id:110,term:'week'});}

test('every authored cartridge allocation can save an actual peaceful and combat deployment',()=>{
 for(const rounds of [0,10,11,14,100])for(const action of [{type:'visitSector'},{type:'attack',sector:'buenos_aires'}]){
  let s=ready(rounds),before=s.resources.treasury;s=order(s,action);assert.equal(s.resources.treasury,before-rounds);
  const request=s.pendingBattle,record=request.squad[0];assert.equal(record.ammo+record.loaded,rounds);
  const b=enterSector({...request,hour:s.hour,secondOfHour:s.secondOfHour??0},s.sectorStates[request.sector]);let p=saved({campaign:s,battle:b});const u=p.battle.units.find(u=>u.id==='110');assert.equal(u.ammo+u.loaded,rounds);
  const forged=JSON.parse(encodeSave(p.campaign,p.battle));forged.campaign.pendingBattle.squad[0].ammo=rounds+1;assert.throws(()=>decodeSave(JSON.stringify(forged)),/reserva del combatiente no coincide con su inventario/);
  if(action.type==='visitSector'){const after=leave(p);assert.equal(after.resources.treasury,before-rounds);assert.equal(after.operativeState[110].ammo+after.operativeState[110].carriedLoaded,rounds);assert.ok(dispatchCampaign(after,{type:'leaveSector',battleId:request.id,sectorState:p.battle,survivors:p.battle.units.filter(u=>u.side==='player')}).lastError);}
 }
});

test('a large authored allocation survives real firing, time synchronization and active reload without replenishment',()=>{
 let s=order(ready(100),{type:'visitSector'}),p={campaign:s,battle:enterSector({...s.pendingBattle,hour:s.hour},s.sectorStates[s.location])};
 const u=p.battle.units.find(u=>u.id==='110'),npc=p.battle.npcs.find(n=>n.operativeId===3),spot=getReachable(p.battle,u).find(t=>Math.abs(t.x-npc.x)+Math.abs(t.y-npc.y)===1);assert.ok(spot);
 if(spot.cost){const b=actBattle(p.battle,{type:'move',unitId:u.id,x:spot.x,y:spot.y});assert.equal(b.lastError,null);p=sync({campaign:p.campaign,battle:b});}
 const battle=actBattle(p.battle,{type:'fire',unitId:u.id,targetId:npc.id});assert.equal(battle.lastError,null);p=saved(sync({campaign:p.campaign,battle}));const spent=p.battle.units.find(v=>v.id===u.id);assert.equal(spent.ammo+spent.loaded,99);
 const n=actBattle(p.battle,{type:'reload',unitId:u.id});assert.equal(n.lastError,null);p=saved(sync({campaign:p.campaign,battle:n}));assert.equal(p.battle.units.find(v=>v.id===u.id).ammo+p.battle.units.find(v=>v.id===u.id).loaded,99);
 s=leave(p);assert.equal(s.resources.treasury,ready(100).resources.treasury-100);assert.equal(s.operativeState[110].ammo+s.operativeState[110].carriedLoaded,99);assert.ok(saved({campaign:s}));
});
