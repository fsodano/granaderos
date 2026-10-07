#!/usr/bin/env python3
"""Build selected gestures for both native anatomies; retain other assets.

Example: python3 tools/characters-3d/build-motion-increment.py --gesture reload --gesture unload --equipment long-gun
"""
from pathlib import Path
import argparse,concurrent.futures,hashlib,json,subprocess,tempfile
from importlib.util import spec_from_file_location,module_from_spec
ROOT=Path(__file__).resolve().parents[2];HERE=ROOT/'assets/source/characters-3d/authoring';OUT=ROOT/'web/public/models/characters'
p=argparse.ArgumentParser();p.add_argument('--gesture',action='append',required=True);p.add_argument('--equipment',required=True);p.add_argument('--posture');p.add_argument('--bone',action='append');p.add_argument('--metadata-field',action='append');p.add_argument('--existing-only',action='store_true');p.add_argument('--blender',default='/Applications/Blender.app/Contents/MacOS/Blender');a=p.parse_args()
loader=spec_from_file_location('merge_animation_bank',Path(__file__).with_name('merge-animation-bank.py'));merger=module_from_spec(loader);loader.loader.exec_module(merger)
loader=spec_from_file_location('gltf_pack',HERE/'gltf_pack.py');packer=module_from_spec(loader);loader.loader.exec_module(packer)
with tempfile.TemporaryDirectory(prefix='granaderos-motion-')as scratch:
    def run(pair):
        gender,preset=pair;output=Path(scratch)/(gender+'.glb');log=Path(scratch)/(gender+'.log')
        command=[a.blender,'--background','--factory-startup','--python',str(HERE/'export_motion_increment.py'),'--','--preset',preset,'--output',str(output),'--equipment',a.equipment]
        if a.posture:command+=['--posture',a.posture]
        for gesture in a.gesture:command+=['--gesture',gesture]
        with log.open('w')as stream:result=subprocess.run(command,cwd=ROOT,stdout=stream,stderr=subprocess.STDOUT)
        content=log.read_text()
        if result.returncode or'MOTION_INCREMENT_READY'not in content:raise RuntimeError(content[-5000:])
        print(next(line for line in content.splitlines()if line.startswith('MOTION_INCREMENT_READY')),flush=True)
        return gender,output,json.loads(output.with_suffix('.json').read_text())
    with concurrent.futures.ThreadPoolExecutor(max_workers=2)as pool:increments=list(pool.map(run,[('male','granadero'),('female','woman-scout')]))
    # Read after workers finish so concurrent appearance records remain intact.
    manifest_path=OUT/'manifest.json';manifest=json.loads(manifest_path.read_text())
    for gender,increment,motion in increments:
        bank=manifest['animationLibraries'][gender];path=OUT/Path(bank['url']).name;merger.merge(path,increment,bones=a.bone,existing_only=a.existing_only);raw,_=packer.pack(path,{})
        clips={clip['name']:clip for clip in motion['clips']}
        if a.metadata_field:
            for clip in bank['clips']:
                replacement=clips.get(clip['name'])
                if replacement:
                    for field in a.metadata_field:
                        if field in replacement:clip[field]=replacement[field]
        else:bank['clips']=[clips.pop(clip['name'],clip)for clip in bank['clips']]+([]if a.existing_only else list(clips.values()))
        bank['bytes']=len(raw);bank['sha256']=hashlib.sha256(raw).hexdigest()
    overrides=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import{ACTOR_ITEM_CLIP_OVERRIDES}from './game/actor-action-contract.js';console.log(JSON.stringify(ACTOR_ITEM_CLIP_OVERRIDES));"],cwd=ROOT,text=True))
    if not a.existing_only:
        for item,binding in overrides.items():manifest['equipment']['items'][item]['clipOverrides']=binding
    manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
subprocess.run(['node','tools/characters-3d/compile-locomotion-profile.mjs'],cwd=ROOT,check=True)
