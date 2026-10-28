"""Native firearm grip frames and anatomically bounded finger poses.

Rifle profiles were fitted to the exported native male/female skin and item
1800. They preserve bone lengths and use flexion, rather than unrestricted
finger IK, to reach the trigger. The arm solver stays local to firearms.
"""
import math
import bpy
from mathutils import Vector, Quaternion, Matrix

RIFLE_PROFILES = {'male': {'long': [0.9556789694593455, 0.27098806192070946, -0.1150761094011251],
          'normal': [-0.27688951325921635, 0.9601283229895403, -0.03853392944791004],
          'hand_position': [-0.1504978064400687, -0.0730743452577097, -0.017353008618991233],
          'index': [4.008745247142068e-08, 0.30000005963223253, 5.292735754610289e-08],
          'fingers': {'middle': [1.1610985376456673, 0.8831583528431213, 0.8778058162160242],
                      'ring': [1.161820148686073, 1.2720870592311335, 0.44804825028424855],
                      'pinky': [1.5699999572425831, 0.8166736475976893, 0.027802286081028187]},
          'pinky_fan': 0.3,
          'thumb': [-0.3100984747144833,
                    0.12172006164415504,
                    0.39870849895973814,
                    1.187592567252031,
                    0.492758577555959],
          'support_long': (0.8, -1, 0.3),
          'support_normal': (0, 0.3, 1),
          'support_point': (0.22, 0, -0.005),
          'support_fingers': {'index': [0, 0, 0.8],
                              'middle': [0.3, 1.2, 0],
                              'ring': [0.9, 0.4, 0.8],
                              'pinky': [1.2, 0, 0.4]},
          'support_thumb': [-0.25039105112107096,
                            0.3413046952989855,
                            0.5102754046032426,
                            1.2999999999999976,
                            1.2999999999999925]},
 'female': {'long': [0.9456406197990287, 0.2695856027133538, -0.18189819914005312],
            'normal': [-0.300667099366631, 0.9378957453286583, -0.17306374664807017],
            'hand_position': [-0.14265934719414147, -0.0718276821188247, -0.005108171479233275],
            'index': [3.598004852477694e-08, 0.3000000393648747, 5.503864101353033e-08],
            'fingers': {'middle': [0.8772820472601673, 1.0440216634175925, 0.9110594500976101],
                        'ring': [1.1198699542590649, 1.389837024638044, 0.3852572877872403],
                        'pinky': [1.5699999485464722, 0.6485324802831439, 0.09275312308063498]},
            'pinky_fan': 0.2999999999999962,
            'thumb': [-0.37515576132080386,
                      -0.6629325985304255,
                      0.24063658644332833,
                      0.8781281480549272,
                      1.0927574136287892],
            'support_long': (1.2, -1, 0.3),
            'support_normal': (0, 0.3, 1),
            'support_point': (0.22, 0, -0.01),
            'support_fingers': {'index': [0, 0, 0],
                                'middle': [0, 1.2, 0],
                                'ring': [0.9, 0.4, 0.4],
                                'pinky': [1.2, 0.8, 0]},
            'support_thumb': [-0.6998720673941543,
                              -0.7807294882074931,
                              0.7998715879803732,
                              -0.09966571885164499,
                              -0.0353567795243207]}}


# Native aiming fits. These adjust the posture around a shouldered stock;
# travel keeps its recorded body path and its separate lower carry grip.
RIFLE_AIM_PROFILES = {'male': {'crouched': {'torsoTurn': -13.9790524,
                       'neckPitch': 24.8358959,
                       'neckRoll': 58.3397804,
                       'headRoll': 46.4487655,
                       'neckYaw': -9.7582182,
                       'cant': -7.8246659,
                       'pocketAcross': 0.0004268,
                       'pocketHeight': 0.0036956,
                       'pocketDepth': -.016,
                       'torsoPitch': -3.3590474,
                       'supportX': 0.18,
                       'supportRoll': -0.0},
          'prone': {'torsoTurn': -12.5109254,
                    'neckPitch': -0.1340287,
                    'neckRoll': 64.025881,
                    'headRoll': 49.9826152,
                    'neckYaw': -19.0414101,
                    'cant': 14.4142914,
                    'pocketAcross': 0.0011993,
                    'pocketHeight': 0.00687,
                    'pocketDepth': -.022,
                    'torsoPitch': -0.0,
                    'supportX': 0.0854092,
                    'supportRoll': -7.6266051},
          'mounted': {'torsoTurn': -12.9999776,
                      'neckPitch': 15.4900991,
                      'neckRoll': 44.6101025,
                      'headRoll': 32.7898932,
                      'neckYaw': -5.9141869,
                      'cant': -22.624463,
                      'pocketAcross': 0.0016081,
                      'pocketHeight': 0.0020337,
                      'torsoPitch': -3.8297968,
                      'supportX': 0.18,
                      'supportRoll': -0.0}},
 'female': {'crouched': {'torsoTurn': -12.6804688,
                         'neckPitch': 28.032386,
                         'neckRoll': 56.8643665,
                         'headRoll': 42.9091042,
                         'neckYaw': -10.8909792,
                         'cant': -2.8177369,
                         'pocketAcross': -0.0003583,
                         'pocketHeight': 0.003672,
                         'torsoPitch': -5.7996454,
                         'supportX': 0.18,
                         'supportRoll': -0.0},
            'prone': {'torsoTurn': -27.886961,
                      'neckPitch': -1.4615751,
                      'neckRoll': 65.0,
                      'headRoll': 60.0,
                      'neckYaw': -29.9162587,
                      'cant': 27.8289359,
                      'pocketAcross': -0.015,
                      'pocketHeight': 0.02,
                      'torsoPitch': -0.0,
                      'supportX': 0.065,
                      'supportRoll': -22.510032},
            'mounted': {'torsoTurn': -10.9101489,
                        'neckPitch': 16.7046728,
                        'neckRoll': 36.9729989,
                        'headRoll': 26.5690087,
                        'neckYaw': -4.7136991,
                        'cant': -18.2120935,
                        'pocketAcross': 0.0009099,
                        'pocketHeight': 0.0011788,
                        'torsoPitch': -3.5738276,
                        'supportX': 0.18,
                        'supportRoll': -0.0}}}

# Fore-end circumference increases toward the breech. The support hand uses
# a separate bounded curl when a low firing posture moves its grip rearward.
RIFLE_SUPPORT_PROFILES = {'male': {'crouched': {'fingers': {'index': [0.033825, 0.0798829, 0.8408505],
                                   'middle': [0.2660901, 1.1747298, 0.245912],
                                   'ring': [0.8751169, 0.3840757, 0.7944957],
                                   'pinky': [1.1330931, 1.2243278, 0.445597]},
                       'thumb': [-0.0140284, 0.6769925, 0.6586687, 1.1184471, 1.2987431]},
          'prone': {'fingers': {'index': [0.0125392, 0.0640315, 0.8354632],
                                'middle': [0.2418961, 0.9396473, 0.6871518],
                                'ring': [0.8144523, 0.358708, 0.800821],
                                'pinky': [1.0826458, 1.3144897, 0.3706877]},
                    'thumb': [-0.0528393, 0.3759867, 0.6393335, 1.1563984, 1.2328855]}},
 'female': {'crouched': {'fingers': {'index': [0.4285466, 1.5063108, 0.0],
                                     'middle': [0.0054304, 1.1026888, 0.0113501],
                                     'ring': [0.8480931, 0.3735336, 0.4004019],
                                     'pinky': [1.0550038, 0.7828215, 0.209966]},
                         'thumb': [-0.2812987, -0.2239187, 0.1435941, 0.320519, 0.0985573]},
            'prone': {'fingers': {'index': [0.3967312, 1.5970734, 0.0073541],
                                  'middle': [0.0063452, 0.9760624, 0.0195944],
                                  'ring': [0.6755321, 0.4174038, 0.5100798],
                                  'pinky': [1.0259833, 0.8812707, 0.0089058]},
                      'thumb': [0.0565022, -0.172576, 0.6686301, 0.5328358, 0.0704411]}}}

# Absolute palm-frame directions remove the native rest fan before wrapping
# the slender fore-end. Thumb values fit the unchanged male/female skin.
RIFLE_LOADING_PROFILES = {'female': {'level': {'index': (60.0917089, 162.1344752, 231.199148),
                      'middle': (56.7895598, 165.1345084, 233.3582084),
                      'pinky': (60.4001211, 155.824482, 228.4958519),
                      'ring': (60.8846445, 165.2840447, 229.9202078)},
            'thumb': (-0.3841558, -0.2486052, 0.637476, 0.2358278, 0.030764),
            'thumbLevel': (0.2888544, -0.1872029, -0.1527909, 0.0951228, -0.0381062),
            'turned': {'index': (73.7721391, 158.7514647, 218.8827591),
                       'middle': (69.8288066, 159.3868121, 222.4747188),
                       'pinky': (72.9286855, 157.9678267, 218.7317636),
                       'ring': (68.5210938, 158.8385836, 221.5051139)}},
 'male': {'level': {'index': (56.3845914, 163.6666077, 233.2766448),
                    'middle': (55.2916101, 163.8510974, 234.5546945),
                    'pinky': (56.5614002, 164.8323936, 230.0877633),
                    'ring': (56.7759363, 166.9911358, 231.5063272)},
          'thumb': (0.3412239, -0.5760086, 0.6053735, 0.1162342, 0.0042866),
          'thumbLevel': (0.1777205, -0.3013927, -0.0317275, 0.0775371, 0.2270669),
          'turned': {'index': (71.2717445, 158.4517532, 221.2679463),
                     'middle': (69.5945663, 160.3382561, 222.4504623),
                     'pinky': (68.3117902, 158.0140499, 221.0165977),
                     'ring': (65.9215093, 160.3892751, 223.5198493)}}}

PISTOL_FINGER_PROFILES = {'male': {'middle': [1.0928861, 1.1285583, 1.0144346, 2.37e-05],
          'ring': [1.1930523, 0.950844, 0.7393451, -0.0218016],
          'pinky': [1.2944243, 1.2188669, 0.3248014, -0.0095581]},
 'female': {'middle': [1.2815318, 1.5738221, 1.0065625, -0.0066423],
            'ring': [1.2295361, 1.1934501, 1.2340226, -0.0370686],
            'pinky': [1.4282737, 1.0941096, 0.5204941, -2.97e-05]}}

def _profile(rig, gender=None):
    if gender in RIFLE_PROFILES:
        rig['_firearm_anatomy'] = gender
    gender = rig.get('_firearm_anatomy')
    if gender not in RIFLE_PROFILES:
        # Imported diagnostics do not always keep rig extras. The production
        # library has exactly these two unscaled native palm geometries.
        palm = rig.data.bones['middle_01_r'].head_local-rig.data.bones['hand_r'].head_local
        gender = 'female' if palm.length < .108 else 'male'
    return RIFLE_PROFILES[gender]


def _palm_basis(rig, side):
    bones=rig.data.bones
    long=(bones['middle_01_'+side].head_local-bones['hand_'+side].head_local).normalized()
    across=bones['index_01_'+side].head_local-bones['pinky_01_'+side].head_local
    normal=across.cross(long).normalized()*(-1 if side=='l' else 1)
    return long,normal


def _set_rotation(rig, name, rotation):
    bone=rig.pose.bones[name]
    bone.matrix=Matrix.LocRotScale(bone.head.copy(),rotation,Vector((1,1,1)))
    bpy.context.view_layer.update()


def grip_frame(rig, side, key, palm_basis, hand_rotation, gender=None):
    profile=_profile(rig,gender)
    bone=rig.data.bones['hand_'+side]
    if key=='rifle' and side=='r':
        hand=hand_rotation(rig,side,Vector(profile['long']),Vector(profile['normal']))
        return -(hand.inverted()@Vector(profile['hand_position'])),hand
    _,normal=palm_basis(rig,side)
    knuckles=sum((rig.data.bones[f+'_01_'+side].head_local for f in ('index','middle','ring','pinky')),Vector())/4
    center=bone.head_local.lerp(knuckles,.74)+normal*.014
    local=bone.matrix_local.inverted()@center
    direction=(1,0,.05) if key=='rifle' else (1,0,-.10) if key=='pistol' else (1,0,0)
    hand=hand_rotation(rig,side,Vector(direction),Vector((0,1,0)))
    if key=='pistol':
        hand=Quaternion(Vector((0,1,0)),math.radians(5))@hand
        local+=hand.inverted()@Vector((0,.036,.040))
    return local,hand


def _thumb_pose(rig, side, values):
    long,normal=_palm_basis(rig,side);across=long.cross(normal).normalized()
    hand=rig.pose.bones['hand_'+side]
    delta=hand.matrix.to_quaternion()@hand.bone.matrix_local.to_quaternion().inverted()
    first=rig.data.bones['thumb_01_'+side]
    turn=Quaternion(across,values[0])@Quaternion(normal,values[1])@Quaternion(long,values[2])
    _set_rotation(rig,first.name,delta@turn@first.matrix_local.to_quaternion())
    for number,angle in [(2,values[3]),(3,values[4])]:
        bone=rig.pose.bones[f'thumb_{number:02d}_{side}']
        direction=(bone.bone.tail_local-bone.bone.head_local).normalized()
        axis=direction.cross(normal).normalized()
        bone.rotation_quaternion=Quaternion(bone.bone.matrix_local.to_3x3().inverted()@axis,angle)
    bpy.context.view_layer.update()


def rifle_fingers(rig, side='r', trigger=True, posture=None):
    profile=_profile(rig);long,normal=_palm_basis(rig,side)
    if side=='l':
        support=RIFLE_SUPPORT_PROFILES.get(rig.get('_firearm_anatomy'),{}).get('crouched' if posture=='mounted' else posture)
        axis=long.cross(normal).normalized()
        for finger,angles in (support['fingers'] if support else profile['support_fingers']).items():
            for i,angle in enumerate(angles,1):
                bone=rig.pose.bones[f'{finger}_{i:02d}_l']
                bone.rotation_quaternion=Quaternion(bone.bone.matrix_local.to_3x3().inverted()@axis,angle)
        bpy.context.view_layer.update()
        _thumb_pose(rig,'l',support['thumb'] if support else profile['support_thumb'])
        return
    hand=rig.pose.bones['hand_r']
    delta=hand.matrix.to_quaternion()@hand.bone.matrix_local.to_quaternion().inverted()
    for finger in ('index','middle','ring','pinky'):
        angles=(profile['index'] if trigger else (0,0,0)) if finger=='index' else profile['fingers'][finger]
        angle=0
        for i,flex in enumerate(angles,1):
            angle+=flex
            direction=long*math.cos(angle)+normal*math.sin(angle)
            if finger=='pinky':direction=Quaternion(normal,profile['pinky_fan'])@direction
            bone=rig.data.bones[f'{finger}_{i:02d}_r']
            rest=(bone.tail_local-bone.head_local).normalized()
            _set_rotation(rig,bone.name,delta@rest.rotation_difference(direction)@bone.matrix_local.to_quaternion())
    _thumb_pose(rig,'r',profile['thumb'])


def fit_firearm_fingers(rig, weapon, key, aim, trigger=True):
    if key=='rifle':
        rifle_fingers(rig,'r',trigger)
    else:
        _pistol_fingers(rig,weapon,key,aim,trigger)


# Native index fits preserve the trigger point. The male safe finger rests
# 7.8 mm farther along the outside of the guard to avoid MCP hyperextension.
# The female trigger pad shifts 0.58 mm along the trigger surface so the MCP
# spread stays below 15 degrees without twisting the native finger hinge.
PISTOL_INDEX_PROFILES = {'male': {'safe': {'angles': (-10.0, 11.25363115, 81.25363115), 'fan': -0.7611231096}, 'trigger': {'angles': (-4.11743011, 84.60194671, 146.70578181), 'fan': -0.0470480872}}, 'female': {'safe': {'angles': (-10.0, 11.98361032, 64.66515439), 'fan': -0.7646400316}, 'trigger': {'angles': (0.65101425, 79.91952212, 135.40747867), 'fan': -0.2583087292951608}}}


def _pistol_digit_pose(rig, finger, angles, fan=0):
    long,normal=_palm_basis(rig,'r');turn=Quaternion(normal,fan)
    hinge=turn@long.cross(normal).normalized()
    hand=rig.pose.bones['hand_r']
    delta=hand.matrix.to_quaternion()@hand.bone.matrix_local.to_quaternion().inverted()
    for i,degrees in enumerate(angles,1):
        angle=math.radians(degrees)
        direction=turn@(long*math.cos(angle)+normal*math.sin(angle))
        bone=rig.data.bones[f'{finger}_{i:02d}_r']
        rest=(bone.tail_local-bone.head_local).normalized()
        native_hinge=rest.cross(normal).normalized()
        rotation=(_frame(direction,hinge.cross(direction))@
                  _frame(rest,native_hinge.cross(rest)).inverted()).to_quaternion()
        _set_rotation(rig,bone.name,delta@rotation@bone.matrix_local.to_quaternion())


def _pistol_fingers(rig,weapon,key,aim,trigger=True):
    """Fit native index and thumb bones around the modeled stock and guard."""
    bpy.context.view_layer.update()
    transform=weapon.matrix_world;gun_q=transform.to_quaternion()
    profile=PISTOL_INDEX_PROFILES[rig.get('_firearm_anatomy','male')]['trigger'if trigger else'safe']
    _pistol_digit_pose(rig,'index',profile['angles'],profile['fan'])
    for finger,values in PISTOL_FINGER_PROFILES[rig.get('_firearm_anatomy','male')].items():
        total=0;angles=[]
        for flex in values[:3]:
            total+=flex;angles.append(math.degrees(total))
        _pistol_digit_pose(rig,finger,angles,values[3])
    # Thumb lies over the wrist of the stock, not through its centre.
    names=['thumb_01_r','thumb_02_r','thumb_03_r']
    target=transform@Vector((-.025,.020,.048) if key=='rifle' else (-.010,.026,.040))
    base=rig.pose.bones[names[0]].head.copy()
    l1=rig.data.bones[names[0]].length;l2=sum(rig.data.bones[n].length for n in names[1:])
    direction=target-base;distance=max(.0001,min(direction.length,l1+l2-.0001));direction.normalize()
    pole=gun_q@Vector((0,0,1));pole-=direction*pole.dot(direction);pole.normalize()
    along=(l1*l1-l2*l2+distance*distance)/(2*distance)
    joint=base+direction*along+pole*math.sqrt(max(0,l1*l1-along*along))
    aim(rig,names[0],joint-base);aim(rig,names[1],target-joint);aim(rig,names[2],target-joint)
    if rig.get('_firearm_anatomy')=='female':
        # The smaller native thumb wraps the stock without entering its side.
        _thumb_pose(rig,'r',(-.1488320,-.0435822,.3145022,-.0134103,.1403090))



def rifle_support_point(rig):
    return tuple(_profile(rig)['support_point'])


def rifle_support_frame(rig, gun_position, gun_rotation, hand_rotation, support_x=None, roll=0):
    profile=_profile(rig);bone=rig.data.bones['hand_l'];long,normal=_palm_basis(rig,'l')
    knuckles=sum((rig.data.bones[f+'_01_l'].head_local for f in ('index','middle','ring','pinky')),Vector())/4
    palm=bone.matrix_local.inverted()@(bone.head_local.lerp(knuckles,.75)+normal*.016)
    q=gun_rotation@hand_rotation(rig,'l',Vector(profile['support_long']),Vector(profile['support_normal']))
    target=Vector(gun_position)+gun_rotation@Vector(profile['support_point'])
    wrist=target-q@palm
    if support_x is not None or roll:
        pivot=Vector((.22,0,.027));turn=Quaternion(Vector((1,0,0)),math.radians(roll))
        local=gun_rotation.inverted()@(wrist-Vector(gun_position))
        local=pivot+turn@(local-pivot)
        if support_x is not None:local.x+=support_x-.22
        wrist=Vector(gun_position)+gun_rotation@local
        q=gun_rotation@turn@gun_rotation.inverted()@q
    return wrist,q


def rifle_carry_position(ctx, position, rotation, hand_rotation):
    """Keep the rigid carry grip inside both native arms, with a soft elbow."""
    rig=ctx['rig'];position=Vector(position)
    bind=ctx['weapons']['rifle'].matrix_basis
    right_offset=-(rotation@bind.to_quaternion().inverted()@bind.translation)
    left_offset=rifle_support_frame(rig,Vector(),rotation,hand_rotation)[0]
    constraints=[(rig.pose.bones['upperarm_'+side].head.copy(),offset,
        rig.data.bones['upperarm_'+side].length+rig.data.bones['lowerarm_'+side].length-.020)
        for side,offset in [('r',right_offset),('l',left_offset)]]
    for _ in range(8):
        for shoulder,offset,radius in constraints:
            delta=position+offset-shoulder
            if delta.length>radius:position-=delta*(1-radius/delta.length)
    return position


def _frame(long, normal):
    y=Vector(long).normalized();z=Vector(normal)-y*y.dot(normal);z.normalize();x=y.cross(z).normalized()
    return Matrix((x,y,z)).transposed()


def align_arm_roll(rig, side, hand_rotation, set_rotation):
    """Match the native elbow plane, then put pronation in the forearm."""
    upper=rig.pose.bones['upperarm_'+side];lower=rig.pose.bones['lowerarm_'+side];hand=rig.pose.bones['hand_'+side]
    ru=(lower.bone.head_local-upper.bone.head_local).normalized()
    rl=(hand.bone.head_local-lower.bone.head_local).normalized();rp=ru.cross(rl).normalized()
    pu=(lower.head-upper.head).normalized();pl=(hand.head-lower.head).normalized();pp=pu.cross(pl).normalized()
    set_rotation(rig,upper.name,(_frame(pu,pp)@_frame(ru,rp).inverted()).to_quaternion()@upper.bone.matrix_local.to_quaternion())
    set_rotation(rig,lower.name,(_frame(pl,pp)@_frame(rl,rp).inverted()).to_quaternion()@lower.bone.matrix_local.to_quaternion())
    for _ in range(3):
        set_rotation(rig,hand.name,hand_rotation)
        twist=hand.rotation_quaternion.to_swing_twist('Y')[1]
        set_rotation(rig,lower.name,Quaternion(pl,twist)@lower.matrix.to_quaternion())
    set_rotation(rig,hand.name,hand_rotation)


def grip_elbow(rig, side, wrist, hand_rotation, palm_basis=None, guide=None, aiming=False, support_height=None):
    """Select a stable elbow plane without using wrist twist as a fallback."""
    upper=rig.pose.bones['upperarm_'+side];lower=rig.pose.bones['lowerarm_'+side]
    shoulder=upper.head.copy();wrist=Vector(wrist);delta=wrist-shoulder;distance=max(.001,min(delta.length,upper.bone.length+lower.bone.length-.002));axis=delta.normalized()
    along=(upper.bone.length**2-lower.bone.length**2+distance**2)/(2*distance)
    height=math.sqrt(max(0,upper.bone.length**2-along**2))
    perpendicular=axis.cross(Vector((0,0,1)))
    if perpendicular.length<.001:perpendicular=axis.cross(Vector((0,1,0)))
    perpendicular.normalize()
    native_long,native_normal=_palm_basis(rig,side)
    hand_delta=hand_rotation@rig.data.bones['hand_'+side].matrix_local.to_quaternion().inverted()
    palm_long=hand_delta@native_long;palm_normal=hand_delta@native_normal
    chest=rig.pose.bones['spine_03'];chest_delta=chest.matrix.to_quaternion()@chest.bone.matrix_local.to_quaternion().inverted()
    outward=chest_delta@Vector((-1 if side=='r' else 1,0,0))
    desired=None
    if guide is not None:
        projected=Vector(guide)-shoulder;projected-=axis*projected.dot(axis)
        if projected.length>.001:desired=shoulder+axis*along+projected.normalized()*height
    def sample(angle):
        elbow=shoulder+axis*along+(Quaternion(axis,angle)@perpendicular)*height
        up=(elbow-shoulder).normalized();fore=(wrist-elbow).normalized();neutral=up.cross(fore).normalized()*(-1 if side=='r' else 1)
        palm=palm_normal-fore*palm_normal.dot(fore)
        if palm.length<.001:return 1e12,elbow
        palm.normalize();pronation=math.degrees(math.atan2(fore.dot(neutral.cross(palm)),neutral.dot(palm)))
        bend=math.degrees(palm_long.angle(fore));rise=elbow.z-shoulder.z;out=(elbow-shoulder).dot(outward)
        score=(max(0,bend-40)**2*4+max(0,abs(pronation)-95)**2+(elbow.z-support_height)**2*400000) if support_height is not None else max(0,bend-30)**2*8+max(0,abs(pronation)-85)**2*8
        if aiming and side=='r':score+=max(0,abs(rise)-.12)**2*100000+max(0,.06-out)**2*100000
        elif side=='l' and support_height is None:score+=max(0,rise+.03)**2*100000+max(0,.015-out)**2*100000
        elif desired is not None:score+=(elbow-desired).length_squared*3000
        return score,elbow
    angles=[2*math.pi*i/72 for i in range(72)];best=min(angles,key=lambda a:sample(a)[0])
    # Refine the selected branch, so small changes in a clip do not snap at
    # the five-degree discovery samples.
    lo=best-math.pi/36;hi=best+math.pi/36;ratio=(math.sqrt(5)-1)/2
    for _ in range(16):
        a=hi-ratio*(hi-lo);b=lo+ratio*(hi-lo)
        if sample(a)[0]<sample(b)[0]:hi=b
        else:lo=a
    return sample((lo+hi)/2)[1]


def rifle_sight_pose(ctx, position, rotation, set_rotation, posture='standing'):
    """Shoulder the stock and sight with native spine, neck, and head joints."""
    rig=ctx['rig'];female=ctx.get('gender')=='female'
    profile=RIFLE_AIM_PROFILES.get(ctx.get('gender'),{}).get(posture)
    torso_turn=profile['torsoTurn'] if profile else -20
    torso_pitch=profile['torsoPitch'] if profile else 0
    for name,share in [('spine_01',.40),('spine_02',.35),('spine_03',.25)]:
        bone=rig.pose.bones[name]
        set_rotation(rig,name,Quaternion(Vector((0,0,1)),math.radians(torso_turn)*share)@Quaternion(Vector((1,0,0)),math.radians(torso_pitch)*share)@bone.matrix.to_quaternion())
    forward=rotation@Vector((1,0,0));side=rotation@Vector((0,1,0))
    turn=Quaternion(Vector((0,0,1)),math.atan2(forward.y,forward.x)+math.pi/2)
    neck_roll=profile['neckRoll'] if profile else 40 if female else 45
    neck_pitch=profile['neckPitch'] if profile else 25 if female else 20
    neck_yaw=profile['neckYaw'] if profile else 0
    head_roll=profile['headRoll'] if profile else 35 if female else 40
    neck=Quaternion(forward,math.radians(neck_roll))@Quaternion(side,math.radians(neck_pitch))@Quaternion(Vector((0,0,1)),math.radians(neck_yaw))@turn
    head=Quaternion(forward,math.radians(head_roll))@Quaternion(side,math.radians(.75))@turn
    set_rotation(rig,'neck_01',neck@rig.data.bones['neck_01'].matrix_local.to_quaternion())
    set_rotation(rig,'head',head@rig.data.bones['head'].matrix_local.to_quaternion())
    chest=rig.pose.bones['spine_03'];delta=chest.matrix.to_quaternion()@chest.bone.matrix_local.to_quaternion().inverted()
    pocket=rig.pose.bones['upperarm_r'].head+delta@Vector((.055+(profile['pocketAcross'] if profile else 0),-.070,.050+(profile['pocketHeight'] if profile else 0)))
    gun_rotation=rotation@Quaternion(Vector((1,0,0)),math.radians(profile['cant'] if profile else -20))
    return pocket-gun_rotation@Vector((-.295,0,-.049))+gun_rotation@Vector((profile.get('pocketDepth',0) if profile else 0,0,0)),gun_rotation


def _loading_finger_directions(rig, side, directions):
    """Keep each finger's native flexion plane through a full stock wrap."""
    long,normal=_palm_basis(rig,side);hinge=long.cross(normal).normalized()
    hand=rig.pose.bones['hand_'+side]
    delta=hand.matrix.to_quaternion()@hand.bone.matrix_local.to_quaternion().inverted()
    for finger,angles in directions.items():
        for i,degrees in enumerate(angles,1):
            angle=math.radians(degrees)
            direction=long*math.cos(angle)+normal*math.sin(angle)
            bone=rig.data.bones[f'{finger}_{i:02d}_{side}']
            rest=(bone.tail_local-bone.head_local).normalized()
            native_hinge=rest.cross(normal).normalized()
            # A direction-only shortest arc flips distal roll when the curl
            # passes 180 degrees. Carry the hinge as well as the shaft.
            turn=(_frame(direction,hinge.cross(direction))@
                  _frame(rest,native_hinge.cross(rest)).inverted()).to_quaternion()
            _set_rotation(rig,bone.name,delta@turn@bone.matrix_local.to_quaternion())


def loading_working_fingers(rig, rod_grip=0):
    """Close around a cartridge or rod without splayed hooks or twisted joints."""
    weight=max(0,min(1,rod_grip))
    angles=tuple(a+(b-a)*weight for a,b in zip((76,164,216),(80,170,220)))
    _loading_finger_directions(rig,'l',{finger:angles for finger in ('index','middle','ring','pinky')})
    female=rig.get('_firearm_anatomy')=='female'
    _thumb_pose(rig,'l',(-1,-1,.037943 if female else .038417,.664612 if female else .671054,1.1))


def rifle_loading_fingers(rig, weight, posture='standing'):
    """Release the trigger grip, then close around the barrel's fore-end."""
    rifle_fingers(rig,'r',trigger=False)
    names=[f+'_'+str(i).zfill(2)+'_r' for f in ('index','middle','ring','pinky','thumb') for i in (1,2,3)]
    start={name:rig.pose.bones[name].rotation_quaternion.copy() for name in names}
    profile=RIFLE_LOADING_PROFILES[rig.get('_firearm_anatomy','male')]
    turned=posture in ('standing','stand','crouched','crouch')
    _loading_finger_directions(rig,'r',profile['turned'if turned else'level'])
    bpy.context.view_layer.update()
    _thumb_pose(rig,'r',profile['thumb'if turned else'thumbLevel'])
    for name in names:
        bone=rig.pose.bones[name]
        bone.rotation_quaternion=start[name].slerp(bone.rotation_quaternion,weight)
    bpy.context.view_layer.update()


def pistol_sight_pose(ctx, rotation, set_rotation, recoil=0):
    """Raise the one-handed pistol to the native eye, with a soft elbow."""
    rig=ctx['rig'];forward=rotation@Vector((1,0,0))
    turn=Quaternion(Vector((0,0,1)),math.atan2(forward.y,forward.x)+math.pi/2)
    for name in ('neck_01','head'):
        set_rotation(rig,name,turn@rig.data.bones[name].matrix_local.to_quaternion())
    # MakeHuman's actual joint-r-eye landmarks, in the unchanged native rig.
    native=Vector((-.031627864,-.122219481,1.642763257) if ctx.get('gender')=='female' else (-.029511534,-.131320670,1.650874138))
    head=rig.pose.bones['head'];eye=head.matrix@head.bone.matrix_local.inverted()@native
    horizontal=Quaternion(Vector((0,0,1)),math.atan2(forward.y,forward.x))
    bind=ctx['weapons']['pistol'].matrix_basis
    hand=rotation@bind.to_quaternion().inverted()
    shoulder=rig.pose.bones['upperarm_r'].head
    radius=rig.data.bones['upperarm_r'].length+rig.data.bones['lowerarm_r'].length-.025
    origin=eye+horizontal@Vector((0,0,-.070))
    offset=origin-hand@bind.translation-shoulder;axis=horizontal@Vector((1,0,0))
    axial=offset.dot(axis)
    available=-axial+math.sqrt(max(0,radius*radius-offset.length_squared+axial*axial))
    distance=max(.20,min(.39,available))
    return origin+horizontal@Vector((distance-.025*recoil,0,.009*recoil)),rotation
