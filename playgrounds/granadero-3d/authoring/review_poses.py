"""Render representative skeletal poses from the saved native scene for QA."""
import bpy
from pathlib import Path

HERE = Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(HERE / 'granadero.blend'))
scene = bpy.context.scene
rig = bpy.data.objects['Granadero_Rig']
scene.render.resolution_x = 700
scene.render.resolution_y = 700
scene.cycles.samples = 16
for track in rig.animation_data.nla_tracks:
    track.mute = True
for name, frame, weapon in [('Punch', 14, None), ('Walk', 9, None), ('Run', 6, None), ('RifleAim', 1, 'weapon_rifle'), ('PistolAim', 1, 'weapon_pistol'), ('SabreReady', 1, 'weapon_sabre'), ('SabreSlash', 17, 'weapon_sabre'), ('KnifeReady', 1, 'weapon_knife'), ('KnifeSlash', 15, 'weapon_knife')]:
    rig.animation_data.action = bpy.data.actions[name]
    for groupname in ('weapon_rifle', 'weapon_pistol', 'weapon_sabre', 'weapon_knife'):
        for child in bpy.data.objects[groupname].children_recursive:
            child.hide_render = groupname != weapon
    scene.frame_set(frame)
    scene.render.filepath = str(HERE / (name + '-review.png'))
    bpy.ops.render.render(write_still=True)
