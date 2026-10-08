#!/usr/bin/env python3
"""Fit static prone rifle work to its existing supported native idle legs.

No retarget, body lift, clock or weapon pose is substituted. Read the current
complete banks and replace only six named leg rotation outputs. Input times
and all other channels remain exact. The source idle and parents must be
static, compatible and already certified by the native boot support builder.
"""
from pathlib import Path
import argparse,copy,hashlib,json,struct,importlib.util
NAMES={'prone.aim.long-gun','prone.fire.long-gun','prone.reload.long-gun'}|{'prone.reload.long-gun.'+str(item)for item in(1800,1801,1802,1803,1804,1807)}
SOURCE='prone.idle.long-gun'
LEGS={role+'_'+side for side in('l','r')for role in('thigh','calf','foot')}
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);obj=importlib.util.module_from_spec(spec);spec.loader.exec_module(obj);return obj
def values(doc,binary,index):
 a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']];width={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']];assert a['componentType']==5126 and not a.get('normalized',False)
 offset=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',width*4);return[tuple(struct.unpack_from('<'+'f'*width,binary,offset+i*stride))for i in range(a['count'])]
def native_payload(doc,binary):
 def access(index):
  a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']];width={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']];size=width*{5120:1,5121:1,5122:2,5123:2,5125:4,5126:4}[a['componentType']];offset=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',size)
  raw=b''.join(binary[offset+i*stride:offset+i*stride+size]for i in range(a['count']));return({k:value for k,value in a.items()if k not in('bufferView','byteOffset')},hashlib.sha256(raw).hexdigest())
 result={k:copy.deepcopy(value)for k,value in doc.items()if k not in('buffers','bufferViews','accessors','animations')}
 for mesh in result.get('meshes',[]):
  for primitive in mesh['primitives']:
   primitive['attributes']={k:access(v)for k,v in primitive['attributes'].items()}
   if'indices'in primitive:primitive['indices']=access(primitive['indices'])
   if'targets'in primitive:primitive['targets']=[{k:access(v)for k,v in target.items()}for target in primitive['targets']]
 for skin in result.get('skins',[]):
  if'inverseBindMatrices'in skin:skin['inverseBindMatrices']=access(skin['inverseBindMatrices'])
 return result
def tracks(doc,binary):
 result={}
 for clip in doc['animations']:
  channels={}
  for c in clip['channels']:
   s=clip['samplers'][c['sampler']];channels[(doc['nodes'][c['target']['node']]['name'],c['target']['path'])]=(s.get('interpolation','LINEAR'),values(doc,binary,s['input']),values(doc,binary,s['output']))
  result[clip['name']]=channels
 return result
def static(payload,label,precision=1e-7):
 assert payload[0]in('LINEAR','STEP'),label+' has unsupported interpolation'
 assert max(max(axis)-min(axis)for axis in zip(*payload[2]))<precision,label+' is no longer a static native support pose'
 return payload[2][0]
def main():
 p=argparse.ArgumentParser();p.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[2]);p.add_argument('--receipt',type=Path);a=p.parse_args();root=a.root.resolve();assets=root/'web/public/models/characters';manifest_path=assets/'manifest.json';initial_manifest=manifest_path.read_bytes();manifest=json.loads(initial_manifest);merge=module('prone_merge',root/'tools/characters-3d/merge-animation-bank.py');pack=module('prone_pack',root/'assets/source/characters-3d/authoring/gltf_pack.py');receipt={};pending=[]
 for gender in('male','female'):
  bank=manifest['animationLibraries'][gender];path=assets/Path(bank['url']).name;initial_bank_hash=hashlib.sha256(path.read_bytes()).hexdigest();doc,binary=merge.read_glb(path);before_payload=native_payload(doc,binary);before=tracks(doc,binary);original_nodes=copy.deepcopy(doc['nodes']);native=before[SOURCE];source=next(c for c in bank['clips']if c['name']==SOURCE);assert source['nativeBootSupport']['surface']=='complete-native-boot'
  # The source idle has at most 3.13e-7 float quaternion bake noise;
  # fixed target poses and all parent channels keep the stricter 1e-7 guard.
  goals={name:static(native[(name,'rotation')],SOURCE+'/'+name,1e-6)for name in LEGS};parent_keys={(name,kind)for name in('Root','pelvis')for kind in('translation','rotation','scale')}
  for name in NAMES:
   assert name in before,name+' missing'
   for key in parent_keys:assert static(before[name][key],name+'/'+str(key))==static(native[key],SOURCE+'/'+str(key)),name+' parent pose differs from supported native idle'
   for bone in LEGS:static(before[name][(bone,'rotation')],name+'/'+bone)
  for clip in doc['animations']:
   if clip['name']not in NAMES:continue
   for channel in clip['channels']:
    bone=doc['nodes'][channel['target']['node']]['name'];kind=channel['target']['path']
    if bone not in LEGS or kind!='rotation':continue
    sampler=dict(clip['samplers'][channel['sampler']]);channel['sampler']=len(clip['samplers']);clip['samplers'].append(sampler);old=doc['accessors'][sampler['output']];raw=struct.pack('<4f',*goals[bone])*old['count'];binary+=b'\0'*((-len(binary))%4);offset=len(binary);binary+=raw;view=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(raw)});access=dict(old);access['bufferView']=view;access.pop('byteOffset',None);access.pop('min',None);access.pop('max',None);sampler['output']=len(doc['accessors']);doc['accessors'].append(access)
  # Drop replaced unreferenced samplers; repeat builds must not grow banks.
  for clip in doc['animations']:
   if clip['name']not in NAMES:continue
   used=list(dict.fromkeys(channel['sampler']for channel in clip['channels']));mapping={old:new for new,old in enumerate(used)};clip['samplers']=[clip['samplers'][index]for index in used]
   for channel in clip['channels']:channel['sampler']=mapping[channel['sampler']]
  doc['buffers'][0]['byteLength']=len(binary);candidate=path.with_name(gender+'-prone-support-candidate.glb');merge.write_glb(candidate,doc,binary);raw,_=pack.pack(candidate,{});new,new_binary=merge.read_glb(candidate);after=tracks(new,new_binary);assert before_payload==native_payload(new,new_binary),'Non-animation payload changed';assert doc['nodes']==original_nodes==new['nodes'];changed=[];retained=0
  for name,old in before.items():
   assert old.keys()==after[name].keys()
   for key,payload in old.items():
    if name in NAMES and key[0]in LEGS and key[1]=='rotation':
     assert payload[0:2]==after[name][key][0:2],str((name,key))+' input clock changed';changed.append([name,*key])
    else:assert payload==after[name][key],str((name,key))+' unrelated native channel changed';retained+=int(name in NAMES)
  assert len(changed)==len(NAMES)*6
  for clip in bank['clips']:
   if clip['name']in NAMES:clip['nativeBootSupport']={'method':'retained-supported-prone-leg-rotations','surface':'complete-native-boot','sourceClip':SOURCE,'floor':source['nativeBootSupport']['floor'],'retainedInputTimes':True,'retainedNativeBodyAndWeapon':True}
  bank['bytes']=len(raw);bank['sha256']=hashlib.sha256(raw).hexdigest();pending.append((path,raw,candidate,initial_bank_hash));receipt[gender]={'changedRotationChannels':changed,'untouchedClips':len(before)-len(NAMES),'selectedOtherChannelsExact':retained,'inputTimes':'exact','nativeBodyWeaponBallAndDimensions':'exact','sha256':bank['sha256']}
 assert manifest_path.read_bytes()==initial_manifest,'Concurrent manifest change; retry against the current copy'
 for path,raw,candidate,before_hash in pending:assert hashlib.sha256(path.read_bytes()).hexdigest()==before_hash,'Concurrent bank change; retry against the current copy'
 for path,raw,candidate,before_hash in pending:path.write_bytes(raw);candidate.unlink()
 manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
 if a.receipt:a.receipt.write_text(json.dumps(receipt,indent=2)+'\n')
 print('PRONE_RIFLE_NATIVE_SUPPORT_READY',json.dumps(receipt),flush=True)
if __name__=='__main__':main()
