"""Native-length limb support for posture changes and low movement.

The rigid boot is longer than the source skeleton's articulated toe. Contact
uses the authored sole/upper, not a point attached to the ball joint. Only the
leg bends to meet that surface; the recorded pelvis travel is retained.
"""
import math
from mathutils import Vector


def ease(value):
    value=max(0.,min(1.,value))
    return value*value*(3.-2.*value)


def phase(t,start,end):
    return ease((t-start)/(end-start))


def _boot_points(ctx):
    if '_support_boots' not in ctx:
        rig=ctx['rig'];points={side:[] for side in ('l','r')}
        for side in points:
            inverse=rig.data.bones['foot_'+side].matrix_local.inverted()
            for obj in ctx['objects']:
                if obj.name.startswith(('Rounded_Boot_Foot_'+side,'Boot_Sole_'+side)):
                    points[side].extend(inverse @ (obj.matrix_world @ vertex.co) for vertex in obj.data.vertices)
            if not points[side]:
                # Cloth probes can run after optimization has joined shoes
                # and boot shafts. Select the rigid foot-weighted surface.
                for obj in ctx['objects']:
                    if 'footwear' not in obj.name or obj.type!='MESH':continue
                    group=obj.vertex_groups.get('foot_'+side)
                    if group:
                        points[side].extend(inverse @ (obj.matrix_world @ vertex.co) for vertex in obj.data.vertices
                            if any(g.group==group.index and g.weight>.999 for g in vertex.groups))
            if not points[side]:raise ValueError('Missing actual boot contact surface: '+side)
        ctx['_support_boots']=points
    return ctx['_support_boots']


def _body_contact_floor(ctx):
    """Measure the native head, fitted trunk and seat, excluding coat tails."""
    rig=ctx['rig']
    if '_support_body' not in ctx:
        points=[]
        for obj in ctx['objects']:
            if obj.type!='MESH':continue
            leg=obj.name.startswith('Tailored_Breeches') or 'legwear' in obj.name
            coat=obj.name.startswith('Tailored_Coat') or 'outfit' in obj.name
            skin=obj.name.startswith('Exposed_Human_Skin') or 'skin' in obj.name.lower()
            if not (leg or coat or skin):continue
            groups={g.index:g.name for g in obj.vertex_groups}
            for vertex in obj.data.vertices:
                weights={groups[g.group]:g.weight for g in vertex.groups if groups[g.group] in rig.data.bones}
                point=obj.matrix_world@vertex.co
                selected=(leg and weights.get('pelvis',0)>.4) or (coat and point.z>rig.data.bones['pelvis'].head_local.z+.025 and sum(w for n,w in weights.items() if n.startswith('spine_'))>.7) or (skin and weights.get('head',0)>.7)
                if selected:points.append([(name,rig.data.bones[name].matrix_local.inverted()@point,weight) for name,weight in weights.items()])
        if not points:raise ValueError('Missing native torso contact surface')
        ctx['_support_body']=points
    return min(sum(((rig.pose.bones[name].matrix@point)*weight for name,point,weight in vertex),Vector()).z for vertex in ctx['_support_body'])


def fit_body(ctx):
    from motion import _root_shift
    floor=_body_contact_floor(ctx)
    if floor<.006:_root_shift(ctx['rig'],(0,0,.006-floor))


def fit_boots(ctx,clearance=.006):
    """Keep each rigid boot above the floor without moving the body root."""
    from motion import _head,_leg_ik,_set_world_rotation
    rig=ctx['rig']
    for side,points in _boot_points(ctx).items():
        foot=rig.pose.bones['foot_'+side]
        rotation=foot.matrix.to_quaternion().copy()
        ball=rig.pose.bones['ball_'+side].matrix.to_quaternion().copy()
        knee=_head(rig,'calf_'+side).copy()
        # Preserve the native knee bend plane while shortening an extended
        # leg. Repeating resolves the small reach clamp at full extension.
        for _ in range(3):
            floor=min((foot.matrix @ point).z for point in points)
            if floor>=clearance-1e-5:break
            target=_head(rig,'foot_'+side).copy();target.z+=clearance-floor
            _leg_ik(rig,side,target,knee)
            _set_world_rotation(rig,'foot_'+side,rotation)
            _set_world_rotation(rig,'ball_'+side,ball)
        # The fitted shaft has native blended calf/foot weights. Its actual
        # deformed surface can reach the floor before a joint or sole does.
        if '_support_shafts' not in ctx:
            shafts={s:[] for s in ('l','r')}
            for obj in ctx['objects']:
                if obj.type!='MESH' or not (obj.name.startswith('Fitted_Boot_') or 'footwear' in obj.name):continue
                groups={g.index:g.name for g in obj.vertex_groups}
                for vertex in obj.data.vertices:
                    weights={groups[g.group]:g.weight for g in vertex.groups if groups[g.group] in rig.data.bones}
                    for s in shafts:
                        if weights.get('calf_'+s,0)>.05:
                            point=obj.matrix_world@vertex.co
                            shafts[s].append([(name,rig.data.bones[name].matrix_local.inverted()@point,weight) for name,weight in weights.items()])
            ctx['_support_shafts']=shafts
        for _ in range(4):
            points=ctx['_support_shafts'][side]
            if not points:break
            floor=min(sum(((rig.pose.bones[name].matrix@point)*weight for name,point,weight in vertex),Vector()).z for vertex in points)
            if floor>=clearance-.0001:break
            from motion import _aim
            hip=_head(rig,'thigh_'+side);ankle=_head(rig,'foot_'+side);knee=_head(rig,'calf_'+side)
            joint,ankle=_joint(hip,ankle,knee,rig.data.bones['thigh_'+side].length,
                rig.data.bones['calf_'+side].length,knee.z+clearance-floor,outward=1 if side=='l' else -1)
            _aim(rig,'thigh_'+side,joint-hip);_aim(rig,'calf_'+side,ankle-joint)
            _set_world_rotation(rig,'foot_'+side,rotation);_set_world_rotation(rig,'ball_'+side,ball)


def plant_boot(ctx,side):
    """Pivot a recovery boot on its actual sole while the other limbs move."""
    from motion import _head,_aim,_set_world_rotation
    rig=ctx['rig'];foot=rig.pose.bones['foot_'+side]
    rotation=foot.matrix.to_quaternion().copy();ball=rig.pose.bones['ball_'+side].matrix.to_quaternion().copy()
    for _ in range(3):
        floor=min((foot.matrix @ point).z for point in _boot_points(ctx)[side])
        if abs(floor-.006)<.0001:break
        ankle=_head(rig,'foot_'+side).copy();ankle.z+=.006-floor
        hip=_head(rig,'thigh_'+side);pole=_head(rig,'calf_'+side)
        knee,ankle=_joint(hip,ankle,pole,rig.data.bones['thigh_'+side].length,rig.data.bones['calf_'+side].length,.075,outward=1 if side=='l' else -1)
        _aim(rig,'thigh_'+side,knee-hip);_aim(rig,'calf_'+side,ankle-knee)
        _set_world_rotation(rig,'foot_'+side,rotation);_set_world_rotation(rig,'ball_'+side,ball)


def support_crouch_step(ctx):
    """Retain sole support after the recorded crouch cycle is closed.

    Loop closure can lift both boots slightly at a weight-transfer crossover.
    Plant the lower boot; blend the other only near that shared contact, so
    the support changes sides smoothly without flattening the swinging arc.
    """
    from motion import _apply_sample,_blend,_collect
    rig=ctx['rig']
    heights={side:min((rig.pose.bones['foot_'+side].matrix @ point).z for point in points)
             for side,points in _boot_points(ctx).items()}
    contact=phase(min(heights.values()),.006,.008)
    for side in ('l','r'):
        other='r' if side=='l' else 'l'
        weight=contact*(1-phase(heights[side]-heights[other],0,.035))
        if weight<=1e-6:continue
        before=_collect(rig)
        plant_boot(ctx,side)
        _apply_sample(rig,_blend(before,_collect(rig),weight))


def crouch_contact_samples(ctx,samples,times,duration):
    """Keep the contact transfer between the recorded 15 Hz keys grounded."""
    from bisect import bisect_right
    from motion import _apply_sample,_blend,_collect
    times=times or [duration*i/(len(samples)-1) for i in range(len(samples))]
    count=max(2,math.ceil(duration*60))
    dense=sorted(set(times+[duration*i/count for i in range(count+1)]))
    result=[]
    for time in dense:
        index=min(len(times)-2,max(0,bisect_right(times,time)-1))
        fraction=(time-times[index])/(times[index+1]-times[index])
        _apply_sample(ctx['rig'],_blend(samples[index],samples[index+1],fraction))
        fit_boots(ctx)
        support_crouch_step(ctx)
        result.append(_collect(ctx['rig']))
    return result,dense


def _joint(start,target,pole,upper,lower,minimum,outward=None):
    """Nearest pole-guided two-bone solution with an elbow/knee floor."""
    direction=target-start
    distance=max(.001,min(direction.length,upper+lower-.002))
    direction.normalize();target=start+direction*distance
    along=(upper*upper-lower*lower+distance*distance)/(2*distance)
    radius=math.sqrt(max(0.,upper*upper-along*along))
    center=start+direction*along
    radial=pole-start;radial-=direction*radial.dot(direction)
    if radial.length<1e-6:radial=direction.cross(Vector((0,1,0)))
    radial.normalize()
    if center.z+radial.z*radius<minimum and radius>1e-6:
        up=Vector((0,0,1));up-=direction*up.dot(direction)
        magnitude=up.length
        if magnitude>1e-6:
            up.normalize();side=direction.cross(up).normalized()
            lift=max(-1.,min(1.,(minimum-center.z)/(radius*magnitude)))
            lateral=math.sqrt(max(0.,1-lift*lift))
            guide=(Vector((outward,0,0)) if isinstance(outward,(int,float)) else Vector(outward)) if outward is not None else radial
            if guide.dot(side)<0:lateral=-lateral
            radial=up*lift+side*lateral
    return center+radial*radius,target


def flat_support_fingers(rig,side):
    """Spread the thumb in the palm plane instead of retaining a gun grip."""
    from motion import _palm_basis,_aim
    hand=rig.pose.bones['hand_'+side]
    delta=hand.matrix.to_3x3() @ hand.bone.matrix_local.to_3x3().inverted()
    long,normal=_palm_basis(rig,side)
    across=(rig.data.bones['index_01_'+side].head_local-rig.data.bones['pinky_01_'+side].head_local).normalized()
    direction=delta @ (long*.75+across*.66).normalized()
    for number in (1,2,3):_aim(rig,f'thumb_{number:02d}_{side}',direction)


def support_hand(ctx,side,palm,pole,rotation,curl=.18,minimum=.057,outward=None,stable_roll=False):
    from motion import _head,_aim,_set_world_rotation,_finger_curl
    rig=ctx['rig'];hand=rig.data.bones['hand_'+side]
    local=hand.matrix_local.inverted() @ hand.head_local.lerp(rig.data.bones['middle_01_'+side].head_local,.72)
    shoulder=_head(rig,'upperarm_'+side)
    elbow,wrist=_joint(shoulder,Vector(palm)-rotation @ local,Vector(pole),
        rig.data.bones['upperarm_'+side].length,rig.data.bones['lowerarm_'+side].length,minimum,outward=outward)
    if stable_roll:
        for name,direction in [('upperarm_'+side,elbow-shoulder),('lowerarm_'+side,wrist-elbow)]:
            reference=stable_roll[name]
            axis=reference @ Vector((0,1,0))
            _set_world_rotation(rig,name,axis.rotation_difference(direction.normalized()) @ reference)
    else:
        _aim(rig,'upperarm_'+side,elbow-shoulder)
        _aim(rig,'lowerarm_'+side,wrist-elbow)
    _set_world_rotation(rig,'hand_'+side,rotation)
    from motion import _palm_basis
    normal=_palm_basis(rig,side)[1]
    world_normal=rotation @ (hand.matrix_local.to_3x3().inverted() @ normal)
    flat=(1-phase(Vector(palm).z,.12,.18))*phase(-world_normal.z,.35,.75)
    _finger_curl(rig,curl*(1-flat)+.025*flat,side)
    if flat:
        names=[f'thumb_{number:02d}_{side}' for number in (1,2,3)]
        before={name:rig.pose.bones[name].rotation_quaternion.copy() for name in names}
        flat_support_fingers(rig,side)
        if flat<1:
            import bpy
            for name in names:rig.pose.bones[name].rotation_quaternion=before[name].slerp(rig.pose.bones[name].rotation_quaternion,flat)
            bpy.context.view_layer.update()


def clear_working_hands(ctx,clearance=.008):
    """Keep the actual working palm/fingers above the floor during a reach."""
    from motion import _head,_set_world_rotation
    rig=ctx['rig']
    if '_working_hand_points' not in ctx:
        result={side:[] for side in ('l','r')}
        for obj in ctx['objects']:
            if obj.type!='MESH':continue
            groups={group.index:group.name for group in obj.vertex_groups}
            for vertex in obj.data.vertices:
                weights={groups[g.group]:g.weight for g in vertex.groups if groups[g.group] in rig.data.bones}
                for side in result:
                    if sum(value for name,value in weights.items()if name.endswith('_'+side)and name.startswith(('hand_','thumb_','index_','middle_','ring_','pinky_')))>.8:
                        point=obj.matrix_world@vertex.co
                        result[side].append([(name,rig.data.bones[name].matrix_local.inverted()@point,value)for name,value in weights.items()])
        ctx['_working_hand_points']=result
    for side,points in ctx['_working_hand_points'].items():
        for _ in range(4):
            low=min(sum(((rig.pose.bones[name].matrix@point)*weight for name,point,weight in vertex),Vector()).z for vertex in points)
            if low>=clearance-.0001:break
            shoulder=_head(rig,'upperarm_'+side);elbow=_head(rig,'lowerarm_'+side);wrist=_head(rig,'hand_'+side)
            target=wrist+Vector((0,0,clearance-low))
            references={name:rig.pose.bones[name].matrix.to_quaternion().copy()for name in ('upperarm_'+side,'lowerarm_'+side,'hand_'+side)}
            elbow,target=_joint(shoulder,target,elbow,rig.data.bones['upperarm_'+side].length,rig.data.bones['lowerarm_'+side].length,.065)
            for name,direction in [('upperarm_'+side,elbow-shoulder),('lowerarm_'+side,target-elbow)]:
                reference=references[name];axis=reference@Vector((0,1,0))
                _set_world_rotation(rig,name,axis.rotation_difference(direction.normalized())@reference)
            _set_world_rotation(rig,'hand_'+side,references['hand_'+side])


def _limbs(rig):
    return {side:{'ankle':rig.pose.bones['foot_'+side].head.copy(),
                  'foot':rig.pose.bones['foot_'+side].matrix.to_quaternion().copy(),
                  'ball':rig.pose.bones['ball_'+side].matrix.to_quaternion().copy(),
                  'palm':rig.pose.bones['hand_'+side].head.lerp(rig.pose.bones['middle_01_'+side].head,.72),
                  'hand':rig.pose.bones['hand_'+side].matrix.to_quaternion().copy(),
                  'elbow':rig.pose.bones['lowerarm_'+side].head.copy(),
                  'knee':rig.pose.bones['calf_'+side].head.copy()} for side in ('l','r')}


def transition(ctx,bases,origin,destination,t):
    """Crouch, put palms down, then extend the legs; reverse to rise."""
    from motion import _apply_sample,_blend,_collect,_leg_ik,_set_world_rotation,_head,_aim,_root_shift,_smooth_key
    rig=ctx['rig']
    if 'prone' not in (origin,destination):
        _apply_sample(rig,bases[origin]);start=_limbs(rig)
        _apply_sample(rig,_blend(bases[origin],bases[destination],ease(t)))
        for side in ('l','r'):
            _leg_ik(rig,side,start[side]['ankle'],_head(rig,'thigh_'+side)+Vector((0,-.5,-.2)))
            _set_world_rotation(rig,'foot_'+side,start[side]['foot'])
            _set_world_rotation(rig,'ball_'+side,start[side]['ball'])
        fit_boots(ctx);return _collect(rig)
    upright=destination if origin=='prone' else origin
    down=1-t if origin=='prone' else t
    # Both directions share precisely the same supported path.
    crouch_phase=.27 if upright=='standing' else 0.
    if down<crouch_phase:
        return transition(ctx,bases,'standing','crouched',down/crouch_phase)
    u=(down-crouch_phase)/(1-crouch_phase)
    kneel=transition(ctx,bases,'standing','crouched',1) if upright=='standing' else bases['crouched']
    _apply_sample(rig,kneel);start=_limbs(rig)
    _apply_sample(rig,bases['prone']);end=_limbs(rig);prone_height=rig.pose.bones['pelvis'].head.z
    _apply_sample(rig,_blend(kneel,bases['prone'],phase(u,.06,.80)))
    # Keep the hips above the supporting knees while each foot steps back.
    # Lower the pelvis after that extension, instead of forcing a short leg
    # chain sideways around the floor-contact constraint.
    height=_smooth_key([(0,.66),(.25,.57),(.55,.50),(.72,.43),(1,prone_height)],u)
    _root_shift(rig,(0,0,height-rig.pose.bones['pelvis'].head.z))
    for side,sign in (('l',1),('r',-1)):
        leg=phase(u,.08 if side=='r' else .18,.78 if side=='r' else .88)
        ankle=start[side]['ankle'].lerp(end[side]['ankle'],leg)
        ankle.z+=.045*math.sin(math.pi*leg)
        hip=_head(rig,'thigh_'+side)
        pitch=phase(u,.05,.85)*math.pi/2
        guide=hip+Vector((sign*.20,-math.cos(pitch),-math.sin(pitch)))
        guide=start[side]['knee'].lerp(guide,phase(u,0,.20))
        guide=guide.lerp(end[side]['knee'],phase(u,.85,1))
        knee,ankle=_joint(hip,ankle,guide,rig.data.bones['thigh_'+side].length,rig.data.bones['calf_'+side].length,.075,outward=sign)
        _aim(rig,'thigh_'+side,knee-hip);_aim(rig,'calf_'+side,ankle-knee)
        _set_world_rotation(rig,'foot_'+side,start[side]['foot'].slerp(end[side]['foot'],leg))
        _set_world_rotation(rig,'ball_'+side,start[side]['ball'].slerp(end[side]['ball'],leg))
        hand=phase(u,0,.67)
        palm=start[side]['palm'].lerp(end[side]['palm'],hand)
        # The supporting elbow stays outside the torso and clear of the floor.
        pole=start[side]['elbow'].lerp(end[side]['elbow'],hand)
        pole.x+=sign*.055*math.sin(math.pi*hand)
        rotation=start[side]['hand'].slerp(end[side]['hand'],hand)
        support_hand(ctx,side,palm,pole,rotation,.55*(1-hand)+.25*hand,minimum=.062)
    fit_boots(ctx)
    return _collect(rig)


def ground_reach(ctx,standing,crouched,amount,prone):
    """Step into a low kneel, with the free palm resting on the lead knee."""
    from motion import _apply_sample,_blend,_collect,_head,_aim,_root_shift,_set_world_rotation,_hand_rotation,_leg_ik
    rig=ctx['rig'];_apply_sample(rig,standing);start=_limbs(rig)
    _apply_sample(rig,prone);rear_rotation=rig.pose.bones['foot_r'].matrix.to_quaternion().copy()
    _apply_sample(rig,_blend(crouched,prone,.82))
    _root_shift(rig,(0,0,.35-rig.pose.bones['pelvis'].head.z))
    for side,sign in (('l',1),('r',-1)):
        hip=_head(rig,'thigh_'+side)
        ankle=Vector((sign*.15,-.30 if side=='l' else .10,.10 if side=='l' else .11))
        pole=hip+Vector((sign*.05,-.55,.10 if side=='l' else -.50))
        knee,ankle=_joint(hip,ankle,pole,rig.data.bones['thigh_'+side].length,rig.data.bones['calf_'+side].length,.075,outward=sign)
        _aim(rig,'thigh_'+side,knee-hip);_aim(rig,'calf_'+side,ankle-knee)
        _set_world_rotation(rig,'foot_'+side,start[side]['foot'] if side=='l' else rear_rotation)
        _set_world_rotation(rig,'ball_'+side,start[side]['ball'])
    fit_boots(ctx)
    for side,sign in (('l',1),('r',-1)):
        palm=rig.pose.bones['calf_l'].head+Vector((.025,-.045,-.10)) if side=='l' else Vector((-.12,-.43,.050))
        support_hand(ctx,side,palm,_head(rig,'upperarm_'+side)+Vector((sign*.25,.04,-.30)),_hand_rotation(rig,side,(0,-1,0),(0,0,-1)),.18)
    target=_collect(rig);end=_limbs(rig)
    _apply_sample(rig,_blend(standing,target,amount))
    for side in ('l','r'):
        ankle=start[side]['ankle'].lerp(end[side]['ankle'],amount)
        ankle.z+=.035*math.sin(math.pi*amount)
        knee=start[side]['knee'].lerp(end[side]['knee'],amount)
        _leg_ik(rig,side,ankle,knee)
        _set_world_rotation(rig,'foot_'+side,start[side]['foot'].slerp(end[side]['foot'],amount))
        _set_world_rotation(rig,'ball_'+side,start[side]['ball'].slerp(end[side]['ball'],amount))
    fit_boots(ctx)
    return _collect(rig)


def prone_leg(ctx,side,sign,pelvis,advance):
    """Mostly extended prone leg, with one low knee draw during crawling."""
    from motion import _head,_aim
    rig=ctx['rig'];upper=rig.data.bones['thigh_'+side];lower=rig.data.bones['calf_'+side]
    length=upper.length+lower.length
    ankle=Vector((pelvis.x+sign*(.155+advance*.18),pelvis.y+length*.975-advance,.110))
    hip=_head(rig,upper.name)
    pole=hip+Vector((sign*.055,.36,-.45))
    knee,ankle=_joint(hip,ankle,pole,upper.length,lower.length,.075,outward=sign)
    _aim(rig,upper.name,knee-hip);_aim(rig,lower.name,ankle-knee)
    _aim(rig,'foot_'+side,(sign*advance*.20,.15,-.035))
    _aim(rig,'ball_'+side,(sign*advance*.15,.12,0))


def crawl_assistance(ctx,t):
    """Opposite leg draws assist each forearm pull without lifting the belly."""
    from motion import _root_shift,_set_world_rotation
    from mathutils import Quaternion
    rig=ctx['rig'];cycle=t*math.tau
    # Transfer a little weight onto the pulling side. The captured forearms
    # provide the principal travel; the legs take turns helping that pull.
    sway=math.sin(cycle)*.012
    _root_shift(rig,(sway,math.sin(cycle*2)*.006,.004*(1-math.cos(cycle*2))))
    for name,amount in [('pelvis',.024),('spine_01',.019),('spine_02',.012),('spine_03',.008)]:
        bone=rig.pose.bones[name]
        _set_world_rotation(rig,name,Quaternion(Vector((0,-1,0)),math.sin(cycle)*amount) @ bone.matrix.to_quaternion())
    def draw(offset,amplitude):
        u=(t+offset)%1.
        return amplitude*math.sin(math.pi*u/.53)**2 if u<.53 else 0.
    return {'l':draw(.5,.115),'r':draw(0,.125)}


def relaxed_ground_arms(ctx,pose,amount=1.,face_down=False):
    """Let the elbows and backs/palms of the hands settle on the floor."""
    from motion import _apply_sample,_collect,_blend,_aim,_head,_set_world_rotation,_hand_rotation,_finger_curl
    rig=ctx['rig'];_apply_sample(rig,pose)
    fit_body(ctx);pose=_collect(rig)
    chest=rig.pose.bones['spine_03'].head;pelvis=rig.pose.bones['pelvis'].head
    down=pelvis-chest;down.z=0;down.normalize()
    across=rig.pose.bones['upperarm_l'].head-rig.pose.bones['upperarm_r'].head
    across.z=0;across.normalize()
    for side,sign in [('l',1),('r',-1)]:
        shoulder=_head(rig,'upperarm_'+side)
        upper=rig.data.bones['upperarm_'+side].length;lower=rig.data.bones['lowerarm_'+side].length
        elbow_z=max(.065 if face_down else .060,shoulder.z-upper*.92)
        elbow_drop=elbow_z-shoulder.z
        reach=math.sqrt(max(.001,upper*upper-elbow_drop*elbow_drop))
        direction=(across*sign*(.82 if side=='r' else .72)+down*(.57 if side=='r' else .69)).normalized()
        elbow=shoulder+direction*reach;elbow.z=elbow_z
        wrist_z=.062 if face_down else .041
        reach=math.sqrt(max(.001,lower*lower-(wrist_z-elbow.z)**2))
        # The two arms rest at different angles, rather than a symmetric
        # rigid cross. Neither forearm is held upright after the body stops.
        direction=(down*(.90 if side=='l' else -.24)+across*sign*(.43 if side=='l' else .97)).normalized()
        wrist=elbow+direction*reach;wrist.z=wrist_z
        _aim(rig,'upperarm_'+side,elbow-shoulder)
        _aim(rig,'lowerarm_'+side,wrist-elbow)
        up=_hand_rotation(rig,side,direction,(0,0,1))
        down_q=_hand_rotation(rig,side,direction,(0,0,-1))
        _set_world_rotation(rig,'hand_'+side,up.slerp(down_q,float(face_down)))
        _finger_curl(rig,.025 if face_down else .28,side)
        if face_down:flat_support_fingers(rig,side)
    target=_collect(rig)
    _apply_sample(rig,_blend(pose,target,amount))
    fit_boots(ctx)
    return _collect(rig)


def ground_recovery(ctx,fallen,recovery,t,bases,face_down=False):
    """Gather into a supported low kneel, then stand without a limb snap."""
    from motion import _apply_sample,_collect,_blend,_at,_root_shift,_hand_rotation
    rig=ctx['rig'];join=.60
    if face_down:
        rest=prone_rest(ctx,bases['prone'])
        target=transition(ctx,{**bases,'prone':rest},'prone','standing',t)
        return _blend(rest,target,phase(t,0,.06))
    elif t<join:
        _apply_sample(rig,fallen);start=_limbs(rig)
        arm_reference={n:rig.pose.bones[n].matrix.to_quaternion().copy() for n in ('upperarm_l','upperarm_r','lowerarm_l','lowerarm_r')}
        target=ground_reach(ctx,bases['standing'],bases['crouched'],1,bases['prone'])
        _apply_sample(rig,target);end=_limbs(rig)
        blend=ease(t/join)
        # Carry the arm's roll frame into the kneel as well as its position.
        # A fixed fallen frame crosses an antipodal direction during the rise
        # and otherwise changes abruptly to the kneeling frame at the join.
        arm_reference={name:rotation.slerp(rig.pose.bones[name].matrix.to_quaternion(),blend)
                       for name,rotation in arm_reference.items()}
        pose=_blend(fallen,target,blend)
        _apply_sample(rig,pose)
        fit_body(ctx)
        from motion import _head,_aim,_set_world_rotation
        for side,sign in [('l',1),('r',-1)]:
            leg=phase(t/join,.04 if side=='l' else .17,.77 if side=='l' else 1.)
            ankle=start[side]['ankle'].lerp(end[side]['ankle'],leg)
            ankle.z+=.07*math.sin(math.pi*leg)
            hip=_head(rig,'thigh_'+side)
            guide=start[side]['knee'].lerp(hip+Vector((sign*.35,-.45,.15)),phase(t/join,.01,.20))
            guide=guide.lerp(end[side]['knee'],phase(t/join,.84,1))
            knee,ankle=_joint(hip,ankle,guide,rig.data.bones['thigh_'+side].length,rig.data.bones['calf_'+side].length,.075,outward=sign)
            _aim(rig,'thigh_'+side,knee-hip);_aim(rig,'calf_'+side,ankle-knee)
            _set_world_rotation(rig,'foot_'+side,start[side]['foot'].slerp(end[side]['foot'],leg))
            _set_world_rotation(rig,'ball_'+side,start[side]['ball'].slerp(end[side]['ball'],leg))
            plant_boot(ctx,side)
    else:
        return ground_reach(ctx,bases['standing'],bases['crouched'],1-phase(t,join,1),bases['prone'])
    for side,sign in [('l',1),('r',-1)]:
        brace=Vector((sign*.24,rig.pose.bones['pelvis'].head.y+.10,.050))
        palm=start[side]['palm'].lerp(brace,phase(t/join,.02,.28))
        palm=palm.lerp(end[side]['palm'],phase(t/join,.60,1))
        high_pole=rig.pose.bones['upperarm_'+side].head+Vector((.35,-.05,.35) if side=='l' else (-.15,-.35,.35))
        pole=start[side]['elbow'].lerp(high_pole,phase(t/join,0,.16))
        pole=pole.lerp(end[side]['elbow'],phase(t/join,.30,1))
        # Turn the resting hand onto its palm before the legs gather. Lift
        # it only during the turn, then use the floor until the low kneel.
        turn=phase(t/join,.02,.26)
        floor_rotation=_hand_rotation(rig,side,(0,-1,0),(0,0,-1))
        relative=floor_rotation @ start[side]['hand'].inverted()
        if abs(relative.w)<.0001:
            # Palm-up to palm-down is a half-turn. Float noise must not choose
            # opposite interpolation arcs on adjacent samples of that turn.
            from mathutils import Quaternion
            axis=Vector((relative.x,relative.y,relative.z)).normalized()
            preferred=start[side]['hand'] @ Vector((0,1 if side=='l' else -1,0))
            if axis.dot(preferred)<0:relative.negate();axis.negate()
            angle=2*math.atan2(Vector((relative.x,relative.y,relative.z)).length,relative.w)
            rotation=Quaternion(axis,angle*turn) @ start[side]['hand']
        else:rotation=start[side]['hand'].slerp(floor_rotation,turn)
        rotation=rotation.slerp(end[side]['hand'],phase(t/join,.60,1))
        palm.z+=.060*math.sin(math.pi*turn)
        support_hand(ctx,side,palm,pole,rotation,.28-.10*turn,.060+.030*phase(t/join,0,.28)+.035*math.sin(math.pi*turn),stable_roll=arm_reference)
    fit_boots(ctx)
    return _collect(rig)


def prone_rest(ctx,prone):
    """Keep the extended prone legs and let the head and arms rest."""
    from motion import _apply_sample,_set_world_rotation,_collect
    from mathutils import Quaternion
    rig=ctx['rig'];_apply_sample(rig,prone)
    for name,angle in [('neck_01',.85),('head',1.35)]:
        _set_world_rotation(rig,name,Quaternion(Vector((1,0,0)),angle) @ rig.data.bones[name].matrix_local.to_quaternion())
    return relaxed_ground_arms(ctx,_collect(rig),face_down=True)


def prone_fall(ctx,prone,t):
    """Lower the face and let the forearms slide out into a supported rest."""
    from motion import _apply_sample,_collect,_blend
    rig=ctx['rig'];_apply_sample(rig,prone);start=_limbs(rig)
    rest=prone_rest(ctx,prone);_apply_sample(rig,rest);end=_limbs(rig)
    amount=phase(t,.04,.80)
    _apply_sample(rig,_blend(prone,rest,amount))
    for side,sign in [('l',1),('r',-1)]:
        palm=start[side]['palm'].lerp(end[side]['palm'],amount)
        palm.z+=.025*math.sin(math.pi*amount)
        pole=start[side]['elbow'].lerp(end[side]['elbow'],amount)
        rotation=start[side]['hand'].slerp(end[side]['hand'],amount)
        minimum=.09
        support_hand(ctx,side,palm,pole,rotation,.25*(1-amount)+.18*amount,minimum,outward=sign)
    fit_boots(ctx)
    return _blend(_collect(rig),rest,phase(amount,.60,1))
