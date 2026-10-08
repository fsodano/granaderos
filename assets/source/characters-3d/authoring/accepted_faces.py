"""Compose complete reviewed face/hair islands onto an unchanged native body.

The original binary payload, material definitions, rig and all non-head mesh
attributes remain intact. Only skin primitive index lists lose complete head
components. Reviewed head arrays/materials are appended, never repacked.
"""
from pathlib import Path
import copy,hashlib,json,struct,os,tempfile
import numpy as np

WIDTH={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
DTYPE={5121:'u1',5123:'<u2',5125:'<u4',5126:'<f4'}

def digest(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def load(path):
 raw=Path(path).read_bytes();size=struct.unpack_from('<I',raw,12)[0]
 if raw[:4]!=b'glTF':raise ValueError('Expected GLB')
 document=json.loads(raw[20:20+size]);binary=raw[28+size:]
 def accessor(index):
  a=document['accessors'][index];width=WIDTH[a['type']];dtype=DTYPE[a['componentType']];item=np.dtype(dtype).itemsize
  result=np.zeros((a['count'],width),dtype=dtype)
  if 'bufferView'in a:
   view=document['bufferViews'][a['bufferView']];offset=view.get('byteOffset',0)+a.get('byteOffset',0)
   result=np.ndarray((a['count'],width),dtype=dtype,buffer=binary,offset=offset,strides=(view.get('byteStride',width*item),item)).copy()
  if 'sparse'in a:
   sparse=a['sparse'];iv=document['bufferViews'][sparse['indices']['bufferView']];vv=document['bufferViews'][sparse['values']['bufferView']]
   indices=np.frombuffer(binary,dtype=DTYPE[sparse['indices']['componentType']],count=sparse['count'],offset=iv.get('byteOffset',0)+sparse['indices'].get('byteOffset',0))
   values=np.frombuffer(binary,dtype=dtype,count=sparse['count']*width,offset=vv.get('byteOffset',0)+sparse['values'].get('byteOffset',0)).reshape(-1,width);result[indices]=values
  return result
 return document,accessor,binary

def native_signature(document,accessor):
 if len(document.get('skins',[]))!=1:raise ValueError('Expected one native skin')
 nodes=document['nodes'];skin=document['skins'][0];parents={child:parent for parent,node in enumerate(nodes)for child in node.get('children',[])};result={}
 for number,index in enumerate(skin['joints']):
  chain=[];current=index
  while current is not None:
   chain.append({key:nodes[current].get(key)for key in ('name','translation','rotation','scale','matrix')});current=parents.get(current)
  name=nodes[index]['name']
  if name in result:raise ValueError('Duplicate native bone')
  result[name]={'chain':chain,'inverseBind':accessor(skin['inverseBindMatrices'])[number].tolist()}
 if not {'head','neck_01','hand_l','hand_r','pelvis'}<=result.keys():raise ValueError('Unknown native rig')
 return result

def skin_mesh_index(document):
 matches=[i for i,m in enumerate(document['meshes'])if m['name']=='Exposed_Human_Skin']
 if len(matches)!=1:raise ValueError('Expected one exposed native skin mesh')
 return matches[0]

def head_selection(document,accessor,primitive,preset):
 pos=accessor(primitive['attributes']['POSITION']);indices=accessor(primitive['indices']).ravel();parent=list(range(len(pos)))
 def root(i):
  while parent[i]!=i:parent[i]=parent[parent[i]];i=parent[i]
  return i
 def union(a,b):
  a=root(a);b=root(b)
  if a!=b:parent[b]=a
 same={}
 for i,p in enumerate(pos):
  key=p.tobytes()
  if key in same:union(i,same[key])
  else:same[key]=i
 for tri in indices.reshape(-1,3):union(int(tri[0]),int(tri[1]));union(int(tri[0]),int(tri[2]))
 components={}
 for i in set(map(int,indices)):components.setdefault(root(i),[]).append(i)
 names=[document['nodes'][i]['name']for i in document['skins'][0]['joints']];head_ids={i for i,n in enumerate(names)if n=='head'or n.startswith('neck_')}
 joints=accessor(primitive['attributes']['JOINTS_0']);weights=accessor(primitive['attributes']['WEIGHTS_0']);selected=set();facts=[]
 hand_ids={i for i,n in enumerate(names)if n.startswith(('hand_','lowerarm_','thumb_','index_','middle_','ring_','pinky_'))}
 for ids in components.values():
  vertex_head=[sum(float(w)for joint,w in zip(joints[i],weights[i])if int(joint)in head_ids)for i in ids]
  vertex_hand=[sum(float(w)for joint,w in zip(joints[i],weights[i])if int(joint)in hand_ids)for i in ids]
  if max(vertex_head,default=0)>.5 and max(vertex_hand,default=0)>.5:
   raise ValueError('Native head and hand surfaces must be disconnected; refusing a mixed component')
  amount=float(sum(float(w)for i in ids for joint,w in zip(joints[i],weights[i])if int(joint)in head_ids))/len(ids)
  low=pos[ids].min(axis=0);high=pos[ids].max(axis=0);reason='head-neck-majority' if amount>.5 else None
  # Accepted scout braid tie follows its hanging plait onto the back. This
  # source-identified hair component is intentionally weighted to spine_03.
  tie=(preset=='woman-scout'and len(ids)==40 and np.max(np.abs(low[:2]-[-.007,1.38]))<1e-6 and np.max(np.abs(high[:2]-[.007,1.386]))<1e-6 and -.09<float(low[2])<-.075 and -.085<float(high[2])<-.07)
  if tie:reason='source-Braid_Tie-40-vertices'
  if reason:
   selected.update(ids);facts.append({'reason':reason,'vertices':len(ids),'minimum':low.tolist(),'maximum':high.tolist(),'headNeckWeight':amount})
 mask=np.array([int(i)in selected for i in indices],dtype=bool).reshape(-1,3)
 if np.any(np.any(mask,axis=1)!=np.all(mask,axis=1)):raise ValueError('Face extraction would cut a connected surface')
 return selected,np.all(mask,axis=1),facts

class Writer:
 def __init__(self,document,binary=b''):
  self.doc=copy.deepcopy(document);self.binary=bytearray(binary)
 def array(self,values,template=None,target=34962):
  a=copy.deepcopy(template or {'componentType':5125,'type':'SCALAR'});values=np.ascontiguousarray(values,dtype=DTYPE[a['componentType']]);width=WIDTH[a['type']];values=values.reshape(-1,width)
  while len(self.binary)%4:self.binary.append(0)
  offset=len(self.binary);data=values.tobytes();self.binary.extend(data);views=self.doc.setdefault('bufferViews',[]);view={'buffer':0,'byteOffset':offset,'byteLength':len(data)}
  if target:view['target']=target
  views.append(view)
  for key in ('sparse','byteOffset','bufferView','count','min','max'):a.pop(key,None)
  a.update(bufferView=len(views)-1,count=len(values))
  if a['type']=='SCALAR'or(template and 'min'in template):a['min']=values.min(axis=0).tolist();a['max']=values.max(axis=0).tolist()
  self.doc.setdefault('accessors',[]).append(a);return len(self.doc['accessors'])-1
 def write(self,path):
  self.doc['buffers']=[{'byteLength':len(self.binary)}];j=json.dumps(self.doc,separators=(',',':'),ensure_ascii=False).encode();j+=b' '*((-len(j))%4);b=bytes(self.binary);b+=b'\0'*((-len(b))%4)
  Path(path).write_bytes(struct.pack('<4sII',b'glTF',2,12+8+len(j)+8+len(b))+struct.pack('<I4s',len(j),b'JSON')+j+struct.pack('<I4s',len(b),b'BIN\0')+b)

def import_material(writer,source,material_index,source_directory,output_directory,cache):
 if material_index in cache:return cache[material_index]
 material=copy.deepcopy(source['materials'][material_index]);oldname=material['name'];material['name']='Face_Skin'if oldname in ('Skin','Face_Skin')else'Face_Details_Atlas'if oldname in ('Apparel_Atlas','Face_Details_Atlas')else oldname
 material.setdefault('extras',{})['facialSurface']=True
 if material['name']=='Face_Skin':material['extras']['role']='skin'
 def texture(index):
  t=copy.deepcopy(source['textures'][index]);image=copy.deepcopy(source['images'][t['source']])
  if 'uri'not in image or image['uri'].startswith('data:'):raise ValueError('Expected external reviewed face texture')
  source_path=Path(source_directory)/image['uri'];dest=Path(output_directory)/image['uri'];dest.parent.mkdir(parents=True,exist_ok=True)
  if dest.exists()and digest(source_path)!=digest(dest):raise ValueError('Existing texture name has different pixels: '+image['uri'])
  if not dest.exists():dest.write_bytes(source_path.read_bytes())
  images=writer.doc.setdefault('images',[])
  if image in images:t['source']=images.index(image)
  else:t['source']=len(images);images.append(image)
  if 'sampler'in t:
   sampler=copy.deepcopy(source['samplers'][t['sampler']]);samplers=writer.doc.setdefault('samplers',[])
   if sampler in samplers:t['sampler']=samplers.index(sampler)
   else:t['sampler']=len(samplers);samplers.append(sampler)
  textures=writer.doc.setdefault('textures',[])
  if t in textures:return textures.index(t)
  textures.append(t);return len(textures)-1
 def visit(obj):
  if not isinstance(obj,dict):return
  for key,value in obj.items():
   if key.endswith('Texture')and isinstance(value,dict)and'index'in value:value['index']=texture(value['index'])
   elif isinstance(value,dict):visit(value)
 visit(material)
 materials=writer.doc.setdefault('materials',[])
 if material in materials:result=materials.index(material)
 else:materials.append(material);result=len(materials)-1
 for extension in source.get('extensionsUsed',[]):
  if extension not in writer.doc.setdefault('extensionsUsed',[]):writer.doc['extensionsUsed'].append(extension)
 cache[material_index]=result;return result

def append_head_primitives(writer,source,read,preset,source_directory,output_directory,source_joint_names,target_joint_names):
 primitives=[];facts=[];cache={};joint_map=np.array([target_joint_names.index(n)for n in source_joint_names]);mesh=source['meshes'][skin_mesh_index(source)]
 for primitive in mesh['primitives']:
  selected,mask,components=head_selection(source,read,primitive,preset)
  if not selected:continue
  if primitive.get('targets'):raise ValueError('Reviewed head morph targets need an explicit compositor contract')
  ids=sorted(selected);lookup={old:new for new,old in enumerate(ids)};p=copy.deepcopy(primitive);p['attributes']={}
  for name,index in primitive['attributes'].items():
   values=read(index)[ids]
   if name=='JOINTS_0':values=joint_map[values]
   p['attributes'][name]=writer.array(values,source['accessors'][index])
  indices=read(primitive['indices']).reshape(-1,3)[mask];local=np.array([lookup[int(i)]for i in indices.ravel()],dtype='<u4');p['indices']=writer.array(local,target=34963)
  p['material']=import_material(writer,source,primitive['material'],source_directory,output_directory,cache);primitives.append(p);facts.append({'material':writer.doc['materials'][p['material']]['name'],'vertices':len(ids),'triangles':len(indices),'components':components})
 if not any(f['material']=='Face_Skin'for f in facts):raise ValueError('No reviewed native face skin selected')
 return primitives,facts

def extract_head_source(donor_path,output_path,preset):
 donor_path=Path(donor_path);output_path=Path(output_path);output_path.parent.mkdir(parents=True,exist_ok=True);source,read,_=load(donor_path);signature=native_signature(source,read)
 # A source asset contains one head mesh plus its exact native bind rig.
 mesh_index=skin_mesh_index(source);skin_node=next(i for i,n in enumerate(source['nodes'])if n.get('mesh')==mesh_index);parents={c:i for i,n in enumerate(source['nodes'])for c in n.get('children',[])};keep=set(source['skins'][0]['joints'])|{skin_node}
 for i in list(keep):
  while i in parents:i=parents[i];keep.add(i)
 order=sorted(keep);remap={old:new for new,old in enumerate(order)};nodes=[]
 for i in order:
  n=copy.deepcopy(source['nodes'][i]);n.pop('mesh',None);n.pop('skin',None)
  if'children'in n:n['children']=[remap[c]for c in n['children']if c in keep]
  if i==skin_node:n['mesh']=0;n['skin']=0
  nodes.append(n)
 doc={'asset':{'version':'2.0','generator':'Granaderos accepted face component extraction'},'scene':0,'scenes':[{'nodes':[remap[i]for i in order if i not in parents]}],'nodes':nodes,'meshes':[{'name':'Exposed_Human_Skin','primitives':[]}],'skins':[copy.deepcopy(source['skins'][0])],'accessors':[],'bufferViews':[],'materials':[],'images':[],'textures':[],'samplers':[]}
 skin=doc['skins'][0];skin['joints']=[remap[i]for i in skin['joints']]
 if'skeleton'in skin:skin['skeleton']=remap[skin['skeleton']]
 writer=Writer(doc);skin=writer.doc['skins'][0];skin['inverseBindMatrices']=writer.array(read(source['skins'][0]['inverseBindMatrices']),source['accessors'][source['skins'][0]['inverseBindMatrices']],target=None)
 names=[source['nodes'][i]['name']for i in source['skins'][0]['joints']];primitives,facts=append_head_primitives(writer,source,read,preset,donor_path.parent,output_path.parent,names,names);writer.doc['meshes'][0]['primitives']=primitives;writer.write(output_path)
 check,ca,_=load(output_path)
 if native_signature(check,ca)!=signature:raise ValueError('Extracted face source changed native bind')
 return {'preset':preset,'donorSha256':digest(donor_path),'headSourceSha256':digest(output_path),'components':facts}

def compose_accepted_face(main_path,source_head_path,output_path=None,preset=None):
 main_path=Path(main_path);source_head_path=Path(source_head_path);output_path=Path(output_path or main_path);preset=preset or main_path.stem.split('-lod')[0]
 main,read,binary=load(main_path);source,sread,_=load(source_head_path)
 if any(m.get('extras',{}).get('facialSurface') for m in main['materials']):raise ValueError('Body already contains accepted face surfaces')
 if native_signature(main,read)!=native_signature(source,sread):raise ValueError('Unknown/incompatible native face rig or bind transform')
 before=digest(main_path);writer=Writer(main,binary);mi=skin_mesh_index(main);retained=[];removed=[]
 for primitive in main['meshes'][mi]['primitives']:
  selected,mask,components=head_selection(main,read,primitive,preset);indices=read(primitive['indices']).reshape(-1,3);remaining=indices[~mask]
  if len(remaining):
   p=copy.deepcopy(primitive)
   if selected:p['indices']=writer.array(remaining.ravel(),target=34963)
   retained.append(p)
  removed.append({'material':main['materials'][primitive['material']]['name'],'removedHeadTriangles':int(mask.sum()),'retainedNonHeadTriangles':len(remaining),'components':components})
 source_names=[source['nodes'][i]['name']for i in source['skins'][0]['joints']];target_names=[main['nodes'][i]['name']for i in main['skins'][0]['joints']]
 appended,facts=append_head_primitives(writer,source,sread,preset,source_head_path.parent,output_path.parent,source_names,target_names);writer.doc['meshes'][mi]['primitives']=retained+appended
 output_path.parent.mkdir(parents=True,exist_ok=True)
 fd,temporary=tempfile.mkstemp(prefix=output_path.name+'.face-',suffix='.tmp',dir=output_path.parent);os.close(fd)
 try:
  writer.write(temporary);result,rr,rb=load(temporary)
  assert rb[:len(binary)]==binary,'Existing binary payload must remain exact'
  assert result['nodes']==main['nodes']and result['skins']==main['skins'],'Native scene must remain exact'
  assert result['materials'][:len(main['materials'])]==main['materials'],'Main materials must remain exact'
  for i,mesh in enumerate(main['meshes']):
   if i!=mi:assert result['meshes'][i]==mesh,'Non-skin clothing/headwear mesh descriptor changed'
  os.replace(temporary,output_path)
 finally:
  if Path(temporary).exists():Path(temporary).unlink()
 return {'preset':preset,'baseSha256':before,'headSourceSha256':digest(source_head_path),'afterSha256':digest(output_path),'originalBinaryPrefixExact':True,'nativeNodesSkinsBindsExact':True,'mainMaterialsExact':True,'allNonSkinMeshesExact':True,'retained':removed,'appended':facts}
