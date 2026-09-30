import test from 'node:test';
import assert from 'node:assert/strict';
import {RouteQueue} from '../game/route-queue.js';

test('route frontier retains stable ties through interleaved additions and removals',()=>{
 const queue=new RouteQueue({id:'start',cost:0});
 assert.equal(queue.shift().id,'start');
 for(const point of [{id:'a',cost:8},{id:'b',cost:4},{id:'c',cost:8},{id:'d',cost:4}])queue.push(point);
 assert.equal(queue.shift().id,'b');
 queue.push({id:'e',cost:4});queue.push({id:'f',cost:2});
 assert.deepEqual(Array.from({length:5},()=>queue.shift().id),['f','d','e','a','c']);
 assert.equal(queue.length,0);assert.equal(queue.shift(),undefined);
});

test('large mixed-cost frontier preserves every cell and stable priority',()=>{
 const points=Array.from({length:4096},(_,id)=>({id,cost:(id*7919)%97}));
 const queue=new RouteQueue();for(const point of points)queue.push(point);
 assert.deepEqual(points.map(()=>queue.shift()),[...points].sort((a,b)=>a.cost-b.cost));
 assert.equal(queue.length,0);
});
