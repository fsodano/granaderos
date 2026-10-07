"""Blender worker for a selected semantic motion increment, without meshes."""
from pathlib import Path
import sys,argparse,json
import bpy
HERE=Path(__file__).resolve().parent;sys.path.insert(0,str(HERE))
from character import create_character
from equipment import create_equipment
from motion import apply_animations,_semantic_specs
from gltf_pack import pack
p=argparse.ArgumentParser();p.add_argument('--preset',required=True);p.add_argument('--output',required=True);p.add_argument('--gesture',action='append',required=True);p.add_argument('--equipment',required=True);p.add_argument('--posture');a=p.parse_args(sys.argv[sys.argv.index('--')+1:])
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
ctx=create_character(a.preset);create_equipment(ctx)
names={spec['name'] for spec in _semantic_specs() if spec['gesture']in a.gesture and spec['equipment']==a.equipment and(not a.posture or spec['posture']==a.posture)}
motion=apply_animations(ctx,only=names);rig=ctx['rig'];rig.animation_data.action=None
for track in rig.animation_data.nla_tracks:track.mute=False
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
output=Path(a.output);output.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True,export_yup=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=False,export_anim_slide_to_zero=True,export_nla_strips=True,export_skins=True,export_extras=False,export_cameras=False,export_lights=False)
raw,doc=pack(output,{})
assert {animation['name']for animation in doc['animations']}==names
for clip in motion['clips']:
    if'seatAnchor'in clip:
        x,y,z=clip['seatAnchor'];clip['seatAnchor']=[x,z,-y];clip['seatAnchorSpace']='gltf-model-local'
output.with_suffix('.json').write_text(json.dumps(motion,indent=2)+'\n')
print('MOTION_INCREMENT_READY',ctx['gender'],len(names),len(raw),flush=True)
