import {withCarriedAmmo} from './commerce-gear-fixture.mjs';
import {addAmmunition,weaponAmmoType} from '../game/ammunition-types.js';
import {syncUnitAmmunition,initializeUnitAmmunition} from '../game/tactical-ammunition.js';
import {setTestAmmunition} from './typed-ammunition-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,reloadCost,reloadPlan,planEquipLoot} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {targetPreview,tacticalInputAction,orderDescriptors} from '../game/ja2-hud.js';
import {extractItemQuantity,applyItemQuantity,validateItemStack} from '../game/tactical-inventory.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {playerKnownBattle} from '../game/player-known-state.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign} from '../game/campaign.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {syncBattleTime} from '../game/time.js';
import {enterSector} from '../game/world.js';
const grid=(width=32,height=8)=>Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0}));
const field=(unit={},options={})=>createBattle([{id:'p',name:'Tirador',x:1,y:1,weapon:1802,loaded:0,ammo:3,...unit}],{width:32,height:8,tiles:grid(),enemies:[{id:'e',x:30,y:6,patrol:false,weapon:1813,loaded:0,ammo:0}],seed:45,...options});
const act=(s,a)=>{const n=actBattle(s,{unitId:'p',...a});assert.equal(n.lastError,null,n.lastError);return n;};
const load=s=>act(s,{type:'reload'});
const retainContact=s=>{s.units[1].x=12;for(const t of s.tiles)if(Math.abs(t.x-12)<=1&&Math.abs(t.y-6)<=1&&(t.x!==12||t.y!==6)){t.blocked=true;t.blocksSight=false;}return s;};
const physical=s=>({...s,log:[],lastError:null});

test('a wounded soldier finishes a Baker reload over real turns without gaining AP or cartridges',()=>{
 let s=retainContact(field({hp:20,maxHp:100,bandaged:80,energy:30,fatigue:90,medical:0})),spent=0,turns=0;
 assert.ok(s.units[0].maxAP+20<70);
 while(!s.units[0].loaded&&turns<10){
  const u=s.units[0],before=structuredClone(s),plan=reloadPlan(u,s),preview=targetPreview(s,u,null,{mode:'fire'});
  assert.equal(preview.valid,true);assert.equal(preview.pa,plan.pa);
  s=load(s);spent+=u.ap-s.units[0].ap;turns++;
  assert.deepEqual(before.units[0],u);assert.equal(s.units[0].loaded+s.units[0].ammo,3);
  assert.equal(s.units[0].priming,undefined);
  assert.doesNotThrow(()=>validateBattleSnapshot(s));
  if(!s.units[0].loaded){assert.equal(s.units[0].ap,0);assert.ok(s.units[0].reloadProgress>0);s=endTurn(s);}
 }
 assert.ok(turns>1&&turns<10);assert.equal(spent,70);assert.equal(s.units[0].loaded,1);assert.equal(s.units[0].ammo,2);assert.equal(s.units[0].reloadProgress,undefined);
});

test('partial work changes the cursor and order cost; an empty firing click performs only the remaining reload',()=>{
 let s=field();s.units[0].ap=25;
 const preview=targetPreview(s,s.units[0],null,{mode:'fire',aim:4});assert.equal(preview.actionLabel,'Recarga parcial');assert.equal(preview.pa,25);assert.equal(preview.rounds,0);assert.equal(preview.remainingReloadPA,45);
 const order=orderDescriptors(s,s.units[0]).find(o=>o.id==='reload');assert.equal(order.pa,25);assert.equal(order.disabled,false);
 s=load(s);assert.equal(reloadCost(s.units[0],s),45);assert.equal(playerKnownBattle(s).units.find(u=>u.id==='p').reloadProgress,s.units[0].reloadProgress);
 s.units[0].ap=60;const shot={type:'firePoint',x:5,y:1,aim:4};
 s=act(s,tacticalInputAction(s,s.units[0],shot));assert.equal(s.units[0].ap,15);assert.equal(s.units[0].loaded,1);assert.equal(s.units[0].ammo,2);assert.deepEqual(s.smoke,[]);
});

test('each completed barrel becomes usable and consumes exactly one cartridge',()=>{
 let s=field({weapon:1808,ammo:2});s.units[0].ap=30;s=load(s);
 assert.equal(s.units[0].loaded,1);assert.equal(s.units[0].ammo,1);assert.ok(s.units[0].reloadProgress>0);assert.equal(reloadCost(s.units[0],s),25);
 s.units[0].ap=25;s=load(s);assert.equal(s.units[0].loaded,2);assert.equal(s.units[0].ammo,0);assert.equal(s.units[0].reloadProgress,undefined);
 assert.equal(reloadCost(s.units[0],s),0);
});

test('a completed barrel can fire while unfinished work stays with the other barrel',()=>{
 let s=field({weapon:1808,ammo:2});s.units[0].ap=30;s=load(s);const progress=s.units[0].reloadProgress;
 s.units[0].ap=40;s=act(s,{type:'firePoint',x:4,y:1});assert.equal(s.units[0].loaded,0);assert.equal(s.units[0].ammo,1);assert.equal(s.units[0].reloadProgress,progress);
 s=load(s);assert.equal(s.units[0].loaded,1);assert.equal(s.units[0].ammo,0);assert.equal(s.units[0].reloadProgress,undefined);
});

test('one reserve cartridge cannot start work on a second barrel',()=>{
 let s=field({weapon:1808,ammo:1});s.units[0].ap=100;s=load(s);
 assert.equal(s.units[0].loaded,1);assert.equal(s.units[0].ammo,0);assert.equal(s.units[0].ap,72);assert.equal(s.units[0].reloadProgress,undefined);
});

test('posture and helper changes apply only to the unfinished fraction',()=>{
 let s=field();s.units[0].ap=35;s=load(s);assert.equal(s.units[0].reloadProgress,.5);
 const u=s.units[0];u.stance='prone';assert.equal(reloadCost(u,s),53);
 u.stance='standing';u.traits=['gunsmith_artillerist'];assert.equal(reloadCost(u,s),30);
 s.units.push({...structuredClone(u),id:'2',x:2,y:1,loaded:1,traits:[]});delete s.units[2].reloadProgress;
 assert.equal(reloadCost(u,s),24);u.ap=24;s=load(s);assert.equal(s.units[0].loaded,1);assert.equal(s.units[0].ammo,2);
});

test('zero AP, wrong hand, knockdown, unconsciousness, jam and wrong turn reject without consuming work',()=>{
 let base=field();base.units[0].ap=20;base=load(base);
 for(const change of [s=>s.units[0].ap=0,s=>s.units[0].activeSlot='blade',s=>s.units[0].knockedDown=true,s=>{s.units[0].energy=0;s.units[0].unconscious=true;},s=>s.units[0].jammed=true,s=>s.phase='enemy']){
  const s=structuredClone(base);s.units[0].ap=20;change(s);const n=actBattle(s,{type:'reload',unitId:'p'});assert.ok(n.lastError);assert.deepEqual(physical(n),physical(s));
 }
});

test('removing reserve cartridges blocks loading without erasing previous work',()=>{
 let s=field();s.units[0].ap=20;s=load(s);s.units[0].ap=30;s=act(s,{type:'drop',item:'inventory:ammo:rifle_62',count:3});
 const before=structuredClone(s);assert.equal(targetPreview(s,s.units[0],null,{mode:'fire'}).cursor,'empty');
 const blocked=actBattle(s,{type:'reload',unitId:'p'});assert.ok(blocked.lastError);assert.deepEqual(physical(blocked),physical(before));
 s=act(s,{type:'loot',groundId:s.groundItems[0].id,item:'inventory:ammo:rifle_62',count:1});s.units[0].ap=50;s=load(s);assert.equal(s.units[0].loaded,1);assert.equal(s.units[0].ammo,0);
});

test('progress follows paid drops and recovery and cannot remain on the emptied hand',()=>{
 let s=field();s.units[0].ap=20;s=load(s);const progress=s.units[0].reloadProgress;s.units[0].ap=80;
 s=act(s,{type:'drop',item:'primary'});assert.equal(s.units[0].reloadProgress,undefined);assert.equal(s.groundItems[0].reloadProgress,progress);
 s=act(s,{type:'loot',groundId:s.groundItems[0].id,item:'weapon'});const key=Object.keys(s.units[0].inventory).find(k=>s.units[0].inventory[k].weapon===1802);assert.equal(s.units[0].inventory[key].reloadProgress,progress);
 s=act(s,{type:'equipLoot',inventoryKey:key});assert.equal(s.units[0].reloadProgress,progress);assert.equal(reloadCost(s.units[0],s),50);
 assert.doesNotThrow(()=>validateBattleSnapshot(s));
});

test('swapping and passing pack weapons preserve each gun own progress',()=>{
 const s=field(),original=s.units[0];original.reloadProgress=.5;original.inventory={pistol:{weapon:1808,loaded:0,reloadProgress:.25,condition:80,jammed:false,count:1,weight:1.3}};
 const swapped=planEquipLoot(original,'pistol');assert.equal(swapped.reloadProgress,.25);const stored=Object.entries(swapped.inventory).find(([,r])=>r.weapon===1802);assert.equal(stored[1].reloadProgress,.5);
 const extracted=extractItemQuantity(swapped,`inventory:${stored[0]}`);const receiver=applyItemQuantity({...original,id:'receiver',inventory:{}},extracted.stack);
 const received=planEquipLoot(receiver,Object.keys(receiver.inventory)[0]);assert.equal(received.reloadProgress,.5);assert.equal(received.weapon,1802);assert.equal(swapped.weapon,1808);
});

test('validators reject corrupt progress on units, empty hands, full guns and nonweapon stacks',()=>{
 for(const value of [0,1,-.5,NaN,Infinity,'0.5',{},null]){const s=field();s.units[0].reloadProgress=value;assert.throws(()=>validateBattleSnapshot(s));}
 for(const patch of [{loaded:1},{weaponDropped:true},{weapon:1813}]){const s=field();Object.assign(s.units[0],{reloadProgress:.5},patch);assert.throws(()=>validateBattleSnapshot(s));}
 for(const stack of [{item:'ammo',count:1,reloadProgress:.5},{item:'inventory:cloth',count:1,weight:0,reloadProgress:.5},{item:'weapon',weapon:1802,loaded:1,count:1,weight:4,reloadProgress:.5}])assert.throws(()=>validateItemStack(stack));
});

test('AI uses remaining AP for unfinished loading but can still kneel to complete a prone reload',()=>{
 const s=field();const e=s.units[1];Object.assign(e,{weapon:1802,loaded:0,ammo:2,ap:20,hp:20,bandaged:80,energy:30,fatigue:90});setTestAmmunition(e,2);assert.equal(chooseEnemyAction(s,e).type,'reload');
 Object.assign(e,{stance:'prone',ap:100,hp:100,bandaged:0,energy:100,fatigue:0});assert.deepEqual(chooseEnemyAction(s,e),{type:'stance',unitId:'e',stance:'crouched'});
});

test('an enemy partial reload can trigger a saved player interrupt and does not replay its spent work',()=>{
 const s=createBattle([{id:'p',x:5,y:2,facing:0,agility:100}],{width:12,height:8,tiles:grid(12),seed:45,enemies:[{id:'e',x:5,y:5,facing:0,loaded:0,ammo:2,weapon:1802,ap:20,hp:20,bandaged:80,energy:30,fatigue:90}]});s.units[1].ap=20;
 const n=endTurn(s);assert.equal(n.phase,'interrupt');assert.equal(n.units[1].ap,0);assert.equal(n.units[1].loaded,0);assert.equal(n.units[1].ammo,2);assert.ok(n.units[1].reloadProgress>0);
 const restored=validateBattleSnapshot(JSON.parse(JSON.stringify(n)));assert.deepEqual(endTurn(restored),endTurn(n));assert.equal(endTurn(n).units[1].reloadProgress,n.units[1].reloadProgress);
});

test('full campaign save resumes partial work and pack work survives report and reentry',()=>{
 let c=initialCampaign(45);c.hour=12;c.loadouts[3]={weapon:1802,blade:1813};c.loadouts[4]={weapon:1802,blade:1813};c=withCarriedAmmo(withCarriedAmmo(c,3,'ammoRifle',9),4,'ammoRifle',9);c=dispatchCampaign(c,{type:'visitSector'});assert.equal(c.lastError,null);const r=c.pendingBattle;r.enemies=[{id:'e',x:5,y:6,hp:15,bandaged:85,patrol:false,weapon:1813,loaded:0,ammo:0,agility:0,overwatch:false}];r.enemies.forEach(u=>initializeUnitAmmunition(u));
 let b=createBattle(r.squad.map((u,i)=>{const actor={...structuredClone(u),x:1,y:1+i};if(i===0){if(actor.loaded)addAmmunition(actor,weaponAmmoType(actor.weapon),actor.loaded);actor.loaded=0;syncUnitAmmunition(actor);}return actor;}),{...r,width:32,height:8,tiles:grid(),exploration:false,enemies:r.enemies});
 const id=b.units[0].id;b.units[0].ap=20;b=actBattle(b,{type:'reload',unitId:id});assert.equal(b.lastError,null);
 const pair=syncBattleTime(c,b);assert.equal(pair.error,null);const saved=decodeSave(encodeSave(pair.campaign,pair.battle));assert.deepEqual(saved.battle,pair.battle);
 saved.battle=actBattle(saved.battle,{type:'fire',unitId:'4',targetId:'e',aim:4});assert.equal(saved.battle.lastError,null);assert.equal(saved.battle.status,'victory');
 saved.battle=actBattle(saved.battle,{type:'explore'});assert.equal(saved.battle.lastError,null);
 const dropped=actBattle(saved.battle,{type:'drop',unitId:id,item:'primary'});const picked=actBattle(dropped,{type:'loot',unitId:id,groundId:dropped.groundItems[0].id,item:'weapon'});assert.equal(picked.lastError,null);
 const current=syncBattleTime(saved.campaign,picked);assert.equal(current.error,null);
 const returned=dispatchCampaign(current.campaign,{type:'leaveSector',battleId:r.id,sectorState:current.battle,survivors:current.battle.units.filter(u=>u.side==='player')});assert.equal(returned.lastError,null,returned.lastError);
 const resumed=decodeSave(encodeSave(returned)).campaign;const visit=dispatchCampaign(resumed,{type:'visitSector'});assert.equal(visit.lastError,null);
 const entered=enterSector(visit.pendingBattle,visit.sectorStates.retiro);const unit=entered.units.find(u=>u.id===id),entry=Object.entries(unit.inventory).find(([,r])=>r.weapon===1802);assert.equal(entry[1].reloadProgress,b.units[0].reloadProgress);
 const supplied=actBattle(entered,{type:'transfer',unitId:'4',targetId:id,item:'inventory:ammo:rifle_62',count:1});assert.equal(supplied.lastError,null);
 const equipped=planEquipLoot(supplied.units.find(u=>u.id===id),entry[0]);assert.equal(reloadCost(equipped,supplied),50);
});

test('exploration finishes saved work in the remaining time without spending AP twice',()=>{
 let s=field();s.units[0].ap=35;s=load(s);s.mode='exploration';s.units[0].ap=7;const elapsed=s.elapsedSeconds;
 s=load(s);assert.equal(s.elapsedSeconds-elapsed,3);assert.equal(s.units[0].ap,7);assert.equal(s.units[0].loaded,1);assert.equal(s.units[0].ammo,2);assert.equal(s.units[0].reloadProgress,undefined);assert.doesNotMatch(s.log.at(-1),/\d+ PA/);assert.match(s.log.at(-1),/recarga/);
});

test('autonomous wounded militia finish loading across their own turns',()=>{
 let s=retainContact(field());s.units.push({...structuredClone(s.units[0]),id:'m',militia:true,x:1,y:4,hp:20,maxHp:100,bandaged:80,energy:30,fatigue:90,medical:0,ap:15});
 for(let i=0;i<8&&!s.units[2].loaded;i++){
  s=endTurn(s);const m=s.units.find(u=>u.id==='m');assert.equal(m.loaded+m.ammo,3);assert.doesNotThrow(()=>validateBattleSnapshot(s));
  if(i===0){assert.equal(m.loaded,0);assert.ok(m.reloadProgress>0);}
 }
 const m=s.units.find(u=>u.id==='m');assert.equal(m.loaded,1);assert.equal(m.ammo,2);assert.equal(m.reloadProgress,undefined);
});
