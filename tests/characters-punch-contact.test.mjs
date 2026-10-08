import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {BoxGeometry,Triangle,Vector3} from '../web/node_modules/three/build/three.module.js';
import {GLTFLoader} from '../web/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import {openSurfaceProbe as surface} from './open-surface-probe-fixture.mjs';
const {ActorRuntime}=await import('../web/lib/three/actor-runtime.ts');

const directory=process.env.GRANADEROS_CHARACTER_LIBRARY
 ?pathToFileURL(resolve(process.env.GRANADEROS_CHARACTER_LIBRARY)+sep)
 :new URL('../web/public/models/characters/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('manifest.json',directory)));
async function load(url){
 assert.ok(url.startsWith('/models/characters/'));
 const bytes=readFileSync(new URL(url.slice('/models/characters/'.length),directory)),size=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+size));
 // Keep exported skin weights, geometry and animation. Only image decoding
 // is omitted from this CPU geometry test.
 delete doc.images;delete doc.textures;delete doc.samplers;doc.materials=(doc.materials??[]).map(({name})=>({name}));
 const json=Buffer.from(JSON.stringify(doc)),padded=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]),binary=bytes.subarray(20+size),header=Buffer.from(bytes.subarray(0,20));
 header.writeUInt32LE(20+padded.length+binary.length,8);header.writeUInt32LE(padded.length,12);
 const buffer=Buffer.concat([header,padded,binary]);return new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.length),'');
}

test('open surface classification rejects distant points on the inward-normal side',()=>{
 const box=new BoxGeometry(2,2,2),p=box.attributes.position,triangles=[];
 for(let i=0;i<box.index.count;i+=3){
  const points=[0,1,2].map(j=>new Vector3().fromBufferAttribute(p,box.index.getX(i+j)));
  if(points.every(point=>point.y===-1))continue; // Open neck-like boundary.
  triangles.push(new Triangle(...points));
 }
 const head=surface(triangles);
 assert.ok(head.inside(new Vector3(0,0,0)),'Several rays still identify the interior above an open boundary');
 assert.equal(head.depth(new Vector3(0,-5,0)),0,'A remote point below an open patch is not penetration');
 assert.equal(head.depth(new Vector3(3,0,0)),0,'A remote side point is not penetration');
 box.dispose();
});

for(const preset of ['granadero','woman-scout'])test(`${preset} keeps actual punch hand skin clear of head and hat`,async context=>{
 const appearance=manifest.appearances[preset],bank=manifest.animationLibraries[appearance.animationLibrary];
 const [body,animation,equipment]=await Promise.all([load(appearance.lods[0].url),load(bank.url),load(manifest.equipment.url)]),clip=animation.animations.find(clip=>clip.name==='stand.punch.unarmed');
 assert.ok(clip);
 const visual={key:`unit:${preset}`,id:preset,kind:'unit',appearance:preset,skin:'light',side:'player',tacticalLevel:0,position:[0,0,0],yaw:0,posture:'standing',mounted:false,action:'strike',idleAction:'idle',equipment:'unarmed',items:[],garments:{headwear:null,outfit:null,legwear:null},selected:false,bodyHeights:{},cue:{id:`punch:${preset}`,action:'strike',startedAt:0,durationMs:clip.duration*1000}};
 const actor=new ActorRuntime({manifest,appearance,body,animation,equipment,clips:bank.clips,lod:0},visual);
 assert.equal(actor.action.getClip().name,'stand.punch.unarmed','The runtime selects the admitted unarmed punch');
 const patches=[],hats=[];
 actor.model.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  if(materials.some(material=>material.name==='Skin')){
   const index=mesh.geometry.attributes.skinIndex,weight=mesh.geometry.attributes.skinWeight;
   const dominant=Array.from({length:index.count},(_,vertex)=>{
    let slot=0;for(let component=1;component<4;component++)if(weight.getComponent(vertex,component)>weight.getComponent(vertex,slot))slot=component;
    return mesh.skeleton.bones[index.getComponent(vertex,slot)].name;
   });
   const head=[],hands={l:[],r:[]},indices=mesh.geometry.index;
   for(let i=0;i<indices.count;i+=3){const face=[0,1,2].map(j=>indices.getX(i+j));if(face.every(vertex=>['head','neck_01'].includes(dominant[vertex])))head.push(face);}
   for(let vertex=0;vertex<dominant.length;vertex++)for(const side of ['l','r'])if(dominant[vertex].endsWith(`_${side}`)&&/^(hand|thumb|index|middle|ring|pinky)_/.test(dominant[vertex]))hands[side].push(vertex);
   patches.push({mesh,head,hands});
  }
  if(mesh.name.startsWith('Human_headwear'))hats.push(mesh);
 });
 assert.ok(patches.reduce((sum,patch)=>sum+patch.head.length,0)>100,'Use the exported head skin');
 for(const side of ['l','r'])assert.ok(patches.reduce((sum,patch)=>sum+patch.hands[side].length,0)>100,'Use actual finger and palm vertices');
 if(preset==='granadero')assert.ok(hats.length,'The guard must also clear its shako');
 const worst={head:{depth:0},hat:{depth:0}},times=[...new Set(Array.from({length:31},(_,i)=>.2+i/60).concat([.183333,.34,.42,.5,.62]))].sort((a,b)=>a-b);
 for(const time of times){
  actor.tick(0,time*1000);actor.root.updateMatrixWorld(true);
  const head=[],hat=[],hands={l:[],r:[]};
  function vertices(mesh){mesh.skeleton.update();return Array.from({length:mesh.geometry.attributes.position.count},(_,i)=>mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld));}
  for(const patch of patches){const positions=vertices(patch.mesh);for(const face of patch.head)head.push(new Triangle(...face.map(i=>positions[i])));for(const side of ['l','r'])for(const i of patch.hands[side])hands[side].push(positions[i]);}
  for(const mesh of hats){const positions=vertices(mesh),indices=mesh.geometry.index;for(let i=0;i<indices.count;i+=3)hat.push(new Triangle(...[0,1,2].map(j=>positions[indices.getX(i+j)])));}
  const targets={head:surface(head)};if(hat.length)targets.hat=surface(hat);
  for(const [name,target]of Object.entries(targets))for(const side of ['l','r'])for(const point of hands[side]){
   const depth=target.depth(point);if(depth>worst[name].depth)worst[name]={depth,time,side,point:point.toArray()};
  }
 }
 context.diagnostic(JSON.stringify(worst));
 for(const [name,contact]of Object.entries(worst))assert.ok(contact.depth<=.0015,`${preset} ${contact.side} fist penetrates ${name} ${(contact.depth*1000).toFixed(2)} mm at ${contact.time} s`);
 actor.dispose();
});
