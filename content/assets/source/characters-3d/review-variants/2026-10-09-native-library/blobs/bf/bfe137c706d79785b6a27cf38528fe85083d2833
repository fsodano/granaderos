"""Keep the recorded crouched side-step pelvis and native leg dimensions.

Only the eight leg rotations change. A planted complete boot moves opposite
actor travel at the supplied recorded pace. Recovery joins the same velocity
with a smooth raised arc. A small forefoot roll allows the native leg to reach
without stretching a joint or raising the retained torso.
"""
import math,bisect
from mathutils import Vector,Quaternion
from sideways_support import LEGS,FLOOR,fit_leg

def sample_at(samples,times,time):
    i=max(0,min(len(times)-2,bisect.bisect_right(times,time)-1));f=(time-times[i])/(times[i+1]-times[i]);a,b=samples[i:i+2];out={}
    for name,(p,q)in a.items():
        end=b[name][1].copy()
        if q.dot(end)<0:end.negate()
        v=q.slerp(end,f);v.normalize();out[name]=(p.lerp(b[name][0],f),v)
    return out

def support_clip(ctx,samples,duration,times,name,speed):
    from motion import _apply_sample,_collect,_head,_set_world_rotation
    from grounding_motion import _boot_bindings,_boot_lowest,_sole_bindings
    rig=ctx['rig'];boots=_boot_bindings(ctx);soles=_sole_bindings(ctx);stored=float(duration)
    # Recreate the retained 30 Hz parent bake before fitting denser legs.
    # GLTF uses quaternion SLERP between those stored parent keys.
    old_samples,old_times=samples,times
    def old_sample(time):
        i=max(0,min(len(old_times)-2,bisect.bisect_right(old_times,time)-1));f=(time-old_times[i])/(old_times[i+1]-old_times[i]);a,b=old_samples[i:i+2];out={}
        for bone,(p,q)in a.items():
            end=b[bone][1].copy()
            if q.dot(end)<0:end.negate()
            v=Quaternion(tuple(q[j]*(1-f)+end[j]*f for j in range(4)));v.normalize();out[bone]=(p.lerp(b[bone][0],f),v)
        return out
    if not ctx.get('retained_parent_samples'):
        times=sorted(set([i/30 for i in range(math.floor(stored*30)+1)]+[stored]));samples=[old_sample(time)for time in times]
    assert speed>0,'A measured native lateral pace is required'
    direction=1 if'.strafeLeft.'in name else-1
    # The captured native lateral sequence contains two foot-to-foot steps.
    # Identify its support handovers from the complete published boot floor.
    raw=[]
    for i in range(121):
        _apply_sample(rig,sample_at(samples,times,stored*i/120));low={s:_boot_lowest(rig,boots[s])for s in('l','r')};raw.append((i/120,min(low,key=low.get),low))
    if direction==1:
        first=next(p for p,s,_ in raw if s=='l');switch=next(p for p,s,_ in raw if p>first+.1 and s=='r');second=next(p for p,s,_ in raw if p>switch+.1 and s=='l');end=next(p for p,s,_ in raw if p>second+.1 and s=='r');start=((first)+(second-.5))/2;stop=((switch)+(end-.5))/2;windows={'l':(start,stop),'r':(stop,start+.5)}
    else:
        first=next(p for p,s,_ in raw if s=='r');switch=next(p for p,s,_ in raw if p>first+.1 and s=='l');second=next(p for p,s,_ in raw if p>switch+.1 and s=='r');end=next(p for p,s,_ in raw if p>second+.1 and s=='l');start=(first+second-.5)/2;stop=(switch+end-.5)/2;windows={'r':(start,stop),'l':(stop,start+.5)}
    if name in ctx.get('retained_sideways_support',{}):windows=ctx['retained_sideways_support'][name]['supportWindows']
    profiles={}
    for side,(start,stop)in windows.items():
        midpoint=(start+stop)/2;_apply_sample(rig,sample_at(samples,times,(midpoint%.5)*stored));foot=rig.pose.bones['foot_'+side];q=foot.matrix.to_quaternion();native_up=rig.data.bones['foot_'+side].matrix_local.to_quaternion().inverted()@Vector((0,0,1));normal=q@native_up;q=normal.rotation_difference(Vector((0,0,1)))@q
        # Native torso height can require a supported forefoot roll. Find
        # its smallest angle over both planted intervals; never stretch legs.
        forward=q@(rig.data.bones['foot_'+side].matrix_local.to_quaternion().inverted()@Vector((0,-1,0)));forward.z=0;forward.normalize();axis=Vector((0,0,1)).cross(forward)
        projection=[(q@point).dot(forward)for point in soles[side]];front=max(projection);toe=sum((point for point,v in zip(soles[side],projection)if v>front-.001),Vector())/sum(v>front-.001 for v in projection)
        contact=foot.head+q@toe
        lift=max(.04,min(.10,max(low[side]for p,s,low in raw if s!=side)-min(low[side]for p,s,low in raw)))
        native_a=(rig.data.bones['calf_'+side].head_local-rig.data.bones['thigh_'+side].head_local).length;native_b=(rig.data.bones['foot_'+side].head_local-rig.data.bones['calf_'+side].head_local).length
        def reachable(angle):
            rotation=Quaternion(axis,angle)@q
            for phase,_,_ in raw:
                local=(phase-start)%.5
                stance=stop-start;recovery=.5-stance
                if local<=stance:offset=-direction*speed*stored*(local-stance/2);height=0
                else:
                    u=(local-stance)/recovery;begin=-direction*speed*stored*stance/2;end=-begin;slope=-direction*speed*stored*recovery
                    offset=(2*u**3-3*u*u+1)*begin+(u**3-2*u*u+u)*slope+(-2*u**3+3*u*u)*end+(u**3-u*u)*slope;height=lift*math.sin(math.pi*u)**2
                _apply_sample(rig,sample_at(samples,times,phase*stored))
                goal=Vector((contact.x+offset,contact.y,FLOOR+height))-rotation@toe
                if(goal-_head(rig,'thigh_'+side)).length>native_a+native_b-.001:
                    return False
            return True
        original_contact=contact.copy();contact_shift=Vector()
        if not reachable(.20):
            hips=[]
            for phase,_,_ in raw:
                _apply_sample(rig,sample_at(samples,times,phase*stored));hips.append(_head(rig,'thigh_'+side))
            center=sum(hips,Vector())/len(hips);toward=center-contact;toward.z=0;toward.normalize()
            for millimetres in range(1,81):
                contact=original_contact+toward*(millimetres/1000)
                if reachable(.20):break
            else:raise AssertionError('A crouched native support needs more than 8 cm of horizontal contact adjustment')
            contact_shift=contact-original_contact
        low,high=0,.20
        assert reachable(high),'The retained torso cannot reach a supported forefoot within a normal heel roll'
        for iteration in range(12):
            middle=(low+high)/2
            if reachable(middle):high=middle
            else:low=middle
        rotation=Quaternion(axis,high)@q
        lift=max(.04,min(.10,max(low[side]for p,s,low in raw if s!=side)-min(low[side]for p,s,low in raw)))
        profiles[side]={'start':start,'stop':stop,'q':rotation,'center':toe,'contact':contact,'lift':lift,'heelRoll':high,'pole':forward,'contactShift':list(contact_shift)}
    keys=sorted(set([time for time in times if time<=stored]+[i/60 for i in range(math.floor(stored*60)+1)]+[stored]));fitted=[];reports=[]
    for time in keys:
        sample=sample_at(samples,times,time);_apply_sample(rig,sample);phase=(min(time,stored)/stored)%1;report={}
        for side,p in profiles.items():
            start=p['start'];stop=p['stop'];period=.5;local=((phase-start)%period);stance=stop-start;recovery=period-stance
            if local<=stance:
                offset=-direction*speed*stored*(local-stance/2);lift=0;q=p['q'];planted=True
            else:
                u=(local-stance)/recovery;begin=-direction*speed*stored*stance/2;end=-begin;slope=-direction*speed*stored*recovery
                offset=(2*u**3-3*u*u+1)*begin+(u**3-2*u*u+u)*slope+(-2*u**3+3*u*u)*end+(u**3-u*u)*slope
                lift=p['lift']*math.sin(math.pi*u)**2;q=p['q'];planted=False
            contact=Vector((p['contact'].x+offset,p['contact'].y,FLOOR+lift));target=contact-q@p['center']
            for iteration in range(4):
                fit_leg(rig,side,target,p['pole']);_set_world_rotation(rig,'foot_'+side,q)
                difference=FLOOR+lift-_boot_lowest(rig,boots[side])
                if abs(difference)<.00005:break
                target.z+=difference
            reach=(rig.pose.bones['foot_'+side].head-target).length
            assert reach<.001,'Supported native leg target is beyond reach: '+str((side,phase,reach,tuple(target),tuple(_head(rig,'thigh_'+side))))
            lowest=_boot_lowest(rig,boots[side]);report[side]={'planted':planted,'lift':lift,'floor':lowest,'contact':list(contact),'reach':reach}
            assert lowest>=FLOOR-.001,'Complete boot penetration '+str((phase,side,lowest))
        pose=_collect(rig)
        for bone in LEGS:pose[bone]=(sample[bone][0].copy(),pose[bone][1])
        for bone in sample:
            if bone not in LEGS:assert pose[bone][0]==sample[bone][0]and pose[bone][1]==sample[bone][1],bone
        fitted.append(pose);reports.append(report)
    # Fit the original final stored sample in world space. Its retained
    # pelvis track can differ slightly from the first sample, so copying
    # local leg rotations would undo the planted support at the loop seam.
    ctx.setdefault('sideways_reports',{})[name]={'times':keys,'reports':reports,'windows':windows,'heelRoll':{side:profile['heelRoll']for side,profile in profiles.items()},'contactShift':{side:profile['contactShift']for side,profile in profiles.items()},'speed':speed,'actualDuration':stored}
    return fitted,keys,{'method':'native-sideways-leg-rotations','surface':'complete-native-boot','floor':FLOOR,'sampleRate':60,'parentSampleRate':30,'contactShiftSpace':'gltf-model-local','contactShift':{side:[p['contactShift'][0],p['contactShift'][2],-p['contactShift'][1]]for side,p in profiles.items()},'nativeCycleDuration':round(stored,6),'retainedNativeStrideSpeed':speed,'supportWindows':windows,'heelRoll':{side:profile['heelRoll']for side,profile in profiles.items()}}
