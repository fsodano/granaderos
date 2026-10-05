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


def _write_clip(rig, name, samples, duration, loop=True, grounding=None):
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
    for i,sample in enumerate(samples):
        frame=1+duration*FPS*i/(len(samples)-1)
        for pb in rig.pose.bones:
            p,q=sample[pb.name]
            pb.location=p;pb.rotation_quaternion=q
            pb.keyframe_insert(data_path='location',frame=frame,group=pb.name)
            pb.keyframe_insert(data_path='rotation_quaternion',frame=frame,group=pb.name)
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
    track.mute=True
    return {'name':name,'duration':round(duration,6),'loop':loop,'events':{}}


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
    long,normal=_palm_basis(rig,'r')
    # Grip lies inside the curled fingers, below the knuckle row. Native
    # MakeHuman finger positions define it; no hand mesh is moved or scaled.
    knuckles=sum((rig.data.bones[f+'_01_r'].head_local for f in ('index','middle','ring','pinky')),Vector())/4
    center=bone.head_local.lerp(knuckles,.74)+normal*.014
    local_center=bone.matrix_local.inverted() @ center
    offsets={}
    for key,group in ctx.get('weapons',{}).items():
        long_in_weapon=Vector((1,0,.05)) if key=='rifle' else Vector((1,0,-.10)) if key=='pistol' else Vector((1,0,0))
        hand_in_weapon=_hand_rotation(rig,'r',long_in_weapon,Vector((0,1,0)))
        bind=Matrix.LocRotScale(local_center,hand_in_weapon.inverted(),Vector((1,1,1)))
        group.parent=rig;group.parent_type='BONE';group.parent_bone='hand_r'
        group.matrix_parent_inverse=Matrix.Translation((0,-bone.length,0))
        group.matrix_basis=bind
        offsets[key]=(local_center.copy(),hand_in_weapon.copy())
    ctx.setdefault('weapon_grips',{})['rifle_support']=(.22,0,.030)
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
    actual_wrist=_arm_ik(rig,'r',wrist,Vector((-.41,-.12,1.22 if key=='rifle' else 1.10)))
    _set_world_rotation(rig,'hand_r',hand_q)
    _finger_curl(rig,1.33,'r')
    if key in ('rifle','pistol'):
        _trigger_finger(rig,ctx['weapons'][key],key)
    # If a requested grip lies outside reach, report the actual arm solution.
    actual_grip=actual_wrist+hand_q @ local_grip
    if key=='rifle':
        target=actual_grip+gun_q @ Vector(ctx.get('weapon_grips',{}).get('rifle_support',(.22,0,.030)))
        left_long=gun_q @ Vector((.65,-.76,.08))
        left_normal=gun_q @ Vector((0,0,1))
        left_q=_hand_rotation(rig,'l',left_long,left_normal)
        left_bone=rig.data.bones['hand_l']
        knuckles=sum((rig.data.bones[f+'_01_l'].head_local for f in ('index','middle','ring','pinky')),Vector())/4
        long,normal=_palm_basis(rig,'l')
        palm=left_bone.head_local.lerp(knuckles,.75)+normal*.016
        local_palm=left_bone.matrix_local.inverted() @ palm
        left_wrist=target-left_q @ local_palm
        _arm_ik(rig,'l',left_wrist,Vector((.24,-.25,1.03)))
        _set_world_rotation(rig,'hand_l',left_q)
        _finger_curl(rig,1.18,'l')
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


def apply_animations(ctx):
    """Create all nine runtime actions and return export/stride metadata."""
    rig=ctx['rig'];bpy.context.scene.render.fps=FPS
    rig.animation_data_clear()
    for name in ['Idle','Walk','Run','RifleAim','RifleFire','SabreReady','SabreSlash','PistolAim','PistolFire']:
        if bpy.data.actions.get(name):bpy.data.actions.remove(bpy.data.actions[name])
    clips=[]
    for spec in [('Idle','111_28.bvh',120,360),('Walk','07_01.bvh',100,230),('Run','02_03.bvh',40,131)]:
        meta,base=_retarget_clip(ctx,*spec);clips.append(meta)
        if spec[0]=='Idle':idle_base=base
    offsets=_grip_setup(ctx)
    if len(offsets)!=3:raise ValueError('create_equipment(ctx) must supply rifle, pistol, sabre groups before apply_animations')
    for key,aim,fire,duration,event in [('rifle','RifleAim','RifleFire',1.1,.30),('pistol','PistolAim','PistolFire',.8,.20),('sabre','SabreReady','SabreSlash',1.2,.50)]:
        duration=round(duration*FPS)/FPS
        def pose(t,action=False):
            if key=='rifle':
                recoil=_smooth_key([(0,0),(.30,0),(.333,.042),(.47,.008),(.75,0),(1.1,0)],t) if action else 0
                pos=Vector((-.104,-.335+recoil,1.405))
                q=Quaternion(UP,math.radians(-75)) @ Quaternion(Vector((0,1,0)),-recoil*.9)
            elif key=='pistol':
                recoil=_smooth_key([(0,0),(.20,0),(.233,.075),(.40,.02),(.65,0),(.8,0)],t) if action else 0
                pos=Vector((-.13,-.56+recoil,1.30))
                q=Quaternion(UP,math.radians(-85)) @ Quaternion(Vector((0,1,0)),-recoil*2.3)
            else:
                phase=_smooth_key([(0,0),(.20,-.30),(.48,.9),(.62,1),(.90,.3),(1.2,0)],t) if action else 0
                pos=Vector((-.25+.34*max(0,phase),-.26-.21*abs(phase),1.10+.28*max(0,-phase)-.12*max(0,phase)))
                q=Quaternion(UP,math.radians(-90)+phase*1.75) @ Quaternion(Vector((0,1,0)),math.radians(12)+abs(phase)*1.95)
            return _weapon_pose(ctx,idle_base,key,pos,q,offsets,recoil if key in ('rifle','pistol') else 0)
        aim_samples=[pose(i/15,False) for i in range(31)]
        # Gentle breathing is inherited from the recorded idle stance; small
        # measured pelvis movement is intentionally omitted while aiming.
        for i,sample in enumerate(aim_samples):
            breathing=.003*math.sin(math.tau*i/(len(aim_samples)-1))
            p,q=sample['spine_02'];sample['spine_02']=(p,Quaternion(Vector((1,0,0)),breathing) @ q)
        clips.append(_write_clip(rig,aim,aim_samples,2.0))
        count=round(duration*FPS)
        samples=[pose(duration*i/count,True) for i in range(count+1)]
        samples[0]=aim_samples[0];samples[-1]=aim_samples[0]
        meta=_write_clip(rig,fire,samples,duration,False)
        meta['events']={'hit' if key=='sabre' else 'shot':event};clips.append(meta)
    _apply_sample(rig,idle_base)
    rig.animation_data.action=None
    return {'clips':clips,'locomotionSpeed':{m['name']:m['locomotionSpeed'] for m in clips if m['name'] in ('Walk','Run')},'source':'CMU motion capture retargeted onto native MakeHuman skeleton; weapon actions authored for held props','fps':FPS}


def _trigger_finger(rig,weapon,key):
    """Fit the index pad to the trigger inside the actual modeled guard."""
    bpy.context.view_layer.update()
    transform=weapon.matrix_world
    gun_q=transform.to_quaternion()
    target=transform @ Vector((.019,-.006,-.020) if key=='rifle' else (.050,-.008,-.013))
    names=['index_01_r','index_02_r','index_03_r']
    first=rig.pose.bones[names[0]].head.copy()
    _aim(rig,names[0],target-first+gun_q @ Vector((.035,0,0)))
    base=rig.pose.bones[names[1]].head.copy()
    l1=rig.data.bones[names[1]].length;l2=rig.data.bones[names[2]].length
    d=target-base;distance=min(d.length,l1+l2-.0001);d.normalize()
    pole=gun_q @ Vector((0,-1,0));pole-=d*pole.dot(d);pole.normalize()
    along=(l1*l1-l2*l2+distance*distance)/(2*distance)
    joint=base+d*along+pole*math.sqrt(max(0,l1*l1-along*along))
    _aim(rig,names[1],joint-base)
    _aim(rig,names[2],target-joint)
