"""Frozen garment form recipe for the six remaining tactical appearances.

Released GLTF rest coordinates are metres, +Y up, +Z forward. Pigments are
selected by garment role. Radial form follows the authored hanging panels;
the rust hem and a connected triangle buffer keep their previous colours.
No camera, light direction, weave or surface roughness is baked here.
"""
import math

PRESETS = ('royalist', 'surgeon', 'gaucho', 'friar', 'woman-scout', 'woman-shawl')
PIGMENTS = {
    'royalist': {'outfit': ((206, 199, 179),), 'legwear': ((202, 194, 175),)},
    'surgeon': {'outfit': ((74, 58, 49),), 'legwear': ((64, 56, 51),)},
    'gaucho': {'outfit': ((111, 88, 61),), 'legwear': ((64, 58, 49),)},
    'friar': {'outfit': ((86, 63, 41),), 'legwear': ((86, 63, 41),)},
    'woman-scout': {'outfit': ((91, 100, 74),), 'legwear': ((149, 139, 118),)},
    'woman-shawl': {'outfit': ((200, 188, 162), (91, 44, 53)), 'legwear': ((49, 48, 49),)},
}
HEADROOM = {'royalist': {'outfit': 1., 'legwear': 1.},
            'surgeon': {'outfit': 1.30, 'legwear': 1.30},
            'gaucho': {'outfit': 1.20, 'legwear': 1.25},
            'friar': {'outfit': 1.30, 'legwear': 1.30},
            'woman-scout': {'outfit': 1., 'legwear': 1.},
            'woman-shawl': {'outfit': 1., 'legwear': 1.}}
MIN_FACTOR, MAX_FACTOR = .70, 1.26


def linear(value):
    value /= 255
    return value / 12.92 if value <= .04045 else ((value + .055) / 1.055) ** 2.4


def headroom_pigment(pigment, preset, part):
    if tuple(pigment) not in PIGMENTS[preset][part]:
        return tuple(pigment)
    amount = HEADROOM[preset][part]
    if amount == 1:
        return tuple(pigment)
    result = []
    for value in pigment:
        v = linear(value) * amount
        result.append(round((v * 12.92 if v <= .0031308 else 1.055 * v ** (1 / 2.4) - .055) * 255))
    return tuple(result)


def gauss(value, centre, width):
    return math.exp(-((value - centre) / width) ** 2)


def component_at_hem(positions, indices, bottom):
    adjacent = [set() for _ in positions]
    assert len(indices) % 3 == 0
    for offset in range(0, len(indices), 3):
        a, b, c = indices[offset:offset + 3]
        for u, v in ((a, b), (b, c), (c, a)):
            adjacent[u].add(v); adjacent[v].add(u)
    seeds = {i for i, point in enumerate(positions) if abs(point[1] - bottom) < .002}
    assert seeds, 'Missing authored hanging-cloth hem'
    selected = {next(iter(seeds))}; queue = list(selected)
    for current in queue:
        for neighbour in adjacent[current] - selected:
            selected.add(neighbour); queue.append(neighbour)
    assert seeds <= selected and len(selected) > 20, 'Ambiguous hanging-cloth component'
    return selected, adjacent


def selections(preset, part, positions, indices, colour_uvs, hem=None):
    """Return authored drape vertices and an unchanged UV1 stripe buffer."""
    drape, protected = set(), set()
    if preset == 'friar' and part == 'outfit':
        drape, _ = component_at_hem(positions, indices, .09)
        assert len(drape) == 675, 'Changed reviewed friar sewn surface'
    elif preset == 'gaucho' and part == 'outfit':
        drape, _ = component_at_hem(positions, indices, .89)
        assert max(positions[i][1] for i in drape) > 1.45, 'Missing shoulder panel'
    elif preset == 'woman-shawl' and part == 'legwear':
        assert hem and hem['colourTexCoord'] == 1 and hem['rustRows'] == [231, 236]
        drape, adjacent = component_at_hem(positions, indices, .10)
        assert len(drape) == hem['sewnSkirtVertexCount'] == 675
        height = hem['imageSize'][1]; low, high = hem['rustRows']
        # Include the filtered map boundary. Sparse triangles can cross the
        # stripe even when none of their vertices samples a rust pixel.
        for offset in range(0, len(indices), 3):
            triangle = indices[offset:offset + 3]
            if all(i in drape for i in triangle):
                ys = [colour_uvs[i][1] * height for i in triangle]
                if min(ys) <= high + 1 and max(ys) >= low - 1:
                    protected.update(triangle)
        assert protected, 'Missing native rust stripe triangles'
        protected |= {n for i in tuple(protected) for n in adjacent[i]}
        assert protected <= drape
    return drape, protected


def drape_factor(position, preset):
    x, height, front = position
    if preset == 'gaucho':
        t = max(0, min(1, (1.53 - height) / .64))
        ease = min(1, t * 4.6); ease = ease * ease * (3 - 2 * ease)
        rx = .083 + (.245 - .083) * ease + (.36 - .245) * t
        ry = .092 + (.22 - .092) * ease
        centre = .036 - .048 * ease
    else:
        bottom, top, width, depth = (.09, 1.07, .205, .143) if preset == 'friar' else (.10, 1.06, .20, .145)
        t = max(0, min(1, (top - height) / (top - bottom)))
        rx = width * (1 + .47 * t)
        ry = depth * (1 + .18 * t) + .028 * math.sin(math.pi * t)
        centre = -.012
    angle = math.atan2(-(front - centre) / ry, x / rx)
    fold = math.sin(12 * angle + .25 * math.sin(t * math.pi))
    envelope = .35 + .65 * t
    if preset == 'woman-shawl':
        return .98 + .045 * max(0, fold) * envelope - .22 * max(0, -fold) * envelope
    return 1.04 + .14 * max(0, fold) * envelope - .24 * max(0, -fold) * envelope


def cloth_factor(position, preset, part, drape=False):
    if drape:
        return max(MIN_FACTOR, min(MAX_FACTOR, drape_factor(position, preset)))
    x, height, front = position
    if part == 'outfit':
        waist = gauss(height, 1.08, .08) * gauss(abs(x), .10, .16)
        underarm = gauss(abs(x), .17, .075) * gauss(height, 1.34, .09)
        elbow = gauss(abs(x), .23, .08) * gauss(height, 1.10, .13)
        strength = .18 * waist + .15 * underarm + .19 * elbow
        compressed = .04 * underarm + .025 * waist
        phase = height * 76 + abs(x) * 34 + front * 12
    else:
        knee, hip = gauss(height, .54, .105), gauss(height, .87, .095)
        strength = .23 * knee + .12 * hip
        compressed = .02 * knee
        phase = height * 88 + abs(x) * 24 + front * 14
    valley, ridge = max(0, math.sin(phase)) ** 1.25, max(0, -math.sin(phase))
    envelope = min(1, strength / .16)
    if HEADROOM[preset][part] > 1:
        factor = 1.06 - strength * 1.35 * valley - compressed + .13 * ridge * envelope
    else:
        factor = 1 - strength * valley - compressed + .035 * ridge * envelope
    return max(MIN_FACTOR, min(MAX_FACTOR, factor))


def toned_colour(colour, position, part, pigment, preset, drape=False, protected=False):
    if protected or tuple(pigment) not in PIGMENTS[preset][part]:
        return tuple(colour)
    factor = cloth_factor(position, preset, part, drape)
    lifted = headroom_pigment(pigment, preset, part)
    compensation = [linear(a) / linear(b) if b else 1 for a, b in zip(pigment, lifted)]
    return tuple(max(0, min(1, value * factor * ratio)) for value, ratio in zip(colour[:3], compensation)) + tuple(colour[3:])
