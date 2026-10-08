#!/usr/bin/env python3
"""Support the free left forearm in three prone pistol poses.

Read complete current native banks. Retain the right grip, body, legs, owned
items, periods and markers. Only three named left rotation channels change.
Idle reuses the certified arm keys alongside its exact breathing parent keys;
aim/fire retain their existing static input clocks at the same native base.
"""
from pathlib import Path
import argparse,copy,hashlib,json,struct,importlib.util,subprocess
SOURCE='prone.idle.unarmed'
NAMES={'prone.'+gesture+'.short-gun' for gesture in ('idle','aim','fire')}
ARMS={'upperarm_l','lowerarm_l','hand_l'}
LEGACY={'male': {'prone.idle.short-gun': {'upperarm_l': '8303f097abbfa8657e8f893e5c24ebe8565fedd27ed36ffda784961f37f26cc1', 'lowerarm_l': 'b50c79a8933ef34fabb888987b49759bdb87fd7d899098e89c6cd6c04797134e', 'hand_l': '6e3a28f1788a3e410e0320a325a87029fa273c64fd63f2de02d31ecefd3618e7'}, 'prone.aim.short-gun': {'upperarm_l': '8303f097abbfa8657e8f893e5c24ebe8565fedd27ed36ffda784961f37f26cc1', 'lowerarm_l': 'b50c79a8933ef34fabb888987b49759bdb87fd7d899098e89c6cd6c04797134e', 'hand_l': '6e3a28f1788a3e410e0320a325a87029fa273c64fd63f2de02d31ecefd3618e7'}, 'prone.fire.short-gun': {'upperarm_l': '8303f097abbfa8657e8f893e5c24ebe8565fedd27ed36ffda784961f37f26cc1', 'lowerarm_l': 'b50c79a8933ef34fabb888987b49759bdb87fd7d899098e89c6cd6c04797134e', 'hand_l': '6e3a28f1788a3e410e0320a325a87029fa273c64fd63f2de02d31ecefd3618e7'}}, 'female': {'prone.idle.short-gun': {'upperarm_l': 'f0237c9c95d975d47f15a5012767d7467332e0e80d978c3c63e7b441b272dcbc', 'lowerarm_l': '85b7117c041984bdeae128aad20f8d4b03a0b3e1454e37cd2a6bbffdd566f9d1', 'hand_l': 'd2be23cbfc5b28c388e30f2eb069798a172cb2e5f3694077139d9f086de12762'}, 'prone.aim.short-gun': {'upperarm_l': 'f0237c9c95d975d47f15a5012767d7467332e0e80d978c3c63e7b441b272dcbc', 'lowerarm_l': '85b7117c041984bdeae128aad20f8d4b03a0b3e1454e37cd2a6bbffdd566f9d1', 'hand_l': 'd2be23cbfc5b28c388e30f2eb069798a172cb2e5f3694077139d9f086de12762'}, 'prone.fire.short-gun': {'upperarm_l': 'f0237c9c95d975d47f15a5012767d7467332e0e80d978c3c63e7b441b272dcbc', 'lowerarm_l': '85b7117c041984bdeae128aad20f8d4b03a0b3e1454e37cd2a6bbffdd566f9d1', 'hand_l': 'd2be23cbfc5b28c388e30f2eb069798a172cb2e5f3694077139d9f086de12762'}}}
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);obj=importlib.util.module_from_spec(spec);spec.loader.exec_module(obj);return obj
def raw_values(values):return b''.join(struct.pack('<'+'f'*len(row),*row)for row in values)
def first_static(track,label):
 assert max(max(axis)-min(axis)for axis in zip(*track[2]))<1e-7,label+' is not static'
 return track[2][0]
def main():
 p=argparse.ArgumentParser();p.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[2]);p.add_argument('--receipt',type=Path);a=p.parse_args();root=a.root.resolve();assets=root/'web/public/models/characters';mp=assets/'manifest.json';initial=mp.read_bytes();manifest=json.loads(initial);util=module('prone_support',root/'tools/characters-3d/build-prone-work-support.py');merge=module('prone_merge',root/'tools/characters-3d/merge-animation-bank.py');pack=module('prone_pack',root/'assets/source/characters-3d/authoring/gltf_pack.py');pending=[];receipt={}
 for gender in ('male','female'):
  bank=manifest['animationLibraries'][gender];path=assets/Path(bank['url']).name;oldraw=path.read_bytes();doc,binary=merge.read_glb(path);before=util.tracks(doc,binary);payload=util.native_payload(doc,binary);source=before[SOURCE];source_clip=next(c for c in doc['animations']if c['name']==SOURCE);source_channels={(doc['nodes'][c['target']['node']]['name'],c['target']['path']):source_clip['samplers'][c['sampler']]for c in source_clip['channels']};assert next(c for c in bank['clips']if c['name']==SOURCE)['nativeArmSupport']['surface']=='complete-native-palm-finger-and-sleeve'
  parents={(name,kind)for name in ('Root','pelvis','spine_01','spine_02','spine_03','clavicle_l')for kind in ('translation','rotation','scale')}
  for name in NAMES:
   target=before[name]
   for key in parents:
    if name=='prone.idle.short-gun':assert target[key]==source[key],name+' breathing parent curve differs: '+str(key)
    else:assert first_static(target[key],name+'/'+str(key))==source[key][2][0],name+' native parent differs: '+str(key)
   for key in target:
    if key[0].endswith('_l')and key[0].startswith(('thumb_','index_','middle_','ring_','pinky_')):assert target[key][2][0]==source[key][2][0],name+' native finger shape differs'
   for bone in ARMS:
    track=target[bone,'rotation'];goal=source[bone,'rotation'];already=track==goal if name=='prone.idle.short-gun'else all(v==goal[2][0]for v in track[2]);legacy=hashlib.sha256(struct.pack('<4f',*track[2][0])).hexdigest()==LEGACY[gender][name][bone]
    assert already or legacy and first_static(track,name+'/'+bone)==track[2][0],name+'/'+bone+' has an unaudited prior pose'
  for clip in doc['animations']:
   if clip['name']not in NAMES:continue
   for c in clip['channels']:
    bone=doc['nodes'][c['target']['node']]['name'];kind=c['target']['path']
    if bone not in ARMS or kind!='rotation':continue
    old=clip['samplers'][c['sampler']];sampler=copy.deepcopy(source_channels[bone,'rotation'])if clip['name']=='prone.idle.short-gun'else copy.deepcopy(old)
    if clip['name']!='prone.idle.short-gun':
     access=doc['accessors'][old['output']];raw=struct.pack('<4f',*source[bone,'rotation'][2][0])*access['count'];binary+=b'\0'*((-len(binary))%4);offset=len(binary);binary+=raw;view=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(raw)});new=copy.deepcopy(access);new['bufferView']=view;new.pop('byteOffset',None);new.pop('min',None);new.pop('max',None);sampler['output']=len(doc['accessors']);doc['accessors'].append(new)
    c['sampler']=len(clip['samplers']);clip['samplers'].append(sampler)
   used=list(dict.fromkeys(c['sampler']for c in clip['channels']));mapping={old:new for new,old in enumerate(used)};clip['samplers']=[clip['samplers'][index]for index in used]
   for c in clip['channels']:c['sampler']=mapping[c['sampler']]
  doc['buffers'][0]['byteLength']=len(binary);candidate=path.with_name(gender+'-pistol-forearm-candidate.glb');merge.write_glb(candidate,doc,binary);raw,_=pack.pack(candidate,{});new,nb=merge.read_glb(candidate);after=util.tracks(new,nb);assert util.native_payload(new,nb)==payload;changed=[];other=0
  for name,tracks in before.items():
   assert tracks.keys()==after[name].keys();assert max(v[1][-1][0]for v in tracks.values())==max(v[1][-1][0]for v in after[name].values()),name+' actual period changed'
   for key,value in tracks.items():
    if name in NAMES and key[0]in ARMS and key[1]=='rotation':
     if name!='prone.idle.short-gun':assert value[:2]==after[name][key][:2],name+' static rotation inputs changed'
     else:assert after[name][key]==source[key],name+' retained supported breathing-arm keys differ'
     changed.append([name,*key])
    else:
     retained=after[name][key];assert value==retained,str((name,key))+' retained channel differs';assert raw_values(value[1])==raw_values(retained[1])and raw_values(value[2])==raw_values(retained[2]),str((name,key))+' retained float bytes differ';other+=int(name in NAMES)
  for clip in bank['clips']:
   if clip['name']in NAMES:clip['nativeProneForearmSupport']={'method':'retained-supported-free-forearm-rotations','surface':'complete-native-palm-finger-and-sleeve','sourceClip':SOURCE,'hand':'left','floor':.002,'retainedBodyLegsRightGripAndClock':True,'rotationKeys':'native-supported-breathing-curve'if clip['name']=='prone.idle.short-gun'else'retained-static-input-times'}
  bank['bytes']=len(raw);bank['sha256']=hashlib.sha256(raw).hexdigest();pending.append((path,raw,candidate,hashlib.sha256(oldraw).hexdigest()));receipt[gender]={'changedRotationChannels':changed,'changedIdleRotationInputs':3,'supportedIdleRotationInterpolation':'LINEAR','selectedOtherChannelsExact':other,'untouchedClips':len(before)-len(NAMES),'rightGripBodyLegsRigAndDimensions':'exact','actualPeriodsAndMetadataClocks':'exact','sha256':bank['sha256']}
 text=subprocess.check_output(['node','-e',"let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',v=>s+=v);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(JSON.parse(s),null,2)+'\\n'));"],input=json.dumps(manifest),text=True)
 assert mp.read_bytes()==initial,'Concurrent manifest change'
 for path,raw,candidate,before in pending:assert hashlib.sha256(path.read_bytes()).hexdigest()==before,'Concurrent bank change'
 for path,raw,candidate,before in pending:path.write_bytes(raw);candidate.unlink()
 mp.write_text(text)
 if a.receipt:a.receipt.write_text(json.dumps(receipt,indent=2)+'\n')
 print('PRONE_PISTOL_FOREARM_READY',json.dumps(receipt),flush=True)
if __name__=='__main__':main()
