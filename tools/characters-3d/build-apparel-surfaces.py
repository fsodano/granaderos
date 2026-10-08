#!/usr/bin/env python3
"""Install a reversible broad apparel/boot and bounded equipment-metal layer.

Append material, image and texture definitions only. The complete original GLB
binary remains exact, including every native and frozen fold COLOR_0 stream.
Normal maps, UVs, source maps/materials and preceding receipts remain exact.
--verify-only checks installed surfaces without writing. All candidates and
content-addressed destinations are checked before installation starts.
"""
from pathlib import Path
import argparse, copy, hashlib, importlib.util, io, json, os, struct, subprocess, tempfile
from PIL import Image

FIELD = 'apparelSurface'


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    value = importlib.util.module_from_spec(spec); spec.loader.exec_module(value)
    return value


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def json_sha(doc):
    text = subprocess.check_output(['node', '-e', "let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',v=>s+=v);function stable(v){if(Array.isArray(v))return v.map(stable);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));return v;}process.stdin.on('end',()=>process.stdout.write(JSON.stringify(stable(JSON.parse(s)))));"], input=json.dumps(doc), text=True)
    return sha(text.encode())


def encode_glb(doc, binary):
    # Unlike a general exporter, this serializer never edits buffer definitions
    # or pads an existing stream. The input GLB already has aligned payloads.
    assert len(binary) % 4 == 0 and doc['buffers'] == [{'byteLength': len(binary)}]
    text = json.dumps(doc, separators=(',', ':')).encode(); text += b' ' * (-len(text) % 4)
    return (struct.pack('<III', 0x46546c67, 2, 28 + len(text) + len(binary))
            + struct.pack('<II', len(text), 0x4e4f534a) + text
            + struct.pack('<II', len(binary), 0x004e4942) + bytes(binary))


def path_value(doc, path):
    for key in path: doc = doc[key]
    return doc


def set_path(doc, path, value):
    parent = path_value(doc, path[:-1]); parent[path[-1]] = value


def restore_record(record):
    restored = copy.deepcopy(record); meta = restored.pop(FIELD)
    restored['sha256'] = meta['beforeSha256']; restored['bytes'] = meta['beforeBytes']
    for patch in meta['recordPatches']:
        assert path_value(restored, patch['path']) == patch['after'], 'Changed apparel record donor identity'
        set_path(restored, patch['path'], patch['before'])
    assert json_sha(restored) == meta['originalRecordJSONSha256'], 'Original apparel LOD record changed'
    return restored


def restore_body(doc, binary, metadata):
    restored = copy.deepcopy(doc)
    assert restored.get('extras', {}).get(FIELD) == metadata, 'Inconsistent apparel surface receipt'
    for item in metadata['primitives']:
        primitive = restored['meshes'][item['mesh']]['primitives'][item['primitive']]
        assert primitive['material'] == item['material'], 'Changed active apparel surface material'
        primitive['material'] = item['originalMaterial']
    for patch in metadata['documentPatches']:
        assert path_value(restored, patch['path']) == patch['after'], 'Changed apparel donor identity'
        set_path(restored, patch['path'], patch['before'])
    for key, count in [('materials', 'originalMaterialCount'), ('textures', 'originalTextureCount'), ('images', 'originalImageCount')]:
        if key in restored:
            restored[key] = restored[key][:metadata[count]]
        else:
            assert metadata[count] == 0, 'Missing retained surface collection'
    del restored['extras'][FIELD]
    if not metadata['originalHadExtras']: del restored['extras']
    assert len(binary) == metadata['originalBinaryBytes'] and sha(bytes(binary)) == metadata['originalBinarySha256'], 'Original apparel binary changed'
    assert json_sha(restored) == metadata['originalJSONSha256'], 'Original apparel JSON changed'
    original = encode_glb(restored, binary)
    assert sha(original) == metadata['beforeSha256'], 'Exact pre-surface GLB restoration failed'
    return restored, bytes(binary)


def recipe_for(root):
    path = root / 'assets/source/characters-3d/authoring/apparel_surfaces.py'
    source = module('apparel_surface_recipe', path)
    dependencies = {name: sha((root / 'assets/source/characters-3d/authoring' / name).read_bytes())
                    for name in ('cloth_depth.py', 'family_cloth_depth.py')}
    return source, {'method': 'broad-apparel-pigment-boot-wear-and-matte-equipment-v1',
                    'source': str(path.relative_to(root)), 'sourceSha256': sha(path.read_bytes()),
                    'installerSha256': sha((root / 'tools/characters-3d/build-apparel-surfaces.py').read_bytes()),
                    'foldSourceSha256': dependencies, 'clothFactorBounds': list(source.CLOTH_FACTOR_BOUNDS),
                    'bootFactorBounds': list(source.BOOT_FACTOR_BOUNDS), 'bootRoughnessBounds': list(source.BOOT_ROUGHNESS_BOUNDS),
                    'metalRoughness': source.METAL_ROUGHNESS,
                    'retainedClothRoughnessNormalsBinaryAndFoldReceipts': True,
                    'selection': 'original-pigment-and-original-metal-rough-tile-role'}


def image_for(doc, texture):
    return doc['images'][doc['textures'][texture['index']]['source']]


def png_bytes(image):
    out = io.BytesIO(); image.save(out, format='PNG', compress_level=9); return out.getvalue()


def fold_source_material(record, mesh, primitive, current):
    for field in ('clothDepth', 'familyClothDepth'):
        for item in record.get(field, {}).get('primitives', []):
            if item['mesh'] == mesh and item['primitive'] == primitive:
                assert current == item['material'], 'Frozen fold material is no longer active before surface pass'
                return item['originalMaterial']
    return current


def cloth_pigments(preset, part, pilot, family):
    return (pilot if preset in pilot.PRESETS else family).PIGMENTS[preset][part]


def tile_roles(original_colour, original_mr, allowed, part, source):
    assert original_colour.size == original_mr.size and original_colour.width == original_colour.height
    assert original_colour.width % source.TILE == 0
    selected = {}
    for ty in range(original_colour.height // source.TILE):
        for tx in range(original_colour.width // source.TILE):
            colours = {original_colour.getpixel((x, y))[:3]
                       for y in range(ty * source.TILE, (ty + 1) * source.TILE)
                       for x in range(tx * source.TILE, (tx + 1) * source.TILE)}
            surfaces = {original_mr.getpixel((x, y))[:3]
                        for y in range(ty * source.TILE, (ty + 1) * source.TILE)
                        for x in range(tx * source.TILE, (tx + 1) * source.TILE)}
            if len(colours) != 1 or len(surfaces) != 1: continue
            pigment, mr = next(iter(colours)), next(iter(surfaces))
            if part == 'footwear' and pigment == source.BOOT_PIGMENT and mr[1:] == (source.BOOT_ROUGHNESS_BYTE, 0):
                selected[(tx, ty)] = 'boot'
            elif part != 'footwear' and pigment in allowed and mr[1] in source.MAIN_CLOTH_ROUGHNESS_BYTES and mr[2] == 0:
                selected[(tx, ty)] = 'cloth'
    assert selected, 'Missing unambiguous main apparel palette role'
    return selected


def build_candidate(root, assets, record, doc, binary, source, recipe, pilot, family, read_image, donor_hash=None, equipment=False):
    before = copy.deepcopy(doc); textures = {}; lod = record.get('lod')
    previous_record = copy.deepcopy(record); previous_record.pop('originalPreset', None)
    meta = {'recipe': recipe, 'beforeSha256': record['sha256'], 'beforeBytes': record['bytes'],
            'originalRecordJSONSha256': json_sha(previous_record), 'recordPatches': [],
            'originalJSONSha256': json_sha(doc), 'originalBinarySha256': sha(bytes(binary)),
            'originalBinaryBytes': len(binary), 'originalMaterialCount': len(doc['materials']),
            'originalTextureCount': len(doc.get('textures', [])), 'originalImageCount': len(doc.get('images', [])),
            'originalHadExtras': 'extras' in doc, 'originalImages': {}, 'primitives': [], 'documentPatches': []}
    for image in before.get('images', []):
        uri = image.get('uri')
        if uri and not uri.startswith('data:'): meta['originalImages'][uri] = sha(read_image(uri))
    cloned = {}

    def append_map(material, old_texture, new_image, name):
        png = png_bytes(new_image); uri = 'textures/' + sha(png)[:20] + '.png'
        assert uri not in textures or textures[uri] == png; textures[uri] = png
        old_image = image_for(before, old_texture)
        doc.setdefault('images', []).append({**old_image, 'name': name, 'uri': uri})
        doc.setdefault('textures', []).append({**before['textures'][old_texture['index']], 'source': len(doc['images']) - 1})
        return {**old_texture, 'index': len(doc['textures']) - 1}, uri, sha(png)

    if equipment:
        targets = [(mi, pi, None) for mi, mesh in enumerate(doc['meshes']) for pi, p in enumerate(mesh['primitives'])
                   if doc['materials'][p['material']].get('name') in source.METAL_ROUGHNESS]
    else:
        preset = record['originalPreset'] if 'originalPreset' in record else None
        assert preset in source.PRESETS
        targets = []
        for part in ('outfit', 'legwear', 'footwear'):
            matches = [n['mesh'] for n in doc['nodes'] if n.get('name') == f'Human_{part}_LOD{lod}']
            assert len(matches) == 1, 'Missing or duplicate apparel mesh'
            targets.extend((matches[0], pi, part) for pi in range(len(doc['meshes'][matches[0]]['primitives'])))
    for mi, pi, part in targets:
        primitive = doc['meshes'][mi]['primitives'][pi]; original_index = primitive['material']
        material = before['materials'][original_index]; maps = []; role_rows = []
        if equipment:
            key = (original_index, 'equipment')
            if key not in cloned:
                copied = copy.deepcopy(material)
                copied['pbrMetallicRoughness']['roughnessFactor'] = source.METAL_ROUGHNESS[material['name']]
                # Logical names remain exact; all owned clones are receipt-bound.
                doc['materials'].append(copied); cloned[key] = len(doc['materials']) - 1
            next_index = cloned[key]
        else:
            texture = material['pbrMetallicRoughness']['baseColorTexture']
            # The inset rust hem is a separate UV1 map. Preserve it entirely.
            if texture.get('texCoord', 0) != 0:
                assert preset == 'woman-shawl' and part == 'legwear'; continue
            anchor_index = fold_source_material(record, mi, pi, original_index)
            anchor = before['materials'][anchor_index]
            colour_image = Image.open(io.BytesIO(read_image(image_for(before, texture)['uri']))); colour_image.load()
            mr_texture = material['pbrMetallicRoughness']['metallicRoughnessTexture']
            assert mr_texture.get('texCoord', 0) == 0
            mr_image = Image.open(io.BytesIO(read_image(image_for(before, mr_texture)['uri']))); mr_image.load()
            anchor_colour = Image.open(io.BytesIO(read_image(image_for(before, anchor['pbrMetallicRoughness']['baseColorTexture'])['uri']))); anchor_colour.load()
            anchor_mr = Image.open(io.BytesIO(read_image(image_for(before, anchor['pbrMetallicRoughness']['metallicRoughnessTexture'])['uri']))); anchor_mr.load()
            allowed = () if part == 'footwear' else cloth_pigments(preset, part, pilot, family)
            roles = tile_roles(anchor_colour, anchor_mr, allowed, part, source)
            assert colour_image.size == anchor_colour.size == mr_image.size
            next_colour, next_mr = colour_image.copy(), mr_image.copy()
            for (tx, ty), role in sorted(roles.items()):
                role_rows.append({'tile': [tx, ty], 'role': role})
                for y in range(source.TILE):
                    for x in range(source.TILE):
                        px, py = tx * source.TILE + x, ty * source.TILE + y
                        next_colour.putpixel((px, py), source.colour(colour_image.getpixel((px, py)), role, x, y))
                        next_mr.putpixel((px, py), source.metal_rough(mr_image.getpixel((px, py)), role, x, y))
            copied = copy.deepcopy(material)
            if next_colour.tobytes() != colour_image.tobytes():
                binding, uri, pin = append_map(material, texture, next_colour, 'Broad_Apparel_Pigment')
                copied['pbrMetallicRoughness']['baseColorTexture'] = binding; maps.append({'field': 'baseColorTexture', 'uri': uri, 'sha256': pin})
            if next_mr.tobytes() != mr_image.tobytes():
                binding, uri, pin = append_map(material, mr_texture, next_mr, 'Broad_Boot_Wear_Roughness')
                copied['pbrMetallicRoughness']['metallicRoughnessTexture'] = binding; maps.append({'field': 'metallicRoughnessTexture', 'uri': uri, 'sha256': pin})
            assert maps, 'No visible surface resource changed'
            doc['materials'].append(copied); next_index = len(doc['materials']) - 1
        primitive['material'] = next_index
        meta['primitives'].append({'mesh': mi, 'primitive': pi, 'part': part,
                                   'originalMaterial': original_index, 'material': next_index,
                                   'maps': maps, 'roles': role_rows})
    assert meta['primitives'], 'No apparel surface primitives selected'
    if not equipment and lod and record['originalPreset'] in ('friar', 'woman-shawl'):
        part = 'outfit' if record['originalPreset'] == 'friar' else 'legwear'
        mi = next(n['mesh'] for n in doc['nodes'] if n.get('name') == f'Human_{part}_LOD{lod}')
        keys = ['meshes', mi, 'extras', 'nativeClothTopology', 'sourceSha256']
        assert donor_hash and path_value(doc, keys) == record['nativeClothTopology']['sourceSha256']
        meta['documentPatches'].append({'path': keys, 'before': path_value(doc, keys), 'after': donor_hash})
        set_path(doc, keys, donor_hash)
        meta['recordPatches'].append({'path': ['nativeClothTopology', 'sourceSha256'],
                                     'before': record['nativeClothTopology']['sourceSha256'], 'after': donor_hash})
    doc.setdefault('extras', {})[FIELD] = meta
    restored, original_binary = restore_body(doc, binary, meta)
    assert restored == before and original_binary == bytes(binary)
    return doc, meta, textures


def prepare(root, presets=None, completed_only=False, include_equipment=True, allow_stale_donor=False):
    source, recipe = recipe_for(root)
    pilot = module('surface_pilot_recipe', root / 'assets/source/characters-3d/authoring/cloth_depth.py')
    family = module('surface_family_recipe', root / 'assets/source/characters-3d/authoring/family_cloth_depth.py')
    merge = module('surface_glb', root / 'tools/characters-3d/merge-animation-bank.py')
    presets = list(source.PRESETS if presets is None else presets)
    assert len(presets) == len(set(presets)) and set(presets) <= set(source.PRESETS)
    assets = root / 'web/public/models/characters'; mp = assets / 'manifest.json'
    manifest_bytes = mp.read_bytes(); manifest = json.loads(manifest_bytes); old_manifest = copy.deepcopy(manifest)
    pins, pending, textures, rows = {}, [], {}, []
    recipe_path = root / recipe['source']; pins[recipe_path] = recipe['sourceSha256']
    pins[root / 'tools/characters-3d/build-apparel-surfaces.py'] = recipe['installerSha256']
    for name, pin in recipe['foldSourceSha256'].items():
        pins[root / 'assets/source/characters-3d/authoring' / name] = pin

    def read_image(uri):
        assert uri.startswith('textures/') and '..' not in Path(uri).parts, 'Unexpected apparel image URI'
        path = assets / uri; raw = path.read_bytes(); pins[path] = sha(raw); return raw

    groups = [(preset, manifest['appearances'][preset]['lods']) for preset in presets]
    if include_equipment: groups.append(('equipment', [manifest['equipment']]))
    for preset, records in groups:
        donor_hash = None
        for record in sorted(records, key=lambda r: r.get('lod', 0)):
            path = assets / Path(record['url']).name; raw = path.read_bytes(); pins[path] = sha(raw)
            assert pins[path] == record['sha256'] and len(raw) == record['bytes'], 'Released surface differs from manifest: ' + path.name
            doc, binary = merge.read_glb(path); repeat = FIELD in record
            assert repeat == (FIELD in doc.get('extras', {})), 'Ambiguous completed apparel surface state'
            if completed_only and not repeat:
                if preset != 'equipment' and not record['lod']: donor_hash = pins[path]
                continue
            if repeat:
                meta = record[FIELD]
                assert meta['recipe'] == recipe, 'Changed apparel surface recipe; restore source before applying it'
                assert doc['extras'][FIELD] == meta
                for uri, pin in meta['originalImages'].items(): assert sha(read_image(uri)) == pin, 'Retained apparel source texture changed'
                before, original_binary = restore_body(doc, binary, meta); original_record = restore_record(record)
            else:
                before, original_binary, original_record = copy.deepcopy(doc), bytes(binary), copy.deepcopy(record)
                assert encode_glb(before, original_binary) == raw, 'Input GLB is not exactly restorable'
            input_record = copy.deepcopy(original_record)
            if preset != 'equipment': input_record['originalPreset'] = preset
            candidate_donor = donor_hash
            if repeat and allow_stale_donor and meta['documentPatches']:
                candidate_donor = meta['documentPatches'][0]['after']
            candidate, expected_meta, maps = build_candidate(root, assets, input_record, copy.deepcopy(before), bytearray(original_binary), source, recipe, pilot, family, read_image, candidate_donor, preset == 'equipment')
            expected = encode_glb(candidate, original_binary)
            for uri, png in maps.items(): assert uri not in textures or textures[uri] == png; textures[uri] = png
            if repeat:
                assert candidate == doc and expected_meta == meta and expected == raw, 'Delivered apparel surface differs from its recipe'
                for uri, png in maps.items(): assert read_image(uri) == png, 'Delivered apparel surface map changed'
            else:
                record.update(bytes=len(expected), sha256=sha(expected), apparelSurface=expected_meta)
                if preset in ('friar', 'woman-shawl') and record['lod']:
                    record['nativeClothTopology'] = copy.deepcopy(record['nativeClothTopology']); record['nativeClothTopology']['sourceSha256'] = donor_hash
                pending.append((path, expected))
            if preset != 'equipment' and not record['lod']: donor_hash = sha(expected)
            rows.append({'preset': preset, 'lod': record.get('lod'), 'url': record['url'], 'repeat': repeat,
                         'byteGrowth': len(expected) - len(raw), 'completeBinaryExact': True, 'exactTopLayerUnwind': True,
                         'selectedPrimitives': len(expected_meta['primitives'])})
    masked = copy.deepcopy(manifest)
    for preset in presets: masked['appearances'][preset] = old_manifest['appearances'][preset]
    if include_equipment: masked['equipment'] = old_manifest['equipment']
    assert masked == old_manifest, 'Unowned apparel manifest data changed'
    assert mp.read_bytes() == manifest_bytes and all(sha(p.read_bytes()) == pin for p, pin in pins.items()), 'Concurrent apparel surface input change'
    for uri, png in textures.items(): assert not (assets / uri).exists() or (assets / uri).read_bytes() == png, 'Content-addressed apparel surface collision'
    return {'manifest': manifest, 'originalManifest': old_manifest, 'manifestBytes': manifest_bytes, 'manifestPath': mp,
            'assets': assets, 'pins': pins, 'pending': pending, 'textures': textures, 'rows': rows, 'recipe': recipe}


def verify_completed(root, presets=None, allow_stale_donor=False):
    # Native private contexts may inspect the recorded coarse donor after an
    # explicit fresh close source job. All other layer bytes stay strict.
    return prepare(Path(root).resolve(), presets, completed_only=True,
                   include_equipment=presets is None, allow_stale_donor=allow_stale_donor)


def verify_equipment(root):
    root = Path(root).resolve()
    record = json.loads((root / 'web/public/models/characters/manifest.json').read_bytes())['equipment']
    if FIELD not in record: return None
    return prepare(root, [], completed_only=True, include_equipment=True)


def install(result):
    assert result['manifestPath'].read_bytes() == result['manifestBytes'] and all(sha(p.read_bytes()) == pin for p, pin in result['pins'].items()), 'Concurrent surface input change before installation'
    changed = {result['assets'] / uri: png for uri, png in result['textures'].items() if not (result['assets'] / uri).exists()}
    changed.update(dict(result['pending']))
    if result['pending']:
        text = subprocess.check_output(['node', '-e', "let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',v=>s+=v);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(JSON.parse(s),null,2)+String.fromCharCode(10)));"], input=json.dumps(result['manifest']), text=True)
        changed[result['manifestPath']] = text.encode()
    staged = []
    try:
        for path, raw in changed.items():
            path.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.NamedTemporaryFile(prefix='.apparel-surface-', dir=path.parent, delete=False) as out:
                out.write(raw); staged.append((path, Path(out.name)))
        for path, temporary in sorted(staged, key=lambda row: row[0] == result['manifestPath']): os.replace(temporary, path)
    finally:
        for _, temporary in staged: temporary.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[2]); parser.add_argument('--presets', nargs='+')
    parser.add_argument('--receipt', type=Path); parser.add_argument('--verify-only', action='store_true')
    equipment = parser.add_mutually_exclusive_group(); equipment.add_argument('--no-equipment', action='store_true'); equipment.add_argument('--include-equipment', action='store_true')
    args = parser.parse_args(); include_equipment = (args.presets is None or args.include_equipment) and not args.no_equipment
    result = prepare(args.root.resolve(), args.presets, args.verify_only, include_equipment)
    if not args.verify_only: install(result)
    if args.receipt:
        args.receipt.parent.mkdir(parents=True, exist_ok=True); args.receipt.write_text(json.dumps({'recipe': result['recipe'], 'rows': result['rows']}, indent=2) + '\n')
    print('APPAREL_SURFACES_READY', json.dumps({'changedFiles': 0 if args.verify_only else len(result['pending']), 'rows': result['rows']}))


if __name__ == '__main__': main()
