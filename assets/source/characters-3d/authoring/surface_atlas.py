"""Deterministic, restrained PBR surface tiles for the shared apparel atlas.

Large folds and seams belong to the fitted mesh. These tiles supply only fibre,
grain and finish variation, so downsampling keeps the authored uniform colours.
Blender ships NumPy; no external texture service or generated image is used.
"""
import math
import numpy as np

TILE_SIZE = 128
TILE_GUTTER = 4


def surface_kind(name, metallic):
    name = name.lower()
    if metallic > .35:
        return 'metal'
    if any(word in name for word in ('pupil', 'iris', 'eye_white', 'nail')):
        return 'smooth'
    if 'hair' in name:
        return 'hair'
    if any(word in name for word in ('leather', 'boot', 'sole')):
        return 'leather'
    if any(word in name for word in ('wood', 'walnut')):
        return 'wood'
    if any(word in name for word in ('felt', 'plume', 'fibre')):
        return 'felt'
    if any(word in name for word in ('cord', 'braid', 'rope')):
        return 'braid'
    if any(word in name for word in ('wool', 'trousers', 'facings', 'linen', 'cloth', 'crossbelt', 'shirt', 'cotton')):
        return 'cloth'
    return 'smooth'


def _grain(x, y, salt=0):
    # Integer arithmetic gives identical surfaces across processes and platforms.
    a = (x.astype(np.uint32) * np.uint32(374761393)
         + y.astype(np.uint32) * np.uint32(668265263)
         + np.uint32(salt * 982451653 & 0xffffffff))
    a = (a ^ (a >> 13)) * np.uint32(1274126177)
    a ^= a >> 16
    return (a & np.uint32(65535)).astype(np.float32) / 65535 - .5


def surface_tile(name, colour, roughness, metallic, size=TILE_SIZE):
    """Return colour (sRGB), packed rough/metal, and tangent normal float tiles."""
    n = size - 2 * TILE_GUTTER
    y, x = np.mgrid[:n, :n].astype(np.float32)
    u, v = x / n, y / n
    grain = _grain(x, y)
    broad = (.6 * np.sin(math.tau * (u * 3 + v * 2))
             + .4 * np.cos(math.tau * (u * 7 - v * 5)))
    kind = surface_kind(name, metallic)
    shade = np.ones((n, n), dtype=np.float32)
    rough = np.full((n, n), roughness, dtype=np.float32)
    height = np.zeros((n, n), dtype=np.float32)
    if kind in ('cloth', 'braid'):
        # Fine crossing fibres, with different thread heights at each crossing.
        # Their low contrast avoids a screen-wide grain filter at game scale.
        warp = np.cos(math.tau * u * (n / 3))
        weft = np.cos(math.tau * v * (n / 3))
        weave = warp * weft
        if kind == 'braid':
            weave = np.sin(math.tau * (u * 18 + v * 12)) * .7 + weave * .3
        shade += .012 * weave + .035 * grain + .014 * broad
        rough += .040 * grain + .018 * weave
        height = .025 * weave + .065 * grain
    elif kind == 'felt':
        shade += .035 * grain + .008 * broad
        rough += .025 * grain
        height = .13 * grain
    elif kind == 'leather':
        pores = _grain(x // 2, y // 2, 2)
        shade += .032 * pores + .022 * grain + .012 * broad
        rough += .085 * pores + .025 * grain
        height = .11 * pores + .045 * grain
    elif kind == 'metal':
        # A polished but worn finish: no painted black scratches or fake edges.
        lines = _grain(x, np.zeros_like(y), 3)
        shade += .015 * grain + .010 * broad
        rough += .055 * lines + .025 * grain
        height = .008 * lines
    elif kind == 'hair':
        strands = .6 * np.cos(math.tau * u * 40 + .8 * np.sin(math.tau * v * 2)) + .4 * _grain(x, y // 12, 4)
        shade += .050 * strands + .016 * broad
        rough += .025 * strands
        height = .035 * strands
    elif kind == 'wood':
        fibres = np.sin(math.tau * (u * 12 + .10 * np.sin(math.tau * v)))
        shade += .036 * fibres + .025 * grain
        rough += .030 * fibres
        height = .015 * fibres
    linear = np.clip(np.asarray(colour[:3])[None, None, :] * shade[:, :, None], 0, 1)
    srgb = np.where(linear <= .0031308, linear * 12.92, 1.055 * linear ** (1 / 2.4) - .055)
    colour_pixels = np.concatenate((srgb, np.ones((n, n, 1))), axis=2)
    packed = np.ones((n, n, 4), dtype=np.float32)
    packed[:, :, 1] = np.clip(rough, .06, 1)
    packed[:, :, 2] = metallic
    # Central derivatives keep the micro-normal direction consistent with UVs.
    nx = -(np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * .5
    ny = -(np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * .5
    normal = np.stack((nx, ny, np.ones_like(nx)), axis=2)
    normal /= np.linalg.norm(normal, axis=2)[:, :, None]
    normal_pixels = np.concatenate((normal * .5 + .5, np.ones((n, n, 1))), axis=2)
    # Replicate edge texels into a real gutter. This prevents material colours
    # leaking across tiles at the normal near/mid review distances.
    def padded(pixels):
        return np.pad(pixels, ((TILE_GUTTER, TILE_GUTTER), (TILE_GUTTER, TILE_GUTTER), (0, 0)), mode='edge').astype(np.float32)
    return {'Color': padded(colour_pixels), 'MetalRough': padded(packed), 'Normal': padded(normal_pixels)}


def atlas_pixels(sources, side, tile=TILE_SIZE):
    size = side * tile
    result = {channel: np.ones((size, size, 4), dtype=np.float32) for channel in ('Color', 'MetalRough', 'Normal')}
    result['Normal'][:, :, :3] = (.5, .5, 1)
    for index, material in enumerate(sources):
        shader = material.node_tree.nodes.get('Principled BSDF')
        tiles = surface_tile(material.name, material.diffuse_color, shader.inputs['Roughness'].default_value, shader.inputs['Metallic'].default_value, tile)
        x, y = index % side * tile, index // side * tile
        for channel, pixels in tiles.items():
            result[channel][y:y + tile, x:x + tile] = pixels
    return result
