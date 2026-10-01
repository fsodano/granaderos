import {setReserve} from './typed-ammo-fixture.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,reloadPlan,reloadCost} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {weaponMetadata,weaponRecord} from '../game/weapon-definition.js';
import {refreshMilitaryCondition} from '../game/actor-condition.js';
import {defaultContentPackage} from '../game/content-package.js';
import {initialCampaign} from '../game/campaign.js';
import {decodeSave,encodeSave} from '../game/save.js';
import {order,saved,sync} from './local-contract-fixture.mjs';
import {secureArea} from './controlled-area-fixture.mjs';
const definition=(changes={})=>({...defaultContentPackage().weapons.find(w=>w.template===1800),id:'slow-loader',name:'Mosquete de prueba',reloadAP:250,damage:1,...changes});
const tiles=()=>Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:i%12===3?'water':'grass',blocked:i%12===3,cover:0,blocksSight:false}));
const field=(changes={},others=[])=>createBattle([{id:'p',name:'Soldado',x:1,y:1,weapon:1800,loaded:0,ammo:6,...changes},...others],{width:12,height:8,tiles:tiles(),enemies:[{id:'guard',x:5,y:1,weapon:1813,ammo:0,overwatch:false,patrol:false}]});
const finishEnemyTurn=b=>{let n=endTurn(b);for(let i=0;n.phase==='interrupt'&&i<20;i++)n=endTurn(n);assert.equal(n.phase,'player');return n;};
const reload=b=>{const n=actBattle(b,{type:'reload',unitId:'p'});assert.equal(n.lastError,null,n.lastError);return n;};

test('long authored firearm loading spans real turns and saved snapshots without consuming unfinished charges',()=>{
 let b=field({weaponMetadata:weaponMetadata(definition())}),paid=0,turns=0;const before=structuredClone(b);while(b.units[0].loaded===0){const plan=reloadPlan(b.units[0],b);assert.ok(plan.pa>0);const prior=b.units[0].ap;b=reload(b);paid+=prior-b.units[0].ap;assert.equal(b.units[0].ammo,6-b.units[0].loaded);assert.equal(b.units[0].priming,undefined);b=validateBattleSnapshot(JSON.parse(JSON.stringify(b)));if(!b.units[0].loaded){assert.equal(b.units[0].ap,0);b=endTurn(b);turns++;assert.ok(turns<5);}}
 assert.ok(turns>=2);assert.equal(paid,250);assert.equal(b.units[0].loaded,1);assert.equal(b.units[0].ammo,5);assert.equal(b.units[0].reloadProgress,undefined);assert.equal(before.units[0].loaded,0);assert.equal(before.units[0].ammo,6);assert.equal(before.units[0].reloadProgress,undefined);
});

test('each finished barrel consumes one cartridge and partial work adapts to stance without becoming free ammunition',()=>{
 let b=field({weapon:1808});b.units[0].ap=41;b=reload(b);assert.equal(b.units[0].loaded,1);assert.equal(b.units[0].ammo,5);assert.equal(b.units[0].priming,undefined);assert.equal(reloadCost(b.units[0],b),14);assert.ok(b.units[0].reloadProgress>0&&b.units[0].reloadProgress<1);b=endTurn(b);b=actBattle(b,{type:'stance',unitId:'p',stance:'prone'});assert.equal(b.lastError,null);assert.equal(reloadCost(b.units[0],b),21);const ap=b.units[0].ap;b=reload(b);assert.equal(b.units[0].ap,ap-21);assert.equal(b.units[0].loaded,2);assert.equal(b.units[0].ammo,4);assert.equal(b.units[0].priming,undefined);assert.equal(b.units[0].reloadProgress,undefined);assert.ok(actBattle(b,{type:'reload',unitId:'p'}).lastError);
});

test('partial progress belongs to the gun through actual swaps and finite corpse collection',()=>{
 let b=field({inventory:{spare:{count:1,weight:4,weapon:1801,loaded:0,condition:100}}},[{id:'collector',x:1,y:2,weapon:1809}]);b.units[0].ap=20;b=reload(b);const progress=b.units[0].reloadProgress;b=finishEnemyTurn(b);b=actBattle(b,{type:'equipLoot',unitId:'p',inventoryKey:'spare'});assert.equal(b.lastError,null);assert.equal(b.units[0].reloadProgress,undefined);const key=Object.keys(b.units[0].inventory).find(k=>b.units[0].inventory[k].weapon===1800);assert.equal(b.units[0].inventory[key].reloadProgress,progress);b=actBattle(b,{type:'equipLoot',unitId:'p',inventoryKey:key});assert.equal(b.lastError,null);assert.equal(b.units[0].reloadProgress,progress);
 // Prepared casualty isolates transfer of this actual partially loaded weapon.
 b.units[0].hp=0;refreshMilitaryCondition(b.units[0]);b=actBattle(b,{type:'loot',unitId:'collector',targetId:'p',item:'weapon'});assert.equal(b.lastError,null);assert.equal(b.units[0].reloadProgress,undefined);assert.equal(b.units[0].weaponDropped,true);const collector=b.units.find(u=>u.id==='collector'),found=Object.entries(collector.inventory).find(([,v])=>v.weapon===1800);assert.ok(found);assert.equal(found[1].reloadProgress,progress);assert.ok(validateBattleSnapshot(b));b=actBattle(b,{type:'equipLoot',unitId:'collector',inventoryKey:found[0]});assert.equal(b.lastError,null);assert.equal(b.units.find(u=>u.id==='collector').reloadProgress,progress);assert.equal(b.units.find(u=>u.id==='collector').loaded,0);assert.equal(weaponRecord(b.units.find(u=>u.id==='collector')).reloadProgress,progress);
});

test('invalid progress and unavailable reloads are rejected without creating charges or work',()=>{
 const b=field();for(const value of [-1,0,1,2,'0.5',null,NaN]){const bad=structuredClone(b);bad.units[0].reloadProgress=value;assert.throws(()=>validateBattleSnapshot(bad));}
 for(const patch of [{loaded:1,reloadProgress:.5},{weapon:1813,reloadProgress:.5},{weaponDropped:true,reloadProgress:.5}]){const bad=structuredClone(b);Object.assign(bad.units[0],patch);assert.throws(()=>validateBattleSnapshot(bad));}
 for(const patch of [{ap:0},{ammo:0},{jammed:true},{loaded:1}]){const source=structuredClone(b);Object.assign(source.units[0],patch);if(patch.ammo!==undefined)setReserve(source.units[0],patch.ammo);const denied=actBattle(source,{type:'reload',unitId:'p'});assert.ok(denied.lastError);assert.deepEqual(denied.units,source.units);}
 let peaceful=field({weaponMetadata:weaponMetadata(definition())});peaceful.mode='exploration';peaceful.units=peaceful.units.filter(u=>u.side==='player');const ap=peaceful.units[0].ap;peaceful=reload(peaceful);assert.equal(peaceful.units[0].ap,ap);assert.equal(peaceful.elapsedSeconds,15);assert.equal(peaceful.units[0].loaded,1);assert.equal(peaceful.units[0].ammo,5);assert.match(peaceful.log.at(-1),/15 s/);assert.doesNotMatch(peaceful.log.at(-1),/PA/);
});

test('a paid campaign soldier saves actual partial weapon work and resumes without a cartridge or treasury grant',()=>{
 const d=defaultContentPackage(),gun=definition();d.weapons.push(gun);Object.assign(d.characters.find(c=>c.id==='person-110'),{weapon:gun.id,arrivalHours:0});let s=secureArea(initialCampaign(42,d),'buenos_aires');s=order(s,{type:'recruitCivic',id:110,term:'week'});s=order(s,{type:'travel',sector:'buenos_aires'});s=order(s,{type:'attack',sector:'san_nicolas'});const r=s.pendingBattle;
 // Compact barrier geometry isolates active save/resume under a real paid request.
 let b=createBattle(r.squad.map(u=>({...u,x:1,y:1})),{...r,width:12,height:8,tiles:tiles(),enemies:[{id:'guard',x:5,y:1,weapon:1813,ammo:0,overwatch:false,patrol:false}],npcs:(r.npcs??[]).map((n,i)=>({...n,x:8+i%3,y:4+Math.floor(i/3)}))});for(let tries=0;b.units[0].loaded&&tries<3;tries++){if(b.units[0].jammed)b=actBattle(b,{type:'reprime',unitId:'110'});assert.equal(b.lastError,null);b=actBattle(b,{type:'fire',unitId:'110',targetId:'guard'});assert.equal(b.lastError,null);}assert.equal(b.units[0].loaded,0);b=actBattle(b,{type:'reload',unitId:'110'});assert.equal(b.lastError,null);const progress=b.units[0].reloadProgress,ammo=b.units[0].ammo,treasury=s.resources.treasury;let p=saved(sync({campaign:s,battle:b}));assert.equal(p.battle.units[0].reloadProgress,progress);assert.equal(p.battle.units[0].ammo,ammo);assert.equal(p.campaign.resources.treasury,treasury);
 const wire=JSON.parse(encodeSave(p.campaign,p.battle));wire.battle.units[0].reloadProgress=1;assert.throws(()=>decodeSave(JSON.stringify(wire)));
 const remaining=reloadPlan(p.battle.units[0],p.battle).totalPA;let turns=0,paid=0;while(!p.battle.units[0].loaded){p.battle=finishEnemyTurn(p.battle);const before=p.battle.units[0].ap;p.battle=actBattle(p.battle,{type:'reload',unitId:'110'});assert.equal(p.battle.lastError,null);paid+=before-p.battle.units[0].ap;p=saved(sync(p));assert.ok(++turns<20,'Finite loading must finish using the tired soldier’s actual AP.');}assert.equal(paid,remaining);assert.equal(p.battle.units[0].ammo,ammo-1);assert.equal(p.battle.units[0].reloadProgress,undefined);assert.equal(p.campaign.resources.treasury,treasury);assert.ok(saved(p));
});


test('long exploration loading stops on actual contact or collapse and keeps only the elapsed work',()=>{
 let contact=field({weaponMetadata:weaponMetadata(definition())});contact.mode='exploration';contact=reload(contact);assert.equal(contact.mode,'combat');assert.equal(contact.elapsedSeconds,6);assert.equal(contact.units[0].loaded,0);assert.equal(contact.units[0].ammo,6);assert.equal(contact.units[0].priming,undefined);assert.equal(contact.units[0].reloadProgress,.4);assert.match(contact.log.at(-1),/6 s/);assert.ok(validateBattleSnapshot(contact));
 let collapse=field({weaponMetadata:weaponMetadata(definition()),hp:15,bleeding:1});collapse.mode='exploration';collapse.units=collapse.units.filter(u=>u.side==='player');collapse=reload(collapse);assert.equal(collapse.status,'defeat');assert.equal(collapse.elapsedSeconds,6);assert.equal(collapse.units[0].hp,14);assert.equal(collapse.units[0].loaded,0);assert.equal(collapse.units[0].ammo,6);assert.equal(collapse.units[0].reloadProgress,.4);assert.ok(validateBattleSnapshot(collapse));
});
