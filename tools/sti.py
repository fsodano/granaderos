#!/usr/bin/env python3
"""Encode PNG assets as JA2 STCI RGB565 surfaces or indexed ETRLE objects.

Binary layout follows engine/sgp/imgfmt.h and STCI.cpp. The 64-byte header
is serialized explicitly, independent of the host platform's C alignment.
Pillow is required only for PNG input/output and palette quantization.
"""
from __future__ import annotations
import argparse
import struct
from pathlib import Path

RGB = 4
INDEXED_ETRLE = 8 | 32


def header(width: int, height: int, original: int, stored: int, flags: int) -> bytearray:
    if not (0 < width <= 65535 and 0 < height <= 65535):
        raise ValueError('STCI dimensions must be between 1 and 65535')
    result = bytearray(64)
    struct.pack_into('<4sIIIIHH', result, 0, b'STCI', original, stored, 0, flags, height, width)
    return result


def encode_rgb565(width: int, height: int, pixels: bytes) -> bytes:
    if len(pixels) != width * height * 3:
        raise ValueError('RGB byte count does not match dimensions')
    data = bytearray()
    for r, g, b in zip(pixels[::3], pixels[1::3], pixels[2::3]):
        data.extend(struct.pack('<H', (r >> 3) << 11 | (g >> 2) << 5 | (b >> 3)))
    result = header(width, height, len(data), len(data), RGB)
    struct.pack_into('<IIIIBBBB', result, 24, 0xF800, 0x07E0, 0x001F, 0, 5, 6, 5, 0)
    result[44] = 16
    return bytes(result + data)


def encode_etrle(width: int, height: int, indices: bytes, palette: bytes) -> bytes:
    """Encode one object; palette index zero is reserved for transparency."""
    if len(indices) != width * height or len(palette) != 768:
        raise ValueError('Expected width*height indices and 256 RGB palette entries')
    data = bytearray()
    for y in range(height):
        row = indices[y * width:(y + 1) * width]
        x = 0
        while x < width:
            transparent = row[x] == 0
            end = x + 1
            while end < width and end - x < 127 and (row[end] == 0) == transparent:
                end += 1
            data.append((end - x) | (128 if transparent else 0))
            if not transparent:
                data.extend(row[x:end])
            x = end
        data.append(0)  # ETRLE line terminator
    result = header(width, height, width * height, len(data), INDEXED_ETRLE)
    struct.pack_into('<IHBBB', result, 24, 256, 1, 8, 8, 8)
    result[44] = 8
    obj = struct.pack('<IIhhHH', 0, len(data), 0, 0, height, width)
    return bytes(result) + palette + obj + data


def decode(data: bytes, frame: int = 0) -> tuple[int, int, bytes]:
    """Read RGB565 or indexed ETRLE into RGBA for validation and previews.

    Supports existing multi-frame engine assets as well as our single frames.
    Rejects malformed runs before they can silently desynchronize scanlines.
    """
    if len(data) < 64 or data[:4] != b'STCI':
        raise ValueError('Invalid STCI header')
    _, original, stored, transparent, flags, height, width = struct.unpack_from('<4sIIIIHH', data)
    if flags == RGB and data[44] == 16:
        if frame != 0 or original != width * height * 2 or stored != original or len(data) != 64 + stored:
            raise ValueError('Invalid RGB565 payload')
        if struct.unpack_from('<III', data, 24) != (0xF800, 0x07E0, 0x001F):
            raise ValueError('Unsupported RGB channel masks')
        out = bytearray()
        for (value,) in struct.iter_unpack('<H', data[64:]):
            r, g, b = value >> 11, (value >> 5) & 63, value & 31
            out.extend(((r << 3) | (r >> 2), (g << 2) | (g >> 4), (b << 3) | (b >> 2), 255))
        return width, height, bytes(out)
    if flags not in (INDEXED_ETRLE, INDEXED_ETRLE | 1) or data[44] != 8:
        raise ValueError('Unsupported STCI format')
    colors, frames = struct.unpack_from('<IH', data, 24)
    if colors != 256 or not 0 <= frame < frames:
        raise ValueError('Invalid palette size or frame index')
    offset = 64 + 768 + 16 * frames
    app_size = struct.unpack_from('<I', data, 48)[0]
    if len(data) < offset + stored + app_size:
        raise ValueError('Truncated indexed STCI')
    start, length, _, _, height, width = struct.unpack_from('<IIhhHH', data, 832 + 16 * frame)
    if start + length > stored:
        raise ValueError('Frame outside pixel payload')
    stream = data[offset + start:offset + start + length]
    pos = 0
    out = bytearray()
    for _ in range(height):
        x = 0
        while True:
            if pos >= len(stream):
                raise ValueError('Missing ETRLE line terminator')
            control = stream[pos]
            pos += 1
            if control == 0:
                if x != width:
                    raise ValueError('Short ETRLE scanline')
                break
            count = control & 127
            if count == 0 or x + count > width:
                raise ValueError('Invalid ETRLE run length')
            if control & 128:
                out.extend(bytes(count * 4))
            else:
                if pos + count > len(stream):
                    raise ValueError('Truncated ETRLE opaque run')
                for idx in stream[pos:pos + count]:
                    out.extend(data[64 + idx * 3:67 + idx * 3] + b'\xff')
                pos += count
            x += count
    if pos != len(stream):
        raise ValueError('Unexpected trailing frame data')
    return width, height, bytes(out)


def convert(source: Path, target: Path, size: tuple[int, int], mode: str, preview: Path | None = None):
    from PIL import Image, ImageOps
    with Image.open(source) as source_image:
        # Fit preserves aspect ratio, cropping minimally to the engine slot.
        im = ImageOps.fit(source_image.convert('RGBA'), size, method=Image.Resampling.LANCZOS)
    if mode == 'rgb565':
        if im.getchannel('A').getextrema()[0] < 255:
            raise ValueError('RGB565 cannot preserve alpha; use etrle for transparent assets')
        encoded = encode_rgb565(*size, im.convert('RGB').tobytes())
    else:
        paletted = im.convert('RGB').quantize(colors=255, method=Image.Quantize.MEDIANCUT)
        raw_palette = bytes(paletted.getpalette()[:765]).ljust(765, b'\x00')
        # Shift opaque indices by one; original darkest color remains opaque.
        indices = bytes(idx + 1 if alpha >= 128 else 0 for idx, alpha in zip(paletted.tobytes(), im.getchannel('A').tobytes()))
        encoded = encode_etrle(*size, indices, b'\x00\x00\x00' + raw_palette)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(encoded)
    width, height, rgba = decode(encoded)
    if preview:
        preview.parent.mkdir(parents=True, exist_ok=True)
        Image.frombytes('RGBA', (width, height), rgba).save(preview)
    return encoded


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('target', type=Path)
    parser.add_argument('--size', required=True, help='Engine dimensions, e.g. 640x480')
    parser.add_argument('--mode', choices=('rgb565', 'etrle'), default='rgb565')
    parser.add_argument('--preview', type=Path)
    args = parser.parse_args()
    size = tuple(int(v) for v in args.size.lower().split('x'))
    if len(size) != 2:
        parser.error('--size must be WIDTHxHEIGHT')
    convert(args.source, args.target, size, args.mode, args.preview)
    print(f'{args.target}: {size[0]}x{size[1]} {args.mode}')

if __name__ == '__main__':
    main()
