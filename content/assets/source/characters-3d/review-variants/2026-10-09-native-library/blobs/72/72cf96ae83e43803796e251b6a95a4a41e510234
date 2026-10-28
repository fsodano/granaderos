import test from 'node:test';
import assert from 'node:assert/strict';
import {SphereGeometry,Triangle,Vector3} from '../web/node_modules/three/build/three.module.js';
import {openSurfaceProbe} from './open-surface-probe-fixture.mjs';

// The analytic sphere supplies the independent inside/outside oracle. Its
// open lower cap models a head/neck patch, not a watertight collision solid.
test('open head probe distinguishes interior from external points within its bounds',()=>{
 const geometry=new SphereGeometry(1,48,32),positions=geometry.attributes.position,faces=[];
 for(let i=0;i<geometry.index.count;i+=3){
  const face=[0,1,2].map(j=>new Vector3().fromBufferAttribute(positions,geometry.index.getX(i+j)));
  if(face.every(point=>point.y<-.6))continue;
  const triangle=new Triangle(...face);if(triangle.getArea()>1e-10)faces.push(triangle);
 }
 const probe=openSurfaceProbe(faces);
 for(let i=0;i<64;i++){
  const angle=2*Math.PI*i/64,y=-.20+.80*((i*17%64)/63),radius=Math.sqrt(1-y*y);
  const direction=new Vector3(Math.cos(angle)*radius,y,Math.sin(angle)*radius);
  const internal=direction.clone().multiplyScalar(.65),external=direction.clone().multiplyScalar(1.12);
  assert.equal(probe.inside(internal),true,'The open boundary must not hide genuine penetration');
  assert.ok(probe.depth(internal)>.30,'Depth uses the actual triangle surface');
  assert.equal(probe.inside(external),false,'An external point remains outside even within the head bounds');
  assert.equal(probe.depth(external),0);
 }
 geometry.dispose();
});
