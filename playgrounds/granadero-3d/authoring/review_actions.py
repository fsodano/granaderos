"""Render repeatable isometric action phases from the saved editable scene.

Blender --background --python authoring/review_actions.py
Outputs live in ignored human-review/action-review; no public asset is changed.
"""
from pathlib import Path
import json
import bpy

HERE=Path(__file__).resolve().parent
OUT=HERE/'human-review'/'action-review';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(HERE/'granadero.blend'))
scene=bpy.context.scene;rig=bpy.data.objects['Granadero_Rig']
for track in rig.animation_data.nla_tracks:track.mute=True
scene.cycles.samples=8
scene.render.resolution_x=380;scene.render.resolution_y=420
manifest=json.loads((HERE.parent/'public/assets/asset-manifest.json').read_text())
records=[]
for clip in manifest['clips']:
 name=clip['name'];duration=clip['durationSeconds']
 if name=='Idle':continue
 weapon=next((key for key in ('rifle','pistol','sabre','knife') if name.lower().startswith(key)),None)
 if name=='BayonetThrust':weapon='rifle'
 for key in ('rifle','pistol','sabre','knife'):
  for child in bpy.data.objects['weapon_'+key].children_recursive:child.hide_render=key!=weapon
 rig.animation_data.action=bpy.data.actions[name]
 event=clip['events'].get('hit',clip['events'].get('shot'))
 if event is not None:
  times=[event*.55,event+(1/30 if 'shot' in clip['events'] else 0),min(duration,event+.16),duration*.84]
 else:times=[duration*f for f in (.05,.30,.55,.80)]
 if name=='SabreCombination':times=[.22,.40,.78,1.02]
 for phase,t in enumerate(times):
  frame=1+t*30;scene.frame_set(int(frame),subframe=frame-int(frame))
  target=OUT/(name+'-'+str(phase)+'.png');scene.render.filepath=str(target)
  bpy.ops.render.render(write_still=True)
  records.append({'clip':name,'phase':phase,'seconds':round(t,4),'file':target.name})
(OUT/'index.json').write_text(json.dumps({'asset':manifest['sha256'],'frames':records},indent=2)+'\n')
print('ACTION_REVIEW_READY',OUT)
