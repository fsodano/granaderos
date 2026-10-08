#!/usr/bin/env python3
"""Retain owned crouched side-step bodies and fit their native boot support.

Five equipment categories have the same native Root/pelvis, leg basis, period
and pace as the supported unarmed clip. Replace only their eight named leg
rotation channels with that current native support path. Dense leg keys retain
contact interpolation; every other input clock/output and manifest pace stays
exact. Reject changed parents, periods, speeds or unaudited leg source values.
"""
from pathlib import Path
import argparse,copy,hashlib,json,struct,importlib.util,subprocess
GEAR=('long-gun','short-gun','blade','knife','lance')
LEGS={role+'_'+side for side in('l','r')for role in('thigh','calf','foot','ball')}
LEG_BASIS = {'male': {'Left': {'thigh_l': '6e951abf0d563b6de52a638b97bf47be990d5a90b763b0ac3f84114bf5f0a96b', 'calf_l': 'e459db5c107847952577a27865467172c43e6d627a682cbea85c062de1ac1bf2', 'foot_l': 'e13774c3be50e88a1af922facc7d73129f230979e69471f0221b1e61a3de1a10', 'ball_l': 'b9e6f7f8cb176e18a3484be46026c4c1d7b068813916000d479b71dd18f9ce5f', 'thigh_r': '5c98a69fa5b242ff2145cc3d1c0fc577a269e50d5813ccb5bb628b7cbfcb59ca', 'calf_r': '219908be05287cd7e73fbf56a386d8b42a6c30a4756bedb2630ef622c1295dab', 'foot_r': 'b95c2f5a3c31d954bff07788277922a21f39119d3c1d7353ebedce4620cd0204', 'ball_r': 'f9e90e1e6deef58868745b73ad88cd66a183164d4ccb0755fba165df06104599'}, 'Right': {'thigh_l': '95421aa6c1ca3540d01a85921865bfc9ecf878648425290db12555dfde3c88ca', 'calf_l': '89a135d5a8de5ac512c374df09fabe9dd19b8927c991cfc40c0d679bafea072a', 'foot_l': '804198e8c308a0b7940fd7c4e6703915c75ca0fa53e80f6a99ab12734d1a2cd4', 'ball_l': 'a5a00d3d0139ecd2352b3bfb623603462e2de35ae5fe01198d1a1c12951fc0df', 'thigh_r': 'b896bdec8dd1e50f74617950b6d56ff5906a4beea81c4995fdc35c17081f19e9', 'calf_r': '59e8b1e596eb4a398bdaa7b2c1f06050529b3c1c3e1ad70e1f8923f53f005ded', 'foot_r': 'ffba250ace81f273f7db355945c62dcc9968403f660591774c730f0f8a3c5d53', 'ball_r': '13a66fadc6e6b9c72b4c95a4f5a768b7d9b513c4bbe799250674f49b25da2b57'}}, 'female': {'Left': {'thigh_l': '691b452c72609d5b34ebc71d64052e0546a75083ca47bf465a5b27fb3d97eb90', 'calf_l': 'b1feefd5cfba17b717d58d8d47ba08b81c10dc37807f19f4cf9b353295ca0c8f', 'foot_l': '9c7229a9e2f7ef7cabb01919f4092c018383b387cc9f6eeb42555a86d5e5de25', 'ball_l': '5b12956afe00486e91222392da9fca82c16fc508fb8f6fad0c6f6cf1929b889e', 'thigh_r': 'cc611a059b531c9b44dcfea7e246a3f58bd2195a9c4f87e3c15501a118a2da21', 'calf_r': '0e4be82219d8f3da8d475c3e65ff57b186dba46c5d6f8fba525ea9461f1780a3', 'foot_r': 'bca9fcaffb3d48c71eb0814180b10e16ffaa0becfa36e361639c8e5f8eb4f753', 'ball_r': 'a0341f9f76b3c6ee1c69c716fa7dff9ca117d944ad1965c61f45560b3dcb249a'}, 'Right': {'thigh_l': 'c1349dbe3118899ac753473de688d87e3debbe32b21dd54360c4defc94f415cf', 'calf_l': '7ad40dd145a2325a8725a1ed370eb9360b447959a0238b14ccddda3f572a5017', 'foot_l': 'd5784c146988d552062d371a32d70a7f05bcec55cb7bf355a063162537004854', 'ball_l': 'f0e465b3656e99096cc98e64c1012f0cb733978755535eda8fd810b6a87a0e69', 'thigh_r': '7354ecf9b59c6a6b3e9348cd0661b4d5e047c6fb0c80d51b3f7c7e4e2e2446ef', 'calf_r': 'fae8b1596c7e7e1c4031ec635bc2f9265cca772f976a5c44040ff6f4a31bc4e6', 'foot_r': 'b64d3c53030eee80e94affd2d983f21befc71c0b584078695989b20814c30c98', 'ball_r': '691720f10c1e81c6324410dea4b1e410c01ae5e7d08dcb2de837a7bea8ba62ed'}}}
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);obj=importlib.util.module_from_spec(spec);spec.loader.exec_module(obj);return obj

def access(doc,binary,index):
 a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']];size={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]*{5121:1,5123:2,5125:4,5126:4}[a['componentType']];offset=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',size)
 raw=b''.join(binary[offset+i*stride:offset+i*stride+size]for i in range(a['count']));return {k:v for k,v in a.items()if k not in('bufferView','byteOffset','min','max')},raw

def tracks(doc,binary,clip):
 result={}
 for c in clip['channels']:
  s=clip['samplers'][c['sampler']];result[(doc['nodes'][c['target']['node']]['name'],c['target']['path'])]=(s.get('interpolation','LINEAR'),access(doc,binary,s['input']),access(doc,binary,s['output']))
 return result

def main():
 p=argparse.ArgumentParser();p.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[2]);p.add_argument('--receipt',type=Path);a=p.parse_args();root=a.root.resolve();assets=root/'web/public/models/characters';mp=assets/'manifest.json';original_manifest=mp.read_bytes();manifest=json.loads(original_manifest);merge=module('equipped_crouch_merge',root/'tools/characters-3d/merge-animation-bank.py');pack=module('equipped_crouch_pack',root/'assets/source/characters-3d/authoring/gltf_pack.py');pending=[];receipt={}
 for gender in('male','female'):
  bank=manifest['animationLibraries'][gender];path=assets/Path(bank['url']).name;old_bytes=path.read_bytes();doc,binary=merge.read_glb(path);native_doc={k:copy.deepcopy(v)for k,v in doc.items()if k not in('animations','buffers','bufferViews','accessors')};clips={c['name']:c for c in doc['animations']};before={name:tracks(doc,binary,clip)for name,clip in clips.items()};metadata={c['name']:c for c in bank['clips']};selected=set();changed=[]
  for direction in('Left','Right'):
   source='crouch.strafe'+direction+'.unarmed';support=metadata[source]['nativeSidewaysSupport'];assert support['surface']=='complete-native-boot'and support['sampleRate']==60
   source_tracks=before[source];source_samplers={doc['nodes'][c['target']['node']]['name']:clips[source]['samplers'][c['sampler']]for c in clips[source]['channels']if c['target']['path']=='rotation'}
   def last_time(payload):return struct.unpack_from('<f',payload[1][1],len(payload[1][1])-4)[0]
   source_duration=max(last_time(t)for t in source_tracks.values())
   for gear in GEAR:
    name='crouch.strafe'+direction+'.'+gear;selected.add(name);clip=clips[name];meta=metadata[name];assert(meta.get('nativeStrideSpeed')or meta['locomotionSpeed'])==support['retainedNativeStrideSpeed'];assert max(last_time(t)for t in before[name].values())==source_duration
    assert meta['duration']==metadata[source]['duration'],'Nominal native cycle differs'
    for key,payload in source_tracks.items():
     if key[0]in('Root','pelvis'):assert before[name][key]==payload,(name,key,'native parent changed')
    for bone in LEGS:
     actual=before[name][(bone,'rotation')];expected=source_tracks[(bone,'rotation')]
     assert actual==expected or hashlib.sha256(actual[2][1]).hexdigest()==LEG_BASIS[gender][direction][bone],(name,bone,'unaudited lower source change')
     for kind in('translation','scale'):assert before[name][(bone,kind)]==source_tracks[(bone,kind)],(name,bone,kind,'native dimension changed')
    for channel in clip['channels']:
     bone=doc['nodes'][channel['target']['node']]['name']
     if bone not in LEGS or channel['target']['path']!='rotation':continue
     channel['sampler']=len(clip['samplers']);clip['samplers'].append(copy.deepcopy(source_samplers[bone]))
    used=sorted({c['sampler']for c in clip['channels']});indices={old:new for new,old in enumerate(used)};clip['samplers']=[clip['samplers'][i]for i in used]
    for channel in clip['channels']:channel['sampler']=indices[channel['sampler']]
    meta['nativeSidewaysSupport']=copy.deepcopy(support)
  candidate=path.with_name(gender+'-equipped-crouch-candidate.glb');merge.write_glb(candidate,doc,binary);raw,_=pack.pack(candidate,{});new,new_binary=merge.read_glb(candidate);after={c['name']:tracks(new,new_binary,c)for c in new['animations']};assert before.keys()==after.keys();retained=0
  assert native_doc=={k:v for k,v in new.items()if k not in('animations','buffers','bufferViews','accessors')},'Native geometry document changed'
  for name,old in before.items():
   assert old.keys()==after[name].keys()
   for key,payload in old.items():
    if name in selected and key[0]in LEGS and key[1]=='rotation':
     assert last_time(payload)==last_time(after[name][key]),'Stored cycle changed';changed.append([name,*key]);assert after[name][key]==after['crouch.strafe'+('Left'if 'Left'in name else'Right')+'.unarmed'][key]
    else:assert payload==after[name][key],(name,key,'Unrelated native channel changed');retained+=int(name in selected)
  assert len(changed)==80;bank['bytes']=len(raw);bank['sha256']=hashlib.sha256(raw).hexdigest();receipt[gender]={'selectedRotationChannels':changed,'unchangedClips':len(before)-len(selected),'selectedUnchangedOtherChannels':retained,'retainedNativePeriodsAndPace':True,'denseKeys':'only eight selected leg rotation channels; 60 Hz current supported unarmed path','sha256':bank['sha256']};pending.append((path,raw,candidate,hashlib.sha256(old_bytes).hexdigest()))
 assert mp.read_bytes()==original_manifest,'Concurrent manifest change; retry on current copy'
 for path,raw,candidate,old_hash in pending:assert hashlib.sha256(path.read_bytes()).hexdigest()==old_hash,'Concurrent bank change; retry on current copy'
 for path,raw,candidate,old_hash in pending:path.write_bytes(raw);candidate.unlink()
 canonical=subprocess.run(['node','-e',"let data='';process.stdin.on('data',part=>data+=part);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(JSON.parse(data),null,2)+'\\n'));"],input=json.dumps(manifest),capture_output=True,text=True,check=True).stdout
 mp.write_text(canonical)
 if a.receipt:a.receipt.write_text(json.dumps(receipt,indent=2)+'\n')
 print('EQUIPPED_CROUCH_NATIVE_SUPPORT_READY',json.dumps(receipt),flush=True)
if __name__=='__main__':main()
