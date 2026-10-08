import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=new URL('../assets/source/characters-3d/authoring/vendor/reviewed-faces/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('manifest.json',root),'utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function readSource(record){
 const bytes=readFileSync(new URL(record.path,root));
 assert.equal(sha(bytes),record.sha256,record.path);
 assert.equal(bytes.toString('ascii',0,4),'glTF');
 const length=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+length));
 return {json,bytes,binary:bytes.subarray(28+length)};
}
function access({json,binary},index){
 const a=json.accessors[index],v=json.bufferViews[a.bufferView];
 const [method,size]={5121:['readUInt8',1],5123:['readUInt16LE',2],5125:['readUInt32LE',4],5126:['readFloatLE',4]}[a.componentType];
 const width={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type];
 assert.equal(a.sparse,undefined,'Frozen face source attributes are explicit');
 return Array.from({length:a.count},(_,i)=>Array.from({length:width},(_,c)=>binary[method]((v.byteOffset??0)+(a.byteOffset??0)+i*(v.byteStride??width*size)+c*size)));
}

test('all eight reviewed face families retain three exact source LODs and native bindings',()=>{
 assert.equal(Object.keys(manifest.sources).length,24);
 const families=new Set(),rigs=new Map();
 for(const [key,record] of Object.entries(manifest.sources)){
  families.add(record.preset);assert.equal(key,`${record.preset}-lod${record.lod}`);
  assert.ok([0,1,2].includes(record.lod));assert.match(record.path,/^[a-z-]+-lod[012]\.glb$/);
  assert.match(record.donorBodySha256,/^[a-f0-9]{64}$/);
  const model=readSource(record),{json}=model;
  assert.equal(json.animations,undefined,'A face source cannot replace motion');
  assert.equal(json.meshes.length,1,'No costume, hat or equipment mesh is packaged');
  assert.equal(json.skins.length,1);
  const skin=json.skins[0],names=skin.joints.map(i=>json.nodes[i].name);
  assert.equal(new Set(names).size,53,'The accepted source keeps the native 53-bone rig');
  for(const name of ['head','neck_01','pelvis','hand_l','hand_r'])assert.ok(names.includes(name));
  const identity=JSON.stringify({names,bind:access(model,skin.inverseBindMatrices)});
  const gender=record.preset.startsWith('woman-')?'female':'male';
  if(rigs.has(gender))assert.equal(identity,rigs.get(gender),'All appearances of one anatomy use the same native bind');else rigs.set(gender,identity);
  for(const primitive of json.meshes[0].primitives){
   const material=json.materials[primitive.material];assert.equal(material.extras?.facialSurface,true);
   assert.ok(['Face_Skin','Face_Details_Atlas','Short_Hair_Cutout'].includes(material.name));
   if(material.name==='Face_Skin')assert.equal(material.extras.role,'skin');
   const position=access(model,primitive.attributes.POSITION),joints=access(model,primitive.attributes.JOINTS_0),weights=access(model,primitive.attributes.WEIGHTS_0),indices=access(model,primitive.indices).flat();
   assert.equal(indices.length%3,0);assert.ok(indices.every(i=>i>=0&&i<position.length));
   for(const i of new Set(indices)){
    assert.ok(position[i].every(Number.isFinite));
    const sum=weights[i].reduce((a,b)=>a+b,0);assert.ok(Math.abs(sum-1)<2e-6);
    for(let slot=0;slot<4;slot++)if(/^(hand_|thumb_|index_|middle_|ring_|pinky_|lowerarm_)/.test(names[joints[i][slot]]))assert.ok(weights[i][slot]<1e-6,'No hand or forearm component can enter a face-only source');
   }
  }
 }
 assert.equal(families.size,8);
});

test('face source textures are exact content-addressed bytes with no external paths',()=>{
 assert.ok(Object.keys(manifest.textures).length>0);
 for(const [name,expected] of Object.entries(manifest.textures)){
  assert.match(name,/^textures\/[a-f0-9]{20}\.png$/);
  const actual=sha(readFileSync(new URL(name,root)));assert.equal(actual,expected);assert.equal(name.slice(9,29),actual.slice(0,20));
 }
 for(const record of Object.values(manifest.sources))for(const image of readSource(record).json.images){
  assert.ok(manifest.textures[image.uri],`Unregistered texture ${image.uri}`);
 }
});

const python=process.platform==='win32'?'python':'python3';
const probe=spawnSync(python,['-c','import numpy'],{encoding:'utf8'});
for(const name of ['deterministic','preservation','wrong-rig','connected-boundary','repeated-application'])test(`reviewed face compositor ${name}`,{skip:probe.status!==0?'System Python NumPy is unavailable; source geometry/hash checks still run':false},()=>{
 const script=fileURLToPath(new URL('./reviewed-faces-fixture.py',import.meta.url));
 const result=spawnSync(python,[script,name],{encoding:'utf8',maxBuffer:4*1024*1024});
 assert.equal(result.status,0,result.stderr||result.stdout);
 assert.equal(JSON.parse(result.stdout).case,name);
});
