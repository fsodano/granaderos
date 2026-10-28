"""Plant native reach-gesture boots while retaining the stored body channels.

Only native leg rotations change. Every released weighted footwear vertex at
all three LODs participates in the floor check; the sole is not a proxy.
"""
import math
import bpy
from mathutils import Vector,Quaternion

NAMES={'stand.gesture.heal','stand.gesture.pickup','stand.gesture.free'}
LEGS=tuple(role+'_'+side for side in('l','r')for role in('thigh','calf','foot','ball'))
FLOOR=.002


def head(rig,name):
    bone=rig.data.bones[name]
    return rig.pose.bones[bone.parent.name].matrix@bone.parent.matrix_local.inverted()@bone.head_local if bone.parent else bone.head_local.copy()


def world_rotation(rig,name,rotation):
    bone=rig.data.bones[name]
    basis=rig.pose.bones[bone.parent.name].matrix@bone.parent.matrix_local.inverted()@bone.matrix_local if bone.parent else bone.matrix_local
    rig.pose.bones[name].rotation_quaternion=basis.to_quaternion().inverted()@rotation
    bpy.context.view_layer.update()


def fit_leg(rig,side,target,pole):
    names=('thigh_'+side,'calf_'+side,'foot_'+side);bones=[rig.data.bones[name]for name in names]
    base=head(rig,names[0]);offsets=[bones[i+1].head_local-bones[i].head_local for i in(0,1)]
    a,b=(offset.length for offset in offsets);direction=target-base;distance=direction.length
    assert abs(a-b)+.0004<distance<a+b-.0004,('Stored gesture leg cannot reach',side,distance,a,b,list(base),list(target))
    direction.normalize();bend=pole-direction*pole.dot(direction)
    assert bend.length>.001,'A fixed native knee plane is required'
    bend.normalize();along=(a*a-b*b+distance*distance)/(2*distance)
    knee=base+direction*along+bend*math.sqrt(max(0,a*a-along*along))
    for i,end in((0,knee),(1,target)):
        start=head(rig,names[i]);q=offsets[i].rotation_difference(end-start)@bones[i].matrix_local.to_quaternion()
        world_rotation(rig,names[i],q)


def bindings(rig,mesh):
    groups={group.index:group.name for group in mesh.vertex_groups};to_rig=rig.matrix_world.inverted()@mesh.matrix_world
    result={'l':[],'r':[]};soles={'l':[],'r':[]};points=[to_rig@vertex.co for vertex in mesh.data.vertices]
    lowest={side:min(point.z for point in points if(point.x>0)==(side=='l'))for side in('l','r')}
    for vertex,point in zip(mesh.data.vertices,points):
        side='l'if point.x>0 else'r'
        weights=[(groups[group.group],group.weight,rig.data.bones[groups[group.group]].matrix_local.inverted()@point)for group in vertex.groups if group.weight>.000001]
        assert weights and abs(sum(weight for _,weight,_ in weights)-1)<.00001,'Native normalized footwear skin weights are required'
        result[side].append(weights)
        if point.z<lowest[side]+.003:soles[side].append(weights)
    assert all(len(vertices)>200 for vertices in result.values()),'Complete weighted footwear is required'
    assert all(len(vertices)>=40 for vertices in soles.values()),'Complete sole outlines are required'
    return result,soles


def positions(rig,vertices):
    return[sum((rig.pose.bones[name].matrix@point*weight for name,weight,point in weights),Vector())for weights in vertices]


def profiles(rig,soles):
    """Retain the starting footprint and native yaw; level the sole locally."""
    result={}
    for side in('l','r'):
        foot=rig.pose.bones['foot_'+side];rest=rig.data.bones['foot_'+side].matrix_local.to_quaternion()
        forward=(foot.matrix.to_quaternion()@rest.inverted())@Vector((0,-1,0));forward.z=0;forward.normalize()
        yaw=Vector((0,-1,0)).rotation_difference(forward);q=yaw@rest;ball_q=yaw@rig.data.bones['ball_'+side].matrix_local.to_quaternion()
        world_rotation(rig,'foot_'+side,q);world_rotation(rig,'ball_'+side,ball_q)
        outline=positions(rig,soles[side]);front=max(point.dot(forward)for point in outline)
        toe=sum((point for point in outline if point.dot(forward)>front-.001),Vector())/sum(point.dot(forward)>front-.001 for point in outline)
        result[side]={'q':q,'ballQ':ball_q,'pole':forward,'contact':Vector((toe.x,toe.y,FLOOR)),'offset':toe-head(rig,'foot_'+side)}
    return result


def fit_pose(rig,boots,soles,profile,rolls=None):
    before={pb.name:(pb.location.copy(),pb.rotation_quaternion.copy(),pb.scale.copy())for pb in rig.pose.bones};report={}
    for side in('l','r'):
        p=profile[side];old=head(rig,'foot_'+side);hip=head(rig,'thigh_'+side);axis=Vector((0,0,1)).cross(p['pole'])
        lengths=[(rig.data.bones[b+'_'+side].head_local-rig.data.bones[a+'_'+side].head_local).length for a,b in(('thigh','calf'),('calf','foot'))]
        def wanted(angle):return p['contact']-Quaternion(axis,angle)@p['offset']
        def reachable(angle):return abs(lengths[0]-lengths[1])+.002<(wanted(angle)-hip).length<sum(lengths)-.002
        roll=0
        if not reachable(0):
            low,high=0,.01
            while high<.2 and not reachable(high):high*=2
            assert high<.2 and reachable(high),'Stored gesture has no bounded supported forefoot reach'
            for _ in range(20):
                middle=(low+high)/2
                if reachable(middle):high=middle
                else:low=middle
            roll=high+.00001
        if rolls is not None:
            roll=rolls.get(side,0);assert reachable(roll),('Measured fixed gesture roll is unreachable',side,roll)
        tilt=Quaternion(axis,roll);target=wanted(roll);q=tilt@p['q'];ball_q=tilt@p['ballQ']
        for _ in range(6):
            fit_leg(rig,side,target,p['pole']);world_rotation(rig,'foot_'+side,q);world_rotation(rig,'ball_'+side,ball_q)
            low=min(point.z for point in positions(rig,boots[side]));difference=FLOOR-low
            if abs(difference)<.000001:break
            target.z+=difference
        full=positions(rig,boots[side]);outline=positions(rig,soles[side]);low=min(point.z for point in full)
        assert abs(low-FLOOR)<.00001,('Complete gesture boot cannot be supported',side,low)
        foot=head(rig,'foot_'+side);hip=head(rig,'thigh_'+side);knee=head(rig,'calf_'+side);reserve=(hip-knee).length+(knee-foot).length-(hip-foot).length
        report[side]={'lowest':low,'soleLowest':min(point.z for point in outline),'soleHighest':max(point.z for point in outline),'reachError':(foot-target).length,'reachReserve':reserve,'heelRoll':roll,'footShift':list(foot-old),'foot':list(foot),'soleCentre':list(sum(outline,Vector())/len(outline))}
    for pb in rig.pose.bones:
        p,q,s=before[pb.name]
        assert(pb.location-p).length<.000001 and(pb.scale-s).length<.000001,pb.name+' changes native dimensions'
        if pb.name not in LEGS:assert pb.rotation_quaternion.rotation_difference(q).angle<.000001,pb.name+' changes retained body channels'
    return{pb.name:pb.rotation_quaternion.copy()for pb in rig.pose.bones if pb.name in LEGS},report
