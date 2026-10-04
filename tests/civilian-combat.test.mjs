import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,pointFirePreview,firearmFlightPreview,knifeThrowPreview,artilleryShotTrace,artilleryCosts,canSee,teamCanSee,npcGiftPreview,inventoryMapPreview} from '../game/tactical.js';
import {projectileFlight} from '../game/projectile-cover.js';
import {knifeFlight} from '../game/knife-flight.js';
import {civilianIncidents,applyCivilianHarm} from '../game/civilian-harm.js';
import {makeGrenadeStack} from '../game/grenades.js';
import {grenadeBlastExposure} from '../game/grenade-flight.js';
import {GRENADE_THROW} from '../game/grenade-throw.js';
import {makeOutfit} from '../game/outfits.js';
import {equipmentFingerprint,inventoryUsage} from '../game/tactical-inventory.js';
import {chooseArtilleryAction} from '../game/tactical-ai-artillery.js';
import {playerKnownBattle} from '../game/player-known-state.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

const flat=(width=16,height=10)=>Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,blocksSight:false,cover:0}));
function field(actor={},civilian={},sector={}){
 const s=createBattle([{id:'p',name:'Tirador',x:1,y:3,facing:2,weapon:1800,loaded:1,ammo:8,condition:100,marksmanship:100,dexterity:85,agility:85,strength:100,experienceLevel:1,...actor}],{
  width:16,height:10,seed:45,tiles:flat(),enemies:[{id:'e',name:'Realista',x:7,y:3,overwatch:false,patrol:false},{id:'reserve',name:'Reserva',x:14,y:8,overwatch:false,patrol:false}],
  npcs:[{id:'civil',name:'Vecina',x:4,y:3,...civilian}],...sector
 });
 for(const u of s.units)u.ap=100;
 return s;
}
const issue=(s,action)=>{const next=actBattle(s,{unitId:'p',...action});assert.equal(next.lastError,null,next.lastError);return next;};
const fire=(s,extra={})=>issue(s,{type:'firePoint',x:7,y:3,aim:4,...extra});
function continuedCivilianImpact(before,next){
 const firstDamage=before.npcs[0].hp-next.npcs[0].hp,enemy=next.units.find(u=>u.id==='e'),enemyBefore=before.units.find(u=>u.id==='e'),laterDamage=enemyBefore.hp-enemy.hp;
 assert.ok(firstDamage>0&&laterDamage>0&&laterDamage<firstDamage,'the real downstream body receives reduced damage');
 assert.equal(civilianIncidents(next.npcs[0])[0].attackerId,'p');assert.equal(civilianIncidents(next.npcs[0])[0].intentional,false);
 assert.equal(next.units[0].hp,before.units[0].hp);assert.equal(next.units[0].loaded,before.units[0].loaded-1);assert.equal(next.units[0].ammo,before.units[0].ammo);
}
const savedShotReplay=(before,next,action)=>assert.deepEqual(issue(validateBattleSnapshot(JSON.parse(JSON.stringify(before))),action),next);
const wall=(s,x,material='stone',y=3)=>Object.assign(s.tiles.find(t=>t.x===x&&t.y===y),{type:'wall',blocked:true,blocksSight:true,material});
const practice=u=>({skillPractice:u.skillPractice,trainedStats:u.trainedStats,militiaExperience:u.militiaExperience,militiaCombatCredit:u.militiaCombatCredit,xp:u.xp});
const knifeActor={weapon:1813,loaded:0,activeSlot:'primary',weaponInstanceId:'owned-knife',condition:83,marksmanship:85};

test('an actual point shot crosses the civilian and enemy with one load and no casualty credit',()=>{
 const s=field({marksmanship:85}),before=structuredClone(s),preview=pointFirePreview(s,s.units[0],{x:7,y:3},4),next=fire(s);
 continuedCivilianImpact(s,next);savedShotReplay(s,next,{type:'firePoint',x:7,y:3,aim:4});assert.equal(next.units[0].condition,99);assert.equal(next.units[0].ap,100-preview.pa);
 assert.deepEqual(practice(next.units[0]),practice(s.units[0]));assert.equal(next.npcs[0].inventory,undefined);assert.equal(next.npcs[0].militiaCreditId,undefined);
 assert.equal(civilianIncidents(next.npcs[0])[0].intentional,false);assert.deepEqual(s,before);validateBattleSnapshot(next);
});

test('visible civilian interception changes only the known flight, while a named hostile order still fires physically',()=>{
 const s=field(),flight=firearmFlightPreview(s,s.units[0],s.units[1]);assert.equal(flight.victimId,'civil');assert.equal(flight.victimKind,'npc');
 const action={type:'fire',targetId:'e',aim:4},next=issue(s,action);continuedCivilianImpact(s,next);savedShotReplay(s,next,action);assert.equal(next.units[0].lastTargetId,'e');
});

test('unknown civilians do not change point or named-target previews and remain unnamed after impact',()=>{
 const s=field({x:0},{x:7,name:'Habitante oculto'},{night:true,lights:[{id:'lamp',x:10,y:3,radius:1,intensity:1,turns:10}]});s.units[1].x=10;
 assert.equal(teamCanSee(s,'player',s.units[1]),true);assert.equal(teamCanSee(s,'player',s.npcs[0]),false);
 const empty=structuredClone(s);empty.npcs=[];
 assert.deepEqual(firearmFlightPreview(s,s.units[0],s.units[1]),firearmFlightPreview(empty,empty.units[0],empty.units[1]));
 assert.deepEqual(pointFirePreview(s,s.units[0],{x:7,y:3},4),pointFirePreview(empty,empty.units[0],{x:7,y:3},4));
 const action={type:'fire',targetId:'e',aim:4},next=issue(s,action);continuedCivilianImpact(s,next);savedShotReplay(s,next,action);
 assert.ok(!next.log.some(line=>line.includes('Habitante oculto')));assert.ok(!JSON.stringify(playerKnownBattle(next)).includes('Habitante oculto'));
});

test('a seeded miss can strike a hidden civilian outside the intended line without another charge or disclosure',()=>{
 const s=field({marksmanship:0},{x:8,y:4,name:'Vecino secreto'},{seed:3});wall(s,5,'wood',4);assert.equal(teamCanSee(s,'player',s.npcs[0]),false);
 const before=structuredClone(s),next=fire(s,{aim:0});assert.ok(next.npcs[0].hp<100);assert.equal(next.units[1].hp,100);assert.equal(next.units[0].loaded,0);assert.equal(next.units[0].ammo,8);assert.equal(civilianIncidents(next.npcs[0])[0].intentional,false);assert.ok(!next.log.some(line=>line.includes('Vecino secreto')));
 assert.deepEqual(fire(validateBattleSnapshot(JSON.parse(JSON.stringify(s))),{aim:0}),next);assert.deepEqual(s,before);
});

test('hard cover stops civilian impacts, wood reduces firearm damage, and cover beyond a body cannot protect it',()=>{
 const clear=field(),stone=field(),wood=field(),behind=field();wall(stone,3);wall(wood,3,'wood');wall(behind,6);
 const clean=fire(clear),stopped=fire(stone),partial=fire(wood),near=fire(behind);
 assert.equal(stopped.npcs[0].hp,100);assert.equal(stopped.npcs[0].civilianHarm,undefined);assert.equal(stopped.units[0].loaded,0);
 assert.ok(partial.npcs[0].hp<100&&partial.npcs[0].hp>clean.npcs[0].hp);assert.equal(near.npcs[0].hp,clean.npcs[0].hp);
 assert.ok(!partial.log.some(line=>line.includes('Vecina')));assert.equal(civilianIncidents(partial.npcs[0])[0].intentional,false);
 const knife=field(knifeActor);wall(knife,3,'wood');const thrown=issue(knife,{type:'throwKnife',x:7,y:3,aim:4});assert.equal(thrown.npcs[0].hp,100);assert.equal(thrown.groundItems.length,1);assert.ok(thrown.groundItems[0].x<3);
});

test('living prone civilians intercept low rays while dead, departed and fled bodies are excluded',()=>{
 for(const patch of [{hp:0,stance:'prone'},{departure:{edge:'E'}},{fled:true},{stance:'prone',movementMode:'prone'}]){
  const s=field({},patch),next=fire(s);assert.deepEqual(next.npcs[0].hp,s.npcs[0].hp);assert.ok(next.units[1].hp<100);assert.equal(next.npcs[0].civilianHarm,undefined);
 }
 for(const patch of [{hp:50,energy:0,unconscious:true},{hp:50,knockedDown:true,stance:'prone'}]){
  const s=field({stance:'prone',movementMode:'prone'},patch);Object.assign(s.units[1],{stance:'prone',movementMode:'prone'});
  const action={type:'fire',targetId:'e',aim:4},next=issue(s,action);continuedCivilianImpact(s,next);savedShotReplay(s,next,action);assert.equal(next.npcs[0].stance,'prone');
 }
});

test('civilian and soldier IDs cannot redirect the impact to another collection or exclude the body as its own attacker',()=>{
 for(const id of ['p','e']){
  const s=field({}, {id});
  for(const trace of [projectileFlight(s,s.units[0],s.units[1],{damage:58}),knifeFlight(s,s.units[0],s.units[1])]){assert.equal(trace.victimKind,'npc');assert.equal(trace.victimId,id);}
  const next=fire(s);continuedCivilianImpact(s,next);
  // Deliberately colliding IDs exercise typed reducer dispatch. They remain
  // inadmissible saved characters rather than a save-validation bypass.
  assert.throws(()=>validateBattleSnapshot(JSON.parse(JSON.stringify(s))),/personajes/);
  assert.deepEqual(fire(JSON.parse(JSON.stringify(s))),next);
 }
});

test('roof projectiles hit the civilian on that physical floor and respect an intervening roof obstacle',()=>{
 const roof=x=>({id:`roof-${x}`,x,y:3,tacticalLevel:1,elevation:3,kind:'roof',type:'floor',blocked:false,cover:0});
 const s=field({tacticalLevel:1},{tacticalLevel:1},{upperSurfaces:Array.from({length:7},(_,i)=>roof(i+1))});s.units[1].tacticalLevel=1;s.npcs.push({id:'below',name:'Abajo',x:3,y:3});
 const traces=()=>[projectileFlight(s,s.units[0],s.units[1],{damage:58}),knifeFlight(s,s.units[0],s.units[1])];
 for(const trace of traces()){assert.equal(trace.victimId,'civil');assert.equal(trace.victimKind,'npc');}
 const next=fire(s,{tacticalLevel:1});continuedCivilianImpact(s,next);savedShotReplay(s,next,{type:'firePoint',x:7,y:3,aim:4,tacticalLevel:1});assert.equal(next.npcs[1].hp,undefined);
 Object.assign(s.upperSurfaces.find(t=>t.x===3),{type:'wall',blocked:true,material:'stone'});for(const trace of traces()){assert.equal(trace.blocked,true);assert.equal(trace.victimId,null);}
});

test('a thrown facon hurts the civilian, retains its exact recoverable item, and awards no combat practice',()=>{
 const s=field(knifeActor),before=structuredClone(s.units[0]),next=issue(s,{type:'throwKnife',x:7,y:3,aim:4});
 assert.ok(next.npcs[0].hp<100);assert.equal(next.units[1].hp,100);assert.equal(next.units[0].activeSlot,'unarmed');assert.equal(next.groundItems.length,1);
 assert.equal(next.groundItems[0].weapon,1813);assert.equal(next.groundItems[0].instanceId,'owned-knife');assert.equal(next.groundItems[0].condition,83);assert.equal(next.groundItems[0].count,1);assert.equal(next.groundItems[0].x,4);assert.equal(next.groundItems[0].y,3);
 assert.equal(next.npcs[0].inventory,undefined);assert.deepEqual(practice(next.units[0]),practice(before));assert.equal(civilianIncidents(next.npcs[0])[0].intentional,false);validateBattleSnapshot(next);
});

test('hidden civilian bodies are absent from knife previews but can stop a confirmed throw',()=>{
 const s=field({...knifeActor,x:0},{x:7,name:'Oculta'},{night:true,lights:[{id:'lamp',x:10,y:3,radius:1,intensity:1,turns:10}]});s.units[1].x=10;
 const empty=structuredClone(s);empty.npcs=[];const point={x:10,y:3};assert.equal(teamCanSee(s,'player',s.npcs[0]),false);
 assert.deepEqual(knifeThrowPreview(s,s.units[0],point,{aim:4}),knifeThrowPreview(empty,empty.units[0],point,{aim:4}));
 const next=issue(s,{type:'throwKnife',...point,aim:4});assert.ok(next.npcs[0].hp<100);assert.equal(next.units[1].hp,100);assert.ok(!next.log.some(line=>line.includes('Oculta')));
});

test('paired pistols retain both ammunition payments after a civilian intercepts the volley',()=>{
 const s=field({weapon:1805,loaded:1,marksmanship:85,offHand:{weapon:1808,count:1,weight:1.3,loaded:2,condition:100,jammed:false,instanceId:'second'}},{x:3},{seed:127});
 s.units[1].y=5;
 const next=fire(s);assert.ok(next.npcs[0].hp<100);assert.equal(next.units[0].loaded,0);assert.equal(next.units[0].offHand.loaded,1);assert.equal(next.units[0].ammo,8);assert.equal(next.smoke.length,2);assert.deepEqual(practice(next.units[0]),practice(s.units[0]));validateBattleSnapshot(next);
});

test('both trabuco paths include each civilian in the cone once without harming civilians outside the cone',()=>{
 for(const type of ['firePoint','fire']){
  const s=field({weapon:1807},{hp:100});s.npcs.push({id:'side',name:'Al costado',x:5,y:4,hp:100},{id:'outside',name:'Fuera',x:4,y:6,hp:100});
  const next=issue(s,type==='fire'?{type,targetId:'e',aim:4}:{type,x:7,y:3,aim:4});
  assert.equal(next.units[0].loaded,0);assert.equal(next.units[0].ammo,8);assert.ok(next.npcs[0].hp<100);assert.ok(next.npcs[1].hp<100);assert.equal(next.npcs[2].hp,100);
  for(const npc of next.npcs.slice(0,2)){assert.equal(civilianIncidents(npc).length,1);assert.equal(civilianIncidents(npc)[0].hpBefore,100);assert.equal(npc.militiaCreditId,undefined);assert.equal(npc.morale,undefined);}
  const blocked=structuredClone(s);wall(blocked,3).blocksSight=false;const stopped=issue(blocked,type==='fire'?{type,targetId:'e',aim:4}:{type,x:7,y:3,aim:4});assert.equal(stopped.npcs[0].hp,100);
 }
});

function cannonField(){return field({x:1,y:2,explosives:75},{x:5,y:3,hp:100},{artillery:[{id:'gun',type:'swivel',side:'player',x:2,y:3,facing:0,loaded:true,ammo:2}]});}
test('a confirmed point exactly occupied by a visible civilian records deliberate firearm, knife and cannon harm',()=>{
 for(const type of ['firePoint','throwKnife','artillery']){
  const s=type==='artillery'?cannonField():field(type==='throwKnife'?knifeActor:{},{x:7});s.units[1].y=6;
  const npc=s.npcs[0];assert.equal(teamCanSee(s,'player',npc),true);
  const next=issue(s,{type,x:npc.x,y:npc.y,...(type==='artillery'?{artilleryId:'gun'}:{aim:4})});assert.ok(next.npcs[0].hp<100);assert.equal(civilianIncidents(next.npcs[0])[0].intentional,true,type);
 }
});
test('solid shot and canister apply their existing damage once per civilian and spend the actual cannon charge',()=>{
 for(const mode of ['solid','canister']){
  const s=cannonField();s.npcs.push({id:'next',name:'Detrás',x:6,y:3,hp:100},{id:'out',name:'Fuera',x:5,y:8,hp:100});
  const point={x:10,y:3},events=artilleryShotTrace(s,s.units[0],s.artillery[0],point,mode).events.filter(e=>e.victimKind==='npc');assert.equal(events.length,2);assert.equal(new Set(events.map(e=>e.unitId)).size,2);
  const next=issue(s,{type:'artillery',artilleryId:'gun',...point,mode});assert.equal(next.artillery[0].loaded,false);assert.equal(next.artillery[0].ammo,2);assert.equal(next.units[0].ap,100-artilleryCosts(s,s.units[0],s.artillery[0]).fire);
  for(const event of events){const npc=next.npcs.find(n=>n.id===event.unitId);assert.equal(npc.hp,Math.max(0,100-Math.round(event.damage)));assert.equal(npc.militiaCreditId,undefined);}
  assert.equal(next.npcs[2].hp,100);validateBattleSnapshot(next);
 }
 const blocked=cannonField();wall(blocked,4);const stopped=issue(blocked,{type:'artillery',artilleryId:'gun',x:10,y:3});assert.equal(stopped.npcs[0].hp,100);assert.equal(stopped.artillery[0].loaded,false);
});

test('artillery AI rejects observed civilians but does not inspect a hidden civilian on a possible shot line',()=>{
 const s=cannonField();s.npcs[0].x=4;assert.equal(canSee(s,s.units[0],s.npcs[0]),true);assert.equal(chooseArtilleryAction(s,s.units[0],[s.units[1]],()=>[]),null);
 const hidden=cannonField();hidden.night=true;hidden.units[1].x=12;hidden.npcs[0].x=8;hidden.lights=[{id:'lamp',x:12,y:3,radius:1,intensity:1,turns:10}];
 assert.equal(canSee(hidden,hidden.units[0],hidden.npcs[0]),false);assert.equal(canSee(hidden,hidden.units[0],hidden.units[1]),true);
 const empty=structuredClone(hidden);empty.npcs=[];assert.deepEqual(chooseArtilleryAction(hidden,hidden.units[0],[hidden.units[1]],()=>[]),chooseArtilleryAction(empty,empty.units[0],[empty.units[1]],()=>[]));
});

test('grenade damage remains exactly once per civilian with existing radial cover and no soldier combat credit',()=>{
 const s=field({activeSlot:'item',activeItem:'inventory:grenade',inventory:{grenade:makeGrenadeStack()}},{x:6,y:3,hp:100,energy:100});
 s.npcs.push({id:'adjacent',name:'Cercano',x:6,y:4,hp:100,energy:100},{id:'dead',name:'Muerto',x:6,y:3,hp:0,energy:0},{id:'gone',name:'Ausente',x:6,y:3,hp:100,departure:{edge:'E'}});
 const origin={x:6,y:3},next=issue(s,{type:'throwGrenade',...origin});
 for(const before of s.npcs.slice(0,2)){const multiplier=grenadeBlastExposure(s,origin,before,GRENADE_THROW.radius).multiplier,npc=next.npcs.find(n=>n.id===before.id);assert.equal(npc.hp,100-Math.round(55*multiplier));assert.equal(npc.energy,100-Math.round(45*multiplier));assert.equal(civilianIncidents(npc).length,1);}
 assert.equal(civilianIncidents(next.npcs[0])[0].intentional,true);assert.equal(civilianIncidents(next.npcs[1])[0].intentional,false);assert.deepEqual(next.npcs[2],s.npcs[2]);assert.deepEqual(next.npcs[3],s.npcs[3]);assert.equal(next.units[0].inventory.grenade,undefined);
});

test('civilian casualties give no militia credit while a real downstream enemy injury earns its own point',()=>{
 for(const hp of [60,20]){
  const s=field({militia:true,militiaRank:0,marksmanship:85,x:0,ammo:0,blade:0},{hp,x:7},{night:true,lights:[{id:'lamp',x:10,y:3,radius:1,intensity:1,turns:10}]});s.units[0].ap=12;s.units[1].x=10;for(const enemy of s.units.filter(u=>u.side==='enemy')){enemy.loaded=0;enemy.ap=0;}
  assert.equal(teamCanSee(s,'player',s.npcs[0]),false);
  // A militia autonomous shot still traces the same intervening civilian.
  const next=endTurn(s);assert.ok(next.npcs[0].hp<hp);assert.equal(next.npcs[0].stance,'prone');assert.equal(next.npcs[0].movementMode,'prone');assert.equal(next.npcs[0].militiaCreditId,undefined);
  const enemy=next.units.find(u=>u.id==='e');assert.ok(enemy.hp<s.units.find(u=>u.id==='e').hp);assert.equal(next.units[0].militiaRank,0);assert.equal(next.units[0].militiaExperience,1);assert.deepEqual(next.units[0].militiaCombatCredit,[{id:enemy.militiaCreditId,points:1}]);
  assert.equal(civilianIncidents(next.npcs[0])[0].attackerId,'p');assert.ok(!next.log.some(line=>line.includes('Vecina')));assert.deepEqual(endTurn(validateBattleSnapshot(JSON.parse(JSON.stringify(s)))),next);
  if(next.npcs[0].hp===0)assert.equal(civilianIncidents(next.npcs[0])[0].militia,true);validateBattleSnapshot(next);
 }
});

test('personally wounded civilians refuse both held-item gifts and selected-object delivery before spending items',()=>{
 const coat={...makeOutfit('poncho'),instanceId:'gift'},s=field({activeSlot:'item',activeItem:'inventory:coat',inventory:{coat}},{id:'local-retiro',x:2,y:3,mission:true},{exploration:true,enemies:[]});
 applyCivilianHarm(s,s.npcs[0],{source:s.units[0],damage:10});const reason='No quiere colaborar con quienes lo hirieron.';
 assert.equal(npcGiftPreview(s,s.units[0],s.npcs[0]).reason,reason);
 const direct=actBattle(s,{unitId:'p',type:'useItem',targetId:'local-retiro'});assert.equal(direct.lastError,reason);assert.deepEqual(direct.units,s.units);
 const slot=inventoryUsage(s.units[0]).slots.find(v=>v.entry?.item==='inventory:coat'),sourceId=slot?.id??'hand:right';
 const action={type:'inventoryMap',unitId:'p',sourceId,expectedSource:equipmentFingerprint(s.units[0],sourceId),count:1,intent:'auto',x:2,y:3,targetId:'local-retiro'};
 assert.equal(inventoryMapPreview(s,s.units[0],action).reason,reason);const selected=actBattle(s,action);assert.equal(selected.lastError,reason);assert.deepEqual(selected.units,s.units);assert.equal(selected.elapsedSeconds,s.elapsedSeconds);
});
