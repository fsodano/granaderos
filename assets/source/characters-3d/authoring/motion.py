"""Retarget recorded CMU human movement onto the unmodified MakeHuman game rig.

The three locomotion clips are sampled from recorded people, not generated
limb waves.  Source files and use terms are in vendor/motion.  All animation
tracks use the character's native bone lengths and native skin weights.
"""
from pathlib import Path
import json
import math
import re
import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector

VENDOR = Path(__file__).resolve().parent / 'vendor' / 'motion'
FPS = 30
UP = Vector((0, 0, 1))
FORWARD = Vector((0, -1, 0))
CONVERT = Matrix(((1,0,0),(0,0,-1),(0,1,0)))


class BVH:
    """Small deterministic reader. Channel order follows the file exactly."""
    def __init__(self, path):
        self.path = Path(path)
        text = self.path.read_text()
        hierarchy, motion = text.split('MOTION', 1)
        tokens = re.findall(r'[^\s{}]+|[{}]', hierarchy)
        self.nodes = []
        self.names = {}
        self.channels = 0
        i = 1
        def node(parent):
            nonlocal i
            kind = tokens[i]; i += 1
            if kind == 'End':
                i += 1
                name = self.nodes[parent]['name'] + '_End'
            else:
                name = tokens[i]; i += 1
            assert tokens[i] == '{'; i += 1
            n = dict(name=name, parent=parent, offset=Vector(), channels=[], start=self.channels)
            idx = len(self.nodes); self.nodes.append(n); self.names[name] = idx
            while tokens[i] != '}':
                if tokens[i] == 'OFFSET':
                    n['offset'] = Vector(map(float, tokens[i+1:i+4])); i += 4
                elif tokens[i] == 'CHANNELS':
                    count = int(tokens[i+1]); n['channels'] = tokens[i+2:i+2+count]
                    n['start'] = self.channels; self.channels += count; i += count + 2
                else:
                    node(idx)
            i += 1
        node(None)
        lines = motion.strip().splitlines()
        self.dt = float(lines[1].split(':')[1])
        self.frames = np.array([[float(v) for v in line.split()] for line in lines[2:] if line.strip()])
        assert self.frames.shape[1] == self.channels
        self.cache = {}

    def sample(self, frame):
        frame = max(0, min(len(self.frames)-1, float(frame)))
        index = int(frame); blend = frame-index
        if blend > 1e-6:
            a = self.sample(index); b = self.sample(min(index+1,len(self.frames)-1))
            return {name:(p.lerp(b[name][0], blend), q.slerp(b[name][1], blend)) for name,(p,q) in a.items()}
        if index in self.cache:
            return self.cache[index]
        result = {}; world = []
        row = self.frames[index]
        for n in self.nodes:
            location = n['offset'].copy(); rotation = Quaternion()
            for ch, value in zip(n['channels'], row[n['start']:]):
                axis = 'XYZ'.index(ch[0])
                if ch.endswith('position'):
                    location[axis] += value
                else:
                    unit = Vector((int(axis==0),int(axis==1),int(axis==2)))
                    rotation = rotation @ Quaternion(unit, math.radians(value))
            mat = Matrix.LocRotScale(location, rotation, Vector((1,1,1)))
            if n['parent'] is not None: mat = world[n['parent']] @ mat
            world.append(mat)
            p = CONVERT @ mat.translation
            q = (CONVERT @ mat.to_3x3() @ CONVERT.inverted()).to_quaternion()
            result[n['name']] = (p, q)
        self.cache[index] = result
        return result


def _pose_signature(sample):
    hips = sample['Hips'][0]
    return np.array([tuple(sample[name][0] - hips) for name in
        ('LeftLeg','RightLeg','LeftFoot','RightFoot','LeftForeArm','RightForeArm','LeftHand','RightHand')]).ravel()


def inspect_sources():
    for path in sorted(VENDOR.glob('*.bvh')):
        bvh = BVH(path)
        rows = []
        for f in range(1,len(bvh.frames),max(1,len(bvh.frames)//60)):
            p = bvh.sample(f)
            rows.append(_pose_signature(p))
        values = np.array(rows)
        print(path.name,'frames',len(bvh.frames),'seconds',round(len(bvh.frames)*bvh.dt,2),'joint_variance',np.round(values.std(axis=0).reshape(-1,3),2).tolist())



BODY_MAP = {'pelvis':'Hips','spine_01':'LowerBack','spine_02':'Spine','spine_03':'Spine1','neck_01':'Neck1','head':'Head'}
SEGMENTS = {}
for suffix, side in [('l','Left'),('r','Right')]:
    SEGMENTS.update({
        'upperarm_'+suffix:(side+'Arm',side+'ForeArm'),
        'lowerarm_'+suffix:(side+'ForeArm',side+'Hand'),
        'hand_'+suffix:(side+'Hand',side+'HandIndex1'),
        'thigh_'+suffix:(side+'UpLeg',side+'Leg'),
        'calf_'+suffix:(side+'Leg',side+'Foot'),
        'foot_'+suffix:(side+'Foot',side+'ToeBase'),
        'ball_'+suffix:(side+'ToeBase',side+'ToeBase_End')})


def _bone_order(rig):
    return sorted(rig.pose.bones, key=lambda pb: len(pb.parent_recursive))


def _reset(rig):
    for pb in rig.pose.bones:
        pb.rotation_mode = 'QUATERNION'
        pb.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()


def _head(rig, name):
    bone = rig.data.bones[name]
    if bone.parent:
        return rig.pose.bones[bone.parent.name].matrix @ bone.parent.matrix_local.inverted() @ bone.head_local
    return bone.head_local.copy()


def _set_world_rotation(rig, name, rotation):
    pb = rig.pose.bones[name]
    pb.matrix = Matrix.LocRotScale(_head(rig, name), rotation, Vector((1,1,1)))
    bpy.context.view_layer.update()


def _aim(rig, name, direction):
    bone = rig.data.bones[name]
    direction = Vector(direction).normalized()
    rest_direction = (bone.tail_local - bone.head_local).normalized()
    q = rest_direction.rotation_difference(direction) @ bone.matrix_local.to_quaternion()
    _set_world_rotation(rig, name, q)


def _finger_curl(rig, amount=.45, side=None):
    """MakeHuman's native finger joints bend toward their own palm plane."""
    for suffix in (side,) if side else ('l','r'):
        forward, palm_normal = _palm_basis(rig, suffix)
        axis = forward.cross(palm_normal).normalized()
        for finger in ('index','middle','ring','pinky'):
            for i, factor in [(1,.65),(2,1.0),(3,.8)]:
                name=f'{finger}_{i:02d}_{suffix}'
                if name not in rig.pose.bones: continue
                pb=rig.pose.bones[name]
                local_axis=pb.bone.matrix_local.to_3x3().inverted() @ axis
                pb.rotation_quaternion=Quaternion(local_axis,amount*factor)
        # Bring the thumb across the index finger instead of leaving the
        # source A-pose thumb splayed. This is a short anatomical IK chain.
        bpy.context.view_layer.update()
        names=[f'thumb_{i:02d}_{suffix}' for i in (1,2,3)]
        if all(n in rig.pose.bones for n in names):
            thumb=rig.pose.bones[names[0]]
            hand=rig.pose.bones['hand_'+suffix]
            hand_delta=hand.matrix.to_3x3() @ hand.bone.matrix_local.to_3x3().inverted()
            world_normal=hand_delta @ palm_normal
            world_forward=hand_delta @ forward
            index=rig.pose.bones['index_02_'+suffix]
            target=index.head+world_normal*.004-world_forward*.004
            base=thumb.head.copy();d=target-base
            l1=rig.data.bones[names[0]].length
            l2=sum(rig.data.bones[n].length for n in names[1:])
            distance=min(d.length,l1+l2-.001);d.normalize()
            pole=world_normal-d*d.dot(world_normal)
            if pole.length<.001:pole=world_forward-d*d.dot(world_forward)
            pole.normalize()
            along=(l1*l1-l2*l2+distance*distance)/(2*distance)
            joint=base+d*along+pole*math.sqrt(max(0,l1*l1-along*along))
            _aim(rig,names[0],joint-base)
            _aim(rig,names[1],target-joint)
            _aim(rig,names[2],target-joint)

    bpy.context.view_layer.update()


def _sole_points(rig):
    out=[]
    for suffix in ('l','r'):
        foot=rig.data.bones['foot_'+suffix];ball=rig.data.bones['ball_'+suffix]
        for name,point in [('foot_'+suffix,Vector((foot.head_local.x,foot.head_local.y+.032,.012))),
                           ('ball_'+suffix,Vector((ball.tail_local.x,ball.tail_local.y,.012)))]:
            pb=rig.pose.bones[name]
            out.append((suffix,pb.matrix @ pb.bone.matrix_local.inverted() @ point))
    return out


def _collect(rig):
    return {pb.name:(pb.location.copy(),pb.rotation_quaternion.copy()) for pb in rig.pose.bones}


def _write_clip(rig, name, samples, duration, loop=True, grounding=None, times=None, support=None, native_sideways=None, native_lance_idle=None, native_prone_idle=None, native_crouch_idle=None):
    action=bpy.data.actions.new(name)
    rig.animation_data_create();rig.animation_data.action=action
    if loop:
        first,last=samples[0],samples[-1]
        for i,sample in enumerate(samples):
            t=i/(len(samples)-1)
            for bone,(p,q) in list(sample.items()):
                shift=last[bone][0]-first[bone][0]
                mismatch=last[bone][1].inverted() @ first[bone][1]
                sample[bone]=(p-shift*t,q @ Quaternion().slerp(mismatch,t))
        samples[-1]={name:(p.copy(),q.copy()) for name,(p,q) in samples[0].items()}
    if support:
        from posture_support import fit_boots
        if name.startswith('crouch.walk.'):
            from posture_support import crouch_contact_samples
            samples,times=crouch_contact_samples(support,samples,times,duration)
        for i,sample in enumerate(samples):
            _apply_sample(rig,sample);fit_boots(support)
            samples[i]=_collect(rig)
    if grounding:
        boots,goals=grounding
        goals[-1]=goals[0]
        for i,sample in enumerate(samples):
            _apply_sample(rig,sample)
            depsgraph=bpy.context.evaluated_depsgraph_get()
            lowest=100
            for obj in boots:
                evaluated=obj.evaluated_get(depsgraph)
                mesh=evaluated.to_mesh()
                lowest=min(lowest,min((obj.matrix_world @ v.co).z for v in mesh.vertices))
                evaluated.to_mesh_clear()
            root=rig.pose.bones['Root']
            root.matrix=Matrix.Translation((0,0,goals[i]-lowest)) @ root.matrix
            sample['Root']=(root.location.copy(),root.rotation_quaternion.copy())
    prone_support=None
    if native_prone_idle is not None:
        from static_prone_support import fit_static
        for index,sample in enumerate(samples):
            _apply_sample(rig,sample);fit_static(native_prone_idle)
            samples[index]=_collect(rig)
        prone_support={'method':'retained-natural-prone-knee-plane','surface':'complete-native-boot','floor':.002,'sampleRate':FPS}
    crouch_support=None
    if native_crouch_idle is not None:
        # Keep the current native crouch while matching the shared 2 mm
        # idle, guard and sideways contact plane.
        from crouch_idle_support import support_clip as support_crouch_idle
        samples,times,crouch_support=support_crouch_idle(native_crouch_idle,samples,duration,times,FPS)
    lance_support=None
    if native_lance_idle is not None:
        # PR237 fits complete boots after loop closure. Keep the newer common
        # posture support path unchanged and correct only this native guard.
        from lance_idle_support import support_clip
        samples,times,lance_support=support_clip(native_lance_idle,samples,duration,times,FPS,'boot')
    arm_support=None
    if support is not None and name in ('prone.idle.unarmed','prone.crawl.unarmed'):
        from prone_arm_support import support_clip as support_arms
        samples,arm_support=support_arms(support,samples,duration,times,name=='prone.crawl.unarmed')
    sideways_support=None
    if native_sideways is not None:
        if name.startswith('crouch.'):
            from crouched_sideways_support import support_clip as support_sideways
        else:
            from sideways_support import support_clip as support_sideways
        ctx,speed=native_sideways
        samples,times,sideways_support=support_sideways(ctx,samples,duration,times,name,speed)
        # This reviewed legacy gait intentionally retains its original stored
        # period and pace. Do not add the nominal manifest's fractional tail.
        if name.startswith('stand.'):
            duration=math.floor(duration*FPS+.000001)/FPS
            selected=[(time,sample) for time,sample in zip(times,samples) if time<=duration+1e-7]
            times=[time for time,sample in selected];samples=[sample for time,sample in selected]
    # NLA export samples whole frames and otherwise drops a fractional end.
    # A same-pose padding key is trimmed back to this exact time after export.
    action["authored_duration"]=float(duration)
    previous={}
    for i,sample in enumerate(samples):
        frame=1+FPS*(times[i] if times is not None else duration*i/(len(samples)-1))
        for pb in rig.pose.bones:
            p,q=sample[pb.name]
            q=q.copy();q.normalize()
            if pb.name in previous and previous[pb.name].dot(q)<0:q.negate()
            previous[pb.name]=q.copy()
            pb.location=p;pb.rotation_quaternion=q
            pb.keyframe_insert(data_path='location',frame=frame,group=pb.name)
            pb.keyframe_insert(data_path='rotation_quaternion',frame=frame,group=pb.name)
    end_frame=1+FPS*duration
    if abs(end_frame-round(end_frame))>1e-7:
        for pb in rig.pose.bones:
            pb.keyframe_insert(data_path="location",frame=math.ceil(end_frame),group=pb.name)
            pb.keyframe_insert(data_path="rotation_quaternion",frame=math.ceil(end_frame),group=pb.name)
    try:
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for curve in bag.fcurves:
                        for key in curve.keyframe_points:key.interpolation='LINEAR'
    except AttributeError:
        pass
    action.use_fake_user=True
    rig.animation_data.action=None
    track=rig.animation_data.nla_tracks.new();track.name=name
    strip=track.strips.new(name,1,action);strip.name=name
    # Blender merges keys closer than its insertion epsilon. Explicit strip
    # bounds also retain an endpoint only a few microseconds below a frame.
    strip.action_frame_end=math.ceil(end_frame-1e-8)
    strip.frame_end=math.ceil(end_frame-1e-8)
    track.mute=True
    result={'name':name,'duration':round(duration,6),'loop':loop,'events':{}}
    if crouch_support:result['nativeBootSupport']=crouch_support
    if lance_support:result['nativeBootSupport']=lance_support
    if support:result['nativeBootSupport']={'method':'native-leg-rotations','surface':'actual-sole-and-weighted-shaft','floor':.006,'sampleRate':FPS}
    if prone_support:result['nativeBootSupport']=prone_support
    if sideways_support:result['nativeSidewaysSupport']=sideways_support
    if arm_support:
        if 'stride'in arm_support:result.update(arm_support.pop('stride'))
        result['nativeArmSupport']=arm_support
    return result


def _retarget_clip(ctx,clip_name,file,start,end):
    rig=ctx['rig'];bvh=BVH(VENDOR/file)
    count=round((end-start)*bvh.dt*FPS)
    duration=count/FPS
    sampled=[bvh.sample(start+(end-start)*i/count) for i in range(count+1)]
    # Use the actor's chest plane, not the camera, to establish forward.
    across=sum((p['LeftArm'][0]-p['RightArm'][0] for p in sampled),Vector())
    alignment=Quaternion(UP,-math.atan2(across.y,across.x))
    reference=bvh.sample(0)
    src_leg=sum((reference[a][0]-reference[b][0]).length for a,b in [('LeftUpLeg','LeftLeg'),('LeftLeg','LeftFoot')])
    dst_leg=sum(rig.data.bones[n].length for n in ('thigh_l','calf_l'))
    scale=dst_leg/src_leg
    mean_hip=sum(p['Hips'][0].z for p in sampled)/len(sampled)
    min_source_foot=min(min(p['LeftFoot'][0].z,p['RightFoot'][0].z) for p in sampled)
    all_samples=[];foot_path=[];ground_heights=[]
    boots=[o for o in ctx['objects'] if 'Boot' in o.name]
    for sample in sampled:
        _reset(rig)
        # Recorded pelvis rise/fall, body rotation, and counter-rotation.
        for name in BODY_MAP:
            source=BODY_MAP[name]
            q=alignment @ sample[source][1] @ reference[source][1].inverted()
            _set_world_rotation(rig,name,q @ rig.data.bones[name].matrix_local.to_quaternion())
        for suffix in ('l','r'):
            parent=rig.pose.bones['spine_03']
            delta=parent.matrix.to_quaternion() @ parent.bone.matrix_local.to_quaternion().inverted()
            _set_world_rotation(rig,'clavicle_'+suffix,delta @ rig.data.bones['clavicle_'+suffix].matrix_local.to_quaternion())
        for pb in _bone_order(rig):
            if pb.name not in SEGMENTS:continue
            a,b=SEGMENTS[pb.name]
            direction=alignment @ (sample[b][0]-sample[a][0])
            if direction.length>1e-5:_aim(rig,pb.name,direction)
        # The BVH hand channels have marker noise. A nearly straight wrist
        # follows the forearm; softly curled native fingers form a relaxed hand.
        for suffix in ('l','r'):
            forearm=rig.pose.bones['lowerarm_'+suffix]
            inward=Vector((-1 if suffix=='l' else 1,0,0))
            hand_q=_hand_rotation(rig,suffix,forearm.tail-forearm.head,inward)
            _set_world_rotation(rig,'hand_'+suffix,hand_q)
        _finger_curl(rig,1.03 if clip_name=='Run' else .73)
        sole=_sole_points(rig)
        min_sole=min(p.z for _,p in sole)
        airborne=max(0,(min(sample['LeftFoot'][0].z,sample['RightFoot'][0].z)-min_source_foot)*scale-.035) if clip_name=='Run' else 0
        root=rig.pose.bones['Root']
        root.matrix=Matrix.Translation((0,0,-min_sole+airborne+.008)) @ root.matrix
        bpy.context.view_layer.update()
        foot_path.append({s:min((p for side,p in _sole_points(rig) if side==s),key=lambda p:p.z).copy() for s in ('l','r')})
        all_samples.append(_collect(rig))
        ground_heights.append(airborne+.002)
    meta=_write_clip(rig,clip_name,all_samples,duration,grounding=(boots,ground_heights))
    meta['source']={'database':'CMU','file':file,'startFrame':start,'endFrame':end,'sampleRate':round(1/bvh.dt)}
    speeds=[]
    for i in range(1,len(foot_path)-1):
        for side in ('l','r'):
            a,p,b=foot_path[i-1][side],foot_path[i][side],foot_path[i+1][side]
            if p.z<.045 and b.y>a.y:
                speeds.append((b.y-a.y)/(2*duration/count))
    source_displacement=alignment @ (sampled[-1]['Hips'][0]-sampled[0]['Hips'][0])
    speed=float(np.median(speeds)) if speeds else -source_displacement.y*scale/duration
    meta['locomotionSpeed']=round(max(.1,speed),3) if clip_name in ('Walk','Run') else 0
    return meta,all_samples[0]


def _palm_basis(rig,suffix):
    bones=rig.data.bones
    wrist=bones['hand_'+suffix].head_local
    middle=bones['middle_01_'+suffix].head_local
    across=bones['index_01_'+suffix].head_local-bones['pinky_01_'+suffix].head_local
    long=(middle-wrist).normalized()
    normal=across.cross(long).normalized()*(-1 if suffix=='l' else 1)
    return long,normal


def _frame(long,normal):
    y=Vector(long).normalized()
    z=Vector(normal)-y*y.dot(normal)
    if z.length<.01:z=y.cross(Vector((1,0,0)))
    z.normalize();x=y.cross(z).normalized()
    return Matrix((x,y,z)).transposed()


def _hand_rotation(rig,suffix,long,normal):
    native_long,native_normal=_palm_basis(rig,suffix)
    return (_frame(long,normal) @ _frame(native_long,native_normal).inverted() @ rig.data.bones['hand_'+suffix].matrix_local.to_3x3()).to_quaternion()


def _arm_ik(rig,suffix,wrist,pole):
    upper=rig.data.bones['upperarm_'+suffix];lower=rig.data.bones['lowerarm_'+suffix]
    shoulder=_head(rig,upper.name);wrist=Vector(wrist)
    direction=wrist-shoulder; distance=min(direction.length,upper.length+lower.length-.002)
    direction.normalize();wrist=shoulder+direction*distance
    pole=Vector(pole)-shoulder;pole-=direction*pole.dot(direction)
    if pole.length<.001:pole=direction.cross(Vector((0,1,0)))
    pole.normalize()
    along=(upper.length**2-lower.length**2+distance**2)/(2*distance)
    height=math.sqrt(max(0,upper.length**2-along**2))
    elbow=shoulder+direction*along+pole*height
    _aim(rig,upper.name,elbow-shoulder)
    _aim(rig,lower.name,wrist-elbow)
    return wrist


def _apply_sample(rig,sample):
    for pb in rig.pose.bones:
        pb.location=sample[pb.name][0];pb.rotation_quaternion=sample[pb.name][1]
    bpy.context.view_layer.update()


def _grip_setup(ctx):
    rig=ctx['rig'];bone=rig.data.bones['hand_r']
    from firearm_grips import grip_frame, rifle_support_point
    offsets={}
    for key,group in ctx.get('weapons',{}).items():
        local_center,hand_in_weapon=grip_frame(rig,'r',key,_palm_basis,_hand_rotation,ctx.get('gender'))
        bind=Matrix.LocRotScale(local_center,hand_in_weapon.inverted(),Vector((1,1,1)))
        group.parent=rig;group.parent_type='BONE';group.parent_bone='hand_r'
        group.matrix_parent_inverse=Matrix.Translation((0,-bone.length,0))
        group.matrix_basis=bind
        offsets[key]=(local_center.copy(),hand_in_weapon.copy())
    ctx.setdefault('weapon_grips',{})['rifle_support']=rifle_support_point(rig)
    return offsets


def _weapon_pose(ctx,base,key,position,rotation,offsets,recoil=0):
    rig=ctx['rig'];_apply_sample(rig,base)
    if recoil and key in ('rifle','pistol'):
        spine=rig.pose.bones['spine_01']
        lean=recoil/(.41 if key=='rifle' else 2.0)
        _set_world_rotation(rig,'spine_01',Quaternion(Vector((1,0,0)),-lean) @ spine.matrix.to_quaternion())
    # A modest torso turn puts the supporting shoulder forward and keeps
    # both elbows within their anatomical reach around a shoulder stock.
    torso_turn=-.16 if key=='rifle' else -.06
    spine=rig.pose.bones['spine_03']
    _set_world_rotation(rig,'spine_03',Quaternion(UP,torso_turn) @ spine.matrix.to_quaternion())
    gun_pos=Vector(position);gun_q=rotation
    local_grip,hand_offset=offsets[key]
    hand_q=gun_q @ hand_offset
    wrist=gun_pos-hand_q @ local_grip
    pole=Vector((-.41,-.12,1.22 if key=='rifle' else 1.10))
    if key in ('rifle','pistol'):
        from firearm_grips import grip_elbow, align_arm_roll
        pole=grip_elbow(rig,'r',wrist,hand_q,guide=pole)
    actual_wrist=_arm_ik(rig,'r',wrist,pole)
    _set_world_rotation(rig,'hand_r',hand_q)
    if key in ('rifle','pistol'):align_arm_roll(rig,'r',hand_q,_set_world_rotation)
    _finger_curl(rig,1.36 if key=='rifle' else 1.23 if key=='pistol' else 1.33,'r')
    if key in ('rifle','pistol'):
        _trigger_finger(rig,ctx['weapons'][key],key)
    # If a requested grip lies outside reach, report the actual arm solution.
    actual_grip=actual_wrist+hand_q @ local_grip
    if key=='rifle':
        from firearm_grips import rifle_support_frame, rifle_fingers
        left_wrist,left_q=rifle_support_frame(rig,actual_grip,gun_q,_hand_rotation)
        pole=grip_elbow(rig,'l',left_wrist,left_q,guide=Vector((.24,-.25,1.03)))
        _arm_ik(rig,'l',left_wrist,pole)
        align_arm_roll(rig,'l',left_q,_set_world_rotation)
        rifle_fingers(rig,'l')
    else:
        # Free hand remains relaxed at the soldier's left side.
        _finger_curl(rig,.70,'l')
    # Slight neck inclination brings the right cheek toward the shouldered
    # stock, while the muzzle remains level in world space.
    if key=='rifle':
        neck=rig.pose.bones['neck_01']
        _set_world_rotation(rig,'neck_01',Quaternion(Vector((0,1,0)),-.20) @ Quaternion(Vector((1,0,0)),.18) @ neck.matrix.to_quaternion())
    # A small head turn follows the aim without a twisted neck.
    head=rig.pose.bones['head']
    aim_turn=-.12 if key=='rifle' else -.08
    _set_world_rotation(rig,'head',Quaternion(UP,aim_turn) @ head.matrix.to_quaternion())
    return _collect(rig)


def _smooth_key(values,t):
    for i in range(len(values)-1):
        ta,a=values[i];tb,b=values[i+1]
        if t<=tb:
            u=max(0,min(1,(t-ta)/(tb-ta)));u=u*u*(3-2*u)
            return a+(b-a)*u
    return values[-1][1]



def _trigger_finger(rig,weapon,key,trigger=True):
    from firearm_grips import fit_firearm_fingers
    fit_firearm_fingers(rig,weapon,key,_aim,trigger)


# Production semantic bank. The game owns action time and movement; clips only
# describe visible poses, contact phases, and the speed of the captured gait.
SAMPLE_FPS = 15
SOURCE_RECIPES = {
    'idle': ('111_28.bvh', 120, 360, 'standing still'),
    'walk': ('07_01.bvh', 100, 230, 'walk'),
    'run': ('02_03.bvh', 40, 131, 'run/jog'),
    'crouch': ('136_09.bvh', 430, 614, 'crouching, walking forward'),
    'strafeRightStanding': ('141_33.bvh', 156, 310, 'sideways walk, foot to foot, right'),
    'strafeLeftStanding': ('141_33.bvh', 780, 922, 'sideways walk, foot to foot, left'),
    'strafeRightCrouched': ('139_14.bvh', 172, 340, 'sideways sneak, right'),
    'strafeLeftCrouched': ('139_14.bvh', 620, 814, 'sideways sneak, left'),
    'crawl': ('111_03.bvh', 450, 686, 'crawling; adapted to forearm/belly contact'),
    'climbUp': ('143_37.bvh', 48, 232, 'ladder, climbing up'),
    'climbDown': ('143_37.bvh', 296, 465, 'ladder, climbing down'),
    'recover': ('140_01.bvh', 130, 536, 'getting up from face down'),
    'fall': ('90_18.bvh', 58, 212, 'rug pull, falling backwards'),
}


def _copy_pose(sample):
    return {n:(p.copy(),q.copy()) for n,(p,q) in sample.items()}


def _blend(a,b,t):
    t=max(0,min(1,t));return {n:(p.lerp(b[n][0],t),q.slerp(b[n][1],t)) for n,(p,q) in a.items()}


def _at(samples,t):
    f=max(0,min(1,t))*(len(samples)-1);i=int(f)
    return _blend(samples[i],samples[min(i+1,len(samples)-1)],f-i)


def _root_shift(rig,delta):
    pb=rig.pose.bones['Root'];pb.matrix=Matrix.Translation(delta) @ pb.matrix
    bpy.context.view_layer.update()


def _body_floor(rig):
    """Conservative contact hull from native joints, in metres."""
    points=[p.z for _,p in _sole_points(rig)]
    for n,radius in [('pelvis',.09),('spine_02',.085),('head',.095),('calf_l',.035),('calf_r',.035),('hand_l',.016),('hand_r',.016)]:
        points.append(rig.pose.bones[n].head.z-radius)
    return min(points)


def _retarget_samples(ctx,recipe):
    rig=ctx['rig'];file,start,end,description=SOURCE_RECIPES[recipe]
    bvh=BVH(VENDOR/file);duration=(end-start)*bvh.dt
    count=max(2,round(duration*SAMPLE_FPS))
    source=[bvh.sample(start+(end-start)*i/count) for i in range(count+1)]
    reference=bvh.sample(0)
    across=sum((p['LeftArm'][0]-p['RightArm'][0] for p in source[:max(1,len(source)//4)]),Vector())
    alignment=Quaternion(UP,-math.atan2(across.y,across.x))
    source_leg=sum((reference[a][0]-reference[b][0]).length for a,b in [('LeftUpLeg','LeftLeg'),('LeftLeg','LeftFoot')])
    scale=sum(rig.data.bones[n].length for n in ('thigh_l','calf_l'))/source_leg
    floor=min(min(p[n][0].z for n in ('LeftFoot','RightFoot')) for p in source)
    out=[];feet=[];knees=[]
    for index,p in enumerate(source):
        _reset(rig)
        for name,src in BODY_MAP.items():
            _set_world_rotation(rig,name,alignment @ p[src][1] @ reference[src][1].inverted() @ rig.data.bones[name].matrix_local.to_quaternion())
        for suffix in ('l','r'):
            chest=rig.pose.bones['spine_03'];delta=chest.matrix.to_quaternion() @ chest.bone.matrix_local.to_quaternion().inverted()
            _set_world_rotation(rig,'clavicle_'+suffix,delta @ rig.data.bones['clavicle_'+suffix].matrix_local.to_quaternion())
        for pb in _bone_order(rig):
            if pb.name in SEGMENTS:
                a,b=SEGMENTS[pb.name];_aim(rig,pb.name,alignment @ (p[b][0]-p[a][0]))
        height=(p['Hips'][0].z-floor)*scale+.065
        if recipe in ('climbUp','climbDown'):
            # Surface-level travel is supplied by the game's movement path.
            height-=(source[-1]['Hips'][0].z-source[0]['Hips'][0].z)*scale*index/count
        _root_shift(rig,(0,0,height-rig.pose.bones['pelvis'].head.z))
        if recipe in ('idle','walk','run','crouch') or recipe.startswith('strafe'):
            for suffix in ('l','r'):
                fore=rig.pose.bones['lowerarm_'+suffix]
                _set_world_rotation(rig,'hand_'+suffix,_hand_rotation(rig,suffix,fore.tail-fore.head,Vector((-1 if suffix=='l' else 1,0,0))))
            air=max(0,(min(p['LeftFoot'][0].z,p['RightFoot'][0].z)-floor)*scale-.035) if recipe=='run' else 0
            _root_shift(rig,(0,0,.006+air-min(v.z for _,v in _sole_points(rig))))
        elif recipe not in ('climbUp','climbDown'):
            # Fall/recovery tracks preserve source pelvis height. Prevent the
            # native body contact hull from going through the plane.
            lowest=_body_floor(rig)
            if lowest<.003:_root_shift(rig,(0,0,.003-lowest))
        if recipe=='recover':
            for side,label in [('l','Left'),('r','Right')]:
                from posture_support import support_hand,phase
                hand=rig.pose.bones['hand_'+side];elbow=rig.pose.bones['lowerarm_'+side].head.copy()
                palm=hand.head.lerp(rig.pose.bones['middle_01_'+side].head,.72)
                contact=1-phase((p[label+'Hand'][0].z-floor)*scale,.025,.15)
                rotation=hand.matrix.to_quaternion().slerp(_hand_rotation(rig,side,FORWARD,Vector((0,0,-1))),contact)
                palm.z=max(.050,palm.z)
                support_hand(ctx,side,palm,elbow,rotation,.25,.080,outward=1 if side=='l' else -1)
        _finger_curl(rig,.25 if recipe=='recover' else .85 if recipe=='run' else .72)
        feet.append({s:min((v for side,v in _sole_points(rig) if s==side),key=lambda v:v.z).copy() for s in ('l','r')})
        knees.append({s:rig.pose.bones['calf_'+s].head.y-rig.pose.bones['pelvis'].head.y for s in ('l','r')})
        if recipe in ('strafeLeftStanding','strafeRightStanding'):
            # The accepted unarmed lateral solver derives its handovers from
            # the captured boot motion, before generic equipment support.
            ctx.setdefault('native_sideways_samples',{}).setdefault(recipe,[]).append(_collect(rig))
        if recipe in ('crouch','run','walk') or recipe.startswith('strafe'):
            from posture_support import fit_boots
            fit_boots(ctx)
        out.append(_collect(rig))
    speeds=[]
    lateral=recipe.startswith('strafe');axis=0 if lateral else 1
    displacement=alignment@(source[-1]['Hips'][0]-source[0]['Hips'][0])
    reverse=-1 if displacement[axis]>0 else 1
    for i in range(1,len(feet)-1):
        for side in ('l','r'):
            a,p,b=feet[i-1][side],feet[i][side],feet[i+1][side]
            if p.z<.05 and (b[axis]-a[axis])*reverse>0:speeds.append((b[axis]-a[axis])*reverse/(2*duration/count))
    delta=alignment @ (source[-1]['Hips'][0]-source[0]['Hips'][0])
    speed=float(np.median(speeds)) if speeds else abs(delta[axis])*scale/duration
    return out,{'kneeCenter':{side:sum(p[side] for p in knees)/len(knees) for side in ('l','r')},'duration':duration,'locomotionSpeed':round(max(.05,speed),4),'source':{'database':'CMU','file':file,'startFrame':start,'endFrame':end,'description':description,'sampleRate':round(1/bvh.dt)}}


def _leg_ik(rig,side,ankle,pole):
    upper=rig.data.bones['thigh_'+side];lower=rig.data.bones['calf_'+side]
    hip=_head(rig,upper.name);d=Vector(ankle)-hip
    distance=max(.01,min(d.length,upper.length+lower.length-.002));d.normalize()
    axis=Vector(pole)-hip;axis-=d*axis.dot(d)
    if axis.length<.001:axis=Vector((0,-1,0))
    axis.normalize();along=(upper.length**2-lower.length**2+distance**2)/(2*distance)
    knee=hip+d*along+axis*math.sqrt(max(0,upper.length**2-along**2))
    _aim(rig,upper.name,knee-hip);_aim(rig,lower.name,hip+d*distance-knee)


def _reach(rig,side,target,pole=None,long=FORWARD,normal=UP,curl=.4):
    shoulder=_head(rig,'upperarm_'+side)
    pole=Vector(pole) if pole else shoulder+Vector((.25 if side=='l' else -.25,.06,-.35))
    q=_hand_rotation(rig,side,long,normal)
    hand=rig.data.bones['hand_'+side]
    palm=hand.matrix_local.inverted() @ hand.head_local.lerp(rig.data.bones['middle_01_'+side].head_local,.72)
    _arm_ik(rig,side,Vector(target)-q @ palm,pole)
    _set_world_rotation(rig,'hand_'+side,q);_finger_curl(rig,curl,side)


def _prone_pose(ctx,base,source_sample=None,phase_center=None,crawl_phase=None):
    rig=ctx['rig'];_apply_sample(rig,base)
    q=Quaternion(Vector((1,0,0)),math.pi/2)
    for name in BODY_MAP:_set_world_rotation(rig,name,q @ rig.data.bones[name].matrix_local.to_quaternion())
    _set_world_rotation(rig,'spine_03',Quaternion(Vector((1,0,0)),1.24) @ rig.data.bones['spine_03'].matrix_local.to_quaternion())
    _root_shift(rig,(0,0,.205-rig.pose.bones['pelvis'].head.z))
    from posture_support import crawl_assistance
    assistance=crawl_assistance(ctx,crawl_phase) if crawl_phase is not None else None
    pelvis=rig.pose.bones['pelvis'].head.copy()
    initial=_collect(rig);phases={'l':0,'r':0}
    if source_sample:
        _apply_sample(rig,source_sample)
        phases={side:max(-.16,min(.16,(rig.pose.bones['calf_'+side].head.y-rig.pose.bones['pelvis'].head.y-(phase_center or {}).get(side,0))*1.8)) for side in ('l','r')}
        _apply_sample(rig,initial)
    for side,sign in [('l',1),('r',-1)]:
        phase=phases[side]
        from posture_support import prone_leg
        # Alternate the leg draw; simultaneous positive source knee offsets
        # must not fold both legs into a wide frog posture.
        other=phases['r' if side=='l' else 'l']
        advance=assistance[side] if assistance is not None else max(0,min(.16,phase-other))
        prone_leg(ctx,side,sign,pelvis,advance)
        shoulder=_head(rig,'upperarm_'+side)
        from posture_support import support_hand
        support_hand(ctx,side,(pelvis.x*.5+sign*.21,shoulder.y-.25+phase,.105),(sign*.29,shoulder.y+.03,.09),_hand_rotation(rig,side,FORWARD,Vector((0,0,-1))),.25,.090)
    for name in ('neck_01','head'):_set_world_rotation(rig,name,Quaternion(Vector((1,0,0)),.40) @ rig.data.bones[name].matrix_local.to_quaternion())
    from posture_support import fit_boots
    fit_boots(ctx)
    return _collect(rig)


def _crawl_stride(rig,samples,duration):
    """Calibrate the adapted belly crawl from its supporting forearms.

    The source is a hands-and-knees crawl. Its grounded-foot velocity cannot
    describe the final prone pose, which is pulled forward by the forearms.
    Samples must be the closed loop written by _write_clip, in native metres.
    All carried-equipment variants retain this underlying body travel.
    """
    saved=_collect(rig);contacts=[]
    for sample in samples:
        _apply_sample(rig,sample)
        contacts.append([rig.pose.bones['lowerarm_'+side].head.copy() for side in ('l','r')])
    _apply_sample(rig,saved)
    step=duration/(len(samples)-1);speeds=[]
    for index in range(1,len(contacts)-1):
        for side in (0,1):
            before,current,after=(contacts[i][side] for i in (index-1,index,index+1))
            # Elbow centres within 9 cm of the plane support the low prone
            # body. +Y is rearward in the native authoring coordinates.
            velocity=(after.y-before.y)/(2*step)
            if current.z<=.09 and velocity>0:speeds.append(velocity)
    if not speeds:raise ValueError('Prone crawl has no rearward forearm support samples')
    speed=round(float(np.median(speeds)),6)
    return {'locomotionSpeed':speed,'nativeStrideSpeed':speed,'authoredStrideSpeed':speed,
            'strideDistance':round(speed*duration,6),
            'strideMeasurement':{'method':'median rearward forearm contact velocity',
                                 'bones':['lowerarm_l','lowerarm_r'],
                                 'maximumContactHeight':.09,'sampleCount':len(speeds)}}


def _mounted_pose(ctx,base):
    rig=ctx['rig'];_apply_sample(rig,base)
    _root_shift(rig,(0,0,rig.data.bones['pelvis'].head_local.z-rig.pose.bones['pelvis'].head.z))
    pelvis=rig.pose.bones['pelvis'].head.copy()
    from riding_motion import fit_legs
    pelvis=fit_legs(ctx,pelvis)
    for side,sign in [('l',1),('r',-1)]:
        _reach(rig,side,pelvis+Vector((sign*.10,-.34,.16)),long=Vector((0,-.2,-.1)),normal=Vector((-sign,0,0)),curl=.85)
    return _collect(rig)


def _gun_pose(ctx,base,key,offsets,mode='aim',recoil=0,posture=None):
    rig=ctx['rig'];_apply_sample(rig,base)
    chest=(rig.pose.bones['upperarm_l'].head+rig.pose.bones['upperarm_r'].head)*.5;pelvis=rig.pose.bones['pelvis'].head.copy()
    prone=chest.z-pelvis.z<.13
    posture=posture or ('prone' if prone else 'crouched' if pelvis.z<.8 else 'standing')
    aim_profile=None
    if mode=='reload':
        position=pelvis+Vector((-.18,-.20,.06));rotation=Quaternion(UP,-math.pi/2) @ Quaternion(Vector((0,1,0)),-1.38 if key=='rifle' else -.7)
        if prone:
            # Lay the long barrel across the front of the shoulders. The
            # muzzle is then reachable by the opposite hand while prone.
            position=chest+Vector((-.43,-.16,.08));rotation=Quaternion()
    elif mode=='carry':
        position=pelvis+Vector((-.12,-.20,.15));rotation=Quaternion(UP,-math.pi/2) @ Quaternion(Vector((0,1,0)),-.98 if key=='rifle' else .80)
        if key=='rifle' and chest.z-pelvis.z<.34:
            # A low, forward-leaning sneak cannot carry the barrel upright:
            # it would cross the head. Keep the stock beside the shoulder
            # and the barrel ahead, with both hands on the same rigid gun.
            position=chest+Vector((-.16,-.28,-.08));rotation=Quaternion(UP,math.radians(-85)) @ Quaternion(Vector((0,1,0)),.08)
        if key=='rifle' and posture=='mounted':
            position=chest+Vector((-.16,-.30,-.12));rotation=Quaternion(UP,math.radians(-65)) @ Quaternion(Vector((0,1,0)),.08)
        if prone:
            position=chest+Vector((-.12,-.26,.07));rotation=Quaternion(UP,math.radians(-85))
    else:
        position=chest+Vector((-.104,-.335,.035)) if key=='rifle' else chest+Vector((-.13,-.50,-.07))
        if prone:position=chest+Vector((-.12,-.26,.075))
        rotation=Quaternion(UP,math.radians(-75 if key=='rifle' else -85))
        position-=rotation @ Vector((recoil,0,0))
    if key=='rifle' and mode=='carry':
        from firearm_grips import rifle_carry_position
        position=rifle_carry_position(ctx,position,rotation,_hand_rotation)
    if key=='rifle' and mode=='aim':
        from firearm_grips import rifle_sight_pose,RIFLE_AIM_PROFILES
        rotation=rotation@Quaternion(Vector((0,1,0)),-recoil*1.2)
        position,rotation=rifle_sight_pose(ctx,position,rotation,_set_world_rotation,posture,recoil)
        aim_profile=RIFLE_AIM_PROFILES.get(ctx['gender'],{}).get(posture)
    elif key=='pistol' and mode=='aim':
        from firearm_grips import pistol_sight_pose
        rotation=rotation@Quaternion(Vector((0,1,0)),-recoil*2.3)
        position,rotation=pistol_sight_pose(ctx,rotation,_set_world_rotation,recoil/.07 if recoil else 0)
    local_grip,hand_offset=offsets[key];hand_q=rotation @ hand_offset
    right_pole=_head(rig,'upperarm_r')+Vector((-.20,.10,-.26 if not prone else -.07))
    wrist=position-hand_q @ local_grip
    if key in ('rifle','pistol'):
        from firearm_grips import grip_elbow,align_arm_roll
        right_pole=grip_elbow(rig,'r',wrist,hand_q,guide=right_pole,aiming=key=='rifle' and mode=='aim')
    actual=_arm_ik(rig,'r',wrist,right_pole)
    _set_world_rotation(rig,'hand_r',hand_q);_finger_curl(rig,1.36 if key=='rifle' else 1.23 if key=='pistol' else 1.33,'r')
    if key in ('rifle','pistol'):align_arm_roll(rig,'r',hand_q,_set_world_rotation)
    if key in ctx.get('weapons',{}):_trigger_finger(rig,ctx['weapons'][key],key,trigger=mode=='aim')
    grip=actual+hand_q @ local_grip
    if key=='rifle':
        from firearm_grips import rifle_support_frame,rifle_fingers
        left_wrist,left_q=rifle_support_frame(rig,grip,rotation,_hand_rotation,
            support_x=aim_profile['supportX'] if aim_profile else None,roll=aim_profile['supportRoll'] if aim_profile else 0)
        guide=_head(rig,'upperarm_l')+Vector((.10,-.15,-.32 if not prone else -.09))
        # A planted crouch keeps the support elbow on one side of the arm.
        # Re-optimizing both elbow branches can reverse it during a side step.
        pole=guide if mode=='carry'and posture=='crouched'else grip_elbow(rig,'l',left_wrist,left_q,guide=guide,support_height=.075 if prone and mode=='aim' else None)
        _arm_ik(rig,'l',left_wrist,pole)
        align_arm_roll(rig,'l',left_q,_set_world_rotation)
        rifle_fingers(rig,'l',posture=posture if mode=='aim' else None)
    return _collect(rig),grip,rotation


def _blade_key(ctx,base,offsets,phase=0,key='sabre'):
    rig=ctx['rig'];_apply_sample(rig,base);pelvis=rig.pose.bones['pelvis'].head.copy()
    # The torso drives the short seated/crouched cut; the free arm follows
    # the shoulder rather than remaining fixed in the locomotion pose.
    for name,share in [('spine_01',.35),('spine_02',.35),('spine_03',.30)]:
        bone=rig.pose.bones[name]
        _set_world_rotation(rig,name,Quaternion(UP,phase*.38*share)@bone.matrix.to_quaternion())
    # Carry in front of the actual shoulders, including a leaning crouch.
    # A pelvis-relative grip can sit behind the shoulders and force the
    # elbow above the head even though the weapon is held at waist height.
    chest=(_head(rig,'upperarm_l')+_head(rig,'upperarm_r'))*.5
    load=max(0,-phase/.65);drive=max(0,phase)
    position=chest+Vector((-.20+.24*drive,-.25-.22*drive+.08*load,-.15+.20*load-.01*drive))
    rotation=Quaternion(UP,math.radians(-65)+phase*.35) @ Quaternion(Vector((0,1,0)),.26+drive*1.65-load*.60)
    p,q=offsets[key];wq=rotation @ q
    from firearm_grips import align_arm_roll
    wrist=position-wq@p
    pole=_head(rig,'upperarm_r')+Vector((-.24,.04,-.30))
    _arm_ik(rig,'r',wrist,pole)
    fore=(_head(rig,'hand_r')-_head(rig,'lowerarm_r')).normalized()
    native_long,_=_palm_basis(rig,'r')
    long=wq@rig.data.bones['hand_r'].matrix_local.to_quaternion().inverted()@native_long
    bend=long.angle(fore)
    if bend>math.radians(35):
        wq=Quaternion().slerp(long.rotation_difference(fore),(bend-math.radians(35))/bend)@wq
    align_arm_roll(rig,'r',wq,_set_world_rotation);_finger_curl(rig,1.26,'r')
    shoulder=_head(rig,'upperarm_l')
    wrist=_head(rig,'hand_l')+Vector((.035*abs(phase),.10*abs(phase),-.055*abs(phase)))
    _arm_ik(rig,'l',wrist,shoulder+Vector((.20,.05,-.30)))
    fore=rig.pose.bones['lowerarm_l']
    hand=_hand_rotation(rig,'l',fore.tail-fore.head,Vector((-1,0,0)))
    align_arm_roll(rig,'l',hand,_set_world_rotation)
    _finger_curl(rig,1.05,'l')
    return _collect(rig)


def _blade_pose(ctx,base,offsets,phase=0,key='sabre'):
    # Interpolate the authored joint poses, so the elbow follows an arc.
    # Solving a straight wrist path at every frame crosses the shoulder's
    # bend-plane singularity in the low crouch and reverses the elbow.
    if abs(phase)<1e-7:return _blade_key(ctx,base,offsets,0,key)
    end=-.65 if phase<0 else 1
    ready=_blade_key(ctx,base,offsets,0,key)
    contact=_blade_key(ctx,base,offsets,end,key)
    return _blend(ready,contact,min(1,phase/end))


def _lance_pose(ctx,base,offsets,mode='carry',phase=0,posture=None):
    if mode!='thrust':
        from lance_grips import carry_pose
        return carry_pose(ctx,base,offsets,mode,posture)
    rig=ctx['rig'];_apply_sample(rig,base)
    pelvis=rig.pose.bones['pelvis'].head.copy();chest=(rig.pose.bones['upperarm_l'].head+rig.pose.bones['upperarm_r'].head)*.5
    prone=chest.z-pelvis.z<.13
    level=mode in ('brace','thrust') or prone
    rotation=Quaternion(Vector((1,0,0)),math.pi/2 if level else .10)
    grip=chest+Vector((-.24,-.18-.22*phase,-.20)) if level else pelvis+Vector((-.25,-.07,.22))
    if prone:grip=chest+Vector((-.19,-.22,.065))
    if posture=='mounted' and not level:
        # The full shaft extends below the fist. Carry it outside the
        # measured horse barrel, with room for the galloping body roll.
        from mounted_motion import measure_tack
        grip.x=-abs(measure_tack(ctx)['stirrups']['r'].x)-.055
    local,offset=offsets['sabre'];hand_q=rotation@offset
    _arm_ik(rig,'r',grip-hand_q@local,_head(rig,'upperarm_r')+Vector((-.24,.10,-.28)))
    _set_world_rotation(rig,'hand_r',hand_q);_finger_curl(rig,1.28,'r')
    if mode=='brace':
        actual=rig.pose.bones['hand_r'].matrix@local
        _reach(rig,'l',actual+rotation@Vector((0,0,.18)),long=rotation@Vector((1,0,0)),normal=rotation@Vector((0,-1,0)),curl=1.2)
    from lance_grips import thrust_pose
    return thrust_pose(ctx,offsets)


def _equipment_pose(ctx,base,equipment,offsets,mode='carry',posture=None):
    if equipment=='long-gun' and posture=='standing' and mode=='strafe-carry':
        # Keep the native lateral gait while using the reviewed chest-level
        # rifle carry. The generic upright carry folds the support wrist.
        from reviewed_motion import _carry_pose
        return _carry_pose(ctx,base,base,'rifle','Walk',offsets)
    if equipment in ('long-gun','short-gun'):return _gun_pose(ctx,base,'rifle' if equipment=='long-gun' else 'pistol',offsets,mode,posture='mounted' if posture=='mounted' and equipment=='long-gun' else None)[0]
    if equipment in ('blade','knife'):return _blade_pose(ctx,base,offsets,key='knife' if equipment=='knife' else 'sabre')
    if equipment=='lance':return _lance_pose(ctx,base,offsets,mode,posture=posture)
    return _copy_pose(base)


def _reload_pose(ctx,base,key,offsets,t,gesture):
    from maintenance_pose import pose
    return pose(ctx,base,key,offsets,t,gesture)


def _gesture_reach(rig,side,target,weight,curl,offer=False):
    """Reach along a stable elbow plane, with a neutral local wrist."""
    hand=rig.pose.bones['hand_'+side]
    names=['upperarm_'+side,'lowerarm_'+side,'hand_'+side]
    start={name:rig.pose.bones[name].rotation_quaternion.copy()for name in names}
    if weight<1e-6:
        _finger_curl(rig,curl,side);return
    shoulder=_head(rig,'upperarm_'+side);sign=1 if side=='l' else -1
    pole=shoulder+Vector((sign*.35,.20,-.12))
    palm=hand.bone.matrix_local.inverted()@hand.bone.head_local.lerp(rig.data.bones['middle_01_'+side].head_local,.72)
    rotation=hand.matrix.to_quaternion().copy()
    target=Vector(target)
    for _ in range(4):
        _arm_ik(rig,side,target-rotation@palm,pole)
        upper=rig.pose.bones['upperarm_'+side];lower=rig.pose.bones['lowerarm_'+side]
        ru=(lower.bone.head_local-upper.bone.head_local).normalized()
        rl=(hand.bone.head_local-lower.bone.head_local).normalized();rp=ru.cross(rl).normalized()
        pu=(lower.head-upper.head).normalized();pl=(hand.head-lower.head).normalized();pp=pu.cross(pl).normalized()
        _set_world_rotation(rig,upper.name,(_frame(pu,pp)@_frame(ru,rp).inverted()).to_quaternion()@upper.bone.matrix_local.to_quaternion())
        _set_world_rotation(rig,lower.name,(_frame(pl,pp)@_frame(rl,rp).inverted()).to_quaternion()@lower.bone.matrix_local.to_quaternion())
        if offer:_set_world_rotation(rig,lower.name,Quaternion(pl,sign*math.radians(55))@lower.matrix.to_quaternion())
        hand.rotation_quaternion=Quaternion()
        bpy.context.view_layer.update();rotation=hand.matrix.to_quaternion().copy()
    for name in names:
        bone=rig.pose.bones[name];bone.rotation_quaternion=start[name].slerp(bone.rotation_quaternion,weight)
    bpy.context.view_layer.update()
    _finger_curl(rig,curl,side)


def _gesture_pose(ctx,base,gesture,t,bank):
    rig=ctx['rig'];envelope=math.sin(math.pi*t)**2
    pose=base
    if gesture in ('pickup','heal','free') and bank.get('canCrouch'):
        from posture_support import ground_reach
        pose=ground_reach(ctx,base,bank['crouched'],envelope,bank['prone'])
    _apply_sample(rig,pose)
    pelvis=rig.pose.bones['pelvis'].head.copy();chest=rig.pose.bones['spine_03'].head.copy();head=rig.pose.bones['head'].head.copy()
    target=chest+Vector((-.12,-.45,-.18));side='r';other=False;curl=.4
    if gesture in ('pickup','heal','free'):
        target=pelvis+Vector((-.12,-.43,-.36));target.z=max(.035,target.z);other=gesture!='pickup'
    elif gesture=='equip':target=pelvis+Vector((-.13,-.15,.04));curl=1.0
    elif gesture=='offer':target=chest+Vector((-.15,-.50,-.25));normal=UP
    elif gesture=='grab':target=chest+Vector((-.15,-.56,-.13));curl=1.1
    elif gesture=='door':target=chest+Vector((-.21,-.48+.20*max(0,t-.45),-.20));curl=1.1
    elif gesture in ('tool','fitting'):target=chest+Vector((-.06,-.35,-.19));other=True;curl=1.0
    elif gesture=='ration':target=head+Vector((-.035,-.11,-.02));curl=.95
    elif gesture=='signal':target=chest+Vector((-.38,-.12,.35));curl=.15
    elif gesture in ('throw','throwKnife','bolas'):
        wind=_smooth_key([(0,0),(.25,-1),(.58,1),(.75,1),(1,0)],t)
        target=chest+Vector((-.26,-.47*max(0,wind)+.22*max(0,-wind),.27-.25*max(0,wind)))
        curl=1.0 if t<.58 else .1
    elif gesture=='breach':
        wind=_smooth_key([(0,0),(.3,-1),(.58,1),(1,0)],t)
        key=-1 if wind<0 else 1
        target=chest+Vector((-.15,-.25-.25*max(0,key),.25*max(0,-key)-.20*max(0,key)));other=True;curl=1.2
    if chest.z-pelvis.z<.13 and gesture not in ('pickup','heal','free'):
        # Working hands reach above the floor when lying down. Standing
        # chest offsets otherwise send the palm and curled fingers below it.
        target.z=max(.18,target.z)
    origin=rig.pose.bones['hand_r'].matrix@rig.data.bones['hand_r'].matrix_local.inverted()@rig.data.bones['hand_r'].head_local.lerp(rig.data.bones['middle_01_r'].head_local,.72)
    if gesture in ('pickup','heal','free'):
        _reach(rig,side,origin.lerp(target,envelope),normal=Vector((0,0,-1)),curl=curl)
        if other:_reach(rig,'l',target+Vector((.20,.04,0)),curl=.65)
    else:
        weight=abs(wind) if gesture=='breach' else envelope
        _gesture_reach(rig,side,target,weight,curl,gesture=='offer')
        if other:
            origin=rig.pose.bones['hand_l'].matrix@rig.data.bones['hand_l'].matrix_local.inverted()@rig.data.bones['hand_l'].head_local.lerp(rig.data.bones['middle_01_l'].head_local,.72)
            _gesture_reach(rig,'l',target+Vector((.20,.04,0)),weight,.65)
    if gesture in ('pickup','heal','free'):
        from task_wrists import fit_working_wrists
        fit_working_wrists(ctx,gesture,t,bank.get('canCrouch',False))
    elif chest.z-pelvis.z<.13:
        from posture_support import clear_working_hands
        clear_working_hands(ctx)
    return _collect(rig)


def _semantic_specs():
    import subprocess
    root=Path(__file__).resolve().parents[4]
    script="import {ACTOR_CLIP_SPECS} from './game/actor-action-contract.js';console.log(JSON.stringify(ACTOR_CLIP_SPECS));"
    return json.loads(subprocess.check_output(['node','--input-type=module','-e',script],cwd=root,text=True))



def _reviewed_binding(spec):
    """The reviewed standing bank keeps the production semantic contract."""
    if spec['posture']!='standing':return None
    equipment=spec['equipment'];gesture=spec['gesture'];variant=spec.get('variant')
    if equipment=='unarmed':return {'idle':'Idle','walk':'Walk','run':'Run','punch':'Punch'}.get(gesture)
    if equipment in ('long-gun','short-gun'):
        prefix='Rifle' if equipment=='long-gun' else 'Pistol'
        if gesture in ('idle','aim','brace'):return prefix+'Aim'
        if gesture in ('walk','run','fire'):return prefix+gesture.title()
        if gesture=='butt':return 'RifleButtStrike' if equipment=='long-gun' else 'PistolStrike'
        if gesture=='bayonet':return 'BayonetThrust'
    if equipment in ('blade','knife'):
        prefix='Sabre' if equipment=='blade' else 'Knife'
        if gesture in ('idle','brace'):return prefix+'Ready'
        if gesture in ('walk','run'):return prefix+gesture.title()
        if gesture=='slash':
            suffix={'forehand':'Forehand','backhand':'Backhand','thrust':'Thrust','hilt':'HiltStrike'}.get(variant,'Slash')
            return prefix+suffix
    return None


def _reviewed_bank(ctx):
    import hashlib
    import reviewed_motion
    print('MOTION SOURCE approved standing bank',flush=True)
    bank=reviewed_motion.sample_animations(ctx)
    digest=hashlib.sha256(Path(reviewed_motion.__file__).read_bytes()).hexdigest()
    import firearm_grips
    ctx['reviewed_grip_sha256']=hashlib.sha256(Path(firearm_grips.__file__).read_bytes()).hexdigest()
    return {clip['name']:clip for clip in bank['clips']},digest


def _write_reviewed(ctx,spec,source,digest):
    """Use reviewed timing/poses, with precise production event sampling."""
    rig=ctx['rig'];duration=source['duration']
    markers={('contact' if key=='hit' else key):value for key,value in source['events'].items()}
    times=sorted(set([duration*i/(len(source['samples'])-1) for i in range(len(source['samples']))]+list(markers.values())))
    samples=[_at(source['samples'],time/duration) for time in times]
    for sample in samples:
        for name,(position,rotation) in sample.items():
            if name!='Root':sample[name]=(Vector(),rotation)
    meta=_write_clip(rig,spec['name'],samples,duration,spec['loop'],times=times)
    meta.update(spec)
    meta.update({'duration':duration,'events':markers,'markers':markers,
        'source':source.get('source',{'type':'native-contact-authoring'}),
        'sampleRate':30,'timingAuthority':'simulation','rootMotion':'in-place',
        'playbackRate':1.25,'reviewedPose':{'name':source['name'],
            'origin':'approved-granadero-preview','sourceSha256':digest}})
    if spec['equipment']=='long-gun':
        x,y,z=ctx['weapon_grips']['rifle_support']
        meta['reviewedPose']['nativeGrip']={'version':1,'anatomy':ctx['gender'],
            'sourceSha256':ctx['reviewed_grip_sha256'],
            'supportPosition':[x,z,-y],'space':'gltf-weapon-local'}
    if spec['name']=='stand.butt.short-gun':
        # Seat the curved stock against the closed palm during the blow.
        # These socket-local fits are measured from the exported native skin
        # and all three pistol stocks. The ready grip and arm tracks stay exact.
        seated=[-.001001,.000273,.003159] if ctx['gender']=='male' else [.000974,-.000795,.004600]
        meta['gripOffsets']=[{'hand':'handRight','keys':[
            {'time':0,'position':[0,0,0]},
            {'time':duration*.20,'position':seated},
            {'time':duration*.82,'position':seated},
            {'time':duration,'position':[0,0,0]}]}]
    if source.get('locomotionSpeed'):meta['locomotionSpeed']=source['locomotionSpeed']
    elif spec['gesture'] in ('walk','run'):
        # Armed loops retain the recorded lower-body path and stride.
        meta['locomotionSpeed']=ctx['reviewed_stride'][spec['gesture'].title()]
    # Retain the reviewed native regrip keys without changing the body writer.
    from rifle_guard_curves import apply_clip as apply_rifle_guard_curves
    apply_rifle_guard_curves(ctx,meta,FPS)
    return meta

def apply_animations(ctx, only=None):
    """Create every declared capability. Unknown gestures are build errors.

    `only` limits a developer review build; release builds omit it. No clip can
    issue a shot, apply damage, pay AP, change stance, or move a game actor.
    """
    rig=ctx['rig'];bpy.context.scene.render.fps=FPS
    ctx['native_sideways_samples']={}
    if rig.animation_data:rig.animation_data_clear()
    specs=_semantic_specs()
    if only is not None:
        specs=[s for s in specs if s['name'] in only]
        if not specs:raise ValueError('No semantic clips selected; pass None only for a complete release bank')
    loading_only=bool(only) and all(s['gesture'] in ('reload','reprime','repair','unload') for s in specs)
    mounting_only=bool(only) and all(s['gesture'] in ('mount','dismount') for s in specs)
    throwing_only=bool(only) and all(s['gesture'] in ('throw','throwKnife','bolas') for s in specs)
    climbing_only=bool(only) and all(s['gesture'] in ('climbUp','climbDown') for s in specs)
    riding_only=bool(only) and all(s['posture']=='mounted' for s in specs)
    lance_idle_only=bool(only) and all(s['posture']=='standing' and s['equipment']=='lance' and s['gesture']=='idle' for s in specs)
    contact_only=loading_only or mounting_only or throwing_only or climbing_only or lance_idle_only
    crouch_support_only=bool(only) and all(s['posture']=='crouched'and s['gesture']in('idle','walk')for s in specs)
    prone_support_only=bool(only) and all(s['posture']=='prone'and s['gesture']in('idle','crawl')for s in specs)
    sideways_support_only=bool(only) and all(s['posture']=='standing'and s['gesture']in('strafeLeft','strafeRight')for s in specs)
    crouched_sideways_only=bool(only) and all(s['posture']=='crouched'and s['equipment']=='unarmed'and s['gesture']in('strafeLeft','strafeRight')for s in specs)
    needs_reviewed=any(_reviewed_binding(spec)for spec in specs)
    reviewed,reviewed_digest=_reviewed_bank(ctx)if needs_reviewed else ({},None)
    ctx['reviewed_stride']={name:reviewed[name]['locomotionSpeed'] for name in ('Walk','Run') if name in reviewed}
    disabled=[]
    for obj in ctx['objects']:
        for modifier in obj.modifiers:
            if modifier.show_viewport:disabled.append(modifier);modifier.show_viewport=False
    offsets=_grip_setup(ctx);sources={};source_meta={}
    for recipe in (('idle','crouch','strafeLeftCrouched','strafeRightCrouched')if crouched_sideways_only else ('idle','crouch','strafeLeftStanding','strafeRightStanding')if sideways_support_only else ('idle','crouch','crawl')if prone_support_only else ('idle','crouch') if contact_only or crouch_support_only else ('idle','crouch','walk','run','fall','recover') if riding_only else SOURCE_RECIPES):
        print('MOTION SOURCE',recipe,flush=True)
        sources[recipe],source_meta[recipe]=_retarget_samples(ctx,recipe)
    idle=sources['idle'][0];crouch=sources['crouch'][0]
    _apply_sample(rig,crouch)
    _root_shift(rig,(0,0,.66-rig.pose.bones['pelvis'].head.z))
    for side,sign in [('l',1),('r',-1)]:
        _leg_ik(rig,side,(sign*.13,.015,.078),(sign*.14,-.42,.40))
        _aim(rig,'foot_'+side,(0,-.18,-.036));_aim(rig,'ball_'+side,(0,-.10,0))
    from posture_support import fit_boots
    fit_boots(ctx)
    crouch=_collect(rig)
    prone=_prone_pose(ctx,idle);mounted=_mounted_pose(ctx,idle)
    bases={'standing':idle,'crouched':crouch,'prone':prone,'mounted':mounted}
    result=[];crawl_stride=None
    for index,spec in enumerate(specs):
        binding=_reviewed_binding(spec)
        if binding:
            result.append(_write_reviewed(ctx,spec,reviewed[binding],reviewed_digest))
            continue
        gesture=spec['gesture'];posture=spec['posture'];equipment=spec['equipment'];base=bases[posture]
        duration=1.4;markers={};source={'type':'native-contact-authoring'};speed=None
        if gesture in ('idle','aim','brace','dead','unconscious'):duration=2
        if gesture in ('walk','run','crawl','strafeLeft','strafeRight'):
            recipe=gesture+posture.title() if gesture.startswith('strafe') else 'crawl' if posture=='prone' else 'crouch' if posture=='crouched' else gesture
            duration=source_meta[recipe]['duration'];speed=source_meta[recipe]['locomotionSpeed'];source=source_meta[recipe]['source']
        elif gesture=='idle' and posture=='standing':duration=source_meta['idle']['duration'];source=source_meta['idle']['source']
        elif gesture in ('climbUp','climbDown'):
            from climbing_motion import duration as climb_duration
            duration=climb_duration(ctx);source={'type':'native-ladder-contact-authoring'};markers={'support':duration*.12}
        elif gesture=='fire':duration=1.1 if equipment=='long-gun' else .8;markers={'shot':.3 if equipment=='long-gun' else .2}
        elif gesture in ('slash','thrust','punch','butt','bayonet'):duration=1.2;markers={'contact':.58,'recover':1.0}
        elif gesture in ('reload','reprime','repair','unload'):duration=4.8 if gesture=='reload' else 2.0;markers={'contact':duration*.45,'ready':duration*.92}
        elif gesture in ('throw','throwKnife','bolas'):duration=1.3;markers={'release':duration*.58}
        elif gesture=='breach':duration=1.4;markers={'contact':duration*.58}
        elif gesture in ('die','collapse','knockdown'):duration=source_meta['fall']['duration'];source=source_meta['fall']['source'];markers={'ground':duration*.68}
        elif gesture=='recover':duration=source_meta['recover']['duration'];source=source_meta['recover']['source'];markers={'standing':duration*.95}
        elif gesture=='artilleryFire':duration=1.6;markers={'shot':.8}
        elif gesture=='artilleryReload':duration=4;markers={'contact':1.8,'ready':3.7}
        elif gesture in ('mount','dismount'):duration=2.3;markers={'seat':duration*(.90 if gesture=='mount' else .10)}
        times=sorted(set([duration*i/max(2,round(duration*SAMPLE_FPS)) for i in range(max(2,round(duration*SAMPLE_FPS))+1)]+list(markers.values())))
        if gesture in ('transition','pickup','heal','free','crawl','die','collapse','knockdown','recover'):
            times=sorted(set(times+[duration*i/max(2,round(duration*FPS)) for i in range(max(2,round(duration*FPS))+1)]))
        if gesture in ('mount','dismount'):
            # Use the exported frame grid in both directions. Unequal old
            # seat-marker keys otherwise bend the reverse leg path differently.
            times=sorted(set([i/FPS for i in range(round(duration*FPS)+1)]+list(markers.values())))
        if gesture in ('climbUp','climbDown'):
            from climbing_motion import fractions as climb_fractions
            times=sorted(set(times+[duration*(1-phase if gesture=='climbDown'else phase)for phase in climb_fractions(ctx)]))
        if equipment=='long-gun' and gesture in ('reload','unload'):
            # Exact contact stages prevent a short unloading clip from
            # interpolating past its single muzzle contact between samples.
            stages=(.12,.24,.36,.46,.58,.70,.79,.86,.90) if gesture=='reload' else (.12,.25,.55,.78,.90)
            times=sorted(set(times+[duration*stage for stage in stages]))
        if equipment=='short-gun' and gesture=='reload':
            from pistol_loading import STAGES
            times=sorted(set(times+[duration*stage for stage in STAGES]))
        if gesture in ('throw','throwKnife','bolas'):
            from throwing_motion import PROFILES
            # Preserve hand orbit and planted support at authored phase keys,
            # including the exact item release in the 30 Hz exported track.
            stages=set(phase for phase,_ in PROFILES[gesture]['arm'])|{.09,.19,.24,.30,.38,.42,.43,.48,.52,.60,.63,.74,.77,.82,.88,.91}
            times=sorted(set(times+[duration*stage for stage in stages]))
        samples=[]
        for time in times:
            t=time/duration;pose=_copy_pose(base)
            if gesture in ('idle','walk','run','crawl','strafeLeft','strafeRight'):
                if gesture=='idle':
                    if posture=='standing':pose=_at(sources['idle'],t)
                    else:
                        _apply_sample(rig,base);pb=rig.pose.bones['spine_02'];pb.rotation_quaternion=pb.rotation_quaternion @ Quaternion(Vector((1,0,0)),math.sin(t*math.tau)*.005);pose=_collect(rig)
                elif posture=='prone':pose=_prone_pose(ctx,idle,_at(sources['crawl'],t),source_meta['crawl']['kneeCenter'],t)
                elif posture=='mounted':
                    recorded=_at(sources[gesture],t);pose=_mounted_pose(ctx,recorded)
                    # Rider pelvis stays at the saddle; horse supplies travel.
                else:
                    recipe=gesture+posture.title() if gesture.startswith('strafe') else 'crouch' if posture=='crouched' else gesture
                    sequence=ctx['native_sideways_samples'][recipe] if posture=='standing' and equipment in ('unarmed','long-gun','short-gun','blade','knife','lance') and gesture.startswith('strafe') else sources[recipe]
                    pose=_at(sequence,t)
                pose=_equipment_pose(ctx,pose,equipment,offsets,mode='strafe-carry' if posture=='standing' and equipment=='long-gun' and gesture.startswith('strafe') else 'carry',posture=posture)
            elif gesture=='brace' and equipment in ('blade','knife','lance'):
                pose=_lance_pose(ctx,base,offsets,'brace') if equipment=='lance' else _blade_pose(ctx,base,offsets,-.15,key='knife' if equipment=='knife' else 'sabre')
            elif gesture=='thrust':
                phase=_smooth_key([(0,0),(.25,-.25),(.483,1),(.70,.35),(1,0)],t);pose=_lance_pose(ctx,base,offsets,'thrust',phase)
            elif gesture in ('aim','fire','brace'):
                recoil=0
                if gesture=='fire':recoil=_smooth_key([(0,0),(markers['shot'],0),(markers['shot']+.045,.042 if equipment=='long-gun' else .07),(markers['shot']+.22,.004),(duration,0)],time)
                pose=_gun_pose(ctx,base,'rifle' if equipment=='long-gun' else 'pistol',offsets,'aim',recoil,posture)[0]
            elif gesture in ('reload','reprime','repair','unload'):
                if equipment=='long-gun' and gesture in ('reload','unload'):
                    from rifle_loading import pose as rifle_loading_pose
                    pose=rifle_loading_pose(ctx,base,offsets,t,gesture,spec.get('item'),posture)
                elif equipment=='short-gun' and gesture=='reload':
                    from pistol_loading import pose as pistol_loading_pose
                    pose=pistol_loading_pose(ctx,base,offsets,t,spec.get('item'),posture,spec.get('barrel',0))
                else:pose=_reload_pose(ctx,base,'rifle' if equipment=='long-gun' else 'pistol',offsets,t,gesture)
            elif gesture=='slash':
                phase=_smooth_key([(0,0),(.23,-.65),(.483,1),(.65,.8),(1,0)],t);pose=_blade_pose(ctx,base,offsets,phase,key='knife' if equipment=='knife' else 'sabre')
            elif gesture in ('punch','butt','bayonet'):
                phase=_smooth_key([(0,0),(.25,-.3),(.483,1),(.7,.2),(1,0)],t)
                if equipment in ('long-gun','short-gun'):
                    pose,grip,q=_gun_pose(ctx,base,'rifle' if equipment=='long-gun' else 'pistol',offsets,'aim',posture=posture)
                    # Keep both palms fitted while extending the shoulder line.
                    _apply_sample(rig,pose);pb=rig.pose.bones['spine_03'];_set_world_rotation(rig,'spine_03',Quaternion(UP,-phase*.38) @ pb.matrix.to_quaternion());pose=_collect(rig)
                else:
                    _apply_sample(rig,base);chest=rig.pose.bones['spine_03'].head.copy()
                    target=chest+Vector((-.16,-.28-.29*phase,-.04))
                    if posture=='crouched' and gesture=='punch':
                        # Keep the wind-up outside the ribs and use the
                        # approved closed fist, with the same impact reach.
                        target.x-=.09*(1-max(0,phase))
                        _gesture_reach(rig,'r',target,1,1.4)
                        from reviewed_motion import _finger_curl as closed_fist
                        closed_fist(rig,1.4,'r',closed=True)
                    else:_reach(rig,'r',target,curl=1.4)
                    pose=_collect(rig)
            elif gesture=='transition':
                from posture_support import transition
                pose=transition(ctx,bases,spec['fromPosture'],spec['toPosture'],t)
            elif gesture in ('climbUp','climbDown'):
                from climbing_motion import pose as climbing_pose
                pose=climbing_pose(ctx,idle,t,reverse=gesture=='climbDown')
            elif gesture in ('mount','dismount'):
                from mounted_motion import mount_pose
                pose=mount_pose(ctx,idle,mounted,t,reverse=gesture=='dismount')
            elif gesture in ('throw','throwKnife','bolas'):
                from throwing_motion import pose as throwing_pose
                pose=throwing_pose(ctx,base,gesture,t,posture)
            elif posture=='mounted' and gesture in ('die','collapse','knockdown','dead','unconscious','recover'):
                from mounted_motion import lifecycle_pose
                pose=lifecycle_pose(ctx,bases,sources,gesture,t)
            elif gesture in ('die','collapse','knockdown'):
                target=_at(sources['fall'],t)
                if posture=='prone':
                    from posture_support import prone_fall
                    pose=prone_fall(ctx,prone,t)
                else:
                    pose=target if posture=='standing' else _blend(base,target,min(1,t*3))
                    from posture_support import relaxed_ground_arms,phase
                    pose=relaxed_ground_arms(ctx,pose,phase(t,.60,1))
            elif gesture in ('dead','unconscious'):
                if posture=='prone':
                    from posture_support import prone_rest
                    pose=prone_rest(ctx,prone)
                else:pose=_copy_pose(sources['fall'][-1])
                from posture_support import relaxed_ground_arms
                pose=relaxed_ground_arms(ctx,pose,face_down=posture=='prone')
                if gesture=='unconscious':
                    _apply_sample(rig,pose);pb=rig.pose.bones['spine_02'];pb.rotation_quaternion=pb.rotation_quaternion @ Quaternion(Vector((1,0,0)),math.sin(t*math.tau)*.005);pose=_collect(rig)
            elif gesture=='recover':
                from posture_support import ground_recovery,relaxed_ground_arms
                fallen=relaxed_ground_arms(ctx,sources['fall'][-1])
                pose=ground_recovery(ctx,fallen,sources['recover'],t,bases,face_down=posture=='prone')
                if posture=='crouched':
                    pose=_blend(pose,crouch,max(0,(t-.65)/.35))
                    _apply_sample(rig,pose)
                    from posture_support import fit_boots
                    fit_boots(ctx);pose=_collect(rig)
                elif posture=='mounted':pose=_blend(pose,mounted,max(0,(t-.65)/.35))
            elif gesture=='hit':
                _apply_sample(rig,base);pb=rig.pose.bones['spine_01'];_set_world_rotation(rig,'spine_01',Quaternion(Vector((1,0,0)),-math.sin(math.pi*t)*.12) @ pb.matrix.to_quaternion());pose=_collect(rig)
            elif gesture.startswith('artillery'):
                pose=_gesture_pose(ctx,base,'tool' if gesture!='artilleryFire' else 'door',.5 if gesture=='artilleryMove' else t,{'canCrouch':False})
                if gesture=='artilleryMove':
                    lower=_at(sources['walk'],t)
                    for n in pose:
                        if n.startswith(('thigh','calf','foot','ball')) or n=='Root':pose[n]=lower[n]
            elif gesture in ('heal','pickup','equip','offer','grab','door','tool','breach','free','ration','signal','fitting'):
                pose=_gesture_pose(ctx,base,gesture,t,{'canCrouch':posture=='standing','crouched':crouch,'prone':prone})
            else:raise ValueError('Unimplemented semantic gesture: '+gesture)
            # Enforce native joint lengths: only Root has position tracks.
            for name,(p,q) in pose.items():
                if name!='Root':pose[name]=(Vector(),q)
            samples.append(pose)
        supported=(gesture in ('transition','pickup','heal','free','walk','run','crawl','strafeLeft','strafeRight') and posture!='mounted') or (posture=='prone' and gesture=='idle' and equipment=='unarmed')
        native_sideways=(ctx,speed) if (posture=='standing' and equipment in ('unarmed','long-gun','short-gun','blade','knife','lance') or posture=='crouched' and equipment=='unarmed') and gesture in ('strafeLeft','strafeRight') else None
        meta=_write_clip(rig,spec['name'],samples,duration,spec['loop'],times=times,support=ctx if supported and native_sideways is None else None,native_sideways=native_sideways,native_lance_idle=ctx if posture=='standing' and equipment=='lance' and gesture=='idle' else None,native_prone_idle=ctx if posture=='prone' and gesture=='idle' else None,native_crouch_idle=ctx if posture=='crouched' and gesture=='idle' else None)
        meta.update(spec);meta.update({'duration':round(duration,6),'events':markers,'markers':markers,'source':source,'sampleRate':SAMPLE_FPS,'timingAuthority':'simulation','rootMotion':'in-place'})
        if gesture=='reload' and equipment=='long-gun':meta['propCues']=[{'item':'ramrod','socket':'socket_handLeft_tool','start':round(duration*.46,6),'end':round(duration*.86,6),'rotation':[0,0,math.pi/2]}]
        if equipment=='long-gun' and gesture in ('reload','unload'):
            from rifle_loading import metadata as rifle_loading_metadata
            meta.update(rifle_loading_metadata(ctx,spec.get('item'),duration,gesture,spec['posture']))
        if equipment=='short-gun' and gesture=='reload':
            from pistol_loading import metadata as pistol_loading_metadata
            meta.update(pistol_loading_metadata(ctx,spec.get('item'),duration,spec.get('barrel',0)))
        if gesture in ('climbUp','climbDown'):
            from climbing_motion import metadata as climbing_metadata
            meta.update(climbing_metadata(ctx,duration,reverse=gesture=='climbDown'))
            meta['events']=meta['markers']
        if gesture in ('mount','dismount'):
            from mounted_motion import metadata as mounted_motion_metadata
            meta.update(mounted_motion_metadata(ctx,duration,reverse=gesture=='dismount'))
        if gesture in ('throw','throwKnife','bolas'):
            meta['freeHands']=['handRight','handLeft']
            meta['handProps']=[{'hand':'handRight','categories':['knife'] if gesture=='throwKnife' else ['supply'],'untilMarker':'release'}]
        if speed is not None:meta['locomotionSpeed']=speed
        if gesture=='crawl' and not(equipment=='unarmed' and 'nativeArmSupport'in meta):
            if crawl_stride is None:
                # The unarmed capability precedes its equipped variants.
                # Measure the body pull, not a hand fixed to a carried gun.
                if equipment!='unarmed':
                    base_samples=[_prone_pose(ctx,idle,s,source_meta['crawl']['kneeCenter'],i/(len(sources['crawl'])-1)) for i,s in enumerate(sources['crawl'])]
                    # Close a review-only sequence without adding an action.
                    first,last=base_samples[0],base_samples[-1]
                    for i,sample in enumerate(base_samples):
                        t=i/(len(base_samples)-1)
                        for bone,(p,q) in list(sample.items()):
                            sample[bone]=(p-(last[bone][0]-first[bone][0])*t,q @ Quaternion().slerp(last[bone][1].inverted() @ first[bone][1],t))
                    base_samples[-1]=_copy_pose(base_samples[0])
                    crawl_stride=_crawl_stride(rig,base_samples,duration)
                else:crawl_stride=_crawl_stride(rig,samples,duration)
            meta.update(crawl_stride);source_meta['crawl']['locomotionSpeed']=crawl_stride['locomotionSpeed']
        if equipment=='lance' and gesture=='brace':
            from lance_grips import metadata as lance_metadata
            meta.update(lance_metadata(duration))
        if equipment=='lance' and gesture=='thrust':
            from lance_grips import thrust_metadata
            meta.update(thrust_metadata(ctx['gender'],duration))
        if gesture.startswith('strafe'):meta['locomotionAxis']='left' if gesture=='strafeLeft' else 'right'
        if posture=='mounted' and gesture not in ('mount','dismount'):meta['seatAnchor']=list(rig.data.bones['pelvis'].head_local)
        if posture=='mounted' or gesture=='mount':
            from riding_motion import metadata as riding_metadata
            meta['ridingSupport']=riding_metadata(ctx)
        if posture=='mounted' and gesture in ('die','collapse','knockdown','dead','unconscious','recover'):
            from mounted_motion import lifecycle_metadata
            meta.update(lifecycle_metadata(ctx,duration,gesture))
        result.append(meta)
        if index%10==0:print('MOTION CLIP',index+1,'/',len(specs),spec['name'],flush=True)
    for modifier in disabled:modifier.show_viewport=True
    _reset(rig)
    return {'clips':result,'locomotionSpeed':{k:v['locomotionSpeed'] for k,v in source_meta.items()},'fps':FPS,'contractVersion':1}
