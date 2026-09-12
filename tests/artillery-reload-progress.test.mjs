import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,artilleryCosts,artilleryReloadPreview} from '../game/tactical.js';
import {orderDescriptors} from '../game/ja2-hud.js';
import {playerKnownBattle} from '../game/player-known-state.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign} from '../game/campaign.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {syncBattleTime} from '../game/time.js';
const tiles=()=>Array.from({length:320},(_,i)=>({x:i%40,y:Math.floor(i/40),type:'grass',cover:0,blocked:false}));
const field=(type='field8',wounded=false,exploration=false)=>createBattle([{id:20,x:1,y:2},{id:21,x:2,y:2},{id:22,x:1,y:3}].map(u=>({...u,...(wounded?{hp:20,maxHp:100,bandaged:80,energy:30,fatigue:90,medical:0}:{})})),{width:40,height:8,tiles:tiles(),seed:45,exploration,enemies:exploration?[]:[{id:'e',x:38,y:6,weapon:1813,ammo:0,loaded:0,patrol:false}],artillery:[{id:'gun',type,side:'player',x:2,y:3,loaded:false,ammo:3}]});
const preview=s=>artilleryReloadPreview(s,s.units[0],s.artillery[0]);
const order=(s,a={type:'artilleryReload'})=>actBattle(s,{unitId:'20',artilleryId:'gun',...a});
const physical=s=>({...s,log:[],lastError:null});
const rejected=(s,a)=>{const n=order(s,a);assert.ok(n.lastError);assert.deepEqual(physical(n),physical(s));};

test('wounded crews complete a heavy cannon load over real turns and spend 75 AP each in total',()=>{
 let s=field('field8',true),turns=0;const spent=[0,0,0];assert.ok(s.units[0].maxAP+20<75);
 while(!s.artillery[0].loaded&&turns<12){
  const before=structuredClone(s),p=preview(s);assert.equal(p.valid,true);s=order(s);assert.equal(s.lastError,null);
  for(let i=0;i<3;i++){assert.equal(before.units[i].ap-s.units[i].ap,p.pa);spent[i]+=p.pa;}
  assert.equal(s.artillery[0].ammo+Number(s.artillery[0].loaded),3);validateBattleSnapshot(s);turns++;
  if(!s.artillery[0].loaded){assert.ok(s.artillery[0].reloadProgress>0);s=endTurn(s);}
 }
 assert.ok(turns>1&&turns<12);assert.deepEqual(spent,[75,75,75]);assert.equal(s.artillery[0].ammo,2);assert.equal(s.artillery[0].reloadProgress,undefined);
});
test('the least available required crew member limits partial work and HUD cost',()=>{
 const s=field();s.units[0].ap=50;s.units[1].ap=20;s.units[2].ap=35;const p=preview(s);
 assert.equal(p.pa,20);assert.equal(p.remainingPA,55);assert.equal(p.partial,true);
 const button=orderDescriptors(s,s.units[0],{cannonId:'gun'}).find(d=>d.id==='artilleryReload');assert.equal(button.pa,20);assert.equal(button.disabled,false);
 const n=order(s);assert.equal(n.lastError,null);assert.deepEqual(n.units.slice(0,3).map(u=>u.ap),[30,0,15]);assert.equal(n.artillery[0].ammo,3);assert.equal(n.artillery[0].reloadProgress,20/75);
});
test('spare capable helpers take priority over an exhausted extra soldier',()=>{
 const s=field('bronze4');s.units[1].ap=1;const p=preview(s);assert.deepEqual(p.crew,['20','22']);assert.equal(p.pa,60);
 const n=order(s);assert.equal(n.lastError,null);assert.equal(n.artillery[0].loaded,true);assert.equal(n.units[1].ap,1);assert.equal(n.units[0].ap,40);assert.equal(n.units[2].ap,40);
});
test('each cannon keeps its own work, including after movement and changing leader',()=>{
 let s=field('bronze4');s.units[0].ap=20;s=order(s);const progress=s.artillery[0].reloadProgress;s.artillery.push({...s.artillery[0],id:'other',x:8,y:3,reloadProgress:.5});
 for(const u of s.units.slice(0,3))u.ap=100;s=order(s,{type:'artilleryMove',x:3,y:3});assert.equal(s.lastError,null);assert.equal(s.artillery[0].reloadProgress,progress);assert.equal(s.artillery[1].reloadProgress,.5);
 const replacement=s.units.find(u=>u.id==='21');const p=artilleryReloadPreview(s,replacement,s.artillery[0]);assert.equal(p.totalPA,40);
 s=actBattle(s,{unitId:'21',type:'artilleryReload',artilleryId:'gun'});assert.equal(s.lastError,null);assert.equal(s.artillery[0].loaded,true);assert.equal(s.artillery[0].ammo,2);assert.equal(s.artillery[1].reloadProgress,.5);
});
test('specialist rate changes affect only the remaining fraction',()=>{
 let s=field('bronze4');s.units[0].ap=30;s=order(s);assert.equal(s.artillery[0].reloadProgress,.5);
 s.units[0].traits=['gunsmith_artillerist'];s.units[0].ap=100;const cost=artilleryCosts(s,s.units[0],s.artillery[0]).reload;
 assert.equal(preview(s).totalPA,Math.ceil(cost*.5));const n=order(s);assert.equal(n.lastError,null);assert.equal(n.artillery[0].loaded,true);
});
test('partial work cannot fire, consume ammunition twice or reload a full cannon',()=>{
 let s=field('swivel');s.units[0].ap=10;s=order(s);assert.equal(s.artillery[0].loaded,false);s.units[0].ap=100;
 rejected(s,{type:'artillery',x:10,y:3});const p=preview(s);assert.equal(p.totalPA,25);s=order(s);assert.equal(s.artillery[0].ammo,2);rejected(s);
 s=order(s,{type:'artillery',x:10,y:3});assert.equal(s.lastError,null);assert.equal(s.artillery[0].loaded,false);assert.equal(preview(s).totalPA,35);
});
test('zero AP, missing ammunition, missing crew, wrong side, incapacitation and blocked access reject atomically',()=>{
 for(const change of [s=>s.units[0].ap=0,s=>s.artillery[0].ammo=0,s=>s.units[1].x=10,s=>s.artillery[0].side='enemy',s=>s.units[1].knockedDown=true,s=>s.units[1].unconscious=true,s=>s.units[1].mounted=true,s=>s.units[1].militia=true,s=>s.phase='enemy',s=>s.tiles.find(t=>t.x===2&&t.y===3).blocked=true]){
  const s=field();s.artillery[0].reloadProgress=.25;change(s);assert.equal(preview(s).valid,false);rejected(s);
 }
});
test('an interrupt can spend only the AP of its eligible crew',()=>{
 const s=field();s.phase='interrupt';s.interrupt={unitIds:['20'],enemyId:'e'};assert.equal(preview(s).valid,false);rejected(s);
 s.interrupt.unitIds.push('21','22');assert.equal(preview(s).valid,true);
});
test('without ammunition the retained work is unavailable but remains saveable',()=>{
 const s=field();s.artillery[0].reloadProgress=.4;s.artillery[0].ammo=0;assert.equal(preview(s).pa,0);assert.equal(preview(s).valid,false);rejected(s);validateBattleSnapshot(s);
});
test('exploration finishes remaining crew work once with exact time and no AP charge',()=>{
 const s=field('field8',false,true);s.artillery[0].reloadProgress=.4;for(const u of s.units)u.ap=0;
 const p=preview(s);assert.equal(p.valid,true);assert.equal(p.pa,45);const n=order(s);assert.equal(n.lastError,null);assert.equal(n.elapsedSeconds-s.elapsedSeconds,3);assert.ok(n.units.every(u=>u.ap===0));assert.equal(n.artillery[0].ammo,2);assert.equal(n.artillery[0].loaded,true);
});
test('all assigned artillery actions use one shared time charge and lower every crew weapon',()=>{
 const s=field('bronze4',false,true);s.artillery[0].loaded=true;for(const u of s.units){u.ap=0;u.weaponReady=true;}
 const n=order(s,{type:'artilleryPivot',x:10,y:3});assert.equal(n.lastError,null);assert.equal(n.elapsedSeconds,1);assert.equal(n.units[0].weaponReady,undefined);assert.equal(n.units[1].weaponReady,undefined);assert.equal(n.units[2].weaponReady,true);assert.ok(n.units.every(u=>u.ap===0));
});
test('save validation rejects invalid fractions and work attached to a loaded cannon',()=>{
 for(const value of [0,1,-.2,2,NaN,Infinity,'0.5',null,{}]){const s=field();s.artillery[0].reloadProgress=value;assert.throws(()=>validateBattleSnapshot(s));}
 const s=field();s.artillery[0].reloadProgress=.5;s.artillery[0].loaded=true;assert.throws(()=>validateBattleSnapshot(s));
});
test('player projection exposes own work without leaking an observed enemy cannon load',()=>{
 const s=field();s.artillery[0].reloadProgress=.4;s.artillery.push({...s.artillery[0],id:'enemy-gun',side:'enemy',x:3,y:2});
 const visible=playerKnownBattle(s);assert.equal(visible.artillery.find(g=>g.id==='gun').reloadProgress,.4);const enemy=visible.artillery.find(g=>g.id==='enemy-gun');assert.ok(enemy);assert.equal(enemy.reloadProgress,undefined);assert.equal(enemy.ammo,undefined);assert.equal(enemy.loaded,undefined);
});
test('full campaign encoding resumes the remaining cost and finite gun ammunition',()=>{
 let c=dispatchCampaign(initialCampaign(),{type:'travel',sector:'buenos_aires'});c=dispatchCampaign(c,{type:'attack',sector:'san_nicolas'});assert.equal(c.lastError,null);
 const r=c.pendingBattle;let b=createBattle(r.squad.map((u,i)=>({...u,x:1+i,y:2})),{...r,width:40,height:8,tiles:tiles(),enemies:[{id:'e',x:38,y:6,patrol:false}],artillery:[{id:'gun',type:'swivel',side:'player',x:1,y:3,loaded:false,ammo:3}]});
 const u=b.units[0];u.ap=10;b=actBattle(b,{type:'artilleryReload',artilleryId:'gun',unitId:u.id});assert.equal(b.lastError,null);const pair=syncBattleTime(c,b);assert.equal(pair.error,null);
 const saved=decodeSave(encodeSave(pair.campaign,pair.battle));assert.deepEqual(saved.battle.artillery,b.artillery);const restored=saved.battle;restored.units[0].ap=100;
 const p=artilleryReloadPreview(restored,restored.units[0],restored.artillery[0]);assert.equal(p.totalPA,25);const n=actBattle(restored,{type:'artilleryReload',artilleryId:'gun',unitId:u.id});assert.equal(n.lastError,null);assert.equal(n.artillery[0].loaded,true);assert.equal(n.artillery[0].ammo,2);
});
