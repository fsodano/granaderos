import test from 'node:test';
import assert from 'node:assert/strict';
import {detentionManifest} from '../game/detention.js';
import {planDetentionHealth} from '../game/detention-health.js';
import {advanceCivilianBleeding} from '../game/civilian-harm.js';

function fixture(){
 const record={captured:true,alive:true,capturedSector:'tucuman',capturedAt:18,hp:11,maxHp:64,energy:30,bleeding:2,bandaged:40};
 const npc=detentionManifest({operativeState:{112:record}},[{id:112,name:'Médico',maxHp:64}],'tucuman')[0];
 return {record,npc};
}
test('prisoner wound planning retains actual bleeding damage without mutating custody',()=>{
 const {record,npc}=fixture(),before=structuredClone(record);
 advanceCivilianBleeding({units:[]},npc,2);
 const plan=planDetentionHealth(112,record,npc);
 assert.equal(plan.health.hp,7);assert.equal(plan.health.bleeding,2);assert.equal(plan.health.bandaged,40);
 assert.equal(plan.health.alive,true);assert.equal(plan.health.unconscious,true);assert.deepEqual(record,before);
 assert.deepEqual(Object.keys(plan).sort(),['health','hpRestored']);
});
test('critical care increases health once and saved acknowledgements cannot be spent again',()=>{
 const {record,npc}=fixture();npc.hp=15;npc.unconscious=false;npc.bleeding=0;delete npc.bleedSource;npc.bandaged=49;npc.civilianFirstAid={version:1,hpRestored:4};
 const plan=planDetentionHealth(112,record,npc);assert.equal(plan.health.hp,15);
 const next={...record,...plan.health};
 assert.deepEqual(planDetentionHealth(112,next,JSON.parse(JSON.stringify(npc)),plan.hpRestored),plan);
 next.hp=12;next.unconscious=true;assert.throws(()=>planDetentionHealth(112,next,npc,plan.hpRestored));
 npc.hp=12;npc.unconscious=true;assert.equal(planDetentionHealth(112,next,npc,plan.hpRestored).health.hp,12);
 delete npc.civilianFirstAid;assert.throws(()=>planDetentionHealth(112,next,npc,plan.hpRestored));
});
test('actual fatal bleeding produces a death plan and never resurrects the prisoner',()=>{
 const {record,npc}=fixture();advanceCivilianBleeding({units:[]},npc,6);
 const plan=planDetentionHealth(112,record,npc);assert.equal(plan.health.hp,0);assert.equal(plan.health.alive,false);assert.equal(plan.health.bleeding,0);
 assert.deepEqual(planDetentionHealth(112,{...record,...plan.health},npc),plan);
 npc.hp=1;assert.throws(()=>planDetentionHealth(112,{...record,...plan.health},npc));
});
test('custody mismatch, free healing, missing death and invalid energy are rejected',()=>{
 const {record,npc}=fixture();
 assert.throws(()=>planDetentionHealth(122,record,npc));
 for(const patch of [{captured:false},{capturedAt:19},{capturedSector:'cordoba'},{maxHp:65}])assert.throws(()=>planDetentionHealth(112,{...record,...patch},npc));
 for(const patch of [{hp:12},{hp:0,bleeding:0,bleedSource:undefined},{energy:NaN},{energy:-1},{energy:101}])assert.throws(()=>planDetentionHealth(112,record,{...npc,...patch}));
 assert.throws(()=>planDetentionHealth(112,record,npc,-1));
 const stripped={...npc};for(const key of ['civilianWoundVersion','bleeding','bandaged','bleedSource'])delete stripped[key];
 assert.throws(()=>planDetentionHealth(112,record,stripped));
});
test('fractional wounds and lower energy survive planning without rounding or recovery',()=>{
 const {record,npc}=fixture();npc.hp=10.25;npc.energy=21;
 const plan=planDetentionHealth(112,record,npc);assert.equal(plan.health.hp,10.25);assert.equal(plan.health.energy,21);
 assert.deepEqual(planDetentionHealth(112,{...record,...plan.health},npc),plan);
});
