#!/usr/bin/env python3
"""Append verified cloth form colours for the six non-pilot appearances.

The original GLB is recoverable exactly. All binary payloads are retained as
a prefix; only garment COLOR_0, owned colour resources, and coarse cloth donor
identity links may change. --verify-only checks completed records without writes.
"""
from pathlib import Path
import argparse, copy, hashlib, importlib.util, io, json, math, struct, subprocess, tempfile
from PIL import Image

FIELD = 'familyClothDepth'


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    value = importlib.util.module_from_spec(spec); spec.loader.exec_module(value)
    return value


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def json_sha(doc):
    encoded = subprocess.check_output(['node', '-e', "let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',v=>s+=v);function stable(v){if(Array.isArray(v))return v.map(stable);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));return v;}process.stdin.on('end',()=>process.stdout.write(JSON.stringify(stable(JSON.parse(s)))));"], input=json.dumps(doc), text=True)
    return sha(encoded.encode())


def path_value(doc, path):
    for key in path: doc = doc[key]
    return doc


def set_path(doc, path, value):
    parent = path_value(doc, path[:-1]); parent[path[-1]] = value


def restore_record(record):
    return copy.deepcopy(record[FIELD]['originalRecord'])


def restore_body(doc, binary, metadata):
    restored = copy.deepcopy(doc)
    for item in metadata['primitives']:
        primitive = restored['meshes'][item['mesh']]['primitives'][item['primitive']]
        primitive['attributes']['COLOR_0'] = item['originalColourAccessor']
        primitive['material'] = item['originalMaterial']
    for patch in metadata['documentPatches']:
        assert path_value(restored, patch['path']) == patch['after'], 'Completed donor identity changed'
        set_path(restored, patch['path'], patch['before'])
    for key, field in [('accessors', 'originalAccessorCount'), ('bufferViews', 'originalViewCount'),
                       ('materials', 'originalMaterialCount'), ('textures', 'originalTextureCount'), ('images', 'originalImageCount')]:
        restored[key] = restored[key][:metadata[field]]
    restored['buffers'] = copy.deepcopy(metadata['originalBuffers'])
    assert restored['extras'].pop(FIELD) == metadata, 'Inconsistent family cloth receipt'
    if not metadata['originalHadExtras']: del restored['extras']
    original_binary = bytes(binary[:metadata['originalBinaryBytes']])
    assert sha(original_binary) == metadata['originalBinarySha256'], 'Retained native binary changed'
    assert json_sha(restored) == metadata['originalJSONSha256'], 'Retained native JSON changed'
    return restored, original_binary


def recipe_for(root):
    path = root / 'assets/source/characters-3d/authoring/family_cloth_depth.py'
    source = module('family_cloth_recipe', path)
    return source, {'method': 'family-rest-space-cloth-fold-colours-v1',
                    'source': str(path.relative_to(root)), 'sourceSha256': sha(path.read_bytes()),
                    'installerSha256': sha((root / 'tools/characters-3d/build-family-cloth-depth.py').read_bytes()),
                    'factorBounds': [source.MIN_FACTOR, source.MAX_FACTOR], 'albedoHeadroom': source.HEADROOM,
                    'retainedGeometryRigClipsMaps': True, 'hemProtection': 'UV1-stripe-crossing-triangles-plus-adjacent-ring'}


def prepare(root, presets=None, completed_only=False, allow_stale_donor=False):
    source, recipe = recipe_for(root)
    base = module('family_cloth_attributes', root / 'tools/characters-3d/build-cloth-depth.py')
    merge = module('family_cloth_glb', root / 'tools/characters-3d/merge-animation-bank.py')
    presets = list(presets or source.PRESETS)
    assert len(presets) == len(set(presets)) and set(presets) <= set(source.PRESETS), 'Unknown or duplicate family preset'
    assets = root / 'web/public/models/characters'; mp = assets / 'manifest.json'
    manifest_bytes = mp.read_bytes(); manifest = json.loads(manifest_bytes); old_manifest = copy.deepcopy(manifest)
    pending, textures, pins, rows = [], {}, {}, []
    for preset in presets:
        donor_hash = None
        for record in sorted(manifest['appearances'][preset]['lods'], key=lambda value: value['lod']):
            lod = record['lod']; path = assets / Path(record['url']).name; raw = path.read_bytes()
            pins[path] = sha(raw); assert pins[path] == record['sha256'], 'Released body differs from manifest: ' + path.name
            doc, binary = merge.read_glb(path); before = copy.deepcopy(doc); old_binary = bytes(binary)
            repeat = FIELD in record
            if not repeat and completed_only:
                assert FIELD not in doc.get('extras', {}), 'Ambiguous family cloth state'
                if not lod: donor_hash = pins[path]
                continue
            if repeat:
                meta = record[FIELD]
                assert meta['recipe'] == recipe, 'Changed family cloth recipe; rebuild source before applying it'
                assert doc.get('extras', {}).get(FIELD) == meta, 'Inconsistent completed family cloth metadata'
                for uri, digest in meta['originalImages'].items():
                    image_path = assets / uri; pins[image_path] = sha(image_path.read_bytes())
                    assert pins[image_path] == digest, 'Retained source texture changed'
            else:
                assert FIELD not in doc.get('extras', {}), 'Ambiguous family cloth state'
                original_images = {}
                for image in doc['images']:
                    uri = image.get('uri')
                    if uri and not uri.startswith('data:'):
                        image_path = assets / uri; pins[image_path] = sha(image_path.read_bytes()); original_images[uri] = pins[image_path]
                meta = {'recipe': recipe, 'beforeSha256': pins[path], 'originalRecord': copy.deepcopy(record),
                        'originalJSONSha256': json_sha(before), 'originalBinarySha256': sha(old_binary),
                        'originalBinaryBytes': len(old_binary), 'originalBuffers': copy.deepcopy(doc['buffers']),
                        'originalAccessorCount': len(doc['accessors']), 'originalViewCount': len(doc['bufferViews']),
                        'originalMaterialCount': len(doc['materials']), 'originalTextureCount': len(doc['textures']),
                        'originalImageCount': len(doc['images']), 'originalImages': original_images,
                        'originalHadExtras': 'extras' in doc, 'primitives': [], 'documentPatches': []}
            changed_vertices = 0
            for part in ('outfit', 'legwear'):
                matches = [n['mesh'] for n in doc['nodes'] if n.get('name') == f'Human_{part}_LOD{lod}']
                assert len(matches) == 1, 'Missing or duplicate family cloth mesh'
                mesh_index = matches[0]; mesh = doc['meshes'][mesh_index]
                for pi, primitive in enumerate(mesh['primitives']):
                    retained = next((r for r in meta['primitives'] if r['mesh'] == mesh_index and r['primitive'] == pi), None)
                    assert bool(retained) == repeat
                    material_index = retained['originalMaterial'] if repeat else primitive['material']
                    material = doc['materials'][material_index]
                    expected_name = 'Apparel_Atlas_Charcoal_Legwear_Rust_Hem' if preset == 'woman-shawl' and part == 'legwear' else 'Apparel_Atlas'
                    assert material['name'] == expected_name, 'Unexpected family cloth material'
                    old_accessor = retained['originalColourAccessor'] if repeat else primitive['attributes']['COLOR_0']
                    colours_before = base.values(doc, binary, old_accessor)
                    positions = base.values(doc, binary, primitive['attributes']['POSITION'])
                    texture = material['pbrMetallicRoughness']['baseColorTexture']; channel = texture.get('texCoord', 0)
                    assert channel == (1 if preset == 'woman-shawl' and part == 'legwear' else 0)
                    uvs = base.values(doc, binary, primitive['attributes'][f'TEXCOORD_{channel}'])
                    image_record = doc['images'][doc['textures'][texture['index']]['source']]
                    image_path = assets / image_record['uri']; pins[image_path] = sha(image_path.read_bytes())
                    pixels = Image.open(image_path).convert('RGB')
                    assert len(colours_before) == len(positions) == len(uvs)
                    accessor = doc['accessors'][primitive['indices']]; view = doc['bufferViews'][accessor['bufferView']]
                    fmt = {5123: 'H', 5125: 'I'}[accessor['componentType']]; size = struct.calcsize(fmt)
                    assert accessor['type'] == 'SCALAR' and 'sparse' not in accessor
                    indices = [struct.unpack_from('<' + fmt, binary, view.get('byteOffset', 0) + accessor.get('byteOffset', 0) + i * view.get('byteStride', size))[0] for i in range(accessor['count'])]
                    drape, protected = source.selections(preset, part, positions, indices, uvs, mesh.get('extras', {}).get('nativeSkirtHem'))
                    selection = {'drapeVertexCount': len(drape), 'protectedVertexCount': len(protected),
                                 'protectedMaskSha256': sha(json.dumps(sorted(protected), separators=(',', ':')).encode())}
                    old_pixels = list(pixels.getdata()); new_pixels = [source.headroom_pigment(p, preset, part) for p in old_pixels]
                    colour_uri, colour_sha, next_material = None, None, material_index
                    if new_pixels != old_pixels:
                        lifted = pixels.copy(); lifted.putdata(new_pixels); encoded = io.BytesIO(); lifted.save(encoded, format='PNG', compress_level=9)
                        png = encoded.getvalue(); colour_sha = sha(png); colour_uri = 'textures/' + colour_sha[:20] + '.png'
                        assert colour_uri not in textures or textures[colour_uri] == png; textures[colour_uri] = png
                        if repeat:
                            next_material = retained['material']; installed = doc['materials'][next_material]
                            image = doc['images'][doc['textures'][installed['pbrMetallicRoughness']['baseColorTexture']['index']]['source']]
                            assert image['uri'] == colour_uri and (assets / colour_uri).read_bytes() == png, 'Delivered family colour atlas changed'
                            assert retained['colourSha256'] == colour_sha
                            expected = copy.deepcopy(material); expected['name'] = 'Apparel_Atlas_Family_Cloth_Depth'
                            expected.setdefault('extras', {})['originalMaterial'] = material_index
                            expected['pbrMetallicRoughness']['baseColorTexture'] = installed['pbrMetallicRoughness']['baseColorTexture']
                            assert installed == expected, 'Delivered family material changed'
                        else:
                            same = [i for i, m in enumerate(doc['materials']) if m.get('name') == 'Apparel_Atlas_Family_Cloth_Depth' and m.get('extras', {}).get('originalMaterial') == material_index and doc['images'][doc['textures'][m['pbrMetallicRoughness']['baseColorTexture']['index']]['source']]['uri'] == colour_uri]
                            if same: next_material = same[0]
                            else:
                                doc['images'].append({**image_record, 'name': 'Family_Cloth_Headroom', 'uri': colour_uri})
                                doc['textures'].append({**doc['textures'][texture['index']], 'source': len(doc['images']) - 1})
                                copied = copy.deepcopy(material); copied['name'] = 'Apparel_Atlas_Family_Cloth_Depth'
                                copied.setdefault('extras', {})['originalMaterial'] = material_index
                                copied['pbrMetallicRoughness']['baseColorTexture'] = {**texture, 'index': len(doc['textures']) - 1}
                                doc['materials'].append(copied); next_material = len(doc['materials']) - 1
                    pigments = [pixels.getpixel((min(pixels.width - 1, max(0, int(u * pixels.width))), min(pixels.height - 1, max(0, int(v * pixels.height))))) for u, v in uvs]
                    colours = base.float_rows([source.toned_colour(c, p, part, pigment, preset, i in drape, i in protected) for i, (c, p, pigment) in enumerate(zip(colours_before, positions, pigments))])
                    changed = sum(a != b for a, b in zip(colours, colours_before)); changed_vertices += changed
                    assert changed > 20 and all(math.isfinite(v) and 0 <= v <= 1 for row in colours for v in row), 'No valid family cloth colours selected'
                    assert all(colours[i] == colours_before[i] for i in protected), 'Native hem protection changed'
                    if repeat:
                        assert primitive['attributes']['COLOR_0'] == retained['colourAccessor'] and primitive['material'] == retained['material']
                        assert base.values(doc, binary, retained['colourAccessor']) == colours, 'Delivered family cloth colours changed'
                        assert retained['changedVertices'] == changed and retained['selection'] == selection
                        assert retained['colourUri'] == colour_uri and retained['colourSha256'] == colour_sha
                    else:
                        encoded = struct.pack('<' + 'f' * sum(map(len, colours)), *(v for row in colours for v in row))
                        binary.extend(b'\0' * (-len(binary) % 4)); offset = len(binary)
                        doc['bufferViews'].append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(encoded), 'target': 34962}); binary.extend(encoded)
                        width = len(colours[0]); assert width in (3, 4)
                        doc['accessors'].append({'bufferView': len(doc['bufferViews']) - 1, 'componentType': 5126, 'count': len(colours), 'type': f'VEC{width}',
                                                 'min': [min(row[c] for row in colours) for c in range(width)], 'max': [max(row[c] for row in colours) for c in range(width)]})
                        primitive['attributes']['COLOR_0'] = len(doc['accessors']) - 1; primitive['material'] = next_material
                        meta['primitives'].append({'mesh': mesh_index, 'primitive': pi, 'part': part, 'originalColourAccessor': old_accessor,
                                                   'colourAccessor': primitive['attributes']['COLOR_0'], 'originalMaterial': material_index,
                                                   'material': next_material, 'colourUri': colour_uri, 'colourSha256': colour_sha,
                                                   'changedVertices': changed, 'vertexCount': len(colours), 'selection': selection})
            if lod and preset in ('friar', 'woman-shawl'):
                part = 'outfit' if preset == 'friar' else 'legwear'
                mesh = next(n['mesh'] for n in doc['nodes'] if n.get('name') == f'Human_{part}_LOD{lod}')
                path_keys = ['meshes', mesh, 'extras', 'nativeClothTopology', 'sourceSha256']
                assert donor_hash and path_value(doc, path_keys) == record['nativeClothTopology']['sourceSha256']
                if repeat:
                    if not allow_stale_donor: assert path_value(doc, path_keys) == donor_hash, 'Completed coarse donor identity is stale'
                else:
                    meta['documentPatches'].append({'path': path_keys, 'before': path_value(doc, path_keys), 'after': donor_hash})
                    set_path(doc, path_keys, donor_hash); record['nativeClothTopology'] = copy.deepcopy(record['nativeClothTopology']); record['nativeClothTopology']['sourceSha256'] = donor_hash
            if repeat:
                restored, original_binary = restore_body(doc, binary, meta)
                with tempfile.TemporaryDirectory(prefix='granaderos-family-restore-') as folder:
                    original = merge.write_glb(Path(folder) / path.name, restored, bytearray(original_binary))
                    assert sha(original) == meta['beforeSha256'], 'Exact original GLB restoration failed'
                candidate = raw
            else:
                doc.setdefault('extras', {})[FIELD] = meta
                restored, original_binary = restore_body(doc, binary, meta)
                assert restored == before and original_binary == old_binary, 'Unowned family body data changed'
                with tempfile.TemporaryDirectory(prefix='granaderos-family-cloth-') as folder:
                    original = merge.write_glb(Path(folder) / 'original.glb', restored, bytearray(original_binary))
                    assert original == raw, 'Exact original GLB restoration failed'
                    candidate = merge.write_glb(Path(folder) / path.name, doc, binary)
                record.update(bytes=len(candidate), sha256=sha(candidate), familyClothDepth=meta); pending.append((path, candidate))
            if not lod: donor_hash = sha(candidate)
            rows.append({'preset': preset, 'lod': lod, 'beforeSha256': pins[path], 'afterSha256': sha(candidate), 'byteGrowth': len(candidate) - len(raw),
                         'changedVertices': changed_vertices, 'oldBinaryPrefixExact': True, 'originalGLBRecoverableExact': True, 'repeat': repeat})
    masked = copy.deepcopy(manifest)
    for preset in presets: masked['appearances'][preset] = old_manifest['appearances'][preset]
    assert masked == old_manifest, 'Unowned manifest data changed'
    assert mp.read_bytes() == manifest_bytes and all(sha(p.read_bytes()) == pin for p, pin in pins.items()), 'A pinned input changed during family pass'
    for uri, png in textures.items():
        destination = assets / uri
        assert not destination.exists() or destination.read_bytes() == png, 'Existing family texture name has different pixels'
    return {'manifest': manifest, 'manifestBytes': manifest_bytes, 'manifestPath': mp, 'assets': assets, 'pins': pins,
            'pending': pending, 'textures': textures, 'rows': rows, 'recipe': recipe, 'presets': presets}


def verify_completed(root, presets, allow_stale_donor=False):
    # Only the private native source context may inspect an old coarse receipt
    # after an explicit fresh LOD0 job. Its own recorded donor patch, source
    # prefix, colours and maps remain checked; final installation is strict.
    return prepare(Path(root).resolve(), presets, completed_only=True, allow_stale_donor=allow_stale_donor)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[2]); parser.add_argument('--presets', nargs='+')
    parser.add_argument('--receipt', type=Path); parser.add_argument('--verify-only', action='store_true')
    args = parser.parse_args(); result = prepare(args.root.resolve(), args.presets, completed_only=args.verify_only)
    assert result['manifestPath'].read_bytes() == result['manifestBytes'] and all(sha(p.read_bytes()) == pin for p, pin in result['pins'].items()), 'A pinned input changed before family installation'
    if not args.verify_only:
        # Preflight ALL content-addressed destinations before writing any file.
        for uri, png in result['textures'].items():
            path = result['assets'] / uri
            assert not path.exists() or path.read_bytes() == png, 'Existing family texture name has different pixels'
        for uri, png in result['textures'].items():
            path = result['assets'] / uri
            if not path.exists(): path.write_bytes(png)
        for path, raw in result['pending']: path.write_bytes(raw)
        if result['pending']:
            text = subprocess.check_output(['node', '-e', "let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',v=>s+=v);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(JSON.parse(s),null,2)+String.fromCharCode(10)));"], input=json.dumps(result['manifest']), text=True)
            result['manifestPath'].write_text(text)
    if args.receipt:
        args.receipt.parent.mkdir(parents=True, exist_ok=True); args.receipt.write_text(json.dumps({'recipe': result['recipe'], 'rows': result['rows']}, indent=2) + '\n')
    print('FAMILY_CLOTH_DEPTH_READY', json.dumps({'presets': result['presets'], 'changedFiles': 0 if args.verify_only else len(result['pending']), 'changedVertices': sum(r['changedVertices'] for r in result['rows'])}))


if __name__ == '__main__': main()
