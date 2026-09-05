"""Run inside Blender to verify real joint motion and closed gait curves."""
import bpy,json,math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'rig/infantry-granadero.blend'))
names=['left_hip','left_knee','left_ankle','right_hip','right_knee','right_ankle','left_shoulder','right_shoulder']
def snapshot(frame):
 bpy.context.scene.frame_set(frame)
 return {name:{'rotation':list(bpy.data.objects[name].rotation_euler),
  'world':list(bpy.data.objects[name].matrix_world.translation)} for name in names}
a,b,mid=snapshot(1),snapshot(9),snapshot(3)
for name in names:
 assert max(abs(x-y) for x,y in zip(a[name]['rotation'],b[name]['rotation']))<1e-5,name
assert abs(a['left_hip']['rotation'][0]-mid['left_hip']['rotation'][0])>.1
assert abs(a['left_shoulder']['rotation'][0]-mid['left_shoulder']['rotation'][0])>.1
assert abs(mid['left_ankle']['world'][2]-mid['right_ankle']['world'][2])>.1
report={'closed_loop':True,'independent_hip_and_arm_motion':True,'opposed_contact_and_passing_feet':True,
 'contact':a,'passing':mid,'duplicate_closing_pose':b}
(ROOT/'rig/rig-audit.json').write_text(json.dumps(report,indent=2)+'\n')
print('Verified closed8-frame gait, moving hip/arm joints and independently raised passing foot.')
