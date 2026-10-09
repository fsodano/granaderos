"""Set complete prone boots on the floor without widening the knee stance."""
from mathutils import Vector

def fit_static(ctx, clearance=.002):
    from grounding_motion import _boot_bindings, _boot_lowest, _fit_native_leg
    from motion import _collect, _set_world_rotation
    rig=ctx['rig'];before=_collect(rig);boots=_boot_bindings(ctx);report={}
    for side in ('l','r'):
        first=_boot_lowest(rig,boots[side]);rotations={name:rig.pose.bones[name].matrix.to_quaternion().copy() for name in ('foot_'+side,'ball_'+side)}
        for iteration in range(12):
            error=clearance-_boot_lowest(rig,boots[side])
            if abs(error)<.000001:break
            ankle=rig.pose.bones['foot_'+side].head.copy()
            _fit_native_leg(rig,side,ankle+Vector((0,0,error)))
            for name,rotation in rotations.items():_set_world_rotation(rig,name,rotation)
        final=_boot_lowest(rig,boots[side]);assert abs(final-clearance)<.00001,(side,first,final)
        report[side]={'before':first,'after':final,'iterations':iteration+1}
    after=_collect(rig)
    for name in before:
        if name not in {role+'_'+side for role in ('thigh','calf','foot','ball')for side in ('l','r')}:assert before[name]==after[name],name
    return report
