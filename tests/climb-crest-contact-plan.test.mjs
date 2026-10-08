import test from 'node:test';
import assert from 'node:assert/strict';
import {ladderGeometry,sampleLadderClimb,referenceClimbFraction} from '../game/climb-geometry.js';
const tile=1.2360585147470482,distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
for(const span of [0,tile,Math.SQRT2*tile])test(`${span.toFixed(4)}m span: crest retains the final planted rung on each side`,()=>{
 for(const H of [2,3,4.2,5.6,6])for(const base of [0,.4,1.1,1.7]){
  const g=ladderGeometry([0,base,0],[span/Math.SQRT2,base+H,span/Math.SQRT2],tile),before=sampleLadderClimb(g,.76-1e-7),after=sampleLadderClimb(g,.76+1e-7);
  for(const side of ['l','r']){assert.ok(distance(before.feet[side].position,after.feet[side].position)<1e-6,'Physical foot contact cannot jump to the other side\'s rung');assert.ok(sampleLadderClimb(g,.76).feet[side].planted,'The exact crest starts with both feet on real rungs');}
  assert.ok(distance([before.root.height,before.root.forward],[after.root.height,after.root.forward])<1e-5,'Paid root travel stays continuous');
  const oldHigh=g.steps-1,highSide=g.steps%2===0?'l':'r';assert.ok(Math.abs(after.feet[highSide].position[1]-(H*oldHigh/g.steps+.026))<1e-7,'Actual last high rung is retained');
  const leftRoof=sampleLadderClimb(g,.82),rightRoof=sampleLadderClimb(g,.91);assert.ok(leftRoof.feet.l.roofWeight>.999&&leftRoof.feet.l.planted);assert.ok(rightRoof.feet.r.roofWeight>.999&&rightRoof.feet.r.planted,'Original roof-transfer clock');
  const start=sampleLadderClimb(g,0),end=sampleLadderClimb(g,1);assert.equal(start.root.height,0);assert.equal(end.root.height,g.height);assert.equal(end.root.forward,g.span);assert.ok(end.feet.l.planted&&end.feet.r.planted);
 }
});
test('native eleven-rung cardinal reference preserves source anchors and phase map',()=>{
 const g=ladderGeometry([0,0,0],[0,3,tile],tile);assert.equal(g.steps,11);
 for(const f of [0,.12,.5,.76,.82,.85,.91,.96,.98,1])assert.equal(referenceClimbFraction(g,f,g),f);
 const p=sampleLadderClimb(g,.76);assert.equal(p.feet.l.position[1],3*9/11+.026);assert.equal(p.feet.r.position[1],3*10/11+.026);
});
