import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,actBattle} from '../game/tactical.js';
import {emptyGunPreview,targetPreview} from '../game/ja2-hud.js';
import {playerKnownBattle} from '../game/player-known-state.js';
import {addAmmunition,ammunitionByType,availableAmmunition} from '../game/ammunition-types.js';
import {syncUnitAmmunition} from '../game/tactical-ammunition.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';

function field({choice,offhand,ap=100}={}){
 const state=createBattle([{id:'p',name:'Soria',x:2,y:2,facing:2,weapon:1805,loaded:0,ammo:0,
  ...(choice?{ammunitionChoice:choice}:{}),...(offhand?{offHand:{weapon:1808,count:1,weight:1.3,loaded:0,condition:100,jammed:false,instanceId:'second-pistol',...(offhand==='shot'?{ammunitionChoice:'ammoShot'}:{})}}:{})}],{
  width:10,height:8,seed:45,tiles:Array.from({length:80},(_,i)=>({x:i%10,y:Math.floor(i/10),type:'grass',cover:0,blocked:false})),
  enemies:[{id:'e',x:7,y:2,weapon:1813,overwatch:false,patrol:false}],
 });
 const unit=state.units[0];for(const [type,count]of [['pistol_69',11],['rifle_62',27],['shot_16',5]])addAmmunition(unit,type,count);
 syncUnitAmmunition(unit);unit.ap=ap;return state;
}

test('an empty pistol reports only its selected load through HUD and public orders',()=>{
 for(const [choice,family,remaining]of [[undefined,'pistol_69',10],['ammoShot','shot_16',4]]){
  const state=field({choice}),unit=state.units[0],before=structuredClone(state),stock=ammunitionByType(unit);
  const preview=targetPreview(state,unit,state.units[1],{mode:'fire'});
  assert.equal(preview.valid,true);assert.equal(preview.rounds,1);
  assert.equal(preview.coverNote,`Carga 1 cartucho. Quedan ${remaining} de reserva. Hacé otro clic para disparar.`);
  const publicTarget=playerKnownBattle(state).orders.find(order=>order.unitId==='p').targets.find(target=>target.targetId==='e');
  assert.equal(publicTarget.coverNote,preview.coverNote);assert.deepEqual(state,before,'previews do not mutate the battle');
  const next=actBattle(state,{type:'reload',unitId:'p'});assert.equal(next.lastError,null);assert.equal(next.units[0].loaded,1);
  assert.deepEqual(ammunitionByType(next.units[0]),{...stock,[family]:remaining});assert.equal(availableAmmunition(next.units[0],next.units[0]),remaining);
  assert.equal(next.units[0].ap,unit.ap-preview.pa);assert.equal(next.units[1].hp,state.units[1].hp);assert.doesNotThrow(()=>validateBattleSnapshot(JSON.parse(JSON.stringify(next))));
 }
});

test('paired reload reserves count each selected family once and exclude pending hands',()=>{
 for(const [offhand,ap,rounds,remaining]of [['ball',100,3,8],['shot',100,3,13],['shot',86,1,10],['shot',20,0,11]]){
  const state=field({offhand,ap}),unit=state.units[0],before=structuredClone(state),preview=emptyGunPreview(state,unit);
  assert.equal(preview.valid,true);assert.equal(preview.rounds,rounds);assert.match(preview.coverNote,new RegExp(`Quedan ${remaining} cartuchos de reserva\\.`));
  assert.deepEqual(state,before);
  const next=actBattle(state,{type:'reload',unitId:'p'});assert.equal(next.lastError,null);assert.equal(next.units[0].ap,ap-preview.pa);
  assert.equal(ammunitionByType(next.units[0]).rifle_62,27,'rifle stock is neither promised nor consumed');
  assert.equal(next.units[0].loaded+(next.units[0].offHand?.loaded??0),rounds);
  assert.deepEqual(ammunitionByType(next.units[0]),{pistol_69:11-(offhand==='ball'?rounds:Math.min(1,rounds)),rifle_62:27,shot_16:5-(offhand==='shot'?Math.max(0,rounds-1):0)});
 }
});
