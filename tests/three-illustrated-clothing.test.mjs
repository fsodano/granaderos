import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BoxGeometry,Group,Mesh,MeshStandardMaterial,ShaderLib,Texture} from '../web/node_modules/three/build/three.module.js';
const {ActorIllustration}=await import('../web/lib/three/actor-illustration.ts');
const {clothingPaint,paintClothingShader}=await import('../web/lib/three/illustrated-clothing.ts');
const material=()=>{const value=new MeshStandardMaterial();value.name='Apparel_Atlas';value.map=new Texture();value.map.name='Broad_Apparel_Pigment';return value;};
const mesh=(part,source=material())=>{const value=new Mesh(new BoxGeometry(),source);value.name=`Human_${part}_LOD2`;return value;};
const shader=()=>({vertexShader:ShaderLib.standard.vertexShader,fragmentShader:ShaderLib.standard.fragmentShader,uniforms:{}});

test('native cloth roles use the source palette while skin, horses and equipped/replacement garments stay out',()=>{
 for(const appearance of ['worker','surgeon','woman-scout','woman-shawl'])for(const part of ['outfit','legwear']){
  const object=mesh(part);assert.deepEqual(clothingPaint(object,object.material,appearance),{key:`${appearance}:${part}:lod2`,appearance,part,lod:2});
 }
 for(const appearance of [undefined,'granadero','royalist','gaucho','friar','replacement']){const object=mesh('outfit');assert.equal(clothingPaint(object,object.material,appearance),undefined);}
 for(const part of ['skin','footwear','headwear','horse','Garment_Poncho']){const object=mesh(part);assert.equal(clothingPaint(object,object.material,'worker'),undefined);}
 for(const edit of [m=>{m.map=null;},m=>{m.map.name='Replacement_Apparel';},m=>{m.name='Skin';},m=>{m.map.channel=1;}]){const object=mesh('outfit');edit(object.material);assert.equal(clothingPaint(object,object.material,'worker'),undefined);}
 const hem=mesh('legwear');hem.material.map.name='Apparel_Charcoal_Inset_Rust_Hem';hem.material.map.channel=1;
 assert.equal(clothingPaint(hem,hem.material,'woman-shawl'),undefined,'the existing skirt and rust hem are preserved');
});

test('the installed atlas coordinates and texture identities support every selected native LOD',()=>{
 const root=new URL('../web/public',import.meta.url),manifest=JSON.parse(readFileSync(new URL('./models/characters/manifest.json',root+'/')));let affected=0;
 for(const appearance of ['worker','surgeon','woman-scout','woman-shawl'])for(const lod of manifest.appearances[appearance].lods){
  const bytes=readFileSync(new URL('.'+lod.url,root+'/')),doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
  for(const part of ['outfit','legwear']){
   const node=doc.nodes.find(node=>node.name===`Human_${part}_LOD${lod.lod}`);
   for(const primitive of doc.meshes[node.mesh].primitives){
    const m=doc.materials[primitive.material],map=m.pbrMetallicRoughness.baseColorTexture,texture=doc.textures[map.index],image=doc.images[texture.source];
    const object=mesh(part);object.name=node.name;object.material.name=m.name;object.material.map.name=texture.name??image.name;object.material.map.channel=map.texCoord??0;
    const paint=clothingPaint(object,object.material,appearance);
    if(appearance==='woman-shawl'&&part==='legwear'){assert.equal(paint,undefined);continue;}
    assert.equal(paint?.key,`${appearance}:${part}:lod${lod.lod}`);
    const receipt=lod.apparelSurface.primitives.find(p=>p.part===part);assert.ok(receipt);
    assert.ok(receipt.roles.every(role=>role.role==='cloth'&&role.tile[1]===3&&[0,1].includes(role.tile[0])));
    affected++;
   }
  }
 }
 assert.equal(affected,21,'seven clothing surfaces across all three detail levels');
});

test('construction masks reach actual native cloth and trim at every detail level',()=>{
 const root=new URL('../web/public/',import.meta.url),manifest=JSON.parse(readFileSync(new URL('models/characters/manifest.json',root)));
 for(const appearance of ['worker','woman-scout','woman-shawl'])for(const lod of manifest.appearances[appearance].lods){
  const bytes=readFileSync(new URL('.'+lod.url,root)),jsonLength=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+jsonLength)),binary=28+jsonLength;
  const values=(index,size)=>{const a=doc.accessors[index],view=doc.bufferViews[a.bufferView],offset=binary+(view.byteOffset??0)+(a.byteOffset??0);assert.equal(a.componentType,5126);return Array.from({length:a.count},(_,n)=>Array.from({length:size},(_,i)=>bytes.readFloatLE(offset+n*(view.byteStride??size*4)+i*4)));};
  const node=doc.nodes.find(node=>node.name===`Human_outfit_LOD${lod.lod}`),primitive=doc.meshes[node.mesh].primitives[0];
  const positions=values(primitive.attributes.POSITION,3),uvs=values(primitive.attributes.TEXCOORD_0,2),vertices=positions.map((p,i)=>({p,tile:uvs[i].map(v=>Math.floor(v*4))}));
  const count=(tile,condition)=>vertices.filter(v=>v.tile.every((x,i)=>x===tile[i])&&condition(v.p)).length;
  const object=mesh('outfit');object.name=node.name;const value=shader();paintClothingShader(value,clothingPaint(object,object.material,appearance));
  if(appearance==='worker'){
   assert.ok(count([1,3],([x,y,z])=>y>1.30&&z>.07&&Math.abs(x)<(y-1.275)*.53)>10,'the V reaches the native vest');
   const collar=lod.lod===2?[3,3]:[0,2];assert.ok(count(collar,([,y])=>y>1.46)>100,'the collar tile follows its native LOD layout');
   assert.ok(value.fragmentShader.includes(`float collar = float(clothTile.x == ${collar[0]}.0 && clothTile.y == ${collar[1]}.0)`));
  }else if(appearance==='woman-scout'){
   const belt=lod.lod===2?[3,3]:[0,2],collar=lod.lod===2?[0,2]:[1,2];
   assert.ok(count(belt,([,y])=>y>=1.038&&y<1.074)>60,'the leather mask reaches the white belt at every LOD');
   assert.equal(count(belt,([,y])=>y>1.46),0,'the belt tile cannot admit the neck');
   assert.ok(count(collar,([,y])=>y>1.46)>100);
   assert.ok(value.fragmentShader.includes(`float belt = float(clothTile.x == ${belt[0]}.0 && clothTile.y == ${belt[1]}.0)`));
   assert.ok(value.fragmentShader.includes(`float collar = float(clothTile.x == ${collar[0]}.0 && clothTile.y == ${collar[1]}.0)`));
   assert.ok(count([0,3],([x,y,z])=>y>1.095&&y<1.47&&z>.07&&Math.abs(x)<.07)>0,'the blouse opening has native front coverage');
  }else{
   assert.ok(count([0,3],([x,y,z])=>y<1.35&&y>1.105+.76*Math.abs(x+.025)&&Math.abs(x)<.19&&z>.035)>8,'the wrap reaches below the shoulder yoke');
  }
 }
});

test('clothing shaders retain the native skinning, morphs, lighting and scoped palette tiles',()=>{
 for(const appearance of ['worker','surgeon','woman-scout','woman-shawl'])for(const part of ['outfit','legwear']){
  if(appearance==='woman-shawl'&&part==='legwear')continue;
  const object=mesh(part),paint=clothingPaint(object,object.material,appearance),value=shader();paintClothingShader(value,paint);
  for(const token of ['#include <morphtarget_vertex>','#include <skinning_vertex>','#include <project_vertex>'])assert.ok(value.vertexShader.includes(token));
  assert.ok(value.vertexShader.includes('vClothingRest = position;'));
  assert.ok(value.fragmentShader.includes('#include <map_fragment>'));
  assert.ok(value.fragmentShader.includes('clothTile.y == 3.0'));
  assert.ok(value.fragmentShader.includes('mix(1.0, clamp(clothForm'));
  assert.ok(!value.vertexShader.includes('transformed ='),'the pigment pass cannot change silhouette or contact geometry');
 }
});

test('shared source materials get distinct owned cloth copies without affecting other parts or actors',()=>{
 const source=material(),geometry=new BoxGeometry(),a=new Group(),b=new Group(),make=(root,part)=>{const object=mesh(part,source);object.geometry=geometry;root.add(object);return object;};
 const closeCoat=make(a,'outfit');closeCoat.name='Human_outfit_LOD0';
 const coat=make(a,'outfit'),trousers=make(a,'legwear'),skin=make(a,'skin'),other=make(b,'outfit'),horse=make(b,'horse');
 const ownedA=new Set(),ownedB=new Set(),first=new ActorIllustration(ownedA),second=new ActorIllustration(ownedB);
 first.apply(a,'human','worker');second.apply(b,'human','woman-scout');second.apply(horse);
 assert.notEqual(coat.material,closeCoat.material,'LOD-specific trim layouts cannot share shader programs');assert.notEqual(coat.material.customProgramCacheKey(),closeCoat.material.customProgramCacheKey());
 assert.notEqual(coat.material,trousers.material,'one source can serve shirt and trousers without palette mixing');assert.notEqual(coat.material,other.material);
 assert.ok(coat.material.customProgramCacheKey().endsWith('clothing-v1:worker:outfit:lod2'));
 assert.ok(other.material.customProgramCacheKey().endsWith('clothing-v1:woman-scout:outfit:lod2'));
 assert.ok(!skin.material.customProgramCacheKey().includes('clothing'));assert.ok(!horse.material.customProgramCacheKey().includes('clothing'));
 for(const object of [coat,trousers,skin,other,horse]){assert.equal(object.geometry,geometry);assert.equal(object.material.map,source.map);}
 const once=coat.material;first.apply(a,'human','worker');assert.equal(coat.material,once,'repeat admission does not stack tint or clone again');
 const value=shader();coat.material.onBeforeCompile(value,{});assert.ok(value.fragmentShader.includes('clothPigment'));assert.ok(value.fragmentShader.includes('actorPaintLight'),'the accepted illustrated lighting remains active');
 assert.ok(!source.userData.actorIllustration);assert.equal(source.map.name,'Broad_Apparel_Pigment');
 const events=new Map();for(const m of [...ownedA,...ownedB])m.addEventListener('dispose',()=>events.set(m,(events.get(m)??0)+1));
 for(const m of ownedA)m.dispose();for(const m of ownedB)m.dispose();assert.equal(events.size,ownedA.size+ownedB.size);assert.ok([...events.values()].every(n=>n===1));
 assert.ok(!ownedA.has(source)&&!ownedB.has(source));
});
