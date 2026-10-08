import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {asset,visual} from './climb-native-fixture.mjs';
const {ActorRuntime}=await import('../../web/lib/three/actor-runtime.ts');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const beforeText=readFileSync(new URL('../../docs/art/reviews/climb-crest-phase/before-climb-contact-fit.ts.txt',import.meta.url),'utf8');
const oldGeometry=readFileSync(new URL('../../docs/art/reviews/climb-crest-phase/before-climb-geometry.js.txt',import.meta.url),'utf8');
assert.equal(sha(beforeText),'231daa09c37bc391ccaeb0ebd4734218e6a2214d30782043078f2c335da95d6f');
assert.equal(sha(oldGeometry),'b7ad2737df630896eb19583a5aca386c72047491930ba32c7b4460f62b4ffc8a');
const scratch=mkdtempSync(join(tmpdir(),'granaderos-crest-test-before-'));
let BeforeFit;
try {
 writeFileSync(join(scratch,'geometry.mjs'),oldGeometry);
 writeFileSync(join(scratch,'before.ts'),beforeText.replace("'../../../game/climb-geometry.js'",JSON.stringify(pathToFileURL(join(scratch,'geometry.mjs')).href)).replace("'three'",JSON.stringify(new URL('../../web/node_modules/three/build/three.module.js',import.meta.url).href)).replace("'./climb-body-phase'",JSON.stringify(new URL('../../web/lib/three/climb-body-phase.ts',import.meta.url).href)));
 ({NativeClimbContactFit:BeforeFit}=await import(pathToFileURL(join(scratch,'before.ts')).href));
} finally {rmSync(scratch,{recursive:true,force:true});}
function predecessorActor(source,id,action,extra={}) {
 const actor=new ActorRuntime(source,visual(id,action,{cue:undefined,...extra})),calibration=actor.climbFit;
 actor.climbFit=new BeforeFit(actor.model,actor.root);
 // The current constructor's calibration is the exact same native rig and
 // bind pose. Reuse it to exclude clone-order floating point drift.
 for(const [key,limb] of actor.climbFit.limbs){const native=calibration.limbs.get(key);limb.first=native.first;limb.second=native.second;limb.contact.copy(native.contact);}
 return actor;
}
export {predecessorActor};
