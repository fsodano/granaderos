import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {characterChoices,prepareProductionCharacter} from '../src/character-library.js';
const publicRoot=new URL('../../../web/public/',import.meta.url);
const library=JSON.parse(readFileSync(new URL('models/characters/manifest.json',publicRoot),'utf8'));
const loader=new GLTFLoader();loader.register(()=>({name:'CpuTexturePlaceholder',loadTexture(){return Promise.resolve(new THREE.Texture());}}));
const assets=new Map();
function load(url){if(!assets.has(url)){const bytes=readFileSync(new URL(`.${url}`,publicRoot));assets.set(url,loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),''));}return assets.get(url);}
async function prepare(id){const appearance=library.appearances[id],bank=library.animationLibraries[appearance.animationLibrary];return prepareProductionCharacter(await load(appearance.lods.find(lod=>lod.lod===0).url),await load(bank.url),await load(library.equipment.url),library,appearance);}

test('selector exposes the approved reference and all eight actual game appearances',()=>{
 assert.equal(characterChoices[0][0],'reference');
 assert.deepEqual(new Set(characterChoices.slice(1).map(([id])=>id)),new Set(Object.keys(library.appearances)));
});
test('all production characters retain their native rigs and reviewed lab controls',async()=>{
 for(const id of Object.keys(library.appearances)){
  const prepared=await prepare(id),again=await prepare(id),bones=[];
  prepared.scene.traverse(node=>{if(node.isBone)bones.push(node);});assert.equal(bones.length,53,`${id}: native skeleton`);
  assert.equal(prepared.animations.length,29,`${id}: all single-contact reviewed movements`);
  assert.ok(!prepared.animations.some(clip=>clip.name==='SabreCombination'),'Two-hit preview combination is not substituted with a single hit');
  for(const name of ['Punch','Walk','Run','RifleWalk','RifleRun','PistolWalk','PistolRun','SabreWalk','SabreRun','KnifeWalk','KnifeRun','SabreThrust','KnifeThrust','BayonetThrust'])assert.ok(prepared.animations.some(clip=>clip.name===name),`${id}: ${name}`);
  const native=bones.map(bone=>bone.position.length()),mixer=new THREE.AnimationMixer(prepared.scene),punch=prepared.animations.find(clip=>clip.name==='Punch');
  mixer.clipAction(punch).play();mixer.setTime(.42);prepared.scene.updateMatrixWorld(true);
  bones.forEach((bone,index)=>{if(bone.name!=='Root')assert.ok(Math.abs(bone.position.length()-native[index])<.0001,`${id}: unchanged bone length`);});
  assert.notEqual(prepared.scene.getObjectByName('hand_r'),again.scene.getObjectByName('hand_r'),'Selections have independent live bones');
  assert.ok(prepared.scene.getObjectByName('spine_03').quaternion.angleTo(again.scene.getObjectByName('spine_03').quaternion)>.05,'Animating one character does not animate a cached selection');
  for(const [weapon,grip] of [['rifle','rifle'],['pistol','pistol'],['sabre','sabre'],['knife','sabre']]){
   assert.equal(prepared.weapons[weapon].parent.name,library.appearances[id].sockets[`handRight_${grip}`].node,`${id}: ${weapon} native attachment`);
   assert.deepEqual(prepared.weapons[weapon].position.toArray(),[0,0,0]);
  }
  for(const weapon of ['rifle','pistol'])assert.ok(prepared.muzzles[weapon].isObject3D,`${id}: ${weapon} muzzle`);
  assert.equal(prepared.bayonet.parent,prepared.weapons.rifle);assert.equal(prepared.bayonet.visible,false);
  assert.deepEqual(prepared.bayonet.position.toArray(),library.equipment.fittings.india_socket.position);
  assert.ok(prepared.manifest.locomotionSpeed.Walk>0&&prepared.manifest.locomotionSpeed.Run>0);
  assert.equal(prepared.manifest.clips.find(clip=>clip.name==='Punch').events.contact,.42);
  mixer.stopAllAction();mixer.uncacheRoot(prepared.scene);
 }
});
