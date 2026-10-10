import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,grenadeThrowPreview,getGrenadeThrowVisual,canSee} from '../game/tactical.js';
import {makeGrenadeStack} from '../game/grenades.js';
import {heldGrenade,grenadeThrowCosts,grenadeThrowChance,grenadeThrowRange} from '../game/grenade-throw.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {handLayout} from '../game/hand-layout.js';
import {inventoryUsage} from '../game/tactical-inventory.js';
const empty={ammo:0,priming:0,flints:0,medkits:0,rations:0,boleadoras:0,torches:0};
const tiles=()=>Array.from({length:240},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'grass',blocked:false,cover:0}));
const enemy=(extra={})=>({...empty,id:'e',x:8,y:3,weapon:0,activeSlot:'unarmed',loaded:0,patrol:false,overwatch:false,experienceLevel:1,agility:0,...extra});
function field(player={},enemies=[enemy()],sector={}){
 return createBattle([{...empty,id:'p',name:'Lanzador',x:2,y:3,weapon:0,activeSlot:'item',activeItem:'inventory:grenades',inventory:{grenades:makeGrenadeStack('arsenal',2,{origin:'paid-lot'})},strength:100,dexterity:100,marksmanship:100,agility:100,wisdom:100,experienceLevel:10,...player}],{width:24,height:10,tiles:tiles(),seed:45,enemies,...sector});
}
const actor=(s,id='p')=>s.units.find(u=>u.id===id);
const point={x:8,y:3};
const throwAt=(s,extra={})=>actBattle(s,{type:'throwGrenade',unitId:'p',...point,...extra});
function reject(s,extra={}){const before=structuredClone(s),n=throwAt(s,extra);assert.ok(n.lastError);const strip=v=>{const x=structuredClone(v);delete x.lastError;delete x.log;return x;};assert.deepEqual(strip(n),strip(s));assert.deepEqual(s,before);assert.equal(getGrenadeThrowVisual(s,n),null);}

test('ground throw debits exactly one held grenade and one fixed AP cost, with no firearm debit',()=>{
 const s=field({weapon:1805,loaded:1,ammo:6,priming:8,flints:2,condition:61,jammed:true}),before=structuredClone(s),p=actor(s),plan=grenadeThrowPreview(s,p,point);
 assert.equal(heldGrenade(p).record.origin,'paid-lot');assert.equal(plan.valid,true);assert.equal(plan.friendlyRisk,false);assert.equal(plan.aim,0);assert.equal(plan.costs.turn,0);assert.equal(plan.costs.energy,0);
 const n=throwAt(s);assert.equal(n.lastError,null);assert.equal(actor(n).inventory.grenades.count,1);assert.equal(actor(n).inventory.grenades.origin,'paid-lot');assert.equal(actor(n).ap,p.ap-plan.pa);assert.equal(actor(n).energy,p.energy);
 for(const key of ['ammo','priming','flints','loaded','condition','jammed'])assert.equal(actor(n)[key],p[key],key);
 assert.equal(actor(n,'e').hp,45);assert.equal(actor(n,'e').energy,55);assert.equal(n.groundItems.length,0);assert.equal(n.elapsedSeconds,6);assert.deepEqual(s,before);
 assert.deepEqual(validateBattleSnapshot(structuredClone(n)),n);
 const visual=getGrenadeThrowVisual(s,n);assert.equal(visual.detonated,true);assert.equal(visual.radius,3);assert.ok(visual.points.length>2);assert.equal(visual.landing.x,8);visual.radius=100;assert.equal(getGrenadeThrowVisual(s,n).radius,3);assert.equal(getGrenadeThrowVisual(n,n),null);assert.equal(getGrenadeThrowVisual(n,JSON.parse(JSON.stringify(n))),null);
});

test('using the held item on a known person throws to the point rather than giving or punching',()=>{
 for(const civilian of [false,true]){
  const s=field({},civilian?[enemy({x:20})]:[enemy()],civilian?{npcs:[{id:'npc',name:'Vecino',x:8,y:3}]}:{});
  const n=actBattle(s,{type:'useItem',unitId:'p',targetId:civilian?'npc':'e'});assert.equal(n.lastError,null);assert.equal(actor(n).inventory.grenades.count,1);assert.ok(getGrenadeThrowVisual(s,n));
  assert.equal(civilian?n.npcs[0].hp:actor(n,'e').hp,45);assert.equal(n.npcs?.[0]?.questGifts,undefined);
 }
 const s=field(),a=throwAt(s),b=actBattle(s,{type:'useItem',unitId:'p',...point});assert.deepEqual(a,b);
});

test('empty-sector throw and standing setup use time, not AP',()=>{
 const s=field({stance:'prone',movementMode:'prone'},[],{exploration:true});actor(s).ap=0;
 const n=throwAt(s);assert.equal(n.lastError,null);assert.equal(actor(n).ap,0);assert.equal(actor(n).stance,'standing');assert.equal(actor(n).inventory.grenades.count,1);assert.ok(n.elapsedSeconds>s.elapsedSeconds);assert.equal(n.mode,'exploration');
});

test('standing setup pays before launch and total cost matches the cursor',()=>{
 const s=field({stance:'prone',movementMode:'prone',facing:6}),plan=grenadeThrowPreview(s,actor(s),point),n=throwAt(s);
 assert.ok(plan.costs.stance>0);assert.equal(n.lastError,null);assert.equal(actor(n).ap,actor(s).ap-plan.pa);assert.equal(actor(n).stance,'standing');assert.equal(actor(n).facing,2);assert.equal(actor(n).inventory.grenades.count,1);
 const short=field({stance:'prone',movementMode:'prone'});actor(short).ap=plan.pa-1;reject(short);
});

test('last grenade clears its hand and keeps the real weapon in the other hand',()=>{
 const s=field({weapon:1805,loaded:1,condition:37,jammed:true,inventory:{grenades:makeGrenadeStack('arsenal',1,{instanceId:'last'})}});assert.equal(handLayout(actor(s)).left,'primary');
 const n=throwAt(s);assert.equal(n.lastError,null);assert.equal(actor(n).inventory.grenades,undefined);assert.equal(actor(n).activeItem,undefined);assert.equal(actor(n).activeSlot,'primary');assert.equal(actor(n).loaded,1);assert.equal(actor(n).condition,37);assert.equal(actor(n).jammed,true);assert.equal(heldGrenade(actor(n)),null);reject(n);assert.equal(inventoryUsage(actor(n)).overloaded,false);
});

test('blast strikes each living body once, including allies, thrower, routed, surrendered and unconscious people',()=>{
 const s=field({},[enemy(),enemy({id:'surrendered',x:8,y:4,surrendered:true}),enemy({id:'routed',x:8,y:2,routed:true}),enemy({id:'unconscious',x:9,y:3,hp:10,maxHp:100}),enemy({id:'dead',x:9,y:4,hp:0,maxHp:100})]);
 const ally=structuredClone(actor(s));Object.assign(ally,{id:'ally',name:'Aliado',x:7,y:3,inventory:{},activeSlot:'unarmed'});delete ally.activeItem;s.units.push(ally);
 const departed=structuredClone(actor(s,'e'));Object.assign(departed,{id:'departed',x:9,y:2,fled:true,departure:{exitId:'e',edge:'E',destination:'elsewhere',x:23,y:2,elapsedSeconds:0,mountId:null}});s.units.push(departed);
 assert.equal(grenadeThrowPreview(s,actor(s),point).friendlyRisk,true);
 const n=throwAt(s);assert.equal(actor(n,'e').hp,45);assert.equal(actor(n,'ally').hp,59);assert.equal(actor(n,'surrendered').hp,59);assert.equal(actor(n,'routed').hp,59);assert.equal(actor(n,'unconscious').hp,0);assert.equal(actor(n,'dead').hp,0);assert.equal(actor(n,'departed').hp,100);
 const near=field();const self=throwAt(near,{x:3,y:3});assert.equal(actor(self).hp,59);assert.equal(actor(self).inventory.grenades.count,1);
});

test('closed walls shield a body from an otherwise identical blast, without team immunity',()=>{
 const wallEdges=[{id:'blast-screen',x:9,y:3,axis:'y',type:'wall',material:'adobe',blocked:true,blocksSight:true,cover:40,obstacleHeight:4}];
 const s=field({},[enemy({x:10})],{wallEdges}),n=throwAt(s);assert.equal(n.lastError,null);assert.equal(actor(n,'e').hp,100);
 const clear=field({},[enemy({x:10})]),hit=throwAt(clear);assert.equal(actor(hit,'e').hp,72);
});

test('hidden occupants cannot change the cursor, scatter or observed flight',()=>{
 const s=field(),hidden=field({},[enemy({id:'hidden',x:8,stealth:100})]);
 actor(s).facing=6;actor(hidden).facing=6;assert.equal(canSee(hidden,actor(hidden),actor(hidden,'hidden')),false);
 assert.deepEqual(grenadeThrowPreview(s,actor(s),point),grenadeThrowPreview(hidden,actor(hidden),point));
 const a=throwAt(s),b=throwAt(hidden);assert.deepEqual(getGrenadeThrowVisual(s,a),getGrenadeThrowVisual(hidden,b));
 const direct=actBattle(hidden,{type:'useItem',unitId:'p',targetId:'hidden'});assert.ok(direct.lastError);assert.equal(actor(direct).inventory.grenades.count,2);
});

test('missed throws have deterministic bounded landings and survive JSON replay',()=>{
 const s=field({dexterity:0,marksmanship:0});const restored=validateBattleSnapshot(JSON.parse(JSON.stringify(s))),n=throwAt(s),r=throwAt(restored);
 assert.equal(grenadeThrowPreview(s,actor(s),point).chance,1);assert.deepEqual(n,r);const landing=getGrenadeThrowVisual(s,n).landing;assert.notDeepEqual([landing.x,landing.y],[point.x,point.y]);assert.ok(Math.abs(landing.x-point.x)<=2&&Math.abs(landing.y-point.y)<=2);assert.equal(actor(n).inventory.grenades.count,1);
});

test('a failed grenade becomes one recoverable inert object, never another live grenade',()=>{
 const s=field({inventory:{grenades:makeGrenadeStack('arsenal',1,{condition:.01,instanceId:'dud',origin:'lot-six'})}}),n=throwAt(s);
 assert.equal(n.lastError,null);assert.equal(actor(n).inventory.grenades,undefined);assert.equal(actor(n,'e').hp,100);assert.equal(n.groundItems.length,1);assert.equal(n.groundItems[0].instanceId,'dud');assert.equal(n.groundItems[0].origin,'lot-six');assert.equal(n.groundItems[0].condition,0);assert.equal(getGrenadeThrowVisual(s,n).detonated,false);assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(n))),n);
 const inert=field({inventory:{grenades:makeGrenadeStack('arsenal',1,{condition:0})}});reject(inert);
});

test('wrong hand, empty stack, bad geometry, body regions and insufficient AP reject atomically',()=>{
 for(const changes of [{activeSlot:'unarmed',activeItem:undefined},{activeSlot:'medical',activeItem:undefined},{mounted:true},{unconscious:true,energy:0},{knockedDown:true}])reject(field(changes));
 for(const order of [{x:23},{x:-1},{x:NaN},{y:3.5},{tacticalLevel:2},{targetId:'e'},{hitLocation:'head'},{hitLocation:'torso'},{x:2,y:3}])reject(field(),order);
 const s=field();actor(s).ap=1;reject(s);const absent=field({inventory:{}});reject(absent);
});

test('throw attributes affect range and accuracy; firearm aim, facing and explosives skill do not',()=>{
 const s=field(),u=actor(s),range=grenadeThrowRange(u).maximum,chance=grenadeThrowChance(u,6),cost=grenadeThrowCosts(u,point).total;
 for(const changes of [{strength:20},{energy:20}])assert.ok(grenadeThrowRange({...u,...changes}).maximum<range);
 for(const changes of [{dexterity:20},{marksmanship:20},{energy:20},{hp:40},{shock:8},{fatigue:90}])assert.ok(grenadeThrowChance({...u,...changes},6)<chance);
 assert.equal(grenadeThrowChance({...u,explosives:0},6),grenadeThrowChance({...u,explosives:100},6));
 assert.equal(grenadeThrowCosts({...u,facing:6,weaponReady:true},point,4).total,cost);assert.deepEqual(grenadeThrowPreview(s,u,point,{aim:4}),grenadeThrowPreview(s,u,point,{aim:0}));
});

test('enemy reaction during standing preparation keeps the grenade unthrown',()=>{
 const wallEdges=[{id:'low-screen',x:3,y:3,axis:'y',type:'wall',material:'adobe',blocked:true,blocksSight:true,cover:40,obstacleHeight:.8}];
 const s=field({stance:'prone',movementMode:'prone',agility:0,wisdom:0,experienceLevel:1},[enemy({x:5,weapon:1805,loaded:1,activeSlot:'primary',marksmanship:100,agility:100,wisdom:100,experienceLevel:10,overwatch:true})],{wallEdges,upperSurfaces:[{id:'roof',x:20,y:3,tacticalLevel:1,type:'floor',kind:'roof',elevation:3,blocked:false,cover:0}]});
 assert.equal(canSee(s,actor(s,'e'),actor(s)),false);const n=throwAt(s,{x:5});assert.equal(actor(n).stance,'standing');assert.equal(actor(n,'e').reactionTurn,s.turn);assert.equal(actor(n,'e').loaded,0);assert.ok(actor(n).hp<actor(s).hp);assert.equal(actor(n).inventory.grenades.count,2);assert.equal(getGrenadeThrowVisual(s,n),null);assert.ok(n.log.some(line=>line.includes('preparación se detuvo')));
});

test('a possible dud cannot overflow the saved ground-item limit',()=>{
 const s=field({inventory:{grenades:makeGrenadeStack('arsenal',1,{condition:50})}});
 s.groundItems=Array.from({length:2000},(_,i)=>({id:`old-${i}`,type:'item',item:'medkits',count:0,weight:.2,x:4,y:7}));reject(s);
});
