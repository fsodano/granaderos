#!/usr/bin/env python3
"""Fit released standing rifle guard boots without retargeting other tracks.

The two selected clips supply their own actual pose and timing. Only eight
native leg rotation channels are transplanted into each complete bank.
"""
from pathlib import Path
import argparse,concurrent.futures,hashlib,json,subprocess,tempfile,copy,shutil
from importlib.util import spec_from_file_location,module_from_spec

NAMES={'stand.idle.long-gun','stand.butt.long-gun'}
LEGS=tuple(role+'_'+side for side in('l','r')for role in('thigh','calf','foot','ball'))


def module(name,path):
    spec=spec_from_file_location(name,path);result=module_from_spec(spec);spec.loader.exec_module(result);return result


def accessor(doc,binary,index):
    a=doc['accessors'][index];view=doc['bufferViews'][a['bufferView']]
    size={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]*{5121:1,5123:2,5125:4,5126:4}[a['componentType']]
    start=view.get('byteOffset',0)+a.get('byteOffset',0);stride=view.get('byteStride',size)
    return {key:a[key]for key in('componentType','type','normalized')if key in a},b''.join(binary[start+i*stride:start+i*stride+size]for i in range(a['count']))


def channels(doc,binary):
    result={}
    for animation in doc['animations']:
        clips={}
        for channel in animation['channels']:
            target=channel['target'];sampler=animation['samplers'][channel['sampler']]
            clips[(doc['nodes'][target['node']]['name'],target['path'])]=(sampler.get('interpolation','LINEAR'),accessor(doc,binary,sampler['input']),accessor(doc,binary,sampler['output']))
        result[animation['name']]=clips
    return result


def prove_preserved(before,after):
    original,data=before;updated,newdata=after;old=channels(original,data);new=channels(updated,newdata)
    assert set(old)==set(new),'Guard repair changes the native motion inventory'
    changed=[]
    for name,tracks in old.items():
        assert set(tracks)==set(new[name]),name+' changes the native targets'
        for key,payload in tracks.items():
            if name in NAMES and key[0]in LEGS and key[1]=='rotation':
                if payload!=new[name][key]:changed.append((name,*key))
            else:assert payload==new[name][key],str((name,key))+' changes a retained native channel'
    assert len(changed)==16,'Every selected leg rotation must have its measured correction'
    assert original['nodes']==updated['nodes'],'Native node dimensions/rest transforms changed'
    for oldskin,newskin in zip(original['skins'],updated['skins']):
        assert {k:v for k,v in oldskin.items()if k!='inverseBindMatrices'}=={k:v for k,v in newskin.items()if k!='inverseBindMatrices'}
        assert accessor(original,data,oldskin['inverseBindMatrices'])==accessor(updated,newdata,newskin['inverseBindMatrices']),'Native inverse binds changed'
    assert len(original['meshes'])==len(updated['meshes'])
    for oldmesh,newmesh in zip(original['meshes'],updated['meshes']):
        assert len(oldmesh['primitives'])==len(newmesh['primitives'])
        for a,b in zip(oldmesh['primitives'],newmesh['primitives']):
            assert set(a['attributes'])==set(b['attributes'])
            for name,index in a['attributes'].items():assert accessor(original,data,index)==accessor(updated,newdata,b['attributes'][name]),'Native mesh attribute changed'
            if'indices'in a:assert accessor(original,data,a['indices'])==accessor(updated,newdata,b['indices']),'Native triangles changed'
    return {'clips':len(old),'untouchedClips':len(old)-2,'changedRotationChannels':changed,'retainedChannelsPerSelectedClip':len(old[next(iter(NAMES))])-8,'nativeRigAndMeshExact':True}


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[2]);parser.add_argument('--blender',default='/Applications/Blender.app/Contents/MacOS/Blender');parser.add_argument('--receipt',type=Path);args=parser.parse_args()
    root=args.root.resolve();authoring=root/'assets/source/characters-3d/authoring';out=root/'web/public/models/characters'
    merger=module('guard_merge',root/'tools/characters-3d/merge-animation-bank.py');packer=module('guard_pack',authoring/'gltf_pack.py');manifest_path=out/'manifest.json';manifest=json.loads(manifest_path.read_text());source=hashlib.sha256((authoring/'guard_support.py').read_bytes()).hexdigest();receipt={}
    with tempfile.TemporaryDirectory(prefix='granaderos-native-guard-')as scratch:
        def export(gender):
            path=out/Path(manifest['animationLibraries'][gender]['url']).name;before=merger.read_glb(path);doc,data=before;selected=copy.deepcopy(doc);selected['animations']=[clip for clip in selected['animations']if clip['name']in NAMES]
            assert {clip['name']for clip in selected['animations']}==NAMES
            # Geometry/weights remain exact; source fitting needs no textures.
            for key in('images','textures','samplers'):selected.pop(key,None)
            selected['materials']=[{'name':material.get('name','Native')}for material in selected.get('materials',[])]
            input_path=Path(scratch)/(gender+'-input.glb');merger.write_glb(input_path,selected,bytearray(data));increment=Path(scratch)/(gender+'.glb');log=Path(scratch)/(gender+'.log')
            with log.open('w')as stream:result=subprocess.run([args.blender,'--background','--factory-startup','--python',str(authoring/'export_guard_support.py'),'--','--input',str(input_path),'--output',str(increment)],stdout=stream,stderr=subprocess.STDOUT,check=False)
            content=log.read_text();assert result.returncode==0 and'GUARD_SUPPORT_READY 2'in content,content[-5000:]
            return gender,path,before,increment,json.loads(increment.with_suffix('.json').read_text())
        with concurrent.futures.ThreadPoolExecutor(max_workers=2)as pool:exports=list(pool.map(export,('male','female')))
        pending=[]
        for gender,path,before,increment,report in exports:
            candidate=Path(scratch)/(gender+'-final.glb');shutil.copy2(path,candidate)
            merger.merge(candidate,increment,bones=LEGS,existing_only=True);raw,_=packer.pack(candidate,{})
            proof=prove_preserved(before,merger.read_glb(candidate));bank=manifest['animationLibraries'][gender];bank['bytes']=len(raw);bank['sha256']=hashlib.sha256(raw).hexdigest()
            for clip in bank['clips']:
                if clip['name']in report:
                    data=report[clip['name']];assert abs(data['duration']-clip['duration'])<.000001,'Native clip duration changed'
                    clip['nativeBootSupport']={'method':'released-guard-leg-rotations','surface':'complete-native-boot','floor':.002,'sampleRate':data['sampleRate'],'preservedNativeLift':True,'maximumHeelRoll':max(sample[side]['heelRoll']for sample in data['samples']for side in('l','r')),'forefootRollEnvelopes':data['forefootRollEnvelopes'],'minimumStraightLegReserve':data['minimumStraightLegReserve'],'sourceSha256':source}
            receipt[gender]={'sha256':bank['sha256'],'proof':proof,'source':report}
            pending.append((path,raw))
        # Publish only after both native banks passed their preservation gate.
        for path,raw in pending:path.write_bytes(raw)
    manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
    if args.receipt:args.receipt.write_text(json.dumps(receipt,indent=2)+'\n')
    print('NATIVE_GUARD_SUPPORT_READY',json.dumps({gender:data['proof']for gender,data in receipt.items()}),flush=True)


if __name__=='__main__':main()
