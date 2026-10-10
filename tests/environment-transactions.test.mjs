import {AMMUNITION_TYPES} from '../game/ammunition-types.js';
const AMMO='inventory:ammo:musket_75';
const ammoStack=count=>({item:AMMO,kind:'ammunition',ammoType:'musket_75',name:AMMUNITION_TYPES.musket_75.name,count,weight:.04});
import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle, actBattle, presentedActBattle, getReachable, environmentTargetAt, environmentPreview, environmentUsePreview, containerLootPreview, canSee} from '../game/tactical.js';
import {nearbyEnvironmentModel,targetPreview} from '../game/ja2-hud.js';
import {isInteriorVisible} from '../game/tactical-visibility.js';
import {TOOL_TYPES, environmentTargetSummary, heldTool} from '../game/environment-interactions.js';
import {inventoryUsage} from '../game/tactical-inventory.js';
import {makeOutfit} from '../game/outfits.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {enterSector} from '../game/world.js';
import {initialCampaign} from './legacy-campaign-fixture.mjs';
import {dispatchCampaign} from '../game/campaign.js';
import {syncBattleTime} from '../game/time.js';
import {encodeSave, decodeSave} from '../game/save.js';
import {takeFiniteCache} from './finite-cache-driver.mjs';

const keyRecord = {count: 1, weight: .2, itemType: 'tool', toolKey: 'key', condition: 73, keyId: 'store'};
const toolRecord = toolKey => ({count: 1, weight: .5, itemType: 'tool', toolKey, condition: 100});
const soldier = state => state.units.find(u => u.id === 'p');
const storedRecord = stack => {const record=structuredClone(stack);delete record.item;return record;};
function field(extra = {}, chestExtra = {}) {
  const tiles = Array.from({length: 216}, (_, i) => ({x: i % 24, y: Math.floor(i / 24), type: 'grass', blocked: false, cover: 0}));
  const wallEdges=[{id:'test-edge',x:2,y:3,axis:'y',type: 'door', doorId: 'test-door', open: false, locked: true, keyId: 'store', lockDifficulty: 25, lockIntegrity: 100, blocked: true, blocksSight: true}];
  return createBattle([{id: 'p', x: 1, y: 3, mechanical: 90, dexterity: 90, wisdom: 90, experienceLevel: 8, inventory: {key: {...keyRecord}}, ...extra}], {width: 24, height: 9, tiles, wallEdges,seed: 45,
    props: [{id: 'test-chest', type: 'chest', x: 1, y: 4, blocksMovement: true, open: false, locked: false, contents: [ammoStack(12)], ...chestExtra}],
    enemies: [{id: 'guard', x: 22, y: 7, overwatch: false}]});
}
function order(state, action, id = 'p') {
  const next = actBattle(state, {unitId: id, ...action});
  assert.equal(next.lastError, null, `${action.type}: ${next.lastError}`);
  return next;
}
function rejectUnchanged(state, action) {
  const next = actBattle(state, {unitId: 'p', ...action});
  assert.ok(next.lastError);
  for (const key of ['units', 'tiles', 'wallEdges','props', 'groundItems', 'seed', 'elapsedSeconds']) assert.deepEqual(next[key], state[key], key);
  return next;
}
const doorRef = {kind: 'door', id: 'test-door'}, chestRef = {kind: 'container', id: 'test-chest'};

test('actual held key actions pay equip/unlock/open once and persist door collision', () => {
  let state = field(); const original = structuredClone(state);
  assert.equal(environmentPreview(state, soldier(state), doorRef, 'unlock').valid, false);
  state = order(state, {type: 'weapon', slot: 'tool', toolKey: 'inventory:key'});
  assert.equal(soldier(state).activeSlot, 'tool'); assert.equal(heldTool(soldier(state)).condition, 73);
  const ap = soldier(state).ap, seed = state.seed;
  state = order(state, {type: 'useItem', environment: {...doorRef, verb: 'unlock'}});
  assert.equal(soldier(state).ap, ap - 4); assert.equal(state.seed, seed);
  state = order(state, {type: 'environment', ...doorRef, verb: 'open'});
  const opened = state.wallEdges.find(t => t.doorId === doorRef.id);
  assert.equal(opened.open, true); assert.equal(opened.locked, false); assert.equal(opened.blocked, false); assert.equal(opened.blocksSight, false);
  assert.equal(soldier(state).inventory.key.condition, 73); assert.equal(soldier(state).inventory.key.count, 1);
  assert.equal(soldier(state).ap, ap - 8);
  assert.doesNotThrow(() => validateBattleSnapshot(state));
  assert.equal(original.wallEdges.find(t => t.doorId === doorRef.id).locked, true);
});

test('illegal environment commands reject atomically before RNG, wear, AP, contents or time', () => {
  const state = field({activeSlot: 'tool', activeTool: 'inventory:key'});
  rejectUnchanged(state, {type: 'environment', ...doorRef, verb: 'pick'});
  rejectUnchanged(state, {type: 'environment', ...doorRef, verb: 'open'});
  rejectUnchanged(state, {type: 'environment', ...chestRef, verb: 'disarm'});
  rejectUnchanged({...state, units: state.units.map(u => u.id === 'p' ? {...u, ap: 3} : u)}, {type: 'environment', ...doorRef, verb: 'unlock'});
  rejectUnchanged({...state, units: state.units.map(u => u.id === 'p' ? {...u, x: 10} : u)}, {type: 'environment', ...doorRef, verb: 'unlock'});
  rejectUnchanged(state, {type: 'containerLoot', ...chestRef, index: 0, count: 1});
});

// Declared legacy save boundary, not acquired tool stock or a campaign win.
// Native health, skills, weapons, charges and funds remain unchanged. The
// selected tool stack and zero-quantity historical keys exist before the first
// visit/save admission. No inventory or geometry is changed after admission.
function heldToolCapacityPair(toolKey,{keys=1000,count=2,remote=false}={}){
  const declared=initialCampaign(45),record=declared.operativeState[10];
  record.inventory={...record.inventory,work:{count,weight:TOOL_TYPES[toolKey].weight,itemType:'tool',toolKey,condition:63,...(toolKey==='key'?{keyId:'store'}:{})}};
  const empty=keys-Object.keys(record.inventory).length;
  for(let i=0;i<empty;i++)record.inventory[`empty-${i}`]=0;
  record.activeSlot='tool';record.activeTool='inventory:work';
  const campaign=dispatchCampaign(declared,{type:'visitSector'});assert.equal(campaign.lastError,null);
  const request=campaign.pendingBattle,width=24,height=9;
  const tiles=Array.from({length:width*height},(_,i)=>({x:i%width,y:Math.floor(i/width),type:'grass',blocked:false,cover:0}));
  const wallEdges=[{id:'test-edge',x:2,y:3,axis:'y',type:'door',doorId:'test-door',open:false,locked:true,keyId:'store',lockDifficulty:25,lockIntegrity:1,blocked:true,blocksSight:true}];
  const battle=createBattle(request.squad.map((u,i)=>({...u,x:u.id===10?(remote?6:1):19+i,y:u.id===10?3:1,facing:u.id===10?(remote?6:2):6})),{
    ...request,width,height,tiles,wallEdges,buildings:[],decor:[],
    props:[{id:'test-chest',type:'chest',x:1,y:4,open:false,locked:false,contents:[],trap:{type:'alarm',difficulty:25,armed:true,discoveredBy:['player']}}],
    npcs:request.npcs.map((n,i)=>({...n,x:19+i,y:7})),
  });
  const pair=decodeSave(encodeSave(campaign,battle));
  assert.equal(Object.keys(pair.battle.units.find(u=>u.id==='10').inventory).length,keys);
  assert.deepEqual(pair,{campaign,battle});
  return pair;
}
const capacityActor=pair=>pair.battle.units.find(u=>u.id==='10');
const capacityRef=verb=>verb==='disarm'?chestRef:doorRef;
function capacityStep(pair,action){
  const before=structuredClone(pair),ordinary=actBattle(pair.battle,action);
  assert.equal(ordinary.lastError,null,ordinary.lastError);
  assert.deepEqual(presentedActBattle(pair.battle,action).state,ordinary);
  assert.deepEqual(pair,before);
  const synced=syncBattleTime(pair.campaign,ordinary);assert.equal(synced.error,null,synced.error);
  const restored=decodeSave(encodeSave(synced.campaign,synced.battle));
  assert.deepEqual(restored,{campaign:synced.campaign,battle:synced.battle});
  const replayed=syncBattleTime(before.campaign,actBattle(before.battle,action));assert.equal(replayed.error,null);
  assert.deepEqual(decodeSave(encodeSave(replayed.campaign,replayed.battle)),restored);
  return restored;
}

test('official 1000-key legacy tool stacks reject pick, pry and disarm before local use or paid approach',()=>{
  for(const [verb,toolKey]of [['pick','lockpick'],['pry','crowbar'],['disarm','pliers']])for(const remote of [false,true]){
    const pair=heldToolCapacityPair(toolKey,{remote}),before=structuredClone(pair),ref=capacityRef(verb);
    const preview=environmentUsePreview(pair.battle,capacityActor(pair),ref,verb);
    assert.equal(preview.valid,false);assert.match(preview.reason,/separar la herramienta/);
    assert.deepEqual(preview.path,[]);assert.equal(preview.movePa,0);
    const actions=[{type:'useItem',unitId:'10',environment:{...ref,verb}},...(!remote?[{type:'environment',unitId:'10',...ref,verb}]:[])];
    for(const action of actions){
      const after=actBattle(pair.battle,action);assert.match(after.lastError,/separar la herramienta/);
      assert.deepEqual(presentedActBattle(pair.battle,action).state,after);
      assert.deepEqual(after.log,[...pair.battle.log,after.lastError]);
      assert.deepEqual({...after,lastError:pair.battle.lastError,log:pair.battle.log},pair.battle,'only the ordinary refusal message may change');
      assert.deepEqual(decodeSave(encodeSave(pair.campaign,after)),{campaign:pair.campaign,battle:after});
    }
    assert.deepEqual(pair,before);
  }
});

test('official saves retain one-tool wear at the key cap, a legal last-slot split, and zero-wear keys without a split',()=>{
  for(const [verb,toolKey,wear]of [['pick','lockpick',2],['pry','crowbar',3],['disarm','pliers',2],['unlock','key',0]]){
    const ref=capacityRef(verb);
    for(const [keys,count]of wear?[[1000,1],[999,2]]:[[1000,2]]){
      const start=heldToolCapacityPair(toolKey,{keys,count}),before=capacityActor(start),preview=environmentPreview(start.battle,before,ref,verb);
      assert.equal(preview.valid,true,preview.reason);
      const action={type:'environment',unitId:'10',...ref,verb},after=capacityStep(start,action),actual=capacityActor(after);
      const selected=actual.activeTool.slice(10),split=wear>0&&count>1;
      assert.equal(Object.keys(actual.inventory).length,keys+Number(split));
      assert.equal(selected==='work',!split);
      assert.equal(actual.inventory[selected].condition,63-wear);assert.equal(actual.inventory[selected].toolKey,toolKey);
      assert.equal(actual.inventory[selected].weight,before.inventory.work.weight);
      assert.equal(actual.inventory.work.count,count-Number(split));
      if(split)assert.equal(actual.inventory.work.condition,63);
      assert.equal(Object.values(actual.inventory).filter(r=>r?.toolKey===toolKey).reduce((sum,r)=>sum+r.count,0),count);
      for(const [key,value]of Object.entries(before.inventory))if(key!=='work')assert.deepEqual(actual.inventory[key],value);
      for(const key of ['hp','energy','loaded','ammo','ammunition','condition'])assert.deepEqual(actual[key],before[key]);
      assert.equal(after.campaign.resources.treasury,start.campaign.resources.treasury);
      assert.equal(after.battle.elapsedSeconds,start.battle.elapsedSeconds+Math.max(1,Math.ceil(preview.pa*.06)));
      if(wear)assert.notEqual(after.battle.seed,start.battle.seed);else assert.equal(after.battle.seed,start.battle.seed);
    }
  }
});

test('closed target summaries and inspection previews keep trap and contents private', () => {
  const normal = field(), hidden = field({}, {trap: {type: 'alarm', difficulty: 60, armed: true, discoveredBy: []}});
  const a = environmentTargetAt(normal, {x: 1, y: 4}), b = environmentTargetAt(hidden, {x: 1, y: 4});
  assert.equal(a.kind, 'container'); assert.deepEqual(environmentTargetSummary(soldier(normal), a), environmentTargetSummary(soldier(hidden), b));
  assert.equal(environmentTargetSummary(soldier(hidden), b).contents, undefined);
  assert.deepEqual(environmentPreview(normal, soldier(normal), chestRef, 'inspect'), environmentPreview(hidden, soldier(hidden), chestRef, 'inspect'));
  assert.equal(environmentPreview(hidden, soldier(hidden), chestRef, 'inspect').chance, null);
});

test('unknown room tags disclose no container state, source token or approach until the interior is known',()=>{
  // Declared restored legacy interior: the room tag is valid saved metadata
  // without building topology. Geometry alone cannot reveal its container.
  const source={item:'inventory:crowbar',itemType:'tool',toolKey:'crowbar',count:1,weight:2.5,condition:60,instanceId:'declared:private-crowbar'};
  const hidden=createBattle([{id:'p',x:1,y:3,facing:2,weapon:1805}],{width:14,height:8,seed:45,
    tiles:Array.from({length:112},(_,i)=>({x:i%14,y:Math.floor(i/14),type:'grass',blocked:false,blocksSight:false,cover:0})),
    props:[{id:'private-chest',type:'chest',x:2,y:3,roomId:'private',open:true,locked:false,contents:[source]}],
    enemies:[{id:'e',x:12,y:6,patrol:false,overwatch:false}]});
  assert.doesNotThrow(()=>validateBattleSnapshot(hidden));
  const ref={kind:'container',id:'private-chest'},absent={...hidden,props:[]};
  assert.equal(canSee(hidden,soldier(hidden),hidden.props[0]),true);
  assert.equal(isInteriorVisible(hidden,hidden.props[0],new Set(hidden.revealedRooms)),false);
  for(const patch of [{},{open:false,locked:true,lockDifficulty:90,trap:{type:'alarm',difficulty:80,armed:true,discoveredBy:['player']}}]){
    const privateState=structuredClone(hidden);Object.assign(privateState.props[0],patch);
    assert.deepEqual(nearbyEnvironmentModel(privateState,soldier(privateState)),nearbyEnvironmentModel(absent,soldier(absent)));
    const hover=targetPreview(privateState,soldier(privateState),{x:2,y:3},{mode:'move'});assert.notEqual(hover?.name,'Cofre');
    for(const verb of [undefined,'inspect','open','pry','disarm']){
      assert.deepEqual(environmentPreview(privateState,soldier(privateState),ref,verb),environmentPreview(absent,soldier(absent),ref,verb));
      const approach=environmentUsePreview(privateState,soldier(privateState),ref,verb);
      assert.deepEqual(approach,environmentUsePreview(absent,soldier(absent),ref,verb));
      assert.equal(approach.valid,false);assert.deepEqual(approach.path,[]);assert.equal(approach.destination,null);
      rejectUnchanged(privateState,{type:'useItem',environment:{...ref,...(verb?{verb}:{})}});
    }
    const pickup=containerLootPreview(privateState,soldier(privateState),ref,0,1);
    assert.deepEqual(pickup,containerLootPreview(absent,soldier(absent),ref,0,1));
    assert.equal(pickup.valid,false);assert.equal(pickup.action.expectedSource,undefined);
    rejectUnchanged(privateState,{type:'containerLoot',...ref,index:0,count:1});
  }
  const known=structuredClone(hidden);known.revealedRooms=['private'];
  assert.doesNotThrow(()=>validateBattleSnapshot(known));
  const model=nearbyEnvironmentModel(known,soldier(known));assert.equal(model.contents[0].label,'Barreta');
  const selected=containerLootPreview(known,soldier(known),ref,0,1);assert.equal(selected.valid,true);assert.ok(selected.action.expectedSource);
  const taken=order(known,selected.action);assert.deepEqual(taken.props[0].contents,[]);
  assert.deepEqual(Object.values(soldier(taken).inventory).find(record=>record.instanceId===source.instanceId),storedRecord(source));
  assert.equal(soldier(taken).ap,soldier(known).ap-selected.pa);assert.equal(taken.seed,known.seed);
  assert.equal(taken.elapsedSeconds,known.elapsedSeconds+6);
});

test('actual hidden injury trap uses shared wounds and breath once, with no free opening', () => {
  let state = field({}, {trap: {type: 'injury', difficulty: 40, armed: true, discoveredBy: [], damage: 18, breathLoss: 25}});
  state = order(state, {type: 'environment', ...chestRef, verb: 'open'});
  assert.equal(soldier(state).hp, 82); assert.equal(soldier(state).energy, 75); assert.ok(soldier(state).bleeding > 0);
  assert.equal(soldier(state).ap, 96); assert.equal(state.props[0].trap.armed, false); assert.equal(state.props[0].open, false);
  assert.deepEqual(state.props[0].trap.discoveredBy, ['player']);
  state = order(state, {type: 'environment', ...chestRef, verb: 'open'});
  assert.equal(soldier(state).hp, 82); assert.equal(state.props[0].open, true);
  assert.doesNotThrow(() => validateBattleSnapshot(state));
});

test('actual trap examination and disarm use one RNG draw and worn held pliers', () => {
  let state = field({inventory: {pliers: toolRecord('pliers')}, activeSlot: 'tool', activeTool: 'inventory:pliers'}, {trap: {type: 'alarm', difficulty: 0, armed: true, discoveredBy: []}});
  const initial = structuredClone(state);
  state = order(state, {type: 'environment', ...chestRef, verb: 'inspect'});
  assert.equal(state.seed, 1088807848); assert.equal(soldier(state).ap, 96);
  assert.deepEqual(state.props[0].trap.discoveredBy, ['player']);
  assert.equal(soldier(state).inventory.pliers.condition, 100);
  const preview = environmentPreview(state, soldier(state), chestRef, 'disarm'); assert.equal(preview.valid, true);
  state = order(state, preview.action);
  assert.equal(state.seed, 1547203303);
  assert.equal(soldier(state).ap, 78); assert.equal(soldier(state).inventory.pliers.condition, 98); assert.equal(state.props[0].trap.armed, false);
  assert.doesNotThrow(() => validateBattleSnapshot(state));
  assert.equal(initial.props[0].trap.armed, true);
});

test('partial container acquisition, capacity rejection and repeat pickup conserve contents', () => {
  let state = order(field({ammo: 238, priming: 0, flints: 0, medkits: 0, rations: 0, boleadoras: 0, torches: 0, inventory: {}}), {type: 'environment', ...chestRef, verb: 'open'});
  assert.equal(inventoryUsage(soldier(state)).used, 12);
  assert.equal(containerLootPreview(state, soldier(state), chestRef, 0, 3).valid, false);
  rejectUnchanged(state, {type: 'containerLoot', ...chestRef, index: 0, count: 3});
  const selected=containerLootPreview(state,soldier(state),chestRef,0,2).action;
  state = order(state, selected);
  assert.equal(soldier(state).ammo, 240); assert.equal(state.props[0].contents[0].count, 10); assert.equal(soldier(state).ap, 88);
  rejectUnchanged(state, selected);
  state = order(state, {type: 'drop', item: AMMO, count: 20});
  state = order(state, {type: 'containerLoot', ...chestRef, index: 0, count: 10});
  assert.equal(soldier(state).ammo, 230); assert.equal(state.groundItems[0].count, 20); assert.deepEqual(state.props[0].contents, []);
  assert.equal(soldier(state).ammo + state.groundItems[0].count, 250);
  rejectUnchanged(state, {type: 'containerLoot', ...chestRef, index: 0, count: 1});
});

test('a selected identified container object cannot be substituted by a shifted index or changed metadata',()=>{
  const crowbar={item:'inventory:used-crowbar',itemType:'tool',toolKey:'crowbar',count:1,weight:2.5,condition:60,instanceId:'declared:used-crowbar'};
  const shirt={item:'inventory:linen',...makeOutfit('linen_shirt',75),instanceId:'declared:linen'};
  const initial=field({inventory:{}},{contents:[crowbar,shirt]}),closed=containerLootPreview(initial,soldier(initial),chestRef,0,1);
  assert.equal(closed.valid,false);assert.equal(closed.action.expectedSource,undefined,'closed contents cannot enter a public source token');
  const opened=order(initial,{type:'environment',...chestRef,verb:'open'}),selected=containerLootPreview(opened,soldier(opened),chestRef,0,1).action;
  assert.equal(typeof selected.expectedSource,'string');
  for(const change of [stack=>stack.condition--,stack=>stack.instanceId='declared:replacement']){
    const changed=structuredClone(opened);change(changed.props[0].contents[0]);
    assert.match(rejectUnchanged(changed,selected).lastError,/Cambió el objeto/);
  }
  for(const expectedSource of [null,42,'obsolete'])assert.match(rejectUnchanged(opened,{...selected,expectedSource}).lastError,/Cambió el objeto/);
  const taken=order(opened,selected);assert.deepEqual(taken.props[0].contents,[shirt]);
  assert.match(rejectUnchanged(taken,selected).lastError,/Cambió el objeto/);
  assert.deepEqual(Object.values(soldier(taken).inventory).find(item=>item.instanceId===crowbar.instanceId),storedRecord(crowbar));
  const renewed=containerLootPreview(taken,soldier(taken),chestRef,0,1);assert.equal(renewed.valid,true);assert.notEqual(renewed.action.expectedSource,selected.expectedSource);
  const finished=order(validateBattleSnapshot(JSON.parse(JSON.stringify(taken))),renewed.action);
  assert.deepEqual(finished.props[0].contents,[]);assert.deepEqual(Object.values(soldier(finished).inventory).find(item=>item.instanceId===shirt.instanceId),storedRecord(shirt));
  assert.equal(soldier(finished).medkits,soldier(initial).medkits);assert.equal(soldier(finished).hp,soldier(initial).hp);
  assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(finished))),finished);
});

test('an observed weapon selection survives property reordering and official campaign save normalization',()=>{
  const campaign=dispatchCampaign(initialCampaign(),{type:'visitSector'});assert.equal(campaign.lastError,null);
  // Use the actual finite Retiro cache and normal approach/open orders. No
  // weapon, carrying room or scene result is added for the save boundary.
  const pair=takeFiniteCache({campaign,battle:enterSector(campaign.pendingBattle)},4,[]);
  const chest=pair.battle.props.find(prop=>prop.id==='retiro:armory-cache'),ref={kind:'container',id:chest.id};
  const actor=battle=>battle.units.find(unit=>unit.id==='4'),source=structuredClone(chest.contents[0]);
  assert.equal(source.item,'weapon');
  const selected=containerLootPreview(pair.battle,actor(pair.battle),ref,0,1);assert.equal(selected.valid,true);
  const reordered=structuredClone(pair),stack=reordered.battle.props.find(prop=>prop.id===chest.id).contents[0];
  reordered.battle.props.find(prop=>prop.id===chest.id).contents[0]=Object.fromEntries(Object.entries(stack).reverse());
  assert.notDeepEqual(Object.keys(reordered.battle.props.find(prop=>prop.id===chest.id).contents[0]),Object.keys(source));
  assert.equal(containerLootPreview(reordered.battle,actor(reordered.battle),ref,0,1).action.expectedSource,selected.action.expectedSource);
  const restored=decodeSave(encodeSave(reordered.campaign,reordered.battle));assert.deepEqual(restored,pair);
  const ordinary=actBattle(pair.battle,selected.action),loaded=actBattle(restored.battle,selected.action);
  assert.equal(loaded.lastError,null);assert.deepEqual(loaded,ordinary,'the pre-save guarded action admits only the same restored stack');
  assert.deepEqual(Object.values(actor(loaded).inventory).find(record=>record.instanceId===source.instanceId),storedRecord(source));
  assert.deepEqual(loaded.props.find(prop=>prop.id===chest.id).contents,chest.contents.slice(1));
  assert.equal(pair.battle.mode,'exploration');assert.equal(actor(loaded).ap,actor(pair.battle).ap);
  assert.equal(loaded.elapsedSeconds,pair.battle.elapsedSeconds+1);assert.equal(loaded.seed,pair.battle.seed);
  const synced=syncBattleTime(restored.campaign,loaded);assert.equal(synced.error,null);
  assert.deepEqual(decodeSave(encodeSave(synced.campaign,synced.battle)),{campaign:synced.campaign,battle:synced.battle});
});

test('dropping the actual equipped tool clears the hand and finite pickup retains its condition', () => {
  let state = field({activeSlot: 'tool', activeTool: 'inventory:key'});
  state = order(state, {type: 'drop', item: 'inventory:key'});
  assert.equal(soldier(state).activeSlot, 'unarmed'); assert.equal(soldier(state).activeTool, undefined);
  assert.equal(state.groundItems[0].condition, 73); assert.equal(state.groundItems[0].keyId, 'store');
  state = order(state, {type: 'loot', groundId: state.groundItems[0].id});
  assert.equal(soldier(state).inventory.key.condition, 73); assert.equal(soldier(state).activeSlot, 'unarmed');
  assert.doesNotThrow(() => validateBattleSnapshot(state));
});

function approach(state, id, target) {
  const u = state.units.find(unit => unit.id === String(id));
  const distance = p => Math.hypot(p.x - target.x, p.y - target.y);
  const point = getReachable(state, u).filter(p => distance(p) <= 1.5).sort((a, b) => a.cost - b.cost || a.y - b.y || a.x - b.x)[0];
  assert.ok(point, `A legal route must reach ${target.id ?? target.doorId}.`);
  return point.cost ? order(state, {type: 'move', x: point.x, y: point.y}, id) : state;
}

test('Yatasto tools can be acquired through a legal open-door path and its key unlocks the other leaf', () => {
  const request = {id: 'cache-visit', sector: 'yatasto', sceneId: 'yatasto', exploration: true, hour: 12, squad: [{id: 'p', mechanical: 80, dexterity: 80, strength: 80}]};
  let state = enterSector(request);
  const chest = state.props.find(p => p.type === 'chest'); assert.ok(chest);
  assert.equal(state.wallEdges.find(t => t.doorId === 'yatasto:door-left').open, true);
  const ref = {kind: 'container', id: chest.id};
  state = approach(state, 'p', chest);
  state = order(state, {type: 'environment', ...ref, verb: 'open'});
  while (state.props.find(p => p.id === chest.id).contents.length) state = order(state, {type: 'containerLoot', ...ref, index: 0, count: 1});
  assert.equal(inventoryUsage(soldier(state)).used, 9);
  assert.deepEqual(Object.values(soldier(state).inventory).filter(item => item.toolKey).map(item => item.toolKey).sort(), ['crowbar', 'key', 'lockpick', 'pliers']);
  const right = state.wallEdges.find(t => t.doorId === 'yatasto:door-right');
  state = approach(state, 'p', right);
  state = order(state, {type: 'weapon', slot: 'tool', toolKey: 'inventory:key'});
  state = order(state, {type: 'environment', kind: 'door', id: right.doorId, verb: 'unlock'});
  assert.equal(state.wallEdges.find(t => t.doorId === right.doorId).locked, false);
  const validated = validateBattleSnapshot(state);
  const returned = enterSector({...request, squad: validated.units.filter(u => u.side === 'player')}, validated);
  assert.deepEqual(returned.props.find(p => p.id === chest.id).contents, []);
  assert.equal(returned.wallEdges.find(t => t.doorId === right.doorId).locked, false);
  assert.equal(soldier(returned).activeTool, 'inventory:key');
});

test('full campaign report/save/reentry retains a worn active tool without regenerating it', () => {
  let campaign = dispatchCampaign(initialCampaign(), {type: 'visitSector'});
  assert.equal(campaign.lastError, null);
  let state = enterSector(campaign.pendingBattle), u = state.units.find(unit => unit.id === '4');
  u.inventory.pliers = toolRecord('pliers'); u.inventory.pliers.condition = 39;
  state = order(state, {type: 'weapon', slot: 'tool', toolKey: 'inventory:pliers'}, '4');
  let pair = syncBattleTime(campaign, state); assert.equal(pair.error, null);
  pair = decodeSave(encodeSave(pair.campaign, pair.battle));
  assert.equal(pair.battle.units.find(unit => unit.id === '4').activeTool, 'inventory:pliers');
  campaign = dispatchCampaign(pair.campaign, {type: 'leaveSector', battleId: pair.campaign.pendingBattle.id, sectorState: pair.battle, survivors: pair.battle.units.filter(unit => unit.side === 'player')});
  assert.equal(campaign.lastError, null);
  assert.equal(campaign.operativeState[4].activeSlot, 'tool'); assert.equal(campaign.operativeState[4].activeTool, 'inventory:pliers');
  campaign = decodeSave(encodeSave(campaign)).campaign;
  campaign = dispatchCampaign(campaign, {type: 'visitSector'}); assert.equal(campaign.lastError, null);
  state = enterSector(campaign.pendingBattle, campaign.sectorStates[campaign.location]);
  u = state.units.find(unit => unit.id === '4');
  assert.equal(u.activeTool, 'inventory:pliers'); assert.equal(heldTool(u).condition, 39); assert.equal(u.inventory.pliers.count, 1);
  assert.doesNotThrow(() => validateBattleSnapshot(state));
});

test('save validation rejects duplicate container identities and malformed hidden state or tools', () => {
  const state = field({inventory: {letter: {count: 1, weight: 0, instanceId: 'letter-one'}}}, {contents: [{item: 'inventory:letter', count: 1, weight: 0, instanceId: 'letter-one'}]});
  assert.throws(() => validateBattleSnapshot(state), /identidad/);
  const malformed = field({}, {trap: {type: 'alarm', difficulty: -1, armed: true, discoveredBy: []}});
  assert.throws(() => validateBattleSnapshot(malformed), /dificultad/);
  const tool = field({activeSlot: 'tool', activeTool: 'inventory:key'}); tool.units[0].inventory.key.keyId = '__proto__';
  assert.throws(() => validateBattleSnapshot(tool));
});
