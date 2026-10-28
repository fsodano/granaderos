"""Broad cloth form tones for the first tactical character surface pilot.

Coordinates are the released GLTF rest mesh: metres, +Y up, +Z forward.
The field follows sewn folds, rather than baking a camera or light direction.
Apply only to the named base cloth pigments. Uniform trim, skin, leather and
all fitted equipment keep their original colours and surface resources.
"""
import math

PRESETS = ('granadero', 'worker')
PIGMENTS = {
    'granadero': {'outfit': ((35, 44, 59),), 'legwear': ((38, 46, 58),)},
    'worker': {'outfit': ((173, 162, 137), (101, 86, 67)),
               'legwear': ((101, 86, 67),)},
}
MIN_FACTOR = .76
MAX_FACTOR = 1.48
NAVY_ALBEDO_HEADROOM = 1.52


def srgb_linear(value):
    value = value / 255
    return value / 12.92 if value <= .04045 else ((value + .055) / 1.055) ** 2.4


def headroom_pigment(pigment, preset):
    if preset != 'granadero' or tuple(pigment) not in PIGMENTS[preset]['outfit'] + PIGMENTS[preset]['legwear']:
        return tuple(pigment)
    result = []
    for value in pigment:
        linear = srgb_linear(value) * NAVY_ALBEDO_HEADROOM
        encoded = linear * 12.92 if linear <= .0031308 else 1.055 * linear ** (1 / 2.4) - .055
        result.append(round(encoded * 255))
    return tuple(result)


def gauss(value, centre, width):
    return math.exp(-((value - centre) / width) ** 2)


def cloth_factor(position, part, preset='worker'):
    """Restrained fold valleys with broad, small highlights at their edges."""
    x, height, front = position
    if part == 'outfit':
        waist = gauss(height, 1.08, .075) * gauss(abs(x), .10, .16)
        underarm = gauss(abs(x), .17, .075) * gauss(height, 1.34, .09)
        # Native rest arms lie beside the torso; this bounded envelope follows
        # the sleeve near each elbow and does not tint cuffs or uniform trim.
        elbow = gauss(abs(x), .23, .08) * gauss(height, 1.10, .13)
        phase = height * 76 + abs(x) * 34 + front * 12
        strength = .14 * waist + .12 * underarm + .15 * elbow
        compressed = .04 * underarm + .03 * waist
    elif part == 'legwear':
        knee = gauss(height, .54, .105)
        hip = gauss(height, .87, .095)
        phase = height * 88 + abs(x) * 24 + front * 14
        strength = .19 * knee + .09 * hip
        compressed = .015 * knee
    else:
        raise ValueError('Unsupported cloth part: ' + part)
    valley = max(0, math.sin(phase)) ** 1.25
    ridge = max(0, -math.sin(phase))
    envelope = min(1, strength / .15)
    if preset == 'granadero':
        # Navy needs actual albedo headroom. The retained dark atlas otherwise
        # clips normalized vertex highlights before they reach the light.
        return max(.82, min(MAX_FACTOR, 1.20 - strength * 1.65 * valley - compressed + .23 * ridge * envelope))
    return max(MIN_FACTOR, min(1.04, 1 - strength * valley - compressed + .035 * ridge * envelope))


def toned_colour(colour, position, part, pigment, preset):
    if tuple(pigment) not in PIGMENTS[preset][part]:
        return tuple(colour)
    factor = cloth_factor(position, part, preset)
    lifted = headroom_pigment(pigment, preset)
    compensation = tuple(srgb_linear(old) / srgb_linear(new) if new else 1 for old, new in zip(pigment, lifted))
    return tuple(max(0, min(1, value * factor * headroom)) for value, headroom in zip(colour[:3], compensation)) + tuple(colour[3:])
