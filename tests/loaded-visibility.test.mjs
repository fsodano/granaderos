import test from 'node:test';import assert from 'node:assert/strict';
import {createBattle,visibleEnemies,visibleHostiles,firearmShotOptions,firearmFlightPreview,shotChance} from '../game/tactical.js';
const field=()=>createBattle([{id:'p',x:2,y:5,facing:2,weapon:1805}],{width:24,height:15,enemies:Array.from({length:30},(_,i)=>({id:`e${i}`,x:8+i%6,y:2+Math.floor(i/6),weapon:1800})),exploration:true});
test('direct enemy visibility matches full hostile lists across changed sight and casualties',()=>{
 for(const patch of [{},{night:true},{deployment:{}}]){
  const s=field();Object.assign(s,patch);s.units[4].hp=0;s.units[5].departure={};s.units[6].unconscious=true;
  const expected=s.units.filter(v=>v.side==='enemy'&&visibleHostiles(s,s.units[0]).some(t=>t.id===v.id));
  assert.deepEqual(visibleEnemies(s),expected);
 }
});
test('shared shot scene preserves each body-region flight and chance, including an intervening ally',()=>{
 for(const ally of [false,true]){
  const s=field(),u=s.units[0],target=s.units.find(v=>v.id==='e18');
  if(ally)s.units.push({...u,id:'ally',x:5,y:5});
  const before=structuredClone(s),options=firearmShotOptions(s,u,target,4);
  assert.ok(options.length);
  for(const option of options){assert.equal(option.chance,shotChance(s,u,target,option.aim,option.hitLocation));assert.equal(option.damageFactor,firearmFlightPreview(s,u,target,option.hitLocation).damageFactor);}
  assert.deepEqual(s,before);
 }
});
