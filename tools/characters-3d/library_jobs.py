"""Validate a private selected-job batch before installing released files."""
from pathlib import Path
import hashlib, os, re, struct, tempfile
from library_manifest import digest, job_filename, strict_json


def current_job_pins(assets, jobs):
    names = [job_filename(job) for job in jobs]
    assert len(names) == len(set(names)), 'Duplicate source job'
    return {name: digest(assets / name) if (assets / name).exists() else None
            for name in names}


def prepared_job_files(staged, records):
    files = {}
    for name, record in records.items():
        path = staged / name
        raw = path.read_bytes()
        assert len(raw) >= 20 and struct.unpack_from('<III', raw) == (0x46546c67, 2, len(raw)), 'Invalid staged GLB'
        size, kind = struct.unpack_from('<II', raw, 12)
        assert kind == 0x4e4f534a and size % 4 == 0 and 20 + size <= len(raw), 'Invalid staged GLB JSON'
        doc = strict_json(raw[20:20 + size])
        assert len(raw) == record['bytes'] and hashlib.sha256(raw).hexdigest() == record['sha256'], 'Changed staged source receipt'
        primitives = [p for mesh in doc.get('meshes', []) for p in mesh['primitives']]
        triangles = sum(doc['accessors'][p['indices']]['count'] // 3 for p in primitives if 'indices' in p)
        assert triangles == record['triangles'] and len(primitives) == record['drawCalls'], 'Staged geometry receipt differs'
        files[name] = raw
        for image in doc.get('images', []):
            if 'uri' not in image:
                continue
            uri = image['uri']
            assert re.fullmatch(r'textures/[a-f0-9]{20}\.(png|jpg)', uri), 'Invalid staged texture path'
            texture = (staged / uri).read_bytes()
            assert hashlib.sha256(texture).hexdigest()[:20] == Path(uri).stem, 'Staged texture identity mismatch'
            assert uri not in files or files[uri] == texture, 'Conflicting staged texture'
            files[uri] = texture
    return files


def install_job_files(assets, files, pins):
    """Preflight the whole batch, then install textures before selected GLBs.

    A later I/O or postpass failure is not a transaction over the whole library.
    Worker/receipt failures never call this function.
    """
    assert {name for name in files if not name.startswith('textures/')} == set(pins), 'Unexpected selected output files'
    for name, raw in files.items():
        if name.startswith('textures/'):
            assert re.fullmatch(r'textures/[a-f0-9]{20}\.(png|jpg)', name), 'Invalid staged texture path'
            assert hashlib.sha256(raw).hexdigest()[:20] == Path(name).stem, 'Staged texture identity mismatch'
    for name, expected in pins.items():
        path = assets / name
        actual = digest(path) if path.exists() else None
        assert actual == expected, 'Released selected output changed during source jobs: ' + name
    for name, raw in files.items():
        if name.startswith('textures/') and (assets / name).exists():
            assert (assets / name).read_bytes() == raw, 'Released texture collision: ' + name
    for name, raw in sorted(files.items(), key=lambda item: not item[0].startswith('textures/')):
        path = assets / name
        if path.exists() and path.read_bytes() == raw:
            continue
        path.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(prefix='.' + path.name + '.', dir=path.parent, delete=False) as opened:
            temporary = Path(opened.name)
            try:
                opened.write(raw)
                opened.flush()
            except BaseException:
                temporary.unlink(missing_ok=True)
                raise
        try:
            os.chmod(temporary, path.stat().st_mode & 0o777 if path.exists() else 0o644)
            os.replace(temporary, path)
        finally:
            temporary.unlink(missing_ok=True)
