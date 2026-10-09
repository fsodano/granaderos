"""Native relaxed fists, scoped to unarmed standing idle and locomotion."""
import math
import bpy
from mathutils import Vector, Matrix, Quaternion

THUMB_REFERENCE_LENGTH_M=.03464791923761368
THUMB_PAD_M=.040
THUMB_FORWARD_M=-.022
THUMB_OUTSIDE_M=.022
NAMES=('stand.idle.unarmed','stand.walk.unarmed','stand.run.unarmed')
FINGER_DIRECTIONS={
    'index':(76,161,202),
    'middle':(78,172,214),
    'ring':(80,165,207),
    'pinky':(82,160,202),
}


def _frame(direction,normal):
    y=direction.normalized();z=(normal-y*y.dot(normal)).normalized()
    return Matrix((y.cross(z).normalized(),y,z)).transposed()


def _set(rig,name,rotation):
    bone=rig.pose.bones[name]
    bone.matrix=Matrix.LocRotScale(bone.head.copy(),rotation,Vector((1,1,1)))
    bpy.context.view_layer.update()


def apply_relaxed_hands(rig, anatomy):
    """Set directions and their hinge together; never use an ambiguous >180° arc."""
    from reviewed_motion import _palm_basis
    for side in ('l','r'):
        forward,normal=_palm_basis(rig,side);hinge=forward.cross(normal).normalized()
        hand=rig.pose.bones['hand_'+side]
        delta=hand.matrix.to_quaternion()@hand.bone.matrix_local.to_quaternion().inverted()
        for finger,angles in FINGER_DIRECTIONS.items():
            for number,degrees in enumerate(angles,1):
                bone=rig.data.bones[f'{finger}_{number:02d}_{side}']
                rest=(bone.tail_local-bone.head_local).normalized()
                direction=forward*math.cos(math.radians(degrees))+normal*math.sin(math.radians(degrees))
                native_hinge=rest.cross(normal).normalized()
                turn=(_frame(direction,hinge.cross(direction))@_frame(rest,native_hinge.cross(rest)).inverted()).to_quaternion()
                _set(rig,bone.name,delta@turn@bone.matrix_local.to_quaternion())
        _resting_thumb(rig, side, anatomy)
    bpy.context.view_layer.update()


def _resting_thumb(rig, side, anatomy):
    """Rest outside the curled index without a folded-back thumb root.

    Orient each shaft relative to its posed parent. A separate world-normal
    frame for every joint can hide a large axial roll in the connected web.
    Native offsets and lengths stay unchanged; only rotations are written.
    """
    from reviewed_motion import _palm_basis
    if anatomy not in ('male', 'female'):
        raise ValueError(f'Unknown relaxed-hand anatomy: {anatomy}')
    forward, normal = _palm_basis(rig, side)
    hand = rig.pose.bones['hand_' + side]
    delta = hand.matrix.to_quaternion() @ hand.bone.matrix_local.to_quaternion().inverted()
    world_normal, world_forward = delta @ normal, delta @ forward
    names = [f'thumb_{i:02d}_{side}' for i in (1, 2, 3)]
    first = rig.pose.bones[names[0]]
    across = (rig.data.bones['index_01_' + side].head_local
              - rig.data.bones['pinky_01_' + side].head_local)
    across -= forward * across.dot(forward)
    across.normalize()
    world_across = delta @ across
    scale = first.bone.length / THUMB_REFERENCE_LENGTH_M
    target = (rig.pose.bones['index_02_' + side].head
              + world_normal * (THUMB_PAD_M * scale)
              + world_forward * (THUMB_FORWARD_M * scale)
              + world_across * (THUMB_OUTSIDE_M * scale))
    base = first.head.copy()
    direction = target - base
    l1 = first.bone.length
    d1, d2 = (rig.data.bones[name].length for name in names[1:])
    # The two native skins have different web/thenar contours. For female hands
    # keep the clear base solution, then add a small distal-only relaxed bend.
    phi = math.radians(30 if anatomy == 'male' else 0)
    l2 = math.sqrt(d1*d1 + d2*d2 + 2*d1*d2*math.cos(phi))
    distance = min(direction.length, l1+l2-.001)
    direction.normalize()
    target = base + direction*distance
    guide = world_normal*math.cos(math.radians(60)) + world_across*math.sin(math.radians(60))
    pole = guide - direction*direction.dot(guide)
    if pole.length < .001:
        pole = world_forward - direction*direction.dot(world_forward)
    pole.normalize()
    along = (l1*l1-l2*l2+distance*distance)/(2*distance)
    joint = base + direction*along + pole*math.sqrt(max(0, l1*l1-along*along))
    axis = (joint-base).cross(target-joint).normalized()
    beta = math.atan2(d2*math.sin(phi), d1+d2*math.cos(phi))
    second = Quaternion(axis, -beta) @ (target-joint)
    third = Quaternion(axis, phi-beta) @ (target-joint)
    if anatomy == 'female':
        third = Quaternion(axis, math.radians(15)) @ third
    for name, shaft in zip(names, (joint-base, second, third)):
        bone = rig.pose.bones[name]
        parent = bone.parent
        native_local = (parent.bone.matrix_local.inverted() @ bone.bone.matrix_local).to_quaternion()
        reference = parent.matrix.to_quaternion() @ native_local
        current_axis = reference @ Vector((0, 1, 0))
        rotation = current_axis.rotation_difference(shaft.normalized()) @ reference
        _set(rig, name, rotation)
