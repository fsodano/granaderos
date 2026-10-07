"""Native muzzle contacts for each published long firearm.

The supporting palm changes from the trigger grip to the middle of the barrel.
The stock can then stay low while the other hand loads at shoulder height. No
bone is translated or stretched to compensate for an unreachable muzzle.
"""
import math
from mathutils import Quaternion,Vector
from equipment_dimensions import RIFLE_STRETCH

GRIP_KEYS=[(0,0),(.12,1),(.90,1),(1,0)]

def _weight(t):
    for (a,wa),(b,wb) in zip(GRIP_KEYS,GRIP_KEYS[1:]):
        if t<=b:return wa+(wb-wa)*max(0,(t-a)/(b-a))
    return 0

def _palm(rig,side):
    from motion import _palm_basis
    bone=rig.data.bones['hand_'+side];_,normal=_palm_basis(rig,side)
    knuckles=sum((rig.data.bones[f+'_01_'+side].head_local for f in ('index','middle','ring','pinky')),Vector())/4
    return bone.matrix_local.inverted() @ (bone.head_local.lerp(knuckles,.74)+normal*.014)

def dimensions(ctx,item=None):
    marker=next(o for o in ctx['weapons']['rifle'].children if o.name=='muzzle_rifle')
    muzzle=marker.matrix_basis.translation.copy();muzzle.x*=RIFLE_STRETCH.get(str(item),1)
    # The palm encloses the barrel on its timber fore-end. The same point is
    # emitted as a timed attachment offset and used by both arm IK targets.
    hold=Vector((muzzle.x*.60,0,.045))
    return muzzle,hold

def metadata(ctx,item,duration):
    muzzle,hold=dimensions(ctx,item)
    return {'gripOffsets':[{'hand':'handRight','keys':[{'time':round(t*duration,6),'position':[-hold.x*w,-hold.z*w,hold.y*w]} for t,w in GRIP_KEYS]}],
            'loadingContact':{'muzzle':[muzzle.x,muzzle.z,-muzzle.y],'support':[hold.x,hold.z,-hold.y],'method':'native palm and item muzzle'}}

def pose(ctx,base,offsets,t,gesture,item=None,posture=None):
    from motion import _apply_sample,_gun_pose,_head,_arm_ik,_set_world_rotation,_finger_curl,_hand_rotation,_collect,UP
    rig=ctx['rig'];muzzle_local,hold=dimensions(ctx,item);w=_weight(t)
    _,ready_grip,ready_q=_gun_pose(ctx,base,'rifle',offsets,'aim')
    _apply_sample(rig,base)
    chest=(rig.pose.bones['upperarm_l'].head+rig.pose.bones['upperarm_r'].head)*.5;pelvis=rig.pose.bones['pelvis'].head.copy()
    prone=chest.z-pelvis.z<.13;crouched=not prone and pelvis.z<.80
    mounted=posture=='mounted'
    load_q=Quaternion() if prone else Quaternion(UP,-.30 if mounted else -1.2) @ Quaternion(Vector((0,1,0)),-.90 if mounted else -1.03 if crouched else -1.4)
    support=chest+Vector((-.25 if mounted else -.08,-.10 if crouched else -.20,-.08 if prone else -.13 if crouched else -.30))
    if crouched:
        # Fit the stock to the floor before fitting either arm. The longest
        # item otherwise enters the ground during a low crouched load.
        floors=ctx.setdefault('reload_stock_floor',{});key=str(item)
        if key not in floors:
            minimum=0;stretch=RIFLE_STRETCH.get(key,1)
            for part in ctx['weapons']['rifle'].children:
                if part.type!='MESH':continue
                for vertex in part.data.vertices:
                    local=part.matrix_basis @ vertex.co;local.x*=stretch
                    minimum=min(minimum,(load_q @ (local-hold)).z)
            floors[key]=minimum
        minimum=floors[key]
        support.z=max(support.z,.015-minimum)
    load_origin=support-load_q @ hold
    q=ready_q.slerp(load_q,w);origin=ready_grip.lerp(load_origin,w);offset=hold*w
    palm,hand_offset=offsets['rifle'];hand_q=q @ hand_offset
    actual=_arm_ik(rig,'r',origin+q @ offset-hand_q @ palm,_head(rig,'upperarm_r')+Vector((-.24,.09,-.26 if not prone else -.09)))
    _set_world_rotation(rig,'hand_r',hand_q);_finger_curl(rig,1.22,'r')
    origin=actual+hand_q @ palm-q @ offset
    muzzle=origin+q @ muzzle_local;breech=origin+q @ Vector((.08,0,.035))
    head=rig.pose.bones['head'].head.copy();belt=pelvis+Vector((.18,-.12,-.02));mouth=head+Vector((0,-.08,-.025))
    # The rod extends into the barrel from the working hand. Its native tool
    # socket +Z axis points toward the breech, exactly opposite barrel +X.
    tool_q=q @ Quaternion(Vector((0,1,0)),-math.pi/2)
    left_q=tool_q @ _hand_rotation(rig,'l',Vector((1,0,0)),Vector((0,1,0)))
    left_palm=_palm(rig,'l');axis=q @ Vector((1,0,0));shoulder=_head(rig,'upperarm_l')
    delta=muzzle-left_q @ left_palm-shoulder
    radius=rig.data.bones['upperarm_l'].length+rig.data.bones['lowerarm_l'].length-.008
    axial=delta.dot(axis);room=max(0,radius*radius-delta.length_squared+axial*axial)
    lift=max(0,min(.30,-axial+math.sqrt(room)))
    if gesture=='reload':
        stages=[(0,breech),(.12,belt),(.24,mouth),(.36,muzzle),(.46,muzzle),(.58,muzzle+axis*lift),(.70,muzzle+axis*.03),(.79,muzzle+axis*lift),(.86,muzzle+axis*.03),(.90,breech),(1,breech)]
    else:stages=[(0,breech),(.25,muzzle),(.55,muzzle+axis*min(.10,lift)),(.78,belt),(1,breech)]
    target=stages[-1][1]
    for (a,pa),(b,pb) in zip(stages,stages[1:]):
        if t<=b:
            u=max(0,(t-a)/(b-a));u=u*u*(3-2*u);target=pa.lerp(pb,u);break
    _arm_ik(rig,'l',target-left_q @ left_palm,shoulder+Vector((.24,.08,-.26 if not prone else -.07)))
    _set_world_rotation(rig,'hand_l',left_q);_finger_curl(rig,.90,'l')
    return _collect(rig)
