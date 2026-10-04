import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle,endTurn,movementEnergy} from '../game/tactical.js';
import {maximumEnergy} from '../game/fatigue.js';
import {movementStep} from '../game/movement-step.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

const tiles=Array.from({length:224},(_,i)=>({x:i%28,y:Math.floor(i/28),type:'grass',blocked:false,cover:0}));
const field=(unit={},exploration=true)=>createBattle([{id:'p',x:1,y:2,weapon:1800,loaded:1,ammo:2,medkits:1,rations:1,...unit}],{
 width:28,height:8,tiles,exploration,hour:12,seed:45,
 enemies:exploration?[]:[{id:'e',x:26,y:7,weapon:0,patrol:false,overwatch:false}],
});
const player=s=>s.units.find(u=>u.id==='p');
const move=(s,movement,x=2,y=2)=>{
 const n=actBattle(s,{type:'move',unitId:'p',x,y,movement});
 assert.equal(n.lastError,null,n.lastError);return n;
};
const custody=u=>Object.fromEntries(['weapon','blade','offHand','inventory','loaded','ammo','medkits','rations','flints','torches','grenades','toolkitPoints'].map(key=>[key,u[key]]));

test('real exploration running spends less breath while retaining walking cost, speed and finite equipment',()=>{
 const s=field(),before=structuredClone(s),running=move(s,'run',11),walking=move(s,'walk',11);
 assert.equal(player(running).energy,92.25);assert.equal(player(walking).energy,99.5);
 assert.equal(running.elapsedSeconds,10);assert.equal(walking.elapsedSeconds,30);
 for(const n of [running,walking]){
  assert.deepEqual([player(n).x,player(n).y],[11,2]);assert.equal(player(n).ap,player(s).ap);
  assert.equal(player(n).fatigue,player(s).fatigue);assert.equal(player(n).hp,player(s).hp);
  assert.deepEqual(custody(player(n)),custody(player(s)));
  assert.deepEqual(validateBattleSnapshot(JSON.parse(JSON.stringify(n))),n);
 }
 assert.deepEqual(s,before);
});

test('combat running retains whole breath charges and the same paid AP and round time',()=>{
 const s=field({},false),running=move(s,'run'),walking=move(s,'walk');
 assert.equal(player(running).energy,98);assert.equal(player(walking).energy,99);
 assert.equal(player(running).ap,player(s).ap-6);assert.equal(player(walking).ap,player(s).ap-8);
 assert.equal(running.elapsedSeconds,6);assert.equal(walking.elapsedSeconds,6);
 assert.deepEqual(custody(player(running)),custody(player(s)));
 const diagonal=move(s,'run',2,3);
 assert.equal(player(diagonal).energy,97);assert.equal(player(diagonal).ap,player(s).ap-9);
 assert.ok(Number.isInteger(player(diagonal).energy));
 assert.doesNotThrow(()=>validateBattleSnapshot(diagonal));
});

test('running preserves load, mud, riding and trait modifiers and the other posture costs',()=>{
 const bare={weapon:0,strength:100,movementMode:'run'},grass={type:'grass'},mud={type:'mud'};
 assert.equal(movementEnergy(bare,grass,true),.775);
 assert.equal(movementEnergy({...bare,weight:200},grass,true),3.1);
 assert.equal(movementEnergy({...bare,weight:200},grass),8);
 assert.equal(movementEnergy(bare,mud,true),1.163);assert.equal(movementEnergy(bare,mud),3);
 assert.equal(movementEnergy({...bare,mounted:true,ridingSkill:100},grass,true),.388);
 assert.equal(movementEnergy({...bare,traits:['guerrilla_tactician']},grass,true),.581);
 for(const [movementMode,exploration,combat] of [['walk',.05,1],['crouch',.25,2],['prone',1.5,3]]){
  assert.equal(movementEnergy({...bare,movementMode},grass,true),exploration);
  assert.equal(movementEnergy({...bare,movementMode},grass),combat);
 }
 const s=field(),diagonal=move(s,'run',2,3);
 assert.equal(player(diagonal).energy,98.915);assert.equal(diagonal.elapsedSeconds,2);
 assert.equal(player(diagonal).ap,player(s).ap);
});

test('reduced running still exhausts at the paid cell and recovery respects the fatigue ceiling',()=>{
 const s=field({energy:1.55,fatigue:40}),n=move(s,'run',11);
 assert.deepEqual([player(n).x,player(n).y],[3,2]);assert.equal(n.elapsedSeconds,2);
 assert.equal(player(n).energy,0);assert.equal(player(n).unconscious,true);assert.equal(player(n).ap,0);
 assert.equal(player(n).hp,player(s).hp);assert.equal(player(n).fatigue,40);
 assert.deepEqual(custody(player(n)),custody(player(s)));
 const rejected=actBattle(n,{type:'move',unitId:'p',x:4,y:2,movement:'run'});
 assert.ok(rejected.lastError);assert.deepEqual(rejected.units,n.units);assert.equal(rejected.elapsedSeconds,n.elapsedSeconds);
 const resting=endTurn(n);
 assert.equal(player(resting).energy,maximumEnergy(player(resting)));assert.equal(player(resting).energy,60);
 assert.equal(player(resting).fatigue,40);assert.equal(player(resting).unconscious,false);
});

test('a saved running continuation charges only reached cells and retains the same final physical result',()=>{
 const s=field({energy:75,fatigue:25}),action={type:'move',unitId:'p',x:11,y:2,movement:'run'};
 let result=movementStep(s,action);
 assert.equal(player(result.state).x,2);assert.equal(player(result.state).energy,74.225);
 assert.equal(result.state.elapsedSeconds,1);assert.equal(result.continuation.length,9);
 while(result.status==='moving')result=movementStep(validateBattleSnapshot(JSON.parse(JSON.stringify(result.state))),action,result.continuation);
 assert.equal(result.status,'completed');
 const whole=actBattle(s,action),physical=n=>({unit:{...player(n),lastMovePath:undefined},elapsedSeconds:n.elapsedSeconds,seed:n.seed,mode:n.mode,phase:n.phase});
 assert.deepEqual(physical(result.state),physical(whole));assert.equal(player(result.state).energy,67.25);
 assert.deepEqual(custody(player(result.state)),custody(player(s)));
});
