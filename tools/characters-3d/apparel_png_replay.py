#!/usr/bin/env python3
"""Replay the frozen apparel recipe without host-dependent PNG compression.

Approved pixels select their exact published PNG bytes from a pinned source
catalog. New pixels use unfiltered, stored-deflate PNG, whose bytes do not
depend on Pillow's bundled zlib. The frozen installer still checks every GLB,
material, map, predecessor receipt and destination collision byte for byte.
"""
from pathlib import Path
import argparse
import base64
import hashlib
import importlib.util
import io
import json
import struct
import zlib
from PIL import Image

CATALOG = 'assets/source/characters-3d/authoring/apparel_png_replay_v1.json'
CATALOG_SHA256 = '731b580c37b8f8b9a4465a05971c2e48748c5284dccccb5d537279039b149916'
FROZEN_COARSE_CONTEXT_SHA256 = 'b018629d072044a121550c9925d987dbf1095470b9aec56588c91de27ebe28bd'
ADAPTER_SHA256 = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def pixel_key(image):
    return (image.mode, image.size, sha(image.tobytes()))


def png_chunk(kind, raw):
    return struct.pack('>I', len(raw)) + kind + raw + struct.pack('>I', zlib.crc32(kind + raw) & 0xffffffff)


def deterministic_png(image):
    """Encode fresh RGB/RGBA pixels with a fully specified lossless stream."""
    assert image.mode in ('RGB', 'RGBA') and image.width > 0 and image.height > 0, 'Unsupported portable apparel image'
    width, height = image.size
    channels = 3 if image.mode == 'RGB' else 4
    pixels = image.tobytes()
    stride = width * channels
    assert len(pixels) == stride * height
    # PNG filter 0; DEFLATE stored blocks; fixed zlib header; no ancillary
    # metadata, compressor heuristics, timestamps or host encoder calls.
    scanlines = b''.join(b'\0' + pixels[y * stride:(y + 1) * stride] for y in range(height))
    blocks = []
    for offset in range(0, len(scanlines), 65535):
        raw = scanlines[offset:offset + 65535]
        final = offset + len(raw) == len(scanlines)
        blocks.append(bytes([int(final)]) + struct.pack('<HH', len(raw), len(raw) ^ 65535) + raw)
    packed = b'\x78\x01' + b''.join(blocks) + struct.pack('>I', zlib.adler32(scanlines) & 0xffffffff)
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 2 if channels == 3 else 6, 0, 0, 0)
    return b'\x89PNG\r\n\x1a\n' + png_chunk(b'IHDR', ihdr) + png_chunk(b'IDAT', packed) + png_chunk(b'IEND', b'')


def approved_images(root):
    raw = (root / CATALOG).read_bytes()
    assert sha(raw) == CATALOG_SHA256, 'Changed approved apparel PNG replay catalog'
    catalog = json.loads(raw)
    assert catalog['format'] == 'granaderos-apparel-png-replay' and catalog['version'] == 1
    installer = root / 'tools/characters-3d/build-apparel-surfaces.py'
    assert sha(installer.read_bytes()) == catalog['legacyInstallerSha256'], 'Changed frozen apparel installer'
    for name, pin in catalog['recipeSourceSha256'].items():
        assert sha((root / 'assets/source/characters-3d/authoring' / name).read_bytes()) == pin, 'Changed apparel surface recipe'
    images = {}
    for row in catalog['images']:
        png = base64.b64decode(row['pngBase64'], validate=True)
        assert len(png) == row['bytes'] and sha(png) == row['sha256'], 'Changed approved apparel PNG serialization'
        assert row['uri'] == 'textures/' + row['sha256'][:20] + '.png'
        with Image.open(io.BytesIO(png)) as image:
            image.load()
            key = pixel_key(image)
            assert image.format == 'PNG' and key == (row['mode'], tuple(row['size']), row['pixelSha256']), 'Changed approved apparel PNG pixels'
        assert key not in images, 'Ambiguous approved apparel PNG serialization'
        images[key] = png
    return catalog, images


def checked_adapter(root):
    # Compare with the identity captured when this module was loaded, not two
    # later reads of the same file after its executing code could be stale.
    assert sha(Path(__file__).read_bytes()) == ADAPTER_SHA256, 'Changed loaded portable apparel replay adapter'
    adapter = root / 'tools/characters-3d/apparel_png_replay.py'
    assert sha(adapter.read_bytes()) == ADAPTER_SHA256, 'Changed portable apparel replay adapter'
    return adapter


def portable_replay_command(command):
    """Redirect only the frozen apparel CLI, retaining every other argument."""
    if len(command) < 2 or Path(command[1]).name != 'build-apparel-surfaces.py':
        return command
    script = Path(command[1]).resolve()
    root = script.parents[2]
    assert script == root / 'tools/characters-3d/build-apparel-surfaces.py', 'Unexpected frozen apparel command'
    assert '--root' in command and Path(command[command.index('--root') + 1]).resolve() == root, 'Frozen apparel command has a different root'
    checked_adapter(root)
    approved_images(root)
    redirected = list(command)
    redirected[1] = str(root / 'tools/characters-3d/apparel_png_replay.py')
    return redirected


def bind_frozen_replay_commands():
    # The coarse receipt pins its context file. Keep that file byte-exact and
    # bind its narrow command runner externally after layer admission, just as
    # the frozen apparel module retains all code except the PNG serializer.
    import coarse_garment_context as context
    assert sha(Path(context.__file__).read_bytes()) == FROZEN_COARSE_CONTEXT_SHA256, 'Changed frozen coarse replay context'
    if getattr(context._run_frozen, 'portable_apparel_replay', False):
        return
    original = context._run_frozen

    def run(command):
        return original(portable_replay_command(command))

    run.portable_apparel_replay = True
    context._run_frozen = run


def load_installer(root):
    """Bind only the PNG serializer; retain the frozen recipe and verifier."""
    root = Path(root).resolve()
    adapter = checked_adapter(root)
    catalog, images = approved_images(root)
    bind_frozen_replay_commands()
    path = root / 'tools/characters-3d/build-apparel-surfaces.py'
    spec = importlib.util.spec_from_file_location('portable_frozen_apparel_installer', path)
    installer = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(installer)
    installer.png_bytes = lambda image: images.get(pixel_key(image)) or deterministic_png(image)
    pins = {Path(__file__).resolve(): ADAPTER_SHA256, adapter: ADAPTER_SHA256, root / CATALOG: CATALOG_SHA256}
    frozen_prepare = installer.prepare

    def prepare(requested_root, *args, **kwargs):
        assert Path(requested_root).resolve() == root, 'Portable apparel replay is bound to its verified root'
        assert all(sha(path.read_bytes()) == pin for path, pin in pins.items()), 'Concurrent portable apparel replay input change'
        result = frozen_prepare(root, *args, **kwargs)
        assert all(sha(path.read_bytes()) == pin for path, pin in pins.items()), 'Concurrent portable apparel replay input change'
        result['pins'].update(pins)
        return result

    installer.prepare = prepare
    installer.portable_png_replay = {
        'method': 'approved-exact-pixels-or-unfiltered-stored-deflate-v1',
        'adapterSha256': ADAPTER_SHA256,
        'catalogSha256': CATALOG_SHA256,
        'frozenInstallerSha256': catalog['legacyInstallerSha256'],
        'approvedImages': len(images),
    }
    return installer


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument('--presets', nargs='+')
    parser.add_argument('--receipt', type=Path)
    parser.add_argument('--verify-only', action='store_true')
    equipment = parser.add_mutually_exclusive_group()
    equipment.add_argument('--no-equipment', action='store_true')
    equipment.add_argument('--include-equipment', action='store_true')
    args = parser.parse_args()
    root = args.root.resolve()
    installer = load_installer(root)
    include_equipment = (args.presets is None or args.include_equipment) and not args.no_equipment
    result = installer.prepare(root, args.presets, args.verify_only, include_equipment)
    if not args.verify_only:
        installer.install(result)
    if args.receipt:
        args.receipt.parent.mkdir(parents=True, exist_ok=True)
        args.receipt.write_text(json.dumps({'recipe': result['recipe'], 'portablePNGReplay': installer.portable_png_replay,
                                           'rows': result['rows']}, indent=2) + '\n')
    print('APPAREL_SURFACES_READY', json.dumps({'changedFiles': 0 if args.verify_only else len(result['pending']),
                                             'portablePNGReplay': installer.portable_png_replay, 'rows': result['rows']}))


if __name__ == '__main__':
    main()
