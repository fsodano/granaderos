#!/usr/bin/env python3
"""Separate the native woman's charcoal legwear from her retained burgundy shawl.

Only material bindings, appended colour resources and the coarse donor identity
change. Every binary geometry/UV/morph/rig payload and old atlas remains exact.
"""
from pathlib import Path
import argparse, copy, hashlib, importlib.util, io, json, math, struct, subprocess, tempfile
from PIL import Image


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def uv_values(doc, binary, index):
    accessor = doc['accessors'][index]
    assert accessor['componentType'] == 5126 and accessor['type'] == 'VEC2'
    assert 'sparse' not in accessor
    view = doc['bufferViews'][accessor['bufferView']]
    start = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
    return [struct.unpack_from('<ff', binary, start + i * view.get('byteStride', 8))
            for i in range(accessor['count'])]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument('--receipt', type=Path)
    args = parser.parse_args()
    root = args.root.resolve()
    merge = load_module('shawl_palette_glb', root / 'tools/characters-3d/merge-animation-bank.py')
    palette = load_module('shawl_palette_values', root / 'assets/source/characters-3d/authoring/appearance_palette.py')
    assets = root / 'web/public/models/characters'
    manifest_path = assets / 'manifest.json'
    manifest_bytes = manifest_path.read_bytes()
    manifest = json.loads(manifest_bytes)
    old_manifest = copy.deepcopy(manifest)
    pending, receipts, new_images, source_pins = [], [], {}, {}
    donor_hash = None
    for lod in (0, 1, 2):
        record = manifest['appearances']['woman-shawl']['lods'][lod]
        path = assets / Path(record['url']).name
        original = path.read_bytes()
        assert sha(original) == record['sha256']
        source_pins[path] = sha(original)
        doc, binary = merge.read_glb(path)
        before = copy.deepcopy(doc)
        original_binary = bytes(binary)
        mesh = next(node['mesh'] for node in doc['nodes']
                    if node.get('name') == f'Human_legwear_LOD{lod}')
        primitive = doc['meshes'][mesh]['primitives'][0]
        assert len(doc['meshes'][mesh]['primitives']) == 1
        material = doc['materials'][primitive['material']]
        retained_hem = material['name'] == 'Apparel_Atlas_Charcoal_Legwear_Rust_Hem'
        if retained_hem:
            support = doc['meshes'][mesh].get('extras', {}).get('nativeSkirtHem')
            assert support and support == record.get('nativeSkirtHem'), 'Inconsistent completed hem metadata'
            assert material['pbrMetallicRoughness']['baseColorTexture'].get('texCoord') == 1
            assert 'TEXCOORD_1' in primitive['attributes']
            retained = [m for m in doc['materials'] if m.get('name') == 'Apparel_Atlas_Charcoal_Legwear']
            assert len(retained) == 1, 'Missing retained charcoal UV0 material'
            material = retained[0]
        else:
            assert 'nativeSkirtHem' not in doc['meshes'][mesh].get('extras', {}), 'Ambiguous hem material state'
        assert material['name'] in ('Apparel_Atlas', 'Apparel_Atlas_Charcoal_Legwear'), 'Unrecognized source palette role'
        assert material['pbrMetallicRoughness']['baseColorTexture'].get('texCoord', 0) == 0
        texture_index = material['pbrMetallicRoughness']['baseColorTexture']['index']
        texture = doc['textures'][texture_index]
        image = doc['images'][texture['source']]
        old_png_path = assets / image['uri']
        old_png = old_png_path.read_bytes()
        source_pins[old_png_path] = sha(old_png)
        pixels = Image.open(io.BytesIO(old_png)).convert('RGBA')
        assert pixels.width == pixels.height and pixels.width % 32 == 0
        side = pixels.width // 32
        assert side >= 4 and side & (side - 1) == 0, 'Unexpected source atlas dimensions'
        used_tiles = {(math.floor(u * side), math.floor(v * side))
                      for u, v in uv_values(doc, binary, primitive['attributes']['TEXCOORD_0'])}
        assert len(used_tiles) == 1, 'The legwear pigment must remain isolated'
        tile_x, tile_y = next(iter(used_tiles))
        assert 0 <= tile_x < side and 0 <= tile_y < side
        repeated = material['name'] == 'Apparel_Atlas_Charcoal_Legwear'
        colours = {pixels.getpixel((x, y)) for y in range(tile_y * 32, (tile_y + 1) * 32) for x in range(tile_x * 32, (tile_x + 1) * 32)}
        assert len(colours) == 1 and colours <= {(*palette.WOMAN_SHAWL_SKIRT_SRGB, 255), (91, 44, 53, 255)}, 'Unrecognized source legwear pigment'
        expected = next(iter(colours))[:3]
        if repeated:assert expected == tuple(palette.WOMAN_SHAWL_SKIRT_SRGB), 'Completed palette has a different pigment'
        state = 'completed-hem' if retained_hem else 'completed-charcoal' if repeated else 'raw-charcoal' if expected == tuple(palette.WOMAN_SHAWL_SKIRT_SRGB) else 'legacy-burgundy'
        for y in range(tile_y * 32, (tile_y + 1) * 32):
            for x in range(tile_x * 32, (tile_x + 1) * 32):
                assert pixels.getpixel((x, y)) == (*expected, 255)
                pixels.putpixel((x, y), (*palette.WOMAN_SHAWL_SKIRT_SRGB, 255))
        encoded = io.BytesIO()
        pixels.save(encoded, format='PNG', compress_level=9)
        png = encoded.getvalue()
        uri = 'textures/' + sha(png)[:20] + '.png'
        if repeated:
            assert image['uri'] == uri and old_png == png
        else:
            new_image = copy.deepcopy(image)
            new_image.update(name='Apparel_Color_Charcoal_Legwear', uri=uri)
            image_index = len(doc['images']); doc['images'].append(new_image)
            new_texture = copy.deepcopy(texture)
            new_texture['source'] = image_index
            next_texture = len(doc['textures']); doc['textures'].append(new_texture)
            new_material = copy.deepcopy(material)
            new_material['name'] = 'Apparel_Atlas_Charcoal_Legwear'
            new_material['pbrMetallicRoughness']['baseColorTexture']['index'] = next_texture
            next_material = len(doc['materials']); doc['materials'].append(new_material)
            primitive['material'] = next_material
        if lod:
            topology = doc['meshes'][mesh]['extras']['nativeClothTopology']
            assert topology['sourceSha256'] == record['nativeClothTopology']['sourceSha256']
            topology['sourceSha256'] = donor_hash
            record['nativeClothTopology']['sourceSha256'] = donor_hash
        # Prove the exact permitted document boundary before serialization.
        permitted = copy.deepcopy(doc)
        for key in ('images', 'textures', 'materials'):
            assert permitted[key][:len(before[key])] == before[key]
            permitted[key] = permitted[key][:len(before[key])]
        permitted['meshes'][mesh]['primitives'][0]['material'] = before['meshes'][mesh]['primitives'][0]['material']
        if lod:
            permitted['meshes'][mesh]['extras']['nativeClothTopology']['sourceSha256'] = before['meshes'][mesh]['extras']['nativeClothTopology']['sourceSha256']
        assert permitted == before and bytes(binary) == original_binary
        with tempfile.TemporaryDirectory(prefix='granaderos-shawl-palette-') as folder:
            staged = Path(folder) / path.name
            merge.write_glb(staged, doc, binary)
            raw = staged.read_bytes()
            check, decoded_binary = merge.read_glb(staged)
            assert check == doc and bytes(decoded_binary) == original_binary
        record.update(sha256=sha(raw), bytes=len(raw))
        if not lod:
            donor_hash = record['sha256']
        pending.append((path, raw))
        new_images[assets / uri] = png
        receipts.append({'lod': lod, 'url': record['url'], 'beforeSha256': sha(original),
                         'afterSha256': sha(raw), 'bytes': len(raw), 'byteGrowth': len(raw)-len(original),
                         'oldColorUri': image['uri'], 'newColorUri': uri,
                         'newColorSha256': sha(png), 'newColorBytes': len(png),
                         'paletteSRGB': list(palette.WOMAN_SHAWL_SKIRT_SRGB),
                         'tile': [tile_x, tile_y], 'binaryExact': True, 'repeated': repeated,
                         'sourceState': state, 'retainedLaterHem': retained_hem})
    allowed = copy.deepcopy(manifest)
    for lod in (0, 1, 2):
        allowed['appearances']['woman-shawl']['lods'][lod] = old_manifest['appearances']['woman-shawl']['lods'][lod]
    assert allowed == old_manifest
    assert manifest_path.read_bytes() == manifest_bytes
    assert all(sha(path.read_bytes()) == pin for path, pin in source_pins.items())
    for path, raw in new_images.items():
        if path.exists():
            assert path.read_bytes() == raw, 'Content-addressed atlas collision'
        else:
            path.write_bytes(raw)
    for path, raw in pending:
        path.write_bytes(raw)
    canonical = subprocess.check_output(['node', '-e', "let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',v=>s+=v);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(JSON.parse(s),null,2)+'\\n'));"], input=json.dumps(manifest), text=True)
    manifest_path.write_text(canonical)
    if args.receipt:
        args.receipt.write_text(json.dumps({'rows': receipts, 'oldSourcePins': {str(p.relative_to(root)): h for p, h in source_pins.items()}}, indent=2)+'\n')
    print('WOMAN_SHAWL_PALETTE_READY', len(pending), 'bodies; native binary and old atlases exact')


if __name__ == '__main__':
    main()
