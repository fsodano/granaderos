"""Distinct throws with native body drive, support and free-arm balance."""
import math
import bpy
from mathutils import Matrix,Quaternion,Vector

PROFILES={
    'throw':{'shift':.13,'step':.11,'turn':.48,'lean':.22,
             'arm':[(0,(-.04,-.18,-.24)),(.26,(-.08,.15,.22)),(.43,(-.04,.03,.22)),(.58,(.04,-.43,.10)),(.73,(.15,-.33,-.22)),(1,(-.04,-.18,-.24))]},
    'throwKnife':{'shift':.075,'step':.075,'turn':.32,'lean':.13,
                  'arm':[(0,(-.03,-.16,-.12)),(.26,(-.065,.08,.14)),(.43,(-.02,-.08,.12)),(.58,(.035,-.41,.035)),(.73,(.11,-.32,-.10)),(1,(-.03,-.16,-.12))]},
    'bolas':{'shift':.105,'step':.10,'turn':.56,'lean':.16,
             'arm':[(0,(-.08,-.17,-.23)),(.12,(-.22,-.12,.19)),(.23,(-.11,.17,.23)),(.35,(.16,.09,.22)),(.46,(.14,-.20,.20)),(.58,(.035,-.43,.06)),(.73,(.14,-.29,-.18)),(1,(-.08,-.17,-.23))]},
}

def pose(ctx,base,gesture,t,posture):
    from motion import _apply_sample,_head,_set_world_rotation,_leg_ik,_reach,_collect,UP
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
    if posture=='prone':relative.z*=.45;relative.y-=.06
    long=Vector((0,-1,-.20*max(0,drive)));normal=UP
    if gesture=='throwKnife':
        angle=_flow_key([(0,0),(.26,-.65),(.43,.30),(.58,math.pi/2),(.73,2.1),(1,0)],t)
        # Native knife geometry has its blade along socket +Z. At release it
        # must point ahead, rather than leave sideways from a generic palm.
        long=Vector((1,0,0));normal=Vector((0,math.cos(angle),math.sin(angle)))
    elif gesture=='bolas':
        radial=relative.normalized();long=UP.cross(radial).normalized();normal=-radial.cross(long)
    curl=_flow_key([(0,1),(.52,1),(.58,.14),(.82,.14),(1,1)],t)
    _reach(rig,'r',shoulder+relative,shoulder+Vector((-.20,.08,-.16)),long=long,normal=normal,curl=curl)
    left=_head(rig,'upperarm_l')
    if posture=='prone':
        target=left+Vector((.035,-.24,-.20));target.z=max(.05,target.z)
        _reach(rig,'l',target,long=Vector((0,-1,0)),normal=Vector((0,0,-1)),curl=.3)
    else:
        free=_flow_key([(0,0),(.26,-1),(.48,.25),(.63,1),(.77,.65),(1,0)],t)
        target=left+Vector((.055,-.19+.18*max(0,free)-.08*max(0,-free),-.23+.10*max(0,-free)-.08*max(0,free)))
        _reach(rig,'l',target,left+Vector((.18,.08,-.27)),long=Vector((0,-.25,-1)),normal=Vector((-1,0,0)),curl=.60)
    _set_world_rotation(rig,'head',Quaternion(Vector((1,0,0)),.035*max(0,drive)) @ head)
    return _collect(rig)
