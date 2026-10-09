"""Mount from the horse's left side, supported by its native tack geometry.

The actor finishes at the normal saved cell centre. The same sampled path is
reversed for dismount; neither clip changes a gameplay destination or anatomy.
"""
import math
import bpy
from mathutils import Vector, Quaternion


def _ease(value):
    value=max(0,min(1,value))
    return value*value*(3-2*value)


def _phase(t,start,end):
    return _ease((t-start)/(end-start))


def _path(t,keys):
    if t<=keys[0][0]:return Vector(keys[0][1])
    for (a,point),(b,target) in zip(keys,keys[1:]):
        if t<=b:return Vector(point).lerp(Vector(target),_phase(t,a,b))
    return Vector(keys[-1][1])


def _limb_ik(rig,upper_name,lower_name,target,pole):
    """Use the complete bend plane, so bone roll cannot flip at opposition."""
    from motion import _head,_frame,_set_world_rotation
    upper=rig.data.bones[upper_name];lower=rig.data.bones[lower_name]
    origin=_head(rig,upper_name);axis=Vector(target)-origin
    distance=max(.01,min(axis.length,upper.length+lower.length-.002));axis.normalize()
    bend=Vector(pole)-origin;bend-=axis*bend.dot(axis);bend.normalize()
    along=(upper.length**2-lower.length**2+distance**2)/(2*distance)
    joint=origin+axis*along+bend*math.sqrt(max(0,upper.length**2-along**2))
    end=origin+axis*distance
    native_upper=(upper.tail_local-upper.head_local).normalized()
    native_lower=(lower.tail_local-lower.head_local).normalized()
    native_plane=native_upper.cross(native_lower).normalized()
    plane=bend.cross(axis).normalized()
    for bone,direction in ((upper,joint-origin),(lower,end-joint)):
        native=(bone.tail_local-bone.head_local).normalized()
        rotation=(_frame(direction,plane) @ _frame(native,native_plane).inverted() @ bone.matrix_local.to_3x3()).to_quaternion()
        _set_world_rotation(rig,bone.name,rotation)


def _bend_path(origin,target,t,keys):
    """Turn the bend plane by angle instead of crossing a zero-length pole."""
    axis=(Vector(target)-origin).normalized()
    def projected(point):
        direction=Vector(point)-origin
        return (direction-axis*direction.dot(axis)).normalized()
    if t<=keys[0][0]:return origin+projected(keys[0][1])
    for (start,point),(end,target_pole) in zip(keys,keys[1:]):
        if t<=end:
            return origin+projected(point).slerp(projected(target_pole),_phase(t,start,end))
    return origin+projected(keys[-1][1])


def _support_hand(rig,side,target,pole):
    from motion import _hand_rotation,_set_world_rotation,_finger_curl
    hand=rig.data.bones['hand_'+side]
    rotation=_hand_rotation(rig,side,(0,0,-1),(-1,0,0))
    palm=hand.matrix_local.inverted() @ hand.head_local.lerp(rig.data.bones['middle_01_'+side].head_local,.72)
    _limb_ik(rig,'upperarm_'+side,'lowerarm_'+side,Vector(target)-rotation @ palm,pole)
    _set_world_rotation(rig,hand.name,rotation);_finger_curl(rig,.75,side)


def measure_tack(ctx):
    """Measure the current horse source, rather than invent a second saddle."""
    if 'mount_tack' in ctx:return ctx['mount_tack']
    from horse import create_horse
    horse=create_horse(0)
    saddle=Vector((horse['saddle']['position'][0],-horse['saddle']['position'][2],horse['saddle']['position'][1]))
    stirrups={}
    for stirrup in [obj for obj in horse['objects'] if obj.name.startswith('Iron_Stirrup')]:
        bottom=min(v.co.z for v in stirrup.data.vertices)
        centre=sum((v.co for v in stirrup.data.vertices),Vector())/len(stirrup.data.vertices)
        stirrups['l' if centre.x>0 else 'r']=Vector((centre.x,centre.y,bottom))
    edges=[obj for obj in horse['objects'] if obj.name.startswith('Saddle_Raised_Edge')]
    grips=[];outside=[];middle=[]
    for edge in edges:
        def top_at(low,high):
            points=[v.co for v in edge.data.vertices if low<v.co.x<high]
            top=max(point.z for point in points);points=[point for point in points if point.z>top-.009]
            return sum(points,Vector())/len(points)
        grips.append(top_at(0,.065));middle.append(top_at(.065,.13));outside.append(top_at(.19,.25))
    grips.sort(key=lambda point:point.y)
    middle.sort(key=lambda point:point.y);outside.sort(key=lambda point:point.y)
    body=next(obj for obj in horse['objects'] if obj.name.startswith('Horse_Body'))
    croup=max(v.co.z for v in body.data.vertices if abs(v.co.x)<.24 and .15<v.co.y<.65)
    saddle_mesh=next(obj for obj in horse['objects'] if obj.name=='Saddle')
    result={'saddle':saddle,'stirrup':stirrups['l'],'stirrups':stirrups,
            'bodySurface':([v.co.copy() for v in body.data.vertices],[list(p.vertices) for p in body.data.polygons]),
            'seatSurface':([v.co.copy() for v in saddle_mesh.data.vertices],[list(p.vertices) for p in saddle_mesh.data.polygons]),
            'frontGrip':grips[0],'rearGrip':grips[1],'croupHeight':croup,
            'frontKeys':[(.28,outside[0]),(.42,middle[0]),(.53,grips[0]),(.78,grips[0])],
            'rearKeys':[(.28,outside[1]),(.42,middle[1]),(.53,grips[1]),(.78,grips[1])]}
    for obj in horse['export_objects']:bpy.data.objects.remove(obj,do_unlink=True)
    ctx['mount_tack']=result
    return result


def mount_pose(ctx,idle,mounted,t,reverse=False):
    from motion import _apply_sample,_collect,_root_shift,_aim,_set_world_rotation,_blend,_head,_hand_rotation,_leg_ik
    t=1-t if reverse else t
    rig=ctx['rig'];tack=measure_tack(ctx);seat=tack['saddle']
    _apply_sample(rig,idle)
    rest_pelvis=rig.pose.bones['pelvis'].head.copy()
    rest_feet={side:rig.pose.bones['foot_'+side].head.copy() for side in ('l','r')}
    rest_knees={side:rig.pose.bones['calf_'+side].head-rig.pose.bones['thigh_'+side].head for side in ('l','r')}
    for side in ('l','r'):
        axis=(rest_feet[side]-rig.pose.bones['thigh_'+side].head).normalized()
        rest_knees[side]=(rest_knees[side]-axis*rest_knees[side].dot(axis)).normalized()
    rest_hands={side:rig.pose.bones['hand_'+side].matrix.to_quaternion() for side in ('l','r')}
    _apply_sample(rig,mounted)
    from riding_motion import seat_shift as riding_seat_shift
    seat_shift=riding_seat_shift(ctx)
    seated_pelvis=rig.pose.bones['pelvis'].head+seat_shift
    seated_feet={side:rig.pose.bones['foot_'+side].head+seat_shift for side in ('l','r')}
    seated_bend={side:rig.pose.bones['calf_'+side].head-rig.pose.bones['thigh_'+side].head for side in ('l','r')}
    seated_boot={name:rig.pose.bones[name].matrix.to_quaternion() for name in ('foot_l','ball_l')}
    if t<=0:
        _apply_sample(rig,idle);return _collect(rig)
    if t>=.90:
        _apply_sample(rig,mounted);_root_shift(rig,seat_shift);return _collect(rig)
    # The side step stays close to the saved ground location. The horse is
    # admitted only after the actor has cleared its body, and leaves view
    # before the reversed path returns the feet to that location.
    side=.57
    pelvis=_path(t,[(0,rest_pelvis),(.10,(.33,rest_pelvis.y+.12,.83)),(.20,(side,rest_pelvis.y+.26,.89)),
        (.28,(side-.03,rest_pelvis.y+.28,.92)),
        (.36,(.52,rest_pelvis.y+.20,1.30)),
        (.46,(.48,seat.y,seat.z+.09)),(.56,(.13,seat.y,seat.z+.12)),
        (.72,(0,seat.y,max(seat.z+.08,seated_pelvis.z+.005))),(.90,seated_pelvis)])
    left_ground=Vector((rest_feet['l'].x+side,rest_feet['l'].y+.25,.074))
    right_ground=Vector((rest_feet['r'].x+side,rest_feet['r'].y+.25,.074))
    # The same ball-of-foot contact supports the climb and seated pose.
    # The old ankle-at-iron target left the tread under the back of the heel.
    left_stirrup=seated_feet['l']
    left=_path(t,[(0,rest_feet['l']),(.025,Vector((rest_feet['l'].x,rest_feet['l'].y,.074))),
        (.06,rest_feet['l']+Vector((side*.5,.125,.08))),(.10,left_ground),
        (.20,left_ground),(.265,left_ground.lerp(left_stirrup,.5)+Vector((.02,0,.035))),(.33,left_stirrup),
        (.72,left_stirrup),(.90,seated_feet['l'])])
    # The right boot passes over the measured croup, behind the cantle,
    # before descending on the opposite side. It never slides through the
    # horse's back while the pelvis rises.
    swing_height=max(tack['croupHeight']+.23,seat.z+.25)
    right=_path(t,[(0,rest_feet['r']),(.025,Vector((rest_feet['r'].x,rest_feet['r'].y,.074))),
        (.11,Vector((rest_feet['r'].x,rest_feet['r'].y,.074))),
        (.155,rest_feet['r']+Vector((side*.5,.125,.09))),(.20,right_ground),
        (.28,right_ground),(.55,(.44,.53,swing_height)),
        (.63,(0,.57,swing_height+.035)),(.72,(-.39,.38,swing_height-.08)),
        (.84,seated_feet['r']),(.90,seated_feet['r'])])
    _apply_sample(rig,idle)
    yaw=-math.pi*.5*_phase(t,.03,.20)*(1-_phase(t,.35,.58))
    root=rig.pose.bones['Root'];_set_world_rotation(rig,'Root',Quaternion((0,0,1),yaw) @ root.matrix.to_quaternion())
    _root_shift(rig,pelvis-rig.pose.bones['pelvis'].head)
    lean=_phase(t,.25,.42)*(1-_phase(t,.53,.74))*.42
    forward_lean=_phase(t,.24,.38)*(1-_phase(t,.72,.87))*.24
    for name in ('spine_01','spine_02'):
        _set_world_rotation(rig,name,Quaternion((1,0,0),forward_lean) @ Quaternion((0,1,0),-lean) @ rig.pose.bones[name].matrix.to_quaternion())
    # Keep the shoulders over the two grips while crossing the saddle. The
    # near shoulder faces the pommel and the far shoulder faces the cantle;
    # squaring the chest too early pulled the shorter native arms off them.
    turn=-.65*_phase(t,.40,.55)*(1-_phase(t,.72,.87))
    _set_world_rotation(rig,'spine_02',Quaternion((0,0,1),turn) @ rig.pose.bones['spine_02'].matrix.to_quaternion())
    facing=Quaternion((0,0,1),yaw)
    # After the ground push the free ankle rises with the hip. Keeping the
    # leg slightly unlocked avoids snapping the knee out of a singular,
    # fully extended pose when the rear swing catches up with the lift.
    right_hip=_head(rig,'thigh_r')
    reach=(rig.data.bones['thigh_r'].length+rig.data.bones['calf_r'].length)*.94
    horizontal=(right.x-right_hip.x)**2+(right.y-right_hip.y)**2
    lower=right_hip.z-math.sqrt(max(.01,reach*reach-horizontal))
    difference=lower-right.z
    lift=max(0,difference)+.015*math.log1p(math.exp(-abs(difference)/.015))
    right.z+=lift*_phase(t,.28,.32)
    # Lift the near knee with the boot, then turn it forward as the rider
    # stands on the stirrup. A single world-space pole crosses the ankle
    # axis during this deep bend and reverses the selected knee plane.
    left_hip=_head(rig,'thigh_l')
    raised_knee=left_hip+(left-left_hip).cross(Vector((1,0,0))).normalized()
    initial_knee=left_hip+facing @ rest_knees['l']
    left_pole=_bend_path(left_hip,left,t,[(0,initial_knee),(.20,raised_knee),(.35,raised_knee),
        (.48,left_hip+Vector((1,0,0))),(.72,left_hip+seated_bend['l'])])
    right_poles=[(0,(-.34,-.40,-.25)),(.28,(-.34,-.40,-.25)),
        (.42,(.80,0,.70)),(.56,(.05,.55,.90)),(.72,(.05,.55,.90)),
        (.77,(-.50,.40,.65))]
    right_hip=_head(rig,'thigh_r')
    right_keys=[(time,pelvis+Vector(point)) for time,point in right_poles]+[(.86,right_hip+seated_bend['r'])]
    right_pole=_bend_path(right_hip,right,t,right_keys)
    _limb_ik(rig,'thigh_l','calf_l',left,left_pole);_limb_ik(rig,'thigh_r','calf_r',right,right_pole)
    # The raised knee needs the explicit bend frame above. Once supported
    # below the hip, return its axial roll to the same native frame used by
    # the seated fit; otherwise the blended boot shaft twists into the barrel.
    support_roll=_phase(t,.40,.56)
    if support_roll:
        names=('thigh_l','calf_l');rotations={name:rig.pose.bones[name].matrix.to_quaternion() for name in names}
        _leg_ik(rig,'l',left,left_pole)
        fitted={name:rig.pose.bones[name].matrix.to_quaternion() for name in names}
        for name in names:_set_world_rotation(rig,name,rotations[name].slerp(fitted[name],support_roll))
    for suffix in ('l','r'):
        _aim(rig,'foot_'+suffix,(0,-.18,-.02));_aim(rig,'ball_'+suffix,(0,-.1,0))
    for name,rotation in seated_boot.items():
        _set_world_rotation(rig,name,rig.pose.bones[name].matrix.to_quaternion().slerp(rotation,_phase(t,.20,.33)))
    contact=_phase(t,.18,.33)*(1-_phase(t,.78,.90))
    for suffix,target in [('l',_path(t,tack['frontKeys'])),('r',_path(t,tack['rearKeys']))]:
        # Hands hold the front and rear saddle edges through the supported
        # lift. The final short blend returns to the native riding endpoint.
        if contact<=0:continue
        base=_collect(rig)
        shoulder=_head(rig,'upperarm_'+suffix)
        # The front elbow stays forward of its grip; the rear elbow opens
        # to the side. Neither pole crosses its shoulder-to-wrist axis.
        elbow=shoulder+Vector((.45,-.80 if suffix=='l' else .80,-.15))
        _support_hand(rig,suffix,target+Vector((0,0,.010)),elbow)
        _apply_sample(rig,_blend(base,_collect(rig),contact))
        # The palm turns in world space. Local wrist blending can change
        # shortest arcs when a supporting forearm rotates through 180 deg.
        approach=Quaternion((0,0,1),yaw) @ rest_hands[suffix]
        _set_world_rotation(rig,'hand_'+suffix,approach.slerp(_hand_rotation(rig,suffix,(0,0,-1),(-1,0,0)),contact))
    pose=_collect(rig)
    if t>.80:
        _apply_sample(rig,mounted);_root_shift(rig,seat_shift)
        pose=_blend(pose,_collect(rig),_phase(t,.80,.90))
    if t<.025:pose=_blend(idle,pose,_phase(t,0,.025))
    return pose


def metadata(ctx,duration,reverse=False):
    seat=measure_tack(ctx)['saddle']
    local=lambda point:[point.x,point.z,-point.y]
    support_keys=lambda keys:[{'time':round(duration*(1-time if reverse else time),6),'position':local(point)}for time,point in (reversed(keys) if reverse else keys)]
    markers={'seat':round(duration*(.10 if reverse else .90),6),
             'support':round(duration*(.28 if reverse else .33),6),
             'clear':round(duration*(.80 if reverse else .20),6)}
    return {'seatAnchor':list(seat),'seatWeight':[{'time':0,'weight':1}],
        'sampleRate':30,
        'markers':markers,'events':markers,
        'horseVisibility':{'start':0 if reverse else round(duration*.20,6),
                           'end':round(duration*.80,6) if reverse else duration},
        'freeHands':['handRight','handLeft'],
        # Keep the full owned lance beside the shoulder. Its long butt needs
        # an outboard back fitting while both palms are supporting the rider.
        'stowItems':[{'categories':['lance'],'socket':'back',
                      'position':[.15,-.34,-.12],'rotation':[0,0,-math.pi/2]},
                     {'categories':['rifle'],'socket':'back','position':[.15,-.38,0]}],
        'mountSupport':{'side':'left','coordinateSpace':'gltf-model-local',
                        'stirrup':local(measure_tack(ctx)['stirrup']),
                        'frontGrip':local(measure_tack(ctx)['frontGrip']),
                        'rearGrip':local(measure_tack(ctx)['rearGrip']),
                        'frontKeys':support_keys(measure_tack(ctx)['frontKeys']),
                        'rearKeys':support_keys(measure_tack(ctx)['rearKeys']),
                        'interpolation':'smoothstep',
                        'supportedStart':round(duration*(.28 if reverse else .33),6),
                        'supportedEnd':round(duration*(.67 if reverse else .72),6)},
        'source':{'type':'native-tack-contact-authoring','helper':'mounted_motion.py','reversed':reverse}}


def lifecycle_pose(ctx,bases,sources,gesture,t):
    """Clear the horse, then land at the game's unchanged prone root.

    Gameplay has already unmounted a falling unit. The transient horse ends
    after the near-side exit, as on ordinary dismount. The final body pose is
    exactly the destination prone idle/rest; recovery is a ground get-up.
    """
    from motion import _apply_sample,_collect,_blend,_root_shift
    from posture_support import prone_rest,ground_recovery,fit_body,fit_boots
    rig=ctx['rig'];idle=bases['standing'];mounted=bases['mounted']
    rest=prone_rest(ctx,bases['prone'])
    if gesture in ('dead','unconscious'):return rest
    if gesture=='recover':
        return ground_recovery(ctx,rest,sources['recover'],t,bases,face_down=True)
    target=bases['prone'] if gesture=='knockdown' else rest
    if t>=.68:return target
    # Release the far leg over the croup before the rider loses height. This
    # uses the reviewed saddle-clearance arc instead of pulling a straight
    # seated thigh through the horse's barrel.
    if t<.40:return mount_pose(ctx,idle,mounted,.90-.50*_phase(t,0,.40))
    release=mount_pose(ctx,idle,mounted,.40)
    amount=_phase(t,.40,.68)
    _apply_sample(rig,_blend(release,target,amount))
    fit_body(ctx);fit_boots(ctx)
    return _collect(rig)


def lifecycle_metadata(ctx,duration,gesture):
    moving=gesture in ('die','collapse','knockdown')
    return {'seatAnchor':list(measure_tack(ctx)['saddle']),
            'seatWeight':([{'time':0,'weight':1},{'time':round(duration*.40,6),'weight':1},
                           {'time':round(duration*.68,6),'weight':0},{'time':round(duration,6),'weight':0}]
                          if moving else [{'time':0,'weight':0}]),
            'horseVisibility':{'start':0 if moving else duration+1,
                               'end':round(duration*.40,6) if moving else duration+1},
            'freeHands':['handRight','handLeft'],
            'source':{'type':'native-mounted-ground-contact','helper':'mounted_motion.py'},
            'mountedGround':{'destination':'standing' if gesture=='recover' else 'prone','gameplayRoot':'unchanged'}}
