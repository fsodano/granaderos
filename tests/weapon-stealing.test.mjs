import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,stealPreview,weaponFor} from '../game/tactical.js';
import {weaponStealChance,STEAL_MIN_AP} from '../game/unarmed-combat.js';
import {handRecord,inventoryUsage} from '../game/tactical-inventory.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {targetPreview,pickupTargetAction} from '../game/ja2-hud.js';
import {pointerItemIntent} from '../game/hotkeys.js';
import {playerKnownBattle} from '../game/player-known-state.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign} from '../game/campaign.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave,decodeSave} from '../game/save.js';
const grid=()=>Array.from({length:96},(_,i)=>({x:i%12,y:Math.floor(i/12),type:'grass',blocked:false,cover:0}));
function field(player={},enemy={},extra={}){
 const s=createBattle([{id:'p',x:1,y:1,weapon:1806,loaded:1,activeSlot:'unarmed',strength:100,dexterity:100,agility:100,experienceLevel:10,...player}],{width:12,height:8,tiles:grid(),enemies:[{id:'e',x:2,y:1,weapon:1800,condition:67,loaded:1,jammed:true,strength:10,dexterity:10,agility:10,experienceLevel:1,overwatch:false,patrol:false,morale:100,...enemy}],seed:45,...extra});
 s.units.find(u=>u.id==='e').ap=enemy.ap??0;return s;
}
const take=s=>actBattle(s,{type:'steal',unitId:s.units[0].id,targetId:'e'});
function rejected(s){const n=take(s);assert.ok(n.lastError);assert.deepEqual(n.units,s.units);assert.equal(n.seed,s.seed);assert.equal(n.elapsedSeconds,s.elapsedSeconds);}

test('successful conscious theft moves the exact loaded, worn, jammed fitted gun into the hand',()=>{
 const s=field({}, {weaponInstanceId:'taken-gun',weaponFittings:{bayonet:{weapon:1811,condition:43,fittingPattern:'india_socket',instanceId:'taken-fitting'}}}),old=handRecord(s.units[0],'primary'),taken=handRecord(s.units[1],'primary'),n=take(s);
 assert.equal(n.lastError,null);assert.deepEqual(handRecord(n.units[0],'primary'),taken);assert.equal(n.units[0].activeSlot,'primary');
 const stored=Object.values(n.units[0].inventory).find(v=>v.weapon===old.weapon);assert.deepEqual(stored,old);
 assert.equal(n.units[0].ap,0);assert.equal(n.units[0].energy,92);assert.equal(n.units[1].hp,100);assert.equal(n.units[1].loaded,0);assert.equal(n.units[1].weaponDropped,true);assert.equal(n.units[1].activeSlot,'unarmed');assert.deepEqual(n.units[1].weaponFittings,{});assert.equal(n.units[1].weaponInstanceId,undefined);
 assert.equal(n.units[1].ammo,s.units[1].ammo);assert.equal(n.units[0].ammo,s.units[0].ammo);assert.doesNotThrow(()=>validateBattleSnapshot(n));
 assert.deepEqual(n,take(validateBattleSnapshot(JSON.parse(JSON.stringify(s)))));
 const again=structuredClone(n);again.units[0].activeSlot='unarmed';again.units[0].ap=100;rejected(again);
});
test('a failed contested grab spends all remaining AP and energy but transfers no equipment',()=>{
 const s=field({strength:1,dexterity:1,agility:1,experienceLevel:1},{strength:100,dexterity:100,agility:100,experienceLevel:10});s.units[0].ap=41;
 assert.equal(weaponStealChance(s.units[0],s.units[1]),5);const n=take(s);assert.equal(n.lastError,null);assert.match(n.log.at(-1),/no logra/);assert.equal(n.units[0].ap,0);assert.equal(n.units[0].energy,92);
 for(let i=0;i<2;i++){assert.deepEqual(handRecord(n.units[i],'primary'),handRecord(s.units[i],'primary'));assert.deepEqual(n.units[i].inventory,s.units[i].inventory);}assert.notEqual(n.seed,s.seed);
});
test('the grab takes the selected blade, leaving the enemy primary and its contents intact',()=>{
 const s=field({}, {activeSlot:'blade',blade:1811,bladeCondition:34,bladeFittingPattern:'india_socket',bladeInstanceId:'loose-socket'}),gun=handRecord(s.units[1],'primary'),blade=handRecord(s.units[1],'blade'),n=take(s);
 assert.equal(n.lastError,null);assert.deepEqual(handRecord(n.units[0],'primary'),blade);assert.deepEqual(handRecord(n.units[1],'primary'),gun);assert.equal(n.units[1].blade,undefined);assert.equal(n.units[1].activeSlot,'unarmed');assert.doesNotThrow(()=>validateBattleSnapshot(n));
});
test('wrong hand, posture, missing held weapon and invalid participants reject without costs',()=>{
 for(const change of [s=>s.units[0].activeSlot='medical',s=>s.units[0].mounted=true,s=>s.units[0].stance='prone',s=>s.units[0].entangled=true,s=>s.units[0].knockedDown=true,s=>s.units[1].activeSlot='medical',s=>s.units[1].weaponDropped=true,s=>s.units[1].mounted=true,s=>s.units[1].unconscious=true,s=>s.units[1].routed=true,s=>s.units[1].surrendered=true,s=>s.units[1].departure={edge:'S'},s=>s.units[1].side='player',s=>s.units[0].ap=STEAL_MIN_AP-1]){const s=field();change(s);rejected(s);}
});
test('distance, blocked sight and hidden targets cannot reveal or transfer equipment',()=>{
 for(const change of [s=>s.units[1].x=8,s=>Object.assign(s.tiles.find(t=>t.x===2&&t.y===1),{blocked:true}),s=>{s.units[1].x=3;s.tiles.find(t=>t.x===2&&t.y===1).blocked=true;}]){
  const s=field();change(s);if(s.units[1].x===2) {s.units[1].x=3;}rejected(s);
 }
});
test('full pack rejects the swap before rolling; a missing primary needs no temporary pack slot',()=>{
 const s=field();Object.assign(s.units[0],{ammo:0,priming:0,flints:0,rations:0,medkits:0,boleadoras:0,torches:0,inventory:{cargo:{count:48,weight:1}}});assert.equal(inventoryUsage(s.units[0]).used,12);rejected(s);
 s.units[0].weaponDropped=true;s.units[0].loaded=0;const n=take(s);assert.equal(n.lastError,null);assert.equal(inventoryUsage(n.units[0]).used,12);assert.equal(n.units[0].weapon,1800);
});
test('ordinary use still punches; pickup and control intent select a contested grab explicitly',()=>{
 const s=field(),u=s.units[0],target=s.units[1];assert.equal(pickupTargetAction(target,u).type,'steal');assert.equal(pickupTargetAction({...target,unconscious:true},u).type,'loot');
 assert.equal(pointerItemIntent({ctrlKey:true}),'steal');for(const key of ['shiftKey','altKey','metaKey'])assert.equal(pointerItemIntent({ctrlKey:true,[key]:true}),'use');
 assert.equal(targetPreview(s,u,target).actionLabel,'Puños');for(const ctx of [{mode:'loot'},{mode:'move',itemIntent:'steal'}]){const preview=targetPreview(s,u,target,ctx);assert.equal(preview.actionLabel,'Quitar arma');assert.equal(preview.pa,u.ap);assert.equal(preview.remaining,0);assert.equal(preview.chance,undefined);assert.equal(preview.valid,true);}
 const n=actBattle(s,{type:'useItem',unitId:'p',targetId:'e'});assert.equal(n.units[1].weaponDropped,undefined);assert.equal(n.units[0].weapon,1806);
});
test('preview and public action projection conceal defender stats, supplies and hidden people',()=>{
 const s=field(),changed=structuredClone(s);Object.assign(changed.units[1],{energy:1,strength:100,dexterity:100,ammo:999,inventory:{secret:{count:1,weight:1}}});
 assert.deepEqual(stealPreview(s,s.units[0],s.units[1]),stealPreview(changed,changed.units[0],changed.units[1]));
 changed.units.push({...structuredClone(changed.units[1]),id:'hidden',x:11,y:7});changed.tiles.find(t=>t.x===6&&t.y===4).blocked=true;const view=playerKnownBattle(changed),options=view.orders[0].stealTargets;assert.equal(options.length,1);assert.equal(options[0].action.type,'steal');assert.equal(options[0].chance,undefined);assert.ok(!JSON.stringify(view).includes('secret'));
});
test('disarmed enemies can pay to draw a remaining blade or their primary after losing a blade',()=>{
 const wounded=take(field({}, {blade:1813})),patient=wounded.units[1];Object.assign(patient,{ap:50,hp:90,bleeding:1,medical:50,medkits:1});assert.equal(chooseEnemyAction(wounded,patient).slot,'medical','urgent field aid takes priority over drawing a backup');
 for(const patch of [{blade:1813},{activeSlot:'blade',blade:1813}]){const n=take(field({},patch)),enemy=n.units[1];enemy.ap=20;const a=chooseEnemyAction(n,enemy);assert.deepEqual(a,{type:'weapon',unitId:'e',slot:patch.activeSlot?'primary':'blade'});}
});
test('exploration uses elapsed time and exhaustion instead of a free equipment transfer',()=>{
 const s=field({energy:8},{},{mode:'exploration'});s.mode='exploration';s.units[0].ap=0;const n=take(s);assert.equal(n.lastError,null);assert.equal(n.elapsedSeconds-s.elapsedSeconds,2);assert.equal(n.units[0].energy,0);assert.equal(n.units[0].unconscious,true);assert.equal(n.units[0].weapon,1800);assert.doesNotThrow(()=>validateBattleSnapshot(n));
});
test('a saved real interruption permits a grab with the existing budget and resumes deterministically',()=>{
 const s=field({experienceLevel:10},{x:3,weapon:1813,loaded:0,jammed:false,ap:24});s.units[0].ap=50;
 const paused=endTurn(s);assert.equal(paused.phase,'interrupt');assert.equal(paused.units[1].x,2);assert.equal(paused.units[0].ap,50);
 const n=take(paused);assert.equal(n.lastError,null);assert.equal(n.units[0].ap,0);assert.equal(n.units[0].weapon,1813);assert.equal(n.elapsedSeconds,paused.elapsedSeconds);assert.deepEqual(n,take(validateBattleSnapshot(JSON.parse(JSON.stringify(paused)))));assert.deepEqual(endTurn(n),endTurn(validateBattleSnapshot(JSON.parse(JSON.stringify(n)))));
});
test('campaign-bound save keeps both owners and exact equipment after the real grab',()=>{
 let c=dispatchCampaign(initialCampaign(),{type:'travel',sector:'buenos_aires'});c=dispatchCampaign(c,{type:'attack',sector:'san_nicolas'});assert.equal(c.lastError,null);
 const req=c.pendingBattle;let b=createBattle(req.squad.map((u,i)=>({...u,x:1,y:1+i,activeSlot:i?'primary':'unarmed',strength:100,dexterity:100,agility:100,experienceLevel:10})),{...req,width:12,height:8,tiles:grid(),props:[],npcs:[],enemies:[{id:'e',x:2,y:1,weapon:1808,loaded:2,condition:41,jammed:true,overwatch:false,patrol:false,strength:1,dexterity:1,agility:1,experienceLevel:1}],seed:45});b.units.at(-1).ap=0;
 b=actBattle(b,{type:'steal',unitId:b.units[0].id,targetId:'e'});assert.equal(b.lastError,null);const pair=syncBattleTime(c,b);assert.equal(pair.error,null);const saved=decodeSave(encodeSave(pair.campaign,pair.battle));assert.deepEqual(saved.battle,pair.battle);assert.equal(saved.battle.units[0].weapon,1808);assert.equal(saved.battle.units[0].loaded,2);assert.equal(saved.battle.units.at(-1).weaponDropped,true);
});

test('grabs cannot cross a blocked diagonal corner and legacy object weapons are stored intact',()=>{
 const s=field({}, {x:2,y:2});s.tiles.find(t=>t.x===2&&t.y===1).blocked=true;rejected(s);
 const legacy=field({weapon:{id:1806,capacity:1}},{weapon:{id:1800,capacity:1}}),n=take(legacy);assert.equal(n.lastError,null);assert.equal(n.units[0].weapon,1800);assert.equal(Object.values(n.units[0].inventory)[0].weapon,1806);assert.equal(Object.values(n.units[0].inventory)[0].loaded,1);
});
