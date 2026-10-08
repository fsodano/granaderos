#!/usr/bin/env python3
"""Transplant only the reviewed standing blade thrust wrist/thumb rotations.

The small source donor contains exact native Float32 rotations, source pins
and clocks. The current bank supplies every other channel and all metadata.
Both banks must pass preservation checks before either output is installed.
"""
from pathlib import Path
from importlib.util import spec_from_file_location, module_from_spec
import argparse, base64, copy, hashlib, json, math, os, struct, subprocess, tempfile


def module(name, path):
    spec = spec_from_file_location(name, path)
    result = module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument('--receipt', type=Path)
    args = parser.parse_args()
    root = args.root.resolve()
    donor_path = root / 'assets/source/characters-3d/authoring/standing_blade_wrist_donor.json'
    source_hash = hashlib.sha256(donor_path.read_bytes()).hexdigest()
    donor = json.loads(donor_path.read_text())
    assert donor['version'] == 1
    names, bones = set(donor['clipNames']), set(donor['rotationBones'])
    assert names == {'stand.slash.blade.thrust'}
    assert bones == {'upperarm_r', 'lowerarm_r', 'hand_r', 'thumb_01_r', 'thumb_02_r', 'thumb_03_r'}
    merger = module('blade_wrist_glb', root / 'tools/characters-3d/merge-animation-bank.py')
    decoded = module('blade_wrist_channels', root / 'tools/characters-3d/build-gesture-support.py')
    out = root / 'web/public/models/characters'
    manifest_path = out / 'manifest.json'
    assert not manifest_path.is_symlink()
    original_manifest_bytes = manifest_path.read_bytes()
    manifest = json.loads(original_manifest_bytes)
    original_manifest = copy.deepcopy(manifest)
    pending, receipt = [], {}
    for anatomy in ('male', 'female'):
        bank = manifest['animationLibraries'][anatomy]
        path = out / Path(bank['url']).name
        assert not path.is_symlink()
        original_hash = hashlib.sha256(path.read_bytes()).hexdigest()
        assert original_hash == bank['sha256'], 'Current bank does not match its manifest'
        before, data = merger.read_glb(path)
        after, binary = copy.deepcopy(before), bytearray(data)
        node_defs = {node['name']: node for node in before['nodes'] if 'name' in node}
        source = donor['banks'][anatomy]
        assert set(source['clips']) == names
        assert len(source['nativeSkeletonRest']) == 53, 'Incomplete native donor rig'
        for name, rest in source['nativeSkeletonRest'].items():
            assert name in node_defs, 'Missing native donor bone: ' + name
            assert {key: node_defs[name][key] for key in ('translation', 'rotation', 'scale', 'matrix') if key in node_defs[name]} == rest, 'Incompatible native donor bind: ' + name
        clips = {clip['name']: clip for clip in after['animations']}
        metadata = {clip['name']: clip for clip in bank['clips']}
        assert names <= set(clips) and names <= set(metadata)
        old_tracks = decoded.channels(before, data)
        for name in sorted(names):
            spec, source_clip = metadata[name], source['clips'][name]
            assert 'nativeBladeWrist' not in spec, 'Refuse to apply the donor twice'
            assert spec['duration'] == source_clip['duration'] and spec['markers'] == source_clip['markers'], 'Native duration or contact clock changed'
            assert set(source_clip['tracks']) == bones
            animation = clips[name]
            applied = set()
            for channel in animation['channels']:
                target = channel['target']
                bone = after['nodes'][target['node']]['name']
                if target['path'] != 'rotation' or bone not in bones:
                    continue
                assert bone not in applied, 'Duplicate native target'
                source_track = source_clip['tracks'][bone]
                interpolation, clock, old_values = old_tracks[name][(bone, 'rotation')]
                assert interpolation == 'LINEAR'
                assert clock[0] == {'componentType': 5126, 'type': 'SCALAR'}
                assert old_values[0] == {'componentType': 5126, 'type': 'VEC4'}
                source_clock = base64.b64decode(source_track['inputFloat32LE'], validate=True)
                output = base64.b64decode(source_track['outputQuaternionFloat32LE'], validate=True)
                assert clock[1] == source_clock, 'Donor cannot retime a retained native channel'
                assert len(output) == len(old_values[1]) == len(source_clock) * 4
                times = struct.unpack('<' + 'f' * (len(source_clock) // 4), source_clock)
                assert all(math.isfinite(t) for t in times) and all(a < b for a, b in zip(times, times[1:]))
                for quaternion in struct.iter_unpack('<4f', output):
                    assert all(math.isfinite(value) for value in quaternion)
                    assert abs(sum(value * value for value in quaternion) - 1) < 1e-5
                binary.extend(b'\0' * (-len(binary) % 4))
                view = len(after['bufferViews'])
                after['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(output)})
                binary.extend(output)
                accessor = len(after['accessors'])
                after['accessors'].append({'bufferView': view, 'componentType': 5126, 'count': len(times), 'type': 'VEC4'})
                sampler = copy.deepcopy(animation['samplers'][channel['sampler']])
                sampler['output'] = accessor
                sampler.setdefault('extras', {})['nativeBladeWristBeforeSampler'] = channel['sampler']
                channel['sampler'] = len(animation['samplers'])
                animation['samplers'].append(sampler)
                applied.add(bone)
            assert applied == bones, 'Missing bounded donor channels'
            spec['nativeBladeWrist'] = {'method': 'reviewed-six-native-rotation-donor', 'sourceSha256': source_hash, 'sourceCommit': donor['sourceCommit'], 'sourceBankSha256': source['sourceBankSha256'], 'bones': donor['rotationBones'], 'preservedNativeClocksAndOtherChannels': True}
        after['buffers'][0]['byteLength'] = len(binary)
        new_tracks = decoded.channels(after, binary)
        assert list(old_tracks) == list(new_tracks), 'Native clip inventory or order changed'
        changed = []
        for name, tracks in old_tracks.items():
            assert set(tracks) == set(new_tracks[name])
            for key, values in tracks.items():
                replacement = new_tracks[name][key]
                if name in names and key[0] in bones and key[1] == 'rotation':
                    assert values[:2] == replacement[:2], 'Retained native clock changed'
                    assert values != replacement, 'Expected a measured donor correction'
                    changed.append([name, *key])
                else:
                    assert values == replacement, 'Unrelated native channel changed: ' + str((name, key))
        assert len(changed) == 6
        assert bytes(binary[:len(data)]) == bytes(data), 'Original binary prefix changed'
        for key in before:
            if key not in ('animations', 'accessors', 'bufferViews', 'buffers'):
                assert before[key] == after[key], 'Retained native asset section changed: ' + key
        with tempfile.NamedTemporaryFile(prefix='.standing-blade-wrists-' + anatomy + '-', dir=out, delete=False) as opened:
            temporary = Path(opened.name)
        try:
            merger.write_glb(temporary, after, binary)
            raw = temporary.read_bytes()
        finally:
            temporary.unlink(missing_ok=True)
        bank['sha256'], bank['bytes'] = hashlib.sha256(raw).hexdigest(), len(raw)
        receipt[anatomy] = {'beforeSha256': original_hash, 'sha256': bank['sha256'], 'clips': len(old_tracks), 'changedRotationChannels': changed, 'nativeClockInputsExact': True, 'allOtherChannelsExact': True, 'nativeRigMeshSkinAndPrefixExact': True, 'donorSha256': source_hash}
        pending.append((path, raw, original_hash))
    for key, value in original_manifest.items():
        if key != 'animationLibraries':
            assert manifest[key] == value, 'Unrelated manifest record changed'
    for anatomy, original in original_manifest['animationLibraries'].items():
        restored = copy.deepcopy(manifest['animationLibraries'][anatomy])
        restored['sha256'], restored['bytes'] = original['sha256'], original['bytes']
        for clip in restored['clips']:
            if clip['name'] in names:
                clip.pop('nativeBladeWrist', None)
        assert restored == original, 'Retained animation metadata changed'
    canonical = subprocess.run(['node', '-e', 'let s="";process.stdin.on("data",c=>s+=c);process.stdin.on("end",()=>process.stdout.write(JSON.stringify(JSON.parse(s),null,2)+"\\n"));'], input=json.dumps(manifest, allow_nan=False), text=True, capture_output=True, check=True).stdout
    assert not manifest_path.is_symlink() and manifest_path.read_bytes() == original_manifest_bytes, 'Concurrent manifest change'
    for path, raw, expected in pending:
        assert not path.is_symlink() and hashlib.sha256(path.read_bytes()).hexdigest() == expected, 'Concurrent bank change: ' + path.name
    # Validate both complete outputs before installing any. Atomic file replace
    # prevents readers from observing a partial GLB; this is not a transaction
    # over the whole library if a later filesystem operation itself fails.
    for path, raw in [(path, raw) for path, raw, _ in pending] + [(manifest_path, canonical.encode())]:
        with tempfile.NamedTemporaryFile(prefix='.' + path.name + '-', dir=out, delete=False) as opened:
            temporary = Path(opened.name)
            try:
                opened.write(raw)
                opened.flush()
            except BaseException:
                temporary.unlink(missing_ok=True)
                raise
        try:
            os.chmod(temporary, path.stat().st_mode & 0o777)
            os.replace(temporary, path)
        finally:
            temporary.unlink(missing_ok=True)
    if args.receipt:
        args.receipt.write_text(json.dumps(receipt, indent=2) + '\n')
    print('NATIVE_STANDING_BLADE_WRISTS_READY', json.dumps({anatomy: {'clips': row['clips'], 'changedRotationChannels': len(row['changedRotationChannels']), 'sha256': row['sha256']} for anatomy, row in receipt.items()}), flush=True)


if __name__ == '__main__':
    main()
