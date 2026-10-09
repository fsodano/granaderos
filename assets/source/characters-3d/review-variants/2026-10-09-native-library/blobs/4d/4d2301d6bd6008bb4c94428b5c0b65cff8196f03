import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {banks,sampleBank} from './character-bank-fixture.mjs';
import {Quaternion} from '../web/node_modules/three/build/three.module.js';

const names=new Set(['stand.idle.long-gun','stand.butt.long-gun']);
for(const [gender,bank]of Object.entries(banks)){
 const source=JSON.parse(readFileSync(new URL(`../assets/source/characters-3d/authoring/rifle_guard_curves_${gender}.json`,import.meta.url),'utf8'));
 test(`${gender}: rifle guard and regrip keep every authored subframe rotation and holding interval`,()=>{
  assert.deepEqual(new Set(Object.keys(source.clips)),names);
  for(const [name,curve]of Object.entries(source.clips)){
   const spec=bank.specs.find(s=>s.name===name),animation=bank.data.json.animations.find(a=>a.name===name);
   assert.equal(spec.duration,curve.duration);assert.equal(spec.loop,curve.loop);assert.deepEqual(spec.markers,curve.markers);
   assert.deepEqual(spec.gripOffsets,curve.gripOffsets);
   const channels=animation.channels.filter(c=>c.target.path==='rotation'&&Object.hasOwn(curve.rotations,bank.data.json.nodes[c.target.node].name));
   assert.equal(channels.length,36);
   for(const channel of channels){
    const sampler=animation.samplers[channel.sampler],bone=bank.data.json.nodes[channel.target.node].name;
    assert.equal(sampler.interpolation??'LINEAR','LINEAR');
    assert.deepEqual(bank.data.access(sampler.input),curve.times.map(Math.fround),`${name}/${bone} retains subframes`);
    assert.deepEqual(bank.data.access(sampler.output),curve.rotations[bone].flat().map(Math.fround),`${name}/${bone} retains reviewed rotations`);
   }
   if(name==='stand.butt.long-gun'){
    const rule=spec.nativeHandContacts;
    assert.deepEqual(rule,curve.nativeHandContacts);assert.equal(rule.version,1);assert.equal(rule.space,'skinned-hand-to-stock');
    assert.deepEqual(rule.powered,[.22,.66]);assert.equal(spec.markers.contact,.42);
    for(let frame=0;frame<=240;frame++){
     const time=frame/240,held=['left','right'].filter(side=>rule.hands[side].some(([a,b])=>time>=a-1e-7&&time<=b+1e-7));
     assert.ok(held.length>0,`At least one holding hand at ${time}`);
     if(time>=.22&&time<=.66)assert.deepEqual(held,['left','right'],`Both hands hold through powered contact at ${time}`);
    }
   }
  }
 });
 test(`${gender}: rifle regrip has bounded native wrists and no abrupt finger release`,()=>{
  const curve=source.clips['stand.butt.long-gun'];
  for(const [bone,values]of Object.entries(curve.rotations)){
   let peak=0;
   for(let i=1;i<values.length;i++){
    const a=new Quaternion().fromArray(values[i-1]).normalize(),b=new Quaternion().fromArray(values[i]).normalize();
    peak=Math.max(peak,a.angleTo(b)*180/Math.PI/(curve.times[i]-curve.times[i-1]));
   }
   assert.ok(peak<(/^(upperarm|lowerarm|hand)_/.test(bone)?1300:1100),`${bone}: ${peak} degrees/s`);
  }
  const samples=sampleBank(bank,'stand.butt.long-gun',Array.from({length:241},(_,i)=>i/240),(point)=>{
   const bend={};
   for(const side of ['l','r'])bend[side]=point('hand_'+side).sub(point('lowerarm_'+side)).angleTo(point('middle_01_'+side).sub(point('hand_'+side)))*180/Math.PI;
   return {bend};
  });
  for(const sample of samples){
   assert.ok(sample.bend.r<40.1,`Right wrist at ${sample.time}: ${sample.bend.r}`);
   assert.ok(sample.bend.l<65.1,`Left wrist at ${sample.time}: ${sample.bend.l}`);
  }
 });
}
