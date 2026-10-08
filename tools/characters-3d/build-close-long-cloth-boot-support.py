#!/usr/bin/env python3
"""Add a separate close-LOD boot-clearance shape for fixed prone poses.

Keep the existing rest mesh, rig, cloth targets and crawling source exact.
Prepare both bodies before writing; reject stale or concurrently changed inputs.
"""
from pathlib import Path
import argparse, copy, json, math, struct, subprocess, tempfile
import importlib.util


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


def without_clearance(doc, mesh_index):
    result = copy.deepcopy(doc)
    mesh = result['meshes'][mesh_index]
    assert mesh['extras']['targetNames'].pop() == 'cloth_prone_boot_clearance'
    del mesh['extras']['nativeClothBootSupport']
    assert mesh['weights'].pop() == 0
    for primitive in mesh['primitives']:
        primitive['targets'].pop()
    for node in result['nodes']:
        if node.get('mesh') == mesh_index and 'weights' in node:
            assert node['weights'].pop() == 0
    return result


def append_sparse(doc, binary, values):
    assert len(values) % 3 == 0 and all(math.isfinite(v) for v in values)
    rows = [tuple(values[i:i + 3]) for i in range(0, len(values), 3)]
    selected = [i for i, row in enumerate(rows) if any(row)]
    assert selected, 'Empty boot-clearance target'
    component, fmt = (5123, 'H') if len(rows) <= 65536 else (5125, 'I')
    index_bytes = struct.pack('<' + fmt * len(selected), *selected)
    value_bytes = struct.pack('<' + 'f' * len(selected) * 3,
                              *(v for i in selected for v in rows[i]))
    views = []
    for raw in (index_bytes, value_bytes):
        binary += b'\0' * (-len(binary) % 4)
        views.append(len(doc['bufferViews']))
        doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary),
                                   'byteLength': len(raw)})
        binary += raw
    index = len(doc['accessors'])
    doc['accessors'].append({
        'componentType': 5126, 'count': len(rows), 'type': 'VEC3',
        'min': [min(row[j] for row in rows) for j in range(3)],
        'max': [max(row[j] for row in rows) for j in range(3)],
        'sparse': {'count': len(selected),
                   'indices': {'bufferView': views[0], 'componentType': component},
                   'values': {'bufferView': views[1]}}})
    return binary, index


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument('--receipt', type=Path)
    args = parser.parse_args()
    root = args.root.resolve()
    cloth = module('native_cloth_proof', root / 'tools/characters-3d/build-long-cloth-support.py')
    merge = module('boot_cloth_merge', root / 'tools/characters-3d/merge-animation-bank.py')
    pack = module('boot_cloth_pack', root / 'assets/source/characters-3d/authoring/gltf_pack.py')
    assets = root / 'web/public/models/characters'
    manifest_path = assets / 'manifest.json'
    manifest_before = manifest_path.read_bytes()
    manifest = json.loads(manifest_before)
    bank_pins = {assets / Path(bank['url']).name: bank['sha256']
                 for bank in manifest['animationLibraries'].values()}
    assert all(cloth.digest(path.read_bytes()) == pin for path, pin in bank_pins.items())
    pending, receipts = [], []
    with tempfile.TemporaryDirectory(prefix='granaderos-close-cloth-') as folder:
        proposal = Path(folder) / 'proposal.json'
        subprocess.run(['node', str(root / 'tools/characters-3d/fit-close-long-cloth-boot-support.mjs'),
                        str(proposal)], cwd=root, check=True)
        rows = json.loads(proposal.read_text())
        assert {(row['id'], row['lod']) for row in rows} == {('friar', 0), ('woman-shawl', 0)}
        for row in rows:
            record = manifest['appearances'][row['id']]['lods'][row['lod']]
            path = assets / Path(row['url']).name
            original = path.read_bytes()
            assert cloth.digest(original) == record['sha256'] == row['sha256']
            if row.get('unchanged'):
                receipts.append(row)
                continue
            assert row['remainingPairs'] == 0 and row['maximumDisplacement'] <= .125
            assert row['maximumShapeOffset'] < .15 and row['clips']
            doc, binary = merge.read_glb(path)
            mesh_index = next(n['mesh'] for n in doc['nodes'] if n.get('name') == row['mesh'])
            baseline = cloth.proof(doc, binary, -1)
            mesh = doc['meshes'][mesh_index]
            assert mesh['extras']['targetNames'] == ['cloth_crouched', 'cloth_prone']
            assert len(mesh['primitives']) == 1 and mesh['weights'] == [0, 0]
            primitive = mesh['primitives'][0]
            count = doc['accessors'][primitive['attributes']['POSITION']]['count']
            target = {}
            for semantic, key, permitted in [('POSITION', 'position', set(row['changed'])),
                                              ('NORMAL', 'normal', set(row['normalVertices']))]:
                values = row[key]
                assert len(values) == count * 3
                assert all(not any(values[i * 3:i * 3 + 3]) for i in range(count) if i not in permitted)
                binary, target[semantic] = append_sparse(doc, binary, values)
            support = {'method': 'additive-fixed-prone-boot-clearance',
                       'sourcePoseHash': row['sourcePoseHash'], 'clipSetHash': row['clipSetHash'],
                       'clips': row['clips'], 'retainedOriginalClothTargetsAndRig': True}
            primitive['targets'].append(target)
            mesh['extras']['targetNames'].append('cloth_prone_boot_clearance')
            mesh['extras']['nativeClothBootSupport'] = support
            mesh['weights'].append(0)
            for node in doc['nodes']:
                if node.get('mesh') == mesh_index and 'weights' in node:
                    node['weights'].append(0)
            doc['buffers'][0]['byteLength'] = len(binary)
            candidate = Path(folder) / path.name
            merge.write_glb(candidate, doc, binary)
            raw, _ = pack.pack(candidate, {})
            after, after_binary = merge.read_glb(candidate)
            assert cloth.proof(without_clearance(after, mesh_index), after_binary, -1) == baseline, \
                'Existing rest mesh, morph, rig, textures or animations changed'
            record.update(bytes=len(raw), sha256=cloth.digest(raw), nativeClothBootSupport=support)
            pending.append((path, raw, cloth.digest(original)))
            receipts.append({k: v for k, v in row.items() if k not in ('position', 'normal', 'clips')})
            receipts[-1].update(sha256=record['sha256'], bytes=record['bytes'], byteGrowth=len(raw) - len(original))
        assert manifest_path.read_bytes() == manifest_before, 'Concurrent manifest change'
        assert all(cloth.digest(path.read_bytes()) == pin for path, pin in bank_pins.items()), 'Concurrent bank change'
        assert all(cloth.digest(path.read_bytes()) == pin for path, _, pin in pending), 'Concurrent body change'
        canonical = subprocess.check_output(['node', '-e',
            "let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',v=>s+=v);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(JSON.parse(s),null,2)+'\\n'));"],
            input=json.dumps(manifest), text=True)
        for path, raw, _ in pending:
            path.write_bytes(raw)
        if pending:
            manifest_path.write_text(canonical)
    if args.receipt:
        args.receipt.write_text(json.dumps(receipts, indent=2) + '\n')
    print('CLOSE_LONG_CLOTH_BOOT_SUPPORT_READY', len(pending), 'bodies; existing decoded source exact')


if __name__ == '__main__':
    main()
