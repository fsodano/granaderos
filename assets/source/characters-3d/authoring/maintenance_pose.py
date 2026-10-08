"""Inspect a firearm with a relaxed native wrist and the lock in reach."""
import math
from mathutils import Vector,Quaternion


def hold(ctx,base,key,offsets):
    import motion as m
    from firearm_grips import align_arm_roll
    from lance_grips import elbow_for_palm
    rig=ctx['rig'];m._apply_sample(rig,base)
    chest=(m._head(rig,'upperarm_l')+m._head(rig,'upperarm_r'))*.5
    prone=chest.z-m._head(rig,'pelvis').z<.13
    if prone:
        height=.12
        yaw,pitch,roll=-60,-10,60
    else:
        height=-.20 if key=='rifle'else -.18
        yaw,pitch,roll=(-85,0,0)if key=='rifle'else(-60,0,30)
    position=chest+Vector((-.18,-.26,height))
    rotation=(Quaternion((0,0,1),math.radians(yaw))@
              Quaternion((0,1,0),math.radians(pitch))@
              Quaternion((1,0,0),math.radians(roll)))
    local,offset=offsets[key];hand=rotation@offset;wrist=position-hand@local
    m._arm_ik(rig,'r',wrist,elbow_for_palm(rig,'r',wrist,hand))
    align_arm_roll(rig,'r',hand,m._set_world_rotation)
    m._finger_curl(rig,1.36 if key=='rifle'else 1.23,'r')
    if key in ctx.get('weapons',{}):m._trigger_finger(rig,ctx['weapons'][key],key,trigger=False)
    grip=rig.pose.bones['hand_r'].matrix@local
    return m._collect(rig),grip,rotation


def pose(ctx,base,key,offsets,t,gesture):
    import motion as m
    cache=ctx.setdefault('maintenance_contacts',{})
    cache_key=(key,gesture,tuple((name,tuple(position),tuple(rotation))for name,(position,rotation)in base.items()))
    if cache_key in cache:return interpolate(ctx,cache[cache_key],t)
    rig=ctx['rig'];held,grip,q=hold(ctx,base,key,offsets)
    m._apply_sample(rig,held);head=rig.pose.bones['head'].head.copy();pelvis=rig.pose.bones['pelvis'].head.copy()
    muzzle=grip+q @ Vector((.94 if key=='rifle' else .27,0,.055))
    breech=grip+q @ Vector((.08,0,.035));belt=pelvis+Vector((.18,-.12,-.02));mouth=head+Vector((0,-.08,-.025))
    chest=(m._head(rig,'upperarm_l')+m._head(rig,'upperarm_r'))*.5
    prone=chest.z-pelvis.z<.13
    if prone:
        # Reach to the exposed front edge of the belt pouch while prone.
        # Reaching under the abdomen forces a large, fast shoulder reversal.
        belt=pelvis+Vector((.24,-.22,.015))
    if gesture=='reload':
        stages=[(0,breech),(.12,belt),(.24,mouth),(.36,muzzle),(.46,muzzle),(.58,muzzle+q @ Vector((.12,0,0))),(.70,muzzle),(.79,muzzle+q @ Vector((.12,0,0))),(.88,breech),(1,breech)]
    elif gesture=='unload':stages=[(0,breech),(.25,muzzle),(.50 if prone else .55,muzzle+q @ Vector((.10,0,0))),(.78,belt),(1,breech)]
    else:stages=[(0,breech),(.22,belt),(.45,breech),(.60,breech+q @ Vector((.03,.025,0))),(.78,breech),(1,breech)]
    # Solve the contact poses first, then interpolate native joint arcs. A
    # straight wrist target crossing the forearm axis can flip the IK plane
    # between adjacent frames, especially when the body is prone.
    def contact(target):
        m._apply_sample(rig,held)
        m._gesture_reach(rig,'l',target,1,.9)
        return m._collect(rig)
    contacts=[(phase,contact(point))for phase,point in stages]
    cache[cache_key]=(contacts,held,stages,prone)
    return interpolate(ctx,cache[cache_key],t)


def interpolate(ctx,prepared,t):
    import motion as m
    contacts,held,stages,prone=prepared
    for index,((a,pa),(b,pb)) in enumerate(zip(contacts,contacts[1:])):
        if t<=b:
            u=max(0,min(1,(t-a)/(b-a)))
            # Accelerate and brake over the outer fifths of a reach. The
            # middle travels steadily instead of peaking sharply at mid-arc.
            ramp=.2
            u=(u*u/(2*ramp*(1-ramp)) if u<ramp else
               1-(1-u)**2/(2*ramp*(1-ramp)) if u>1-ramp else
               (u-ramp/2)/(1-ramp))
            result=m._blend(pa,pb,u)
            if prone:
                from posture_support import clear_working_hands
                # Keep the continuous native elbow arc and fit the actual
                # hand surface clear of the ground at each authored sample.
                # The floor solve retains the current elbow plane and palm
                # orientation instead of re-solving a folded reach branch.
                m._apply_sample(ctx['rig'],result)
                clear_working_hands(ctx)
                return m._collect(ctx['rig'])
            return result
    return m._copy_pose(contacts[-1][1])
