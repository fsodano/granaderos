"""Author and render original horse/rider object rig; no raster inputs.
Run with Blender --background --python assets/rig/render_cavalry.py.
"""
import bpy, math, json, sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
# Reuse only original geometry helpers, without invoking infantry generation.
helpers=(ROOT/'rig/render_infantry.py').read_text().split("bpy.ops.object.select_all(action='SELECT')")[0]
exec(compile(helpers,str(ROOT/'rig/render_infantry.py'),'exec'))
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'rig/infantry-granadero.blend'))
scene=bpy.context.scene
for o in bpy.data.objects:o.animation_data_clear()
root=bpy.data.objects['ROOT_world_reference'];root.rotation_euler=(0,0,0)
body=bpy.data.objects['torso_pivot'];body.location=(0,.10,1.65)
# The seated rider bends at hip and knee and keeps feet beside the saddle.
for side,sign in [('left',-1),('right',1)]:
 hip=bpy.data.objects[side+'_hip'];hip.location=(sign*.32,.06,1.66);hip.rotation_euler=( -.75,sign*.16,0)
 knee=bpy.data.objects[side+'_knee'];knee.rotation_euler=(1.0,0,0)
 bpy.data.objects[side+'_ankle'].rotation_euler=(-.25,0,0)
 bpy.data.objects[side+'_shoulder'].rotation_euler=(-.55,0,0)
 bpy.data.objects[side+'_elbow'].rotation_euler=(-.65,0,0)
# Cavalry carry a curved saber, not an infantry musket held vertically.
for name in ['flintlock_musket','leather_pack','rolled_blanket']:
 obj=bpy.data.objects.get(name)
 if obj:
  for child in list(obj.children_recursive):bpy.data.objects.remove(child,do_unlink=True)
  bpy.data.objects.remove(obj,do_unlink=True)
materials={name:bpy.data.materials[name] for name in ['Black leather','Brass','Steel','Crimson facings']}
coat=material('Horse bay coat',(.26,.095,.034));mane=material('Horse dark mane',(.027,.017,.012));hoof=material('Hoof horn',(.065,.057,.040));saddle=material('Saddle leather',(.17,.055,.022));eye=material('Horse eyes',(.008,.006,.005))
horse=empty('horse_body',(0,0,0),root)
ball('horse_barrel',(0,0,1.23),(.36,.76,.38),coat,horse)
ball('horse_chest',(0,-.54,1.28),(.34,.36,.43),coat,horse)
ball('horse_rump',(0,.57,1.27),(.36,.35,.38),coat,horse)
neck=empty('horse_neck',(0,-.57,1.37),horse)
rod('horse_neck_mass',(0,0,0),(0,-.27,.51),.235,coat,neck)
ball('horse_neck_upper',(0,-.20,.38),(.22,.25,.29),coat,neck)
head=empty('horse_head',(0,-.28,.56),neck)
ball('horse_skull',(0,-.08,0),(.18,.28,.21),coat,head)
ball('horse_muzzle',(0,-.36,-.15),(.15,.21,.13),coat,head)
for sign in [-1,1]:
 ball('horse_ear',(sign*.11,.015,.23),(.055,.07,.16),coat,head)
 ball('horse_eye',(sign*.17,-.14,.04),(.025,.032,.03),eye,head)
 ball('nostril',(sign*.11,-.5,-.14),(.022,.034,.024),mane,head)
 rod('bridle_cheek',(sign*.18,-.12,.10),(sign*.145,-.40,-.16),.018,materials['Black leather'],head)
 rod('reins',(sign*.16,-.93,1.80),(sign*.21,-.30,1.98),.012,materials['Black leather'],horse)
 rod('stirrup_leather',(sign*.37,0,1.57),(sign*.43,-.25,1.02),.018,saddle,horse)
 rod('stirrup_iron',(sign*.47,-.35,1.00),(sign*.35,-.35,1.00),.025,materials['Steel'],horse)
for i in range(7):ball('mane',(0,-.47-i*.034,1.48+i*.075),(.058,.085,.10),mane,horse)
rod('nose_band',(-.15,-.44,-.10),(.15,-.44,-.10),.022,materials['Black leather'],head)
ball('saddle_blanket',(0,.12,1.51),(.40,.37,.06),materials['Crimson facings'],horse)
ball('saddle_seat',(0,.10,1.57),(.30,.26,.075),saddle,horse)
tail=empty('horse_tail',(0,.80,1.40),horse)
rod('tail_root',(0,0,0),(0,.19,-.38),.09,mane,tail)
ball('tail_hair',(0,.20,-.48),(.10,.10,.29),mane,tail)
hand=bpy.data.objects['right_hand']
rod('saber_grip',(0,0,-.05),(0,0,.09),.025,materials['Black leather'],hand)
rod('saber_guard',(-.07,0,.08),(.07,0,.08),.018,materials['Brass'],hand)
for i in range(7):
 a=(.16*(i/7)**2,0,.10+i*.09);b=(.16*((i+1)/7)**2,0,.10+(i+1)*.09)
 rod('curved_saber_blade',a,b,.016,materials['Steel'],hand)
from field_art import cloth_material
cloth_material(coat)
# Reduce the round muzzle and ears; retain the horse articulation.
for o in bpy.data.objects:
 if o.name.startswith('horse_ear'):o.scale*=.76
 if o.name.startswith('horse_muzzle'):o.scale.x*=.86
legs=[]
for front,y in [(True,-.48),(False,.51)]:
 for sign in [-1,1]:
  name=('fore' if front else 'hind')+('_left' if sign<0 else '_right')
  pivot=empty(name+'_hip',(sign*.24,y,1.12),root)
  knee=empty(name+'_knee',(0,0,-.54),pivot)
  ankle=empty(name+'_ankle',(0,0,-.54),knee)
  rod(name+'_upper',(0,0,0),(0,0,-.54),.088 if front else .105,coat,pivot)
  ball(name+'_joint',(0,0,0),(.075,.075,.09),coat,knee)
  rod(name+'_cannon',(0,0,0),(0,0,-.54),.047,coat,knee)
  box(name+'_hoof',(0,-.027,-.026),(.125,.17,.10),hoof,ankle,.025)
  legs.append((pivot,knee,ankle,front,sign))

def animate(frame,walking=True):
 phase=frame/8
 for pivot,knee,ankle,front,sign in legs:
  # Four-beat walking order: left hind, left fore, right hind, right fore.
  offset=(0 if not front else .25)+(.5 if sign>0 else 0)
  t=(phase+offset)%1
  if t<.625:fy=-.23+.46*t/.625;fz=.085
  else:q=(t-.625)/.375;fy=.23-.46*q;fz=.085+.14*math.sin(q*math.pi)
  if not walking:fy=0;fz=.085
  dz=fz-1.12;distance=min(1.079,math.hypot(fy,dz));L=.54
  height=math.sqrt(max(0,L*L-distance*distance/4));bend=-1 if front else 1
  ky=fy/2+bend*height*(-dz)/distance;kz=dz/2+bend*height*fy/distance
  upper=math.atan2(ky,-kz);lower=math.atan2(fy-ky,-(dz-kz))
  # Both equal segments have the same actual length as the solver.
  knee.location.z=-L;ankle.location.z=-L
  pivot.rotation_euler[0]=upper;knee.rotation_euler[0]=lower-upper;ankle.rotation_euler[0]=-lower
  for o in [pivot,knee,ankle]:o.keyframe_insert('rotation_euler',frame=frame+1)
 bob=.017*math.cos(phase*math.tau*2) if walking else 0
 horse.location.z=bob;body.location.z=1.65+bob
 neck.rotation_euler[0]=.025*math.sin(phase*math.tau) if walking else 0
 tail.rotation_euler[1]=.08*math.sin(phase*math.tau) if walking else 0
 for o,prop in [(horse,'location'),(body,'location'),(neck,'rotation_euler'),(tail,'rotation_euler')]:o.keyframe_insert(prop,frame=frame+1)
for f in range(9):animate(f)
SIZE=256
camera=scene.camera;target=1.680;t=Vector((0,0,target));camera.location=(6,-6,target+math.sqrt(72)*math.tan(math.radians(30)));camera.rotation_euler=(t-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=3.8
native_pixels(scene,76);scene.frame_start=1;scene.frame_end=8;scene.render.fps=10
output=ROOT/'rig/cavalry-frames';output.mkdir(exist_ok=True)
from bpy_extras.object_utils import world_to_camera_view
bpy.context.view_layer.update()
origin=world_to_camera_view(scene,camera,Vector((0,0,0)))
meta={'frame_size':[SIZE,SIZE],'anchor':[origin.x,1-origin.y],'frames_per_direction':8,'fps':10,'directions':dict(DIRECTIONS),'model':'assets/rig/cavalry-model.blend','frames':[],'idle':[]}
scene.frame_set(1);bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'rig/cavalry-model.blend'))
for direction,angle in DIRECTIONS:
 if '--preview' in sys.argv and direction!='se':continue
 root.rotation_euler[2]=math.radians(angle)
 for f in range(8):
  scene.frame_set(f+1);name=f'cavalry-walk-{direction}-{f}.png';scene.render.filepath=str(output/name);bpy.ops.render.render(write_still=True);meta['frames'].append({'faction':'cavalry','direction':direction,'frame':f,'file':name})
 scene.frame_set(1);animate(0,False);name=f'cavalry-idle-{direction}.png';scene.render.filepath=str(output/name);bpy.ops.render.render(write_still=True);meta['idle'].append({'faction':'cavalry','direction':direction,'file':name});animate(0,True)
(ROOT/'rig/cavalry-render-manifest.json').write_text(json.dumps(meta,indent=2)+'\n')
