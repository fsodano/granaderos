import test from 'node:test';
import assert from 'node:assert/strict';
import {mountainCommandRolePlan} from './mountain-command-role-plan.mjs';

test('a preferred commander cannot consume one of the three required physicians',()=>{
 const dual={id:1,leadership:89,medical:65},leader={id:2,leadership:86,medical:25},second={id:3,medical:93},third={id:4,medical:70};
 const input={commanders:[dual,leader],physicians:[second,third,dual],count:3},before=structuredClone(input),plan=mountainCommandRolePlan(input);
 assert.strictEqual(plan.commander,leader);assert.deepEqual(plan.doctors,[second,third,dual]);assert.deepEqual(input,before);
});

test('a spare physician allows the preferred qualified commander and preserves the current physician ranking',()=>{
 const dual={id:1},leader={id:2},physicians=[{id:3},{id:4},dual,{id:5}],plan=mountainCommandRolePlan({commanders:[dual,leader],physicians,count:3});
 assert.strictEqual(plan.commander,dual);assert.deepEqual(plan.doctors,[physicians[0],physicians[1],physicians[3]]);
});

test('an insufficient distinct role pool refuses without claiming a partial plan',()=>{
 const only={id:1},input={commanders:[only],physicians:[only,{id:2},{id:3}],count:3},before=structuredClone(input);
 assert.equal(mountainCommandRolePlan(input),null);assert.deepEqual(input,before);
});

test('duplicate current identities and an unbounded doctor count cannot fill multiple roles',()=>{
 assert.throws(()=>mountainCommandRolePlan({commanders:[{id:1}],physicians:[{id:2},{id:2}],count:2}),/distinct/);
 assert.throws(()=>mountainCommandRolePlan({commanders:[{id:1}],physicians:[],count:5}));
});
