"""Broad apparel pigment and boot wear; no grain or woven normal changes.

This is an initial review recipe. Pixel ranges establish safe bounds; the
44/88 px comparison must establish whether the change is visible and useful.
All factors operate in linear light. A palette tile is 32 px with a 2 px UV
inset; a smooth field across the tile therefore remains broad after filtering.
"""
import math

PRESETS = ('granadero', 'worker', 'royalist', 'surgeon', 'gaucho', 'friar',
           'woman-scout', 'woman-shawl')
TILE = 32
INSET = 2
CLOTH_FACTOR_BOUNDS = (.82, 1.24)
BOOT_FACTOR_BOUNDS = (.96, 1.24)
BOOT_ROUGHNESS_BOUNDS = (.74, .82)
MAIN_CLOTH_ROUGHNESS_BYTES = (224, 232)
BOOT_PIGMENT = (35, 31, 27)
BOOT_ROUGHNESS_BYTE = 171
METAL_ROUGHNESS = {'Equipment_Blackened_Steel': .48,
                   'Equipment_Aged_Brass': .48}


def linear(byte):
    value = byte / 255
    return value / 12.92 if value <= .04045 else ((value + .055) / 1.055) ** 2.4


def encoded(value):
    value = max(0., min(1., value))
    srgb = value * 12.92 if value <= .0031308 else 1.055 * value ** (1 / 2.4) - .055
    return max(0, min(255, round(srgb * 255)))


def coordinates(x, y):
    span = TILE - 2 * INSET - 1
    return (max(0., min(1., (x - INSET) / span)),
            max(0., min(1., (y - INSET) / span)))


def cloth_factor(x, y):
    u, v = coordinates(x, y)
    # Two broad pigment regions. No light direction, high-frequency weave,
    # per-pixel randomness or isolated bright dots are introduced.
    distance = lambda value, centre: min(abs(value - centre), 1 - abs(value - centre))
    pale = math.exp(-((distance(u, .32) / .27) ** 2 + (distance(v, .36) / .34) ** 2))
    dark = math.exp(-((distance(u, .80) / .25) ** 2 + (distance(v, .79) / .32) ** 2))
    return max(CLOTH_FACTOR_BOUNDS[0], min(CLOTH_FACTOR_BOUNDS[1],
                                         1 + .24 * pale - .18 * dark))


def boot_wear(x, y):
    u, v = coordinates(x, y)
    distance = lambda value, centre: min(abs(value - centre), 1 - abs(value - centre))
    return math.exp(-((distance(u, .43) / .43) ** 2 + (distance(v, .62) / .46) ** 2))


def colour(pixel, role, x, y):
    if role == 'cloth':
        factor = cloth_factor(x, y)
        return tuple(encoded(linear(c) * factor) for c in pixel[:3]) + tuple(pixel[3:])
    if role == 'boot':
        wear = boot_wear(x, y)
        # A broad, restrained warm lift on already dark leather. Colour and
        # roughness share one region instead of painting random scratches.
        factors = (.96 + .28 * wear, .96 + .25 * wear, .96 + .22 * wear)
        return tuple(encoded(linear(c) * f) for c, f in zip(pixel[:3], factors)) + tuple(pixel[3:])
    raise ValueError('Unsupported apparel role: ' + role)


def metal_rough(pixel, role, x, y):
    if role == 'cloth':
        return tuple(pixel)  # Delivered cloth is already matte: retain exactly.
    if role == 'boot':
        rough = BOOT_ROUGHNESS_BOUNDS[0] + (BOOT_ROUGHNESS_BOUNDS[1] - BOOT_ROUGHNESS_BOUNDS[0]) * boot_wear(x, y)
        return (pixel[0], round(rough * 255), *pixel[2:])
    raise ValueError('Unsupported apparel role: ' + role)
