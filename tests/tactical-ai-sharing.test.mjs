import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,endTurn,actBattle,getReachable,canSee,actionCosts,transferPreview} from '../game/tactical.js';
import {chooseEnemyAction} from '../game/tactical-ai.js';
import {chooseSupplySharingAction} from '../game/tactical-ai-sharing.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {setTestAmmunition} from './typed-ammunition-fixture.mjs';

function field(donor={},receiver={}){
 const tiles=Array.from({length:128},(_,i)=>({x:i%16,y:Math.floor(i/16),type:i%16===8?'wall':'grass',blocked:i%16===8,blocksSight:i%16===8,cover:0}));
 const s=createBattle([{id:'p',x:1,y:1}],{width:16,height:8,seed:45,tiles,enemies:[
  {id:'donor',name:'donor',x:12,y:3,facing:2,medical:0,medkits:0,loaded:1,ammo:3,weapon:1800,patrol:false,...donor},
  {id:'receiver',name:'receiver',x:13,y:3,facing:2,medical:0,medkits:0,loaded:0,ammo:0,weapon:1800,patrol:false,...receiver},
 ]});
 s.units[0].ap=0;s.units[1].ap=donor.ap??4;s.units[2].ap=receiver.ap??0;return s;
}
const donor=s=>s.units.find(u=>u.id==='donor');
const receiver=s=>s.units.find(u=>u.id==='receiver');
const restored=s=>validateBattleSnapshot(JSON.parse(JSON.stringify(s)));
const choice=(s,targets=[])=>chooseSupplySharingAction({...s,phase:'enemy'},donor(s),targets,()=>getReachable(s,donor(s)));

test('an actual enemy turn hands over finite cartridges with paid AP and exact saved replay',()=>{
 const s=field(),before=structuredClone(s),n=endTurn(s);
 assert.equal(n.lastError,null);assert.equal(donor(n).ap,0);assert.equal(donor(n).ammo,2);assert.equal(donor(n).loaded,1);
 assert.equal(receiver(n).ammo,1);assert.equal(receiver(n).loaded,0);assert.equal(n.elapsedSeconds,6);
 assert.equal(n.groundItems.length,0);assert.deepEqual(s,before);assert.deepEqual(n,endTurn(restored(s)));assert.doesNotThrow(()=>restored(n));
 assert.ok(!n.log.some(line=>/donor|receiver/.test(line)),'Unseen transfers do not reveal enemy supplies in the journal.');
});
test('the recipient pays a separate reload using the transferred round',()=>{
 const s=field(),u=receiver(s);u.ap=actionCosts(s,setTestAmmunition(structuredClone(u),1)).reload;
 const n=endTurn(s);assert.equal(donor(n).ammo,2);assert.equal(receiver(n).ammo,0);assert.equal(receiver(n).loaded,1);assert.equal(receiver(n).ap,0);
 assert.deepEqual(n,endTurn(restored(s)));assert.doesNotThrow(()=>restored(n));
});
test('a non-medic gives a dressing and the recipient equips and uses it through ordinary actions',()=>{
 const s=field({medkits:1},{medical:60,hp:50,bleeding:2,loaded:1});const u=receiver(s);
 u.ap=actionCosts(s,u).weapon*2+actionCosts(s,{...u,activeSlot:'medical'},u).heal;
 const n=endTurn(s);assert.equal(donor(n).medkits,0);assert.equal(receiver(n).medkits,0);assert.equal(receiver(n).bleeding,0);assert.equal(receiver(n).hp,50);
 assert.equal(receiver(n).activeSlot,'primary');assert.equal(receiver(n).ap,0);assert.equal(donor(n).ap,0);assert.deepEqual(n,endTurn(restored(s)));assert.doesNotThrow(()=>restored(n));
});
test('supply reserves, present need, capacity and AP prevent useless or impossible donations',()=>{
 for(const patch of [{ammo:0},{loaded:0,ammo:1},{ap:3},{routed:true},{unconscious:true},{entangled:true},{knockedDown:true}]){const s=field();Object.assign(donor(s),patch);if(patch.ammo!==undefined)setTestAmmunition(donor(s),patch.ammo);assert.equal(choice(s),null,JSON.stringify(patch));}
 for(const patch of [{ammo:1},{loaded:1},{weaponDropped:true},{jammed:true},{rations:99},{hp:0},{unconscious:true},{routed:true},{departure:{edge:'E'}}]){const s=field();Object.assign(receiver(s),patch);if(patch.ammo!==undefined)setTestAmmunition(receiver(s),patch.ammo);assert.equal(choice(s),null,JSON.stringify(patch));}
 assert.equal(choice(field({ammo:0,medkits:1,medical:60},{medical:60,bleeding:2,hp:50})),null,'A medic retains the last dressing.');
 assert.equal(choice(field({ammo:0,medkits:2},{loaded:1,medical:60,bleeding:0})),null,'No casualty at hand means no medical demand.');
 const s=field({medkits:2,medical:60},{medical:60,bleeding:2,hp:50,ap:50});assert.equal(choice(s).item,'medkits');assert.equal(choice(s).count,1);
});
test('an empty donor retains its own complete load and gives at most one recipient load',()=>{
 const s=field({loaded:0,ammo:5,weapon:1808},{weapon:1808});const order=choice(s);
 assert.deepEqual(order,{type:'transfer',unitId:'donor',targetId:'receiver',item:'inventory:ammo:pistol_69',count:2});
 const preview=transferPreview({...s,phase:'enemy'},donor(s),receiver(s),order.item,order.count);assert.equal(preview.valid,true);assert.equal(preview.pa,4);assert.equal(preview.kind,'give');
 setTestAmmunition(donor(s),3);assert.equal(choice(s).count,1);setTestAmmunition(donor(s),2);assert.equal(choice(s),null);
});
test('nearby supply runs move first and leave the four AP needed for the actual handover',()=>{
 const s=field({x:11,ap:20},{x:14});const before=structuredClone(s),order=choice(s);assert.deepEqual(order,{type:'move',unitId:'donor',x:13,y:3});assert.deepEqual(s,before);
 const n=endTurn(s);assert.equal(donor(n).x,13);assert.equal(donor(n).ap,0);assert.equal(donor(n).ammo,2);assert.equal(receiver(n).ammo,1);assert.deepEqual(n,endTurn(restored(s)));
 donor(s).ap=19;assert.equal(choice(s),null);
});
test('hidden allies and hidden casualties cannot request supplies through the AI',()=>{
 const s=field({}, {x:7});assert.equal(canSee(s,donor(s),receiver(s)),false);assert.equal(choice(s),null);
 const far=field({}, {x:2});assert.equal(choice(far),null);
 const medic=field({ammo:0,medkits:1},{loaded:1,medical:60});medic.units.push({...structuredClone(receiver(medic)),id:'hidden-patient',x:7,hp:40,bleeding:3});assert.equal(choice(medic),null);
});
test('hidden opposing positions and private ammunition do not change a supply approach',()=>{
 const s=field({x:11,ap:20},{x:14}),before=structuredClone(s),order=choice(s);
 Object.assign(s.units[0],{x:2,y:6,loaded:0,ap:100});setTestAmmunition(s.units[0],999);assert.deepEqual(choice(s),order);assert.deepEqual(choice(before),order);
});
test('reactions permit an adjacent handover but never start a supply trip',()=>{
 const s=field({x:11,ap:20},{x:14});s.reactionStack=[{unitIds:['donor']}];assert.equal(choice(s),null);
 receiver(s).x=12;assert.equal(choice(s).type,'transfer');
});
test('ties are stable and a received supply removes the demand instead of bouncing between allies',()=>{
 const s=field();s.units.push({...structuredClone(receiver(s)),id:'a-receiver',x:12,y:4});const order=choice(s);assert.equal(order.targetId,'a-receiver');
 s.units.reverse();assert.deepEqual(choice(s),order);setTestAmmunition(s.units.find(u=>u.id==='a-receiver'),1);assert.equal(choice(s).targetId,'receiver');setTestAmmunition(receiver(s),1);assert.equal(choice(s),null);
});
test('a saved movement interruption resumes the handover without spending or duplicating supplies twice',()=>{
 const s=field({x:11,ap:20,loaded:0,ammo:2,medical:0,agility:30,experienceLevel:1},{x:14,loaded:0,ammo:0});
 s.tiles.forEach(t=>{t.blocked=false;t.blocksSight=false;t.type='grass';});Object.assign(s.units[0],{x:7,y:3,facing:2,ap:20,agility:100,experienceLevel:10});
 const paused=endTurn(s);assert.equal(paused.phase,'interrupt');assert.equal(donor(paused).x,12);assert.equal(donor(paused).ammo,2);assert.equal(receiver(paused).ammo,0);
 const n=endTurn(restored(paused));assert.deepEqual(n,endTurn(paused));assert.equal(donor(n).x,13);assert.equal(donor(n).ap,0);assert.equal(donor(n).ammo,1);assert.equal(receiver(n).ammo,1);assert.equal(n.elapsedSeconds,6);assert.doesNotThrow(()=>restored(n));
});
test('the player cannot force enemy supply transfers through the public command boundary',()=>{
 const s=field(),order=choice(s),n=actBattle(s,order);assert.ok(n.lastError);assert.deepEqual(n.units,s.units);assert.equal(n.elapsedSeconds,s.elapsedSeconds);assert.equal(n.seed,s.seed);
});

test('autonomous militia can supply a hired ally while hired soldiers retain manual control',()=>{
 const s=field();donor(s).side='player';donor(s).militia=true;receiver(s).side='player';
 s.units[0].side='enemy';s.units[0].ap=0;
 const held=structuredClone(receiver(s)),n=endTurn(s);
 assert.equal(donor(n).ammo,2);assert.equal(receiver(n).ammo,1);assert.equal(receiver(n).loaded,0);assert.equal(donor(n).carriedAP,0);
 assert.equal(receiver(n).x,held.x);assert.equal(receiver(n).y,held.y);assert.equal(receiver(n).activeSlot,held.activeSlot);
 assert.deepEqual(n,endTurn(restored(s)));assert.doesNotThrow(()=>restored(n));
});
test('an observed close opponent prevents a supply run through melee reach',()=>{
 const s=field({x:11,ap:20},{x:14});s.tiles.forEach(t=>{t.blocked=false;t.blocksSight=false;t.type='grass';});
 Object.assign(s.units[0],{x:13,y:4,weapon:1813,loaded:0});setTestAmmunition(s.units[0],0);
 assert.equal(choice(s)?.type,'move');assert.equal(choice(s,[s.units[0]]),null);
});
test('two donors see the updated demand and cannot overfill an exhausted ally',()=>{
 const s=field();s.units.splice(2,0,{...structuredClone(donor(s)),id:'other-donor',x:12,y:4,weaponInstanceId:'other-donor-gun'});
 const n=endTurn(s);assert.equal(receiver(n).ammo,1);assert.equal(donor(n).ammo,2);assert.equal(n.units.find(u=>u.id==='other-donor').ammo,3);
 assert.deepEqual(n,endTurn(restored(s)));assert.doesNotThrow(()=>restored(n));
});
test('a useful shot keeps priority over supplying an adjacent ally',()=>{
 const s=field({ap:40,marksmanship:100});s.tiles.forEach(t=>{t.blocked=false;t.blocksSight=false;t.type='grass';});
 Object.assign(s.units[0],{x:15,y:3,loaded:0});setTestAmmunition(s.units[0],0);receiver(s).y=4;
 assert.equal(chooseEnemyAction({...s,phase:'enemy'},donor(s)).type,'fire');
});

test('a medical handover requires enough recipient AP for both equipping and treatment',()=>{
 const s=field({ammo:0,medkits:1},{medical:33,medkits:0,bleeding:2,hp:50,ap:20});
 assert.equal(choice(s),null);const u=receiver(s),cost=actionCosts(s,{...u,activeSlot:'medical',medkits:1});
 u.ap=cost.weapon+cost.heal-1;assert.equal(choice(s),null);u.ap++;assert.equal(choice(s).item,'medkits');
 u.activeSlot='medical';u.ap=cost.heal;assert.equal(choice(s).item,'medkits');
});

test('recent sight or sound keeps a donor at its post while adjacent handovers remain legal',()=>{
 for(const memory of ['lastKnownEnemy','lastHeardNoise']){
  const s=field({x:11,ap:20},{x:14});donor(s)[memory]={x:5,y:3,turn:s.turn};assert.equal(choice(s),null);
  receiver(s).x=12;assert.equal(choice(s).type,'transfer');receiver(s).x=14;donor(s)[memory].turn=s.turn-4;assert.equal(choice(s).type,'move');
 }
});

test('a supplied medic treats an adjacent unconscious patient without taking the patient’s equipment',()=>{
 const s=field({ammo:0,medkits:1},{medical:60,loaded:1,ap:33});
 s.units.push(setTestAmmunition({...structuredClone(receiver(s)),id:'patient',x:13,y:4,hp:10,bleeding:3,unconscious:true,medkits:0,ap:0,maxAP:0,overwatch:false,weaponInstanceId:'patient-gun'},7));
 const n=endTurn(s),p=n.units.find(u=>u.id==='patient');assert.equal(donor(n).medkits,0);assert.equal(receiver(n).medkits,0);assert.equal(receiver(n).ap,0);
 assert.equal(p.hp,15);assert.equal(p.bleeding,0);assert.equal(p.unconscious,false);assert.equal(p.ap,0);assert.equal(p.ammo,7);assert.equal(p.weaponInstanceId,'patient-gun');assert.deepEqual(n,endTurn(restored(s)));assert.doesNotThrow(()=>restored(n));
});
test('a real enemy reaction can spend its remaining four AP on an adjacent supply handover',()=>{
 const s=field({facing:6,experienceLevel:10,agility:100});s.tiles.forEach(t=>{t.blocked=false;t.blocksSight=false;t.type='grass';});
 Object.assign(s.units[0],{x:7,y:3,facing:2,ap:20,experienceLevel:1,agility:30});
 const action={type:'move',unitId:'p',x:8,y:3},n=actBattle(s,action);assert.equal(n.lastError,null);assert.equal(n.turn,1);assert.equal(donor(n).ammo,2);assert.equal(donor(n).ap,0);assert.equal(receiver(n).ammo,1);
 assert.deepEqual(n,actBattle(restored(s),action));assert.doesNotThrow(()=>restored(n));
});

test('a donor supplies stabilization when a critical patient has no remaining bleeding',()=>{
 const s=field({ammo:0,medkits:1},{medical:60,loaded:1,ap:33});
 s.units.push(setTestAmmunition({...structuredClone(receiver(s)),id:'patient',x:13,y:4,hp:10,bleeding:0,bandaged:90,unconscious:true,medkits:0,ap:0,maxAP:0,overwatch:false,weaponInstanceId:'patient-gun'},7));
 const before=structuredClone(s);
 assert.deepEqual(choice(s),{type:'transfer',unitId:'donor',targetId:'receiver',item:'medkits',count:1});
 assert.deepEqual(s,before);
 const n=endTurn(s),patient=n.units.find(u=>u.id==='patient');
 assert.equal(donor(n).medkits,0);assert.equal(donor(n).ap,0);
 assert.equal(receiver(n).medkits,0);assert.equal(receiver(n).ap,0);
 assert.equal(patient.hp,15);assert.equal(patient.unconscious,false);assert.equal(patient.bleeding,0);
 assert.equal(patient.ap,0);assert.equal(patient.ammo,7);assert.equal(patient.weaponInstanceId,'patient-gun');
 assert.deepEqual(n,endTurn(restored(s)));assert.doesNotThrow(()=>restored(n));
});

test('critical-care demand still requires a living observed patient and an able recipient',()=>{
 for(const patch of [{hp:0},{hp:15,unconscious:false},{departure:{edge:'E'}},{routed:true},{surrendered:true},{x:7}]){
  const s=field({ammo:0,medkits:1},{medical:60,loaded:1,ap:33});
  s.units.push({...structuredClone(receiver(s)),id:'patient',x:13,y:4,hp:10,bleeding:0,bandaged:90,unconscious:true,ap:0,...patch});
  assert.equal(choice(s),null,JSON.stringify(patch));
 }
 const s=field({ammo:0,medkits:1},{medical:60,loaded:1,ap:28});
 s.units.push({...structuredClone(receiver(s)),id:'patient',x:13,y:4,hp:10,bleeding:0,bandaged:90,unconscious:true,ap:0});
 assert.equal(choice(s),null,'Insufficient AP for equipping and treatment.');
 receiver(s).ap=29;assert.equal(choice(s)?.item,'medkits');
});
