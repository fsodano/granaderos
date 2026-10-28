"""Support the exact released bayonet pose with native lower rotations.

Retain its Root, pelvis, upper pose and original boot lift. When a flat boot
would straighten the retained leg, use a bounded forefoot roll and the smallest
horizontal ankle correction toward the actual native hip. Envelopes are
measured from this clip before export; no authored weapon or paid reach moves.
"""
import math
import bpy
from mathutils import Vector,Quaternion
from guard_support import LEGS,FLOOR,head,world_rotation,fit_leg,positions

SOLE_SPAN=.0065
# One micrometre protects the measured 2 mm reserve from native float keys.
RESERVE=.002001


def fit_pose(rig,boots,soles,basis,rolls=None,shifts=None):
    before={pb.name:(pb.location.copy(),pb.rotation_quaternion.copy(),pb.scale.copy())for pb in rig.pose.bones};report={}
    for side in ('l','r'):
        profile=basis[side];old=head(rig,'foot_'+side);native_low=min(point.z for point in positions(rig,boots[side]));lift=max(0,native_low-profile['nativeLow']);floor=FLOOR+lift
        world_rotation(rig,'foot_'+side,profile['q']);world_rotation(rig,'ball_'+side,profile['ballQ'])
        flat=positions(rig,soles[side]);ankle=head(rig,'foot_'+side);forward=profile['pole'];front=max(point.dot(forward)for point in flat);edge=[point for point in flat if point.dot(forward)>front-.001];toe=sum(edge,Vector())/len(edge);toe_offset=toe-ankle;contact=Vector((toe.x,toe.y,floor));axis=Vector((0,0,1)).cross(forward);hip=head(rig,'thigh_'+side)
        a=(rig.data.bones['calf_'+side].head_local-rig.data.bones['thigh_'+side].head_local).length;b=(rig.data.bones['foot_'+side].head_local-rig.data.bones['calf_'+side].head_local).length;limit=a+b-RESERVE;relative=[point-ankle for point in flat]
        def wanted(angle):
            tilt=Quaternion(axis,angle);target=contact-tilt@toe_offset;heights=[(tilt@point).z for point in relative];target.z=floor-min(heights);return target,max(heights)-min(heights)
        low,high=0,.04
        for _ in range(32):
            middle=(low+high)/2
            if wanted(middle)[1]<=SOLE_SPAN:low=middle
            else:high=middle
        maximum_roll=low;low,high=0,.04
        for _ in range(32):
            middle=(low+high)/2
            if (wanted(middle)[0]-hip).length<=limit:high=middle
            else:low=middle
        required_roll=high if (wanted(0)[0]-hip).length>limit else 0
        roll=min(required_roll,maximum_roll)if rolls is None else rolls.get(side,0)
        target,span=wanted(roll);assert span<=SOLE_SPAN+.0000001,('Measured bayonet roll exceeds its complete sole bound',side,span)
        toward_hip=Vector((hip.x-target.x,hip.y-target.y,0));horizontal=toward_hip.length;vertical=target.z-hip.z
        permitted=math.sqrt(max(0,limit*limit-vertical*vertical));minimum_shift=max(0,horizontal-permitted);shift=minimum_shift+(.000001 if minimum_shift>0 else 0)if shifts is None else shifts.get(side,0)
        direction=toward_hip.normalized()if horizontal else Vector();target+=direction*shift
        tilt=Quaternion(axis,roll);q=tilt@profile['q'];ball_q=tilt@profile['ballQ']
        for _ in range(5):
            assert (target-hip).length<=limit+.0000002,('Measured bayonet envelope loses the native leg reserve',side,(target-hip).length,limit)
            fit_leg(rig,side,target,profile['pole']);world_rotation(rig,'foot_'+side,q);world_rotation(rig,'ball_'+side,ball_q)
            low=min(point.z for point in positions(rig,boots[side]));difference=floor-low
            if abs(difference)<.00000002:break
            target.z+=difference
            if shifts is None and (target-hip).length>limit:
                h=math.hypot(target.x-hip.x,target.y-hip.y);allowed=math.sqrt(max(0,limit*limit-(target.z-hip.z)**2));extra=max(0,h-allowed)+.000001;target+=direction*extra;shift+=extra
        points=positions(rig,boots[side]);outline=positions(rig,soles[side]);low=min(point.z for point in points);reach=(head(rig,'foot_'+side)-target).length;reserve=a+b-(head(rig,'foot_'+side)-hip).length
        assert reach<.00001,('Native bayonet ankle is unreachable',side,reach)
        assert abs(low-floor)<.000002,('Complete bayonet boot enters its floor',side,low,floor)
        span=max(point.z for point in outline)-min(point.z for point in outline);assert span<=SOLE_SPAN+.0000001,('Complete bayonet sole exceeds its measured roll',side,span)
        assert reserve>=.002,('Native bayonet leg reserve changed',side,reserve)
        report[side]={'lowest':low,'soleMaximum':max(point.z for point in outline),'reachError':reach,'lift':lift,'heelRoll':roll,'maximumHeelRoll':maximum_roll,'footShift':list(head(rig,'foot_'+side)-old),'minimumPlanarCorrection':minimum_shift,'planarCorrection':shift,'planarCorrectionDirection':list(direction),'straightLegReserve':reserve}
    for pb in rig.pose.bones:
        p,q,s=before[pb.name]
        assert (pb.location-p).length<.000001 and (pb.scale-s).length<.000001,pb.name+' changes native dimensions'
        if pb.name not in LEGS:assert pb.rotation_quaternion.rotation_difference(q).angle<.000001,pb.name+' changes its retained pose'
    return {pb.name:pb.rotation_quaternion.copy()for pb in rig.pose.bones if pb.name in LEGS},report
