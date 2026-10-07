#!/usr/bin/env python3
"""Rebuild human appearances without replacing unrelated motion metadata.

python3 tools/characters-3d/build-appearance-increment.py
python3 tools/characters-3d/build-appearance-increment.py --preset granadero --lod 0
python3 tools/characters-3d/build-appearance-increment.py --directory /tmp/character-review-models

The default rebuilds all 24 body LODs and both owned-garment libraries. Selected
presets/LODs rebuild only those bodies; add --garments to rebuild owned clothes.
All workers finish in a temporary directory before any published asset changes.
"""
from pathlib import Path
import argparse
import concurrent.futures
import hashlib
import json
import shutil
import struct
import subprocess
import tempfile
from library_publication import publication_lock

ROOT = Path(__file__).resolve().parents[2]
HERE = ROOT / 'assets/source/characters-3d/authoring'
OUT = ROOT / 'web/public/models/characters'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def document(path):
    raw = path.read_bytes()
    return json.loads(raw[20:20 + struct.unpack_from('<I', raw, 12)[0]])


def native_signature(path):
    doc = document(path)
    raw = path.read_bytes()
    json_length = struct.unpack_from('<I', raw, 12)[0]
    binary = raw[28 + json_length:]
    nodes = doc['nodes']
    skin = doc['skins'][0]
    parents = {child: parent for parent, node in enumerate(nodes) for child in node.get('children', [])}
    accessor = doc['accessors'][skin['inverseBindMatrices']]
    assert accessor['type'] == 'MAT4' and accessor['componentType'] == 5126 and 'sparse' not in accessor
    view = doc['bufferViews'][accessor['bufferView']]
    assert view.get('buffer', 0) == 0 and accessor['count'] == len(skin['joints'])
    offset = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
    stride = view.get('byteStride', 64)
    signature = {}
    for number, index in enumerate(skin['joints']):
        hierarchy = []
        current = index
        seen = set()
        while current is not None:
            assert current not in seen, 'Cycle in native skeleton'
            seen.add(current)
            node = nodes[current]
            hierarchy.append({key: node.get(key) for key in ('name', 'translation', 'rotation', 'scale', 'matrix')})
            current = parents.get(current)
        signature[nodes[index]['name']] = {
            'hierarchy': hierarchy,
            'inverseBind': struct.unpack_from('<16f', binary, offset + number * stride),
        }
    return signature


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--preset', action='append')
    parser.add_argument('--lod', type=int, choices=(0, 1, 2), action='append')
    parser.add_argument('--garments', action='store_true')
    parser.add_argument('--jobs', type=int, default=2)
    parser.add_argument('--directory', type=Path, default=OUT,
                        help='Existing complete library to update; use a private copy for visual review.')
    parser.add_argument('--source-directory', type=Path, default=HERE,
                        help='Frozen authoring source for a private review build; defaults to current source.')
    parser.add_argument('--blender', default='/Applications/Blender.app/Contents/MacOS/Blender')
    args = parser.parse_args()
    out = args.directory.resolve()
    source_root = args.source_directory.resolve()
    if source_root != HERE.resolve() and out == OUT.resolve():
        raise ValueError('Build frozen sources into a private library; production must use current authoring source.')
    manifest_path = out / 'manifest.json'
    manifest = json.loads(manifest_path.read_text())
    if not manifest['complete']:
        raise ValueError('Build the complete library before using an appearance increment.')
    presets = list(dict.fromkeys(args.preset or manifest['appearances']))
    if any(preset not in manifest['appearances'] for preset in presets):
        raise ValueError('Unknown appearance preset.')
    jobs = [('appearance', preset, lod) for preset in presets for lod in sorted(set(args.lod or [0, 1, 2]))]
    if args.garments or not (args.preset or args.lod):
        jobs += [('garments', preset, 0) for preset in ('granadero', 'woman-scout')]
    before = {path.name: digest(path) for path in out.glob('*.glb')}
    sources = {str(path): digest(path) for path in source_root.glob('*.py')}
    sources.update({str(path): digest(path) for path in (source_root / 'vendor/makehuman').glob('skin-*.png')})
    with tempfile.TemporaryDirectory(prefix='granaderos-appearance-') as directory:
        scratch = Path(directory)

        def build(job):
            kind, preset, lod = job
            log = scratch / f'{kind}-{preset}-{lod}.log'
            command = [args.blender, '--background', '--factory-startup', '--python', str(source_root / 'build.py'), '--',
                       kind, '--preset', preset, '--lod', str(lod), '--output-dir', str(scratch), '--metadata-dir', str(scratch)]
            with log.open('w') as stream:
                result = subprocess.run(command, cwd=ROOT, stdout=stream, stderr=subprocess.STDOUT)
            content = log.read_text()
            if result.returncode or 'ASSET_READY' not in content:
                raise RuntimeError(content[-5000:])
            print(next(line for line in content.splitlines() if line.startswith('ASSET_READY')), flush=True)
            gender = manifest['appearances'][preset]['gender']
            name = f'{preset}-lod{lod}' if kind == 'appearance' else f'{gender}-garments'
            fact = json.loads((scratch / (name + '.json')).read_text())
            old, new = out / (name + '.glb'), scratch / (name + '.glb')
            if native_signature(old) != native_signature(new):
                raise ValueError(name + ': native skeleton changed; this is not an appearance-only increment.')
            if digest(new) != fact['sha256']:
                raise ValueError(name + ': generated file and metadata do not match.')
            return kind, preset, lod, name, fact

        with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, args.jobs)) as pool:
            records = list(pool.map(build, jobs))
        if any(digest(Path(path)) != value for path, value in sources.items()):
            raise ValueError('Authoring source changed during the build. Rerun after it is stable; no assets were published.')
        with publication_lock(out):
            # Read fresh metadata to retain independent motion/equipment increments.
            current = json.loads(manifest_path.read_text())
            for kind, preset, lod, name, fact in records:
                if digest(out / (name + '.glb')) != before[name + '.glb']:
                    raise ValueError(name + ': another build changed this asset; no assets were published.')
                if kind == 'appearance':
                    entry = current['appearances'][preset]
                    previous = next(level for level in entry['lods'] if level['lod'] == lod)
                    previous.update({key: fact[key] for key in ('url', 'triangles', 'bytes', 'drawCalls', 'sha256')})
                    # Socket metadata carries runtime annotations. Their transforms
                    # must remain identical; preserve those annotations verbatim.
                    for role, socket in fact['sockets'].items():
                        if any(entry['sockets'][role].get(key) != value for key, value in socket.items()):
                            raise ValueError(name + ': socket changed: ' + role)
            for source in (scratch / 'textures').glob('*'):
                target = out / 'textures' / source.name
                if target.exists() and digest(target) != digest(source):
                    raise ValueError('Content-addressed texture collision: ' + source.name)
                if not target.exists():
                    shutil.copy2(source, target)
            # Private review builds must not overwrite production build facts.
            metadata = HERE / '.build' if out == OUT.resolve() else out / '.build'
            metadata.mkdir(exist_ok=True)
            for _, _, _, name, _ in records:
                target = out / (name + '.glb')
                pending = target.with_suffix('.glb.pending')
                shutil.copy2(scratch / target.name, pending)
                pending.replace(target)
                shutil.copy2(scratch / (name + '.json'), metadata / (name + '.json'))
            pending = manifest_path.with_suffix('.json.pending')
            pending.write_text(json.dumps(current, indent=2) + '\n')
            pending.replace(manifest_path)
        print(json.dumps({'appearanceLODs': sum(record[0] == 'appearance' for record in records),
                          'garmentLibraries': sum(record[0] == 'garments' for record in records),
                          'animationLibraries': 'preserved', 'equipment': 'preserved', 'horse': 'preserved'}, indent=2))


if __name__ == '__main__':
    main()
