"""Original civilian period clothing variant; shares infantry gait and ground anchor."""
import bpy,math,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'rig'))
from field_art import cloth_material
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'rig/infantry-granadero.blend'))
scene=bpy.context.scene;root=bpy.data.objects['ROOT_world_reference'];root.rotation_euler=(0,0,0)
# Remove military equipment completely instead of tinting its silhouette.
remove=['white_crossbelt','red_chest','red_plume','cockade','shako_brass_rim','epaulette','leather_pack','rolled_blanket','coat_button','walnut_stock','musket_butt','musket_barrel','flintlock_lock','flintlock_cock']
for obj in list(bpy.data.objects):
 if any(token in obj.name for token in remove):bpy.data.objects.remove(obj,do_unlink=True)
def mat(name,color):
 m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*color,1);bs=m.node_tree.nodes['Principled BSDF'];bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=.95;return m
coat=mat('Civilian umber wool',(.15,.095,.055));trousers=mat('Civilian linen trousers',(.28,.24,.16));shirt=mat('Unbleached civilian shirt',(.62,.55,.40));felt=mat('Brown felt hat',(.085,.045,.022));leather=mat('Plain leather belt',(.09,.047,.021))
for o in bpy.data.objects:
 if o.type!='MESH':continue
 m=None
 if any(t in o.name for t in ['wool_coat','coat_tail','upperarm','forearm']):m=coat
 elif any(t in o.name for t in ['thigh','shin']):m=trousers
 elif 'collar' in o.name or 'cuff' in o.name:m=shirt
 elif 'waist_belt' in o.name:m=leather
 elif 'shako' in o.name:m=felt
 if m:o.data.materials.clear();o.data.materials.append(m)
for fabric in [coat,trousers,shirt,felt]:cloth_material(fabric)
# Re-form hat crown and brim as a low civilian felt hat.
hat=bpy.data.objects['shako'];hat.scale.z=.40;hat.location.z=.185
brim=bpy.data.objects['shako_brim'];brim.scale.x*=1.5;brim.scale.y*=1.8;brim.location.y=0
# Open-coat shirt insert with no military facings or crossed straps.
bpy.ops.mesh.primitive_cube_add(size=1);o=bpy.context.object;o.name='civilian_shirtfront';o.parent=bpy.data.objects['torso_pivot'];o.location=(0,-.15,.32);o.scale=(.15,.015,.30);o.data.materials.append(shirt)
OUT=ROOT/'rig/civilian-frames';OUT.mkdir(exist_ok=True)
dirs=[('n',225),('ne',180),('e',135),('se',90),('s',45),('sw',0),('w',315),('nw',270)]
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'rig/civilian.blend'))
for direction,angle in dirs:
 root.rotation_euler[2]=math.radians(angle)
 for frame in range(8):
  scene.frame_set(frame+1);scene.render.filepath=str(OUT/f'civilian-walk-{direction}-{frame}.png');bpy.ops.render.render(write_still=True)
 scene.frame_set(1)
 # Grounded neutral stance, without the old marching contact pose.
 restore={}
 for side in ['left','right']:
  for suffix in ['_hip','_knee','_ankle']:
   obj=bpy.data.objects[side+suffix];restore[obj.name]=obj.rotation_euler.copy();obj.rotation_euler.x=0;obj.keyframe_insert('rotation_euler',frame=1)
 scene.render.filepath=str(OUT/f'civilian-idle-{direction}.png');bpy.ops.render.render(write_still=True)
 for name,rotation in restore.items():bpy.data.objects[name].rotation_euler=rotation;bpy.data.objects[name].keyframe_insert('rotation_euler',frame=1)
