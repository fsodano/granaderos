"""Support a stored standing rifle guard with native leg rotations only.

The input is the released native rig, skin weights and pose. No new retarget
or weapon pose is substituted. Both whole boots keep their planar position;
their sole plane is level and the native thigh/calf joints reach the floor.
"""
import math
import bpy
from mathutils import Matrix, Vector, Quaternion

LEGS=tuple(role+'_'+side for side in ('l','r') for role in ('thigh','calf','foot','ball'))
FLOOR=.002


def head(rig,name):
    bone=rig.data.bones[name]
    return rig.pose.bones[bone.parent.name].matrix@bone.parent.matrix_local.inverted()@bone.head_local if bone.parent else bone.head_local.copy()


def world_rotation(rig,name,rotation):
    # Assign the native local rotation directly. Matrix decomposition can
    # introduce tiny scale/translation changes in an imported source rig.
    bone=rig.data.bones[name]
    basis=rig.pose.bones[bone.parent.name].matrix@bone.parent.matrix_local.inverted()@bone.matrix_local if bone.parent else bone.matrix_local
    rig.pose.bones[name].rotation_quaternion=basis.to_quaternion().inverted()@rotation
    bpy.context.view_layer.update()


def fit_leg(rig,side,target,pole):
    names=('thigh_'+side,'calf_'+side,'foot_'+side)
    bones=[rig.data.bones[name] for name in names]
    base=head(rig,names[0]);offsets=[bones[i+1].head_local-bones[i].head_local for i in (0,1)]
    a,b=(offset.length for offset in offsets);direction=Vector(target)-base;distance=direction.length
    assert abs(a-b)+.0004<distance<a+b-.0004,('Native guard leg is unreachable',side,distance,a,b,list(base),list(target))
    direction.normalize();bend=Vector(pole)-direction*Vector(pole).dot(direction)
    assert bend.length>.001,'A stable native knee plane is required'
    bend.normalize();along=(a*a-b*b+distance*distance)/(2*distance)
    knee=base+direction*along+bend*math.sqrt(max(0,a*a-along*along))
    for i,end in ((0,knee),(1,Vector(target))):
        start=head(rig,names[i]);q=offsets[i].rotation_difference(end-start)@bones[i].matrix_local.to_quaternion()
        world_rotation(rig,names[i],q)


def boot_bindings(rig,mesh):
    """Retain every actual boot vertex and its released skin weights."""
    groups={group.index:group.name for group in mesh.vertex_groups};to_rig=rig.matrix_world.inverted()@mesh.matrix_world
    result={'l':[],'r':[]};sole={'l':[],'r':[]}
    points=[to_rig@vertex.co for vertex in mesh.data.vertices]
    minimum={side:min(point.z for point in points if (point.x>0)==(side=='l'))for side in ('l','r')}
    for vertex,point in zip(mesh.data.vertices,points):
        side='l' if point.x>0 else 'r'
        weights=[(groups[group.group],group.weight,rig.data.bones[groups[group.group]].matrix_local.inverted()@point)for group in vertex.groups if group.weight>.000001]
        assert weights and abs(sum(weight for _,weight,_ in weights)-1)<.00001,'Released native boot skin weights are required'
        result[side].append(weights)
        if point.z<minimum[side]+.003:sole[side].append(weights)
    assert all(len(points)>200 for points in result.values()),'Complete native boots are required'
    assert all(len(points)>=40 for points in sole.values()),'Complete lower sole outlines are required'
    return result,sole


def positions(rig,bindings):
    return [sum((rig.pose.bones[name].matrix@point*weight for name,weight,point in weights),Vector())for weights in bindings]


def fit_pose(rig,boots,soles,profiles,rolls=None,reserve=.002):
    """Keep the actual source pelvis and upper pose; fit only eight rotations."""
    before={pb.name:(pb.location.copy(),pb.rotation_quaternion.copy(),pb.scale.copy())for pb in rig.pose.bones}
    report={}
    for side in ('l','r'):
        profile=profiles[side];q=profile['q'];ball_q=profile['ballQ'];foot=rig.pose.bones['foot_'+side]
        old=head(rig,'foot_'+side);target=Vector((old.x,old.y,old.z))
        native_low=min(point.z for point in positions(rig,boots[side]))
        lift=max(0,native_low-profile['nativeLow'])
        floor=FLOOR+lift
        world_rotation(rig,'foot_'+side,q);world_rotation(rig,'ball_'+side,ball_q)
        flat=positions(rig,soles[side]);forward=profile['pole'];front=max(point.dot(forward)for point in flat)
        toe=sum((point for point in flat if point.dot(forward)>front-.001),Vector())/sum(point.dot(forward)>front-.001 for point in flat)
        toe_offset=toe-head(rig,'foot_'+side);contact=Vector((toe.x,toe.y,floor));axis=Vector((0,0,1)).cross(forward)
        hip=head(rig,'thigh_'+side);a=(rig.data.bones['calf_'+side].head_local-rig.data.bones['thigh_'+side].head_local).length;b=(rig.data.bones['foot_'+side].head_local-rig.data.bones['calf_'+side].head_local).length
        def wanted(angle):return contact-Quaternion(axis,angle)@toe_offset
        def reachable(angle):return abs(a-b)+reserve<(wanted(angle)-hip).length<a+b-reserve
        roll=0
        if not reachable(0):
            # The retained strike pelvis sometimes needs a forefoot pivot.
            # Use its smallest reachable roll, bounded by the full sole.
            low,high=0,.04
            assert reachable(high),('Retained native guard cannot reach a bounded forefoot pivot',side)
            for _ in range(16):
                middle=(low+high)/2
                if reachable(middle):high=middle
                else:low=middle
            roll=high+.00001
        if rolls is not None:
            roll=rolls.get(side,0)
            assert reachable(roll),('Smooth measured guard forefoot roll is unreachable',side,roll,(wanted(roll)-hip).length,a+b-reserve)
        tilt=Quaternion(axis,roll);q=tilt@q;ball_q=tilt@ball_q;target=wanted(roll)
        # Flatten foot and ball together. A translated tilted sole would
        # retain the heel/toe defect, even when its lowest vertex is grounded.
        for _ in range(4):
            fit_leg(rig,side,target,profile['pole'])
            world_rotation(rig,'foot_'+side,q);world_rotation(rig,'ball_'+side,ball_q)
            low=min(point.z for point in positions(rig,boots[side]));difference=floor-low
            if abs(difference)<.000001:break
            target.z+=difference
        points=positions(rig,boots[side]);outline=positions(rig,soles[side]);low=min(point.z for point in points)
        reach=(head(rig,'foot_'+side)-target).length
        assert reach<.00001,('Native guard foot target was not reached',side,reach)
        assert abs(low-floor)<.00001,('Complete native guard boot support failed',side,low,floor)
        span=max(point.z for point in outline)-min(point.z for point in outline)
        assert span<.007,('Native guard forefoot roll exceeds 7 mm of heel rise',side,span)
        report[side]={'lowest':low,'soleMaximum':max(point.z for point in outline),'reachError':reach,'lift':lift,'heelRoll':roll,'footShift':list(head(rig,'foot_'+side)-old)}
    for pb in rig.pose.bones:
        p,q,s=before[pb.name]
        assert (pb.location-p).length<.000001 and (pb.scale-s).length<.000001,(pb.name+' changed native dimensions',list(p),list(pb.location),list(s),list(pb.scale))
        if pb.name not in LEGS:assert pb.rotation_quaternion.rotation_difference(q).angle<.000001,pb.name+' changed an upper-body rotation'
    return {pb.name:pb.rotation_quaternion.copy()for pb in rig.pose.bones if pb.name in LEGS},report


def profiles(rig,boots):
    result={}
    for side in ('l','r'):
        foot=rig.pose.bones['foot_'+side];rest=rig.data.bones['foot_'+side].matrix_local.to_quaternion()
        delta=foot.matrix.to_quaternion()@rest.inverted();forward=delta@Vector((0,-1,0));forward.z=0;forward.normalize()
        yaw=Vector((0,-1,0)).rotation_difference(forward)
        result[side]={'q':yaw@rest,'ballQ':yaw@rig.data.bones['ball_'+side].matrix_local.to_quaternion(),'pole':forward,'nativeLow':min(point.z for point in positions(rig,boots[side]))}
    return result
