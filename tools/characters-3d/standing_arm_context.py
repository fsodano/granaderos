"""Verified historical bank views, outside the frozen body layer helpers."""
from pathlib import Path
import copy,hashlib,importlib.util,json,tempfile
FIELD='standingFreeArmRest'

def _module(name,path):
    spec=importlib.util.spec_from_file_location(name,path);result=importlib.util.module_from_spec(spec);spec.loader.exec_module(result);return result

def verify_banks(root):
    root=Path(root).resolve();assets=root/'web/public/models/characters';manifest=json.loads((assets/'manifest.json').read_bytes());tool=_module('standing_bank_context_tool',root/'tools/characters-3d/build-standing-free-arm-rest.py');glb=_module('standing_bank_context_glb',root/'tools/characters-3d/merge-animation-bank.py');rows={}
    for gender,record in manifest.get('animationLibraries',{}).items():
        if FIELD not in record:continue
        assert gender in ('male','female')and record['url']==f'/models/characters/{gender}-animations.glb','Unowned standing bank layer'
        path=assets/Path(record['url']).name;raw=path.read_bytes();assert tool.sha(raw)==record['sha256']and len(raw)==record['bytes'],'Standing bank and manifest differ';doc,binary=glb.read_glb(path);assert record[FIELD]['anatomy']==gender,'Standing bank anatomy receipt differs'
        rows[gender]=tool.verify(root,doc,binary,record)
    return rows

def _unwrap_banks(private,source):
    """Write exact predecessors only in a copied private view after verification."""
    private=Path(private).resolve();assert private!=Path(source).resolve(),'Cannot unwrap a published bank in place';rows=verify_banks(private);assets=private/'web/public/models/characters';mp=assets/'manifest.json';manifest=json.loads(mp.read_bytes());tool=_module('standing_bank_context_restore',private/'tools/characters-3d/build-standing-free-arm-rest.py');glb=_module('standing_bank_context_restore_glb',private/'tools/characters-3d/merge-animation-bank.py')
    for gender in rows:
        record=manifest['animationLibraries'][gender];path=assets/Path(record['url']).name;doc,binary=glb.read_glb(path);before,old_binary=tool.restore_bank(doc,binary,record[FIELD]);restored=tool.restore_record(record);raw=tool.encode(before,old_binary);assert tool.sha(raw)==restored['sha256']and len(raw)==restored['bytes'];path.unlink();path.write_bytes(raw);manifest['animationLibraries'][gender]=restored
    if rows:mp.write_text(json.dumps(manifest,indent=2)+'\n')
    return rows

def create_bank_predecessor_snapshot(root,target,link_assets=True):
    from family_surface_context import _copy_inputs,_pins,_check_pins
    root=Path(root).resolve();target=Path(target).resolve();assert target!=root and not target.exists(),'Historical standing bank view requires a new private path';pins=_pins(root);active=verify_banks(root);_copy_inputs(root,target,pins);rows=_unwrap_banks(target,root);assert rows==active;_check_pins(root,pins)
    return {'root':str(target),'standingBanksVerified':rows,'standingBanksRestoredExact':True,'releasedInputsExact':True}

def create_historical_snapshot(root,target,stage='folds',link_assets=True):
    """Verify/unwrap the bank layer, then run the unchanged body history helper."""
    from family_surface_context import _pins,_check_pins
    from coarse_garment_context import create_historical_snapshot as body_history
    root=Path(root).resolve();pins=_pins(root)
    with tempfile.TemporaryDirectory(prefix='granaderos-standing-bank-history-')as folder:
        bank_view=Path(folder)/'root';bank_receipt=create_bank_predecessor_snapshot(root,bank_view,link_assets=True);receipt=body_history(bank_view,target,stage=stage,link_assets=link_assets)
    _check_pins(root,pins);receipt.update(standingBanksVerified=bank_receipt['standingBanksVerified'],standingBanksRestoredExact=True,releasedInputsExact=True);return receipt

def verify_native_bank_repeat(root,name):
    """Verify a completed native donor through the exact bank predecessor.

    The original prone pass repacks used accessors, and the blade pass rejects
    a second donor application. Read their completed contracts without running
    a writing installer. Fresh bank builds still run those original tools.
    """
    import base64
    from family_surface_context import _pins,_check_pins
    assert name in ('build-prone-pistol-forearm-support.py','build-standing-blade-wrists.py'),'Unowned native standing bank repeat'
    root=Path(root).resolve();pins=_pins(root);assert len(verify_banks(root))==2,'Native repeat needs both verified standing bank layers'
    assets=root/'web/public/models/characters';manifest=json.loads((assets/'manifest.json').read_bytes());tool=_module('standing_native_restore',root/'tools/characters-3d/build-standing-free-arm-rest.py');glb=_module('standing_native_restore_glb',root/'tools/characters-3d/merge-animation-bank.py');rows={}
    for gender,active in manifest['animationLibraries'].items():
        doc,binary=glb.read_glb(assets/Path(active['url']).name);doc,binary=tool.restore_bank(doc,binary,active[FIELD]);record=tool.restore_record(active);metadata={clip['name']:clip for clip in record['clips']}
        if name=='build-prone-pistol-forearm-support.py':
            native=_module('standing_prone_tracks',root/'tools/characters-3d/build-prone-work-support.py');tracks=native.tracks(doc,binary);source=tracks['prone.idle.unarmed'];assert metadata['prone.idle.unarmed']['nativeArmSupport']['surface']=='complete-native-palm-finger-and-sleeve';changed=[]
            for clip_name in ('prone.idle.short-gun','prone.aim.short-gun','prone.fire.short-gun'):
                idle=clip_name=='prone.idle.short-gun';target=tracks[clip_name]
                expected={'method':'retained-supported-free-forearm-rotations','surface':'complete-native-palm-finger-and-sleeve','sourceClip':'prone.idle.unarmed','hand':'left','floor':.002,'retainedBodyLegsRightGripAndClock':True,'rotationKeys':'native-supported-breathing-curve'if idle else'retained-static-input-times'}
                assert metadata[clip_name]['nativeProneForearmSupport']==expected,'Native prone support metadata differs'
                for bone in ('upperarm_l','lowerarm_l','hand_l'):
                    track=target[bone,'rotation'];goal=source[bone,'rotation'];assert track==goal if idle else all(row==goal[2][0]for row in track[2]),'Native prone donor rotation differs';changed.append([clip_name,bone,'rotation'])
                for bone in ('Root','pelvis','spine_01','spine_02','spine_03','clavicle_l'):
                    for kind in ('translation','rotation','scale'):
                        track=target[bone,kind];goal=source[bone,kind];assert track==goal if idle else all(row==goal[2][0]for row in track[2]),'Native prone donor parent differs'
                for key,track in target.items():
                    if key[0].endswith('_l')and key[0].startswith(('thumb_','index_','middle_','ring_','pinky_')):assert track[2][0]==source[key][2][0],'Native prone donor finger differs'
            rows[gender]={'nativeRotationsVerified':len(changed),'sourceClip':'prone.idle.unarmed','completedMetadataExact':True}
        else:
            donor_path=root/'assets/source/characters-3d/authoring/standing_blade_wrist_donor.json';donor=json.loads(donor_path.read_bytes());assert donor['version']==1 and set(donor['clipNames'])=={'stand.slash.blade.thrust'} and set(donor['rotationBones'])=={'upperarm_r','lowerarm_r','hand_r','thumb_01_r','thumb_02_r','thumb_03_r'},'Native blade donor scope differs';source=donor['banks'][gender];nodes={node['name']:node for node in doc['nodes']if'name'in node};assert len(source['nativeSkeletonRest'])==53
            for bone,rest in source['nativeSkeletonRest'].items():assert {key:nodes[bone][key]for key in ('translation','rotation','scale','matrix')if key in nodes[bone]}==rest,'Native blade donor bind differs'
            decoder=_module('standing_blade_channels',root/'tools/characters-3d/build-gesture-support.py');tracks=decoder.channels(doc,binary);clip_name='stand.slash.blade.thrust';spec=metadata[clip_name];source_clip=source['clips'][clip_name]
            expected={'method':'reviewed-six-native-rotation-donor','sourceSha256':tool.sha(donor_path.read_bytes()),'sourceCommit':donor['sourceCommit'],'sourceBankSha256':source['sourceBankSha256'],'bones':donor['rotationBones'],'preservedNativeClocksAndOtherChannels':True};assert spec['nativeBladeWrist']==expected,'Native blade donor metadata differs';assert spec['duration']==source_clip['duration']and spec['markers']==source_clip['markers'],'Native blade donor clock differs'
            assert set(source_clip['tracks'])==set(donor['rotationBones'])
            for bone,source_track in source_clip['tracks'].items():
                interpolation,clock,values=tracks[clip_name][bone,'rotation'];assert interpolation=='LINEAR' and clock[0]=={'componentType':5126,'type':'SCALAR'}and values[0]=={'componentType':5126,'type':'VEC4'};assert clock[1]==base64.b64decode(source_track['inputFloat32LE'],validate=True)and values[1]==base64.b64decode(source_track['outputQuaternionFloat32LE'],validate=True),'Native blade donor bytes differ'
            rows[gender]={'nativeRotationsVerified':6,'sourceDonorSha256':tool.sha(donor_path.read_bytes()),'completedMetadataExact':True}
    _check_pins(root,pins);return {'nativePass':name,'mode':'completed-donor-verification','privatePredecessorVerified':True,'banks':rows,'exactNoOp':True,'publishedWrites':0}

if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser(description='Verify a completed native bank pass without changing a layered library.');parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[2]);parser.add_argument('--native-pass',required=True,choices=['build-prone-pistol-forearm-support.py','build-standing-blade-wrists.py']);args=parser.parse_args();print(json.dumps(verify_native_bank_repeat(args.root,args.native_pass)))
