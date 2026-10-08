// The named transplant keeps every original accessor and sampler. Reconstruct
// its predecessor in memory; no second public bank or private asset is needed.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GLTFLoader} from '../../web/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
const libraries=new Map();
export function palmBefore(source){
 const url=source.manifest.animationLibraries[source.appearance.gender].url;
 if(libraries.has(url))return libraries.get(url);
 const raw=readFileSync(new URL('../../web/public'+url,import.meta.url)),size=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+size));let restored=0;
 for(const animation of doc.animations){
  if(!['life.climbUp','life.climbDown'].includes(animation.name))continue;
  for(const channel of animation.channels){const sampler=animation.samplers[channel.sampler],old=sampler.extras?.nativeRoofFingerBeforeSampler;if(old===undefined)continue;assert.ok(Number.isInteger(old)&&old>=0&&old<channel.sampler);const prior=animation.samplers[old];assert.equal(prior.input,sampler.input);assert.equal(prior.interpolation,sampler.interpolation);channel.sampler=old;restored++;}
 }
 assert.equal(restored,48,'Exactly the retained two-clip/four-finger predecessor is reconstructed');
 delete doc.images;delete doc.textures;delete doc.samplers;doc.materials=(doc.materials??[]).map(m=>({name:m.name}));const json=Buffer.from(JSON.stringify(doc)),padded=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]),binary=raw.subarray(20+size),header=Buffer.from(raw.subarray(0,20));header.writeUInt32LE(20+padded.length+binary.length,8);header.writeUInt32LE(padded.length,12);const bytes=Buffer.concat([header,padded,binary]),result=new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'');libraries.set(url,result);return result;
}
