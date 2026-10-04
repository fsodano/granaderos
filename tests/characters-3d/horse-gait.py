"""Check the exported horse's hinge planes, native lengths, and sole clearance.
Run Blender --background --python tests/characters-3d/horse-gait.py.
"""
from pathlib import Path
import bpy,json,math
root=Path(__file__).resolve().parents[2]
manifest=json.loads((root/'web/public/models/characters/manifest.json').read_text())
for entry in manifest['horse']['lods']:
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 for action in list(bpy.data.actions):bpy.data.actions.remove(action)
 bpy.context.scene.render.fps=30
 bpy.ops.import_scene.gltf(filepath=str(root/'web/public'/entry['url'].lstrip('/')))
 rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
 body=next(o for o in bpy.data.objects if o.type=='MESH' and o.name.startswith('Horse_Body'))
 assert len(rig.data.bones)==19
 native={b.name:b.length for b in rig.data.bones}
 if rig.animation_data:
  for track in rig.animation_data.nla_tracks:track.mute=True
 for clip in manifest['horse']['clips']:
  action=next(a for a in bpy.data.actions if a.name==clip['name']);rig.animation_data.action=action
  duration=(action.frame_range[1]-action.frame_range[0])/30
  assert abs(duration-clip['duration'])<1e-5
  if clip['name']!='HorseIdle':assert .1<clip['locomotionSpeed']<6
  points={b.name:[]for b in rig.data.bones if '_hoof_'in b.name};lowest=[]
  for sample in range(25):
   frame=action.frame_range[0]+(action.frame_range[1]-action.frame_range[0])*sample/24
   bpy.context.scene.frame_set(int(frame),subframe=frame-int(frame))
   for b in rig.pose.bones:
    assert all(math.isfinite(v)for row in b.matrix for v in row)
    assert abs((b.tail-b.head).length-native[b.name])<1e-4,(entry['lod'],clip['name'],b.name,'length')
    if b.name in points:points[b.name].append(b.head.x)
   obj=body.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=obj.to_mesh()
   lowest.append(min((obj.matrix_world@v.co).z for v in mesh.vertices));obj.to_mesh_clear()
  for name,values in points.items():assert max(values)-min(values)<.001,(entry['lod'],clip['name'],name,'lateral drift',values)
  assert min(lowest)>-.005,(entry['lod'],clip['name'],'floor penetration',min(lowest))
  assert max(lowest)<.035,(entry['lod'],clip['name'],'floating',max(lowest))
  print('HORSE_VALID',entry['lod'],clip['name'],'floor',round(min(lowest),4),round(max(lowest),4),'speed',clip['locomotionSpeed'],flush=True)
