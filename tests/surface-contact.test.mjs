import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from '../web/node_modules/three/build/three.module.js';
import {capsuleSurfaceGap} from './skinned-surface-contact-fixture.mjs';

test('collapsed clothing triangles retain finite line and point contact distances',()=>{
 const start=new Vector3(-1,0,.3),end=new Vector3(1,0,.3),line=[new Vector3(-.5,0,0),new Vector3(0,0,0),new Vector3(.5,0,0)],point=[new Vector3(),new Vector3(),new Vector3()],face=[new Vector3(0,0,1),new Vector3(1,0,1),new Vector3(0,1,1)];
 for(const faces of [[line],[point],[line,point],[line,face,point],[face,line,point]])assert.ok(Math.abs(capsuleSurfaceGap(start,end,.1,faces)-.2)<1e-10,'Collapsed faces cannot poison the nearest real surface distance');
 assert.equal(capsuleSurfaceGap(new Vector3(0,0,-1),new Vector3(0,0,1),.1,[point]),-.1,'A point crossed by the rod remains a contact');
});
