"""Original articulated infantry models and eight-direction walk cycles.
Run: Blender --background --python assets/rig/render_infantry.py -- [--preview]
Object hierarchy is the animation rig: hip/knee and shoulder/elbow pivots carry
rigid mesh segments; their solved rotations are keyframed into the saved blend.
No generated images or third-party meshes are used in this model.
"""
import bpy, math, json, sys
from mathutils import Vector
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
PREVIEW='--preview' in sys.argv
FRAMES=8
DIRECTIONS=[('n',225),('ne',180),('e',135),('se',90),('s',45),('sw',0),('w',315),('nw',270)]
SIZE=192

def material(name,color,metal=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*color,1);b.inputs['Roughness'].default_value=.9;b.inputs['Metallic'].default_value=metal
 return m

def empty(name,loc,parent=None):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=loc;o.parent=parent;return o

def finish(o,name,mat,parent):
 o.name=name;o.data.materials.append(mat);o.parent=parent
 for p in o.data.polygons:p.use_smooth=True
 return o

def ball(name,loc,scale,mat,parent):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,location=loc);o=bpy.context.object;o.scale=scale;return finish(o,name,mat,parent)

def box(name,loc,scale,mat,parent,bevel=.02):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.scale=scale
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:
  mod=o.modifiers.new('soft corners','BEVEL');mod.width=bevel;mod.segments=2
  o.modifiers.new('weighted normals','WEIGHTED_NORMAL')
 return finish(o,name,mat,parent)

def rod(name,a,b,radius,mat,parent,vertices=12):
 a,b=Vector(a),Vector(b);delta=b-a
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=delta.length,location=(a+b)/2)
 o=bpy.context.object;o.rotation_euler=delta.to_track_quat('Z','Y').to_euler();return finish(o,name,mat,parent)

bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
mat={
 'navy':material('Navy wool',(0.018,.035,.073)),
 'white':material('Unbleached wool',(.67,.64,.53)),
 'red':material('Crimson facings',(.36,.025,.020)),
 'black':material('Black leather',(.022,.025,.029)),
 'skin':material('Warm skin',(.49,.25,.13)),
 'gold':material('Brass',(.62,.40,.10),.65),
 'wood':material('Walnut',(.18,.073,.027)),
 'iron':material('Steel',(.20,.24,.26),.75),
 'eyes':material('Dark eyes',(.012,.008,.006)),
}
root=empty('ROOT_world_reference',(0,0,0))
body=empty('torso_pivot',(0,0,.96),root)
coat=box('wool_coat',(0,0,.29),(.43,.28,.59),mat['navy'],body,.065)
# Front is negativeY. Chest facings, collars, belts, buttons and coat tails.
box('red_chest',(0,-.146,.29),(.235,.027,.31),mat['red'],body)
box('waist_belt',(0,-.153,.05),(.40,.035,.055),mat['white'],body)
box('belt_buckle',(0,-.181,.05),(.072,.022,.06),mat['gold'],body)
for sign in [-1,1]:
 belt=box('white_crossbelt',(0,-.172,.31),(.043,.025,.45),mat['white'],body,.007);belt.rotation_euler[1]=sign*.64
 for z in [.18,.28,.38]:ball('coat_button',(sign*.073,-.185,z),(.014,.012,.014),mat['gold'],body)
 box('coat_tail',(sign*.10,.08,-.015),(.16,.12,.23),mat['navy'],body)
rod('neck',(0,0,.56),(0,0,.68),.077,mat['skin'],body)
rod('red_collar',(0,0,.55),(0,0,.64),.10,mat['red'],body)
head=empty('head',(0,0,.75),body);head.scale=(.88,.88,.92)
ball('face',(0,-.017,0),(.139,.117,.168),mat['skin'],head)
ball('nose',(0,-.131,.012),(.033,.037,.042),mat['skin'],head)
for x in [-.055,.055]:
 ball('eye',(x,-.12,.05),(.016,.009,.013),mat['eyes'],head)
 ball('ear',(x*2.6,.003,.002),(.033,.025,.046),mat['skin'],head)
rod('shako',(0,0,.115),(0,0,.38),.153,mat['black'],head)
rod('shako_brass_rim',(0,0,.123),(0,0,.139),.155,mat['gold'],head)
ball('shako_brim',(0,-.095,.12),(.175,.126,.023),mat['black'],head)
ball('cockade',(0,-.153,.29),(.041,.012,.048),mat['gold'],head)
for i in range(5):ball('red_plume',(0,-.015,.40+i*.035),(.039+i*.001,.035,.048),mat['red'],head)
# Period backpack and rolled blanket.
box('leather_pack',(0,.17,.32),(.28,.12,.30),mat['wood'],body)
rod('rolled_blanket',(-.18,.20,.51),(.18,.20,.51),.074,mat['black'],body)
hips=[];knees=[]
L=.43
for side,sign in [('left',-1),('right',1)]:
 hip=empty(side+'_hip',(sign*.12,0,.94),root);knee=empty(side+'_knee',(0,0,-L),hip)
 rod(side+'_thigh',(0,0,-.025),(0,0,-L),.083,mat['navy'],hip)
 rod(side+'_shin',(0,0,0),(0,0,-L+.10),.077,mat['navy'],knee)
 rod(side+'_bootleg',(0,0,-.15),(0,0,-L+.01),.084,mat['black'],knee)
 foot=empty(side+'_ankle',(0,0,-L),knee)
 box(side+'_boot',(0,-.057,.025),(.145,.235,.11),mat['black'],foot,.025)
 hips.append(hip);knees.append(knee)
 # Save foot pivot so ankle rotation keeps boot level on contact.
 knee['foot_object']=foot.name
shoulders=[];elbows=[]
for side,sign in [('left',-1),('right',1)]:
 shoulder=empty(side+'_shoulder',(sign*.255,0,.48),body)
 elbow=empty(side+'_elbow',(0,0,-.25),shoulder)
 rod(side+'_upperarm',(0,0,0),(0,0,-.25),.073,mat['navy'],shoulder)
 rod(side+'_forearm',(0,0,0),(0,0,-.22),.067,mat['navy'],elbow)
 rod(side+'_cuff',(0,0,-.15),(0,0,-.23),.070,mat['red'],elbow)
 hand=empty(side+'_hand',(0,0,-.26),elbow)
 ball(side+'_hand_skin',(0,0,0),(.068,.058,.077),mat['skin'],hand)
 ball(side+'_epaulette',(0,-.005,.015),(.09,.085,.022),mat['red'],shoulder)
 shoulders.append(shoulder);elbows.append(elbow)
 if side=='right':
  # Firearm is attached to the hand and therefore follows its own gait.
  musket=empty('flintlock_musket',(0,-.035,-.12),hand)
  rod('walnut_stock',(0,0,0),(0,0,.67),.025,mat['wood'],musket)
  box('musket_butt',(0,0,-.06),(.072,.043,.20),mat['wood'],musket)
  rod('musket_barrel',(0,-.031,.18),(0,-.031,1.08),.017,mat['iron'],musket)
  box('flintlock_lock',(-.022,-.032,.19),(.016,.038,.086),mat['iron'],musket)
  rod('flintlock_cock',(-.025,-.04,.20),(-.025,-.07,.26),.01,mat['iron'],musket)
  musket.rotation_euler[0]=-.10

# Animation is stored as real per-joint curves, independently from map motion.
def animate(frame, walking=True):
 phase=frame/FRAMES
 for side in range(2):
  t=(phase+side*.5)%1
  if t<.5:
   foot_y=-.26+1.04*t;foot_z=.13
  else:
   swing=(t-.5)*2;foot_y=.26-.52*swing;foot_z=.13+.19*math.sin(math.pi*swing)
  if not walking:foot_y=0;foot_z=.13
  dz=foot_z-.94;distance=math.hypot(foot_y,dz)
  h=math.sqrt(max(0,L*L-distance*distance/4))
  ky=foot_y/2+h*dz/distance;kz=dz/2-h*foot_y/distance
  upper=math.atan2(ky,-kz);lower=math.atan2(foot_y-ky,-(dz-kz))
  hips[side].rotation_euler[0]=upper;knees[side].rotation_euler[0]=lower-upper
  bpy.data.objects[knees[side]['foot_object']].rotation_euler[0]=-lower
  for o in [hips[side],knees[side],bpy.data.objects[knees[side]['foot_object']]]:o.keyframe_insert('rotation_euler',frame=frame+1)
 body.location.z=.96+.014*math.cos(phase*math.tau*2);body.keyframe_insert('location',frame=frame+1)
 shoulders[0].rotation_euler[0]=-.42*math.sin(phase*math.tau)
 elbows[0].rotation_euler[0]=-.16
 shoulders[1].rotation_euler[0]=-.10+.09*math.sin(phase*math.tau)
 elbows[1].rotation_euler[0]=-.25
 for o in shoulders+elbows:o.keyframe_insert('rotation_euler',frame=frame+1)
for frame in range(FRAMES+1):animate(frame)
scene=bpy.context.scene;scene.frame_start=1;scene.frame_end=FRAMES;scene.render.fps=10
# Orthographic camera follows the documented JA2 30degree elevation/45azimuth.
bpy.ops.object.camera_add(location=(6,-6,1.15+math.sqrt(72)*math.tan(math.radians(30))))
camera=bpy.context.object;camera.name='JA2_orthographic_camera';camera.rotation_euler=(Vector((0,0,1.15))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=2.6;scene.camera=camera
for loc,energy,size in [(( -3,-4,7),700,4),((4,1,5),190,3)]:
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=energy;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
scene.world.color=(.3,.3,.3)
scene.render.engine='CYCLES';scene.cycles.samples=12;scene.cycles.use_denoising=True
scene.render.resolution_x=SIZE;scene.render.resolution_y=SIZE;scene.render.resolution_percentage=100
scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
scene.view_settings.view_transform='Standard'
output=ROOT/'rig/frames';output.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'rig/infantry-model.blend'))
# Project the world origin once. This reference remains identical for all poses.
from bpy_extras.object_utils import world_to_camera_view
origin=world_to_camera_view(scene,camera,Vector((0,0,0)))
meta={'frame_size':[SIZE,SIZE],'anchor':[origin.x,1-origin.y],'frames_per_direction':FRAMES,'fps':10,
 'directions':dict(DIRECTIONS),'camera':{'elevation':30,'azimuth':45,'orthographic_scale':2.6},
 'rig':'Original articulated object hierarchy with keyframed hip/knee and shoulder/elbow pivots',
 'model':'assets/rig/infantry-model.blend','frames':[]}
for faction in ['granadero','royalist']:
 for o in bpy.data.objects:
  if o.type=='MESH':
   for slot in o.material_slots:
    if slot.material and slot.material.name in ['Navy wool','Unbleached wool']:
     # Crossbelts must stay white; only coat, limbs and tails switch faction.
     if any(v in o.name for v in ['wool_coat','coat_tail','thigh','shin','upperarm','forearm']):slot.material=mat['navy' if faction=='granadero' else 'white']
 scene.frame_set(1)
 root.rotation_euler[2]=0
 bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/f'rig/infantry-{faction}.blend'))
 for direction,angle in DIRECTIONS:
  if PREVIEW and (faction!='granadero' or direction!='se'):continue
  root.rotation_euler[2]=math.radians(angle)
  for frame in range(FRAMES):
   if PREVIEW and frame not in [0,2,4,6]:continue
   scene.frame_set(frame+1)
   filename=f'{faction}-walk-{direction}-{frame}.png';scene.render.filepath=str(output/filename);bpy.ops.render.render(write_still=True)
   meta['frames'].append({'faction':faction,'direction':direction,'frame':frame,'file':filename})
  if not PREVIEW:
   scene.frame_set(1)
   animate(0,walking=False)
   filename=f'{faction}-idle-{direction}.png';scene.render.filepath=str(output/filename);bpy.ops.render.render(write_still=True)
   meta.setdefault('idle',[]).append({'faction':faction,'direction':direction,'file':filename})
   animate(0,walking=True)
(ROOT/'rig/render-manifest.json').write_text(json.dumps(meta,indent=2)+'\n')
