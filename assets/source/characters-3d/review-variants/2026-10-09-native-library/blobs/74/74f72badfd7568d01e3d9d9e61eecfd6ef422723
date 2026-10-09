#!/usr/bin/env python3
"""Fit remaining static prone firearm work to its owned native idle legs.

No retarget, body lift, clock or weapon pose is substituted. Read the current
complete banks and replace only six named leg rotation outputs. Input times
and all other channels remain exact. The source idle and parents must be
static, compatible and already certified by the native boot support builder.
"""
from pathlib import Path
import argparse,copy,hashlib,json,struct,importlib.util,subprocess
NAMES={'prone.'+action+'.long-gun'for action in('reprime','repair','unload')}|{'prone.unload.long-gun.'+str(item)for item in(1800,1801,1802,1803,1804,1807)}|{'prone.'+action+'.short-gun'for action in('aim','fire','reload','reprime','repair','unload')}|{'prone.reload.short-gun.'+str(item)for item in(1805,1806,1808)}|{'prone.reload.short-gun.1808.barrel1'}
LEGACY_ROTATION_HASHES={'male': {'calf_l': 'ff7419711d27f7645192206336b08e5ab42ce304f34fa597bbe76bdce166de71', 'calf_r': '37dfbfa6613fbb8acea8e15063b7697941ea652b8e79100558d715484fca7ef0', 'foot_l': 'e0fd53467029b378402adfb25e0b29bf281c5557162631bf4d6b3f06d80252ae', 'foot_r': 'bcc19a18472d36c93fd9fc2c909e2730650bc1b063583093f41947c1754cc1c1', 'thigh_l': '4e408634c0176a2e6022169f6130b48795a69eedbe1adbaefc6e1177fc5d0181', 'thigh_r': '2bc30601984854ee416f3e427dda6e7d6af1b17f288c57c868ac045da4614525'}, 'female': {'calf_l': '476398b799009a7e6188772cd777f3a3c905d2f13703b1d3c59bef5c669b4e8b', 'calf_r': 'e5daa031b81ea613428382f50aa856f47153a8b5f2ed081045039080762bc0aa', 'foot_l': 'df9eba8badb33f05d8b5b16943db4a64b41566ea9dca1e68eab4f255561b6b84', 'foot_r': 'bc163b73f24765cf8d247fc87189e8d2d45d6c36577ba38de0418a835bc82159', 'thigh_l': '3d92d8e0bd01174e96de0acf09aac1b96e382985353603661d5534ce817a6933', 'thigh_r': '87aa73a57f3e3769824bc1e465870ab6f97f4bf3ba9449552b3d0a46e83d9dfe'}}
# Audited narrow-knee static source from 84edb8b2; native parents stay exact.
NATURAL_ROTATION_HASHES={'male': {'thigh_l': ['f9e646ed5489b8132d8c20affbd9734a07dee7abd5742c84c40e68172b866cd3'], 'calf_l': ['da29ca3a2441315355fe9d9fe30fd2d1f24c1227d807b7345eae3c51eeb65f3e'], 'foot_l': ['5a1d1dd08f2afea517645bb94f890031957d1db03e8e6887674964c391f20693'], 'thigh_r': ['2ba034a69a119018676f52b0d6f97d1abc5b65bfc0c98a28e079a6fd5f09eb2a'], 'calf_r': ['e0c5114d4cfee49514b734c665ea874e959b0cabafe9f00f4c17360fb316fc25'], 'foot_r': ['3d7f1379989deff9f3db59e33d974814193c5f9fda1ddfee4552bbb05edbba93']}, 'female': {'thigh_l': ['4b6e718e5ddb5d8909b20d11b9e98df6a99abeeae4c302464e41eda369b6a895'], 'calf_l': ['6a262f3a6d6f7f2c5a8ce40149b36403cf64bff7c946ae440848612f772a20d9'], 'foot_l': ['0ba4a0cc1fe593e1cd0c09a4aa6df686be4657a2d8318b10c7adfa6ab7dcebc6'], 'thigh_r': ['50b6675e32d63ec0e1b6acaedd3dc0636c39caf8c14ba186a1be57bc59798527'], 'calf_r': ['1c6dbb9ed8b6daa93062ac69eaeb8edf27aac21f77ed6397de73db0e3660fa89'], 'foot_r': ['7a5c2a95c4f30fcc73ea3ad1844a6fa2e69c4c6378d6bdbcd7480b27e4a496c9']}}
def source_for(name):return 'prone.idle.'+('short-gun'if'.short-gun'in name else'long-gun')
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
 p=argparse.ArgumentParser();p.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[2]);p.add_argument('--receipt',type=Path);p.add_argument('--directory',type=Path,help='Existing complete library; use a private copy for review.');a=p.parse_args();root=a.root.resolve();assets=(a.directory or root/'web/public/models/characters').resolve();manifest_path=assets/'manifest.json';initial_manifest=manifest_path.read_bytes();manifest=json.loads(initial_manifest);merge=module('prone_merge',root/'tools/characters-3d/merge-animation-bank.py');pack=module('prone_pack',root/'assets/source/characters-3d/authoring/gltf_pack.py');receipt={};pending=[]
 for gender in('male','female'):
  bank=manifest['animationLibraries'][gender];path=assets/Path(bank['url']).name;initial_bank_hash=hashlib.sha256(path.read_bytes()).hexdigest();doc,binary=merge.read_glb(path);before_payload=native_payload(doc,binary);before=tracks(doc,binary);original_nodes=copy.deepcopy(doc['nodes']);sources={source_for(name)for name in NAMES};native_by_source={name:before[name]for name in sources};source_meta={name:next(c for c in bank['clips']if c['name']==name)for name in sources};assert all(meta['nativeBootSupport']['surface']=='complete-native-boot'for meta in source_meta.values())
  # The source idle has at most 3.13e-7 float quaternion bake noise;
  # fixed target poses and all parent channels keep the stricter 1e-7 guard.
  goals={source:{name:static(native[(name,'rotation')],source+'/'+name,1e-6)for name in LEGS}for source,native in native_by_source.items()};parent_keys={(name,kind)for name in('Root','pelvis')for kind in('translation','rotation','scale')}
  for name in NAMES:
   assert name in before,name+' missing';SOURCE=source_for(name);native=native_by_source[SOURCE]
   for key in parent_keys:assert static(before[name][key],name+'/'+str(key))==static(native[key],SOURCE+'/'+str(key)),name+' parent pose differs from supported native idle'
   for bone in LEGS:
    current=static(before[name][(bone,'rotation')],name+'/'+bone)
    assert current==goals[SOURCE][bone]or hashlib.sha256(struct.pack('<4f',*current)).hexdigest()in [LEGACY_ROTATION_HASHES[gender][bone],*NATURAL_ROTATION_HASHES[gender][bone]],name+'/'+bone+' has an unaudited lower support pose'
  for clip in doc['animations']:
   if clip['name']not in NAMES:continue
   for channel in clip['channels']:
    bone=doc['nodes'][channel['target']['node']]['name'];kind=channel['target']['path']
    if bone not in LEGS or kind!='rotation':continue
    sampler=dict(clip['samplers'][channel['sampler']]);channel['sampler']=len(clip['samplers']);clip['samplers'].append(sampler);old=doc['accessors'][sampler['output']];raw=struct.pack('<4f',*goals[source_for(clip['name'])][bone])*old['count'];binary+=b'\0'*((-len(binary))%4);offset=len(binary);binary+=raw;view=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(raw)});access=dict(old);access['bufferView']=view;access.pop('byteOffset',None);access.pop('min',None);access.pop('max',None);sampler['output']=len(doc['accessors']);doc['accessors'].append(access)
  # Drop replaced unreferenced samplers; repeat builds must not grow banks.
  for clip in doc['animations']:
   if clip['name']not in NAMES:continue
   used=list(dict.fromkeys(channel['sampler']for channel in clip['channels']));mapping={old:new for new,old in enumerate(used)};clip['samplers']=[clip['samplers'][index]for index in used]
   for channel in clip['channels']:channel['sampler']=mapping[channel['sampler']]
  doc['buffers'][0]['byteLength']=len(binary);candidate=path.with_name(gender+'-prone-work-support-candidate.glb');merge.write_glb(candidate,doc,binary);raw,_=pack.pack(candidate,{});new,new_binary=merge.read_glb(candidate);after=tracks(new,new_binary);assert before_payload==native_payload(new,new_binary),'Non-animation payload changed';assert doc['nodes']==original_nodes==new['nodes'];changed=[];retained=0
  for name,old in before.items():
   assert old.keys()==after[name].keys()
   for key,payload in old.items():
    if name in NAMES and key[0]in LEGS and key[1]=='rotation':
     assert payload[0:2]==after[name][key][0:2],str((name,key))+' input clock changed';changed.append([name,*key])
    else:assert payload==after[name][key],str((name,key))+' unrelated native channel changed';retained+=int(name in NAMES)
  assert len(changed)==len(NAMES)*6
  for clip in bank['clips']:
   if clip['name']in NAMES:
    SOURCE=source_for(clip['name']);source=source_meta[SOURCE];clip['nativeBootSupport']={'method':'retained-supported-prone-leg-rotations','surface':'complete-native-boot','sourceClip':SOURCE,'floor':source['nativeBootSupport']['floor'],'retainedInputTimes':True,'retainedNativeBodyAndWeapon':True}
  bank['bytes']=len(raw);bank['sha256']=hashlib.sha256(raw).hexdigest();pending.append((path,raw,candidate,initial_bank_hash));receipt[gender]={'changedRotationChannels':changed,'untouchedClips':len(before)-len(NAMES),'selectedOtherChannelsExact':retained,'inputTimes':'exact','nativeBodyWeaponBallAndDimensions':'exact','sha256':bank['sha256']}
 # Use the same numeric JSON format as the native profile compiler.
 # This preserves current gait metadata with small scientific values.
 manifest_text=subprocess.check_output(['node','-e',"let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',v=>s+=v);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(JSON.parse(s),null,2)+'\\n'));"],input=json.dumps(manifest),text=True)
 assert manifest_path.read_bytes()==initial_manifest,'Concurrent manifest change; retry against the current copy'
 for path,raw,candidate,before_hash in pending:assert hashlib.sha256(path.read_bytes()).hexdigest()==before_hash,'Concurrent bank change; retry against the current copy'
 for path,raw,candidate,before_hash in pending:path.write_bytes(raw);candidate.unlink()
 manifest_path.write_text(manifest_text)
 if a.receipt:a.receipt.write_text(json.dumps(receipt,indent=2)+'\n')
 print('PRONE_WORK_NATIVE_SUPPORT_READY',json.dumps(receipt),flush=True)
if __name__=='__main__':main()
