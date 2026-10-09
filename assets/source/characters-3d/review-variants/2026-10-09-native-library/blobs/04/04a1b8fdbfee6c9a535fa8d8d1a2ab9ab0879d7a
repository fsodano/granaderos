"""Fit native seated anatomy to the real saddle, barrel, and stirrup treads."""
import math
from mathutils import Vector,Quaternion
from mathutils.bvhtree import BVHTree

HEEL_DROP=math.radians(10)


def _fittings(ctx):
    if 'riding_fittings'in ctx:return ctx['riding_fittings']
    from mounted_motion import measure_tack
    rig=ctx['rig'];tack=measure_tack(ctx);fittings={}
    for side in ('l','r'):
        sole=next(obj for obj in ctx['objects'] if obj.name=='Boot_Sole_'+side)
        ball=rig.data.bones['ball_'+side]
        # The iron supports the ball of the foot, rather than the low heel.
        contact=Vector((ball.head_local.x,ball.head_local.y,min(v.co.z for v in sole.data.vertices)))
        foot=rig.data.bones['foot_'+side]
        fittings[side]={'contact':foot.matrix_local.inverted()@contact,
                        'target':tack['stirrups'][side]+Vector((0,0,.010))}
    ctx['riding_fittings']=fittings
    return fittings


def seat_shift(ctx):
    """The runtime's fixed native anchor, also used by the mount endpoint."""
    from mounted_motion import measure_tack
    return measure_tack(ctx)['saddle']-ctx['rig'].data.bones['pelvis'].head_local


def _place_legs(ctx,angle):
    from motion import _leg_ik,_set_world_rotation,_head
    rig=ctx['rig'];shift=seat_shift(ctx)
    tilt=Quaternion((1,0,0),-HEEL_DROP)
    for side,sign in [('l',1),('r',-1)]:
        fitting=_fittings(ctx)[side];foot=rig.data.bones['foot_'+side]
        rotation=tilt@foot.matrix_local.to_quaternion()
        ankle=fitting['target']-shift-rotation@fitting['contact']
        pole=_head(rig,'thigh_'+side)+Vector((sign*math.sin(angle),-math.cos(angle),0))
        _leg_ik(rig,side,ankle,pole)
        for name in ('foot_'+side,'ball_'+side):
            _set_world_rotation(rig,name,tilt@rig.data.bones[name].matrix_local.to_quaternion())


def _seat_fit(ctx):
    """Measure the clothed seat and leg envelope once for each native body.

    The pelvis bone is above the buttocks. Putting that joint directly on
    the saddle hides the seated flesh inside the horse. Raise it only until
    the actual breeches underside meets the curved leather, then choose the
    least open knee plane that leaves cloth clearance around the barrel.
    """
    if 'riding_seat_fit' in ctx:return ctx['riding_seat_fit']
    from motion import _collect,_apply_sample,_root_shift
    from mounted_motion import measure_tack
    rig=ctx['rig'];base=_collect(rig);tack=measure_tack(ctx);shift=seat_shift(ctx)
    body=BVHTree.FromPolygons(*tack['bodySurface']);saddle=BVHTree.FromPolygons(*tack['seatSurface'])
    points=[]
    for obj in ctx['objects']:
        if obj.get('part') not in ('legwear','footwear'):continue
        groups={g.index:g.name for g in obj.vertex_groups}
        for vertex in obj.data.vertices:
            weights={groups[g.group]:g.weight for g in vertex.groups if groups.get(g.group) in rig.data.bones}
            dominant=max(weights,key=weights.get) if weights else ''
            if dominant=='pelvis' or dominant.startswith(('thigh_','calf_','foot_','ball_')):
                points.append((vertex.co.copy(),weights,dominant))
    def pose(rise,angle):
        _apply_sample(rig,base);_root_shift(rig,(0,0,rise));_place_legs(ctx,angle)
        matrices={b.name:rig.pose.bones[b.name].matrix@b.matrix_local.inverted() for b in rig.data.bones}
        return [(sum(((matrices[name]@point)*weight for name,weight in weights.items()),Vector())+shift,dominant) for point,weights,dominant in points]
    def seat_gap(posed):
        gaps=[]
        for point,name in posed:
            if name!='pelvis':continue
            hit,normal,face,distance=saddle.ray_cast(point+Vector((0,0,1)),Vector((0,0,-1)))
            if hit is not None:gaps.append(point.z-hit.z)
        if not gaps:raise ValueError('The riding seat has no clothed saddle contact samples')
        return min(gaps)
    def clearance(posed):
        distances=[]
        for point,name in posed:
            if name=='pelvis':continue
            hit,normal,face,distance=body.find_nearest(point)
            distances.append(distance if normal.dot(point-hit)>=0 else -distance)
        return min(distances)
    rise=.10;angle=math.radians(55)
    for iteration in range(3):
        for step in range(3):rise+=.003-seat_gap(pose(rise,angle))
        for degrees in range(36,83,2):
            angle=math.radians(degrees)
            if clearance(pose(rise,angle))>=.010:break
        else:raise ValueError('No native seated knee plane clears the measured horse')
    posed=pose(rise,angle)
    result={'rise':rise,'kneePlane':angle,'seatGap':seat_gap(posed),'barrelClearance':clearance(posed)}
    if not .04<rise<.18:raise ValueError('Riding seat fit is outside the native buttock envelope')
    _apply_sample(rig,base);ctx['riding_seat_fit']=result
    return result


def fit_legs(ctx,pelvis):
    from motion import _root_shift,_head
    fit=_seat_fit(ctx);_root_shift(ctx['rig'],(0,0,fit['rise']));_place_legs(ctx,fit['kneePlane'])
    return _head(ctx['rig'],'pelvis')


def metadata(ctx):
    local=lambda point:[point.x,point.z,-point.y]
    fit=_seat_fit(ctx)
    return {'coordinateSpace':'horse-model-local','method':'clothed seat and legs fitted to saddle and barrel; native boot ball on measured iron',
            'heelDropDegrees':round(math.degrees(HEEL_DROP),6),
            'seatRise':round(fit['rise'],6),'kneePlaneDegrees':round(math.degrees(fit['kneePlane']),6),
            'seatClearance':round(fit['seatGap'],6),'barrelClearance':round(fit['barrelClearance'],6),
            'stirrups':{side:local(fitting['target'])for side,fitting in _fittings(ctx).items()}}
