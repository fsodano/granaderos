"""Apply the reviewed head source without rebuilding unrelated appearance art.

Only appearance export calls this helper. Its source package is content checked;
accepted_faces then validates native rig compatibility and component boundaries.
"""
from pathlib import Path
import hashlib
import json

HERE = Path(__file__).resolve().parent
SOURCES = HERE / 'vendor' / 'reviewed-faces'


def apply_reviewed_face(path, preset, lod):
    from accepted_faces import compose_accepted_face

    path = Path(path)
    manifest = json.loads((SOURCES / 'manifest.json').read_text())
    key = f'{preset}-lod{lod}'
    if key not in manifest['sources']:
        raise ValueError(f'No reviewed face source for {key}')
    record = manifest['sources'][key]
    source = SOURCES / record['path']
    if source.resolve().parent != SOURCES.resolve():
        raise ValueError('Reviewed face source must be inside its source package')
    if hashlib.sha256(source.read_bytes()).hexdigest() != record['sha256']:
        raise ValueError(f'Reviewed face source changed: {key}')
    # Check exact packaged image bytes before a compositor can write a body.
    for name, expected in manifest['textures'].items():
        image = SOURCES / name
        if image.resolve().parent != (SOURCES / 'textures').resolve():
            raise ValueError('Reviewed face image must be inside its texture package')
        if hashlib.sha256(image.read_bytes()).hexdigest() != expected:
            raise ValueError(f'Reviewed face image changed: {name}')
    return compose_accepted_face(path, source, preset=preset)
