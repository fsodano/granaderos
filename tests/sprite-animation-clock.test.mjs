import test from 'node:test';
import assert from 'node:assert/strict';
import {startSpriteAnimation} from '../web/lib/sprite-animation-clock.js';
function timers(){
 let now=0,id=0,calls=0;const jobs=new Map();
 return {clock:{now:()=>now,schedule:(callback,delay)=>{jobs.set(++id,{callback,at:now+delay});return id;},cancel:handle=>jobs.delete(handle)},
  advance(to,{late=false}={}){if(late)now=to;while(true){const due=[...jobs].filter(([,job])=>job.at<=to).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;jobs.delete(due[0]);if(!late)now=due[1].at;calls++;due[1].callback();}now=to;},
  pending:()=>jobs.size,calls:()=>calls};
}
test('thirty breathing sprites update at their authored rate, not each display refresh',()=>{
 const time=timers(),seen=Array.from({length:30},()=>[]);
 const stops=seen.map(frames=>startSpriteAnimation({playback:'breathing',frames:4,fps:2,onFrame:frame=>frames.push(frame)},time.clock));
 time.advance(2000);
 for(const frames of seen)assert.deepEqual(frames,[0,1,2,3,0]);
 assert.equal(time.calls(),120,'30 sprites need only two timer callbacks per second each');
 stops.forEach(stop=>stop());assert.equal(time.pending(),0);
 time.advance(6000);assert.equal(time.calls(),120);
});
test('actions end on the final frame without a lingering timer',()=>{
 const time=timers(),frames=[];
 startSpriteAnimation({playback:'action',frames:4,fps:5,onFrame:frame=>frames.push(frame)},time.clock);
 time.advance(2000);assert.deepEqual(frames,[0,1,2,3]);assert.equal(time.calls(),3);assert.equal(time.pending(),0);
});
test('late callbacks preserve elapsed phase and do not replay missed frames',()=>{
 const time=timers(),frames=[];
 const stop=startSpriteAnimation({playback:'breathing',frames:4,fps:2,onFrame:frame=>frames.push(frame)},time.clock);
 time.advance(1750,{late:true});assert.deepEqual(frames,[0,3]);assert.equal(time.calls(),1);
 time.advance(2000);assert.deepEqual(frames,[0,3,0]);stop();
});
test('still, single-frame and stopped animations have no recurring work',()=>{
 for(const config of [{playback:'still',frames:4,fps:5},{playback:'breathing',frames:1,fps:2},{playback:'action',frames:4,fps:0}]){
  const time=timers(),frames=[];startSpriteAnimation({...config,onFrame:frame=>frames.push(frame)},time.clock);time.advance(10000);assert.deepEqual(frames,[0]);assert.equal(time.pending(),0);
 }
 const time=timers(),frames=[];const stop=startSpriteAnimation({playback:'action',frames:4,fps:5,onFrame:frame=>frames.push(frame)},time.clock);
 stop();stop();time.advance(1000);assert.deepEqual(frames,[0]);assert.equal(time.pending(),0);
});
