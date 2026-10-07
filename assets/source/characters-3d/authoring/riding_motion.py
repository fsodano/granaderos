"""Fit each native riding boot to the measured iron, with a small heel drop."""
import math
from mathutils import Vector,Quaternion

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


def fit_legs(ctx,pelvis):
    from motion import _leg_ik,_set_world_rotation
    from mounted_motion import measure_tack
    rig=ctx['rig'];seat_shift=measure_tack(ctx)['saddle']-pelvis
    tilt=Quaternion((1,0,0),-HEEL_DROP)
    for side,sign in [('l',1),('r',-1)]:
        fitting=_fittings(ctx)[side];foot=rig.data.bones['foot_'+side]
        rotation=tilt@foot.matrix_local.to_quaternion()
        ankle=fitting['target']-seat_shift-rotation@fitting['contact']
        _leg_ik(rig,side,ankle,pelvis+Vector((sign*.34,-.42,-.26)))
        for name in ('foot_'+side,'ball_'+side):
            _set_world_rotation(rig,name,tilt@rig.data.bones[name].matrix_local.to_quaternion())


def metadata(ctx):
    local=lambda point:[point.x,point.z,-point.y]
    return {'coordinateSpace':'horse-model-local','method':'native boot ball on measured iron',
            'heelDropDegrees':round(math.degrees(HEEL_DROP),6),
            'stirrups':{side:local(fitting['target'])for side,fitting in _fittings(ctx).items()}}
