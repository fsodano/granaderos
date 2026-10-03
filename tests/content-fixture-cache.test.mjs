import test from 'node:test';
import assert from 'node:assert/strict';
import {contentFixtureCache} from './content-fixture-cache.mjs';
import {defaultContentPackage} from '../game/content-package.js';

test('fixture reuse keys the full content while ignoring object property order',()=>{
 let setups=0;
 const fixture=contentFixtureCache(content=>({setup:++setups,content}));
 const first=fixture({id:'same',rules:{price:10,enabled:true},characters:[{id:'one'},{id:'two'}]});
 const reordered=fixture({characters:[{id:'one'},{id:'two'}],rules:{enabled:true,price:10},id:'same'});
 assert.deepEqual(reordered,first);assert.equal(setups,1);
 const otherRule=fixture({id:'same',rules:{price:11,enabled:true},characters:[{id:'one'},{id:'two'}]});
 const otherCharacters=fixture({id:'same',rules:{price:10,enabled:true},characters:[{id:'two'},{id:'one'}]});
 assert.equal(setups,3);assert.equal(otherRule.content.rules.price,11);assert.equal(otherCharacters.content.characters[0].id,'two');
});

test('caller edits, returned snapshots and retained setup references cannot change a cached fixture',()=>{
 let setups=0,original;
 const fixture=contentFixtureCache(content=>original={content,setup:++setups,units:[{hp:100}]});
 const input={id:'isolation',rules:{price:10}},before=structuredClone(input),cold=fixture(input);
 assert.deepEqual(input,before);
 cold.units[0].hp=0;cold.content.rules.price=99;original.units[0].hp=1;
 input.rules.price=20;
 const hot=fixture(before),another=fixture(structuredClone(before));
 assert.equal(setups,1);assert.equal(hot.units[0].hp,100);assert.equal(hot.content.rules.price,10);
 assert.deepEqual(hot,another);assert.notEqual(hot,another);assert.notEqual(hot.units,another.units);
 const changed=fixture(input);assert.equal(setups,2);assert.equal(changed.content.rules.price,20);
});

test('failed setup is retried and the default package shares its exact authored key',()=>{
 let attempts=0;
 const fixture=contentFixtureCache(content=>{if(++attempts===1)throw Error('setup failed');return {content:content??defaultContentPackage()};});
 assert.throws(()=>fixture(),/setup failed/);
 const cold=fixture(),hot=fixture(defaultContentPackage());
 assert.equal(attempts,2);assert.deepEqual(hot,cold);assert.notEqual(hot.content,cold.content);
});
