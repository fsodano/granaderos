#!/usr/bin/env python3
"""Append broad garment form colours without rebuilding native character data.

The first pilot owns Granadero/worker outfit and legwear COLOR_0 and a separate
Granadero navy colour atlas. Original binary payloads and JSON resources remain
intact; stale or changed recipes
require a fresh source build. Repeated runs verify the delivered colours and
write nothing. --presets limits review or a selected source rebuild.
"""
from pathlib import Path
import argparse, copy, hashlib, importlib.util, io, json, math, struct, subprocess, tempfile
from PIL import Image


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def json_sha(doc):
    # Match the project's JavaScript manifest canonicalization, including its
    # integer-valued floats and small exponent spelling, for independent QA.
    encoded = subprocess.check_output(['node', '-e', "let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',v=>s+=v);function stable(v){if(Array.isArray(v))return v.map(stable);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));return v;}process.stdin.on('end',()=>process.stdout.write(JSON.stringify(stable(JSON.parse(s)))));"], input=json.dumps(doc), text=True)
    return sha(encoded.encode())


def values(doc, binary, index):
    a = doc['accessors'][index]
    assert 'sparse' not in a and not a.get('normalized'), 'Expected direct float surface attributes'
    assert a['componentType'] == 5126, 'Expected float surface attributes'
    width = {'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
    view = doc['bufferViews'][a['bufferView']]
    start = view.get('byteOffset', 0) + a.get('byteOffset', 0)
    return [struct.unpack_from('<' + 'f' * width, binary,
                               start + i * view.get('byteStride', width * 4))
            for i in range(a['count'])]


def float_rows(rows):
    return [struct.unpack('<' + 'f' * len(row), struct.pack('<' + 'f' * len(row), *row)) for row in rows]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument('--presets', nargs='+')
    parser.add_argument('--receipt', type=Path)
    args = parser.parse_args()
    root = args.root.resolve()
    source_path = root / 'assets/source/characters-3d/authoring/cloth_depth.py'
    source = module('cloth_depth_source', source_path)
    merge = module('cloth_depth_glb', root / 'tools/characters-3d/merge-animation-bank.py')
    presets = args.presets or source.PRESETS
    assert len(presets) == len(set(presets)) and set(presets) <= set(source.PRESETS), 'Unknown or duplicate pilot preset'
    assets = root / 'web/public/models/characters'
    manifest_path = assets / 'manifest.json'
    manifest_before = manifest_path.read_bytes()
    manifest = json.loads(manifest_before)
    old_manifest = copy.deepcopy(manifest)
    recipe = {'method': 'broad-rest-space-cloth-fold-colours-v2',
              'source': str(source_path.relative_to(root)), 'sourceSha256': sha(source_path.read_bytes()),
              'factorBounds': [source.MIN_FACTOR, source.MAX_FACTOR],
              'navyAlbedoHeadroom': source.NAVY_ALBEDO_HEADROOM,
              'retainedGeometryRigClipsMaps': True}
    staged_files, staged_textures, pins, rows = [], {}, {}, []
    for preset in presets:
        for record in manifest['appearances'][preset]['lods']:
            lod = record['lod']
            path = assets / Path(record['url']).name
            original_raw = path.read_bytes()
            pins[path] = sha(original_raw)
            assert pins[path] == record['sha256'], 'Released body differs from manifest: ' + path.name
            doc, binary = merge.read_glb(path)
            before, old_binary = copy.deepcopy(doc), bytes(binary)
            repeat = 'clothDepth' in record
            if repeat:
                metadata = record['clothDepth']
                assert metadata['recipe'] == recipe, 'Changed cloth recipe; rebuild source before applying it'
                assert doc.get('extras', {}).get('clothDepth') == metadata, 'Inconsistent completed cloth metadata'
            else:
                assert 'clothDepth' not in doc.get('extras', {}), 'Ambiguous completed cloth state'
                metadata = {'recipe': recipe, 'beforeSha256': pins[path], 'originalJSONSha256': json_sha(before),
                            'originalBinarySha256': sha(old_binary), 'originalBinaryBytes': len(old_binary),
                            'originalAccessorCount': len(doc['accessors']), 'originalViewCount': len(doc['bufferViews']),
                            'originalMaterialCount': len(doc['materials']), 'originalTextureCount': len(doc['textures']),
                            'originalImageCount': len(doc['images']),
                            'originalHadExtras': 'extras' in before, 'primitives': []}
            changed_vertices = 0
            for part in ('outfit', 'legwear'):
                matches = [node['mesh'] for node in doc['nodes'] if node.get('name') == f'Human_{part}_LOD{lod}']
                assert len(matches) == 1, 'Missing or duplicate pilot cloth mesh'
                mesh_index = matches[0]
                for primitive_index, primitive in enumerate(doc['meshes'][mesh_index]['primitives']):
                    retained = next((item for item in metadata['primitives']
                                     if item['mesh'] == mesh_index and item['primitive'] == primitive_index), None)
                    assert bool(retained) == repeat
                    original_material = retained['originalMaterial'] if retained else primitive['material']
                    material = doc['materials'][original_material]
                    assert material['name'] == 'Apparel_Atlas', 'Unexpected pilot cloth material'
                    original_colour = retained['originalColourAccessor'] if retained else primitive['attributes']['COLOR_0']
                    old_colours = values(doc, binary, original_colour)
                    positions = values(doc, binary, primitive['attributes']['POSITION'])
                    uvs = values(doc, binary, primitive['attributes']['TEXCOORD_0'])
                    assert len(old_colours) == len(positions) == len(uvs)
                    texture = material['pbrMetallicRoughness']['baseColorTexture']
                    assert texture.get('texCoord', 0) == 0
                    image_record = doc['images'][doc['textures'][texture['index']]['source']]
                    image_path = assets / image_record['uri']
                    pins[image_path] = sha(image_path.read_bytes())
                    pixels = Image.open(image_path).convert('RGB')
                    colour_uri = None
                    colour_sha256 = None
                    new_material = original_material
                    if preset == 'granadero':
                        lifted = pixels.copy()
                        original_pixels = list(pixels.getdata())
                        new_pixels = [source.headroom_pigment(pigment, preset) for pigment in original_pixels]
                        assert any(a != b for a, b in zip(original_pixels, new_pixels)), 'Missing named navy atlas pigments'
                        # Every other tile/pixel keeps its exact source colour.
                        lifted.putdata(new_pixels)
                        encoded = io.BytesIO()
                        lifted.save(encoded, format='PNG', compress_level=9)
                        png = encoded.getvalue()
                        colour_uri = 'textures/' + sha(png)[:20] + '.png'
                        colour_sha256 = sha(png)
                        assert colour_uri not in staged_textures or staged_textures[colour_uri] == png
                        staged_textures[colour_uri] = png
                        if repeat:
                            new_material = retained['material']
                            installed = doc['materials'][new_material]
                            installed_texture = doc['textures'][installed['pbrMetallicRoughness']['baseColorTexture']['index']]
                            installed_image = doc['images'][installed_texture['source']]
                            assert installed_image['uri'] == colour_uri and (assets / colour_uri).read_bytes() == png, 'Delivered navy colour atlas changed'
                            assert retained.get('colourSha256') == colour_sha256, 'Owned colour texture receipt differs'
                        else:
                            matches = [i for i, entry in enumerate(doc['materials'])
                                       if entry.get('name') == 'Apparel_Atlas_Cloth_Depth' and entry.get('extras', {}).get('originalMaterial') == original_material]
                            if matches:
                                assert len(matches) == 1
                                new_material = matches[0]
                            else:
                                old_texture = doc['textures'][texture['index']]
                                doc['images'].append({**image_record, 'name': 'Apparel_Navy_Cloth_Headroom', 'uri': colour_uri})
                                doc['textures'].append({**old_texture, 'source': len(doc['images']) - 1})
                                copied_material = copy.deepcopy(material)
                                copied_material['name'] = 'Apparel_Atlas_Cloth_Depth'
                                copied_material.setdefault('extras', {})['originalMaterial'] = original_material
                                copied_material['pbrMetallicRoughness']['baseColorTexture'] = {**texture, 'index': len(doc['textures']) - 1}
                                doc['materials'].append(copied_material)
                                new_material = len(doc['materials']) - 1
                    pigments = [pixels.getpixel((min(pixels.width - 1, max(0, int(uv[0] * pixels.width))),
                                                min(pixels.height - 1, max(0, int(uv[1] * pixels.height))))) for uv in uvs]
                    colours = float_rows([source.toned_colour(colour, position, part, pigment, preset)
                                          for colour, position, pigment in zip(old_colours, positions, pigments)])
                    changed = sum(a != b for a, b in zip(colours, old_colours))
                    assert changed > 20 and all(math.isfinite(value) and 0 <= value <= 1 for colour in colours for value in colour), 'No valid cloth form colours selected'
                    changed_vertices += changed
                    if repeat:
                        assert primitive['attributes']['COLOR_0'] == retained['colourAccessor']
                        assert primitive['material'] == retained['material']
                        assert values(doc, binary, retained['colourAccessor']) == colours, 'Delivered cloth colours changed'
                        assert retained['changedVertices'] == changed
                    else:
                        raw = struct.pack('<' + 'f' * sum(map(len, colours)), *(value for colour in colours for value in colour))
                        binary.extend(b'\0' * (-len(binary) % 4))
                        view = len(doc['bufferViews'])
                        doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(raw), 'target': 34962})
                        binary.extend(raw)
                        accessor = len(doc['accessors'])
                        width = len(colours[0])
                        assert width in (3, 4)
                        doc['accessors'].append({'bufferView': view, 'componentType': 5126, 'count': len(colours), 'type': f'VEC{width}',
                                                 'min': [min(row[c] for row in colours) for c in range(width)],
                                                 'max': [max(row[c] for row in colours) for c in range(width)]})
                        primitive['attributes']['COLOR_0'] = accessor
                        primitive['material'] = new_material
                        metadata['primitives'].append({'mesh': mesh_index, 'primitive': primitive_index, 'part': part,
                                                       'originalColourAccessor': original_colour, 'colourAccessor': accessor,
                                                       'originalMaterial': original_material, 'material': new_material, 'colourUri': colour_uri,
                                                       'colourSha256': colour_sha256,
                                                       'changedVertices': changed, 'vertexCount': len(colours)})
            if repeat:
                retained_doc = copy.deepcopy(doc)
                for item in metadata['primitives']:
                    primitive = retained_doc['meshes'][item['mesh']]['primitives'][item['primitive']]
                    primitive['attributes']['COLOR_0'] = item['originalColourAccessor']
                    primitive['material'] = item['originalMaterial']
                for key, count in [('accessors', 'originalAccessorCount'), ('bufferViews', 'originalViewCount'),
                                   ('materials', 'originalMaterialCount'), ('textures', 'originalTextureCount'), ('images', 'originalImageCount')]:
                    retained_doc[key] = retained_doc[key][:metadata[count]]
                retained_doc['buffers'] = [{'byteLength': metadata['originalBinaryBytes']}]
                del retained_doc['extras']['clothDepth']
                if not metadata['originalHadExtras']:
                    del retained_doc['extras']
                assert json_sha(retained_doc) == metadata['originalJSONSha256'], 'Retained native JSON changed'
                assert sha(bytes(binary[:metadata['originalBinaryBytes']])) == metadata['originalBinarySha256'], 'Retained native binary changed'
                candidate = original_raw
            else:
                doc.setdefault('extras', {})['clothDepth'] = metadata
                restored = copy.deepcopy(doc)
                for item in metadata['primitives']:
                    restored['meshes'][item['mesh']]['primitives'][item['primitive']]['attributes']['COLOR_0'] = item['originalColourAccessor']
                    restored['meshes'][item['mesh']]['primitives'][item['primitive']]['material'] = item['originalMaterial']
                restored['accessors'] = restored['accessors'][:metadata['originalAccessorCount']]
                restored['bufferViews'] = restored['bufferViews'][:metadata['originalViewCount']]
                for key, count in [('materials', 'originalMaterialCount'), ('textures', 'originalTextureCount'), ('images', 'originalImageCount')]:
                    assert restored[key][:metadata[count]] == before[key], 'Original material/image/texture resource changed'
                    restored[key] = restored[key][:metadata[count]]
                del restored['extras']['clothDepth']
                if not metadata['originalHadExtras']:
                    del restored['extras']
                assert restored == before and bytes(binary[:len(old_binary)]) == old_binary, 'Unowned body data changed'
                with tempfile.TemporaryDirectory(prefix='granaderos-cloth-depth-') as folder:
                    staged = Path(folder) / path.name
                    merge.write_glb(staged, doc, binary)
                    candidate = staged.read_bytes()
                record.update(bytes=len(candidate), sha256=sha(candidate), clothDepth=metadata)
                staged_files.append((path, candidate))
            rows.append({'preset': preset, 'lod': lod, 'beforeSha256': pins[path], 'afterSha256': sha(candidate),
                         'byteGrowth': len(candidate) - len(original_raw), 'changedVertices': changed_vertices,
                         'oldBinaryPrefixExact': True, 'geometryRigClipsMapsExact': True, 'repeat': repeat})
    restored_manifest = copy.deepcopy(manifest)
    for preset in presets:
        restored_manifest['appearances'][preset] = old_manifest['appearances'][preset]
    assert restored_manifest == old_manifest and manifest_path.read_bytes() == manifest_before, 'Unowned manifest data changed'
    assert all(sha(path.read_bytes()) == digest for path, digest in pins.items()), 'A pinned input changed during the pass'
    for uri, png in staged_textures.items():
        path = assets / uri
        if path.exists():
            assert path.read_bytes() == png, 'Existing texture name has different pixels'
    # Check every destination before installing any new map or body.
    for uri, png in staged_textures.items():
        path = assets / uri
        if not path.exists():
            path.write_bytes(png)
    for path, raw in staged_files:
        path.write_bytes(raw)
    if staged_files:
        canonical = subprocess.check_output(['node', '-e', "let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',v=>s+=v);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(JSON.parse(s),null,2)+'\\n'));"], input=json.dumps(manifest), text=True)
        manifest_path.write_text(canonical)
    if args.receipt:
        args.receipt.parent.mkdir(parents=True, exist_ok=True)
        args.receipt.write_text(json.dumps({'recipe': recipe, 'rows': rows}, indent=2) + '\n')
    print('CLOTH_DEPTH_READY', json.dumps({'presets': presets, 'changedFiles': len(staged_files), 'changedVertices': sum(row['changedVertices'] for row in rows)}))


if __name__ == '__main__':
    main()
