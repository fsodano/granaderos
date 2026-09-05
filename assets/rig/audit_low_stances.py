"""Verify posture and distinct articulated motion in saved low-stance models."""
import bpy,json,math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];report={}
for stance in ['crouch','prone']:
 for faction in ['granadero','royalist']:
  bpy.ops.wm.open_mainfile(filepath=str(ROOT/f'rig/{faction}-{stance}.blend'))
  names=['left_hip','right_hip','left_knee','right_knee','left_shoulder','right_shoulder']
  frames=[]
  for frame in range(1,10):
   bpy.context.scene.frame_set(frame);frames.append({n:list(bpy.data.objects[n].rotation_euler) for n in names})
  for name in names:
   assert max(abs(a-b) for a,b in zip(frames[0][name],frames[-1][name]))<1e-5
   assert max(f[name][0] for f in frames)-min(f[name][0] for f in frames)>.1
  torso=bpy.data.objects['torso_pivot'];assert torso.location.z<.70
  if stance=='prone':assert abs(torso.rotation_euler[0]-math.pi/2)<1e-5
  else:assert abs(torso.rotation_euler[0])<.4
  report[f'{faction}-{stance}']={'closed_loop':True,'all_hip_knee_and_shoulder_joints_move':True,'torso_height':torso.location.z,'torso_pitch':torso.rotation_euler[0]}
(ROOT/'rig/stance-audit.json').write_text(json.dumps(report,indent=2)+'\n')
print('Verified four original low-stance rigs: lowered crouch, horizontal prone, independently moving joints and closed loops.')
