"""Verify and unwrap the final apparel layer before predecessor surface work.

Released recipes remain frozen. Native postpasses operate on an exact private
predecessor, then reapply the apparel layer and install only checked differences.
The test snapshot exposes that same verified predecessor without live writes.
"""
from pathlib import Path
import copy
import json
import os
import shutil
import subprocess
import sys
import tempfile

from family_surface_context import (
    NATIVE_BODIES, _asset_path, _check_pins, _checked_outputs, _copy_inputs,
    _glb_doc, _install, _module, _pins, _sha,
)


FIELD = 'apparelSurface'
PRIVATE_ENV = 'GRANADEROS_APPAREL_SURFACE_PRIVATE_ROOT'
INSTALLER = 'build-apparel-surfaces.py'
LAYER_PASSES = {
    'build-cloth-depth.py': {f'{preset}-lod{lod}.glb' for preset in ('granadero', 'worker') for lod in (0, 1, 2)},
    'build-family-cloth-depth.py': {
        f'{preset}-lod{lod}.glb' for preset in ('royalist', 'surgeon', 'gaucho', 'friar', 'woman-scout', 'woman-shawl')
        for lod in (0, 1, 2)
    },
}
OWNED_PASSES = dict(NATIVE_BODIES, **LAYER_PASSES)


def _installer(root):
    return _module('apparel_surface_installer', root / 'tools/characters-3d' / INSTALLER)


def _completed(manifest, assets):
    """Find available released layers, including partial source-pass fixtures."""
    presets = []
    for preset, appearance in manifest['appearances'].items():
        completed = False
        for record in appearance['lods']:
            path = _asset_path(assets, record['url'])
            if not path.is_file():
                continue
            raw = path.read_bytes()
            assert _sha(raw) == record['sha256'] and len(raw) == record['bytes'], 'Apparel body differs from retained manifest'
            metadata = _glb_doc(raw).get('extras', {}).get(FIELD)
            assert (FIELD in record) == (metadata is not None), 'Ambiguous completed apparel state'
            if metadata is not None:
                assert metadata == record[FIELD], 'Inconsistent completed apparel metadata'
                completed = True
        if completed:
            presets.append(preset)
    equipment = manifest.get('equipment', {})
    equipment_path = _asset_path(assets, equipment['url']) if equipment.get('url') else None
    has_equipment = bool(equipment_path and equipment_path.is_file() and FIELD in equipment)
    if equipment_path and equipment_path.is_file():
        raw = equipment_path.read_bytes()
        assert _sha(raw) == equipment['sha256'] and len(raw) == equipment['bytes'], 'Apparel equipment differs from retained manifest'
        metadata = _glb_doc(raw).get('extras', {}).get(FIELD)
        assert (FIELD in equipment) == (metadata is not None), 'Ambiguous completed equipment apparel state'
        if metadata is not None:
            assert metadata == equipment[FIELD], 'Inconsistent completed equipment apparel metadata'
    return presets, has_equipment


def verify_layer(root, *, allow_stale_donor=False):
    """Verify the active top layer before exposing any predecessor state."""
    root = Path(root).resolve()
    assets = root / 'web/public/models/characters'
    manifest = json.loads((assets / 'manifest.json').read_bytes())
    presets, equipment = _completed(manifest, assets)
    if presets or equipment:
        installer = _installer(root)
        installer.verify_completed(root, presets, allow_stale_donor=allow_stale_donor)
        if equipment:
            installer.verify_equipment(root)
    return manifest, presets, equipment


def _restore_library(target, manifest, presets, equipment, installer, source_root):
    """Replace private files with exact retained raw predecessors and records."""
    restored = copy.deepcopy(manifest)
    assets = target / 'web/public/models/characters'
    glb = _module('apparel_predecessor_glb', source_root / 'tools/characters-3d/merge-animation-bank.py')
    originals = []
    records = [(restored['appearances'][preset]['lods'], index)
               for preset in presets for index, record in enumerate(restored['appearances'][preset]['lods'])
               if FIELD in record]
    if equipment:
        records.append((restored, 'equipment'))
    for parent, key in records:
        record = parent[key]
        path = _asset_path(assets, record['url'])
        doc, binary = glb.read_glb(path)
        doc, binary = installer.restore_body(doc, binary, record[FIELD])
        predecessor = installer.restore_record(record)
        assert FIELD not in predecessor and FIELD not in doc.get('extras', {}), 'Apparel restoration left an active top-layer receipt'
        # A snapshot may hardlink released inputs. Replace its directory entry
        # before writing so even a test cannot modify the released inode.
        path.unlink()
        raw = glb.write_glb(path, doc, binary)
        assert _sha(raw) == predecessor['sha256'] and len(raw) == predecessor['bytes'], 'Apparel predecessor raw body differs from its receipt'
        parent[key] = predecessor
        originals.append(path.name)
    manifest_path = assets / 'manifest.json'
    manifest_path.unlink()
    manifest_path.write_text(json.dumps(restored, indent=2) + '\n')
    return originals


def unwrap_body_and_record(root, preset, lod, *, allow_stale_donor=False):
    """Return a verified predecessor body/record without writing any files."""
    root = Path(root).resolve()
    assets = root / 'web/public/models/characters'
    manifest = json.loads((assets / 'manifest.json').read_bytes())
    record = next(row for row in manifest['appearances'][preset]['lods'] if row['lod'] == lod)
    glb = _module('apparel_predecessor_selected_glb', root / 'tools/characters-3d/merge-animation-bank.py')
    doc, binary = glb.read_glb(_asset_path(assets, record['url']))
    if FIELD in record:
        installer = _installer(root)
        installer.verify_completed(root, [preset], allow_stale_donor=allow_stale_donor)
        doc, binary = installer.restore_body(doc, binary, record[FIELD])
        record = installer.restore_record(record)
    else:
        assert FIELD not in doc.get('extras', {}), 'Unrecorded selected apparel layer'
    return doc, binary, copy.deepcopy(record)


def create_predecessor_snapshot(root, target, *, allow_stale_donor=False, link_assets=False):
    """Create a complete verified lower-layer snapshot for predecessor tests."""
    root, target = Path(root).resolve(), Path(target).resolve()
    assert target != root and not target.exists(), 'Predecessor snapshot needs a new private directory'
    pins = _pins(root)
    manifest, presets, equipment = verify_layer(root, allow_stale_donor=allow_stale_donor)
    _check_pins(root, pins)
    for relative, digest in pins.items():
        source = root / relative
        assert _sha(source.read_bytes()) == digest, 'Concurrent apparel snapshot input change'
        destination = target / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        if link_assets and relative.startswith('web/public/models/characters/'):
            os.link(source, destination)
        else:
            shutil.copy2(source, destination)
    dependencies = root / 'web/node_modules'
    if dependencies.is_dir():
        (target / 'web/node_modules').symlink_to(dependencies.resolve(), target_is_directory=True)
    _check_pins(root, pins)
    if presets or equipment:
        _restore_library(target, manifest, presets, equipment, _installer(root), root)
    _check_pins(root, pins)
    return {'method': 'verified-apparel-predecessor-snapshot', 'presets': presets,
            'equipment': equipment, 'root': str(target), 'releasedInputsExact': True}


def apparel_surface_context(tool, root, receipt=None, *, selected_presets=None):
    """Return True after a verified private layered native replay."""
    root = Path(root).resolve()
    if os.environ.get(PRIVATE_ENV) == str(root):
        return False
    tool = Path(tool).name
    assert tool in OWNED_PASSES, 'Unknown native apparel surface postpass'
    assert selected_presets is None or tool in LAYER_PASSES, 'Native topology passes own fixed targets'
    # Only the private replay permits coarse receipts from an explicitly fresh
    # donor. Normal verification and all completed output checks remain strict.
    pins = _pins(root)
    manifest, presets, equipment = verify_layer(root, allow_stale_donor=True)
    _check_pins(root, pins)
    # These passes never edit equipment. An equipment-only top layer does not
    # block their native body inputs or require a material replay.
    if not presets:
        return False
    assets = root / 'web/public/models/characters'
    with tempfile.TemporaryDirectory(prefix='granaderos-apparel-surface-') as folder:
        private = Path(folder).resolve()
        _copy_inputs(root, private, pins)
        restored = _restore_library(private, manifest, presets, equipment, _installer(root), root)
        native_receipt, apparel_receipt = private / 'native-receipt.json', private / 'apparel-receipt.json'
        environment = dict(os.environ, **{PRIVATE_ENV: str(private)})
        native_command = [sys.executable, str(private / 'tools/characters-3d' / tool),
                          '--root', str(private), '--receipt', str(native_receipt)]
        if selected_presets:
            native_command.extend(['--presets', *selected_presets])
        subprocess.run(native_command, cwd=private, env=environment, check=True)
        command = [sys.executable, str(private / 'tools/characters-3d' / INSTALLER),
                   '--root', str(private), '--presets', *presets, '--receipt', str(apparel_receipt)]
        if equipment:
            command.append('--include-equipment')
        subprocess.run(command, cwd=private, env=environment, check=True)
        installer = _installer(private)
        installer.verify_completed(private, presets)
        if equipment:
            installer.verify_equipment(private)
        private_assets = private / 'web/public/models/characters'
        next_manifest = json.loads((private_assets / 'manifest.json').read_bytes())
        owned = OWNED_PASSES[tool]
        if selected_presets:
            owned = {name for name in owned if any(name.startswith(preset + '-lod') for preset in selected_presets)}
        allowed = set(owned)
        if tool == 'build-reviewed-long-cloth-lods.py':
            # A freshly exported donor has no final layer yet. Rebuilding its
            # coarse dependents must finish that selected donor's folds and
            # apparel too; an already completed donor remains outside writes.
            for preset in ('friar', 'woman-shawl'):
                donor = next(row for row in manifest['appearances'][preset]['lods'] if row['lod'] == 0)
                if FIELD not in donor:
                    allowed.add(Path(donor['url']).name)
        changed = _checked_outputs(assets, private_assets, manifest, next_manifest, allowed)
        _check_pins(root, pins)
        _install(assets, changed)
        if receipt:
            path = Path(receipt); path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps({'method': 'private-native-family-and-apparel-replay',
                'nativePass': tool, 'presets': presets, 'equipment': equipment,
                'changedFiles': sorted(changed), 'exactNoOp': not changed,
                'restoredPredecessors': restored,
                'nativeReceipt': json.loads(native_receipt.read_text()),
                'apparelReceipt': json.loads(apparel_receipt.read_text()), 'inputPins': pins}, indent=2) + '\n')
    print('APPAREL_SURFACE_CONTEXT_READY', tool, len(changed), 'files; checked private layered replay')
    return True
