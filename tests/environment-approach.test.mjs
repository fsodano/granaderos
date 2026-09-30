import {AMMUNITION_TYPES} from '../game/ammunition-types.js';
const AMMO='inventory:ammo:musket_75';
const ammoStack=count=>({item:AMMO,kind:'ammunition',ammoType:'musket_75',name:AMMUNITION_TYPES.musket_75.name,count,weight:.04});
import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,environmentUsePreview,environmentPreview,canSee,movementStepCost,movementEnergy} from '../game/tactical.js';
import {targetPreview,nearbyEnvironmentModel} from '../game/ja2-hud.js';
import {environmentTargetSummary} from '../game/environment-interactions.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

const ref={kind:'door',id:'store'},chestRef={kind:'container',id:'cache'};
const tool=(toolKey,extra={})=>({count:1,weight:.5,itemType:'tool',toolKey,condition:100,...extra});
function field(actor={},extra={}){
  const tiles=Array.from({length:160},(_,i)=>({x:i%16,y:Math.floor(i/16),type:i%16===10?'wall':'grass',blocked:i%16===10,blocksSight:i%16===10,cover:0}));
  Object.assign(tiles.find(p=>p.x===6&&p.y===2),{type:'door',doorId:'store',open:false,locked:true,keyId:'store-key',lockDifficulty:25,lockIntegrity:100,blocked:true,blocksSight:true});
  const s=createBattle([{id:'p',x:2,y:2,facing:2,mechanical:90,strength:90,dexterity:90,wisdom:90,experienceLevel:8,activeSlot:'tool',activeTool:'inventory:key',inventory:{key:tool('key',{keyId:'store-key',condition:73})},...actor}],{
    width:16,height:10,seed:45,tiles,props:[{id:'cache',type:'chest',x:6,y:5,blocksMovement:true,open:false,locked:false,contents:[ammoStack(12)]}],enemies:[{id:'e',x:14,y:8,patrol:false,overwatch:false}],...extra});
  s.units[0].ap=actor.ap??100;for(const u of s.units.filter(u=>u.side==='enemy'))u.ap=0;return s;
}
const plan=(s,target=ref,verb)=>environmentUsePreview(s,s.units[0],target,verb);
const use=(s,target=ref,verb)=>actBattle(s,{type:'useItem',unitId:'p',environment:{...target,...(verb?{verb}:{})}});
const door=s=>s.tiles.find(p=>p.doorId==='store');
function rejected(s,target=ref,verb){
  const after=use(s,target,verb);assert.ok(after.lastError);
  for(const key of ['units','tiles','props','seed','elapsedSeconds','groundItems'])assert.deepEqual(after[key],s[key],key);
}

test('a held-key target pays the same approach and unlock as ordinary local orders',()=>{
  const s=field(),p=plan(s),original=structuredClone(s);
  assert.equal(p.valid,true);assert.equal(p.movePa,24);assert.equal(p.actionPa,4);assert.equal(p.pa,28);assert.equal(p.action.verb,'unlock');
  const manual=actBattle(actBattle(s,{type:'move',unitId:'p',...p.destination}),p.action),after=use(s);
  assert.deepEqual(after,manual);assert.equal(after.units[0].ap,72);assert.equal(after.units[0].x,5);assert.equal(after.elapsedSeconds,6);
  assert.equal(door(after).locked,false);assert.equal(door(after).open,false);assert.equal(door(after).blocked,true);
  assert.deepEqual(after.units[0].inventory.key,s.units[0].inventory.key);assert.deepEqual(s,original);
  const opened=use(after);assert.equal(door(opened).open,true);assert.equal(door(opened).blocked,false);assert.equal(opened.units[0].ap,68);
  assert.doesNotThrow(()=>validateBattleSnapshot(opened));
});

test('normal target previews include total AP while direct environment aliases remain local',()=>{
  const s=field(),p=targetPreview(s,s.units[0],door(s));assert.equal(p.valid,true);assert.equal(p.pa,28);assert.equal(p.remaining,72);assert.equal(p.actionLabel,'Acercarse y usar llave');assert.match(p.coverNote,/24 PA.*4 PA.*contacto/);
  assert.equal(environmentPreview(s,s.units[0],ref,'unlock').valid,false);
  const local=actBattle(s,{type:'environment',unitId:'p',...ref,verb:'unlock'});assert.ok(local.lastError);assert.deepEqual(local.units,s.units);
  const close=use(s),model=nearbyEnvironmentModel(close,close.units[0],{targetKey:'door:store'});assert.equal(model.preview.valid,true);assert.equal(model.preview.pa,4);
});

test('preflight rejects invalid explicit tools, AP, visibility, body state and blocked closing space atomically',()=>{
  const short=field({ap:27});assert.equal(plan(short).pa,28);assert.equal(plan(short).valid,false);rejected(short);
  rejected(field({inventory:{key:tool('key',{keyId:'other'})}}));
  rejected(field({activeSlot:'primary',activeTool:undefined}),ref,'unlock');
  for(const patch of [{knockedDown:true},{entangled:true},{energy:0},{facing:6}])rejected(field(patch));
  const blocked=field();Object.assign(door(blocked),{open:true,locked:false,blocked:false,blocksSight:false});Object.assign(blocked.units[1],{x:6,y:2});rejected(blocked,ref,'close');
  const wall=field();for(const p of wall.tiles.filter(p=>p.x===4))Object.assign(p,{type:'wall',blocked:true,blocksSight:true});rejected(wall);
  rejected(field(),{kind:'door',id:'gone'});
});

test('held lock picks and a crowbar keep actual RNG, wear and lock damage after a paid approach',()=>{
  for(const [toolKey,wear] of [['lockpick',2],['crowbar',3]]){
    const s=field({activeTool:'inventory:work',inventory:{work:tool(toolKey)}}),p=plan(s);
    const after=use(s),manual=actBattle(actBattle(s,{type:'move',unitId:'p',...p.destination}),p.action);
    assert.deepEqual(after,manual);assert.equal(after.units[0].inventory.work.condition,100-wear);assert.equal(after.units[0].ap,100-p.pa);assert.notEqual(after.seed,s.seed);
    assert.equal(door(after).open,false);if(toolKey==='lockpick')assert.equal(door(after).locked,false);else assert.ok(door(after).lockIntegrity<100);
  }
});

test('unknown traps produce the same approach preview and trigger only on actual use',()=>{
  const s=field(),hidden=structuredClone(s);door(hidden).trap={type:'alarm',difficulty:50,armed:true,discoveredBy:[]};
  assert.deepEqual(plan(hidden),plan(s));assert.deepEqual(environmentTargetSummary(s.units[0],door(hidden)),environmentTargetSummary(s.units[0],door(s)));
  const after=use(hidden);assert.equal(after.units[0].x,5);assert.equal(after.units[0].ap,72);assert.equal(door(after).trap.armed,false);assert.equal(door(after).locked,true);assert.equal(door(after).open,false);
  const retry=use(after);assert.equal(door(retry).locked,false);assert.equal(retry.units[0].ap,68);
});

test('a held plier approach disarms a known trap once and survives snapshot restoration',()=>{
  const s=field({activeTool:'inventory:pliers',inventory:{pliers:tool('pliers')}});door(s).trap={type:'alarm',difficulty:0,armed:true,discoveredBy:['player']};
  const p=plan(s);assert.equal(p.pa,42);assert.equal(p.action.verb,'disarm');
  const after=use(s);assert.equal(after.units[0].ap,58);assert.equal(after.units[0].inventory.pliers.condition,98);assert.equal(door(after).trap.armed,false);assert.equal(door(after).locked,true);
  const restored=validateBattleSnapshot(JSON.parse(JSON.stringify(after)));assert.deepEqual(endTurn(restored),endTurn(after));rejected(after);
  const unknown=structuredClone(s);door(unknown).trap.discoveredBy=[];rejected(unknown);assert.equal(plan(unknown).reason,plan(field({activeTool:'inventory:pliers',inventory:{pliers:tool('pliers')}})).reason);
});

test('container targeting uses its footprint, opens once and leaves finite contents for local pickup',()=>{
  const s=field({x:2,y:6,activeSlot:'primary',activeTool:undefined});s.props[0].footprint={width:2,height:2};
  const p=plan(s,chestRef);assert.equal(p.valid,true);assert.equal(p.pa,28);assert.equal(p.destination.x,5);assert.equal(p.destination.y,6);
  let previous=s.units[0];for(const step of p.path){assert.ok(Number.isFinite(movementStepCost(s,s.units[0],previous,step)));previous=step;}
  const after=use(s,chestRef);assert.equal(after.props[0].open,true);assert.deepEqual(after.props[0].contents,s.props[0].contents);
  const taken=actBattle(after,{type:'containerLoot',unitId:'p',...chestRef,index:0,count:5});assert.equal(taken.lastError,null);assert.equal(taken.units[0].ammo,s.units[0].ammo+5);assert.equal(taken.props[0].contents[0].count,7);
});

test('exploration charges each step and the environment action while collapse stops before use',()=>{
  const s=field({}, {exploration:true}),after=use(s);assert.equal(after.elapsedSeconds,10);assert.equal(after.units[0].ap,100);assert.equal(door(after).locked,false);
  const exhausted=field({},{exploration:true});exhausted.units[0].energy=2*movementEnergy(exhausted.units[0],{type:'grass'},true);
  const stopped=use(exhausted);assert.equal(stopped.units[0].unconscious,true);assert.equal(stopped.units[0].x,4);assert.equal(stopped.units[0].ap,0);assert.equal(door(stopped).locked,true);assert.deepEqual(stopped.units[0].inventory,exhausted.units[0].inventory);assert.equal(stopped.elapsedSeconds,6);
});

test('an enemy reaction during approach stops before the tool is used',()=>{
  const s=field({agility:30,experienceLevel:1},{enemies:[{id:'e',x:5,y:4,facing:0,weapon:1806,marksmanship:70,agility:100,experienceLevel:10,patrol:false}]});s.units[1].ap=6;
  const after=use(s);assert.equal(after.lastError,null);assert.equal(after.units[1].reactionTurn,1);assert.equal(door(after).locked,true);assert.equal(after.units[0].inventory.key.condition,73);assert.ok(after.units[0].x>2);assert.ok(after.units[0].ap<100);assert.equal(after.elapsedSeconds,6);
});

test('a known unconscious occupant cannot become the chosen contact cell',()=>{
  const s=field({x:4});s.units.push({...structuredClone(s.units[1]),id:'body',x:5,y:2,unconscious:true,hp:10});
  assert.equal(canSee(s,s.units[0],door(s)),true);const p=plan(s);assert.equal(p.valid,true);assert.ok(p.movePa>0);assert.notDeepEqual(p.destination,{x:5,y:2});
  const after=use(s);assert.equal(after.lastError,null);assert.equal(door(after).locked,false);assert.deepEqual({x:after.units[0].x,y:after.units[0].y},p.destination);
});


test('an environment approach within a real player interrupt restores and resumes exactly',()=>{
  // A sabre preserves the approaching-enemy trigger; a facon can now throw.
  const s=field({x:1,y:1,agility:100,experienceLevel:10},{enemies:[{id:'e',x:7,y:1,weapon:1809,agility:30,experienceLevel:1,patrol:false}]});s.units[1].ap=24;
  const oldDoor=door(s),data={...oldDoor};Object.assign(oldDoor,{type:'grass',blocked:false,blocksSight:false});delete oldDoor.doorId;
  Object.assign(s.tiles.find(p=>p.x===4&&p.y===4),data,{x:4,y:4});
  const paused=endTurn(s);assert.equal(paused.phase,'interrupt');assert.ok(paused.interrupt.unitIds.includes('p'));
  const p=plan(paused),after=use(paused);assert.equal(p.valid,true);assert.equal(after.lastError,null);assert.equal(after.phase,'interrupt');assert.equal(door(after).locked,false);assert.equal(after.units[0].ap,paused.units[0].ap-p.pa);assert.equal(after.elapsedSeconds,6);
  assert.deepEqual(use(validateBattleSnapshot(JSON.parse(JSON.stringify(paused)))),after);
  assert.deepEqual(endTurn(validateBattleSnapshot(JSON.parse(JSON.stringify(after)))),endTurn(after));
});
