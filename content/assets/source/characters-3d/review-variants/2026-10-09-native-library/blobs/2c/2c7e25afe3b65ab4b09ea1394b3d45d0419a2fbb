"""Task-only native wrist alignment and body-safe working palms."""
import bpy


def fit_working_wrists(ctx,gesture,t,standing):
    from math import sin,pi
    from mathutils import Vector
    from posture_support import clear_working_hands
    rig=ctx['rig']
    # Keep the task's current palm centres and finger pose. Solve a neutral
    # wrist with a direct anatomical elbow-to-palm solve, rather than
    # imposing a world-horizontal palm on a descending forearm.
    targets={}
    fingers={bone.name:bone.rotation_quaternion.copy() for bone in rig.pose.bones
             if bone.name.startswith(('thumb_','index_','middle_','ring_','pinky_'))}
    for side in ('l','r'):
        targets[side]=rig.pose.bones['hand_'+side].head.lerp(rig.pose.bones['middle_01_'+side].head,.72)
    chest=rig.pose.bones['spine_03'].head.copy()
    pelvis=rig.pose.bones['pelvis'].head.copy()
    envelope=sin(pi*t)**2
    if not standing and chest.z-pelvis.z<.13:
        # Low work belongs in front of the chest, not under its weight.
        # The body and legs retain their authored support pose.
        for side,target in targets.items():
            if side=='r' or gesture!='pickup':
                target.y=min(target.y,chest.y-.27)
    if standing and gesture=='pickup':
        # The deeply lowered shoulder passes close to the lead knee.
        # Let the free arm counterbalance beside the thigh; forcing knee
        # contact here compresses the native chain and flips the elbow.
        shoulder=rig.pose.bones['upperarm_l'].head.copy()
        targets['l']=targets['l'].lerp(shoulder+Vector((.14,0,-.19)),envelope)
    for side,target in targets.items():neutral_palm_reach(rig,side,target)
    for name,rotation in fingers.items():rig.pose.bones[name].rotation_quaternion=rotation
    bpy.context.view_layer.update()
    clear_working_hands(ctx)


def neutral_palm_reach(rig,side,target):
    """Solve the real palm as a rigid extension of the native forearm.

    An iterative wrist solve oscillates at a tightly folded elbow. Solving
    the elbow-to-palm segment directly removes that branch instability.
    """
    from math import sqrt
    from mathutils import Vector,Quaternion
    from motion import _frame,_set_world_rotation
    upper=rig.pose.bones['upperarm_'+side]
    lower=rig.pose.bones['lowerarm_'+side]
    hand=rig.pose.bones['hand_'+side]
    native_palm=hand.bone.head_local.lerp(rig.data.bones['middle_01_'+side].head_local,.72)
    ru=lower.bone.head_local-upper.bone.head_local
    rl=native_palm-lower.bone.head_local
    a,b=ru.length,rl.length
    shoulder=upper.head.copy()
    direction=Vector(target)-shoulder
    distance=max(abs(a-b)+.008,min(a+b-.002,direction.length))
    direction.normalize()
    sign=1 if side=='l' else -1
    pole=Vector((sign*.35,.20,-.12))
    pole-=direction*pole.dot(direction)
    if pole.length<.001:pole=direction.cross(Vector((0,0,1)))
    pole.normalize()
    along=(a*a-b*b+distance*distance)/(2*distance)
    elbow=shoulder+direction*along+pole*sqrt(max(0,a*a-along*along))
    palm=shoulder+direction*distance
    pu=(elbow-shoulder).normalized();pl=(palm-elbow).normalized()
    rp=ru.cross(rl).normalized();pp=pu.cross(pl).normalized()
    _set_world_rotation(rig,upper.name,(_frame(pu,pp)@_frame(ru,rp).inverted()).to_quaternion()@upper.bone.matrix_local.to_quaternion())
    _set_world_rotation(rig,lower.name,(_frame(pl,pp)@_frame(rl,rp).inverted()).to_quaternion()@lower.bone.matrix_local.to_quaternion())
    hand.rotation_quaternion=Quaternion()
    bpy.context.view_layer.update()
