import test from 'node:test';
import assert from 'node:assert/strict';
import {applyCivilianHarm,civilianIncidents,civilianWoundedByPlayer} from '../game/civilian-harm.js';

const field=()=>({units:[{id:'p',side:'player'},{id:'m',side:'player',militia:true},{id:'e',side:'enemy'}]});
const local=()=>({id:'civil',name:'Vecina',x:3,y:3,hp:100,energy:100,stance:'standing'});
test('direct player wounds retain one exact attribution before a separately attributed death',()=>{
 const s=field(),n=local();
 applyCivilianHarm(s,n,{source:s.units[0],damage:20,breathLoss:10,intentional:true});
 assert.equal(n.hp,80);assert.equal(n.energy,90);assert.equal(civilianWoundedByPlayer(n),true);
 const wound=structuredClone(civilianIncidents(n)[0]);
 applyCivilianHarm(s,n,{source:s.units[0],damage:20,breathLoss:10});
 assert.deepEqual(civilianIncidents(n),[wound]);
 applyCivilianHarm(s,n,{source:s.units[2],damage:100,breathLoss:100});
 assert.equal(n.hp,0);assert.equal(n.unconscious,false);assert.equal(n.stance,'prone');
 assert.deepEqual(civilianIncidents(n),[wound,{sequence:2,kind:'death',attackerId:'e',side:'enemy',militia:false,intentional:false,hpBefore:60,hpAfter:0}]);
 const corpse=structuredClone(n);applyCivilianHarm(s,n,{source:s.units[0],damage:999});assert.deepEqual(n,corpse);
 assert.equal(n.inventory,undefined);assert.equal(n.ap,undefined);assert.equal(n.xp,undefined);
});
test('militia, enemy and unattributed hazards never manufacture a personal player wound',()=>{
 for(const index of [1,2,null]){
  const s=field(),n=local(),source=index===null?null:s.units[index];
  applyCivilianHarm(s,n,{source,damage:90,breathLoss:25});
  assert.equal(n.hp,10);assert.equal(n.unconscious,true);assert.equal(n.stance,'prone');assert.equal(civilianWoundedByPlayer(n),false);
  applyCivilianHarm(s,n,{source,damage:50});
  const [death]=civilianIncidents(n);assert.equal(death.kind,'death');assert.equal(death.sequence,1);assert.equal(death.side,source?.side??'unknown');assert.equal(death.attackerId,source?.id??null);assert.equal(death.militia,Boolean(source?.militia));
 }
});
test('energy loss, blocked damage and legacy wounds do not create civic blame',()=>{
 const s=field(),n=local();n.hp=42.5;
 applyCivilianHarm(s,n,{source:s.units[0],damage:0,breathLoss:100,knockedDown:true});
 assert.equal(n.hp,42.5);assert.equal(n.energy,0);assert.equal(n.unconscious,true);assert.equal(n.knockedDown,true);assert.deepEqual(civilianIncidents(n),[]);
 applyCivilianHarm(s,n,{source:{id:'missing',side:'player'},damage:100});
 assert.equal(civilianIncidents(n)[0].side,'unknown');assert.equal(civilianIncidents(n)[0].hpBefore,42.5);
 const oldCorpse={...local(),hp:0};applyCivilianHarm(s,oldCorpse,{source:s.units[0],damage:20});assert.deepEqual(civilianIncidents(oldCorpse),[]);
});
test('receipt admission rejects altered sequence, attribution, health and resurrection',()=>{
 const s=field(),n=local();applyCivilianHarm(s,n,{source:s.units[0],damage:100,intentional:true});
 assert.deepEqual(civilianIncidents(JSON.parse(JSON.stringify(n))),civilianIncidents(n));
 for(const patch of [{sequence:2},{kind:'fake'},{side:'unknown'},{attackerId:null},{hpBefore:0},{hpAfter:1},{extra:true},{militia:'yes'}]){
  const invalid=structuredClone(n);Object.assign(invalid.civilianHarm.incidents[0],patch);assert.throws(()=>civilianIncidents(invalid),JSON.stringify(patch));
 }
 assert.throws(()=>civilianIncidents({...n,hp:1}));
 const hurt=local();applyCivilianHarm(s,hurt,{source:s.units[0],damage:20});hurt.hp=0;assert.throws(()=>civilianIncidents(hurt),/muerte/);
 assert.throws(()=>civilianIncidents({...n,civilianHarm:{version:1,incidents:[]}}));
 assert.throws(()=>civilianIncidents({...n,civilianHarm:{version:2,incidents:n.civilianHarm.incidents}}));
 const departed={...local(),departure:{}};applyCivilianHarm(s,departed,{source:s.units[0],damage:100});assert.equal(departed.hp,100);
});
