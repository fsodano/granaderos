import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,movementEnergy,movementStepCost,getReachable,carriedWeight,carryCapacity,endTurn} from '../game/tactical.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
const field=(unit={})=>createBattle([{id:'walker',x:1,y:1,strength:75,...unit},{id:'helper',x:0,y:3}],{width:42,height:4,tiles:Array.from({length:168},(_,i)=>({x:i%42,y:Math.floor(i/42),type:'grass',blocked:false,cover:0})),exploration:true,enemies:[],hour:12});
const hostileField=(unit={})=>createBattle([{id:'walker',x:1,y:1,strength:75,...unit},{id:'helper',x:0,y:3}],{width:42,height:8,tiles:Array.from({length:336},(_,i)=>({x:i%42,y:Math.floor(i/42),type:Math.floor(i/42)===4?'wall':'grass',blocked:Math.floor(i/42)===4,cover:0})),exploration:true,enemies:[{id:'guard',x:20,y:6,patrol:false}],hour:12});
const move=(s,x)=>{const n=actBattle(s,{type:'move',unitId:'walker',x,y:1});assert.equal(n.lastError,null);return n;};
test('ordinary exploration walking crosses the map 25 times without fainting and survives every saved leg',()=>{
 let s=field();const original=structuredClone(s),ap=s.units[0].ap;
 assert.ok(carriedWeight(s.units[0])<=carryCapacity(s.units[0]),'the ordinary musket and carried supplies fit a normal-strength soldier');
 for(let leg=0;leg<25;leg++){const x=leg%2?1:41;s=move(s,x);assert.equal(s.units[0].x,x,'each complete 40-tile crossing must finish');assert.equal(s.units[0].unconscious,false);s=validateBattleSnapshot(JSON.parse(JSON.stringify(s)));}
 assert.equal(s.units[0].energy,50);assert.equal(s.units[0].ap,ap);assert.equal(s.elapsedSeconds,3000);assert.equal(s.units[0].hp,original.units[0].hp);assert.equal(s.units[0].loaded,original.units[0].loaded);assert.deepEqual(original,field());
});
test('splitting a walking order or saving mid-route cannot avoid breath costs',()=>{
 const single=move(field(),11);let split=field();for(let x=2;x<=11;x++)split=move(validateBattleSnapshot(JSON.parse(JSON.stringify(split))),x);
 assert.equal(split.units[0].energy,single.units[0].energy);assert.equal(single.units[0].energy,99.5);assert.equal(split.elapsedSeconds,single.elapsedSeconds);
});
test('running, crawling, mud and overload retain meaningful endurance costs',()=>{
 const u=field().units[0],walk=movementEnergy(u,{type:'grass'},true);
 for(const movementMode of ['run','prone','crouch'])assert.ok(movementEnergy({...u,movementMode},{type:'grass'},true)>walk);
 assert.ok(movementEnergy(u,{type:'mud'},true)>walk);assert.ok(movementEnergy({...u,weight:80},{type:'grass'},true)>walk);
 const running=move(field({movementMode:'run'}),41);assert.equal(running.units[0].energy,40);assert.equal(running.elapsedSeconds,40);
 for(const [movementMode,expected] of [['crouch',90],['prone',40]])assert.equal(move(field({movementMode}),41).units[0].energy,expected);
});
test('crouched exploration can cross 200 tiles while retaining its higher walking cost',()=>{
 let s=field({movementMode:'crouch'});const ap=s.units[0].ap;
 for(const x of [41,1,41,1,41]){s=move(s,x);assert.equal(s.units[0].x,x);assert.equal(s.units[0].unconscious,false);}
 assert.equal(s.units[0].energy,50);assert.equal(s.units[0].ap,ap);assert.equal(s.units[0].stance,'crouched');assert.equal(s.elapsedSeconds,600);
});
test('hostile exploration has the same walking range while combat retains its action costs',()=>{
 let s=hostileField();
 for(const x of [41,1,41,1,41]){s=move(s,x);assert.equal(s.mode,'exploration');assert.equal(s.sectorCleared,false);}
 assert.equal(s.units[0].energy,90);assert.equal(s.units[0].unconscious,false);
 const combat=field();combat.mode='combat';combat.sectorCleared=false;
 assert.equal(move(combat,2).units[0].energy,99);
 const hostile=hostileField({energy:20});
 assert.equal(endTurn(hostile).units[0].energy,80);
});
test('a tired arrival can cross 400 ordinary tiles without a faint or free energy recovery',()=>{
 let s=field({energy:46,fatigue:54,hp:70,bandaged:30});const before=structuredClone(s.units[0]);
 for(let leg=0;leg<10;leg++){const x=leg%2?1:41;s=move(s,x);assert.equal(s.units[0].x,x);assert.equal(s.units[0].unconscious,false);}
 assert.equal(s.units[0].energy,26);assert.equal(s.units[0].fatigue,54);assert.equal(s.units[0].hp,70);assert.equal(s.units[0].bandaged,30);assert.equal(s.units[0].ap,before.ap);
});
test('severe exhaustion, overloaded walking and critical wounds still restrict exploration',()=>{
 const exhausted=move(field({energy:.04}),41).units[0];
 assert.equal(exhausted.x,2);assert.equal(exhausted.energy,0);assert.equal(exhausted.unconscious,true);assert.equal(exhausted.ap,0);
 const light=move(field({energy:5,strength:40}),41).units[0],heavy=move(field({energy:5,strength:40,weight:80}),41).units[0];
 assert.equal(light.x,41);assert.equal(light.unconscious,false);assert.ok(heavy.x<41);assert.equal(heavy.energy,0);assert.equal(heavy.unconscious,true);
 const fatigued=move(field({energy:10,fatigue:90,hp:50,bandaged:50}),41).units[0];
 assert.equal(fatigued.energy,8);assert.equal(fatigued.hp,50);assert.equal(fatigued.fatigue,90);
 const critical=field({hp:14,bandaged:86}),attempt=actBattle(critical,{type:'move',unitId:'walker',x:2,y:1});
 assert.ok(attempt.lastError);assert.deepEqual(attempt.units,critical.units);assert.equal(attempt.elapsedSeconds,critical.elapsedSeconds);
});
test('route estimates match walk execution on mud and diagonals while rejected moves debit nothing',()=>{
 const s=field({strength:40,weight:25});for(const tile of s.tiles)if(tile.x>=3)tile.type='mud';
 const u=s.units[0],route=getReachable(s,u).find(point=>point.x===6&&point.y===2);assert.ok(route);
 let from=u,energy=u.energy,apCost=0;
 for(const point of route.path){const ground=s.tiles[point.y*s.width+point.x],factor=from.x!==point.x&&from.y!==point.y?1.4:1;energy=Math.round((energy-movementEnergy(u,ground,true)*factor)*1000)/1000;apCost+=movementStepCost(s,u,from,point);from=point;}
 assert.equal(route.cost,apCost);
 const n=actBattle(s,{type:'move',unitId:u.id,x:6,y:2});assert.equal(n.lastError,null);assert.equal(n.units[0].energy,energy);assert.equal(n.units[0].ap,u.ap);
 const blocked=actBattle(n,{type:'move',unitId:u.id,x:-1,y:2});assert.ok(blocked.lastError);assert.deepEqual(blocked.units,n.units);assert.equal(blocked.elapsedSeconds,n.elapsedSeconds);
});
test('combat walking, running and low postures retain their existing breath and action costs',()=>{
 for(const [movementMode,energy] of [['walk',99],['run',97],['crouch',98],['prone',97]]){
  const s=field({movementMode});s.mode='combat';s.sectorCleared=false;const before=s.units[0],route=getReachable(s,before).find(point=>point.x===2&&point.y===1),n=move(s,2);
  assert.equal(n.units[0].energy,energy);assert.equal(n.units[0].ap,before.ap-route.cost);assert.equal(n.units[0].hp,before.hp);
 }
});
test('contact interrupts rest after only the energy earned during elapsed time',()=>{
 const s=createBattle([{id:'walker',x:1,y:1,energy:20,facing:2}],{width:24,height:4,exploration:true,hour:5,secondOfHour:3594,enemies:[{id:'guard',x:11,y:1,facing:6,patrol:false}]});
 assert.equal(s.mode,'exploration');
 const n=endTurn(s);
 assert.equal(n.mode,'combat');assert.equal(n.elapsedSeconds,6);
 assert.equal(n.units[0].energy,20.6);
});
test('a combat round restores twenty energy without healing wounds or bypassing fatigue',()=>{
 for(const [energy,fatigue,hp,expected] of [[20,0,70,40],[50,40,70,60],[0,0,10,20]]){
  const s=hostileField({energy,fatigue,hp,bandaged:100-hp});s.mode='combat';
  const n=endTurn(s),u=n.units[0];
  assert.equal(u.energy,expected);assert.equal(u.hp,hp);assert.equal(u.unconscious,hp<15);
 }
});
test('one exploration rest restores 60 energy, respects fatigue, and wakes exhaustion without healing wounds',()=>{
 for(const [energy,fatigue,hp,expected] of [[20,0,70,80],[20,40,70,60],[0,0,70,60],[0,0,10,60]]){
  const b=field({energy,fatigue,hp,bandaged:100-hp}),n=endTurn(b),u=n.units[0];
  assert.equal(u.energy,expected);assert.equal(u.hp,hp);assert.equal(u.fatigue,fatigue);assert.equal(u.unconscious,hp<15);assert.equal(n.elapsedSeconds,600);
  assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(n))),n);
 }
});
