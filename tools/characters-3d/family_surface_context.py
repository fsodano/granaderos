"""Replay native surface passes privately when released family colours exist.

Completed colour receipts retain the exact pre-colour body and LOD record.
Restore those inputs in a complete private library, run the native pass there,
then rebuild family colours. Only fully checked final differences are installed.
An exact replay keeps the live files and manifest bytes untouched.
"""
from pathlib import Path
import copy
import hashlib
import importlib.util
import json
import os
import re
import struct
import subprocess
import sys
import tempfile


PRIVATE_ENV = 'GRANADEROS_FAMILY_SURFACE_PRIVATE_ROOT'
METADATA = 'familyClothDepth'
NATIVE_BODIES = {
    'build-reviewed-long-cloth-lods.py': {
        f'{preset}-lod{lod}.glb' for preset in ('friar', 'woman-shawl') for lod in (1, 2)
    },
    'build-woman-shawl-palette.py': {f'woman-shawl-lod{lod}.glb' for lod in (0, 1, 2)},
    'build-woman-shawl-hem.py': {f'woman-shawl-lod{lod}.glb' for lod in (0, 1, 2)},
}


def _sha(raw):
    return hashlib.sha256(raw).hexdigest()


def _module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def _asset_path(assets, url):
    name = Path(url).name
    assert url == '/models/characters/' + name, 'Unexpected native body URL'
    return assets / name


def _glb_doc(raw):
    assert len(raw) >= 28 and struct.unpack_from('<III', raw) == (0x46546c67, 2, len(raw)), 'Invalid native GLB'
    length, kind = struct.unpack_from('<II', raw, 12)
    assert kind == 0x4e4f534a and 20 + length <= len(raw), 'Invalid native GLB JSON'
    return json.loads(raw[20:20 + length])


def _completed_presets(manifest, assets, tool):
    presets = []
    for preset, appearance in manifest['appearances'].items():
        completed = False
        for record in appearance['lods']:
            path = _asset_path(assets, record['url'])
            # Source-pass fixtures may carry the complete manifest but only
            # their owned bodies. Inspect declared completed records and the
            # available native targets; unrelated missing bodies have no vote.
            if METADATA not in record and path.name not in NATIVE_BODIES[tool]:
                continue
            if not path.is_file():
                continue
            raw = path.read_bytes()
            assert _sha(raw) == record['sha256'] and len(raw) == record['bytes'], 'Body differs from retained manifest'
            document_metadata = _glb_doc(raw).get('extras', {}).get(METADATA)
            assert (METADATA in record) == (document_metadata is not None), 'Ambiguous completed family colour state'
            if METADATA in record:
                assert document_metadata == record[METADATA], 'Inconsistent completed family colour metadata'
                completed = True
        if completed:
            presets.append(preset)
    return presets


def _files(directory, excluded=()):
    return [path for path in directory.rglob('*') if path.is_file()
            and not set(path.relative_to(directory).parts).intersection(excluded)]


def _input_paths(root):
    paths = _files(root / 'web/public/models/characters')
    for relative in ('tools/characters-3d', 'web/lib', 'game'):
        paths.extend(_files(root / relative, ('__pycache__', '.build', 'node_modules')))
    # Native surface postpasses need source modules, not the large authoring
    # vendor bodies. Keep every top-level source module available for recipes.
    paths.extend(path for path in (root / 'assets/source/characters-3d/authoring').iterdir()
                 if path.is_file() and path.suffix in ('.py', '.json'))
    for relative in ('package.json', 'package-lock.json', 'web/package.json', 'web/package-lock.json',
                     'tests/published-actor-fixture.mjs', 'tests/tactical-render-loader.mjs'):
        path = root / relative
        if path.is_file():
            paths.append(path)
    return sorted(set(paths))


def _pins(root):
    return {str(path.relative_to(root)): _sha(path.read_bytes()) for path in _input_paths(root)}


def _check_pins(root, pins):
    assert _pins(root) == pins, 'Concurrent family surface input change'


def _copy_inputs(root, private, pins):
    for relative, digest in pins.items():
        raw = (root / relative).read_bytes()
        assert _sha(raw) == digest, 'Concurrent family surface input change during copy'
        target = private / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(raw)
    dependencies = root / 'web/node_modules'
    assert dependencies.is_dir(), 'Native surface review needs the current web dependencies'
    (private / 'web/node_modules').symlink_to(dependencies.resolve(), target_is_directory=True)
    _check_pins(root, pins)


def _restore_library(private, manifest, presets, installer):
    restored = copy.deepcopy(manifest)
    originals = []
    assets = private / 'web/public/models/characters'
    glb = _module('family_surface_glb', private / 'tools/characters-3d/merge-animation-bank.py')
    for preset in presets:
        for index, record in enumerate(restored['appearances'][preset]['lods']):
            if METADATA not in record:
                continue
            path = _asset_path(assets, record['url'])
            doc, binary = glb.read_glb(path)
            doc, binary = installer.restore_body(doc, binary, record[METADATA])
            original_record = installer.restore_record(record)
            assert METADATA not in original_record, 'Restored native record still has a family colour receipt'
            raw = glb.write_glb(path, doc, binary)
            assert _sha(raw) == original_record['sha256'] and len(raw) == original_record['bytes'], 'Native family body reconstruction differs from its receipt'
            restored['appearances'][preset]['lods'][index] = original_record
            originals.append((preset, index, raw, copy.deepcopy(original_record)))
    (assets / 'manifest.json').write_text(json.dumps(restored, indent=2) + '\n')
    return originals


def _retain_unchanged_native(private, originals):
    """Keep exact native bytes when a legacy pack only reindexes unused data."""
    assets = private / 'web/public/models/characters'
    manifest_path = assets / 'manifest.json'
    manifest = json.loads(manifest_path.read_bytes())
    glb = _module('family_surface_compare_glb', private / 'tools/characters-3d/merge-animation-bank.py')
    cloth = _module('family_surface_compare_proof', private / 'tools/characters-3d/build-long-cloth-support.py')
    retained = []
    for preset, index, original_raw, original_record in originals:
        record = manifest['appearances'][preset]['lods'][index]
        path = _asset_path(assets, record['url'])
        assert record['lod'] == original_record['lod'] and record['url'] == original_record['url'], 'Native pass changed restored body identity'
        current_raw = path.read_bytes()
        assert _sha(current_raw) == record['sha256'] and len(current_raw) == record['bytes'], 'Native pass output differs from its record'
        if current_raw == original_raw and record == original_record:
            continue
        permitted = copy.deepcopy(record)
        permitted.update(bytes=original_record['bytes'], sha256=original_record['sha256'])
        if permitted != original_record:
            continue
        # Both writers use the same GLB reader. Keep the original stream on
        # disk for this proof rather than normalizing any of its spare payload.
        with tempfile.TemporaryDirectory(prefix='granaderos-native-identity-') as folder:
            original_path = Path(folder) / path.name
            original_path.write_bytes(original_raw)
            before, before_binary = glb.read_glb(original_path)
        after, after_binary = glb.read_glb(path)
        if cloth.proof(before, before_binary, -1) != cloth.proof(after, after_binary, -1):
            continue
        path.write_bytes(original_raw)
        manifest['appearances'][preset]['lods'][index] = copy.deepcopy(original_record)
        retained.append(path.name)
    if retained:
        manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
    return retained


def _checked_outputs(live_assets, private_assets, before_manifest, next_manifest, allowed_bodies):
    before_files = {str(path.relative_to(live_assets)): path.read_bytes() for path in _files(live_assets)}
    next_files = {str(path.relative_to(private_assets)): path.read_bytes() for path in _files(private_assets)}
    assert before_files.keys() <= next_files.keys(), 'Private surface pass removed a released file'
    changed = {}
    for relative, raw in next_files.items():
        if before_files.get(relative) == raw:
            continue
        if relative == 'manifest.json':
            continue
        if relative in before_files:
            assert relative in allowed_bodies, 'Private surface pass changed an unowned body or texture: ' + relative
        else:
            assert re.fullmatch(r'textures/[0-9a-f]{20}\.png', relative), 'Unexpected private surface resource: ' + relative
            assert Path(relative).stem == _sha(raw)[:20], 'New surface texture name differs from its content'
        changed[relative] = raw
    permitted = copy.deepcopy(next_manifest)
    for preset, appearance in before_manifest['appearances'].items():
        next_appearance = permitted['appearances'][preset]
        assert len(next_appearance['lods']) == len(appearance['lods']), 'Private surface pass changed native LOD membership'
        for index, record in enumerate(appearance['lods']):
            following = next_appearance['lods'][index]
            assert following['lod'] == record['lod'] and following['url'] == record['url'], 'Private surface pass changed native LOD identity'
            path = _asset_path(private_assets, following['url'])
            if path.is_file():
                assert path.stat().st_size == following['bytes'] and _sha(path.read_bytes()) == following['sha256'], 'Private surface body differs from its manifest'
            else:
                assert path.name not in allowed_bodies, 'Private surface pass lost an owned body'
            if Path(record['url']).name in allowed_bodies:
                next_appearance['lods'][index] = copy.deepcopy(record)
    assert permitted == before_manifest, 'Private surface pass changed unowned manifest fields'
    if next_manifest != before_manifest:
        changed['manifest.json'] = next_files['manifest.json']
    else:
        assert not any(name.endswith('.glb') for name in changed), 'Changed native body has no manifest change'
    return changed


def _install(assets, changed):
    # Preflight every destination before installing any new map or body.
    for relative, raw in changed.items():
        path = assets / relative
        if relative.startswith('textures/') and path.exists():
            assert path.read_bytes() == raw, 'Content-addressed family texture collision'
    pending = []
    try:
        for relative, raw in changed.items():
            path = assets / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.NamedTemporaryFile(prefix='.family-surface-', dir=path.parent, delete=False) as staged:
                staged.write(raw)
                pending.append((path, Path(staged.name)))
        # Publish the manifest after all body and texture files are present.
        for path, staged in sorted(pending, key=lambda item: item[0].name == 'manifest.json'):
            os.replace(staged, path)
    finally:
        for _, staged in pending:
            staged.unlink(missing_ok=True)


def family_surface_context(tool, root, receipt=None):
    """Return True when a checked private replay handled this native pass."""
    root = Path(root).resolve()
    if os.environ.get(PRIVATE_ENV) == str(root):
        return False
    # A later surface layer must verify and unwrap itself before any frozen
    # family recipe or native postpass inspects its predecessor materials.
    from apparel_surface_context import apparel_surface_context
    if apparel_surface_context(tool, root, receipt):
        return True
    tool = Path(tool).name
    assert tool in NATIVE_BODIES, 'Unknown native surface postpass'
    assets = root / 'web/public/models/characters'
    manifest_bytes = (assets / 'manifest.json').read_bytes()
    manifest = json.loads(manifest_bytes)
    presets = _completed_presets(manifest, assets, tool)
    if not presets:
        return False
    pins = _pins(root)
    assert pins['web/public/models/characters/manifest.json'] == _sha(manifest_bytes), 'Concurrent family surface manifest change'
    installer = _module('family_surface_installer', root / 'tools/characters-3d/build-family-cloth-depth.py')
    # A selected fresh LOD0 legitimately leaves the old completed coarse
    # links stale until this native topology pass rebuilds them privately.
    installer.verify_completed(root, presets, allow_stale_donor=True)
    _check_pins(root, pins)
    with tempfile.TemporaryDirectory(prefix='granaderos-family-surface-') as folder:
        private = Path(folder).resolve()
        _copy_inputs(root, private, pins)
        originals = _restore_library(private, manifest, presets, installer)
        native_receipt = private / 'native-receipt.json'
        family_receipt = private / 'family-receipt.json'
        environment = dict(os.environ, **{PRIVATE_ENV: str(private)})
        subprocess.run([sys.executable, str(private / 'tools/characters-3d' / tool),
                        '--root', str(private), '--receipt', str(native_receipt)],
                       cwd=private, env=environment, check=True)
        retained_native = _retain_unchanged_native(private, originals)
        subprocess.run([sys.executable, str(private / 'tools/characters-3d/build-family-cloth-depth.py'),
                        '--root', str(private), '--presets', *presets, '--receipt', str(family_receipt)],
                       cwd=private, env=environment, check=True)
        installer.verify_completed(private, presets)
        private_assets = private / 'web/public/models/characters'
        next_manifest = json.loads((private_assets / 'manifest.json').read_bytes())
        allowed_bodies = NATIVE_BODIES[tool] | {
            Path(record['url']).name for preset in presets
            for record in manifest['appearances'][preset]['lods']
        }
        changed = _checked_outputs(assets, private_assets, manifest, next_manifest, allowed_bodies)
        _check_pins(root, pins)
        _install(assets, changed)
        if receipt:
            receipt = Path(receipt)
            receipt.parent.mkdir(parents=True, exist_ok=True)
            receipt.write_text(json.dumps({
                'method': 'private-native-surface-and-family-colour-replay',
                'nativePass': tool, 'presets': presets, 'changedFiles': sorted(changed),
                'retainedNativeFiles': retained_native,
                'nativeReceipt': json.loads(native_receipt.read_text()),
                'familyReceipt': json.loads(family_receipt.read_text()),
                'inputPins': pins, 'exactNoOp': not changed,
            }, indent=2) + '\n')
    print('FAMILY_SURFACE_CONTEXT_READY', tool, len(changed), 'files; checked private native replay')
    return True
