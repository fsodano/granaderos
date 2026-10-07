"""Ground native boot soles with leg rotations; retain upper-body contacts."""
import math
import bisect
from mathutils import Vector,Quaternion

LEG_BONES=tuple(name+'_'+side for side in ('l','r') for name in ('thigh','calf','foot','ball'))
FLOOR=.002


def _sole_bindings(ctx):
    cached=ctx.get('native_grounding_soles')
    if cached:return cached
    rig=ctx['rig'];result={}
    for side in ('l','r'):
        sole=next(obj for obj in ctx['objects']if obj.name=='Boot_Sole_'+side)
        floor=min(vertex.co.z for vertex in sole.data.vertices)
        inverse=rig.data.bones['foot_'+side].matrix_local.inverted()
        result[side]=[inverse@vertex.co for vertex in sole.data.vertices if abs(vertex.co.z-floor)<.00001]
        assert len(result[side])>=40,'A native lower sole ring is required'
    ctx['native_grounding_soles']=result
    return result


def _fit_native_leg(rig,side,target):
    from motion import _head,_set_world_rotation
    names=('thigh_'+side,'calf_'+side,'foot_'+side)
    bones=[rig.data.bones[name]for name in names]
    base=_head(rig,names[0]);knee=_head(rig,names[1])
    offsets=[bones[index+1].head_local-bones[index].head_local for index in (0,1)]
    a,b=(offset.length for offset in offsets)
    direction=Vector(target)-base;distance=min(a+b-.0005,max(abs(a-b)+.0005,direction.length));direction.normalize()
    bend=knee-base;bend-=direction*bend.dot(direction)
    if bend.length<.001:
        bend=Vector((1 if side=='l'else -1,-1,0));bend-=direction*bend.dot(direction)
    bend.normalize();along=(a*a-b*b+distance*distance)/(2*distance)
    middle=base+direction*along+bend*math.sqrt(max(0,a*a-along*along))
    for index,end in ((0,middle),(1,base+direction*distance)):
        start=_head(rig,names[index]);rotation=offsets[index].rotation_difference(end-start)@bones[index].matrix_local.to_quaternion()
        _set_world_rotation(rig,names[index],rotation)


def fit_boot_support(ctx,sample):
    """Correct only penetration; a recorded raised foot keeps its full arc."""
    from motion import _apply_sample,_collect,_set_world_rotation
    rig=ctx['rig'];_apply_sample(rig,sample);soles=_sole_bindings(ctx);report={}
    for side in ('l','r'):
        foot=rig.pose.bones['foot_'+side]
        lowest=min((foot.matrix@point).z for point in soles[side])
        rise=max(0,FLOOR-lowest);report[side]={'before':lowest,'rise':rise,'after':lowest}
        if rise<=.000001:continue
        rotations={name:rig.pose.bones[name].matrix.to_quaternion()for name in ('foot_'+side,'ball_'+side)}
        _fit_native_leg(rig,side,foot.head+Vector((0,0,rise)))
        for name,rotation in rotations.items():_set_world_rotation(rig,name,rotation)
        after=min((rig.pose.bones['foot_'+side].matrix@point).z for point in soles[side]);report[side]['after']=after
        if after<FLOOR-.003:raise ValueError('Native leg cannot reach supported sole: '+side+' '+str(after))
    fitted=_collect(rig)
    for name,(position,rotation)in sample.items():
        if name in LEG_BONES:continue
        after=fitted[name]
        assert position==after[0]and rotation==after[1],name+' changed during native leg grounding'
    return fitted,report


def support_clip(ctx,samples,duration,times=None,fps=30):
    """Fit after loop closure at each export frame, without moving the body."""
    original=list(samples)
    keys=list(times)if times is not None else [duration*i/(len(samples)-1)for i in range(len(samples))]
    dense=sorted(set(keys+[i/fps for i in range(round(duration*fps)+1)if i/fps<=duration]))
    fitted=[];maximum=0
    for time in dense:
        index=max(0,min(len(keys)-2,bisect.bisect_right(keys,time)-1))
        fraction=(time-keys[index])/(keys[index+1]-keys[index]);a,b=original[index:index+2];sample={}
        # Blender interpolates source quaternion components, then normalizes
        # them for export. Match that body pose before fitting only the legs.
        for name,(position,rotation)in a.items():
            following=b[name][1].copy()
            if rotation.dot(following)<0:following.negate()
            q=Quaternion(tuple((1-fraction)*rotation[i]+fraction*following[i]for i in range(4)));q.normalize()
            sample[name]=(position.lerp(b[name][0],fraction),q)
        pose,report=fit_boot_support(ctx,sample);fitted.append(pose)
        maximum=max(maximum,max(foot['rise']for foot in report.values()))
    return fitted,dense,{'method':'native-leg-rotations','surface':'actual-lower-sole-ring','floor':FLOOR,'sampleRate':fps,'maximumLift':round(maximum,6)}
