"""Prepare tintable CC0 skin without removing its chromatic facial detail.

Requires Pillow and NumPy. Reads only vendored source images. Does not download
assets or change native UVs.
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

VENDOR = Path(__file__).resolve().parent / 'vendor' / 'makehuman'


def save_if_changed(image, path):
    if path.exists():
        with Image.open(path) as existing:
            if existing.mode == image.mode and existing.size == image.size and existing.tobytes() == image.tobytes():
                return
    image.save(path)


def prepare(gender):
    image = Image.open(VENDOR / f'young_lightskinned_{gender}_diffuse.png').convert('RGB')
    rgb = np.asarray(image, dtype=np.float32) / 255
    # Remove the one overall skin pigment stored in the unused corner, not
    # the local red lips, warm cheeks, cool jaw and small colour gradients.
    reference = np.median(rgb[8:48, 8:48], axis=(0, 1))
    residual = np.maximum(.01, rgb / reference)
    colour = .90 * np.power(residual, .88)
    bright = colour > .94
    colour[bright] = .94 + .059 * (1 - np.exp(-(colour[bright] - .94) / .059))
    colour = np.clip(colour, 0, 1)
    save_if_changed(Image.fromarray(np.rint(colour * 255).astype(np.uint8)), VENDOR / f'skin-{gender}-colour.png')

    # Fine source grain contributes relief. Broad pigmentation must not turn
    # into dents, lumps or baked-in shadows.
    gray = image.convert('L')
    fine = (np.asarray(gray, dtype=np.float32) - np.asarray(gray.filter(ImageFilter.GaussianBlur(2)), dtype=np.float32)) / 255
    dy, dx = np.gradient(fine)
    nx, ny = np.clip(-dx * 1.4, -.11, .11), np.clip(dy * 1.4, -.11, .11)
    nz = np.sqrt(np.maximum(0, 1 - nx*nx - ny*ny))
    normals = np.stack((nx, ny, nz), axis=-1) * .5 + .5
    save_if_changed(Image.fromarray(np.rint(normals * 255).astype(np.uint8)), VENDOR / f'skin-{gender}-normal.png')

    # Redder regions receive a softer, moist sheen; skin is not uniformly
    # polished. Keep the spatial response restrained on every skin palette.
    red = np.clip((residual[..., 0] - residual[..., 1] - .025) * 2.5, 0, 1)
    luminance = np.mean(residual, axis=-1)
    rough = np.clip(.68 - .13 * red + .045 * (1 - luminance) + fine * .25, .53, .75)
    packed = np.stack((np.ones_like(rough), rough, np.zeros_like(rough)), axis=-1)
    save_if_changed(Image.fromarray(np.rint(packed * 255).astype(np.uint8)), VENDOR / f'skin-{gender}-roughness.png')


if __name__ == '__main__':
    for gender in ('male', 'female'):
        prepare(gender)
