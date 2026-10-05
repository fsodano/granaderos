import {WEAPON_READY_AP} from '../game/weapon-readiness.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,actionCosts,WEAPONS} from '../game/tactical.js';
import {weaponMetadata,weaponRecord} from '../game/weapon-definition.js';
import {defaultContentPackage} from '../game/content-package.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {refreshMilitaryCondition} from '../game/actor-condition.js';
import {orderDescriptors} from '../game/ja2-hud.js';
import {initialCampaign} from '../game/campaign.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {order,saved,sync} from './local-contract-fixture.mjs';
const definition=(changes={})=>({...defaultContentPackage().weapons.find(w=>w.template===1808),id:'prepared-pistol',name:'Pistola preparada',damage:1,fireAP:20,readyAP:7,capacity:3,range:25,...changes});
const tiles=()=>Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:i%12===3?'water':'grass',blocked:i%12===3,cover:0,blocksSight:false}));
const field=(changes={},extra=[])=>createBattle([{id:'p',name:'Tirador',x:1,y:1,weapon:1808,weaponMetadata:weaponMetadata(definition()),ammo:6,blade:1813,...changes},...extra],{width:12,height:8,tiles:tiles(),seed:45,enemies:[{id:'guard',x:7,y:1,hp:1000,maxHp:1000,weapon:1813,ammo:0,patrol:false,overwatch:false}]});
const act=(s,a)=>{const n=actBattle(s,{unitId:'p',...a});assert.equal(n.lastError,null,n.lastError);return n;};
const shoot=s=>act(s,{type:'fire',targetId:'guard'});

test('default preparation retains the first-shot total and explicit authored zero removes the setup cost',()=>{
 const originals=defaultContentPackage().weapons;
 for(const [id,w]of Object.entries(WEAPONS)){
  const s=field({weapon:Number(id),weaponMetadata:undefined}),before=actionCosts(s,s.units[0]);assert.equal(before.fire,w.fireAP);assert.equal(before.ready,WEAPON_READY_AP[id]);assert.equal(before.discharge,w.fireAP-WEAPON_READY_AP[id]);
  const n=shoot(s);assert.equal(n.units[0].weaponReady,true);assert.equal(actionCosts(n,n.units[0]).fire,before.discharge);
  const zero=field({weapon:Number(id),weaponMetadata:weaponMetadata({...originals.find(d=>d.template===Number(id)),readyAP:0})});assert.equal(actionCosts(zero,zero.units[0]).ready,0);assert.equal(actionCosts(zero,zero.units[0]).fire,w.fireAP);
  const fired=shoot(zero);assert.equal(actionCosts(fired,fired.units[0]).fire,w.fireAP);
 }
});

test('two actual discharges pay authored preparation once and conserve finite charges through a snapshot',()=>{
 const s=field(),copy=structuredClone(s),descriptor=b=>orderDescriptors(b,b.units[0]).find(d=>d.id==='fire');assert.match(descriptor(s).detail,/Preparar: 7 PA · disparar: 13 PA/);
 const first=shoot(s);assert.deepEqual(s,copy);assert.equal(first.units[0].ap,80);assert.equal(first.units[0].loaded,2);assert.equal(first.units[0].weaponReady,true);
 const restored=validateBattleSnapshot(JSON.parse(JSON.stringify(first)));assert.match(descriptor(restored).detail,/posición de tiro/);assert.equal(descriptor(restored).pa,13);
 const second=shoot(restored);assert.equal(second.units[0].ap,67);assert.equal(second.units[0].loaded,1);assert.equal(second.units[0].ammo,6);assert.equal(second.units[0].weaponReady,true);
 const next=endTurn(second);assert.equal(next.units[0].weaponReady,true);assert.equal(actionCosts(next,next.units[0]).fire,13);
 // Ability discounts cannot make discharge free or negative.
 const discounted=field({weaponMetadata:weaponMetadata(definition({fireAP:3,readyAP:2})),abilities:['quick_shot']});assert.equal(actionCosts(discounted,discounted.units[0]).fire,1);const fired=shoot(discounted);assert.equal(actionCosts(fired,fired.units[0]).fire,1);
});

test('accepted physical work lowers the weapon, while unavailable orders and free covering orders preserve it',()=>{
 const base=shoot(field({medical:80,medkits:5})),maintenance=shoot(field({medical:80,medkits:5,toolkitPoints:1}));
 for(const action of [{type:'move',x:2,y:1},{type:'reload'},{type:'stance',stance:'prone'},{type:'weapon',slot:'blade'},{type:'repair'},{type:'weapon',slot:'medical'}]){
  const s=structuredClone(action.type==='repair'?maintenance:base);s.units[0].ap=100;s.units[0].hp=80;s.units[0].bleeding=3;const n=act(s,action);assert.equal(n.units[0].weaponReady,undefined,action.type);if(action.type==='repair'){assert.equal(n.units[0].condition,100);assert.equal(n.units[0].toolkitPoints,0);}if(n.units[0].activeSlot==='primary')assert.equal(actionCosts(n,n.units[0]).ready,7);
 }
 for(const action of [{type:'fire',targetId:'missing'},{type:'move',x:-1,y:0},{type:'weapon',slot:'missing'},{type:'reload'}]){const s=structuredClone(base);s.units[0].ap=0;const n=actBattle(s,{unitId:'p',...action});assert.ok(n.lastError);assert.deepEqual(n.units,s.units);}
 const covered=act(base,{type:'overwatch'});assert.equal(covered.units[0].weaponReady,true);assert.equal(covered.units[0].ap,base.units[0].ap);const unprepared=act(field(),{type:'overwatch'});assert.equal(unprepared.units[0].weaponReady,undefined);
});

test('an actual misfire keeps its paid preparation and charge, but paid repriming lowers the gun',()=>{
 let s=field();s.seed=1;s.weather={rain:100,humidity:100};const first=shoot(s);assert.equal(first.units[0].jammed,true);assert.equal(first.units[0].loaded,3);assert.equal(first.units[0].weaponReady,true);assert.equal(first.units[0].ap,80);
 const fixed=act(first,{type:'reprime'});assert.equal(fixed.units[0].weaponReady,undefined);assert.equal(fixed.units[0].loaded,3);assert.equal(fixed.units[0].priming,undefined);assert.equal(actionCosts(fixed,fixed.units[0]).fire,20);
});

test('readiness is an actor position, absent from recovered guns and reset on a new deployment',()=>{
 let s=shoot(field({},[{id:'receiver',x:1,y:2,weapon:1809}]));assert.equal(weaponRecord(s.units[0]).weaponReady,undefined);
 const fresh=createBattle([s.units[0]],{width:12,height:8,tiles:tiles(),enemies:[],exploration:true});assert.equal(fresh.units[0].weaponReady,undefined);
 // A prepared casualty isolates the ordinary paid collection and equip paths.
 s.units[0].hp=0;refreshMilitaryCondition(s.units[0]);assert.equal(s.units[0].weaponReady,undefined);s=act(s,{type:'loot',unitId:'receiver',targetId:'p',item:'weapon'});const receiver=s.units.find(u=>u.id==='receiver'),[key,gun]=Object.entries(receiver.inventory).find(([,r])=>r.weapon===1808);assert.equal(gun.loaded,2);assert.equal(gun.weaponReady,undefined);
 s=act(s,{type:'equipLoot',unitId:'receiver',inventoryKey:key});const held=s.units.find(u=>u.id==='receiver');assert.equal(held.weaponReady,undefined);assert.equal(held.loaded,2);assert.equal(actionCosts(s,held).fire,20);assert.ok(validateBattleSnapshot(s));
});

test('incapacity removes readiness and impossible ready snapshots are rejected rather than normalized',()=>{
 const base=shoot(field());for(const patch of [{hp:0},{hp:14},{energy:0},{knockedDown:true},{routed:true},{weaponDropped:true}]){const u={...base.units[0],...patch};refreshMilitaryCondition(u);assert.equal(u.weaponReady,undefined);}
 for(const patch of [{weaponReady:'true'},{weaponReady:null},{activeSlot:'blade'},{hp:14},{energy:0},{knockedDown:true},{routed:true},{weaponDropped:true},{surrendered:true},{departure:true}]){const bad=structuredClone(base);Object.assign(bad.units[0],patch);assert.throws(()=>validateBattleSnapshot(bad));}
});

test('enemy firing uses the same authored preparation and spends only the available AP',()=>{
 let s=field({hp:1000,maxHp:1000});Object.assign(s.units[1],{weapon:1808,weaponMetadata:weaponMetadata(definition({fireAP:60,readyAP:30})),loaded:3,ammo:0});s=endTurn(s);for(let i=0;s.phase!=='player'&&s.status==='active'&&i<20;i++){s=endTurn(s);assert.equal(s.lastError,null);}const enemy=s.units.find(u=>u.id==='guard');assert.equal(enemy.loaded,2);assert.equal(enemy.ap,28);assert.equal(actionCosts(s,enemy,s.units[0]).fire,30);assert.ok(enemy.ap<actionCosts(s,enemy,s.units[0]).fire,'four paid aim steps leave too little AP for a second discharge');assert.equal(enemy.weaponReady,true);assert.ok(validateBattleSnapshot(s));
});

test('a paid campaign saves the actual firing position and resumes the same cheaper discharge',()=>{
 const d=defaultContentPackage(),gun=definition();d.weapons.push(gun);Object.assign(d.characters.find(c=>c.id==='person-110'),{weapon:gun.id,arrivalHours:0});let s=order(initialCampaign(45,d),{type:'recruitCivic',id:110,term:'week'});s=order(s,{type:'attack',sector:'buenos_aires'});const r=s.pendingBattle;
 // Real paid deployment, compact barrier geometry for the active-save boundary.
 let b=createBattle(r.squad.map(u=>({...u,x:1,y:1})),{...r,width:12,height:8,tiles:tiles(),seed:45,enemies:[{id:'guard',x:7,y:1,hp:1000,maxHp:1000,weapon:1813,ammo:0,patrol:false,overwatch:false}],npcs:(r.npcs??[]).map((n,i)=>({...n,x:8+i%3,y:4+Math.floor(i/3)}))});b=act(b,{type:'fire',unitId:'110',targetId:'guard'});assert.equal(b.units[0].weaponReady,true);const pair=sync({campaign:s,battle:b}),restored=saved(pair);assert.equal(restored.campaign.resources.treasury,pair.campaign.resources.treasury);assert.equal(actionCosts(restored.battle,restored.battle.units[0]).fire,13);
 const next={type:'fire',unitId:'110',targetId:'guard'};assert.deepEqual(actBattle(restored.battle,next),actBattle(pair.battle,next));const wire=JSON.parse(encodeSave(pair.campaign,pair.battle));wire.battle.units[0].weaponReady='true';assert.throws(()=>decodeSave(JSON.stringify(wire)));
});


test('exploration fire pays the actual displayed seconds for preparation and held discharge without combat AP',()=>{
 let b=createBattle([{id:'p',name:'Tirador',x:1,y:1,weapon:1808,weaponMetadata:weaponMetadata(definition({fireAP:40,readyAP:25})),ammo:6}],{width:12,height:8,tiles:tiles(),seed:45,exploration:true,enemies:[],npcs:[{id:'resident',name:'Habitante',x:7,y:1,hp:100,maxHp:100,energy:100}]});const descriptor=s=>orderDescriptors(s,s.units[0]).find(d=>d.id==='fire');assert.equal(b.mode,'exploration');assert.equal(descriptor(b).seconds,3);assert.doesNotMatch(descriptor(b).detail,/PA/);
 b=act(b,{type:'fire',targetId:'resident'});assert.equal(b.elapsedSeconds,3);assert.equal(b.units[0].ap,100);assert.equal(b.units[0].loaded,2);assert.equal(b.units[0].weaponReady,true);assert.equal(descriptor(b).seconds,1);assert.match(descriptor(b).detail,/posición de tiro/);
 b=act(b,{type:'fire',targetId:'resident'});assert.equal(b.elapsedSeconds,4);assert.equal(b.units[0].ap,100);assert.equal(b.units[0].loaded,1);assert.equal(b.units[0].ammo,6);assert.ok(validateBattleSnapshot(b));
});
