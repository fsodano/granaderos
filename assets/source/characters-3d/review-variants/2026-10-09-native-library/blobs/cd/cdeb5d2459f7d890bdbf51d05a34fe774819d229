"""A small, sewn compression study on the two military uniforms only.

The existing coat topology and skinning stay intact. Unequal folds stop before
neck and sleeve openings; no change is made to native skin or joint frames.
"""
import math
from mathutils import Vector


def compression_relief(point, normal, heads):
    def bell(value, width):
        return math.exp(-(value / width) ** 2)

    def fold(value, width):
        # A rounded ridge with a shallow narrow tuck, rather than a sharp rib.
        return bell(value - width * .35, width) - .70 * bell(value + width * .72, width * .52)

    side = 'l' if point.x > 0 else 'r'
    sign = 1 if side == 'l' else -1
    shoulder = heads['upperarm_' + side]
    elbow = heads['lowerarm_' + side]
    wrist = heads['hand_' + side]
    axis = (wrist - elbow).normalized()
    across = axis.cross(Vector((0, -1, 0))).normalized()
    delta = point - elbow
    along = delta.dot(axis)
    cross = delta.dot(across)
    front = max(0, min(1, .58 - normal.y * .48))
    value = 0
    if delta.length < .175:
        # The inside elbow gathers into three unequal, tapered diagonal folds.
        for centre, slant, width, amplitude in ((-.036, .34, .015, .0100),
                                               (.011, -.30, .012, .0090),
                                               (.055, .24, .016, .0060)):
            curve = along - centre + cross * slant + .12 * cross * cross / .07
            value += amplitude * fold(curve, width) * bell(cross, .060) * front

    delta = point - wrist
    along = delta.dot(axis)
    if -.155 < along < -.074:
        # Soft cloth collects just above the sewn crimson facing.
        value += .0065 * fold(along + .103 + delta.dot(across) * .28, .013) * bell(delta.y, .052)

    # Short fans grow from the armhole into the chest, not around the arm.
    shoulder_z = shoulder.z
    x = abs(point.x)
    armhole = bell(x - .155, .072) * bell(point.z - (shoulder_z - .105), .087)
    forward = max(0, -normal.y)
    value += .0090 * fold(point.z - (shoulder_z - .102) + (x - .155) * .64, .017) * armhole * forward * max(0,min(1,(x-.10)/.060))
    value += .0060 * fold(point.z - (shoulder_z - .145) - (x - .140) * .38, .015) * armhole * forward * max(0,min(1,(x-.10)/.060))

    # The waist belt holds the hem. Small diagonal gathers taper into the
    # smooth chest panel and do not form horizontal bands around the torso.
    waist = bell(point.z - 1.110, .064) * bell(x - .083, .095) * forward
    value += .0095 * fold(point.z - 1.096 + (x - .060) * .27, .014) * waist
    value += .0065 * fold(point.z - 1.140 - (x - .090) * .35, .017) * waist
    value += .0050 * bell(x - (.101 + (point.z - 1.085) * .15), .010) * bell(point.z - 1.112, .039) * forward

    # Leave sewn neck and wrist boundary loops at their established positions.
    neck_fade = max(0, min(1, (1.478 - point.z) / .045))
    wrist_fade = max(0, min(1, (-along - .075) / .025)) if delta.length < .14 else 1
    return max(-.0050, min(.0100, value * neck_fade * wrist_fade))
