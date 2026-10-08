"""Native lance carry frames. Attack poses keep their reviewed contact path."""
import math
from mathutils import Vector, Quaternion


def elbow_for_palm(rig, side, wrist, rotation, pole_turn=0):
    """Use the unique elbow-circle point nearest the palm's long axis.

    A fixed palm frame and chest-relative target avoid a searched elbow pole
    switching branches during a gait. Native upper/lower arm lengths stay fixed.
    """
    import motion as m
    upper=rig.data.bones['upperarm_'+side];lower=rig.data.bones['lowerarm_'+side]
    shoulder=m._head(rig,upper.name);axis=Vector(wrist)-shoulder
    distance=min(axis.length,upper.length+lower.length-.002);axis.normalize()
    along=(upper.length**2-lower.length**2+distance**2)/(2*distance)
    center=shoulder+axis*along
    radius=math.sqrt(max(0,upper.length**2-along**2))
    native_long,_=m._palm_basis(rig,side)
    long=rotation@rig.data.bones['hand_'+side].matrix_local.to_quaternion().inverted()@native_long
    pole=Vector(wrist)-long*lower.length-center
    pole-=axis*pole.dot(axis)
    if pole.length<.001:
        pole=Vector((1 if side=='l' else -1,0,-1));pole-=axis*pole.dot(axis)
    return center+(Quaternion(axis,math.radians(pole_turn))@pole.normalized())*radius


def place_hand(rig, side, point, local, rotation, pole_turn=0, reference=None):
    import motion as m
    from firearm_grips import align_arm_roll
    wrist=point-rotation@local
    m._arm_ik(rig,side,wrist,elbow_for_palm(rig,side,wrist,rotation,pole_turn))
    align_arm_roll(rig,side,rotation,m._set_world_rotation)
    # Preserve the original local finger closure while changing the palm frame.
    # The old thumb helper uses world targets, so sample it in its old frame.
    if reference is not None:m._set_world_rotation(rig,'hand_'+side,reference)
    m._finger_curl(rig,1.2 if side=='l' else 1.28,side)
    if reference is not None:m._set_world_rotation(rig,'hand_'+side,rotation)


def carry_pose(ctx,base,offsets,mode='carry',posture=None):
    import motion as m
    rig=ctx['rig'];m._apply_sample(rig,base)
    chest=(m._head(rig,'upperarm_l')+m._head(rig,'upperarm_r'))*.5
    prone=chest.z-m._head(rig,'pelvis').z<.13
    level=mode=='brace' or prone
    mounted=posture=='mounted'
    female=ctx['gender']=='female'
    if mode=='brace':
        point=chest+Vector((-.18,-.15,-.2));roll=330
    elif prone:
        point=chest+Vector((-.2,.05,-.2));roll=330
    else:
        point=chest+Vector((-.18,-.2,-.2));roll=270 if female else 285
        if mounted:
            from mounted_motion import measure_tack
            point.x=-abs(measure_tack(ctx)['stirrups']['r'].x)-.055
            roll=210 if female else 225
    if not level and not mounted:
        point.z=max(.825,point.z)
    shaft=Quaternion((1,0,0),math.pi/2 if level else .10)
    if mode=='brace':shaft=Quaternion((0,0,1),math.radians(10))@shaft
    shaft=shaft@Quaternion((0,0,1),math.radians(roll))
    local,offset=offsets['sabre']
    tilt=Quaternion((0,1,0),math.radians(-55)) if mode=='brace' else Quaternion()
    shift=Vector((.015,.020,0)) if mode=='brace' else Vector()
    reference=Quaternion((1,0,0),math.pi/2 if level else .10)@offset
    place_hand(rig,'r',point-shaft@shift,local,shaft@tilt@offset,
               30 if mode=='brace' else 0,reference)
    if mode=='brace':brace_fingers(rig,ctx['gender'],'r')
    if mode=='brace':
        hand=rig.data.bones['hand_l'];long,normal=m._palm_basis(rig,'l')
        knuckles=sum((rig.data.bones[f+'_01_l'].head_local for f in ('index','middle','ring','pinky')),Vector())/4
        local=hand.matrix_local.inverted()@(hand.head_local.lerp(knuckles,.74)+normal*.014)
        rotation=m._hand_rotation(rig,'l',Vector((-1,-.5,-.2)),Vector((0,0,-1)))
        reference=m._hand_rotation(rig,'l',Vector((1,0,0)),Vector((0,0,-1)))
        place_hand(rig,'l',point+shaft@Vector((-.010,.012,.22)),local,rotation,reference=reference)
        brace_fingers(rig,ctx['gender'],'l')
    return m._collect(rig)


def metadata(duration):
    # The lance passes diagonally through the fist. Rotate only the held item
    # back to its shaft frame and seat the wood clear of the native palm.
    q=Quaternion((0,1,0),math.radians(55))
    position=q@Vector((.015,.020,0))
    return {'gripOffsets':[{'hand':'handRight','keys':[
        {'time':time,'position':[position.x,position.z,-position.y],'rotationQuaternion':[q.x,q.z,-q.y,q.w]}
        for time in (0,duration)]}]}


def brace_fingers(rig,gender,side):
    """Fit the rear fist to the diagonal shaft with stable native hinges."""
    from firearm_grips import _palm_basis,_frame,_set_rotation,_thumb_pose
    profile=(BRACE_FINGERS if side=='r' else FRONT_FINGERS)[gender];long,normal=_palm_basis(rig,side)
    hand=rig.pose.bones['hand_'+side]
    delta=hand.matrix.to_quaternion()@hand.bone.matrix_local.to_quaternion().inverted()
    for finger,p in profile.items():
        if finger=='thumb':continue
        palm=Quaternion(normal,math.radians(p['fan']))@long
        hinge=palm.cross(normal).normalized()
        for number,degrees in enumerate(p['angles'],1):
            angle=math.radians(degrees);direction=palm*math.cos(angle)+normal*math.sin(angle)
            bone=rig.data.bones[f'{finger}_{number:02d}_{side}']
            rest=(bone.tail_local-bone.head_local).normalized();native_hinge=rest.cross(normal).normalized()
            turn=(_frame(direction,hinge.cross(direction))@
                  _frame(rest,native_hinge.cross(rest)).inverted()).to_quaternion()
            _set_rotation(rig,bone.name,delta@turn@bone.matrix_local.to_quaternion())
    _thumb_pose(rig,side,profile['thumb']['angles'])


# Finger angles/fan are degrees; thumb joint rotations are radians.
BRACE_FINGERS = {'male': {'index': {'angles': [91.77921580137, 156.51358691157986, 231.51356176406563], 'fan': -15.0},
          'middle': {'angles': [-4.3986323566463446, 75.13018130706428, 120.8628483877737],
                     'fan': 6.886901022305611},
          'ring': {'angles': [42.97251465446964, 108.47701871573622, 151.82071991790883],
                   'fan': 3.5450269662654534},
          'pinky': {'angles': [60.18226600261737, 160.0038183434392, 214.25037673967498],
                    'fan': -7.3791821182883695},
          'thumb': {'angles': [-0.26438257744231325,
                               0.5169033855285122,
                               -0.08518371612302421,
                               -0.04000175474711298,
                               0.03015821171404376]}},
 'female': {'index': {'angles': [78.7625266222416, 153.3033545285807, 228.3032893027384],
                      'fan': -14.999965027944345},
            'middle': {'angles': [-3.199943404821011, 71.93760859496649, 115.2350602268732],
                       'fan': 10.541987536724402},
            'ring': {'angles': [39.476342537171575, 98.45424209025956, 140.0058977853304],
                     'fan': 9.298630840849091},
            'pinky': {'angles': [61.059338661084034, 164.87042009526436, 218.16433125718794],
                      'fan': -9.578380073352928},
            'thumb': {'angles': [-0.3285694741281312,
                                 0.1929294066493237,
                                 -0.5526245438876898,
                                 0.02409837670450179,
                                 -0.0284496282825492]}}}


# Finger angles/fan are degrees; thumb joint rotations are radians.
FRONT_FINGERS = {'male': {'index': {'angles': [56.407763663202175, 140.8822651336164, 190.16307460940095],
                    'fan': -2.210641294824049},
          'middle': {'angles': [57.192296573288935, 140.13660532944348, 187.85972037799337],
                     'fan': -0.8789711857787658},
          'ring': {'angles': [51.42069948583311, 125.79002034507762, 170.29922686632483],
                   'fan': -0.06985562705393744},
          'pinky': {'angles': [-9.997265357508532, 82.71846753986478, 127.24584102603751],
                    'fan': 14.951014878715021},
          'thumb': {'angles': [-0.6882355068247613,
                               0.12119964963383756,
                               -0.7792796787964898,
                               0.8814825548142879,
                               0.3915820997443901]}},
 'female': {'index': {'angles': [68.7982869596999, 169.81967450270275, 225.91240931915968],
                      'fan': -0.7159940434034651},
            'middle': {'angles': [54.36730985675016, 134.12815808582855, 180.0269168095575],
                       'fan': -0.5070649279700612},
            'ring': {'angles': [48.789763546708166, 120.60366119879598, 163.39671492580123],
                     'fan': -0.6756434506083775},
            'pinky': {'angles': [-8.415872679588546, 79.95872553236495, 126.79994810249923],
                      'fan': 11.989856842318526},
            'thumb': {'angles': [-0.6582537013061962,
                                 0.32836240818874113,
                                 -0.7063371602917957,
                                 0.48243198610529187,
                                 0.31142633506067935]}}}
