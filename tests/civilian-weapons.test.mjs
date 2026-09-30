import test from 'node:test';import assert from 'node:assert/strict';
import {actBattle,createBattle,getReachable} from '../game/tactical.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {weaponRecord} from '../game/weapon-definition.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {dispatchCampaign} from '../game/campaign.js';
import {civilianWeaponField,civilianWeaponContent,localNPC} from './civilian-weapons-fixture.mjs';
import {tactical,saved,leave,order,visit,localId,hireLocal,readyLocal,A} from './local-contract-fixture.mjs';
const loot=(p,item='all')=>tactical(p,{type:'loot',targetId:localNPC(p.battle).id,item});

test('authored civilian weapons transfer once, keep images and definitions, and stay absent after recruitment and service return',()=>{
 let p=civilianWeaponField(),id=localId(p.campaign);const before=structuredClone(localNPC(p.battle).civilianWeapons);assert.equal(before.primary.contentWeapon.name,'Mosquete de Alma');
 p=loot(p,'weapon');assert.equal(localNPC(p.battle).civilianWeapons.primary,null);assert.deepEqual(Object.values(p.battle.units[0].inventory).find(g=>g.weapon===1800),before.primary);p=saved(p);
 p=loot(p,'blade');assert.equal(localNPC(p.battle).civilianWeapons.blade,null);assert.deepEqual(Object.values(p.battle.units[0].inventory).find(g=>g.weapon===1810),before.blade);
 const denied=actBattle(p.battle,{type:'loot',unitId:'110',targetId:localNPC(p.battle).id,item:'weapon'});assert.ok(denied.lastError);assert.deepEqual(denied.units,p.battle.units);
 for(let i=0;i<2;i++)p=tactical(p,{type:'heal',targetId:localNPC(p.battle).id});p=hireLocal(p);assert.equal(p.battle.units.find(u=>Number(u.id)===id).weapon,0);assert.equal(p.battle.units.find(u=>Number(u.id)===id).blade,0);
 let s=order(leave(p),{type:'dismiss',id});p=visit(saved({campaign:s}).campaign);assert.deepEqual(localNPC(p.battle).civilianWeapons,{version:1,primary:null,blade:null});assert.equal(Object.values(p.battle.units[0].inventory).filter(g=>g.weapon===1800||g.weapon===1810).length,2);assert.ok(saved(p));
});

test('civilian weapon recovery rejects source grants, changed definitions and malformed saved projections; legacy projections use remaining ownership',()=>{
 let p=loot(civilianWeaponField(),'weapon');const wire=encodeSave(p.campaign,p.battle);
 for(const mutate of [n=>n.civilianWeapons.primary={...n.civilianWeapons.blade,weapon:1800},n=>n.civilianWeapons.blade.count=2,n=>n.civilianWeapons.blade.contentWeapon.damage++,n=>delete n.civilianWeapons.blade]){
  const v=JSON.parse(wire);mutate(localNPC(v.battle));assert.throws(()=>decodeSave(JSON.stringify(v)));
 }
 const forged=structuredClone(p.battle);localNPC(forged).civilianWeapons.primary=weaponRecord({weapon:1800});assert.ok(dispatchCampaign(p.campaign,{type:'syncTacticalTime',battleId:p.campaign.pendingBattle.id,elapsedSeconds:forged.elapsedSeconds,sectorState:forged}).lastError);
 const old=JSON.parse(wire);for(const scene of [...Object.values(old.campaign.sectorStates),...Object.values(old.campaign.sceneStates),old.campaign.pendingBattle,old.battle])for(const n of scene.npcs??[])delete n.civilianWeapons;
 p=decodeSave(JSON.stringify(old));assert.equal(localNPC(p.battle).civilianWeapons.primary,null);assert.equal(localNPC(p.battle).civilianWeapons.blade.weapon,1810);assert.ok(saved(p));
});

test('civilian gear respects unconsciousness, distance, AP and shared pockets and preserves a loaded alternative with unfinished work',()=>{
 const gear={version:1,primary:weaponRecord({weapon:1808,ammunitionChoice:'ammoShot',loaded:1,reloadProgress:.4,condition:61,jammed:true}),blade:null};
 const field=(npc={},unit={})=>createBattle([{id:'collector',x:1,y:1,...unit}],{width:8,height:8,enemies:[{id:'enemy',x:7,y:7}],npcs:[{id:'resident',name:'Vecina',x:2,y:1,hp:1,civilianWeapons:structuredClone(gear),...npc}]});
 const take=b=>actBattle(b,{type:'loot',unitId:'collector',targetId:'resident',item:'weapon'});
 const b=field(),n=take(b);assert.equal(n.lastError,null);assert.equal(n.units[0].ap,b.units[0].ap-8);assert.deepEqual(Object.values(n.units[0].inventory)[0],gear.primary);assert.equal(n.npcs[0].civilianWeapons.primary,null);assert.ok(validateBattleSnapshot(n));
 for(const b of [field({hp:100}),field({departure:true}),field({x:5,y:5}),(()=>{const b=field();b.units[0].ap=7;return b;})(),field({}, {inventory:Object.fromEntries(Array.from({length:20},(_,i)=>['full'+i,{count:1,weight:1,weapon:1805}]))})]){const n=take(b);assert.ok(n.lastError);assert.deepEqual(n.units,b.units);assert.deepEqual(n.npcs,b.npcs);}
});

test('a returned resident keeps a paid alternative charge; recovery, saved return and reentry conserve it',()=>{
 let p=civilianWeaponField();for(let i=0;i<2;i++)p=tactical(p,{type:'heal',targetId:localNPC(p.battle).id});p=hireLocal(p,'month');const id=localId(p.campaign);
 let s=order(leave(p),{type:'travel',sector:'retiro'});if(s.operativeState[id].carriedLoaded)s=order(s,{type:'unloadAmmunition',operativeId:id});s=order(s,{type:'selectAmmunitionLoad',operativeId:id,family:'ammoShot'});s=order(s,{type:'travel',sector:A});s=order(s,{type:'dismiss',id});p=visit(s);
 const n=localNPC(p.battle);assert.equal(n.civilianWeapons.primary.loaded,1);assert.equal(n.civilianWeapons.primary.ammunitionChoice,'ammoShot');
 // A real approach and attack creates the recoverable body.
 const u=p.battle.units[0],spot=getReachable(p.battle,u).find(t=>Math.abs(t.x-n.x)+Math.abs(t.y-n.y)===1);assert.ok(spot);if(spot.cost)p=tactical(p,{type:'move',x:spot.x,y:spot.y});
 p=tactical(p,{type:'melee',targetId:n.id});assert.ok(localNPC(p.battle).hp<=14);p=loot(p,'weapon');p=saved(p);
 const recovered=Object.values(p.battle.units[0].inventory).find(g=>g.ammunitionChoice==='ammoShot');assert.equal(recovered.loaded,1);s=leave(p);p=visit(saved({campaign:s}).campaign);assert.equal(localNPC(p.battle).civilianWeapons.primary,null);assert.equal(Object.values(p.battle.units[0].inventory).find(g=>g.ammunitionChoice==='ammoShot').loaded,1);assert.ok(saved(p));
});

test('a death successor receives its own weapons while the looted body stays empty across saved visits',()=>{
 const d=civilianWeaponContent(),c=structuredClone(d.characters.at(-1));c.id='alma-successor';c.name='Sucesora armada';delete c.startingCondition;d.characters.push(c);d.placements.push({...d.placements.at(-1),id:'successor-location',character:c.id,afterDeath:'alma-contract',delayMin:0,delayMax:0});
 let p=readyLocal({},d);p=tactical(p,{type:'melee',targetId:localNPC(p.battle).id});assert.equal(localNPC(p.battle).hp,0);p=loot(p);const oldId=localNPC(p.battle).id;p=visit(saved({campaign:leave(p)}).campaign);
 const body=p.battle.npcs.find(n=>n.id===oldId),successor=p.battle.npcs.find(n=>n.contentId===c.id);assert.ok(successor);assert.deepEqual(body.civilianWeapons,{version:1,primary:null,blade:null});assert.equal(successor.civilianWeapons.primary.weapon,1800);assert.equal(successor.civilianWeapons.blade.weapon,1810);assert.ok(saved(p));
});
