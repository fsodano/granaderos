"""Distinct throws with native body drive, support and free-arm balance."""
import math
import bpy
from mathutils import Matrix,Quaternion,Vector

PROFILES={
    'throw':{'shift':.13,'step':.11,'turn':.48,'lean':.22,
             'arm':[(0,(-.04,-.18,-.24)),(.15,(-.32,-.08,-.035)),(.26,(-.22,.10,.25)),(.43,(-.14,-.015,.22)),(.58,(-.02,-.33,.31)),(.68,(.08,-.45,.34)),(.80,(.15,-.38,-.12)),(1,(-.04,-.18,-.24))]},
    'throwKnife':{'shift':.075,'step':.075,'turn':.32,'lean':.13,
                  'arm':[(0,(-.03,-.16,-.12)),(.12,(-.03,-.10,.015)),(.26,(-.015,.015,.17)),(.43,(.12,-.12,-.015)),(.58,(.15,-.30,-.02)),(.73,(.16,-.42,-.10)),(1,(-.03,-.16,-.12))]},
    'bolas':{'shift':.105,'step':.10,'turn':.56,'lean':.16,
             'arm':[(0,(-.08,-.17,-.23)),(.12,(-.43,-.12,.16)),(.23,(-.24,.10,.21)),(.35,(-.16,.07,.25)),(.46,(-.08,-.14,.20)),(.58,(.035,-.37,.20)),(.68,(.10,-.50,.18)),(.80,(.15,-.34,-.18)),(1,(-.08,-.17,-.23))]},
}


def _supported_reach(rig,side,target,pole,long,normal,curl,gesture='throw',wrist_weight=0):
    """Use one elbow plane and a bounded wrist, rather than a fixed world palm.

    A fixed forward palm folds backwards when the forearm rises behind the
    head. The native elbow frame supplies the hand's roll; the wrist can lead
    the release a little but cannot reverse the hand over the forearm.
    """
    from motion import _arm_ik,_hand_rotation,_set_world_rotation,_palm_basis,_finger_curl,_frame
    hand=rig.data.bones['hand_'+side];upper=rig.data.bones['upperarm_'+side];lower=rig.data.bones['lowerarm_'+side]
    native_long,_=_palm_basis(rig,side)
    palm=hand.matrix_local.inverted() @ hand.head_local.lerp(rig.data.bones['middle_01_'+side].head_local,.72)
    ru=(lower.head_local-upper.head_local).normalized();rl=(hand.head_local-lower.head_local).normalized();rp=ru.cross(rl).normalized()
    q=_hand_rotation(rig,side,long,normal)
    _arm_ik(rig,side,Vector(target)-q @ palm,pole)
    pu=(rig.pose.bones[lower.name].head-rig.pose.bones[upper.name].head).normalized()
    pl=(rig.pose.bones[hand.name].head-rig.pose.bones[lower.name].head).normalized()
    pp=pu.cross(pl).normalized()
    uq=(_frame(pu,pp) @ _frame(ru,rp).inverted()).to_quaternion() @ upper.matrix_local.to_quaternion()
    lq=(_frame(pl,pp) @ _frame(rl,rp).inverted()).to_quaternion() @ lower.matrix_local.to_quaternion()
    _set_world_rotation(rig,upper.name,uq);_set_world_rotation(rig,lower.name,lq)
    neutral=lq @ lower.matrix_local.to_quaternion().inverted() @ hand.matrix_local.to_quaternion()
    # Keep the wrist close to its native alignment while the forearm
    # carries the throw. Deriving a bend from a fixed world direction has
    # two equally valid solutions when the loaded forearm points back;
    # crossing that boundary was the visible preparation flip.
    q=neutral
    if gesture=='bolas':
        tool=_hand_rotation(rig,side,(1,0,0),(0,1,0))
        cord=neutral @ tool.inverted() @ Vector((0,0,-1))
        radial=(rig.pose.bones[hand.name].head-rig.pose.bones[upper.name].head).normalized()
        turn=cord.rotation_difference(radial)
        if turn.angle>math.radians(40):turn=Quaternion().slerp(turn,math.radians(40)/turn.angle)
        q=turn @ neutral
    if wrist_weight:
        q=_hand_rotation(rig,side,long,normal)
        direction=q @ hand.matrix_local.to_quaternion().inverted() @ native_long
        bend=pl.angle(direction)
        if bend>math.radians(35):
            # Correct only the bend. Blending full palm quaternions here
            # can select the opposite forearm roll during recovery.
            correction=direction.rotation_difference(pl)
            q=Quaternion().slerp(correction,(bend-math.radians(35))/bend) @ q
    _set_world_rotation(rig,hand.name,q)
    # Carry any remaining native-axis twist in the lower arm. The wrist
    # itself retains flexion, rather than twisting the cuff into a hole.
    for _ in range(2):
        twist=rig.pose.bones[hand.name].rotation_quaternion.to_swing_twist('Y')[1]
        _set_world_rotation(rig,lower.name,Quaternion(pl,twist) @ rig.pose.bones[lower.name].matrix.to_quaternion())
        _set_world_rotation(rig,hand.name,q)
    _finger_curl(rig,curl,side)

def pose(ctx,base,gesture,t,posture):
    from motion import _apply_sample,_head,_set_world_rotation,_leg_ik,_collect,UP
    from reviewed_motion import _flow_key
    rig=ctx['rig'];profile=PROFILES[gesture];_apply_sample(rig,base)
    feet={side:(rig.pose.bones['foot_'+side].head.copy(),rig.pose.bones['foot_'+side].matrix.to_quaternion()) for side in ('l','r')}
    head=rig.pose.bones['head'].matrix.to_quaternion()
    standing=posture=='standing';ground=posture in ('standing','crouched');factor=1 if standing else .55 if ground else .30
    load=_flow_key([(0,0),(.24,-1),(.38,-.35),(.58,1),(.73,.72),(1,0)],t)
    drive=_flow_key([(0,0),(.24,-.12),(.42,.52),(.58,1),(.73,.78),(1,0)],t)
    shift=-profile['shift']*drive*factor if ground else 0
    root=rig.pose.bones['Root'];root.matrix=Matrix.Translation((0,shift,-.014*max(0,drive) if ground else 0)) @ root.matrix
    hip=profile['turn']*load*.42*factor if ground else 0
    lean=profile['lean']*max(0,drive)*factor
    bpy.context.view_layer.update()
    pelvis=rig.pose.bones['pelvis'];_set_world_rotation(rig,'pelvis',Quaternion(UP,hip) @ Quaternion(Vector((1,0,0)),lean*.20) @ pelvis.matrix.to_quaternion())
    for name,weight in [('spine_01',.35),('spine_02',.35),('spine_03',.30)]:
        bone=rig.pose.bones[name]
        _set_world_rotation(rig,name,Quaternion(UP,profile['turn']*load*.58*factor*weight) @ Quaternion(Vector((1,0,0)),lean*.80*weight) @ bone.matrix.to_quaternion())
    if ground:
        step=_flow_key([(0,0),(.09,0),(.30,profile['step'] if standing else 0),(.77,profile['step'] if standing else 0),(1,0)],t)
        front_lift=_flow_key([(0,0),(.09,0),(.19,.035 if standing else 0),(.30,0),(.77,0),(.88,.027 if standing else 0),(1,0)],t)
        rear_lift=_flow_key([(0,0),(.43,0),(.60,.034 if standing else 0),(.74,.026 if standing else 0),(.91,0),(1,0)],t)
        for side,(point,rotation) in feet.items():
            if side=='l':point+=Vector((0,-step,front_lift))
            else:
                # Heel rise pivots around the native ball rather than sliding
                # the supporting toe through the release.
                bone=rig.data.bones['foot_r'];toe=bone.matrix_local.inverted() @ rig.data.bones['ball_r'].head_local
                anchor=point+rotation @ toe
                rotation=Quaternion(Vector((1,0,0)),rear_lift*3) @ rotation
                point=anchor-rotation @ toe
            _leg_ik(rig,side,point,point+Vector((0,-.8,.30)));_set_world_rotation(rig,'foot_'+side,rotation)
    shoulder=_head(rig,'upperarm_r');arm=profile['arm']
    relative=Vector(tuple(_flow_key([(phase,point[axis]) for phase,point in arm],t) for axis in range(3)))
    # Both anatomies retain their own reach; the compact knife path and the
    # overarm grenade path cannot reuse one hand trajectory.
    span=rig.data.bones['upperarm_r'].length+rig.data.bones['lowerarm_r'].length
    relative*=span/.56
    if posture=='prone':
        relative.z*=.45;relative.y-=.06
        relative.z=max(.03 if gesture=='bolas' else .115-shoulder.z,relative.z)
    long=Vector((0,-1,-.20*max(0,drive)));normal=UP
    if gesture=='throwKnife':
        angle=_flow_key([(0,0),(.26,.30),(.43,math.pi/2),(.55,math.pi/2),(.61,math.pi/2),(.73,2.1),(1,0)],t)
        # Native knife geometry has its blade along socket +Z. At release it
        # must point ahead, rather than leave sideways from a generic palm.
        long=Vector((1,0,0));normal=Vector((0,math.cos(angle),math.sin(angle)))
    elif gesture=='bolas':
        radial=relative.normalized();long=UP.cross(radial).normalized();normal=-radial.cross(long)
    curl=_flow_key([(0,1),(.52,1),(.58,.14),(.82,.14),(1,1)],t)
    wrist_weight=1 if gesture=='throwKnife' else 0
    _supported_reach(rig,'r',shoulder+relative,shoulder+Vector((-.32,.015,-.10) if gesture=='throwKnife' else (-.24,.045,-.12)),long,normal,curl,gesture,wrist_weight)
    left=_head(rig,'upperarm_l')
    if posture=='prone':
        target=left+Vector((.035,-.24,-.20));target.z=max(.05,target.z)
        from posture_support import support_hand
        from motion import _hand_rotation
        target.z=.060
        support_hand(ctx,'l',target,left+Vector((.22,-.12,-.08)),_hand_rotation(rig,'l',(0,-1,0),(0,0,-1)),minimum=.080)
    else:
        free=_flow_key([(0,0),(.26,-1),(.48,.25),(.63,1),(.77,.65),(1,0)],t)
        target=left+Vector((.055,-.19+.18*max(0,free)-.08*max(0,-free),-.23+.10*max(0,-free)-.08*max(0,free)))
        _supported_reach(rig,'l',target,left+Vector((.18,.08,-.27)),Vector((0,-.25,-1)),Vector((-1,0,0)),.60)
    _set_world_rotation(rig,'head',Quaternion(Vector((1,0,0)),.035*max(0,drive)) @ head)
    return _collect(rig)
