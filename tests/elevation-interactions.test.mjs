import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,hasLineOfSight,medicalUsePreview,itemUsePreview,transferPreview,lootBatchPreview,environmentTargetAt,environmentPreview,containerLootPreview,exitPreview,artilleryCrewPlan,artilleryCosts,firearmRangeProfile,tileIllumination} from '../game/tactical.js';
import {makeOutfit} from '../game/outfits.js';
import {tacticalLevel} from '../game/tactical-space.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

const roof=(x,y=4)=>({id:`terrace:${x}:${y}`,x,y,tacticalLevel:1,elevation:3,kind:'roof',type:'floor',blocked:false,cover:0});
const person=(id,x,tacticalLevel=0,extra={})=>({id,x,y:4,tacticalLevel,weapon:1805,overwatch:false,patrol:false,...extra});
const access={id:'terrace:access',kind:'climb',from:{x:3,y:4,tacticalLevel:0},to:{x:4,y:4,tacticalLevel:1}};
function field(players=[person('p',3)],options={}){
 const tiles=Array.from({length:160},(_,i)=>({x:i%16,y:Math.floor(i/16),type:'grass',blocked:false,cover:0}));
 const upperSurfaces=Array.from({length:21},(_,i)=>roof(4+i%7,4+Math.floor(i/7)));
 return validateBattleSnapshot(createBattle(players,{id:'elevation-interactions',width:16,height:10,tiles,upperSurfaces,climbLinks:[],exploration:true,enemies:[],seed:45,...options}));
}
const physical=state=>{const result=structuredClone(state);delete result.log;delete result.lastError;return result;};
function reject(state,action){
 const before=structuredClone(state),next=actBattle(state,{unitId:'p',...action});
 assert.deepEqual(state,before,'the input battle is immutable');
 assert.ok(next.lastError,`${action.type} must reject before spending or changing the world`);
 assert.deepEqual(physical(next),physical(state),'a rejected order changes only its error and journal');
 return next;
}
function accept(state,action){
 const before=structuredClone(state),next=actBattle(state,{unitId:'p',...action});
 assert.equal(next.lastError,null,`${action.type}: ${next.lastError}`);assert.deepEqual(state,before);
 return next;
}
const patient=(x=4,level=1)=>person('q',x,level,{hp:75,bleeding:3,bandaged:0});
const medic=(x=3,level=0)=>person('p',x,level,{medical:60,activeSlot:'medical',medkits:2});

test('local treatment cannot reach a visible patient over a roof edge or through a ceiling',()=>{
 for(const x of [3,4]){
  const b=field([medic(x),patient()]);
  if(x===3)assert.equal(hasLineOfSight(b,b.units[0],b.units[1]),true,'edge visibility is distinct from physical reach');
  reject(b,{type:'heal',targetId:'q'});assert.equal(medicalUsePreview(b,b.units[0],b.units[1]).allowed,false);
 }
});

test('held medical use climbs a real access before treating the patient on that floor',()=>{
 const b=field([medic(),patient(5)],{climbLinks:[access]}),plan=itemUsePreview(b,b.units[0],b.units[1]);
 assert.equal(plan.valid,true);assert.ok(plan.path.some(step=>step.kind==='climb'));
 const n=accept(b,{type:'useItem',targetId:'q'});assert.equal(tacticalLevel(n.units[0]),1);
 assert.equal(n.units[1].bleeding,0);assert.equal(n.units[0].medkits,b.units[0].medkits-1);
 assert.equal(n.units[0].ap,b.units[0].ap);assert.ok(n.units[0].energy<b.units[0].energy);assert.ok(n.elapsedSeconds>=7);
 validateBattleSnapshot(n);
});

test('same-roof local treatment spends one kit and its ordinary combat AP',()=>{
 const b=field([medic(4,1),patient(5)],{exploration:false,enemies:[person('guard',15,0,{y:9})]}),cost=medicalUsePreview(b,b.units[0],b.units[1]).cost;
 const n=accept(b,{type:'heal',targetId:'q'});assert.equal(n.units[0].medkits,1);assert.equal(n.units[1].bleeding,0);assert.equal(n.units[0].ap,b.units[0].ap-cost);
});

test('sabre attacks and weapon stealing cannot cross floors at adjacent XY coordinates',()=>{
 const options={exploration:false,enemies:[person('e',4,1)]};
 reject(field([person('p',3,0,{weapon:1809})],options),{type:'melee',targetId:'e'});
 reject(field([person('p',3,0,{activeSlot:'unarmed'})],options),{type:'steal',targetId:'e'});
});

test('a close item transfer cannot silently become a cross-floor throw',()=>{
 const b=field([person('p',3,0,{ammo:12}),person('q',4,1,{ammo:0})]);
 reject(b,{type:'transfer',targetId:'q',item:'ammo',count:3});assert.equal(transferPreview(b,b.units[0],b.units[1],'ammo',3).valid,false);
});

test('relay links stay on one floor and retain the real quantity and each sender AP',()=>{
 const b=field([person('p',4,1,{ammo:12}),person('middle',5,1,{ammo:0}),person('q',6,1,{ammo:0})],{exploration:false,enemies:[person('guard',15,0,{y:9})]});
 const preview=transferPreview(b,b.units[0],b.units[2],'ammo',3);assert.equal(preview.kind,'relay');assert.deepEqual(preview.route.map(p=>p.id),['p','middle','q']);
 const n=accept(b,{type:'transfer',targetId:'q',item:'ammo',count:3});assert.deepEqual(n.units.slice(0,3).map(u=>u.ammo),[9,0,3]);
 assert.deepEqual(n.units.slice(0,3).map((u,i)=>b.units[i].ap-u.ap),[4,4,0]);
 const otherFloor=field([person('p',3,0,{ammo:12}),person('middle',4,1,{ammo:0}),person('q',5,1,{ammo:0})]);
 reject(otherFloor,{type:'transfer',targetId:'q',item:'ammo',count:3});
});

test('body and loose-item pickup cannot take possessions from an inaccessible upper floor',()=>{
 const body=field([person('p',3),person('body',4,1,{hp:0,ammo:3})]);
 reject(body,{type:'loot',targetId:'body',item:'ammo',count:1});
 const b=field();b.groundItems.push({id:'upper-ammo',type:'item',item:'ammo',x:4,y:4,tacticalLevel:1,count:3,weight:.04});
 reject(b,{type:'loot',groundId:'upper-ammo',count:1});
});

test('one pickup batch cannot combine the upstairs and downstairs piles at the same XY',()=>{
 const b=field([person('p',4,1)]);b.groundItems.push(...[0,1].map(level=>({id:`ammo-${level}`,type:'item',item:'ammo',x:4,y:4,tacticalLevel:level,count:3,weight:.04})));
 const items=[{groundId:'ammo-1',count:1},{groundId:'ammo-0',count:1}];
 reject(b,{type:'lootBatch',items});assert.equal(lootBatchPreview(b,b.units[0],items).valid,false);
});

test('dropping and recovering an exact stack keeps it on the roof through JSON validation',()=>{
 const b=field([person('p',4,1,{ammo:12})]),dropped=accept(b,{type:'drop',item:'ammo',count:3}),stack=dropped.groundItems[0];
 assert.equal(stack.count,3);assert.equal(tacticalLevel(stack),1);assert.equal(dropped.units[0].ammo,9);
 const saved=validateBattleSnapshot(JSON.parse(JSON.stringify(dropped))),n=accept(saved,{type:'loot',groundId:stack.id,count:3});
 assert.equal(n.units[0].ammo,12);assert.equal(n.groundItems[0].count,0);assert.equal(tacticalLevel(n.groundItems[0]),1);
});

const chest=(level=1)=>({id:'test-chest',type:'chest',x:4,y:4,tacticalLevel:level,blocksMovement:true,open:false,locked:false,contents:[{item:'ammo',count:3,weight:.04}]});
test('environment targeting selects the actual floor and cannot open or empty a chest overhead',()=>{
 const b=field([person('p',3)],{props:[chest()]});
 assert.equal(environmentTargetAt(b,{x:4,y:4,tacticalLevel:0}),null);
 assert.equal(environmentTargetAt(b,{x:4,y:4,tacticalLevel:1}).id,'test-chest');
 reject(b,{type:'environment',kind:'container',id:'test-chest',verb:'open'});
 const opened=field([person('p',3)],{props:[{...chest(),open:true}]});
 reject(opened,{type:'containerLoot',id:'test-chest',index:0,count:1});
 assert.equal(containerLootPreview(opened,opened.units[0],{id:'test-chest'},0,1).valid,false);
});

test('an upper-floor soldier cannot operate or breach a downstairs doorway',()=>{
 const b=field([person('p',4,1)]),door=b.tiles.find(t=>t.x===3&&t.y===4);
 Object.assign(door,{type:'door',doorId:'under-door',open:false,locked:false,blocked:true,blocksSight:true});
 reject(b,{type:'door',doorId:'under-door'});
 assert.equal(environmentPreview(b,b.units[0],{kind:'door',id:'under-door'},'open').valid,false);
 reject(b,{type:'breach',x:3,y:4,tacticalLevel:0});
});

test('same-roof chest use remains possible and conserves the partial contents',()=>{
 const b=field([person('p',5,1)],{props:[chest()]}),opened=accept(b,{type:'environment',kind:'container',id:'test-chest',verb:'open'});
 const n=accept(opened,{type:'containerLoot',id:'test-chest',index:0,count:2});
 assert.equal(n.props[0].contents[0].count,1);assert.equal(n.units[0].ammo,b.units[0].ammo+2);assert.equal(tacticalLevel(n.props[0]),1);
});

test('an adjacent ground door remains visible and operable when the map also has a roof',()=>{
 const b=field(),door=b.tiles.find(t=>t.x===4&&t.y===4);
 Object.assign(door,{type:'door',doorId:'ground-door',open:false,locked:false,blocked:true,blocksSight:true});
 const n=accept(b,{type:'door',doorId:'ground-door'});assert.equal(n.tiles.find(t=>t.doorId==='ground-door').open,true);
});

test('a held quest garment cannot be handed to an NPC on another floor',()=>{
 const b=field([person('p',3,0,{activeSlot:'item',activeItem:'inventory:coat',inventory:{coat:{...makeOutfit('poncho',67),instanceId:'gift'}}})],{npcs:[{id:'local-retiro',name:'Sargento',x:4,y:4,tacticalLevel:1,mission:true}]});
 reject(b,{type:'giveItem',targetId:'local-retiro'});
});

test('unsupported cross-floor torch and bolas throws reject without supplies, effects or RNG changes',()=>{
 const b=field([person('p',3,0,{activeSlot:'supply',activeSupply:'torches'})]);
 reject(b,{type:'throwTorch',x:4,y:4,tacticalLevel:1});
 const bolas=field([person('p',3,0,{activeSlot:'supply',activeSupply:'boleadoras'})],{exploration:false,enemies:[person('e',4,1)]});
 reject(bolas,{type:'boleadoras',targetId:'e'});
});

test('a torch and bolas used on the same roof create their effects at the target floor',()=>{
 const b=field([person('p',4,1,{activeSlot:'supply',activeSupply:'torches'})]),lit=accept(b,{type:'throwTorch',x:6,y:4,tacticalLevel:1});
 assert.equal(tacticalLevel(lit.lights.at(-1)),1);assert.equal(lit.units[0].torches,b.units[0].torches-1);validateBattleSnapshot(lit);
 const bolas=field([person('p',4,1,{activeSlot:'supply',activeSupply:'boleadoras'})],{exploration:false,enemies:[person('e',6,1)]}),bound=accept(bolas,{type:'boleadoras',targetId:'e'});
 assert.equal(tacticalLevel(bound.groundItems.at(-1)),1);assert.equal(bound.groundItems.at(-1).heldBy,'e');assert.equal(bound.units[1].entangled,true);validateBattleSnapshot(bound);
});

test('roof firearm smoke and shooter memory retain the physical floor through a save',()=>{
 const b=field([person('p',4,1,{marksmanship:100})],{exploration:false,enemies:[person('e',8,1)]}),n=accept(b,{type:'fire',targetId:'e',aim:2});
 assert.equal(tacticalLevel(n.smoke.at(-1)),1);assert.equal(tacticalLevel(n.units[0].lastShotPosition),1);assert.equal(tacticalLevel(n.units[0].lastKnownEnemy),1);
 const saved=validateBattleSnapshot(JSON.parse(JSON.stringify(n)));assert.deepEqual(saved,n);
});

test('roof gun smoke obscures that floor without changing a downstairs firing line',()=>{
 const b=field([person('p',4,1),person('low',4)],{exploration:false,enemies:[person('high-target',8,1),person('low-target',8)]}),n=accept(b,{type:'fire',targetId:'high-target'}),clear={...n,smoke:[]};
 const low=n.units.find(u=>u.id==='low'),lowTarget=n.units.find(u=>u.id==='low-target');
 assert.deepEqual(firearmRangeProfile(n,low,lowTarget),firearmRangeProfile(clear,low,lowTarget));
 const high=n.units.find(u=>u.id==='p'),highTarget=n.units.find(u=>u.id==='high-target');
 assert.notDeepEqual(firearmRangeProfile(n,high,highTarget),firearmRangeProfile(clear,high,highTarget),'the real powder cloud still affects its own floor');
});

test('roof torch illumination reaches its own floor while the slab shades the ground below',()=>{
 const b=field([person('p',4,1,{activeSlot:'supply',activeSupply:'torches'})],{night:true}),n=accept(b,{type:'throwTorch',x:6,y:4,tacticalLevel:1});
 assert.ok(tileIllumination(n,6,4,1)>.8);assert.equal(tileIllumination(n,6,4,0),.08);
});

test('a real rout leaves the identified firearm on the defeated soldier floor',()=>{
 const b=field([person('p',4,1,{weapon:1809})],{exploration:false,enemies:[person('e',5,1,{morale:1,weaponInstanceId:'roof-gun'})]}),n=accept(b,{type:'melee',targetId:'e'});
 assert.ok(n.units[1].routed);const gun=n.droppedWeapons.find(g=>g.instanceId==='roof-gun');assert.ok(gun);assert.equal(tacticalLevel(gun),1);assert.equal(gun.x,5);assert.equal(gun.y,4);validateBattleSnapshot(n);
});

test('mounting and sector exits require the actual ground surface',()=>{
 reject(field([person('p',4,1,{horse:true})]),{type:'mount'});
 const exit={id:'west',edge:'W',destination:'retiro',entryEdge:'S',entryAnchor:{x:14,y:15}};
 const b=field([person('p',0,1)],{upperSurfaces:[roof(0)],exits:[exit]});
 const action={type:'exit',unitIds:['p'],exitId:'west'};reject(b,action);assert.equal(exitPreview(b,action).available,false);
});

test('a soldier on another floor cannot supply a missing member of the artillery crew',()=>{
 const gun={id:'gun',type:'bronze4',x:4,y:4,tacticalLevel:0},b=field([person('p',3),person('q',4,1)],{artillery:[gun]});
 const piece=b.artillery[0],crew=artilleryCrewPlan(b,b.units[0],piece,artilleryCosts(b,b.units[0],piece).fire);
 assert.ok(crew.reason);reject(b,{type:'artillery',artilleryId:'gun',x:8,y:4,tacticalLevel:0});
});

test('upper-floor artillery fire, targets and dragging are explicitly unsupported in this slice',()=>{
 const gun={id:'gun',type:'swivel',x:3,y:4},b=field([person('p',2)],{artillery:[gun]});
 for(const mode of ['solid','canister'])reject(b,{type:'artillery',artilleryId:'gun',x:6,y:4,tacticalLevel:1,mode});
 reject(b,{type:'artilleryMove',artilleryId:'gun',x:4,y:4,tacticalLevel:1});
 const upper=field([person('p',4,1)],{artillery:[{...gun,x:5,tacticalLevel:1}]});
 reject(upper,{type:'artillery',artilleryId:'gun',x:8,y:4,tacticalLevel:1});
});

test('a ground solid shot never strikes the soldier on the roof above its firing line',()=>{
 const b=field([person('p',2)],{exploration:false,artillery:[{id:'gun',type:'swivel',x:3,y:4}],enemies:[person('under',6),person('above',6,1)]});
 const n=accept(b,{type:'artillery',artilleryId:'gun',x:8,y:4,tacticalLevel:0,mode:'solid'});
 assert.ok(n.units[1].hp<b.units[1].hp);assert.equal(n.units[2].hp,b.units[2].hp);
});

test('observed enemy and patrol origin memories retain the observed floor instead of the floor below',()=>{
 const b=field([person('p',4,1)],{exploration:false,enemies:[person('e',8,1,{patrol:true})]});
 assert.equal(tacticalLevel(b.units[0].lastKnownEnemy),1);assert.equal(tacticalLevel(b.units[1].patrolOrigin),1);
 validateBattleSnapshot(JSON.parse(JSON.stringify(b)));
});
