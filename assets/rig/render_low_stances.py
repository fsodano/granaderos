"""Original crouched walking and prone crawling, using existing original rigs."""
import bpy,math,json,sys
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'rig'))
from field_art import native_pixels
DIRECTIONS=[('n',225),('ne',180),('e',135),('se',90),('s',45),('sw',0),('w',315),('nw',270)]
output=ROOT/'rig/stance-frames';output.mkdir(exist_ok=True)
meta={'frame_size':[192,192],'frames_per_direction':8,'fps':10,'directions':dict(DIRECTIONS),'stances':{}}
for stance in ['crouch','prone']:
 info={'frames':[],'idle':[]};meta['stances'][stance]=info
 for faction in ['granadero','royalist']:
  bpy.ops.wm.open_mainfile(filepath=str(ROOT/f'rig/infantry-{faction}.blend'))
  scene=bpy.context.scene;root=bpy.data.objects['ROOT_world_reference'];root.rotation_euler=(0,0,0)
  for o in bpy.data.objects:o.animation_data_clear()
  body=bpy.data.objects['torso_pivot'];head=bpy.data.objects['head']
  camera=scene.camera
  if stance=='prone':
   target=.50;camera.location=(6,-6,target+math.sqrt(72)*math.tan(math.radians(30)));camera.rotation_euler=(Vector((0,0,target))-camera.location).to_track_quat('-Z','Y').to_euler()
   camera.data.ortho_scale=3.1
  native_pixels(scene,62 if stance=='prone' else 52)
  bpy.context.view_layer.update();origin=world_to_camera_view(scene,camera,Vector((0,0,0)));info['anchor']=[origin.x,1-origin.y];info['orthographic_scale']=camera.data.ortho_scale
  def animate(frame,walking=True):
   phase=frame/8;wave=math.sin(phase*math.tau) if walking else 0;cross=math.cos(phase*math.tau) if walking else 0
   if stance=='crouch':
    body.location=(0,0,.64+(math.cos(phase*math.tau*2)*.012 if walking else 0));body.rotation_euler[0]=.22;head.rotation_euler[0]=-.12
    for side,sign in [('left',-1),('right',1)]:
     hip=bpy.data.objects[side+'_hip'];knee=bpy.data.objects[side+'_knee'];ankle=bpy.data.objects[side+'_ankle'];hip.location=(sign*.12,0,.62)
     t=(phase+(0 if sign<0 else .5))%1
     fy=-.14+.56*t if t<.5 else .14-.28*(t-.5)*2
     fz=.13+(.09*math.sin((t-.5)*2*math.pi) if t>=.5 else 0)
     if not walking:fy=0;fz=.13
     dz=fz-.62;distance=math.hypot(fy,dz);h=math.sqrt(.43**2-distance**2/4);ky=fy/2+h*dz/distance;kz=dz/2-h*fy/distance
     upper=math.atan2(ky,-kz);lower=math.atan2(fy-ky,-(dz-kz));hip.rotation_euler[0]=upper;knee.rotation_euler[0]=lower-upper;ankle.rotation_euler[0]=-lower
     for o in [hip,knee,ankle]:o.keyframe_insert('rotation_euler',frame=frame+1)
     shoulder=bpy.data.objects[side+'_shoulder'];elbow=bpy.data.objects[side+'_elbow'];shoulder.rotation_euler[0]=-.40+sign*.10*wave;elbow.rotation_euler[0]=-.50
     for o in [shoulder,elbow]:o.keyframe_insert('rotation_euler',frame=frame+1)
   else:
    body.location=(0,.12,.29+(abs(wave)*.012 if walking else 0));body.rotation_euler[0]=math.pi/2;head.rotation_euler[0]=-.45
    for side,sign in [('left',-1),('right',1)]:
     hip=bpy.data.objects[side+'_hip'];knee=bpy.data.objects[side+'_knee'];ankle=bpy.data.objects[side+'_ankle'];hip.location=(sign*.14,.12,.28)
     hip.rotation_euler=(math.pi/2-.15+sign*.10*wave,sign*.20,0);knee.rotation_euler[0]=.16+sign*.10*cross;ankle.rotation_euler[0]=-.25
     shoulder=bpy.data.objects[side+'_shoulder'];elbow=bpy.data.objects[side+'_elbow'];shoulder.rotation_euler[0]=-.72+sign*.12*wave;elbow.rotation_euler[0]=.55-sign*.08*wave
     for o in [hip,knee,ankle,shoulder,elbow]:o.keyframe_insert('rotation_euler',frame=frame+1)
   for o,prop in [(body,'location'),(body,'rotation_euler'),(head,'rotation_euler')]:o.keyframe_insert(prop,frame=frame+1)
  for f in range(9):animate(f)
  scene.frame_set(1);bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/f'rig/{faction}-{stance}.blend'))
  for direction,angle in DIRECTIONS:
   if '--preview' in sys.argv and (direction!='se' or faction!='granadero'):continue
   root.rotation_euler[2]=math.radians(angle)
   for f in range(8):
    scene.frame_set(f+1);name=f'{faction}-{stance}-walk-{direction}-{f}.png';scene.render.filepath=str(output/name);bpy.ops.render.render(write_still=True);info['frames'].append({'faction':faction,'direction':direction,'frame':f,'file':name})
   scene.frame_set(1);animate(0,False);name=f'{faction}-{stance}-idle-{direction}.png';scene.render.filepath=str(output/name);bpy.ops.render.render(write_still=True);info['idle'].append({'faction':faction,'direction':direction,'file':name});animate(0,True)
(ROOT/'rig/stance-render-manifest.json').write_text(json.dumps(meta,indent=2)+'\n')
