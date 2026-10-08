"""Keep current library records unless an explicit checked source job rebuilt them."""
from pathlib import Path
import copy
import hashlib
import json


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def job_filename(job):
    kind, preset, lod = job
    gender = 'female' if preset.startswith('woman-') else 'male'
    if kind == 'appearance':
        return f'{preset}-lod{lod}.glb'
    if kind in ('animations', 'garments'):
        return f'{gender}-{kind}.glb'
    if kind == 'horse':
        return f'horse-lod{lod}.glb'
    assert kind == 'equipment'
    return 'equipment.glb'


def checked_job_records(metadata, assets, jobs):
    """Read exact requested receipts; stale or unrelated cache files have no vote."""
    names = [job_filename(job) for job in jobs]
    assert len(set(names)) == len(names), 'Duplicate source job'
    records = {}
    for job, name in zip(jobs, names):
        kind, preset, lod = job
        record = json.loads((metadata / (Path(name).stem + '.json')).read_text())
        assert record['kind'] == kind and Path(record['url']).name == name, 'Wrong source receipt identity'
        if kind in ('appearance', 'garments', 'animations'):
            assert record['preset'] == preset, 'Wrong source receipt preset'
        if kind in ('appearance', 'horse'):
            assert record['lod'] == lod, 'Wrong source receipt LOD'
        path = assets / name
        assert path.stat().st_size == record['bytes'] and digest(path) == record['sha256'], 'Stale source receipt'
        records[name] = record
    return records


def checked_manifest(manifest, assets):
    records = [record for appearance in manifest.get('appearances', {}).values() for record in appearance['lods']]
    records += list(manifest.get('animationLibraries', {}).values())
    records += manifest.get('horse', {}).get('lods', [])
    if manifest.get('equipment', {}).get('sha256'):
        records.append(manifest['equipment'])
    for record in records:
        path = assets / Path(record['url']).name
        assert path.stat().st_size == record['bytes'] and digest(path) == record['sha256'], 'Asset differs from retained manifest: ' + path.name
    return manifest


def replace_lod(records, incoming):
    result = copy.deepcopy(records)
    requested_lod(result, incoming['lod'])
    index = next(i for i, record in enumerate(result) if record['lod'] == incoming['lod'])
    if result[index]['sha256'] == incoming['sha256']:
        assert all(result[index][key] == incoming[key] for key in incoming), 'Receipt contradicts identical retained body'
        return result
    # A fresh body must obtain newly measured support in the ordered postpasses;
    # old geometry-specific fields must not be attached to a regenerated mesh.
    result[index] = copy.deepcopy(incoming)
    return result


def requested_lod(records, lod):
    selected = [record for record in records if record['lod'] == lod]
    assert len(selected) == 1, f'Missing or duplicate requested LOD {lod}'
    return selected[0]


def merge_job_manifest(previous, generated, assets, jobs):
    if not previous:
        assert generated['complete'], 'A partial build needs a complete current library manifest'
        return checked_manifest(generated, assets)
    assert previous['complete'], 'A partial build needs a complete current library manifest'
    result = copy.deepcopy(previous)
    for kind, preset, lod in jobs:
        if kind == 'appearance':
            incoming = generated['appearances'][preset]
            fresh = requested_lod(incoming['lods'], lod)
            result['appearances'][preset]['lods'] = replace_lod(result['appearances'][preset]['lods'], fresh)
            if lod == 0:
                result['appearances'][preset]['sockets'] = copy.deepcopy(incoming['sockets'])
        elif kind in ('animations', 'garments'):
            gender = 'female' if preset.startswith('woman-') else 'male'
            key = 'animationLibraries' if kind == 'animations' else 'garments'
            result[key][gender] = copy.deepcopy(generated[key][gender])
        elif kind == 'equipment':
            result['equipment'] = copy.deepcopy(generated['equipment'])
        else:
            assert kind == 'horse'
            fresh = requested_lod(generated['horse']['lods'], lod)
            result['horse']['lods'] = replace_lod(result['horse']['lods'], fresh)
            if lod == 0:
                for key in ('height', 'saddle', 'clips'):
                    result['horse'][key] = copy.deepcopy(generated['horse'][key])
    # The current manifest is authoritative for every untouched field, including
    # all native support metadata, body triangle counts and final anchor space.
    return checked_manifest(result, assets)
