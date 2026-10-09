"""Settle the static crouched idle onto its shared native 2 mm contact plane.

The older posture base keeps 6 mm of clearance. Side-step and guard support
uses 2 mm. Change only the native thigh/calf/foot rotations, retaining the
current knee plane, footprint, foot direction, torso and exact sample times.
"""
from mathutils import Vector
from grounding_motion import _boot_bindings,_boot_lowest,_fit_native_leg

FLOOR=.002
LEGS={role+'_'+side for side in ('l','r')for role in ('thigh','calf','foot')}

def support_clip(ctx,samples,duration,times=None,fps=30,surface='sole'):
    from motion import _apply_sample,_collect,_set_world_rotation
    rig=ctx['rig'];boots=_boot_bindings(ctx);fitted=[];maximum=0
    for sample in samples:
        _apply_sample(rig,sample)
        for side in ('l','r'):
            foot=rig.pose.bones['foot_'+side];rotation=foot.matrix.to_quaternion().copy()
            for _ in range(3):
                correction=FLOOR-_boot_lowest(rig,boots[side]);maximum=max(maximum,abs(correction))
                assert abs(correction)<.012,'Static crouch settle exceeds its measured clearance range'
                if abs(correction)<1e-6:break
                _fit_native_leg(rig,side,foot.head+Vector((0,0,correction)))
                _set_world_rotation(rig,'foot_'+side,rotation)
            assert abs(_boot_lowest(rig,boots[side])-FLOOR)<.00001,'Complete static crouch boot must reach its contact plane'
        pose=_collect(rig)
        for name,original in sample.items():
            if name not in LEGS:pose[name]=(original[0].copy(),original[1].copy())
            else:pose[name]=(original[0].copy(),pose[name][1])
        fitted.append(pose)
    keys=list(times)if times is not None else [duration*i/(len(samples)-1)for i in range(len(samples))]
    return fitted,keys,{'method':'native-static-crouch-settle','surface':'actual-lower-sole-ring','completeBootValidation':True,'floor':FLOOR,'sampleRate':fps,'maximumSettle':round(maximum,6)}
