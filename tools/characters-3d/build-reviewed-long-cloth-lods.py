#!/usr/bin/env python3
"""Reuse reviewed close cloth at coarse body LODs; keep other meshes and rig exact.

The donor preserves authored sewn topology and its existing two cloth shapes.
Only the coarsest shawl receives a measured fixed-prone native-trouser tuck.
Stage all four bodies, prove their source boundaries, then write atomically.
"""
from pathlib import Path
import argparse, copy, hashlib, importlib.util, json, subprocess, tempfile


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument('--receipt', type=Path)
    args = parser.parse_args()
    root = args.root.resolve()
    proof = module('cloth_topology_proof', root / 'tools/characters-3d/build-long-cloth-support.py')
    merge = module('cloth_topology_merge', root / 'tools/characters-3d/merge-animation-bank.py')
    sparse = module('cloth_topology_sparse', root / 'tools/characters-3d/build-close-long-cloth-boot-support.py')
    pack = module('cloth_topology_pack', root / 'assets/source/characters-3d/authoring/gltf_pack.py')
    assets = root / 'web/public/models/characters'
    manifest_path = assets / 'manifest.json'
    manifest_before = manifest_path.read_bytes()
    manifest = json.loads(manifest_before)
    pending, receipts = [], []
    with tempfile.TemporaryDirectory(prefix='granaderos-reviewed-cloth-') as folder:
        proposal_path = Path(folder) / 'proposal.json'
        subprocess.run(['node', str(root / 'tools/characters-3d/fit-reviewed-long-cloth-lods.mjs'), str(proposal_path)], cwd=root, check=True)
        proposal = json.loads(proposal_path.read_text())
        rows = proposal['rows']
        assert {(r['id'], r['lod']) for r in rows} == {(p, l) for p in ('friar', 'woman-shawl') for l in (1, 2)}
        source_pins = {root / ('web/public/.' + url): pin for url, pin in proposal['sourcePins'].items()}
        assert all(digest(path.read_bytes()) == pin for path, pin in source_pins.items())
        for row in rows:
            assert row['maximumNativeOffsetLength'] < .15 and row['maximumExtraWorldDisplacement'] <= .005
            assert row['checks'] and all(c['pairs'] == 0 for c in row['checks'])
            path = assets / Path(row['url']).name
            donor_path = assets / Path(row['donorUrl']).name
            original = path.read_bytes()
            assert digest(original) == row['sha256']
            assert digest(donor_path.read_bytes()) == row['donorSha256']
            doc, binary = merge.read_glb(path)
            donor, data = merge.read_glb(donor_path)
            mesh_index = next(n['mesh'] for n in doc['nodes'] if n.get('name') == row['mesh'])
            donor_name = row['mesh'].rsplit('LOD', 1)[0] + 'LOD0'
            donor_index = next(n['mesh'] for n in donor['nodes'] if n.get('name') == donor_name)
            before = proof.proof(doc, binary, -1)
            material_count, image_count = len(doc.get('materials', [])), len(doc.get('images', []))
            texture_count, sampler_count = len(doc.get('textures', [])), len(doc.get('samplers', []))
            donor_mesh = donor['meshes'][donor_index]
            assert donor_mesh['extras']['targetNames'] == ['cloth_crouched', 'cloth_prone', 'cloth_prone_boot_clearance']
            assert len(donor_mesh['primitives']) == len(doc['meshes'][mesh_index]['primitives']) == 1
            # Joint order and native bind transforms must be exact before copying
            # the donor's four-influence attributes onto the recipient rig.
            node = next(n for n in doc['nodes'] if n.get('mesh') == mesh_index)
            donor_node = next(n for n in donor['nodes'] if n.get('mesh') == donor_index)
            skin, donor_skin = doc['skins'][node['skin']], donor['skins'][donor_node['skin']]
            assert [doc['nodes'][i]['name'] for i in skin['joints']] == [donor['nodes'][i]['name'] for i in donor_skin['joints']]
            assert proof.decoded(doc, binary, skin['inverseBindMatrices']) == proof.decoded(donor, data, donor_skin['inverseBindMatrices'])
            views, accessors, materials, textures, images, samplers = {}, {}, {}, {}, {}, {}

            def view(index):
                if index not in views:
                    source = donor['bufferViews'][index]
                    assert source.get('buffer', 0) == 0
                    raw = data[source.get('byteOffset', 0):source.get('byteOffset', 0) + source['byteLength']]
                    binary.extend(b'\0' * (-len(binary) % 4))
                    result = copy.deepcopy(source)
                    result.update(buffer=0, byteOffset=len(binary))
                    binary.extend(raw)
                    views[index] = len(doc.setdefault('bufferViews', []))
                    doc['bufferViews'].append(result)
                return views[index]

            def accessor(index):
                if index not in accessors:
                    result = copy.deepcopy(donor['accessors'][index])
                    if 'bufferView' in result:
                        result['bufferView'] = view(result['bufferView'])
                    for value in result.get('sparse', {}).values():
                        if isinstance(value, dict) and 'bufferView' in value:
                            value['bufferView'] = view(value['bufferView'])
                    accessors[index] = len(doc.setdefault('accessors', []))
                    doc['accessors'].append(result)
                return accessors[index]

            def matched(collection, value):
                items = doc.setdefault(collection, [])
                if value in items:
                    return items.index(value)
                items.append(value)
                return len(items) - 1

            def sampler(index):
                if index not in samplers:
                    samplers[index] = matched('samplers', copy.deepcopy(donor['samplers'][index]))
                return samplers[index]

            def image(index):
                if index not in images:
                    value = copy.deepcopy(donor['images'][index])
                    if 'bufferView' in value:
                        value['bufferView'] = view(value['bufferView'])
                    if 'uri' in value:
                        assert (donor_path.parent / value['uri']).is_file(), 'Missing reviewed cloth texture'
                    images[index] = matched('images', value)
                return images[index]

            def texture(index):
                if index not in textures:
                    value = copy.deepcopy(donor['textures'][index])
                    if 'source' in value:
                        value['source'] = image(value['source'])
                    if 'sampler' in value:
                        value['sampler'] = sampler(value['sampler'])
                    textures[index] = matched('textures', value)
                return textures[index]

            def material(index):
                if index not in materials:
                    value = copy.deepcopy(donor['materials'][index])
                    def links(obj):
                        if isinstance(obj, dict):
                            for key, child in obj.items():
                                if key.endswith('Texture') and isinstance(child, dict) and 'index' in child:
                                    child['index'] = texture(child['index'])
                                else:
                                    links(child)
                        elif isinstance(obj, list):
                            for child in obj:
                                links(child)
                    links(value)
                    materials[index] = matched('materials', value)
                return materials[index]

            replacement = copy.deepcopy(donor_mesh)
            replacement['name'] = doc['meshes'][mesh_index].get('name', row['mesh'])
            topology = {'method': 'reviewed-close-garment-topology', 'sourceUrl': row['donorUrl'],
                        'sourceSha256': row['donorSha256'], 'retainedOtherCoarseMeshesAndRig': True,
                        'maximumExtraWorldDisplacement': row['maximumExtraWorldDisplacement']}
            replacement.setdefault('extras', {})['nativeClothTopology'] = topology
            primitive = replacement['primitives'][0]
            primitive['attributes'] = {key: accessor(value) for key, value in primitive['attributes'].items()}
            primitive['indices'] = accessor(primitive['indices'])
            primitive['material'] = material(primitive['material'])
            if 'nativeSkirtHem' in donor_mesh.get('extras', {}):
                # A fresh coarse body lacks this inactive UV0 palette material.
                # Keep its reviewed colour resource for the following palette
                # guard while the active hem continues to use TEXCOORD_1.
                retained = [i for i, value in enumerate(donor['materials'])
                            if value.get('name') == 'Apparel_Atlas_Charcoal_Legwear']
                assert len(retained) == 1, 'Missing retained donor palette material'
                material(retained[0])
            primitive['targets'] = [{key: accessor(value) for key, value in target.items()} for target in primitive['targets']]
            if row['changed']:
                for semantic, key in (('POSITION', 'position'), ('NORMAL', 'normal')):
                    binary, index = sparse.append_sparse(doc, binary, row[key])
                    primitive['targets'][2][semantic] = index
            doc['meshes'][mesh_index] = replacement
            for current_node in doc['nodes']:
                if current_node.get('mesh') == mesh_index and 'weights' in current_node:
                    current_node['weights'] = [0, 0, 0]
            candidate = Path(folder) / path.name
            merge.write_glb(candidate, doc, binary)
            raw, _ = pack.pack(candidate, {})
            after, after_binary = merge.read_glb(candidate)
            after_proof = proof.proof(after, after_binary, -1)
            # New atlas records may be appended for LOD2. Every existing material,
            # image, sampler and texture remains exact for the other coarse parts.
            for key, count in (('materials', material_count), ('images', image_count), ('textures', texture_count), ('samplers', sampler_count)):
                assert after_proof.get(key, [])[:count] == before.get(key, [])
                after_proof[key] = after_proof.get(key, [])[:count]
            after_proof['meshes'][mesh_index] = before['meshes'][mesh_index]
            for n, old in zip(after_proof['nodes'], before['nodes']):
                if n.get('mesh') == mesh_index and 'weights' in old:
                    n['weights'] = old['weights']
            assert after_proof == before, 'A different coarse mesh, native rig, material, node or animation changed'
            authored = after['meshes'][mesh_index]['primitives'][0]
            for semantic, source_index in donor_mesh['primitives'][0]['attributes'].items():
                assert proof.decoded(after, after_binary, authored['attributes'][semantic]) == proof.decoded(donor, data, source_index)
            assert proof.decoded(after, after_binary, authored['indices']) == proof.decoded(donor, data, donor_mesh['primitives'][0]['indices'])
            for target in range(2):
                for semantic, source_index in donor_mesh['primitives'][0]['targets'][target].items():
                    assert proof.decoded(after, after_binary, authored['targets'][target][semantic]) == proof.decoded(donor, data, source_index), 'Existing reviewed cloth target changed'
            record = manifest['appearances'][row['id']]['lods'][row['lod']]
            old_triangles = record['triangles']
            triangles = sum(after['accessors'][p['indices']]['count'] // 3 for mesh in after['meshes'] for p in mesh['primitives'])
            record.update(bytes=len(raw), sha256=digest(raw), triangles=triangles,
                          nativeClothSupport=copy.deepcopy(manifest['appearances'][row['id']]['lods'][0]['nativeClothSupport']),
                          nativeClothBootSupport=row['support'], nativeClothTopology=topology)
            if 'nativeSkirtHem' in donor_mesh.get('extras', {}):
                record['nativeSkirtHem'] = copy.deepcopy(donor_mesh['extras']['nativeSkirtHem'])
            else:
                record.pop('nativeSkirtHem', None)
            pending.append((path, raw))
            receipts.append({key: row[key] for key in ('id', 'lod', 'url', 'sha256', 'donorUrl', 'donorSha256', 'oldCounts', 'newCounts', 'maximumExtraWorldDisplacement', 'maximumExtraNativeOffsetLength', 'maximumNativeOffsetLength', 'maximumNativeOffsetComponent')})
            receipts[-1].update(nextSha256=record['sha256'], bytes=len(raw), byteGrowth=len(raw)-len(original),
                                oldBodyTriangles=old_triangles, nextBodyTriangles=triangles,
                                addedMaterials=len(after.get('materials', []))-material_count,
                                addedImages=len(after.get('images', []))-image_count,
                                changedVertices=len(row['changed']), checks=len(row['checks']))
        assert manifest_path.read_bytes() == manifest_before, 'Concurrent manifest change'
        assert all(digest(path.read_bytes()) == pin for path, pin in source_pins.items()), 'Concurrent source change'
        canonical = subprocess.check_output(['node', '-e', "let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',v=>s+=v);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(JSON.parse(s),null,2)+'\\n'));"], input=json.dumps(manifest), text=True)
        for path, raw in pending:
            path.write_bytes(raw)
        manifest_path.write_text(canonical)
    if args.receipt:
        args.receipt.write_text(json.dumps({'sourcePins': proposal['sourcePins'], 'records': receipts}, indent=2)+'\n')
    print('REVIEWED_CLOTH_LODS_READY', len(pending), 'bodies; other native decoded source exact')


if __name__ == '__main__':
    main()
