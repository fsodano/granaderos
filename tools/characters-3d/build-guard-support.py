#!/usr/bin/env python3
"""Fit selected released standing rifle boots without retargeting other tracks.

The selected clips supply their own actual pose and timing. Only eight
native leg rotation channels are transplanted into each complete bank.
"""
from pathlib import Path
import argparse,concurrent.futures,hashlib,json,subprocess,tempfile,copy,shutil
from importlib.util import spec_from_file_location,module_from_spec
from library_publication import publication_lock

DEFAULT_NAMES={'stand.idle.long-gun','stand.butt.long-gun'}
SUPPORTED_NAMES=DEFAULT_NAMES|{'stand.bayonet.long-gun'}
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


def prove_preserved(before,after,names=DEFAULT_NAMES):
    original,data=before;updated,newdata=after;old=channels(original,data);new=channels(updated,newdata)
    assert set(old)==set(new),'Guard repair changes the native motion inventory'
    changed=[]
    for name,tracks in old.items():
        assert set(tracks)==set(new[name]),name+' changes the native targets'
        for key,payload in tracks.items():
            if name in names and key[0]in LEGS and key[1]=='rotation':
                if payload!=new[name][key]:changed.append((name,*key))
            else:assert payload==new[name][key],str((name,key))+' changes a retained native channel'
    assert len(changed)==len(names)*len(LEGS),'Every selected leg rotation must have its measured correction'
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
    return {'clips':len(old),'untouchedClips':len(old)-len(names),'changedRotationChannels':changed,'retainedChannelsPerSelectedClip':len(old[next(iter(names))])-8,'nativeRigAndMeshExact':True}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[2])
    parser.add_argument('--directory',type=Path,help='Existing complete library; use a private copy for review.')
    parser.add_argument('--source-directory',type=Path,help='Frozen authoring source for a private review build.')
    parser.add_argument('--blender',default='/Applications/Blender.app/Contents/MacOS/Blender')
    parser.add_argument('--receipt',type=Path)
    parser.add_argument('--clip',action='append',choices=sorted(SUPPORTED_NAMES))
    args=parser.parse_args()
    root=args.root.resolve();default_authoring=root/'assets/source/characters-3d/authoring';production=root/'web/public/models/characters'
    authoring=(args.source_directory or default_authoring).resolve();out=(args.directory or production).resolve()
    if authoring!=default_authoring.resolve() and out==production.resolve():
        parser.error('Build frozen sources into a private library; production must use current source.')
    # Fit and publication share one lock: the released source bank must remain
    # unchanged while both anatomies are sampled and their leg tracks are staged.
    with publication_lock(out):
        build(root,authoring,out,args)


def build(root,authoring,out,args):
    names=set(args.clip)if args.clip else DEFAULT_NAMES
    merger_path=root/'tools/characters-3d/merge-animation-bank.py'
    inputs=[merger_path,root/'tools/characters-3d/compile-locomotion-profile.mjs',authoring/'gltf_pack.py',authoring/'guard_support.py',authoring/'export_guard_support.py']
    if 'stand.bayonet.long-gun'in names:inputs.append(authoring/'bayonet_support.py')
    source_hashes={path:hashlib.sha256(path.read_bytes()).hexdigest()for path in inputs}
    merger=module('guard_merge',merger_path);packer=module('guard_pack',authoring/'gltf_pack.py');manifest_path=out/'manifest.json';initial_manifest=manifest_path.read_bytes();manifest=json.loads(initial_manifest);source=source_hashes[authoring/'guard_support.py'];receipt={}
    if not manifest.get('complete') or set(manifest['animationLibraries'])!={'male','female'}:
        raise ValueError('Build the complete paired library before applying guard support.')
    before_hashes={gender:hashlib.sha256((out/Path(bank['url']).name).read_bytes()).hexdigest()for gender,bank in manifest['animationLibraries'].items()}
    for gender,bank in manifest['animationLibraries'].items():
        if before_hashes[gender]!=bank['sha256']:
            raise ValueError(gender+': source bank does not match its manifest; no assets were published.')
    with tempfile.TemporaryDirectory(prefix='granaderos-native-guard-')as scratch:
        def export(gender):
            path=out/Path(manifest['animationLibraries'][gender]['url']).name;before=merger.read_glb(path);doc,data=before;selected=copy.deepcopy(doc);selected['animations']=[clip for clip in selected['animations']if clip['name']in names]
            assert {clip['name']for clip in selected['animations']}==names
            # Geometry/weights remain exact; source fitting needs no textures.
            for key in('images','textures','samplers'):selected.pop(key,None)
            selected['materials']=[{'name':material.get('name','Native')}for material in selected.get('materials',[])]
            input_path=Path(scratch)/(gender+'-input.glb');merger.write_glb(input_path,selected,bytearray(data));increment=Path(scratch)/(gender+'.glb');log=Path(scratch)/(gender+'.log')
            with log.open('w')as stream:result=subprocess.run([args.blender,'--background','--factory-startup','--python',str(authoring/'export_guard_support.py'),'--','--input',str(input_path),'--output',str(increment)],stdout=stream,stderr=subprocess.STDOUT,check=False)
            content=log.read_text();assert result.returncode==0 and f'GUARD_SUPPORT_READY {len(names)}'in content,content[-5000:]
            return gender,path,before,increment,json.loads(increment.with_suffix('.json').read_text())
        with concurrent.futures.ThreadPoolExecutor(max_workers=2)as pool:exports=list(pool.map(export,('male','female')))
        pending=[]
        for gender,path,before,increment,report in exports:
            candidate=Path(scratch)/(gender+'-final.glb');shutil.copy2(path,candidate)
            merger.merge(candidate,increment,bones=LEGS,existing_only=True);raw,_=packer.pack(candidate,{})
            proof=prove_preserved(before,merger.read_glb(candidate),names);bank=manifest['animationLibraries'][gender];bank['bytes']=len(raw);bank['sha256']=hashlib.sha256(raw).hexdigest()
            for clip in bank['clips']:
                if clip['name']in report:
                    data=report[clip['name']];assert abs(data['duration']-clip['duration'])<.000001,'Native clip duration changed'
                    clip['nativeBootSupport']={'method':'released-guard-leg-rotations','surface':'complete-native-boot','floor':.002,'sampleRate':data['sampleRate'],'preservedNativeLift':True,'maximumHeelRoll':max(sample[side]['heelRoll']for sample in data['samples']for side in('l','r')),'forefootRollEnvelopes':data['forefootRollEnvelopes'],'minimumStraightLegReserve':data['minimumStraightLegReserve'],'sourceSha256':source}
                    if 'planarShiftEnvelopes'in data:
                        clip['nativeBootSupport'].update({'method':'released-bayonet-leg-rotations','planarShiftEnvelopes':data['planarShiftEnvelopes'],'maximumPlanarCorrection':max(sample[side]['planarCorrection']for sample in data['samples']for side in('l','r')),'measuredMinimumStraightLegReserve':data['measuredMinimumStraightLegReserve'],'numericalReserveBuffer':data['numericalReserveBuffer'],'supportSourceSha256':source,'sourceSha256':hashlib.sha256((authoring/'bayonet_support.py').read_bytes()).hexdigest()})
            receipt[gender]={'sha256':bank['sha256'],'proof':proof,'source':report}
            pending.append((path,raw))
        # Compile the shared gait/action profile against staged banks first.
        # A failed calibration must not publish either animation bank.
        calibration=Path(scratch)/'calibration';calibration.mkdir()
        for path,raw in pending:(calibration/path.name).write_bytes(raw)
        for gender in ('male','female'):
            appearance=next(entry for entry in manifest['appearances'].values()if entry['animationLibrary']==gender)
            filename=Path(appearance['lods'][0]['url']).name;shutil.copy2(out/filename,calibration/filename)
        (calibration/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
        subprocess.run(['node',str(root/'tools/characters-3d/compile-locomotion-profile.mjs'),'--directory',str(calibration)],cwd=root,check=True)
        compiled=json.loads((calibration/'manifest.json').read_text())
        if compiled!=manifest:
            raise ValueError('Existing locomotion metadata needs calibration before guard fitting; no assets were published.')
        production=out==(root/'web/public/models/characters').resolve()
        profile=json.loads((calibration/'locomotion-profile.json').read_text())
        profile['source']='web/public/models/characters/manifest.json'if production else str(manifest_path)
        profile_path=root/'web/lib/three/locomotion-profile.json'if production else out/'locomotion-profile.json'
        # Stage both banks before replacing either one. Reject changes even
        # from a writer that did not participate in the shared lock protocol.
        if any(hashlib.sha256(path.read_bytes()).hexdigest()!=value for path,value in source_hashes.items()):
            raise ValueError('Authoring source changed during guard fitting; no assets were published.')
        if manifest_path.read_bytes()!=initial_manifest:
            raise ValueError('Another writer changed this manifest; no assets were published.')
        for gender,bank in manifest['animationLibraries'].items():
            if hashlib.sha256((out/Path(bank['url']).name).read_bytes()).hexdigest()!=before_hashes[gender]:
                raise ValueError(gender+': another writer changed this bank; no assets were published.')
        for path,raw in pending:path.with_suffix('.glb.pending').write_bytes(raw)
        profile_pending=profile_path.with_suffix('.json.pending');profile_pending.write_text(json.dumps(profile,ensure_ascii=False,indent=2)+'\n')
        manifest_pending=manifest_path.with_suffix('.json.pending');manifest_pending.write_text(json.dumps(manifest,indent=2)+'\n')
        for path,_ in pending:path.with_suffix('.glb.pending').replace(path)
        profile_pending.replace(profile_path)
        manifest_pending.replace(manifest_path)
    if args.receipt:args.receipt.write_text(json.dumps(receipt,indent=2)+'\n')
    print('NATIVE_GUARD_SUPPORT_READY',json.dumps({gender:data['proof']for gender,data in receipt.items()}),flush=True)


if __name__=='__main__':main()
