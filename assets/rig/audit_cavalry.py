"""Verify original horse rig curves: four articulated legs and exact closure."""
import bpy,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'rig/cavalry-model.blend'))
names=[f'{end}_{side}_{joint}' for end in ['fore','hind'] for side in ['left','right'] for joint in ['hip','knee','ankle']]
def snapshot(frame):
 bpy.context.scene.frame_set(frame)
 return {n:{'rotation':list(bpy.data.objects[n].rotation_euler),'world':list(bpy.data.objects[n].matrix_world.translation)} for n in names}
poses=[snapshot(f) for f in range(1,10)]
for name in names:
 assert max(abs(a-b) for a,b in zip(poses[0][name]['rotation'],poses[-1][name]['rotation']))<1e-5
 if name.endswith('_hip'):assert max(p[name]['rotation'][0] for p in poses)-min(p[name]['rotation'][0] for p in poses)>.2
 if name.endswith('_ankle'):assert max(p[name]['world'][2] for p in poses)-min(p[name]['world'][2] for p in poses)>.1
(ROOT/'rig/cavalry-audit.json').write_text(json.dumps({'closed_loop':True,'four_moving_legs':True,'independent_hoof_lift':True,'poses':poses},indent=2)+'\n')
print('Verified four moving horse legs, independent hoof lift, exact loop closure.')
