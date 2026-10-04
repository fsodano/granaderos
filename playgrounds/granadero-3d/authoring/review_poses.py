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
for name, frame, weapon in [('Walk', 9, None), ('Run', 6, None), ('RifleAim', 0, 'weapon_rifle'), ('PistolAim', 0, 'weapon_pistol'), ('SabreReady', 0, 'weapon_sabre'), ('SabreSlash', 15, 'weapon_sabre')]:
    rig.animation_data.action = bpy.data.actions[name]
    for groupname in ('weapon_rifle', 'weapon_pistol', 'weapon_sabre'):
        for child in bpy.data.objects[groupname].children:
            child.hide_render = groupname != weapon
    scene.frame_set(frame)
    scene.render.filepath = str(HERE / (name + '-review.png'))
    bpy.ops.render.render(write_still=True)
