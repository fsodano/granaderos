"""Native muzzle contacts for each published long firearm.

The supporting palm changes from the trigger grip to the middle of the barrel.
The stock can then stay low while the other hand loads at shoulder height. No
bone is translated or stretched to compensate for an unreachable muzzle.
"""
import math
from mathutils import Quaternion,Vector,Matrix
from equipment_dimensions import RIFLE_STRETCH

GRIP_KEYS=[(0,0),(.12,1),(.90,1),(1,0)]

UNLOAD_GRIP_KEYS=[(0,0),(.18,1),(.62,1),(1,0)]

def _weight(t,gesture='reload'):
    keys=GRIP_KEYS if gesture=='reload' else UNLOAD_GRIP_KEYS
    for (a,wa),(b,wb) in zip(keys,keys[1:]):
        if t<=b:return wa+(wb-wa)*max(0,(t-a)/(b-a))
    return 0

def _palm(rig,side):
    from motion import _palm_basis
    bone=rig.data.bones['hand_'+side];_,normal=_palm_basis(rig,side)
    knuckles=sum((rig.data.bones[f+'_01_'+side].head_local for f in ('index','middle','ring','pinky')),Vector())/4
    return bone.matrix_local.inverted() @ (bone.head_local.lerp(knuckles,.74)+normal*.014)

def working_hand(rig,target,axis,phase,posture,gesture='reload'):
    """Reach freely, then hold the rod along the palm without a wrist hinge."""
    from motion import _arm_ik,_head,_hand_rotation,_set_world_rotation
    from firearm_grips import align_arm_roll
    shoulder=_head(rig,'upperarm_l');prone=posture=='prone'
    guide=shoulder+Vector((.24,.08,-.26 if not prone else -.07))
    palm=_palm(rig,'l');axis=Vector(axis).normalized()
    contact=max(0,min(1,(phase-.36)/.06,(.96-phase)/.10)) if gesture=='reload' else 0
    contact=contact*contact*(3-2*contact)
    _arm_ik(rig,'l',target-axis*.09,guide)
    elbow=_head(rig,'lowerarm_l');fore=(_head(rig,'hand_l')-elbow).normalized()
    direction=fore.lerp(axis,contact).normalized()
    normal=(elbow-shoulder).cross(fore).normalized()
    q=_hand_rotation(rig,'l',direction,normal)
    for _ in range(3):
        wrist=target-q@palm;reach=(wrist-shoulder).normalized()
        pole=guide-shoulder;pole-=reach*pole.dot(reach);pole.normalize()
        desired=-direction+reach*direction.dot(reach)
        # A small anatomical side preference keeps the elbow on one branch
        # when the forearm and upper arm become almost collinear.
        pole=(desired+pole*.18).normalized()
        _arm_ik(rig,'l',wrist,shoulder+pole)
        elbow=_head(rig,'lowerarm_l');fore=(_head(rig,'hand_l')-elbow).normalized()
        normal=(elbow-shoulder).cross(fore).normalized()
        q=_hand_rotation(rig,'l',direction,normal)
    _arm_ik(rig,'l',target-q@palm,shoulder+pole)
    align_arm_roll(rig,'l',q,_set_world_rotation)


def dimensions(ctx,item=None):
    marker=next(o for o in ctx['weapons']['rifle'].children if o.name=='muzzle_rifle')
    muzzle=marker.matrix_basis.translation.copy();muzzle.x*=RIFLE_STRETCH.get(str(item),1)
    # The palm encloses the barrel on its timber fore-end. The same point is
    # emitted as a timed attachment offset and used by both arm IK targets.
    hold=Vector((muzzle.x*.60,0,.004))
    return muzzle,hold

def _loading_palm(ctx):
    from motion import _palm_basis
    rig=ctx['rig'];bone=rig.data.bones['hand_r'];_,normal=_palm_basis(rig,'r')
    knuckles=sum((rig.data.bones[f+'_01_r'].head_local for f in ('index','middle','ring','pinky')),Vector())/4
    return bone.matrix_local.inverted()@(bone.head_local.lerp(knuckles,.75)+normal*.016)


def _grip_delta(ctx,item,posture='standing'):
    from motion import _hand_rotation,_palm_basis
    rig=ctx['rig'];_,hold=dimensions(ctx,item)
    hand=_hand_rotation(rig,'r',Vector((0,-1,.15)),Vector((0,.15,1)))
    if posture in ('standing','stand','crouched','crouch'):hand=Quaternion(Vector((1,0,0)),math.radians(50))@hand
    palm=_loading_palm(ctx)
    loading=Matrix.LocRotScale(hold-hand@palm,hand,Vector((1,1,1)))
    return ctx['weapons']['rifle'].matrix_basis.inverted()@loading.inverted()


def _grip_at(ctx,item,weight,posture='standing'):
    delta=_grip_delta(ctx,item,posture)
    return Matrix.LocRotScale(delta.translation*weight,
        Quaternion().slerp(delta.to_quaternion(),weight),Vector((1,1,1)))


def metadata(ctx,item,duration,gesture='reload',posture='standing'):
    muzzle,hold=dimensions(ctx,item);keys=[]
    palm=ctx['weapons']['rifle'].matrix_basis.inverted()@_loading_palm(ctx)
    for t,weight in (GRIP_KEYS if gesture=='reload' else UNLOAD_GRIP_KEYS):
        transform=_grip_at(ctx,item,weight,posture);x,y,z=transform.translation;q=transform.to_quaternion()
        keys.append({'time':round(t*duration,6),'position':[x,z,-y],
                     'rotationQuaternion':[q.x,q.z,-q.y,q.w]})
    return {'gripOffsets':[{'hand':'handRight','keys':keys}],
            'loadingContact':{'muzzle':[muzzle.x,muzzle.z,-muzzle.y],
                              'support':[hold.x,hold.z,-hold.y],
                              'palmPosition':[palm.x,palm.z,-palm.y],
                              'method':'native fore-end wrap and item muzzle'}}


def _cached_pose(ctx,base,key,create):
    """Keep authored key poses while sampling the same immutable base pose."""
    cache=ctx.setdefault('loading_key_poses',{})
    entry=cache.get(key)
    if entry is None or entry[0] is not base:
        entry=(base,create());cache[key]=entry
    return entry[1]


def pose(ctx,base,offsets,t,gesture,item=None,posture=None,_anchor=False):
    from motion import _apply_sample,_gun_pose,_head,_arm_ik,_set_world_rotation,_finger_curl,_hand_rotation,_collect,_blend,UP
    rig=ctx['rig'];muzzle_local,hold=dimensions(ctx,item);w=_weight(t,gesture)
    # The free hand travels between prepared native poses. Solving a new
    # elbow circle while the cartridge passes the shoulder can flip branches.
    if not _anchor:
        stages=([0,.12,.24,.36,.46] if t<.46 else [.86,1] if t>.86 else []) if gesture=='reload' else ([0,.18,.25]if t<.25 else [.55,.78,1]if t>.55 else [])
        for a,b in zip(stages,stages[1:]):
            if a<t<b:
                u=(t-a)/(b-a);u=u*u*(3-2*u)
                return _blend(_cached_pose(ctx,base,('rifle',gesture,item,posture,a),lambda:pose(ctx,base,offsets,a,gesture,item,posture,True)),
                              _cached_pose(ctx,base,('rifle',gesture,item,posture,b),lambda:pose(ctx,base,offsets,b,gesture,item,posture,True)),u)

    ready_pose,ready_grip,ready_q=_cached_pose(ctx,base,('ready','rifle',posture),lambda:_gun_pose(ctx,base,'rifle',offsets,'aim',posture=posture))
    if t<=0 or t>=1:return ready_pose
    _apply_sample(rig,base)
    chest=(rig.pose.bones['upperarm_l'].head+rig.pose.bones['upperarm_r'].head)*.5;pelvis=rig.pose.bones['pelvis'].head.copy()
    prone=chest.z-pelvis.z<.13;crouched=not prone and pelvis.z<.80
    mounted=posture=='mounted'
    load_q=Quaternion() if prone else Quaternion(UP,-.30 if mounted else -1.2) @ Quaternion(Vector((0,1,0)),-.90 if mounted else -1.03 if crouched else -1.4)
    support=chest+Vector((-.25 if mounted else -.08,-.10 if crouched else -.20,-.08 if prone else -.09 if crouched else -.30 if mounted else -.10))
    if mounted:support+=load_q@Vector((.10+max(0,(.945-muzzle_local.x)*.40),0,0))
    if crouched:
        # Fit the stock to the floor before fitting either arm. The longest
        # item otherwise enters the ground during a low crouched load.
        floors=ctx.setdefault('reload_stock_floor',{});key=str(item)
        if key not in floors:
            minimum=0;stretch=RIFLE_STRETCH.get(key,1)
            for part in ctx['weapons']['rifle'].children:
                if part.type!='MESH':continue
                for vertex in part.data.vertices:
                    local=part.matrix_basis @ vertex.co
                    if local.x>0:local.x*=stretch
                    minimum=min(minimum,(load_q @ (local-hold)).z)
            floors[key]=minimum
        minimum=floors[key]
        support.z=max(support.z,.015-minimum)
    load_origin=support-load_q @ hold
    q=ready_q.slerp(load_q,w);origin=ready_grip.lerp(load_origin,w)
    # Release the cheek weld while lowering the gun. Keep the fitted ready
    # body and support hand at both boundaries, rather than popping to idle.
    _apply_sample(rig,_blend(ready_pose,base,w))
    grip=ctx['weapons']['rifle'].matrix_basis@_grip_at(ctx,item,w,posture)
    hand_in_weapon=grip.inverted();hand_q=q@hand_in_weapon.to_quaternion()
    from firearm_grips import grip_elbow,align_arm_roll,rifle_loading_fingers
    wrist=origin+q@hand_in_weapon.translation
    pole=grip_elbow(rig,'r',wrist,hand_q,guide=_head(rig,'upperarm_r')+Vector((-.24,.09,-.26 if not prone else -.09)))
    actual=_arm_ik(rig,'r',wrist,pole)
    align_arm_roll(rig,'r',hand_q,_set_world_rotation)
    rifle_loading_fingers(rig,w,posture)
    origin=actual-q@hand_in_weapon.translation
    muzzle=origin+q @ muzzle_local;breech=origin+q @ Vector((.08,0,.035))
    head=rig.pose.bones['head'].head.copy();belt=pelvis+Vector((.18,-.12,-.02));mouth=head+Vector((0,-.08,-.025))
    # The fingers hold the rod along the palm. The timed prop rotates its
    # native shaft onto tool -X, toward the breech.
    tool_q=q
    left_q=tool_q @ _hand_rotation(rig,'l',Vector((1,0,0)),Vector((0,1,0)))
    left_palm=_palm(rig,'l');axis=q @ Vector((1,0,0));shoulder=_head(rig,'upperarm_l')
    delta=muzzle-left_q @ left_palm-shoulder
    radius=rig.data.bones['upperarm_l'].length+rig.data.bones['lowerarm_l'].length-.008
    axial=delta.dot(axis);room=max(0,radius*radius-delta.length_squared+axial*axial)
    lift=max(0,min(.30,-axial+math.sqrt(room)))
    if gesture=='reload':
        stages=[(0,breech),(.12,belt),(.24,mouth),(.36,muzzle),(.46,muzzle),(.58,muzzle+axis*lift),(.70,muzzle+axis*.03),(.79,muzzle+axis*lift),(.86,muzzle+axis*.03),(1,breech)]
    else:stages=[(0,breech),(.25,muzzle),(.55,muzzle+axis*min(.10,lift)),(.78,belt),(1,breech)]
    target=stages[-1][1]
    for (a,pa),(b,pb) in zip(stages,stages[1:]):
        if t<=b:
            u=max(0,(t-a)/(b-a));u=u*u*(3-2*u);target=pa.lerp(pb,u);break
    working_hand(rig,target,axis,t,posture,gesture)
    from reviewed_motion import _finger_curl as working_fist
    rod_grip=max(0,min(1,(t-.44)/.06,(.96-t)/.10)) if gesture=='reload' else 0
    rod_grip=rod_grip*rod_grip*(3-2*rod_grip)
    working_fist(rig,.90+.40*rod_grip,'l',closed=True)
    result=_collect(rig)
    if w<1:
        returned=_blend(ready_pose,result,w)
        for name in result:
            if name.endswith('_l') and name.startswith(('upperarm','lowerarm','hand','index','middle','ring','pinky','thumb')):
                result[name]=returned[name]
    return result
