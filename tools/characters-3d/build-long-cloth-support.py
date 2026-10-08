#!/usr/bin/env python3
"""Fit existing long-cloth prone shapes to the current published native pose.

Only prone POSITION/NORMAL targets of friar/woman-shawl LODs may change.
Read all inputs first, prove preservation, and reject concurrent mutations.
"""
from pathlib import Path
import argparse,copy,hashlib,importlib.util,json,struct,subprocess,tempfile

def digest(raw):return hashlib.sha256(raw).hexdigest()
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value

def decoded(doc,binary,index):
 a=doc['accessors'][index];width={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']];fmt={5120:'b',5121:'B',5122:'h',5123:'H',5125:'I',5126:'f'}[a['componentType']];size=struct.calcsize('<'+fmt)*width;rows=[(0,)*width for _ in range(a['count'])]
 if 'bufferView'in a:
  v=doc['bufferViews'][a['bufferView']];start=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',size)
  rows=[struct.unpack_from('<'+fmt*width,binary,start+i*stride)for i in range(a['count'])]
 sparse=a.get('sparse')
 if sparse:
  ix=sparse['indices'];val=sparse['values'];iv=doc['bufferViews'][ix['bufferView']];vv=doc['bufferViews'][val['bufferView']];ifmt={5121:'B',5123:'H',5125:'I'}[ix['componentType']];isize=struct.calcsize('<'+ifmt)
  for i in range(sparse['count']):
   k=struct.unpack_from('<'+ifmt,binary,iv.get('byteOffset',0)+ix.get('byteOffset',0)+i*isize)[0];rows[k]=struct.unpack_from('<'+fmt*width,binary,vv.get('byteOffset',0)+val.get('byteOffset',0)+i*size)
 return ({k:v for k,v in a.items()if k in('componentType','count','type','normalized')},rows)

def proof(doc,binary,mesh_index):
 value={k:copy.deepcopy(v)for k,v in doc.items()if k not in('buffers','bufferViews','accessors')}
 for index,mesh in enumerate(value.get('meshes',[])):
  targets=mesh.get('extras',{}).get('targetNames',[])
  for p in mesh['primitives']:
   p['attributes']={k:decoded(doc,binary,v)for k,v in p['attributes'].items()}
   if 'indices'in p:p['indices']=decoded(doc,binary,p['indices'])
   for i,t in enumerate(p.get('targets',[])):
    for k,v in list(t.items()):t[k]='reviewed-prone-target'if index==mesh_index and targets[i]=='cloth_prone'and k in('POSITION','NORMAL')else decoded(doc,binary,v)
 for skin in value.get('skins',[]):
  if 'inverseBindMatrices'in skin:skin['inverseBindMatrices']=decoded(doc,binary,skin['inverseBindMatrices'])
 for animation in value.get('animations',[]):
  for sampler in animation['samplers']:
   for k in('input','output'):sampler[k]=decoded(doc,binary,sampler[k])
 return value

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[2]);p.add_argument('--receipt',type=Path);args=p.parse_args();root=args.root.resolve();assets=root/'web/public/models/characters';mp=assets/'manifest.json';manifest_before=mp.read_bytes();manifest=json.loads(manifest_before);merge=module('cloth_merge',root/'tools/characters-3d/merge-animation-bank.py');pack=module('cloth_pack',root/'assets/source/characters-3d/authoring/gltf_pack.py')
 bank_hashes={assets/Path(bank['url']).name:bank['sha256']for bank in manifest['animationLibraries'].values()}
 assert all(digest(path.read_bytes())==sha for path,sha in bank_hashes.items()),'Native bank differs from its manifest'
 with tempfile.TemporaryDirectory(prefix='granaderos-long-cloth-')as folder:
  proposal=Path(folder)/'proposal.json';subprocess.run(['node',str(root/'tools/characters-3d/fit-long-cloth-support.mjs'),str(proposal)],cwd=root,check=True);rows=json.loads(proposal.read_text());assert len(rows)==6;pending=[];receipts=[]
  for row in rows:
   record=manifest['appearances'][row['id']]['lods'][row['lod']];path=assets/Path(row['url']).name;original=path.read_bytes();assert digest(original)==record['sha256']==row['sha256'],str(path)+' source hash differs'
   if row.get('unchanged'):receipts.append({'id':row['id'],'lod':row['lod'],'unchanged':True,'sha256':digest(original)});continue
   assert row['low']>=0 and row['high']<.33 and row['largest']<.15,'Native prone cloth exceeds reviewed bounds'
   doc,binary=merge.read_glb(path);mesh_index=next(n['mesh']for n in doc['nodes']if n.get('name')==row['mesh']);baseline=proof(doc,binary,mesh_index);mesh=doc['meshes'][mesh_index];names=mesh['extras']['targetNames'];assert names==['cloth_crouched','cloth_prone'];assert len(mesh['primitives'])==1;target=mesh['primitives'][0]['targets'][names.index('cloth_prone')]
   assert set(target)=={'POSITION','NORMAL'}
   for semantic,key,allowed in [('POSITION','position',set(row['changed'])),('NORMAL','normal',set(row['normalVertices']))]:
    old=decoded(doc,binary,target[semantic]);flat=row[key];assert len(flat)==old[0]['count']*3;new=[tuple(flat[i:i+3])for i in range(0,len(flat),3)]
    assert all(new[i]==v for i,v in enumerate(old[1])if i not in allowed),'Unreviewed cloth vertex changed';assert all(abs(v)<2.1 for values in new for v in values)
    selected=[i for i,values in enumerate(new)if any(v!=0 for v in values)];assert selected,'Empty authored cloth target'
    component=5123 if len(new)<=65536 else 5125;index_format='H'if component==5123 else'I';index_bytes=struct.pack('<'+index_format*len(selected),*selected);value_bytes=struct.pack('<'+'f'*len(selected)*3,*(v for i in selected for v in new[i]));views=[]
    for raw in(index_bytes,value_bytes):
     binary+=b'\0'*(-len(binary)%4);offset=len(binary);binary+=raw;views.append(len(doc['bufferViews']));doc['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(raw)})
    target[semantic]=len(doc['accessors']);doc['accessors'].append({'componentType':5126,'count':len(new),'type':'VEC3','min':[min(v[j]for v in new)for j in range(3)],'max':[max(v[j]for v in new)for j in range(3)],'sparse':{'count':len(selected),'indices':{'bufferView':views[0],'componentType':component},'values':{'bufferView':views[1]}}})
   doc['buffers'][0]['byteLength']=len(binary);candidate=path.with_name(path.stem+'-cloth-candidate.glb');merge.write_glb(candidate,doc,binary);raw,_=pack.pack(candidate,{});after,after_binary=merge.read_glb(candidate);assert proof(after,after_binary,mesh_index)==baseline,'Rest mesh, other morph, rig, textures or animation changed'
   record['bytes']=len(raw);record['sha256']=digest(raw);record['nativeClothSupport']={'method':'current-native-prone-cloth-shape','sourceClip':'prone.idle.long-gun','sourcePoseHash':row['sourcePoseHash'],'retainedRestMeshAndRig':True};pending.append((path,candidate,raw,digest(original)));receipts.append({k:row[k]for k in('id','lod','changed','normalVertices','sourcePoseHash','low','high','largest')});receipts[-1]['sha256']=record['sha256']
  assert all(digest(path.read_bytes())==sha for path,sha in bank_hashes.items()),'Concurrent native bank change'
  assert mp.read_bytes()==manifest_before,'Concurrent manifest change';assert all(digest(path.read_bytes())==original for path,candidate,raw,original in pending),'Concurrent body source change'
  text=subprocess.check_output(['node','-e',"let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',v=>s+=v);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(JSON.parse(s),null,2)+'\\n'));"],input=json.dumps(manifest),text=True)
  for path,candidate,raw,original in pending:path.write_bytes(raw);candidate.unlink()
  if pending:mp.write_text(text)
  if args.receipt:args.receipt.write_text(json.dumps(receipts,indent=2)+'\n')
  print('LONG_CLOTH_NATIVE_SUPPORT_READY',len(pending),'body assets; all other decoded source exact')
if __name__=='__main__':main()
