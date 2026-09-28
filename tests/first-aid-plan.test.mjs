import test from 'node:test';import assert from 'node:assert/strict';
import {firstAidPlan} from '../game/first-aid.js';
const doctor={medical:60,dexterity:75,experienceLevel:4,medkits:3};
const patient={maxHp:100,hp:1,bleeding:10,bandaged:0};

test('critical first aid uses finite skill-based work and can require multiple dressings',()=>{
 const a=firstAidPlan(doctor,patient);assert.equal(a.valid,true);assert.equal(a.hpAfter,9);assert.equal(a.bleedingAfter,2);assert.equal(a.dressingsUsed,1);assert.equal(a.partial,true);
 const b=firstAidPlan({...doctor,medkits:2},{...patient,hp:a.hpAfter,bleeding:a.bleedingAfter,bandaged:a.bandagedAfter});assert.equal(b.hpAfter,15);assert.equal(b.bleedingAfter,0);assert.equal(b.bandagedAfter,85);assert.equal(b.complete,true);
 const weak=firstAidPlan({...doctor,medical:1,dexterity:0,experienceLevel:1},patient);assert.equal(weak.hpAfter,4);assert.equal(weak.bleedingAfter,6);assert.ok(weak.hpGain<a.hpGain);
 for(const baseCost of [18,20,25]){assert.equal(firstAidPlan(doctor,patient,{baseCost,budgetAP:baseCost}).hpAfter,9);assert.equal(firstAidPlan(doctor,patient,{baseCost,budgetAP:baseCost-1}).valid,false);}
});

test('ordinary first aid stops bleeding without healing and complete wounds cannot consume another dressing',()=>{
 const a=firstAidPlan(doctor,{maxHp:100,hp:55,bleeding:4,bandaged:0});assert.equal(a.valid,true);assert.equal(a.hpAfter,55);assert.equal(a.bleedingAfter,0);assert.equal(a.bandagedAfter,45);
 const b=firstAidPlan(doctor,{maxHp:100,hp:55,bleeding:a.bleedingAfter,bandaged:a.bandagedAfter});assert.equal(b.valid,false);assert.equal(b.dressingsUsed,0);
 for(const maxHp of [10,15,60,100])assert.equal(firstAidPlan(doctor,{maxHp,hp:9,bleeding:0}).hpAfter,Math.min(15,maxHp));
 assert.equal(firstAidPlan(doctor,{maxHp:100,hp:14.5,bleeding:2}).hpAfter,15);
 for(const [doc,p]of [[{...doctor,medical:0},patient],[{...doctor,medkits:0},patient],[doctor,{...patient,hp:0}]]){const n=firstAidPlan(doc,p);assert.equal(n.valid,false);assert.equal(n.hpGain,0);assert.equal(n.dressingsUsed,0);}
});
