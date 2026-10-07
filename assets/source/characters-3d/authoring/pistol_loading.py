"""Native palm contacts for the three published muzzle-loading pistols.

The gun remains inside the supporting palm. Its real muzzle sets the other
hand's target, and native arm lengths limit the extraction of the short rod.
"""
import math
from mathutils import Quaternion,Vector
from equipment_dimensions import PISTOL_STRETCH,PISTOL_BARREL_OFFSETS
from rifle_loading import _palm,working_hand,_cached_pose

GRIP_KEYS=[(0,0),(.12,1),(.90,1),(1,0)]
STAGES=(.12,.24,.36,.46,.58,.70,.79,.86,.90)

def _weight(t):
    for (a,wa),(b,wb) in zip(GRIP_KEYS,GRIP_KEYS[1:]):
        if t<=b:return wa+(wb-wa)*max(0,(t-a)/(b-a))
    return 0

def dimensions(ctx,item=None,barrel=0):
    marker=next(o for o in ctx['weapons']['pistol'].children if o.name=='muzzle_pistol')
    muzzle=marker.matrix_basis.translation.copy();stretch=PISTOL_STRETCH.get(str(item),1)
    muzzle.x*=stretch
    muzzle.y=PISTOL_BARREL_OFFSETS.get(str(item),(0,))[barrel]
    # The full-size loose rod extends 75 cm from its palm. A pistol's native
    # barrel is 25 cm before the item's measured length factor is applied.
    return muzzle,.25*stretch

def metadata(ctx,item,duration,barrel=0):
    muzzle,length=dimensions(ctx,item,barrel)
    return {'loadingContact':{'muzzle':[muzzle.x,muzzle.z,-muzzle.y],
                              'support':[0,0,0],'ramrodLength':length,
                              'method':'native palm and item muzzle'},
            'propCues':[{'item':'ramrod','socket':'socket_handLeft_tool',
                         'start':round(duration*.46,6),'end':round(duration*.86,6),
                         'scale':length/.75,'rotation':[0,0,math.pi/2]}]}

def pose(ctx,base,offsets,t,item=None,posture=None,barrel=0,_anchor=False):
    from motion import _apply_sample,_gun_pose,_head,_arm_ik,_set_world_rotation,_finger_curl,_hand_rotation,_collect,_blend,UP
    rig=ctx['rig'];muzzle_local,rod_length=dimensions(ctx,item,barrel);weight=_weight(t)
    if not _anchor and .12<t<.46:
        a,b=(.12,.24)if t<.24 else(.24,.36)if t<.36 else(.36,.46)
        u=(t-a)/(b-a);u=u*u*(3-2*u)
        return _blend(_cached_pose(ctx,base,('pistol',item,posture,barrel,a),lambda:pose(ctx,base,offsets,a,item,posture,barrel,True)),
                      _cached_pose(ctx,base,('pistol',item,posture,barrel,b),lambda:pose(ctx,base,offsets,b,item,posture,barrel,True)),u)

    ready_pose,ready_grip,ready_q=_cached_pose(ctx,base,('ready','pistol',posture),lambda:_gun_pose(ctx,base,'pistol',offsets,'aim',posture=posture))
    if weight<1:
        # Interpolate native joint poses across the transfer. Optimizing a new
        # elbow circle at every changing grip can switch solution branches.
        phase=.12 if t<.12 else .90
        loading=_cached_pose(ctx,base,('pistol',item,posture,barrel,phase),lambda:pose(ctx,base,offsets,phase,item,posture,barrel,True))
        return _blend(ready_pose,loading,weight*weight*(3-2*weight))
    _apply_sample(rig,base)
    chest=(rig.pose.bones['upperarm_l'].head+rig.pose.bones['upperarm_r'].head)*.5
    pelvis=rig.pose.bones['pelvis'].head.copy();prone=posture=='prone';crouched=posture=='crouched';mounted=posture=='mounted'
    # Lift the muzzle into the space between the shoulders. A low trigger
    # grip alone leaves the female loading arm beyond its native reach.
    load_q=Quaternion() if prone else Quaternion(UP,-.30 if mounted else -1.2) @ Quaternion(Vector((0,1,0)),-.78 if crouched else -1.05)
    # In prone the muzzle stays ahead of the face. A cross-body barrel at
    # shoulder depth otherwise enters the jaw even though both palms fit.
    load_grip=chest+Vector((-.11 if prone else -.09,-.37 if prone else -.17 if crouched else -.21,.025 if prone else -.12 if crouched else -.26 if mounted else -.14))
    if prone or mounted:load_grip+=load_q@Vector((.10,0,0))
    _apply_sample(rig,_blend(ready_pose,base,weight))
    q=ready_q.slerp(load_q,weight);requested=ready_grip.lerp(load_grip,weight)
    palm,hand_offset=offsets['pistol'];right_q=q @ hand_offset
    from firearm_grips import grip_elbow,align_arm_roll,fit_firearm_fingers
    wrist=requested-right_q@palm
    pole=grip_elbow(rig,'r',wrist,right_q,guide=_head(rig,'upperarm_r')+Vector((-.24,.08,-.26 if not prone else -.07)))
    actual=_arm_ik(rig,'r',wrist,pole)
    align_arm_roll(rig,'r',right_q,_set_world_rotation);_finger_curl(rig,1.22,'r')
    from motion import _aim
    fit_firearm_fingers(rig,ctx['weapons']['pistol'],'pistol',_aim,trigger=False)
    grip=actual+right_q @ palm;muzzle=grip+q @ muzzle_local
    breech=grip+q @ Vector((.07,-.023,.036))
    head=rig.pose.bones['head'].head.copy();belt=pelvis+Vector((.18,-.12,-.02));mouth=head+Vector((0,-.08,-.025))
    # The native tool frame keeps the rod collinear with the barrel. Its
    # working palm is the same centre used by the exported attachment socket.
    tool_q=q
    left_q=tool_q @ _hand_rotation(rig,'l',Vector((1,0,0)),Vector((0,1,0)))
    left_palm=_palm(rig,'l');axis=q @ Vector((1,0,0));shoulder=_head(rig,'upperarm_l')
    delta=muzzle-left_q @ left_palm-shoulder
    radius=rig.data.bones['upperarm_l'].length+rig.data.bones['lowerarm_l'].length-.008
    axial=delta.dot(axis);room=max(0,radius*radius-delta.length_squared+axial*axial)
    lift=max(0,min(rod_length*.70,-axial+math.sqrt(room)))
    stages=[(0,breech),(.12,belt),(.24,mouth),(.36,muzzle),(.46,muzzle),(.58,muzzle+axis*lift),(.70,muzzle+axis*.015),(.79,muzzle+axis*lift),(.86,muzzle+axis*.015),(1,breech)]
    target=stages[-1][1]
    for (a,pa),(b,pb) in zip(stages,stages[1:]):
        if t<=b:
            u=max(0,(t-a)/(b-a));u=u*u*(3-2*u);target=pa.lerp(pb,u);break
    working_hand(rig,target,axis,t,posture)
    from firearm_grips import loading_working_fingers
    rod_grip=max(0,min(1,(t-.44)/.06,(.96-t)/.10))
    rod_grip=rod_grip*rod_grip*(3-2*rod_grip)
    loading_working_fingers(rig,rod_grip)
    result=_collect(rig)
    if weight<1:
        returned=_blend(ready_pose,result,weight)
        for name in result:
            if name.endswith('_l') and name.startswith(('upperarm','lowerarm','hand','index','middle','ring','pinky','thumb')):result[name]=returned[name]
    return result
