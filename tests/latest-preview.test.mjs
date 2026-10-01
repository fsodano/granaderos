import test from 'node:test';
import assert from 'node:assert/strict';
import {createLatestPreview} from '../web/lib/latest-preview.js';
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 const started=[],received=[],pending=new Map();
 const queue=createLatestPreview(job=>{
  started.push(job);
  return new Promise((resolve,reject)=>pending.set(job,{resolve,reject}));
 },(job,result,error)=>received.push({job,result,error}));
 return {queue,started,received,pending};
}
test('rapid pointer changes calculate only the active destination and the latest replacement',async()=>{
 const {queue,started,received,pending}=fixture();
 queue.request('A');queue.request('B');queue.request('C');
 assert.deepEqual(started,['A']);
 pending.get('A').resolve('obsolete route');await settle();
 assert.deepEqual(started,['A','C']);assert.deepEqual(received,[]);
 pending.get('C').resolve('current route');await settle();
 assert.deepEqual(received,[{job:'C',result:'current route',error:undefined}]);queue.close();
});
test('clearing selection or leaving the battle suppresses queued and in-flight results',async()=>{
 const {queue,started,received,pending}=fixture();
 queue.request('old battle');queue.request('queued target');queue.request(null);
 pending.get('old battle').resolve('stale');await settle();
 assert.deepEqual(started,['old battle']);assert.deepEqual(received,[]);
 queue.request('new battle');queue.request('new target');queue.close();
 pending.get('new battle').resolve('late');await settle();queue.request('after close');
 assert.deepEqual(started,['old battle','new battle']);assert.deepEqual(received,[]);
});
test('an obsolete failure cannot replace a newer route and current failures remain reportable',async()=>{
 const {queue,started,received,pending}=fixture();
 queue.request('old');queue.request('new');pending.get('old').reject(Error('old failure'));await settle();
 assert.deepEqual(started,['old','new']);assert.deepEqual(received,[]);
 const failure=Error('worker unavailable');pending.get('new').reject(failure);await settle();
 assert.deepEqual(received,[{job:'new',result:undefined,error:failure}]);
 queue.request('recovered');pending.get('recovered').resolve('route');await settle();
 assert.equal(received.at(-1).result,'route');queue.close();
});
