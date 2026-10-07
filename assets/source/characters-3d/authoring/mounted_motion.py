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


def measure_tack(ctx):
    """Measure the current horse source, rather than invent a second saddle."""
    if 'mount_tack' in ctx:return ctx['mount_tack']
    from horse import create_horse
    horse=create_horse(0)
    saddle=Vector((horse['saddle']['position'][0],-horse['saddle']['position'][2],horse['saddle']['position'][1]))
    stirrup=next(obj for obj in horse['objects'] if obj.name.startswith('Iron_Stirrup') and sum(v.co.x for v in obj.data.vertices)>0)
    bottom=min(v.co.z for v in stirrup.data.vertices)
    centre=sum((v.co for v in stirrup.data.vertices),Vector())/len(stirrup.data.vertices)
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
    result={'saddle':saddle,'stirrup':Vector((centre.x,centre.y,bottom)),
            'frontGrip':grips[0],'rearGrip':grips[1],'croupHeight':croup,
            'frontKeys':[(.28,outside[0]),(.42,middle[0]),(.53,grips[0]),(.78,grips[0])],
            'rearKeys':[(.28,outside[1]),(.42,middle[1]),(.53,grips[1]),(.78,grips[1])]}
    for obj in horse['export_objects']:bpy.data.objects.remove(obj,do_unlink=True)
    ctx['mount_tack']=result
    return result


def mount_pose(ctx,idle,mounted,t,reverse=False):
    from motion import _apply_sample,_collect,_root_shift,_leg_ik,_aim,_reach,_set_world_rotation,_sole_points
    t=1-t if reverse else t
    rig=ctx['rig'];tack=measure_tack(ctx);seat=tack['saddle']
    _apply_sample(rig,idle)
    rest_pelvis=rig.pose.bones['pelvis'].head.copy()
    rest_feet={side:rig.pose.bones['foot_'+side].head.copy() for side in ('l','r')}
    soles={side:min(point.z for suffix,point in _sole_points(rig) if suffix==side) for side in ('l','r')}
    _apply_sample(rig,mounted)
    seat_shift=seat-rig.pose.bones['pelvis'].head
    seated_feet={side:rig.pose.bones['foot_'+side].head+seat_shift for side in ('l','r')}
    if t<=0:
        _apply_sample(rig,idle);return _collect(rig)
    if t>=.90:
        _apply_sample(rig,mounted);_root_shift(rig,seat_shift);return _collect(rig)
    # The side step stays close to the saved ground location. The horse is
    # admitted only after the actor has cleared its body, and leaves view
    # before the reversed path returns the feet to that location.
    side=.57
    pelvis=_path(t,[(0,rest_pelvis),(.10,(.33,rest_pelvis.y,.83)),(.20,(side,rest_pelvis.y,.91)),
        (.33,(side-.03,rest_pelvis.y-.04,.89)),
        (.47,(.48,seat.y,seat.z+.09)),(.56,(.13,seat.y,seat.z+.12)),
        (.72,(0,seat.y,seat.z+.08)),(.90,seat)])
    left_ground=Vector((rest_feet['l'].x+side,rest_feet['l'].y,.074))
    right_ground=Vector((rest_feet['r'].x+side,rest_feet['r'].y,.074))
    left_stirrup=tack['stirrup']+Vector((0,-.035,rest_feet['l'].z-soles['l']+.006))
    left=_path(t,[(0,rest_feet['l']),(.025,Vector((rest_feet['l'].x,rest_feet['l'].y,.074))),
        (.06,rest_feet['l']+Vector((side*.5,0,.08))),(.10,left_ground),
        (.22,left_ground),(.27,left_ground+Vector((-.08,0,.28))),(.33,left_stirrup),
        (.72,left_stirrup),(.90,seated_feet['l'])])
    # The right boot passes over the measured croup, behind the cantle,
    # before descending on the opposite side. It never slides through the
    # horse's back while the pelvis rises.
    swing_height=max(tack['croupHeight']+.23,seat.z+.25)
    right=_path(t,[(0,rest_feet['r']),(.025,Vector((rest_feet['r'].x,rest_feet['r'].y,.074))),
        (.11,Vector((rest_feet['r'].x,rest_feet['r'].y,.074))),
        (.155,rest_feet['r']+Vector((side*.5,0,.09))),(.20,right_ground),
        (.39,right_ground),(.53,(.44,.53,swing_height)),
        (.61,(0,.57,swing_height+.035)),(.72,(-.39,.38,swing_height-.08)),
        (.84,seated_feet['r']),(.90,seated_feet['r'])])
    _apply_sample(rig,idle)
    yaw=-math.pi*.5*_phase(t,.03,.20)*(1-_phase(t,.35,.58))
    root=rig.pose.bones['Root'];_set_world_rotation(rig,'Root',Quaternion((0,0,1),yaw) @ root.matrix.to_quaternion())
    _root_shift(rig,pelvis-rig.pose.bones['pelvis'].head)
    lean=_phase(t,.25,.42)*(1-_phase(t,.53,.74))*.42
    forward_lean=_phase(t,.24,.38)*(1-_phase(t,.72,.87))*.12
    for name in ('spine_01','spine_02'):
        _set_world_rotation(rig,name,Quaternion((1,0,0),forward_lean) @ Quaternion((0,1,0),-lean) @ rig.pose.bones[name].matrix.to_quaternion())
    left_pole=pelvis+Vector((.38,-.36,-.20))
    right_pole=pelvis+_path(t,[(0,(-.34,-.40,-.25)),(.33,(-.34,-.40,-.25)),
        (.44,(.35,.38,-.20)),(.53,(.05,.55,.90)),(.72,(.05,.55,.90)),(.84,(-.34,-.40,-.25))])
    _leg_ik(rig,'l',left,left_pole);_leg_ik(rig,'r',right,right_pole)
    for suffix in ('l','r'):
        _aim(rig,'foot_'+suffix,(0,-.18,-.02));_aim(rig,'ball_'+suffix,(0,-.1,0))
    contact=_phase(t,.20,.28)*(1-_phase(t,.78,.90))
    for suffix,target in [('l',_path(t,tack['frontKeys'])),('r',_path(t,tack['rearKeys']))]:
        # Hands hold the front and rear saddle edges through the supported
        # lift. The final short blend returns to the native riding endpoint.
        current=rig.pose.bones['hand_'+suffix].head.lerp(rig.pose.bones['middle_01_'+suffix].head,.72)
        target=current.lerp(target+Vector((0,0,.010)),contact)
        _reach(rig,suffix,target,pole=pelvis+Vector((.45,.10,.35)),long=(0,0,-1),normal=(-1,0,0),curl=.75)
    pose=_collect(rig)
    if t>.80:
        _apply_sample(rig,mounted);_root_shift(rig,seat_shift)
        from motion import _blend
        pose=_blend(pose,_collect(rig),_phase(t,.80,.90))
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
                      'position':[.15,-.34,0],'rotation':[0,0,-math.pi/2]},
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
