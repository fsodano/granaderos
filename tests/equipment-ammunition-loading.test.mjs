import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,equipmentCursorPreview,reloadPlan} from '../game/tactical.js';
import {equipmentFingerprint,equipmentEndpoint,inventoryUsage,readItemStack} from '../game/tactical-inventory.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {planEquipmentCursorReturn} from '../game/equipment-cursor.js';
import {WEAPONS} from '../game/data.js';
import {weaponAmmoType,ammunitionByType} from '../game/ammunition-types.js';
const ammo=(type,count,name='Cartuchos elegidos')=>({kind:'ammunition',ammoType:type,count,weight:.04,name});
function field(extra={},exploration=true){
 return createBattle([{id:'p',name:'Tirador',x:2,y:2,weapon:1808,loaded:0,condition:71,weaponInstanceId:'right-gun',ammunitionVersion:2,ammo:0,blade:0,medkits:0,priming:50,torches:0,boleadoras:0,rations:0,flints:0,inventory:{chosen:ammo('pistol_69',5),reserve:ammo('pistol_69',4,'Otra pila')},...extra}],{width:24,height:8,exploration,seed:45,tiles:Array.from({length:192},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass',blocked:false,cover:0})),enemies:exploration?[]:[{id:'e',x:22,y:6,weapon:1813,loaded:0,ammo:0,patrol:false,overwatch:false}]});
}
const unit=b=>b.units[0],pocket=(u,item)=>inventoryUsage(u).slots.find(s=>s.entry?.item===item).id;
const slotGun=(u,id)=>{const e=equipmentEndpoint(u,id);return readItemStack(u,e.item,1);};
const pick=(b,count=5)=>actBattle(b,{type:'pickupEquipment',unitId:'p',sourceId:pocket(unit(b),'inventory:chosen'),count,expectedSource:equipmentFingerprint(unit(b),pocket(unit(b),'inventory:chosen'))});
const placement=(b,destinationId='hand:right',count)=>({type:'placeEquipment',unitId:'p',destinationId,count,expectedSource:equipmentFingerprint(unit(b),'cursor'),expectedDestination:equipmentFingerprint(unit(b),destinationId)});
const save=b=>{const n=JSON.parse(JSON.stringify(b));validateBattleSnapshot(n);return n;};
const placed=(b,id='hand:right',count)=>{const n=actBattle(b,placement(b,id,count));assert.equal(n.lastError,null,n.lastError);validateBattleSnapshot(n);return n;};

test('selected physical stack loads only the target gun and retains exact remainder and reserve',()=>{
 const original=field(),b=pick(original),before=structuredClone(b),u=unit(b),preview=equipmentCursorPreview(b,u,placement(b));
 assert.equal(preview.operation,'reload');assert.equal(preview.pa,0);assert.equal(preview.rounds,2);assert.equal(preview.seconds,4);
 const n=placed(b);assert.equal(unit(n).weapon,1808);assert.equal(unit(n).weaponInstanceId,'right-gun');assert.equal(unit(n).condition,71);assert.equal(unit(n).loaded,2);assert.equal(unit(n).equipmentCursor.stack.count,3);assert.equal(unit(n).equipmentCursor.stack.name,'Cartuchos elegidos');assert.equal(unit(n).inventory.reserve.count,4);assert.equal(unit(n).ammo,4);assert.equal(unit(n).ap,u.ap);assert.equal(n.elapsedSeconds-b.elapsedSeconds,preview.seconds);assert.equal(unit(n).priming,undefined);assert.deepEqual(b,before);save(n);
});

test('every firearm uses its compatible cartridge and the same reload rate as R',()=>{
 for(let weapon=1800;weapon<=1808;weapon++){
  const type=weaponAmmoType(weapon),b=field({weapon,inventory:{chosen:ammo(type,1)}},false),expected=reloadPlan(unit(b),b),picked=pick(b,1),preview=equipmentCursorPreview(picked,unit(picked),placement(picked)),n=placed(picked);
  assert.equal(preview.pa,Math.ceil(WEAPONS[weapon].reloadAP/WEAPONS[weapon].capacity));assert.equal(preview.pa,expected.pa);assert.equal(unit(n).loaded,1);assert.equal(unit(n).equipmentCursor,undefined);assert.equal(unit(n).ap,100-preview.pa);assert.equal(n.elapsedSeconds-b.elapsedSeconds,6);assert.equal(n.roundTimeCharged,true);
 }
});

test('either hand and a pocket can be loaded without changing the weapon being held',()=>{
 for(const host of ['left','pocket']){
  const gun={weapon:1808,count:1,loaded:1,reloadProgress:.5,condition:63,weight:1.6,instanceId:'target-gun',name:'Mi pistola'},extra=host==='left'?{offHand:gun}:{inventory:{chosen:ammo('pistol_69',5),gun}},initial=field({weapon:1805,loaded:1,...extra}),b=pick(initial),id=host==='left'?'hand:left':pocket(unit(b),'inventory:gun'),n=placed(b,id),loaded=slotGun(unit(n),id);
  assert.equal(unit(n).weapon,1805);assert.equal(unit(n).loaded,1);assert.equal(loaded.weapon,1808);assert.equal(loaded.loaded,2);assert.equal(loaded.reloadProgress,undefined);assert.equal(loaded.condition,63);assert.equal(loaded.instanceId,'target-gun');assert.equal(loaded.name,'Mi pistola');assert.equal(unit(n).equipmentCursor.stack.count,4);save(n);
 }
});

test('one selected round cannot borrow from the cursor remainder, reserve, or paired pistol',()=>{
 let b=field({offHand:{weapon:1808,count:1,loaded:0,condition:88,weight:1.6}});b=pick(b);const second=structuredClone(unit(b).offHand),n=placed(b,'hand:right',1);
 assert.equal(unit(n).loaded,1);assert.equal(unit(n).equipmentCursor.stack.count,4);assert.equal(unit(n).inventory.reserve.count,4);assert.deepEqual(unit(n).offHand,second);save(n);
});

test('partial combat work consumes AP but consumes cartridges only when a charge completes, including save and resume',()=>{
 let b=pick(field({},false));unit(b).ap=10;const cost=WEAPONS[1808].reloadAP/2,preview=equipmentCursorPreview(b,unit(b),placement(b)),n=placed(b);
 assert.equal(preview.pa,10);assert.equal(preview.partial,true);assert.equal(preview.rounds,0);assert.equal(unit(n).loaded,0);assert.equal(unit(n).reloadProgress,10/cost);assert.equal(unit(n).equipmentCursor.stack.count,5);assert.equal(unit(n).inventory.reserve.count,4);assert.equal(unit(n).ap,0);
 const resumed=save(n);unit(resumed).ap=100;const done=placed(resumed);assert.equal(unit(done).loaded,2);assert.equal(unit(done).reloadProgress,undefined);assert.equal(unit(done).equipmentCursor.stack.count,3);assert.equal(unit(done).ap,100-(WEAPONS[1808].reloadAP-10));assert.equal(done.elapsedSeconds,n.elapsedSeconds);
});

test('prone, gunsmith and helper bonuses match R without consuming its general reserve',()=>{
 for(const mode of ['prone','gunsmith','helper']){
  const b=field(mode==='prone'?{stance:'prone'}:mode==='gunsmith'?{traits:['gunsmith_artillerist']}:{},false);
  if(mode==='helper')b.units.push({...structuredClone(unit(b)),id:'2',x:3,inventory:{},weaponDropped:true,weapon:0,ammo:0,loaded:0,weaponInstanceId:undefined});
  const expected=reloadPlan(unit(b),b).pa,picked=pick(b),n=placed(picked);
  assert.equal(unit(n).ap,100-expected);assert.equal(unit(n).inventory.reserve.count,4);
  if(mode==='helper')assert.equal(expected,44);
 }
});

test('invalid, stale, full, incompatible, jammed and zero-AP loads reject without moving any item or advancing time',()=>{
 for(const problem of ['full','wrong','jammed','broken','zero','staleGun','staleAmmo','quantity','dead','blockedHand']){
  const b=pick(field({},false));let id='hand:right',a;
  if(problem==='full')unit(b).loaded=2;
  if(problem==='wrong')unit(b).equipmentCursor.stack.ammoType='musket_75';
  if(problem==='jammed')unit(b).jammed=true;
  if(problem==='broken')unit(b).condition=0;
  if(problem==='zero')unit(b).ap=0;
  if(problem==='dead'){unit(b).hp=0;unit(b).unconscious=true;}
  if(problem==='blockedHand'){unit(b).weapon=1800;unit(b).ammo=0;id='hand:left';}
  a=placement(b,id,problem==='quantity'?6:undefined);
  if(problem==='staleGun')unit(b).condition--;
  if(problem==='staleAmmo')unit(b).equipmentCursor.stack.count--;
  const before=structuredClone(b),n=actBattle(b,a);assert.ok(n.lastError,problem);assert.equal(equipmentCursorPreview(b,unit(b),a).valid,false,problem);assert.deepEqual(n.units,b.units,problem);assert.equal(n.elapsedSeconds,b.elapsedSeconds,problem);assert.equal(n.roundTimeCharged,b.roundTimeCharged,problem);assert.deepEqual(b,before);
 }
});

test('dragging ammo onto a gun follows the same paid load and stale drag stays atomic',()=>{
 const b=field({},false),u=unit(b),sourceId=pocket(u,'inventory:chosen'),a={type:'dragEquipment',unitId:'p',sourceId,destinationId:'hand:right',count:5,expectedSource:equipmentFingerprint(u,sourceId),expectedDestination:equipmentFingerprint(u,'hand:right')},n=actBattle(b,a);
 assert.equal(n.lastError,null);assert.equal(unit(n).loaded,2);assert.equal(unit(n).ap,45);assert.equal(unit(n).equipmentCursor.stack.count,3);assert.equal(unit(n).inventory.reserve.count,4);
 const stale=structuredClone(b);unit(stale).loaded=1;const refused=actBattle(stale,a);assert.ok(refused.lastError);assert.deepEqual(refused.units,stale.units);assert.equal(unit(refused).equipmentCursor,undefined);
});

test('cursor return over a gun is ordinary return, never an implicit reload',()=>{
 const b=pick(field()),u=unit(b);u.equipmentCursor.sourceId='hand:right';const n=planEquipmentCursorReturn(u).unit;
 assert.equal(n.equipmentCursor,undefined);assert.equal(ammunitionByType(n).pistol_69,9);const gun=Object.values(n.inventory).find(item=>item.weapon===1808);assert.equal(gun.loaded,0);assert.equal(gun.instanceId,'right-gun');
});

test('a real movement interrupt permits partial cursor loading and resumes without replaying AP, time or ammunition',async()=>{
 const {endTurn}=await import('../game/tactical.js');
 const initial=createBattle([{id:'p',x:1,y:1,weapon:1800,loaded:0,ammo:0,ammunitionVersion:2,blade:0,
  agility:100,experienceLevel:10,inventory:{chosen:ammo('musket_75',5)},
 }],{width:32,height:12,seed:45,tiles:Array.from({length:384},(_,i)=>({x:i%32,y:Math.floor(i/32),type:'grass',blocked:false,cover:0})),
  enemies:[{id:'e',x:7,y:1,weapon:1809,loaded:0,ammo:0,patrol:false}],
 });
 unit(initial).ap=20;initial.units[1].ap=24;
 const paused=endTurn(initial);assert.equal(paused.phase,'interrupt');assert.deepEqual(paused.interrupt.unitIds,['p']);
 assert.equal(paused.units[1].x,6);assert.equal(paused.units[1].ap,16);
 const picked=pick(paused),a=placement(picked),preview=equipmentCursorPreview(picked,unit(picked),a);
 assert.equal(preview.pa,20);assert.equal(preview.partial,true);assert.equal(preview.rounds,0);
 const loaded=placed(picked);assert.equal(loaded.phase,'interrupt');assert.equal(unit(loaded).ap,0);assert.equal(unit(loaded).loaded,0);
 assert.equal(unit(loaded).reloadProgress,20/WEAPONS[1800].reloadAP);assert.equal(unit(loaded).equipmentCursor.stack.count,5);
 assert.equal(loaded.elapsedSeconds,paused.elapsedSeconds);assert.deepEqual(loaded.enemyTurn,paused.enemyTurn);
 const resumed=endTurn(save(loaded));assert.deepEqual(resumed,endTurn(loaded));save(resumed);
 assert.equal(resumed.turn,2);assert.equal(resumed.phase,'player');assert.equal(resumed.elapsedSeconds,loaded.elapsedSeconds);
 assert.equal(unit(resumed).equipmentCursor,undefined);assert.equal(unit(resumed).loaded,0);assert.equal(unit(resumed).reloadProgress,unit(loaded).reloadProgress);
 assert.equal(ammunitionByType(unit(resumed)).musket_75,5);assert.equal(unit(resumed).carriedAP,0);
});

test('campaign inventory preview reflects its free time contract instead of tactical exploration seconds',()=>{
 const b=pick(field());b.equipmentContext='campaign';
 const p=equipmentCursorPreview(b,unit(b),placement(b));
 assert.equal(p.valid,true);assert.equal(p.operation,'reload');assert.equal(p.pa,0);assert.equal(p.seconds,0);
});
