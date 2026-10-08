#!/usr/bin/env python3
"""Build selected gestures for both native anatomies; retain other assets.

Example: python3 tools/characters-3d/build-motion-increment.py --gesture reload --gesture unload --equipment long-gun
Use --directory with a complete private library for review. Use --source-directory
to build that candidate from a frozen copy of the authoring source.
"""
from pathlib import Path
import argparse
import concurrent.futures
import hashlib
import json
import shutil
import subprocess
import tempfile
from importlib.util import spec_from_file_location, module_from_spec
from library_publication import publication_lock

ROOT = Path(__file__).resolve().parents[2]
HERE = ROOT / 'assets/source/characters-3d/authoring'
OUT = ROOT / 'web/public/models/characters'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_module(name, path):
    spec = spec_from_file_location(name, path)
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--gesture', action='append', required=True)
    parser.add_argument('--equipment', required=True)
    parser.add_argument('--posture')
    parser.add_argument('--bone', action='append')
    parser.add_argument('--metadata-field', action='append')
    parser.add_argument('--existing-only', action='store_true')
    parser.add_argument('--directory', type=Path, default=OUT,
                        help='Existing complete library; use a private copy for review.')
    parser.add_argument('--source-directory', type=Path, default=HERE,
                        help='Frozen authoring source for a private review build.')
    parser.add_argument('--blender', default='/Applications/Blender.app/Contents/MacOS/Blender')
    args = parser.parse_args()
    out = args.directory.resolve()
    source_root = args.source_directory.resolve()
    if source_root != HERE.resolve() and out == OUT.resolve():
        raise ValueError('Build frozen sources into a private library; production must use current source.')
    contract_root = source_root.parents[3]
    # Freeze inputs before reading the contract or starting either worker.
    # Climb authoring also consumes the shared physical ladder geometry.
    sources = {str(path): digest(path) for path in [*source_root.glob('*.py'),*source_root.glob('rifle_guard_curves_*.json')]}
    for name in ('actor-action-contract.js', 'climb-geometry.js',
                 'building-types.js', 'building-scale.js'):
        contract_path = contract_root / 'game' / name
        sources[str(contract_path)] = digest(contract_path)
    specs = json.loads(subprocess.check_output([
        'node', '--input-type=module', '-e',
        "import{ACTOR_CLIP_SPECS}from './game/actor-action-contract.js';"
        "console.log(JSON.stringify(ACTOR_CLIP_SPECS));",
    ], cwd=contract_root, text=True))
    selected = [spec for spec in specs
                if ('*' in args.gesture or spec['gesture'] in args.gesture)
                and (args.equipment == 'all' or spec['equipment'] == args.equipment)
                and (not args.posture or spec['posture'] == args.posture)]
    if not selected:
        raise ValueError('No clips match these filters. Use semantic postures such as standing or crouched.')
    manifest_path = out / 'manifest.json'
    initial = json.loads(manifest_path.read_text())
    if not initial['complete']:
        raise ValueError('Build the complete library before applying a motion increment.')
    paths = {gender: out / Path(bank['url']).name
             for gender, bank in initial['animationLibraries'].items()}
    before = {gender: digest(path) for gender, path in paths.items()}
    merger = load_module('merge_animation_bank', Path(__file__).with_name('merge-animation-bank.py'))
    rig_check = load_module('appearance_rig_check', Path(__file__).with_name('build-appearance-increment.py'))
    packer = load_module('gltf_pack', source_root / 'gltf_pack.py')
    with tempfile.TemporaryDirectory(prefix='granaderos-motion-') as directory:
        scratch = Path(directory)

        def build(pair):
            gender, preset = pair
            output = scratch / (gender + '-increment.glb')
            log = scratch / (gender + '.log')
            command = [args.blender, '--background', '--factory-startup', '--python',
                       str(source_root / 'export_motion_increment.py'), '--',
                       '--preset', preset, '--output', str(output), '--equipment', args.equipment]
            if args.posture:
                command += ['--posture', args.posture]
            for gesture in args.gesture:
                command += ['--gesture', gesture]
            with log.open('w') as stream:
                result = subprocess.run(command, cwd=ROOT, stdout=stream, stderr=subprocess.STDOUT)
            content = log.read_text()
            if result.returncode or 'MOTION_INCREMENT_READY' not in content:
                raise RuntimeError(content[-5000:])
            print(next(line for line in content.splitlines() if line.startswith('MOTION_INCREMENT_READY')), flush=True)
            return gender, output, json.loads(output.with_suffix('.json').read_text())

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            increments = list(pool.map(build, [('male', 'granadero'), ('female', 'woman-scout')]))
        if any(digest(Path(path)) != value for path, value in sources.items()):
            raise ValueError('Authoring source changed during the build; no assets were published.')
        # Stage both banks before touching the destination.
        manifest = json.loads(manifest_path.read_text())
        staged = {}
        for gender, increment, motion in increments:
            bank = manifest['animationLibraries'][gender]
            if bank != initial['animationLibraries'][gender] or digest(paths[gender]) != before[gender]:
                raise ValueError(gender + ': another build changed this bank; no assets were published.')
            target = scratch / (gender + '-merged.glb')
            shutil.copy2(paths[gender], target)
            signature = rig_check.native_signature(increment)
            if rig_check.native_signature(target) != signature:
                raise ValueError(gender + ': native hierarchy or inverse bind matrices differ; no assets were published.')
            increment_doc, _ = merger.read_glb(increment)
            for animation in increment_doc['animations']:
                for channel in animation['channels']:
                    name = increment_doc['nodes'][channel['target']['node']].get('name')
                    if name not in signature:
                        raise ValueError(gender + ': animation targets a non-native node: ' + str(name))
            merger.merge(target, increment, bones=args.bone, existing_only=args.existing_only)
            raw, _ = packer.pack(target, {})
            clips = {clip['name']: clip for clip in motion['clips']}
            if args.metadata_field:
                for clip in bank['clips']:
                    replacement = clips.get(clip['name'])
                    if replacement:
                        for field in args.metadata_field:
                            if field in replacement:
                                clip[field] = replacement[field]
            else:
                bank['clips'] = [clips.pop(clip['name'], clip) for clip in bank['clips']]
                if not args.existing_only:
                    bank['clips'] += list(clips.values())
            bank.update(bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())
            staged[gender] = target

        with publication_lock(out):
            current = json.loads(manifest_path.read_text())
            for gender in staged:
                if (current['animationLibraries'][gender] != initial['animationLibraries'][gender]
                        or digest(paths[gender]) != before[gender]):
                    raise ValueError(gender + ': another build changed this bank; no assets were published.')
            if any(digest(Path(path)) != value for path, value in sources.items()):
                raise ValueError('Authoring source changed before publication; no assets were published.')
            current['animationLibraries'] = manifest['animationLibraries']
            if not args.existing_only:
                overrides = json.loads(subprocess.check_output([
                    'node', '--input-type=module', '-e',
                    "import{ACTOR_ITEM_CLIP_OVERRIDES}from './game/actor-action-contract.js';"
                    "console.log(JSON.stringify(ACTOR_ITEM_CLIP_OVERRIDES));",
                ], cwd=contract_root, text=True))
                for item, binding in overrides.items():
                    current['equipment']['items'][item]['clipOverrides'] = binding

            # Calibration must succeed before destination banks or metadata
            # change. It only needs the native bodies and staged animation banks.
            calibration = scratch / 'calibration'
            calibration.mkdir()
            for gender, source in staged.items():
                shutil.copy2(source, calibration / paths[gender].name)
                appearance = next(entry for entry in current['appearances'].values()
                                  if entry['animationLibrary'] == gender)
                filename = Path(appearance['lods'][0]['url']).name
                shutil.copy2(out / filename, calibration / filename)
            (calibration / 'manifest.json').write_text(json.dumps(current, indent=2) + '\n')
            subprocess.run(['node', 'tools/characters-3d/compile-locomotion-profile.mjs',
                            '--directory', str(calibration)], cwd=ROOT, check=True)
            profile = json.loads((calibration / 'locomotion-profile.json').read_text())
            production = out == OUT.resolve()
            profile['source'] = 'web/public/models/characters/manifest.json' if production else str(manifest_path)
            profile_path = ROOT / 'web/lib/three/locomotion-profile.json' if production else out / 'locomotion-profile.json'
            for gender, source in staged.items():
                shutil.copy2(source, paths[gender].with_suffix('.glb.pending'))
            profile_pending = profile_path.with_suffix('.json.pending')
            profile_pending.write_text(json.dumps(profile, ensure_ascii=False, indent=2) + '\n')
            manifest_pending = manifest_path.with_suffix('.json.pending')
            manifest_pending.write_bytes((calibration / 'manifest.json').read_bytes())
            for path in paths.values():
                path.with_suffix('.glb.pending').replace(path)
            profile_pending.replace(profile_path)
            manifest_pending.replace(manifest_path)


if __name__ == '__main__':
    main()
