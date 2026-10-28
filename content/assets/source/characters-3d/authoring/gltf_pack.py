"""Share PBR image files and compact constant skeletal tracks losslessly."""
import json,struct,hashlib
from pathlib import Path

def pack(path,material_colors):
 path=Path(path);raw=path.read_bytes();length=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+length]);binary=bytearray(raw[28+length:]);views=doc.get('bufferViews',[]);accessors=doc.get('accessors',[])
 for m in doc.get('materials',[]):
  if m.get('name')in material_colors:m.setdefault('pbrMetallicRoughness',{})['baseColorFactor']=material_colors[m['name']]
 image_views=set();textures=path.parent/'textures';textures.mkdir(exist_ok=True)
 for im in doc.get('images',[]):
  if 'bufferView'not in im:continue
  idx=im.pop('bufferView');v=views[idx];b=bytes(binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]);ext='.jpg'if im.get('mimeType')=='image/jpeg'else'.png';name=hashlib.sha256(b).hexdigest()[:20]+ext;(textures/name).write_bytes(b);im['uri']='textures/'+name;image_views.add(idx)
 # Most translation and scale tracks remain constant throughout an action.
 # Retain the actual constant value at both endpoints: it can differ from rest,
 # and is necessary for correct crossfades and held equipment poses.
 for animation in doc.get('animations',[]):
  for sampler in animation['samplers']:
   a=accessors[sampler['output']];inp=accessors[sampler['input']]
   if a.get('componentType')!=5126 or inp.get('componentType')!=5126 or a['count']<3 or a['type']not in ('VEC3','VEC4'):continue
   size=3 if a['type']=='VEC3' else 4;v=views[a['bufferView']];start=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',size*4);samples=[bytes(binary[start+i*stride:start+i*stride+size*4])for i in range(a['count'])]
   if not all(s==samples[0]for s in samples):continue
   iv=views[inp['bufferView']];istart=iv.get('byteOffset',0)+inp.get('byteOffset',0);istride=iv.get('byteStride',4);times=bytes(binary[istart:istart+4]+binary[istart+(inp['count']-1)*istride:istart+(inp['count']-1)*istride+4])
   for key,data,source in [('input',times,inp),('output',samples[0]*2,a)]:
    offset=len(binary);binary.extend(data);newview={'buffer':0,'byteOffset':offset,'byteLength':len(data)};views.append(newview);copy=dict(source);copy.update(bufferView=len(views)-1,byteOffset=0,count=2);accessors.append(copy);sampler[key]=len(accessors)-1
 # Remove now-unreferenced accessors and binary views after constant compaction.
 used=set()
 for mesh in doc.get('meshes',[]):
  for p in mesh['primitives']:
   used.update(p.get('attributes',{}).values())
   if 'indices'in p:used.add(p['indices'])
   for target in p.get('targets',[]):used.update(target.values())
 for skin in doc.get('skins',[]):
  if'inverseBindMatrices'in skin:used.add(skin['inverseBindMatrices'])
 for animation in doc.get('animations',[]):
  for s in animation['samplers']:used.update((s['input'],s['output']))
 amap={old:new for new,old in enumerate(sorted(used))}
 for mesh in doc.get('meshes',[]):
  for p in mesh['primitives']:
   p['attributes']={k:amap[i]for k,i in p['attributes'].items()}
   if'indices'in p:p['indices']=amap[p['indices']]
   for target in p.get('targets',[]):
    for k,i in target.items():target[k]=amap[i]
 for skin in doc.get('skins',[]):
  if'inverseBindMatrices'in skin:skin['inverseBindMatrices']=amap[skin['inverseBindMatrices']]
 for animation in doc.get('animations',[]):
  for s in animation['samplers']:s['input']=amap[s['input']];s['output']=amap[s['output']]
 doc['accessors']=[accessors[i]for i in sorted(used)]
 needed=set(a['bufferView']for a in doc['accessors']if'bufferView'in a)
 # Sparse cloth shapes use separate index/value views. Keep and remap those
 # too; otherwise compaction can silently point a shape at unrelated bytes.
 for accessor in doc['accessors']:
  for source in accessor.get('sparse',{}).values():
   if isinstance(source,dict)and'bufferView'in source:needed.add(source['bufferView'])
 needed=sorted(needed);vmap={old:new for new,old in enumerate(needed)};newbinary=bytearray();newviews=[]
 for idx in needed:
  old=views[idx];new=dict(old);new['byteOffset']=len(newbinary);newbinary.extend(binary[old.get('byteOffset',0):old.get('byteOffset',0)+old['byteLength']]);newbinary.extend(b'\0'*(-len(newbinary)%4));newviews.append(new)
 for a in doc['accessors']:
  if'bufferView'in a:a['bufferView']=vmap[a['bufferView']]
  for source in a.get('sparse',{}).values():
   if isinstance(source,dict)and'bufferView'in source:source['bufferView']=vmap[source['bufferView']]
 doc['bufferViews']=newviews;doc['buffers']=[{'byteLength':len(newbinary)}]
 encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*(-len(encoded)%4);raw=struct.pack('<III',0x46546c67,2,28+len(encoded)+len(newbinary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(newbinary),0x004e4942)+newbinary;path.write_bytes(raw)
 return raw,doc
