import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,presentedEndTurn,firearmMaintenancePreview} from '../game/tactical.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {chooseOwnedFirearmRepair} from '../game/tactical-ai-repair.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {repairMaterialPoints} from '../game/repair-materials.js';
import {handRecord} from '../game/tactical-inventory.js';
const kit=(points=30,id='owned-kit')=>({kind:'repair-kit',name:'Juego de herramientas',count:1,weight:2,repairPoints:points,instanceId:id});
const actor=s=>s.units.find(u=>u.id==='mechanic');
const saved=s=>validateBattleSnapshot(JSON.parse(JSON.stringify(s)));
function field(patch={},visible=false){
 const s=createBattle([{id:'p',x:visible?9:1,y:visible?3:1,facing:2,weapon:1805,loaded:0,ammo:0,medical:0,medkits:0,patrol:false}],{width:16,height:8,seed:45,tiles:Array.from({length:128},(_,i)=>({x:i%16,y:Math.floor(i/16),type:i%16===8?'wall':'grass',blocked:i%16===8,blocksSight:i%16===8,cover:0})),enemies:[{id:'mechanic',name:'Mecánico',x:12,y:3,facing:2,weapon:1800,weaponInstanceId:'owned-broken-gun',condition:0,loaded:1,ammo:3,mechanical:60,medical:0,medkits:0,inventory:{tools:kit()},patrol:false,overwatch:false,...patch}]});s.units[0].ap=0;actor(s).ap=patch.ap??41;return saved(s);
}
const repair={type:'repair',unitId:'mechanic'};
const gear=u=>Object.fromEntries(['weapon','weaponInstanceId','loaded','ammo','reloadProgress','jammed','offHand','weaponMetadata','contentWeapon','ammunitionChoice','weaponFittings','weaponFittingPattern','x','y','stance','mounted'].map(k=>[k,u[k]]));

test('an actual enemy turn restores its owned broken loaded primary with one finite paid stroke',()=>{
 const s=field(),before=structuredClone(s),old=gear(actor(s));assert.deepEqual(chooseEnemyAction(s,actor(s)),repair);assert.deepEqual(s,before);
 const n=endTurn(s);assert.equal(n.lastError,null);assert.equal(actor(n).condition,30);assert.equal(actor(n).ap,16);assert.equal(repairMaterialPoints(actor(n)),0);assert.equal(actor(n).inventory.tools,undefined);assert.deepEqual(gear(actor(n)),old);assert.equal(n.turn,2);assert.equal(n.elapsedSeconds,6);assert.deepEqual(n,endTurn(saved(s)));assert.doesNotThrow(()=>saved(n));assert.deepEqual(s,before);
});

test('visible recording has separate paid repair prepare/result while unseen work stays private',()=>{
 for(const visible of [false,true]){const s=field({},visible),before=structuredClone(s),r=presentedEndTurn(s);assert.deepEqual(r.state,endTurn(s));assert.deepEqual(r.state,endTurn(saved(s)));assert.deepEqual(s,before);
  if(visible){assert.deepEqual(r.frames.map(f=>[f.type,f.action,f.unitId]),[['prepare','repair','mechanic'],['result','repair','mechanic']]);assert.deepEqual(r.frames.map(f=>[actor(f.state).ap,actor(f.state).condition,repairMaterialPoints(actor(f.state))]),[[41,0,30],[16,30,0]]);}
  else{assert.deepEqual(r.frames,[]);assert.ok(!r.state.log.some(line=>/Mecánico|mecanismo|ajusta/.test(line)));}
 }
});

test('the ordinary trait AP and condition caps bound owned kit spending without a second stroke',()=>{
 for(const [traits,pa,gain] of [[[],25,30],[['workshop_training'],25,40],[['gunsmith_artillerist'],18,45]]){
  const s=field({traits,inventory:{tools:kit(100)},ap:pa}),short=field({traits,inventory:{tools:kit(100)},ap:pa-1});assert.equal(chooseOwnedFirearmRepair(short,actor(short)),null);assert.deepEqual(chooseEnemyAction(s,actor(s)),repair);
  const n=endTurn(s);assert.equal(actor(n).ap,0);assert.equal(actor(n).condition,gain);assert.deepEqual(actor(n).inventory.tools,{...actor(s).inventory.tools,repairPoints:100-gain});assert.equal(actor(n).loaded,1);assert.deepEqual(n,endTurn(saved(s)));assert.equal(chooseOwnedFirearmRepair(n,actor(n)),null);
 }
 const roomy=field({inventory:{tools:kit(100)}}),r=presentedEndTurn(roomy);assert.equal(actor(r.state).condition,30);assert.equal(actor(r.state).inventory.tools.repairPoints,70);assert.equal(actor(r.state).ap,16);assert.equal(r.frames.length,0);
});

test('a partial physical kit and current reserve-first material order retain all exact identities',()=>{
 const partial=field({inventory:{tools:kit(7,'last-seven')}}),n=endTurn(partial);assert.equal(actor(n).condition,7);assert.equal(actor(n).loaded,1);assert.equal(repairMaterialPoints(actor(n)),0);assert.equal(actor(n).inventory.tools,undefined);
 const s=field({toolkitPoints:5,inventory:{a:kit(13,'first-kit'),b:kit(20,'second-kit')},leftHandItem:'inventory:a'}),old=gear(actor(s)),next=endTurn(s);assert.equal(actor(next).condition,30);assert.equal(actor(next).toolkitPoints,0);assert.equal(actor(next).inventory.a,undefined);assert.equal(actor(next).leftHandItem,null);assert.deepEqual(actor(next).inventory.b,{...actor(s).inventory.b,repairPoints:8});assert.deepEqual(gear(actor(next)),old);assert.deepEqual(next,endTurn(saved(s)));
});

test('saved loading, both held pistols and owned fittings remain exact during the primary repair',()=>{
 const s=field({weapon:1808,loaded:1,reloadProgress:.375,ap:25,offHand:{weapon:1805,count:1,weight:1,loaded:0,reloadProgress:.25,condition:0,instanceId:'broken-other',fittings:{}},inventory:{tools:kit(9)}}),oldMain=handRecord(actor(s),'primary'),oldOther=handRecord(actor(s),'offhand');
 const n=endTurn(s);assert.equal(actor(n).condition,9);assert.equal(actor(n).reloadProgress,.375);assert.equal(actor(n).loaded,1);assert.deepEqual(handRecord(actor(n),'offhand'),oldOther);assert.deepEqual({...handRecord(actor(n),'primary'),condition:0},oldMain);assert.deepEqual(n,endTurn(saved(s)));
});

test('legacy reserve alone, another actor kit and unavailable own gear cannot supply the new choice',()=>{
 for(const patch of [{inventory:{},toolkitPoints:30},{inventory:{},toolkitPoints:0},{activeSlot:'blade',blade:1813},{weaponDropped:true},{loaded:0},{jammed:true},{condition:1},{condition:100}]){const s=field(patch),before=structuredClone(s);assert.equal(chooseOwnedFirearmRepair(s,actor(s)),null,JSON.stringify(patch));assert.deepEqual(s,before);}
 const s=field({inventory:{}});s.units.push({...structuredClone(actor(s)),id:'ally',x:13,inventory:{tools:kit(30,'ally-only')},ap:0});const before=structuredClone(s);assert.equal(chooseEnemyAction(s,actor(s)),null);const n=endTurn(s);assert.equal(actor(n).condition,0);assert.equal(n.units.find(u=>u.id==='ally').inventory.tools.instanceId,'ally-only');assert.equal(n.units.find(u=>u.id==='ally').inventory.tools.repairPoints,30);assert.deepEqual(s,before);
});

test('malformed direct physical kit diagnostics reject without reading or spending a substitute reserve',()=>{
 for(const patch of [{count:0},{count:2},{repairPoints:0},{repairPoints:1.5},{repairPoints:101},{weight:0},{weapon:1805}]){const s=field();Object.assign(actor(s).inventory.tools,patch);actor(s).toolkitPoints=30;const before=structuredClone(s);assert.equal(chooseOwnedFirearmRepair(s,actor(s)),null,JSON.stringify(patch));assert.deepEqual(s,before);}
});

test('owned care, a useful carried gun and an immediate melee threat retain their existing priority',()=>{
 const care=field({hp:40,bleeding:2,medical:60,medkits:1});assert.deepEqual(chooseEnemyAction(care,actor(care)),{type:'weapon',unitId:'mechanic',slot:'medical'});const cared=endTurn(care);assert.equal(actor(cared).bleeding,0);assert.equal(actor(cared).condition,0);assert.equal(repairMaterialPoints(actor(cared)),30);
 const backup=field({weapon:1805,offHand:{weapon:1806,count:1,weight:1,condition:100,loaded:1,instanceId:'ready-other'}});assert.equal(chooseEnemyAction(backup,actor(backup)).type,'swapHands');
 const melee=field();melee.tiles.forEach(t=>Object.assign(t,{type:'grass',blocked:false,blocksSight:false}));melee.wallEdges=[];Object.assign(melee.units[0],{x:13,y:3,hp:1000,maxHp:1000});assert.equal(chooseEnemyAction(melee,actor(melee)).type,'melee');
 const down=field({knockedDown:true});assert.equal(chooseEnemyAction(down,actor(down)).type,'stance');const bound=field({entangled:true});assert.equal(chooseEnemyAction(bound,actor(bound)).type,'free');
});

test('opposing private gun and inventory getters cannot influence owned repair admission',()=>{
 for(const visible of [false,true]){const s=field({},visible),opponent=s.units[0];for(const name of ['condition','inventory','ammo','loaded','jammed'])Object.defineProperty(opponent,name,{get(){throw Error('private opposing '+name);},enumerable:false,configurable:true});assert.deepEqual(chooseOwnedFirearmRepair(s,actor(s)),repair);assert.deepEqual(chooseEnemyAction(s,actor(s)),repair);}
});

test('public enemy orders and manual militia control remain refused while the trusted allied queue pays repair',()=>{
 const s=field(),denied=actBattle(s,repair);assert.ok(denied.lastError);assert.deepEqual(denied.units,s.units);assert.equal(denied.elapsedSeconds,s.elapsedSeconds);
 const friendly=field();for(const u of friendly.units)u.side=u.side==='enemy'?'player':'enemy';actor(friendly).militia=true;actor(friendly).x=10;actor(friendly).y=4;const m=saved(friendly),preview=firearmMaintenancePreview(m,actor(m)),n=endTurn(m);assert.equal(preview.valid,false);assert.match(preview.reason,/milicia/);assert.equal(chooseOwnedFirearmRepair(m,actor(m)),null);assert.equal(actor(n).condition,30);assert.equal(repairMaterialPoints(actor(n)),0);const refused=actBattle(m,repair);assert.match(refused.lastError,/milicia/);assert.deepEqual(refused.units,m.units);assert.equal(refused.elapsedSeconds,m.elapsedSeconds);
});

test('a real repair then shot pauses the enemy turn and saved continuation cannot repeat the repair or discharge',()=>{
 const s=field({x:6,weapon:1805,marksmanship:100,overwatch:true,experienceLevel:5});s.tiles.forEach(t=>Object.assign(t,{type:'grass',blocked:false,blocksSight:false}));s.wallEdges=[];Object.assign(s.units[0],{x:12,y:3,facing:6,ap:24,experienceLevel:1,agility:30});s.units.push({...structuredClone(s.units[0]),id:'observer',x:12,y:5,facing:2,ap:20,loaded:1,experienceLevel:10,agility:100});const b=saved(s),paused=endTurn(b);assert.equal(paused.lastError,null);assert.equal(paused.phase,'interrupt');assert.ok(paused.enemyTurn);assert.ok(paused.interrupt.unitIds.includes('observer'));assert.equal(repairMaterialPoints(actor(paused)),0);assert.ok(actor(paused).condition>0);assert.equal(actor(paused).loaded,0);const paid={ap:actor(paused).ap,condition:actor(paused).condition,ammo:actor(paused).ammo,materials:repairMaterialPoints(actor(paused))};const n=endTurn(saved(paused));assert.deepEqual(n,endTurn(paused));assert.deepEqual({ap:actor(n).ap,condition:actor(n).condition,ammo:actor(n).ammo,materials:repairMaterialPoints(actor(n))},paid);assert.equal(n.elapsedSeconds,6);assert.equal(n.turn,2);assert.equal(n.phase,'player');assert.equal(actor(n).loaded,0);assert.doesNotThrow(()=>saved(n));
});
