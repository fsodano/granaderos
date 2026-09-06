"""Render original articulated run/fire/reload/strike cycles with infantry anchors."""
import bpy,math,json,sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
DIRECTIONS=[('n',225),('ne',180),('e',135),('se',90),('s',45),('sw',0),('w',315),('nw',270)]
OUT=ROOT/'rig/combat-frames';OUT.mkdir(exist_ok=True)
for faction in ['granadero','royalist']:
 for action in (sys.argv[sys.argv.index('--only')+1:] if '--only' in sys.argv else ['run','fire','reload','strike']):
  bpy.ops.wm.open_mainfile(filepath=str(ROOT/f'rig/infantry-{faction}.blend'))
  for o in bpy.data.objects:o.animation_data_clear()
  if action!='run':
   camera=bpy.context.scene.camera;target=1.15*3.5/2.6;camera.data.ortho_scale=3.5;camera.location=(6,-6,target+math.sqrt(72)*math.tan(math.radians(30)));camera.rotation_euler=(Vector((0,0,target))-camera.location).to_track_quat('-Z','Y').to_euler()
  root=bpy.data.objects['ROOT_world_reference'];body=bpy.data.objects['torso_pivot'];musket=bpy.data.objects['flintlock_musket']
  if action in ['fire','strike']:musket.location.z=.12
  def pose(frame):
   phase=frame/8;wave=math.sin(phase*math.tau)
   body.location=(0,0,.96);body.rotation_euler=(0,0,0)
   for side,sign in [('left',-1),('right',1)]:
    hip=bpy.data.objects[side+'_hip'];knee=bpy.data.objects[side+'_knee'];foot=bpy.data.objects[side+'_ankle'];shoulder=bpy.data.objects[side+'_shoulder'];elbow=bpy.data.objects[side+'_elbow']
    hip.location=(sign*.12,0,.94)
    t=(phase+(0 if sign<0 else .5))%1
    fy=0;fz=.13
    if action=='run':
     fy=-.32+1.28*t if t<.5 else .32-.64*(t-.5)*2
     fz=.13+(.25*math.sin((t-.5)*2*math.pi) if t>=.5 else 0)
    else:fy=sign*.085
    dz=fz-.94;distance=math.hypot(fy,dz);h=math.sqrt(max(0,.43**2-distance**2/4));ky=fy/2+h*dz/distance;kz=dz/2-h*fy/distance
    upper=math.atan2(ky,-kz);lower=math.atan2(fy-ky,-(dz-kz));hip.rotation_euler=(upper,0,0);knee.rotation_euler=(lower-upper,0,0);foot.rotation_euler=(-lower,0,0)
    if action=='run':shoulder.rotation_euler=(-.4+sign*.5*wave,0,0);elbow.rotation_euler=(-.8,0,0)
    elif action=='reload':shoulder.rotation_euler=(-.35-(.25*wave if sign<0 else 0),-.6 if sign<0 else 0,0);elbow.rotation_euler=(-.65+.25*wave if sign<0 else -.35,0,0)
    else:
     thrust=(math.sin(math.pi*phase)**2)*(.3 if action=='strike' else .08)
     shoulder.rotation_euler=(-1.12-thrust,-.65 if sign<0 else 0,0);elbow.rotation_euler=(-.25+thrust*.5,0,0)
    for o in [hip,knee,foot,shoulder,elbow]:o.keyframe_insert('rotation_euler',frame=frame+1)
   if action=='run':body.rotation_euler[0]=-.12;body.location.z+=.035*math.cos(phase*math.tau*2);musket.rotation_euler[0]=.25
   elif action=='reload':musket.rotation_euler[0]=.7
   else:
    total=bpy.data.objects['right_shoulder'].rotation_euler.x+bpy.data.objects['right_elbow'].rotation_euler.x
    musket.rotation_euler[0]=math.pi/2-total
    body.location.y=.025*max(0,math.sin(phase*math.tau)) if action=='fire' else -.06*math.sin(math.pi*phase)**2
   body.keyframe_insert('location',frame=frame+1);body.keyframe_insert('rotation_euler',frame=frame+1);musket.keyframe_insert('rotation_euler',frame=frame+1)
  for frame in range(9):pose(frame)
  for direction,angle in DIRECTIONS:
   root.rotation_euler[2]=math.radians(angle)
   for frame in range(8):
    bpy.context.scene.frame_set(frame+1);bpy.context.scene.render.filepath=str(OUT/f'{faction}-{action}-{direction}-{frame}.png');bpy.ops.render.render(write_still=True)
