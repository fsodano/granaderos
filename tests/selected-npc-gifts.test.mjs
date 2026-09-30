import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,inventoryMapPreview,getNpcGiftResult,canSee,movementStepCost,movementEnergy} from '../game/tactical.js';
import {equipmentFingerprint,inventoryUsage} from '../game/tactical-inventory.js';
import {questGiftDecision} from '../game/quests.js';
import {makeOutfit} from '../game/outfits.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {handLayout} from '../game/hand-layout.js';
import {sameCell,sameSurface} from '../game/tactical-space.js';

const coat=(id,condition=67)=>({...makeOutfit('poncho',condition),instanceId:id});
const npc=(b,id='local-retiro')=>b.npcs.find(n=>n.id===id);
const unit=b=>b.units.find(u=>u.id==='p');
const field=(actor={},recipient={},options={})=>createBattle([{id:'p',name:'Soldado',x:2,y:2,facing:2,weapon:1805,blade:0,ammo:0,priming:0,flints:0,medkits:0,rations:0,torches:0,boleadoras:0,inventory:{coat:coat('gift')},...actor}],{
 width:16,height:10,seed:45,tiles:Array.from({length:160},(_,i)=>({x:i%16,y:Math.floor(i/16),type:'grass',blocked:false,cover:0})),exploration:true,enemies:[],
 npcs:[{id:'local-retiro',name:'Sargento',x:3,y:2,mission:true,...recipient}],...options});
const pocket=(b,item='inventory:coat')=>inventoryUsage(unit(b)).slots.find(s=>s.entry?.item===item).id;
const request=(b,sourceId=pocket(b),extra={})=>({type:'inventoryMap',unitId:'p',sourceId,expectedSource:equipmentFingerprint(unit(b),sourceId),count:1,intent:'auto',x:npc(b).x,y:npc(b).y,tacticalLevel:npc(b).tacticalLevel??0,targetId:npc(b).id,...extra});
const physical=b=>{const copy=structuredClone(b);delete copy.log;delete copy.lastError;return copy;};
const possessions=b=>({inventory:unit(b).inventory,outfit:unit(b).outfit,weapon:unit(b).weapon,blade:unit(b).blade,loaded:unit(b).loaded,ammo:unit(b).ammo,medkits:unit(b).medkits,activeSlot:unit(b).activeSlot,activeItem:unit(b).activeItem,activeSupply:unit(b).activeSupply,activeTool:unit(b).activeTool,leftHandItem:unit(b).leftHandItem,pocketOrder:unit(b).pocketOrder,ground:b.groundItems});
function attempt(b,a=request(b)){
 const before=structuredClone(b),preview=inventoryMapPreview(b,unit(b),a);assert.equal(preview.valid,true,preview.reason);assert.equal(preview.kind,'gift');assert.equal(preview.pa,0);assert.equal(preview.totalPA,0);assert.deepEqual(b,before);
 const after=actBattle(b,preview.action);assert.equal(after.lastError,null,after.lastError);assert.deepEqual(b,before);validateBattleSnapshot(after);
 const result=getNpcGiftResult(b,after);assert.ok(result);assert.equal(result.unitId,'p');assert.equal(result.npcId,npc(b).id);assert.equal(result.sourceId,a.sourceId);assert.equal(result.expectedSource,a.expectedSource);assert.equal(result.count,a.count);return {after,preview,result};
}
function reject(b,a){
 const before=structuredClone(b);assert.equal(inventoryMapPreview(b,unit(b),a).valid,false);const after=actBattle(b,a);assert.ok(after.lastError);assert.deepEqual(physical(after),physical(b));assert.deepEqual(b,before);assert.equal(getNpcGiftResult(b,after),null);return after;
}

test('selected packed poncho changes custody only at the adjacent paid offer',()=>{
 const b=field({inventory:{coat:coat('gift',49),spare:coat('spare',81)},pocketOrder:[{slotId:'large-2',item:'inventory:coat',index:0,count:1},{slotId:'large-4',item:'inventory:spare',index:0,count:1}]});
 const {after:n,result,preview}=attempt(b,request(b,'large-2'));
 assert.equal(result.status,'accepted');assert.equal(preview.actionPa,4);assert.equal(n.elapsedSeconds-b.elapsedSeconds,1);assert.equal(unit(n).ap,unit(b).ap);assert.equal(unit(n).energy,unit(b).energy);assert.equal(n.seed,b.seed);
 assert.deepEqual(npc(n).questGifts,[coat('gift',49)]);assert.equal(unit(n).inventory.coat,undefined);assert.deepEqual(unit(n).inventory.spare,coat('spare',81));assert.equal(inventoryUsage(unit(n)).slots.find(s=>s.id==='large-4').entry.item,'inventory:spare');assert.deepEqual(n.groundItems,[]);
 assert.equal(getNpcGiftResult(n,n),null);result.text='changed';assert.notEqual(getNpcGiftResult(b,n).text,'changed');assert.equal(getNpcGiftResult(b,JSON.parse(JSON.stringify(n))),null);
});

test('held and worn ponchos can be selected without equipping a different garment',()=>{
 for(const hand of ['right','left']){
  const actor=hand==='right'?{activeSlot:'item',activeItem:'inventory:coat'}:{leftHandItem:'inventory:coat'};
  const b=field(actor),{after:n,result}=attempt(b,request(b,`hand:${hand}`));assert.equal(result.status,'accepted');assert.equal(handLayout(unit(n))[hand],hand==='right'?'primary':null);assert.equal(unit(n).weapon,unit(b).weapon);assert.equal(unit(n).inventory.coat,undefined);assert.deepEqual(npc(n).questGifts,[coat('gift')]);
 }
 const b=field({outfit:coat('worn',31)}),{after:n}=attempt(b,request(b,'outfit'));assert.equal(unit(n).outfit,null);assert.deepEqual(npc(n).questGifts,[coat('worn',31)]);assert.deepEqual(unit(n).inventory,b.units[0].inventory);
});

test('wrong, ruined and excess gifts are physical refusals without item ownership changes',()=>{
 for(const patch of [{actor:{inventory:{coat:coat('ruined',0)}}},{actor:{inventory:{coat:{name:'Carta',count:3,weight:.1,condition:45}}}},{recipient:{questGifts:[coat('one'),coat('two')]}}]){
  const b=field(patch.actor,patch.recipient),before=structuredClone(possessions(b)),{after:n,result}=attempt(b);
  assert.equal(result.status,'refused');assert.ok(result.text);assert.deepEqual(possessions(n),before);assert.deepEqual(npc(n).questGifts,npc(b).questGifts);assert.equal(n.elapsedSeconds-b.elapsedSeconds,1);assert.equal(unit(n).ap,unit(b).ap);assert.equal(n.seed,b.seed);assert.ok(n.log.some(line=>line.includes(result.text)));
 }
});

test('ordinary civilians refuse a selected quantity without using its contextual function',()=>{
 const b=field({activeSlot:'medical',medkits:3,inventory:{cloth:{name:'Tela',count:3,weight:.1,condition:42}},pocketOrder:[{slotId:'small-1',item:'inventory:cloth',index:0,count:2},{slotId:'small-2',item:'inventory:cloth',index:1,count:1}]},{id:'civilian',mission:false,hp:50});
 const a={...request({...b,npcs:[{...b.npcs[0],id:'local-retiro'}]},'small-1'),targetId:'civilian',count:2};
 const before=structuredClone(possessions(b)),preview=inventoryMapPreview(b,unit(b),a);assert.equal(preview.valid,true);const n=actBattle(b,preview.action),result=getNpcGiftResult(b,n);assert.equal(n.lastError,null);assert.equal(result.status,'refused');assert.deepEqual(possessions(n),before);assert.equal(n.npcs[0].hp,50);assert.equal(unit(n).medkits,3);validateBattleSnapshot(n);
});

test('preview does not reveal NPC gift quota or acceptance before the approach',()=>{
 const b=field({}, {x:7}),full=structuredClone(b);npc(full).questGifts=[coat('one'),coat('two')];
 const a=request(b),before=inventoryMapPreview(b,unit(b),a);assert.equal(before.valid,true);assert.ok(before.path.length>0);assert.equal(before.accepted,undefined);assert.equal(before.refusal,undefined);assert.deepEqual(inventoryMapPreview(full,unit(full),a),before);
 const {after:n,result}=attempt(full,a);assert.equal(result.status,'refused');assert.ok(unit(n).x>unit(full).x);assert.ok(n.elapsedSeconds-full.elapsedSeconds>1);assert.ok(unit(n).energy<unit(full).energy);assert.deepEqual(possessions(n),possessions(full));
});

test('a gift approach equals legal movement followed by the same local offer',()=>{
 const b=field({}, {x:7}),a=request(b),preview=inventoryMapPreview(b,unit(b),a);assert.ok(preview.path.length>0);let previous=unit(b);for(const step of preview.path){assert.ok(Number.isFinite(movementStepCost(b,unit(b),previous,step)));previous=step;}
 const walked=actBattle(b,{type:'move',unitId:'p',...preview.destination});assert.equal(walked.lastError,null);assert.equal(unit(walked).inventory.coat.instanceId,'gift');assert.equal(npc(walked).questGifts,undefined);
 const manual=actBattle(walked,preview.action),{after:n,result}=attempt(b,a);assert.deepEqual(physical(n),physical(manual));assert.equal(result.status,'accepted');assert.ok(sameCell(unit(n),preview.destination));assert.ok(n.elapsedSeconds-b.elapsedSeconds>1);assert.ok(unit(n).energy<unit(b).energy);assert.equal(unit(n).ap,unit(b).ap);
});

test('only two exact ponchos are accepted and the third source stays owned after refusal',()=>{
 let b=field({inventory:{coat:coat('one'),second:coat('two',40),third:coat('three',80)}});
 for(const [key,id] of [['coat','one'],['second','two']]){const result=attempt(b,request(b,pocket(b,`inventory:${key}`)));assert.equal(result.result.status,'accepted');b=result.after;assert.equal(npc(b).questGifts.at(-1).instanceId,id);}
 const before=structuredClone(possessions(b)),{after:n,result}=attempt(b,request(b,pocket(b,'inventory:third')));assert.equal(result.status,'refused');assert.deepEqual(possessions(n),before);assert.deepEqual(npc(n).questGifts,[coat('one'),coat('two',40)]);
 const restored=validateBattleSnapshot(JSON.parse(JSON.stringify(n)));assert.deepEqual(npc(restored).questGifts,npc(n).questGifts);assert.equal(getNpcGiftResult(b,restored),null);
});

test('changed source or NPC position rejects before any approach begins',()=>{
 const b=field({}, {x:7}),a=request(b);unit(b).inventory.coat.condition--;reject(b,a);
 const moved=field({}, {x:7}),old=request(moved);npc(moved).x++;reject(moved,old);
 const empty=field(),stale=request(empty);delete unit(empty).inventory.coat;reject(empty,stale);
 const wrong=field();for(const count of [0,2,.5,NaN,Infinity,null])reject(wrong,request(wrong,undefined,{count}));reject(wrong,request(wrong,undefined,{expectedSource:'stale'}));
});

test('unavailable, concealed and wrong-cell NPCs do not reveal gift rules or consume anything',()=>{
 for(const patch of [{hp:0},{hp:10,energy:0,unconscious:true},{fled:true},{routed:true},{departure:{exitId:'gone'}}]){const b=field({},patch);reject(b,request(b));}
 const b=field();b.revealedRooms=[];b.tiles.find(t=>t.x===3&&t.y===2).roomId='hidden-room';const a=request(b),unknown={...a,targetId:'absent'};assert.equal(inventoryMapPreview(b,unit(b),a).reason,inventoryMapPreview(b,unit(b),unknown).reason);reject(b,a);
 const wrong=field(),point=request(wrong,undefined,{x:4,y:2});assert.equal(inventoryMapPreview(wrong,unit(wrong),point).reason,inventoryMapPreview(wrong,unit(wrong),{...point,targetId:'absent'}).reason);reject(wrong,point);
 const combat=field({}, {},{exploration:false,enemies:[{id:'guard',x:14,y:8,patrol:false,overwatch:false}]});reject(combat,request(combat));
});

test('an unconnected roof or occupied contact ring cannot grant remote delivery',()=>{
 const roof={id:'gift-roof',x:3,y:2,tacticalLevel:1,elevation:3,kind:'roof',type:'floor',blocked:false,cover:0};
 const b=field({}, {tacticalLevel:1},{upperSurfaces:[roof],climbLinks:[]});reject(b,request(b));
 const blocked=field({}, {x:6,y:2});for(const [x,y] of [[5,2],[7,2],[6,1],[6,3]])blocked.props.push({id:`chair-${x}-${y}`,type:'chair',x,y,blocksMovement:true});const preview=inventoryMapPreview(blocked,unit(blocked),request(blocked));assert.equal(preview.reason,'No hay un camino libre para acercarse y entregar el objeto.');assert.equal(preview.pa,0);reject(blocked,request(blocked));
});

test('a connected roof gift pays a real climb and reaches the NPC surface',()=>{
 const upperSurfaces=[4,5,6].flatMap(x=>[2,3].map(y=>({id:`gift-roof-${x}-${y}`,x,y,tacticalLevel:1,elevation:3,kind:'roof',type:'floor',blocked:false,cover:0})));
 const b=field({}, {x:4,tacticalLevel:1},{upperSurfaces,climbLinks:[{id:'gift-access',kind:'climb',from:{x:3,y:3,tacticalLevel:0},to:{x:4,y:3,tacticalLevel:1}}]});
 const {after:n,result,preview}=attempt(b);assert.equal(result.status,'accepted');assert.ok(preview.path.some(step=>step.kind==='climb'));assert.equal(unit(n).tacticalLevel,1);assert.ok(sameSurface(unit(n),npc(n)));assert.equal(Math.abs(unit(n).x-npc(n).x)+Math.abs(unit(n).y-npc(n).y),1);assert.ok(unit(n).energy<=unit(b).energy-12);assert.ok(n.elapsedSeconds-b.elapsedSeconds>=6);
});

test('energy collapse preserves the walked cost and item without an NPC answer',()=>{
 const b=field({}, {x:7});unit(b).energy=2*movementEnergy(unit(b),{type:'grass'},true);
 const {after:n,result}=attempt(b);assert.equal(result.status,'interrupted');assert.equal(unit(n).unconscious,true);assert.equal(unit(n).x,4);assert.equal(n.elapsedSeconds-b.elapsedSeconds,6);assert.equal(unit(n).inventory.coat.instanceId,'gift');assert.equal(npc(n).questGifts,undefined);assert.ok(!n.log.some(line=>line.startsWith('Sargento:')));
});

test('an NPC moving during the actual walk interrupts the reserved offer',()=>{
 const b=field({}, {x:7,mission:false,ai:{activity:'roaming',cycle:0,homeId:null,wait:0,destination:{x:7,y:5}}}),a=request(b);
 const {after:n,result}=attempt(b,a);assert.equal(result.status,'interrupted');assert.ok(!sameCell(npc(n),npc(b)));assert.ok(n.elapsedSeconds>b.elapsedSeconds);assert.equal(unit(n).inventory.coat.instanceId,'gift');assert.equal(npc(n).questGifts,undefined);assert.ok(!n.log.some(line=>line.startsWith('Sargento:')));
});

test('new enemy contact during exploration stops the gift before acceptance',()=>{
 const tiles=Array.from({length:160},(_,i)=>({x:i%16,y:Math.floor(i/16),type:'grass',blocked:false,cover:0}));Object.assign(tiles.find(t=>t.x===3&&t.y===3),{type:'wall',blocked:true,blocksSight:true});
 const b=field({}, {x:7},{tiles,enemies:[{id:'hidden',x:5,y:4,facing:2,patrol:false,overwatch:false}]});assert.equal(b.mode,'exploration');assert.equal(canSee(b,unit(b),b.units[1]),false);
 const {after:n,result}=attempt(b);assert.equal(result.status,'interrupted');assert.equal(n.mode,'combat');assert.ok(unit(n).x>unit(b).x);assert.ok(n.elapsedSeconds>b.elapsedSeconds);assert.equal(unit(n).inventory.coat.instanceId,'gift');assert.equal(npc(n).questGifts,undefined);
});

test('ground intent beside an NPC remains a physical drop and has no gift response',()=>{
 const b=field(),a=request(b,undefined,{intent:'ground'}),p=inventoryMapPreview(b,unit(b),a);assert.equal(p.kind,'drop');const n=actBattle(b,p.action);assert.equal(n.lastError,null);assert.equal(npc(n).questGifts,undefined);assert.equal(n.groundItems[0].instanceId,'gift');assert.equal(getNpcGiftResult(b,n),null);validateBattleSnapshot(n);
});

test('the pure quest decision neither changes arguments nor accepts damaged or unrelated objects',()=>{
 const receiver={id:'local-retiro',questGifts:[coat('first')]},stack={item:'inventory:coat',...coat('second')},before=structuredClone({receiver,stack});
 const result=questGiftDecision(receiver,stack);assert.equal(result.accepted,true);assert.deepEqual(result.gifts,[coat('first'),coat('second')]);assert.deepEqual({receiver,stack},before);result.gifts[0].condition=0;assert.equal(receiver.questGifts[0].condition,67);
 for(const offer of [{item:'ammo',count:3},{item:'outfit',...coat('ruined',0)},{item:'outfit',...makeOutfit(),count:2}])assert.equal(questGiftDecision(receiver,offer).accepted,false);
 assert.equal(questGiftDecision({id:'civilian'},stack).accepted,false);
});

test('undiscovered NPC occupancy cannot change the gift preview or secretly reroute its execution',()=>{
 const b=field({}, {x:7});b.npcs.push({id:'hidden-npc',name:'Vecino',x:4,y:2,mission:true});b.tiles.find(t=>t.x===4&&t.y===2).roomId='unknown-room';b.revealedRooms=[];
 const a=request(b),publicState={...b,npcs:b.npcs.filter(n=>n.id!=='hidden-npc')},preview=inventoryMapPreview(b,unit(b),a);assert.deepEqual(preview,inventoryMapPreview(publicState,unit(publicState),a));assert.ok(preview.path.some(step=>step.x===4&&step.y===2));
 const {after:n,result}=attempt(b,a);assert.equal(result.status,'interrupted');assert.equal(unit(n).x,3);assert.equal(unit(n).y,2);assert.equal(unit(n).inventory.coat.instanceId,'gift');assert.equal(npc(n).questGifts,undefined);assert.ok(n.log.some(line=>line.includes('ruta está bloqueada')));
});
