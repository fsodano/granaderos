import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,medicalUsePreview,itemUsePreview,canSee,npcGiftPreview,movementEnergy} from '../game/tactical.js';
import {applyCivilianHarm,advanceCivilianBleeding,civilianIncidents,civilianWoundedByPlayer,validateCivilianWounds} from '../game/civilian-harm.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

const unknown=()=>({attackerId:null,side:'unknown',militia:false,intentional:false});
function field(actor={},patient={},extra={}){
 const s=createBattle([{id:'p',name:'Médico',x:2,y:2,facing:2,activeSlot:'medical',medical:60,medkits:2,...actor}],{
  width:16,height:10,seed:45,tiles:Array.from({length:160},(_,i)=>({x:i%16,y:Math.floor(i/16),type:i%16===10?'wall':'grass',blocked:i%16===10,blocksSight:i%16===10,cover:0})),
  enemies:[{id:'e',x:14,y:8,patrol:false,overwatch:false}],
  npcs:[{id:'q',name:'Vecina',x:6,y:2,civilianHealthVersion:1,maxHp:100,hp:50,energy:0,unconscious:true,stance:'prone',movementMode:'prone',bleeding:4,bandaged:0,civilianWoundVersion:1,bleedSource:unknown(),...patient}],...extra,
 });
 s.units[0].ap=actor.ap??60;for(const u of s.units.filter(u=>u.side==='enemy'))u.ap=0;return s;
}
const use=s=>actBattle(s,{type:'useItem',unitId:'p',targetId:'q',targetKind:'npc'});
const plan=s=>itemUsePreview(s,s.units[0],s.npcs[0],{targetKind:'npc'});
const reject=s=>{const next=use(s);assert.ok(next.lastError);assert.deepEqual(next.units,s.units);assert.deepEqual(next.npcs,s.npcs);assert.equal(next.seed,s.seed);assert.equal(next.elapsedSeconds,s.elapsedSeconds);return next;};
const noSoldierFields=n=>{for(const key of ['ap','maxAP','inventory','weapon','medkits','morale','xp','skillPractice','militiaExperience'])assert.equal(n[key],undefined,key);};

test('one typed medical click equals paid movement and local first aid for a civilian',()=>{
 const s=field(),before=structuredClone(s),p=plan(s);
 assert.equal(p.valid,true);assert.equal(p.movePa,24);assert.equal(p.actionPa,25);assert.equal(p.pa,49);assert.deepEqual(p.destination,{x:5,y:2});
 const manual=actBattle(actBattle(s,{type:'move',unitId:'p',...p.destination}),{type:'heal',unitId:'p',targetId:'q',targetKind:'npc'}),next=use(s);
 assert.deepEqual(next,manual);assert.equal(next.units[0].ap,11);assert.equal(next.units[0].medkits,1);assert.equal(next.elapsedSeconds,6);
 assert.equal(next.npcs[0].hp,50);assert.equal(next.npcs[0].energy,0);assert.equal(next.npcs[0].unconscious,true);assert.equal(next.npcs[0].stance,'prone');
 assert.equal(next.npcs[0].bleeding,0);assert.equal(next.npcs[0].bandaged,50);assert.equal(next.npcs[0].bleedSource,undefined);noSoldierFields(next.npcs[0]);
 assert.deepEqual(s,before);validateBattleSnapshot(next);
});

test('exploration pays walking time and energy, then one bandage, with no AP expense',()=>{
 const s=field({ap:1},{},{exploration:true}),p=plan(s),next=use(s);
 assert.equal(p.valid,true);assert.equal(next.elapsedSeconds,11);assert.equal(next.units[0].ap,1);assert.ok(next.units[0].energy<s.units[0].energy);
 assert.equal(next.npcs[0].hp,46,'the untreated wound bleeds during the approach');assert.equal(next.npcs[0].bleeding,0);assert.equal(next.npcs[0].bandaged,54);assert.equal(next.units[0].medkits,1);
 assert.deepEqual(next,actBattle(actBattle(s,{type:'move',unitId:'p',...p.destination}),{type:'heal',unitId:'p',targetId:'q',targetKind:'npc'}));
});

test('raw medical commands distinguish civilian and soldier IDs while ambiguous saves still reject',()=>{
 const s=field();const ally=structuredClone(s.units[0]);Object.assign(ally,{id:'q',name:'Soldado',x:6,y:4,hp:60,bleeding:3,bandaged:0});s.units.push(ally);
 const typed=use(s);assert.equal(typed.lastError,null);assert.equal(typed.npcs[0].bleeding,0);assert.equal(typed.units.find(u=>u.id==='q').bleeding,3);
 const ordinary=actBattle(s,{type:'useItem',unitId:'p',targetId:'q'});assert.equal(ordinary.lastError,null);assert.equal(ordinary.units.find(u=>u.id==='q').bleeding,0);assert.equal(ordinary.npcs[0].bleeding,4);
 assert.throws(()=>validateBattleSnapshot(typed),/personajes/);
});

test('an actual firearm injury opens bleeding and treatment preserves personal harm and refusal',()=>{
 const s=field({activeSlot:'primary',marksmanship:100,ap:100},{x:4,hp:100,energy:100,unconscious:false,stance:'standing',movementMode:'walk',bleeding:0,bandaged:0,bleedSource:undefined});
 const shot=actBattle(s,{type:'firePoint',unitId:'p',x:4,y:2,aim:4});assert.equal(shot.lastError,null);assert.ok(shot.npcs[0].hp<100);assert.ok(shot.npcs[0].bleeding>0);
 assert.equal(shot.npcs[0].bleedSource.attackerId,'p');assert.equal(civilianWoundedByPlayer(shot.npcs[0]),true);
 const harm=structuredClone(shot.npcs[0].civilianHarm),hp=shot.npcs[0].hp;
 const prepared=actBattle(shot,{type:'weapon',unitId:'p',slot:'medical'}),treated=use(prepared);assert.equal(treated.lastError,null);
 assert.equal(treated.npcs[0].hp,hp);assert.equal(treated.npcs[0].bleeding,0);assert.deepEqual(treated.npcs[0].civilianHarm,harm);assert.equal(civilianWoundedByPlayer(treated.npcs[0]),true);
 const quiet={...treated,mode:'exploration'};assert.match(npcGiftPreview(quiet,quiet.units[0],quiet.npcs[0]).reason,/quienes lo hirieron/);noSoldierFields(treated.npcs[0]);
 const repeated=use(treated);assert.ok(repeated.lastError);assert.equal(repeated.units[0].medkits,treated.units[0].medkits);assert.deepEqual(repeated.npcs,treated.npcs);
});

test('critical first aid makes partial health progress without reviving corpses or restoring energy',()=>{
 for(const patient of [{hp:0,bleeding:0,bandaged:0,bleedSource:undefined},{departure:{edge:'E'}},{fled:true}])reject(field({},patient));
 const s=field({x:5},{hp:5}),preview=plan(s),next=use(s);assert.equal(preview.treatment.partial,true);assert.equal(next.lastError,null);assert.equal(next.npcs[0].hp,13);assert.equal(next.npcs[0].energy,0);assert.equal(next.npcs[0].unconscious,true);assert.equal(next.npcs[0].bleeding,0);assert.equal(next.npcs[0].bandaged,0);assert.equal(next.units[0].medkits,1);
});

test('hidden or unknown civilian targets fail before revealing a path or consuming supplies',()=>{
 const s=field();s.tiles.filter(t=>t.x===4).forEach(t=>Object.assign(t,{blocked:true,blocksSight:true,type:'wall'}));
 assert.equal(canSee(s,s.units[0],s.npcs[0]),false);const preview=plan(s);assert.equal(preview.valid,false);assert.deepEqual(preview.path,[]);reject(s);
 const missing=structuredClone(s);missing.npcs=[];const next=use(missing);assert.equal(next.lastError,preview.reason);assert.deepEqual(next.units,missing.units);
 const local=medicalUsePreview(s,s.units[0],s.npcs[0],{targetKind:'npc'});assert.equal(local.allowed,false);
});

test('equipment, skill, full action cost and availability are checked atomically',()=>{
 for(const actor of [{ap:48},{medkits:0},{medical:0},{activeSlot:'primary'},{activeSlot:'unarmed'},{knockedDown:true},{entangled:true},{energy:0}])reject(field(actor));
 reject(field({}, {bleeding:0,bandaged:50,bleedSource:undefined}));
 const s=field(),local=actBattle(s,{type:'heal',unitId:'p',targetId:'q',targetKind:'npc'});assert.ok(local.lastError);assert.deepEqual(local.units,s.units);assert.deepEqual(local.npcs,s.npcs);
 const invalid=actBattle(s,{type:'useItem',unitId:'p',targetId:'q',targetKind:'bad'});assert.ok(invalid.lastError);assert.deepEqual(invalid.npcs,s.npcs);
});

test('patient death or medic collapse during the approach stops treatment without spending a bandage',()=>{
 const dying=field({}, {hp:4},{exploration:true}),dead=use(dying);assert.equal(dead.lastError,null);assert.equal(dead.npcs[0].hp,0);assert.equal(dead.npcs[0].bleeding,0);assert.equal(dead.units[0].medkits,2);assert.ok(dead.elapsedSeconds>0);assert.equal(civilianIncidents(dead.npcs[0]).at(-1).side,'unknown');validateBattleSnapshot(dead);
 const tired=field({},{},{exploration:true});tired.units[0].energy=2*movementEnergy(tired.units[0],{type:'grass'},true);
 const stopped=use(tired);assert.equal(stopped.lastError,null);assert.equal(stopped.units[0].unconscious,true);assert.equal(stopped.units[0].medkits,2);assert.equal(stopped.units[0].x,4);assert.equal(stopped.elapsedSeconds,6);assert.ok(stopped.npcs[0].bleeding>0);
});

test('a final-tile hostile reaction cancels queued civilian first aid',()=>{
 const s=field({agility:30,experienceLevel:1},{x:4,energy:100,unconscious:false,stance:'standing',movementMode:'walk'}, {enemies:[{id:'e',x:6,y:2,facing:6,weapon:1806,marksmanship:70,agility:100,experienceLevel:10,patrol:false}]});s.units[1].ap=6;
 const next=use(s);assert.equal(next.lastError,null);assert.equal(next.units[0].x,3);assert.equal(next.units[1].reactionTurn,1);assert.equal(next.units[0].medkits,2);assert.equal(next.npcs[0].bleeding,4);assert.equal(next.elapsedSeconds,6);
});

test('a hidden civilian blocker does not alter the medical preview and stops the actual route',()=>{
 const s=field({x:0,ap:100},{x:9},{night:true,lights:[{id:'lamp',x:9,y:2,radius:1,intensity:1,turns:10}]});
 s.npcs.push({id:'hidden',name:'Habitante oculto',x:7,y:2,hp:100,energy:0,unconscious:true,stance:'prone',movementMode:'prone'});
 assert.equal(canSee(s,s.units[0],s.npcs[0]),true);assert.equal(canSee(s,s.units[0],s.npcs[1]),false);
 const p=plan(s),other=structuredClone(s);other.npcs[1].x=14;other.npcs[1].y=8;assert.equal(p.valid,true);assert.deepEqual(plan(other),p);
 const next=use(s);assert.equal(next.lastError,null);assert.equal(next.units[0].x,6);assert.equal(next.units[0].y,2);assert.equal(next.units[0].medkits,2);assert.equal(next.npcs[0].bleeding,4);assert.ok(next.log.some(line=>line.includes('ruta está bloqueada')));
});

test('typed civilian treatment fits a saved player interrupt and preserves its continuation',()=>{
 const s=field({x:1,y:1,agility:100,experienceLevel:10,ap:100},{x:4,y:4,hp:10},{enemies:[{id:'e',x:7,y:1,weapon:1809,agility:30,experienceLevel:1,patrol:false}]});s.units[1].ap=24;
 const paused=endTurn(s);assert.equal(paused.phase,'interrupt');assert.ok(paused.interrupt.unitIds.includes('p'));
 const treated=use(paused);assert.equal(treated.lastError,null);assert.equal(treated.phase,'interrupt');assert.equal(treated.units[0].medkits,1);assert.equal(treated.npcs[0].bleeding,0);assert.equal(treated.npcs[0].hp,15);assert.equal(treated.npcs[0].unconscious,true);
 assert.deepEqual(use(validateBattleSnapshot(JSON.parse(JSON.stringify(paused)))),treated);
 assert.deepEqual(endTurn(validateBattleSnapshot(JSON.parse(JSON.stringify(treated)))),endTurn(treated));
});

test('unseen bleeding and death retain consequences without naming the hidden civilian',()=>{
 const s=field({}, {hp:4,name:'Paciente oculta'},{exploration:true});s.tiles.filter(t=>t.x===4).forEach(t=>Object.assign(t,{blocked:true,blocksSight:true,type:'wall'}));
 assert.equal(canSee(s,s.units[0],s.npcs[0]),false);const next=actBattle(s,{type:'ambient'});
 assert.equal(next.npcs[0].hp,0);assert.equal(civilianIncidents(next.npcs[0]).at(-1).side,'unknown');assert.ok(!next.log.some(line=>line.includes('Paciente oculta')));validateBattleSnapshot(next);
});

test('the same civilian wound clock advances once per complete combat round',()=>{
 const s=field();const once=endTurn(s),twice=endTurn(once);
 assert.equal(once.npcs[0].hp,46);assert.equal(twice.npcs[0].hp,42);assert.equal(once.npcs[0].bleeding,4);assert.equal(twice.npcs[0].bleeding,4);validateBattleSnapshot(twice);
});

test('delayed bleeding deaths keep the actual prior player, enemy, militia or unknown origin',()=>{
 for(const sourceCase of ['player','enemy','militia','unknown']){
  const s=field({}, {hp:12,energy:100,unconscious:true,bleeding:0,bandaged:88,bleedSource:undefined});
  const actor=sourceCase==='unknown'?null:sourceCase==='enemy'?s.units[1]:s.units[0];if(sourceCase==='militia')actor.militia=true;
  applyCivilianHarm(s,s.npcs[0],{source:actor,damage:2,intentional:true});const original=structuredClone(s.npcs[0].bleedSource);
  const restored=validateBattleSnapshot(JSON.parse(JSON.stringify(s)));restored.units=restored.units.filter(u=>u.id!==actor?.id);
  advanceCivilianBleeding(restored,restored.npcs[0],10);
  assert.equal(restored.npcs[0].hp,0);assert.equal(restored.npcs[0].bleeding,0);assert.equal(restored.npcs[0].bleedSource,undefined);assert.equal(restored.npcs[0].stance,'prone');
  const death=civilianIncidents(restored.npcs[0]).at(-1);for(const key of ['attackerId','side','militia','intentional'])assert.equal(death[key],original[key]);
  const before=structuredClone(restored.npcs[0]);advanceCivilianBleeding(restored,restored.npcs[0],10);assert.deepEqual(restored.npcs[0],before);noSoldierFields(restored.npcs[0]);
 }
});

test('new damage binds source metadata to the actual actor and later wounds replace the bleed origin',()=>{
 const s=field({}, {hp:100,energy:100,unconscious:false,bleeding:0,bandaged:0,bleedSource:undefined});
 applyCivilianHarm(s,s.npcs[0],{source:{id:'e',side:'player',militia:true},damage:20,intentional:true});
 assert.deepEqual(s.npcs[0].bleedSource,{attackerId:'e',side:'enemy',militia:false,intentional:true});assert.equal(civilianIncidents(s.npcs[0]).length,0);
 applyCivilianHarm(s,s.npcs[0],{source:s.units[0],damage:10});assert.equal(s.npcs[0].bleedSource.side,'player');
 applyCivilianHarm(s,s.npcs[0],{source:{id:'absent',side:'player'},damage:5});assert.deepEqual(s.npcs[0].bleedSource,unknown());
 advanceCivilianBleeding(s,s.npcs[0],100);assert.equal(civilianIncidents(s.npcs[0]).at(-1).side,'unknown');
});

test('legacy absent wound fields stay stable and pure breath loss does not open bleeding',()=>{
 const s=field({}, {hp:70,energy:100,unconscious:false});for(const key of ['bleeding','bandaged','bleedSource','civilianWoundVersion'])delete s.npcs[0][key];
 const legacy=validateBattleSnapshot(JSON.parse(JSON.stringify(s))),before=structuredClone(legacy.npcs[0]);advanceCivilianBleeding(legacy,legacy.npcs[0],100);assert.deepEqual(legacy.npcs[0],before);assert.equal(plan(legacy).valid,false);
 applyCivilianHarm(legacy,legacy.npcs[0],{source:legacy.units[0],damage:0,breathLoss:10});assert.equal(legacy.npcs[0].hp,70);assert.equal(legacy.npcs[0].bleeding,undefined);assert.equal(legacy.npcs[0].bleedSource,undefined);assert.equal(legacy.npcs[0].civilianHarm,undefined);
 applyCivilianHarm(legacy,legacy.npcs[0],{source:legacy.units[0],damage:10});assert.equal(legacy.npcs[0].bandaged,30);assert.equal(legacy.npcs[0].bleeding,1);
});

test('saved wound metadata rejects impossible bleeding, missing sources and false present-actor blame',()=>{
 const s=field();applyCivilianHarm(s,s.npcs[0],{source:s.units[0],damage:1});
 for(const mutate of [n=>{n.bleeding=-1;},n=>{n.bleeding=11;},n=>{n.bleeding=1.5;},n=>{n.bandaged=101;},n=>{n.bandaged=100;},n=>{n.civilianWoundVersion=2;},n=>{delete n.bleedSource;},n=>{delete n.bleedSource;delete n.civilianWoundVersion;},n=>{n.bleedSource.side='enemy';},n=>{n.bleedSource.militia=true;},n=>{n.bleedSource.extra=true;},n=>{delete n.civilianHarm;}]){
  const broken=structuredClone(s);mutate(broken.npcs[0]);assert.throws(()=>validateBattleSnapshot(broken));
 }
 const absent=structuredClone(s);absent.units=absent.units.filter(u=>u.id!=='p');assert.doesNotThrow(()=>validateCivilianWounds(absent.npcs[0],absent));
 const dead=structuredClone(s);advanceCivilianBleeding(dead,dead.npcs[0],100);delete dead.npcs[0].civilianHarm;assert.throws(()=>validateBattleSnapshot(dead),/registro.*muerte/);
 const treated=use(field({x:5}));delete treated.npcs[0].civilianWoundVersion;assert.throws(()=>validateBattleSnapshot(treated),/versión.*heridas/);
});
