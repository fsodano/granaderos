"""Expose verified native and historical views below reversible garment layers.

The released recipes and installers are never changed. A native view verifies
apparel and fold layers before it removes them. A historical view also verifies
and removes the bounded geometry correction, then replays the frozen recipes.
Every restored body is replaced privately so linked snapshots cannot write into
released inodes. Normal views use strict donor identities.
"""
from pathlib import Path
import copy
import json
import os
import shutil
import subprocess
import sys
import tempfile

from family_surface_context import _asset_path, _check_pins, _module, _pins, _sha
from apparel_surface_context import create_predecessor_snapshot

FIELD = 'coarseGarmentSurface'


def _glb(root):
    return _module('coarse_context_glb', root / 'tools/characters-3d/merge-animation-bank.py')


def _encode(root, path, doc, binary):
    # A test snapshot may link assets. Always replace its directory entry first.
    path.unlink()
    return _glb(root).write_glb(path, doc, binary)


def restore_pilot(doc, binary, record, root):
    """Restore the frozen pilot using exactly its own retained references."""
    meta = record['clothDepth']; result = copy.deepcopy(doc)
    assert result.get('extras', {}).get('clothDepth') == meta, 'Inconsistent pilot lineage receipt'
    for item in meta['primitives']:
        primitive = result['meshes'][item['mesh']]['primitives'][item['primitive']]
        assert primitive['attributes']['COLOR_0'] == item['colourAccessor'] and primitive['material'] == item['material'], 'Changed pilot surface references'
        primitive['attributes']['COLOR_0'] = item['originalColourAccessor']; primitive['material'] = item['originalMaterial']
    for collection, count in [('accessors', 'originalAccessorCount'), ('bufferViews', 'originalViewCount'),
                              ('materials', 'originalMaterialCount'), ('textures', 'originalTextureCount'), ('images', 'originalImageCount')]:
        result[collection] = result[collection][:meta[count]]
    result['buffers'] = [{'byteLength': meta['originalBinaryBytes']}]
    del result['extras']['clothDepth']
    if not meta['originalHadExtras']: del result['extras']
    original_binary = bytes(binary[:meta['originalBinaryBytes']])
    pilot = _module('coarse_context_pilot', root / 'tools/characters-3d/build-cloth-depth.py')
    assert _sha(original_binary) == meta['originalBinarySha256'], 'Retained pilot binary changed'
    assert pilot.json_sha(result) == meta['originalJSONSha256'], 'Retained pilot JSON changed'
    predecessor = copy.deepcopy(record); del predecessor['clothDepth']
    raw = _module('coarse_context_encoder', root / 'tools/characters-3d/build-apparel-surfaces.py').encode_glb(result, original_binary)
    assert _sha(raw) == meta['beforeSha256'], 'Exact pilot predecessor differs from its historical anchor'
    predecessor.update(bytes=len(raw), sha256=meta['beforeSha256'])
    return result, original_binary, predecessor


def _verify_pilot(root, manifest):
    """Run the unmodified pilot verifier on only its completed records."""
    completed = {preset: [copy.deepcopy(record) for record in appearance['lods'] if 'clothDepth' in record and (root/'web/public/models/characters'/Path(record['url']).name).is_file()]
                 for preset, appearance in manifest['appearances'].items()}
    completed = {preset: records for preset, records in completed.items() if records}
    if not completed: return
    assets = root / 'web/public/models/characters'
    with tempfile.TemporaryDirectory(prefix='granaderos-pilot-lineage-') as folder:
        private = Path(folder); target = private / 'web/public/models/characters'; target.mkdir(parents=True)
        for source in assets.rglob('*'):
            if source.is_file() and source.name != 'manifest.json':
                destination = target / source.relative_to(assets); destination.parent.mkdir(parents=True, exist_ok=True)
                # The frozen verifier has no writes for completed records. Copy
                # selected bodies nevertheless so rejection cannot affect a pin.
                if source.suffix == '.glb': shutil.copy2(source, destination)
                else: destination.symlink_to(source.resolve())
        reduced = copy.deepcopy(manifest)
        for preset, appearance in reduced['appearances'].items(): appearance['lods'] = completed.get(preset, [])
        mp = target / 'manifest.json'; mp.write_text(json.dumps(reduced))
        authoring = private / 'assets/source/characters-3d/authoring'; authoring.mkdir(parents=True)
        shutil.copy2(root / 'assets/source/characters-3d/authoring/cloth_depth.py', authoring / 'cloth_depth.py')
        tools = private / 'tools/characters-3d'; tools.mkdir(parents=True)
        for name in ('build-cloth-depth.py', 'merge-animation-bank.py'):
            shutil.copy2(root / 'tools/characters-3d' / name, tools / name)
        before = {str(path.relative_to(target)): _sha(path.read_bytes()) for path in target.rglob('*') if path.is_file()}
        subprocess.run([sys.executable, str(tools / 'build-cloth-depth.py'), '--root', str(private), '--presets', *completed], check=True, capture_output=True, text=True)
        after = {str(path.relative_to(target)): _sha(path.read_bytes()) for path in target.rglob('*') if path.is_file()}
        assert before == after, 'Completed pilot verification attempted a write'


def unwrap_folds(root, *, allow_stale_donor=False):
    """Verify and remove existing folds from an already private apparel view."""
    root = Path(root).resolve(); assets = root / 'web/public/models/characters'; mp = assets / 'manifest.json'
    manifest = json.loads(mp.read_bytes()); glb = _glb(root)
    family = _module('coarse_context_family', root / 'tools/characters-3d/build-family-cloth-depth.py')
    presets = [preset for preset, appearance in manifest['appearances'].items()
               if any('familyClothDepth' in row for row in appearance['lods'])]
    if presets:
        from family_fold_context import verify_completed as verify_family
        verify_family(root,presets,allow_stale_donor=allow_stale_donor)
    _verify_pilot(root, manifest)
    restored = []
    for preset, appearance in manifest['appearances'].items():
        for index, record in enumerate(appearance['lods']):
            field = 'clothDepth' if 'clothDepth' in record else 'familyClothDepth' if 'familyClothDepth' in record else None
            path = _asset_path(assets, record['url'])
            if field is None or not path.is_file(): continue
            doc, binary = glb.read_glb(path)
            if field == 'clothDepth': doc, binary, predecessor = restore_pilot(doc, binary, record, root)
            else:
                doc, binary = family.restore_body(doc, binary, record[field]); predecessor = family.restore_record(record)
            raw = _encode(root, path, doc, binary)
            assert _sha(raw) == predecessor['sha256'] and len(raw) == predecessor['bytes'], 'Exact native fold predecessor differs'
            appearance['lods'][index] = predecessor; restored.append(path.name)
    if restored: mp.write_text(json.dumps(manifest, indent=2) + '\n')
    return restored


def create_native_snapshot(root, target, *, link_assets=False, allow_stale_donor=False):
    """Verify top colours, then expose native data with correction retained."""
    root, target = Path(root).resolve(), Path(target).resolve(); pins = _pins(root)
    apparel = create_predecessor_snapshot(root, target, link_assets=link_assets, allow_stale_donor=allow_stale_donor)
    restored = unwrap_folds(target, allow_stale_donor=allow_stale_donor)
    correction = _module('coarse_context_correction', root / 'tools/characters-3d/build-coarse-garment-surfaces.py')
    correction.verify_completed(target)
    _check_pins(root, pins)
    return {'method': 'verified-native-garment-snapshot', 'root': str(target), 'apparel': apparel,
            'restoredFolds': restored, 'correctionRetained': True, 'releasedInputsExact': True}


def restore_corrections(root):
    """Verify and restore every completed correction in a private native view."""
    root = Path(root).resolve(); correction = _module('coarse_context_restore', root / 'tools/characters-3d/build-coarse-garment-surfaces.py')
    correction.verify_completed(root)
    assets = root / 'web/public/models/characters'; mp = assets / 'manifest.json'; manifest = json.loads(mp.read_bytes()); restored = []
    glb = _glb(root)
    for appearance in manifest['appearances'].values():
        for index, record in enumerate(appearance['lods']):
            path = _asset_path(assets, record['url'])
            if FIELD not in record or not path.is_file(): continue
            doc, binary = glb.read_glb(path)
            doc, binary = correction.restore_body(doc, binary, record[FIELD]); predecessor = correction.restore_record(record)
            raw = _encode(root, path, doc, binary)
            assert _sha(raw) == predecessor['sha256'] and len(raw) == predecessor['bytes'], 'Exact garment correction predecessor differs'
            appearance['lods'][index] = predecessor; restored.append(path.name)
    if restored: mp.write_text(json.dumps(manifest, indent=2) + '\n')
    return restored


def _run_frozen(command):
    result=subprocess.run(command,capture_output=True,text=True)
    if result.returncode:raise RuntimeError('Frozen layer replay rejected: '+result.stderr[-6000:])


def replay_colours(root, *, stage='apparel', presets=None):
    assert stage in ('native', 'folds', 'apparel'), 'Unknown historical colour stage'
    if stage == 'native': return
    root = Path(root).resolve()
    # Historical snapshots can link already-native fresh bodies that had no
    # colour layer to detach. Frozen installers may write those bodies now.
    assets=root/'web/public/models/characters';manifest=json.loads((assets/'manifest.json').read_bytes())
    records=[row for preset,appearance in manifest['appearances'].items() if presets is None or preset in presets for row in appearance['lods']]
    if stage=='apparel' and presets is None:records.append(manifest.get('equipment',{}))
    for record in records:
        if not record.get('url'):continue
        path=_asset_path(assets,record['url'])
        if path.is_file() and path.stat().st_nlink>1:
            raw=path.read_bytes();path.unlink();path.write_bytes(raw)
    for layer, names in [('build-cloth-depth.py', ('granadero', 'worker')),
                         ('build-family-cloth-depth.py', ('royalist', 'surgeon', 'gaucho', 'friar', 'woman-scout', 'woman-shawl'))]:
        selected = [name for name in names if presets is None or name in presets]
        if selected:
            tool='family_fold_context.py' if layer=='build-family-cloth-depth.py' else layer
            _run_frozen([sys.executable,str(root/'tools/characters-3d'/tool),'--root',str(root),'--presets',*selected])
    if stage == 'apparel':
        command = [sys.executable, str(root / 'tools/characters-3d/build-apparel-surfaces.py'), '--root', str(root)]
        if presets: command.extend(['--presets', *presets])
        _run_frozen(command)


def create_historical_snapshot(root, target, *, stage='folds', link_assets=False):
    """Expose exact pre-correction recipe outputs without weakening live checks."""
    root = Path(root).resolve(); pins = _pins(root)
    native = create_native_snapshot(root, target, link_assets=link_assets)
    restored = restore_corrections(target)
    replay_colours(target, stage=stage)
    _check_pins(root, pins)
    return {'method': 'verified-historical-garment-snapshot', 'root': str(Path(target).resolve()),
            'stage': stage, 'native': native, 'restoredCorrections': restored, 'releasedInputsExact': True}


PRIVATE_ENV = 'GRANADEROS_COARSE_GARMENT_PRIVATE_ROOT'


def _recorded_patch(root, active_doc, active_binary, active_record, doc, binary, record):
    """Rebase the same verified owned patch after an authorized native pass."""
    correction = _module('coarse_context_rebase', root / 'tools/characters-3d/build-coarse-garment-surfaces.py')
    correction._verify_native(active_doc,active_binary,active_record,correction.recipe_for(root),root)
    meta = active_record[FIELD]; item = meta['primitive']; limits = correction.TARGETS[(meta['preset'],meta['lod'])]
    old_doc, old_binary = correction.restore_body(active_doc,active_binary,meta)
    old_primitive = old_doc['meshes'][item['mesh']]['primitives'][item['primitive']]
    mesh, primitive = correction.primitive_for(doc,meta['lod'])
    old_mask = item['oldOwnedTriangles']; current_mask = correction.owned_mask(doc,binary,primitive,limits['anchor'])
    assert old_mask == current_mask, 'Native pass changes owned garment membership'
    all_triangles = correction.triangles(old_doc,old_binary,old_primitive)
    assert correction.stream_hash(old_doc,old_binary,old_primitive,range(len(all_triangles))) == correction.stream_hash(doc,binary,primitive,range(len(correction.triangles(doc,binary,primitive)))), 'Native pass changes the retained outfit outside the bounded correction'
    active_primitive = active_doc['meshes'][item['mesh']]['primitives'][item['primitive']]
    count = item['originalVertexCount']; data = {key:correction.rows(active_doc,active_binary,index)[count:] for key,index in active_primitive['attributes'].items()}
    owned = correction.triangles(active_doc,active_binary,active_primitive)
    patch_triangles = [[vertex-count for vertex in owned[index]] for index in item['ownedTriangles']]
    patch_doc = copy.deepcopy(doc); patch_doc['meshes'] = [{'primitives':[{'attributes':{},'indices':0,'material':primitive['material']}]}]
    patch_doc.pop('extras',None); patch_doc['accessors']=[];patch_doc['bufferViews']=[];patch_binary=bytearray()
    pp = patch_doc['meshes'][0]['primitives'][0]
    skin=patch_doc['skins'][0];source_skin=doc['skins'][0]
    source_bind=doc['accessors'][source_skin['inverseBindMatrices']]
    skin['inverseBindMatrices']=correction.append_rows(patch_doc,patch_binary,source_bind,correction.rows(doc,binary,source_skin['inverseBindMatrices']))
    for key,values in data.items():
        source=active_doc['accessors'][active_primitive['attributes'][key]]
        pp['attributes'][key]=correction.append_rows(patch_doc,patch_binary,source,values)
    pp['indices']=correction.append_rows(patch_doc,patch_binary,{'type':'SCALAR','componentType':5123},[(vertex,) for triangle in patch_triangles for vertex in triangle],indices=True)
    # Keep the exact native skeleton; mesh references are irrelevant to this
    # private patch data reader and never enter the delivered body.
    patch_binary.extend(b'\0'*(-len(patch_binary)%4));patch_doc['buffers']=[{'byteLength':len(patch_binary)}]
    proposal = dict(meta['sourceProof'], preset=meta['preset'], lod=meta['lod'], role=meta['role'],
                    sourceMaterial=meta['sourceMaterial'],atlasAnchor=limits['anchor'],sourceTriangleRows=[])
    with tempfile.TemporaryDirectory(prefix='granaderos-recorded-coarse-patch-') as folder:
        folder=Path(folder);path=folder/'patch.glb';path.write_bytes(correction.encode_glb(patch_doc,patch_binary))
        for image in patch_doc.get('images',[]):
            destination=folder/image['uri'];destination.parent.mkdir(parents=True,exist_ok=True)
            destination.symlink_to((root/'web/public/models/characters'/image['uri']).resolve())
        sidecar=folder/'patch.json';sidecar.write_text(json.dumps(proposal))
        raw,rebased=correction.prepare_body(root,doc,binary,record,path,sidecar,recorded_source=True)
    # This replay reuses the recorded source patch. Preserve its source facts,
    # rather than inventing a new source authoring event from a private carrier.
    next_meta=rebased[FIELD];next_meta['sourcePatchSha256']=meta['sourcePatchSha256'];next_meta['sourceProposalSha256']=meta['sourceProposalSha256']
    with tempfile.TemporaryDirectory(prefix='granaderos-coarse-rebase-read-') as folder:
        path=Path(folder)/'body.glb';path.write_bytes(raw);next_doc,next_binary=_glb(root).read_glb(path)
    next_doc['extras'][FIELD]=next_meta;raw=correction.encode_glb(next_doc,next_binary);rebased.update(bytes=len(raw),sha256=_sha(raw))
    correction._verify_native(next_doc,next_binary,rebased,correction.recipe_for(root),root)
    return raw,rebased


def coarse_garment_context(tool,root,receipt=None,*,selected_presets=None):
    """Replay native work below verified correction and frozen colour layers."""
    from apparel_surface_context import OWNED_PASSES,LAYER_PASSES
    from family_surface_context import _checked_outputs,_install,_retain_unchanged_native
    root=Path(root).resolve();tool=Path(tool).name
    if os.environ.get(PRIVATE_ENV)==str(root):return False
    assert tool in OWNED_PASSES, 'Unknown coarse garment predecessor pass'
    assets=root/'web/public/models/characters';manifest=json.loads((assets/'manifest.json').read_bytes())
    if not any(FIELD in row and _asset_path(assets,row['url']).is_file() for appearance in manifest['appearances'].values() for row in appearance['lods']):return False
    pins=_pins(root)
    with tempfile.TemporaryDirectory(prefix='granaderos-coarse-native-replay-') as folder:
        private=Path(folder)/'root';create_native_snapshot(root,private,allow_stale_donor=True)
        private_assets=private/'web/public/models/characters';mp=private_assets/'manifest.json';native_manifest=json.loads(mp.read_bytes())
        active={};glb=_glb(private);correction=_module('coarse_context_replay',private/'tools/characters-3d/build-coarse-garment-surfaces.py')
        for preset,appearance in native_manifest['appearances'].items():
            for index,row in enumerate(appearance['lods']):
                path=_asset_path(private_assets,row['url'])
                if FIELD in row and path.is_file():
                    doc,binary=glb.read_glb(path)
                    active[(preset,index)]=(path.read_bytes(),doc,binary,copy.deepcopy(row))
        native_receipt=private/'native-receipt.json'
        if tool not in LAYER_PASSES:
            restore_corrections(private)
            native_manifest=json.loads(mp.read_bytes())
            originals=[(preset,index,_asset_path(private_assets,row['url']).read_bytes(),copy.deepcopy(row))
                       for preset,appearance in native_manifest['appearances'].items() for index,row in enumerate(appearance['lods']) if _asset_path(private_assets,row['url']).is_file()]
            environment=dict(os.environ,**{PRIVATE_ENV:str(private)})
            subprocess.run([sys.executable,str(private/'tools/characters-3d'/tool),'--root',str(private),'--receipt',str(native_receipt)],cwd=private,env=environment,check=True,capture_output=True,text=True)
            _retain_unchanged_native(private,originals)
            next_native=json.loads(mp.read_bytes())
            for (preset,index),(raw,active_doc,active_binary,active_record) in active.items():
                record=next_native['appearances'][preset]['lods'][index];path=_asset_path(private_assets,record['url'])
                predecessor=correction.restore_record(active_record)
                if path.read_bytes()==correction.encode_glb(*correction.restore_body(active_doc,active_binary,active_record[FIELD])) and record==predecessor:
                    next_raw,next_record=raw,active_record
                else:
                    doc,binary=glb.read_glb(path);next_raw,next_record=_recorded_patch(private,active_doc,active_binary,active_record,doc,binary,record)
                path.write_bytes(next_raw);next_native['appearances'][preset]['lods'][index]=next_record
            mp.write_text(json.dumps(next_native,indent=2)+'\n')
        correction.verify_completed(private)
        replay_colours(private)
        final=json.loads(mp.read_bytes());allowed=set(OWNED_PASSES[tool])
        if selected_presets:allowed={name for name in allowed if any(name.startswith(preset+'-lod') for preset in selected_presets)}
        if tool=='build-reviewed-long-cloth-lods.py':
            for preset in ('friar','woman-shawl'):
                donor=next(row for row in manifest['appearances'][preset]['lods'] if row['lod']==0)
                if 'apparelSurface' not in donor:allowed.add(Path(donor['url']).name)
        changed=_checked_outputs(assets,private_assets,manifest,final,allowed);_check_pins(root,pins);_install(assets,changed)
        result={'method':'private-correction-native-and-frozen-colour-replay','nativePass':tool,'changedFiles':sorted(changed),
                'exactNoOp':not changed,'correctionTargets':sorted(f'{preset}-lod{row[3]["lod"]}.glb' for (preset,index),row in active.items()),
                'nativeReceipt':json.loads(native_receipt.read_bytes()) if native_receipt.is_file() else None,'inputPins':pins}
        if receipt:Path(receipt).parent.mkdir(parents=True,exist_ok=True);Path(receipt).write_text(json.dumps(result,indent=2)+'\n')
    print('COARSE_GARMENT_CONTEXT_READY',tool,len(changed),'files; verified private correction replay')
    return True


def rebase_recorded_patch(root,active_doc,active_binary,active_record,doc,binary,record):
    """Public checked replay API for a recorded patch over a native predecessor."""
    return _recorded_patch(Path(root).resolve(),active_doc,active_binary,active_record,doc,binary,record)
