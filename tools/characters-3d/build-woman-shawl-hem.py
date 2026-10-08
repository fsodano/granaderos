#!/usr/bin/env python3
"""Add the reference's inset rust hem through a separate colour UV channel.

Append TEXCOORD_1 and a base-colour map only. Retain TEXCOORD_0, all original
maps/materials, positions, normals, vertex colours, rig, morphs and indices.
"""
from pathlib import Path
import argparse, copy, hashlib, importlib.util, io, json, struct, subprocess, tempfile
from PIL import Image


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument('--receipt', type=Path)
    args = parser.parse_args()
    root = args.root.resolve()
    merge = module('hem_glb', root / 'tools/characters-3d/merge-animation-bank.py')
    source = module('hem_source', root / 'assets/source/characters-3d/authoring/appearance_palette.py')
    decoded = module('hem_attributes', root / 'tools/characters-3d/build-long-cloth-support.py').decoded
    assets = root / 'web/public/models/characters'
    manifest_path = assets / 'manifest.json'
    manifest_before = manifest_path.read_bytes()
    manifest = json.loads(manifest_before)
    original_manifest = copy.deepcopy(manifest)
    pixels = Image.new('RGBA', source.WOMAN_SHAWL_HEM_IMAGE_SIZE, (*source.WOMAN_SHAWL_SKIRT_SRGB, 255))
    for y in range(*source.WOMAN_SHAWL_HEM_IMAGE_ROWS):
        for x in range(pixels.width):
            pixels.putpixel((x, y), (*source.WOMAN_SHAWL_HEM_SRGB, 255))
    encoded = io.BytesIO()
    pixels.save(encoded, format='PNG', compress_level=9)
    png = encoded.getvalue()
    uri = 'textures/' + sha(png)[:20] + '.png'
    pending, rows, pins = [], [], {}
    donor_hash = None
    for lod in (0, 1, 2):
        record = manifest['appearances']['woman-shawl']['lods'][lod]
        path = assets / Path(record['url']).name
        before_bytes = path.read_bytes()
        pins[path] = sha(before_bytes)
        assert pins[path] == record['sha256']
        doc, binary = merge.read_glb(path)
        before = copy.deepcopy(doc)
        old_binary = bytes(binary)
        mesh = next(n['mesh'] for n in doc['nodes'] if n.get('name') == f'Human_legwear_LOD{lod}')
        primitive = doc['meshes'][mesh]['primitives'][0]
        assert len(doc['meshes'][mesh]['primitives']) == 1
        old_material = doc['materials'][primitive['material']]
        positions = decoded(doc, binary, primitive['attributes']['POSITION'])[1]
        indices = [p[0] for p in decoded(doc, binary, primitive['indices'])[1]]
        sewn = source.woman_shawl_sewn_skirt_vertices(positions, indices)
        uvs = [source.woman_shawl_hem_uv(p[1], i in sewn) for i, p in enumerate(positions)]
        expected = {'method': 'source-reference-inset-rust-colour-band', 'colourTexCoord': 1,
                    'retainedOriginalUV': 0, 'imageSize': list(pixels.size),
                    'rustRows': list(source.WOMAN_SHAWL_HEM_IMAGE_ROWS),
                    'rustSRGB': list(source.WOMAN_SHAWL_HEM_SRGB),
                    'charcoalSRGB': list(source.WOMAN_SHAWL_SKIRT_SRGB),
                    'restHeightRange': list(source.WOMAN_SHAWL_SKIRT_REST_HEIGHT),
                    'nativeBandWidth': .96 / 252 * 5,
                    'nativeBandCentreInset': source.WOMAN_SHAWL_HEM_CENTRE_INSET,
                    'nativeClearBorderBelowBand': source.WOMAN_SHAWL_HEM_CENTRE_INSET - .96 / 252 * 2.5,
                    'retainedGeometryAndClothShapes': True,
                    'sewnSkirtSelection': 'indexed-component-at-authored-hem',
                    'sewnSkirtVertexCount': len(sewn),
                    'nativeUnderlayerVertexCount': len(positions) - len(sewn),
                    'nativeUnderlayerColourUV': [.5, .25]}
        repeat = doc['meshes'][mesh].get('extras', {}).get('nativeSkirtHem') == expected
        if repeat:
            assert record.get('nativeSkirtHem') == expected
            assert decoded(doc, binary, primitive['attributes']['TEXCOORD_1'])[1] == [struct.unpack('<ff', struct.pack('<ff', *uv)) for uv in uvs]
            assert old_material['pbrMetallicRoughness']['baseColorTexture']['texCoord'] == 1
            image = doc['images'][doc['textures'][old_material['pbrMetallicRoughness']['baseColorTexture']['index']]['source']]
            assert image['uri'] == uri and (assets / uri).read_bytes() == png
        else:
            assert 'TEXCOORD_1' not in primitive['attributes']
            assert old_material['name'] == 'Apparel_Atlas_Charcoal_Legwear'
            raw = struct.pack('<' + 'f' * len(uvs) * 2, *(v for uv in uvs for v in uv))
            binary.extend(b'\0' * (-len(binary) % 4))
            view = len(doc['bufferViews'])
            doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(raw)})
            binary.extend(raw)
            accessor = len(doc['accessors'])
            doc['accessors'].append({'bufferView': view, 'componentType': 5126, 'count': len(uvs), 'type': 'VEC2',
                                     'min': [min(p[i] for p in uvs) for i in range(2)],
                                     'max': [max(p[i] for p in uvs) for i in range(2)]})
            primitive['attributes']['TEXCOORD_1'] = accessor
            old_texture = doc['textures'][old_material['pbrMetallicRoughness']['baseColorTexture']['index']]
            old_image = doc['images'][old_texture['source']]
            doc['images'].append({**old_image, 'name': 'Apparel_Charcoal_Inset_Rust_Hem', 'uri': uri})
            doc['textures'].append({**old_texture, 'source': len(doc['images']) - 1})
            material = copy.deepcopy(old_material)
            material['name'] = 'Apparel_Atlas_Charcoal_Legwear_Rust_Hem'
            material['pbrMetallicRoughness']['baseColorTexture'] = {**material['pbrMetallicRoughness']['baseColorTexture'], 'index': len(doc['textures']) - 1, 'texCoord': 1}
            doc['materials'].append(material)
            primitive['material'] = len(doc['materials']) - 1
            doc['meshes'][mesh].setdefault('extras', {})['nativeSkirtHem'] = expected
            record['nativeSkirtHem'] = expected
        if lod:
            topology = doc['meshes'][mesh]['extras']['nativeClothTopology']
            assert topology['sourceSha256'] == record['nativeClothTopology']['sourceSha256']
            topology['sourceSha256'] = donor_hash
            record['nativeClothTopology']['sourceSha256'] = donor_hash
        if not repeat:
            allowed = copy.deepcopy(doc)
            for key in ('bufferViews', 'accessors', 'materials', 'images', 'textures'):
                assert allowed[key][:len(before[key])] == before[key]
                allowed[key] = allowed[key][:len(before[key])]
            del allowed['meshes'][mesh]['primitives'][0]['attributes']['TEXCOORD_1']
            allowed['meshes'][mesh]['primitives'][0]['material'] = before['meshes'][mesh]['primitives'][0]['material']
            del allowed['meshes'][mesh]['extras']['nativeSkirtHem']
            if lod:
                allowed['meshes'][mesh]['extras']['nativeClothTopology']['sourceSha256'] = before['meshes'][mesh]['extras']['nativeClothTopology']['sourceSha256']
            assert allowed == before and bytes(binary[:len(old_binary)]) == old_binary
        with tempfile.TemporaryDirectory(prefix='granaderos-rust-hem-') as folder:
            staged = Path(folder) / path.name
            merge.write_glb(staged, doc, binary)
            candidate = staged.read_bytes()
            check, actual_binary = merge.read_glb(staged)
            assert check == doc and bytes(actual_binary[:len(old_binary)]) == old_binary
        record.update(bytes=len(candidate), sha256=sha(candidate))
        if not lod:
            donor_hash = record['sha256']
        pending.append((path, candidate))
        rows.append({'lod': lod, 'beforeSha256': pins[path], 'afterSha256': record['sha256'],
                     'byteGrowth': len(candidate) - len(before_bytes), 'oldBinaryPrefixExact': True,
                     'allOldJSONExceptSelectedMaterialAndDonorExact': True, 'repeat': repeat,
                     'newUVCount': len(uvs), 'colourUri': uri, 'colourBytes': len(png), 'recipe': expected})
    mask = copy.deepcopy(manifest)
    mask['appearances']['woman-shawl']['lods'] = original_manifest['appearances']['woman-shawl']['lods']
    assert mask == original_manifest and manifest_path.read_bytes() == manifest_before
    assert all(sha(p.read_bytes()) == pin for p, pin in pins.items())
    texture_path = assets / uri
    if texture_path.is_file():
        assert texture_path.read_bytes() == png
    else:
        texture_path.write_bytes(png)
    for path, raw in pending:
        path.write_bytes(raw)
    canonical = subprocess.check_output(['node', '-e', "let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',v=>s+=v);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(JSON.parse(s),null,2)+'\\n'));"], input=json.dumps(manifest), text=True)
    manifest_path.write_text(canonical)
    if args.receipt:
        args.receipt.write_text(json.dumps({'rows': rows, 'pinsBefore': {str(p.relative_to(root)): h for p, h in pins.items()}}, indent=2) + '\n')
    print('WOMAN_SHAWL_HEM_READY; old geometry/UV/maps/native clips exact')


if __name__ == '__main__':
    main()
