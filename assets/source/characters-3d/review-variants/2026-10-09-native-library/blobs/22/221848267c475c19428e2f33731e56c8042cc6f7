"""Support unarmed prone palms and forearms with native joint rotations."""
import bisect,math
from mathutils import Vector,Quaternion
ARMS=tuple(name+'_'+side for side in ('l','r')for name in ('upperarm','lowerarm','hand'))
FLOOR=.002
RECOVERY_LIFT=.04

def _bindings(ctx):
    cached=ctx.get('native_prone_arm_surfaces')
    if cached:return cached
    rig=ctx['rig'];result={side:{'full':[],'hand':[],'arm':[]}for side in ('l','r')};inverse={name:bone.matrix_local.inverted()for name,bone in rig.data.bones.items()}
    for obj in ctx['objects']:
        if not obj.name.startswith(('Exposed_Human_Skin','Tailored_Coat','Crimson_Cuff_','Cuff_Gold_Edge_')):continue
        groups={group.index:group.name for group in obj.vertex_groups}
        for vertex in obj.data.vertices:
            assignments=[(groups[group.group],group.weight)for group in vertex.groups if group.weight>.000001]
            for side in ('l','r'):
                weight=lambda prefixes:sum(w for name,w in assignments if name.endswith('_'+side)and name.startswith(prefixes))
                if weight(('upperarm_','lowerarm_','hand_','thumb_','index_','middle_','ring_','pinky_'))<.7:continue
                point=[(name,w,inverse[name]@vertex.co)for name,w in assignments]
                result[side]['full'].append(point)
                if weight(('hand_','thumb_','index_','middle_','ring_','pinky_'))>.7:result[side]['hand'].append(point)
                if weight(('upperarm_','lowerarm_'))>.7:result[side]['arm'].append(point)
    assert all(len(s['hand'])>500 and len(s['arm'])>500 for s in result.values()),'Complete native palm, finger and sleeve surfaces are required'
    ctx['native_prone_arm_surfaces']=result
    return result

def _surface(rig,bindings):
    matrices={name:bone.matrix.copy()for name,bone in rig.pose.bones.items()}
    points=[sum((matrices[name]@point*weight for name,weight,point in weights),Vector())for weights in bindings]
    index=min(range(len(points)),key=lambda i:points[i].z)
    return index,points[index]

def _lowest(rig,bindings):return _surface(rig,bindings)[1].z

def _fit_native_arm(rig,side,target,elbow_height=None):
    from motion import _head,_set_world_rotation
    names=('upperarm_'+side,'lowerarm_'+side,'hand_'+side);bones=[rig.data.bones[name]for name in names]
    base=_head(rig,names[0]);elbow=_head(rig,names[1]);offsets=[bones[i+1].head_local-bones[i].head_local for i in (0,1)];a,b=(offset.length for offset in offsets)
    direction=Vector(target)-base;distance=min(a+b-.0005,max(abs(a-b)+.0005,direction.length));direction.normalize()
    bend=elbow-base;bend-=direction*bend.dot(direction)
    if bend.length<.001:bend=Vector((1 if side=='l'else -1,0,-1));bend-=direction*bend.dot(direction)
    bend.normalize();along=(a*a-b*b+distance*distance)/(2*distance);height=math.sqrt(max(0,a*a-along*along));center=base+direction*along
    if elbow_height is not None:
        up=Vector((0,0,1))-direction*direction.z
        if up.length>1e-6 and height>1e-6:
            up.normalize();around=bend-up*bend.dot(up)
            if around.length<.001:around=direction.cross(up)
            around.normalize();amount=max(-.99,min(.99,(elbow_height-center.z)/(height*up.z)));bend=up*amount+around*math.sqrt(max(0,1-amount*amount))
    middle=center+bend*height
    for i,end in ((0,middle),(1,base+direction*distance)):
        start=_head(rig,names[i]);rotation=offsets[i].rotation_difference(end-start)@bones[i].matrix_local.to_quaternion();_set_world_rotation(rig,names[i],rotation)
    assert (rig.pose.bones[names[2]].head-Vector(target)).length<.0002,'Native arm target is beyond anatomical reach'

def fit_arm_support(ctx,sample,lifts=None):
    from motion import _apply_sample,_collect,_set_world_rotation
    rig=ctx['rig'];_apply_sample(rig,sample);surfaces=_bindings(ctx);report={}
    for side in ('l','r'):
        points=surfaces[side];goal=FLOOR+(lifts or{}).get(side,0)
        before=_lowest(rig,points['full']);hand=rig.pose.bones['hand_'+side];rotation=hand.matrix.to_quaternion();original_wrist=hand.head.copy();target=original_wrist.copy();target.z+=goal+.0005-_lowest(rig,points['hand'])
        def fit_wrist(wrist):
            _fit_native_arm(rig,side,wrist);_set_world_rotation(rig,'hand_'+side,rotation)
            for iteration in range(8):
                current=_lowest(rig,points['arm']);difference=goal+.0005-current
                if abs(difference)<.0002:break
                elbow=rig.pose.bones['lowerarm_'+side].head.z
                _fit_native_arm(rig,side,wrist,elbow+.001);_set_world_rotation(rig,'hand_'+side,rotation)
                derivative=(_lowest(rig,points['arm'])-current)/.001
                assert derivative>.02,'Forearm support must remain reachable along its native elbow arc'
                step=max(-.025,min(.025,difference/derivative))
                _fit_native_arm(rig,side,wrist,elbow+step);_set_world_rotation(rig,'hand_'+side,rotation)
            return _lowest(rig,points['arm'])
        reach_change=0;recorded_target=target.copy();minimum=fit_wrist(target)
        if minimum>goal+.003:
            base=rig.pose.bones['upperarm_'+side].head
            rearward=Vector((base.x-target.x,base.y-target.y,0)).normalized()
            low,high=0,.08
            assert fit_wrist(recorded_target+rearward*high)<=goal+.003,'The native forearm requires an excessive reach correction'
            # Find the closest supported reach continuously, without centimetre
            # steps between animation keys. Native segment lengths stay fixed.
            for iteration in range(9):
                middle=(low+high)/2
                if fit_wrist(recorded_target+rearward*middle)<=goal+.003:high=middle
                else:low=middle
            reach_change=high;target=recorded_target+rearward*high;fit_wrist(target)
        forearm_index,forearm_point=_surface(rig,points['arm']);after=_lowest(rig,points['full']);report[side]={'before':before,'after':after,'lift':goal-FLOOR,'wristShift':target.z-original_wrist.z,'reachCorrection':reach_change,'forearmIndex':forearm_index,'forearmPoint':list(forearm_point),'forearmFloor':forearm_point.z,'palmFloor':_lowest(rig,points['hand']),'elbow':list(rig.pose.bones['lowerarm_'+side].head)}
        assert after>=goal-.001,'The native arm must reach its supported skin/cuff surface: '+side+' '+str(report[side])
    fitted=_collect(rig)
    for name in ARMS:fitted[name]=(sample[name][0].copy(),fitted[name][1])
    for name,(position,rotation)in sample.items():
        if name not in ARMS:assert position==fitted[name][0]and rotation==fitted[name][1],name+' changed during arm support'
    return fitted,report

def _sample(samples,times,time):
    index=max(0,min(len(times)-2,bisect.bisect_right(times,time)-1));f=(time-times[index])/(times[index+1]-times[index]);a,b=samples[index:index+2];result={}
    for name,(p,q)in a.items():
        end=b[name][1].copy()
        if q.dot(end)<0:end.negate()
        rotation=Quaternion(tuple((1-f)*q[i]+f*end[i]for i in range(4)));rotation.normalize();result[name]=(p.lerp(b[name][0],f),rotation)
    return result

def _crawl_arm(ctx,side,phase,shoulder_forward=None):
    """One native forearm pulls while the other clears and returns."""
    from motion import _head,_set_world_rotation,_hand_rotation,FORWARD
    rig=ctx['rig'];surfaces=_bindings(ctx)[side];base=_head(rig,'upperarm_'+side);sign=1 if side=='l'else -1
    names=('upperarm_'+side,'lowerarm_'+side,'hand_'+side);bones=[rig.data.bones[name]for name in names];offsets=[bones[i+1].head_local-bones[i].head_local for i in (0,1)];a,b=(offset.length for offset in offsets)
    extent=.14;u=(phase*2)%1;pull=phase>=.5
    # Recovery meets the planted pull with its rearward velocity. The palm
    # does not stop relative to a body that still moves forward.
    offset=extent*(u-.5)if pull else extent*(.5+u-6*u*u+4*u*u*u)
    lift=0 if pull else RECOVERY_LIFT*math.sin(math.pi*u)**2;goal=FLOOR+.0005+lift
    rotation=_hand_rotation(rig,side,FORWARD,Vector((0,0,-1)))
    _set_world_rotation(rig,'hand_'+side,rotation);wrist_z=rig.pose.bones['hand_'+side].head.z+goal-_lowest(rig,surfaces['hand'])
    # The torso can assist the crawl. Plant the pull in the body's root frame
    # instead of adding that torso sway to the already measured hand stride.
    elbow_y=(base.y if shoulder_forward is None else shoulder_forward)+offset;wrist_x=sign*.21
    reach_forward=elbow_y-base.y
    def set_arm(elbow_z):
        across=math.sqrt(max(0,a*a-reach_forward*reach_forward-(elbow_z-base.z)**2));elbow=Vector((base.x+sign*across,elbow_y,elbow_z))
        forward=math.sqrt(max(0,b*b-(wrist_x-elbow.x)**2-(wrist_z-elbow.z)**2));wrist=Vector((wrist_x,elbow.y-forward,wrist_z))
        assert forward>.08,'The native forearm must remain forward and reachable'
        for i,end in ((0,elbow),(1,wrist)):
            start=_head(rig,names[i]);q=offsets[i].rotation_difference(end-start)@bones[i].matrix_local.to_quaternion();_set_world_rotation(rig,names[i],q)
        _set_world_rotation(rig,names[2],rotation)
        assert (rig.pose.bones[names[1]].head-elbow).length<.0002 and(rig.pose.bones[names[2]].head-wrist).length<.0002,'Native segment lengths must stay exact'
        return _lowest(rig,surfaces['arm'])
    low=base.z-math.sqrt(a*a-reach_forward*reach_forward-.015*.015);high=low+.08
    before=_lowest(rig,surfaces['full'])
    assert set_arm(low)<goal and set_arm(high)>goal,'A native planted forearm surface must bracket its floor'
    for iteration in range(12):
        middle=(low+high)/2
        if set_arm(middle)<goal:low=middle
        else:high=middle
    set_arm(high);arm_index,arm_point=_surface(rig,surfaces['arm']);after=_lowest(rig,surfaces['full'])
    assert after>=FLOOR+lift-.001,'The complete palm and sleeve must clear their support'
    return {'before':before,'after':after,'lift':lift,'reachCorrection':0,'forearmFloor':arm_point.z,'forearmIndex':arm_index,'forearmPoint':list(arm_point),'palmFloor':_lowest(rig,surfaces['hand']),'elbow':list(rig.pose.bones[names[1]].head),'pull':pull}

def support_clip(ctx,samples,duration,times,crawl=False):
    from motion import _apply_sample
    original=list(samples);rig=ctx['rig'];stored_duration=duration
    _apply_sample(rig,original[0]);shoulder_forward={side:rig.pose.bones['upperarm_'+side].head.y for side in ('l','r')}
    fitted=[];maximum=0;reports=[]
    for i,(time,sample)in enumerate(zip(times,original)):
        if crawl:
            from motion import _collect
            _apply_sample(rig,sample);phase=min(time,stored_duration)/stored_duration
            report={side:_crawl_arm(ctx,side,(phase+offset)%1,shoulder_forward[side])for side,offset in(('l',0),('r',.5))};result=_collect(rig)
            for name in ARMS:result[name]=(sample[name][0].copy(),result[name][1])
            for name,(position,rotation)in sample.items():
                if name not in ARMS:assert position==result[name][0]and rotation==result[name][1],name+' changed during native forearm crawl'
        else:result,report=fit_arm_support(ctx,sample)
        fitted.append(result);reports.append(report);maximum=max(maximum,max(arm['lift']for arm in report.values()))
    for index,time in enumerate(times):
        if time>=stored_duration-.000001:
            for name in ARMS:fitted[index][name]=(fitted[index][name][0],fitted[0][name][1].copy())
    ctx['native_prone_arm_final_samples']=(fitted,times,reports)
    metadata={'method':'native-arm-rotations','surface':'complete-native-palm-finger-and-sleeve','floor':FLOOR,'sampleRate':30,'recoveryLift':RECOVERY_LIFT if crawl else 0,'alternatingRecovery':crawl,'pullDistance':.14 if crawl else 0,'maximumRecoveryLift':round(maximum,6),'maximumReachCorrection':round(max(arm['reachCorrection']for report in reports for arm in report.values()),6),'nativeCycleDuration':round(stored_duration,6)}
    if crawl:
        stored_times=[i/30 for i in range(math.floor(stored_duration*30)+1)]
        if stored_duration-stored_times[-1]>1e-7:stored_times.append(stored_duration)
        stored_samples=[_sample(fitted,times,time)for time in stored_times];contacts=[]
        for pose in stored_samples:
            _apply_sample(rig,pose);surfaces=_bindings(ctx);contact={}
            for side in ('l','r'):
                index,point=_surface(rig,surfaces[side]['arm']);contact[side]={'forearmFloor':point.z,'forearmIndex':index}
            contacts.append(contact)
        for i in range(1,len(stored_times)-1):
            for side in ('l','r'):
                current=contacts[i][side]
                points=[];weights=_bindings(ctx)[side]['arm'][current['forearmIndex']]
                for pose in (stored_samples[i-1],stored_samples[i+1]):
                    _apply_sample(rig,pose)
                    points.append(sum((rig.pose.bones[name].matrix@point*weight for name,weight,point in weights),Vector()))
                velocity=(points[1].y-points[0].y)/(stored_times[i+1]-stored_times[i-1]);current['contactVelocity']=velocity
        pulls=[]
        for side,begin,end in (('r',0,.5),('l',.5,1)):
            _apply_sample(rig,_sample(fitted,times,stored_duration*(begin+end)/2));index,point=_surface(rig,_bindings(ctx)[side]['arm']);weights=_bindings(ctx)[side]['arm'][index];points=[]
            for phase in (begin,end):
                _apply_sample(rig,_sample(fitted,times,stored_duration*phase));points.append(sum((rig.pose.bones[name].matrix@point*weight for name,weight,point in weights),Vector()))
            distance=points[1].y-points[0].y
            assert distance>.1,'A planted native forearm must carry a complete body pull'
            pulls.append({'hand':side,'from':begin,'to':end,'distance':round(distance,6),'duration':round(stored_duration*(end-begin),6)})
        speed=round(sum(pull['distance']for pull in pulls)/stored_duration,6)
        metadata['stride']={'locomotionSpeed':speed,'nativeStrideSpeed':speed,'authoredStrideSpeed':speed,'strideDistance':round(speed*stored_duration,6),'strideMeasurement':{'method':'native forearm planted pull displacement','bones':['lowerarm_l','lowerarm_r'],'surface':'complete-native-sleeve-and-forearm','sampleRate':30,'maximumContactHeight':FLOOR+.005,'pulls':pulls}}
    if crawl:ctx['native_prone_arm_contact_samples']=(stored_times,contacts)
    return fitted,metadata
