#!/usr/bin/env python3
"""Validate published mesh, rig, texture and clip contracts with no Blender."""
from pathlib import Path
import json,struct,math,hashlib
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'web/public/models/characters';m=json.loads((OUT/'manifest.json').read_text());assert m['complete'],'Library incomplete'

def glb(url):
 path=OUT/Path(url).name;raw=path.read_bytes();magic,version,length=struct.unpack_from('<III',raw);assert(magic,version,length)==(0x46546c67,2,len(raw));n=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+n]);data=raw[28+n:]
 for image in doc.get('images',[]):
  if'uri'in image:assert(path.parent/image['uri']).is_file(),image
 return doc,data

def read(doc,data,index):
 a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']];sizes={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16};types={5120:'b',5121:'B',5122:'h',5123:'H',5125:'I',5126:'f'};fmt='<'+types[a['componentType']]*sizes[a['type']];size=struct.calcsize(fmt);stride=v.get('byteStride',size);offset=v.get('byteOffset',0)+a.get('byteOffset',0)
 return[struct.unpack_from(fmt,data,offset+i*stride)for i in range(a['count'])]
count=0;triangles=0;seen=set();rigs={}
for appearance in m['appearances'].values():
 assert len(appearance['lods'])==3
 for lod in appearance['lods']:
  doc,data=glb(lod['url']);path=OUT/Path(lod['url']).name;assert hashlib.sha256(path.read_bytes()).hexdigest()==lod['sha256'];nodes=doc['nodes'];names={n.get('name')for n in nodes};assert set(m['bones'].values())<=names
  assert len(doc['skins'])==1 and len(doc['skins'][0]['joints'])==53
  for role,socket in appearance['sockets'].items():assert socket['node']in names,(appearance['id'],role)
  signature={nodes[j]['name']:{k:nodes[j].get(k)for k in ('matrix','translation','rotation','scale')}for j in doc['skins'][0]['joints']}
  if appearance['gender']in rigs:assert signature==rigs[appearance['gender']],appearance['id']+' incompatible native rig'
  rigs[appearance['gender']]=signature
  for mesh in doc['meshes']:
   for p in mesh['primitives']:
    positions=read(doc,data,p['attributes']['POSITION']);assert all(math.isfinite(x)for v in positions for x in v)
    indices=read(doc,data,p['indices']);assert all(0<=i[0]<len(positions)for i in indices)
    if'WEIGHTS_0'in p['attributes']:
     weights=read(doc,data,p['attributes']['WEIGHTS_0']);assert all(abs(sum(w)-1)<2e-4 for w in weights),mesh['name']
    if'JOINTS_0'in p['attributes']:assert all(0<=j<53 for v in read(doc,data,p['attributes']['JOINTS_0'])for j in v)
  count+=1;triangles+=lod['triangles']
for gender,bank in m['animationLibraries'].items():
 doc,data=glb(bank['url']);expected={c['name']:c for c in bank['clips']};assert len(expected)==205;assert {a['name']for a in doc['animations']}==set(expected)
 for animation in doc['animations']:
  c=expected[animation['name']]
  for sample in animation['samplers']:
   times=[x[0]for x in read(doc,data,sample['input'])];assert all(a<b for a,b in zip(times,times[1:]));assert abs(times[-1]-c['duration'])<.05
   assert all(math.isfinite(x)for v in read(doc,data,sample['output'])for x in v)
  if'seatAnchor'in c:assert c['seatAnchorSpace']=='gltf-model-local'and .7<c['seatAnchor'][1]<1.1
 for c in bank['clips']:
  for t in c.get('markers',{}).values():assert 0<=t<=c['duration']+.001
  if c['gesture']in('mount','dismount'):assert'seatWeight'in c and'seatAnchor'in c
 names={n.get('name')for n in doc['nodes']};assert set(m['bones'].values())<=names
for gender,garments in m['garments'].items():
 doc,_=glb(garments['url']);names={n.get('name')for n in doc['nodes']}
 for item in garments['items'].values():assert item['node']in names
 assert len(doc['skins'][0]['joints'])==53
doc,_=glb(m['equipment']['url']);names={n.get('name')for n in doc['nodes']}
for key,item in m['equipment']['items'].items():
 assert item['node']in names,key
 if'muzzle'in item:assert item['muzzle']in names,key
assert all(str(key)in m['equipment']['items']for key in range(1800,1814))
for lod in m['horse']['lods']:
 doc,_=glb(lod['url']);assert len(doc['skins'][0]['joints'])==19;assert m['horse']['saddle']['node']in{n.get('name')for n in doc['nodes']};assert {c['name']for c in m['horse']['clips']}=={a['name']for a in doc['animations']}
print(json.dumps({'appearanceLODs':count,'anatomies':list(rigs),'clipsPerAnatomy':205,'equipmentItems':len(m['equipment']['items']),'horseLODs':len(m['horse']['lods']),'result':'PASS'},indent=2))
