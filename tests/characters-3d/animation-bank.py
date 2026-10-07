"""Blender integration check for the complete human animation bank.

Run Blender --background --python tests/characters-3d/animation-bank.py
and again with -- woman-scout for the second native anatomy.
Checks actual generated action data, native joint lengths, and finite poses.
"""
import sys,json,math,bpy
from pathlib import Path
root=Path(__file__).resolve().parents[2];sys.path.insert(0,str(root/'assets/source/characters-3d/authoring'))
from character import create_character
from equipment import create_equipment
from motion import apply_animations,_semantic_specs
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
ctx=create_character(preset=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'granadero');create_equipment(ctx)
rig=ctx['rig'];native={b.name:b.length for b in rig.data.bones}
meta=apply_animations(ctx)
assert len(meta['clips'])==len(_semantic_specs())
assert len(rig.data.bones)==53
for b in rig.data.bones:assert abs(b.length-native[b.name])<1e-8
for clip in meta['clips']:
 action=bpy.data.actions.get(clip['name']);assert action
 if clip['gesture'].startswith('strafe'):
  assert clip['source']['file'] in ('141_33.bvh','139_14.bvh')
  assert clip['locomotionSpeed']>.1
  assert clip['locomotionAxis']==('left' if clip['gesture']=='strafeLeft' else 'right')
 if clip['gesture']=='throwKnife':
  assert clip['handProps']==[{'hand':'handRight','categories':['knife'],'untilMarker':'release'}]
  assert 0<clip['markers']['release']<clip['duration']
 if clip['gesture']=='thrust' or clip.get('variant')=='thrust':
  assert clip['equipment'] in ('lance','blade','knife')
  assert 0<clip['markers']['contact']<clip['duration']
  if clip['equipment']!='lance':
   assert clip['reviewedPose']['name'] in ('SabreThrust','KnifeThrust')
   assert clip['playbackRate']==1.25
 assert abs((action.frame_range[1]-action.frame_range[0])/30-clip['duration'])<.00001,(clip['name'],action.frame_range,clip['duration'])
 rig.animation_data.action=action
 for t in [0,.25,.5,.75,1]:
  bpy.context.scene.frame_set(round(1+clip['duration']*30*t))
  for pb in rig.pose.bones:
   assert all(math.isfinite(v)for row in pb.matrix for v in row),(clip['name'],pb.name)
   assert abs((pb.tail-pb.head).length-native[pb.name])<1e-4,(clip['name'],pb.name,'length')
   if pb.name!='Root':assert pb.location.length<.0001,(clip['name'],pb.name,'translation')
 print('CHECKED',clip['name'],flush=True)

print('COMPLETE MOTION VALID',len(meta['clips']),flush=True)
