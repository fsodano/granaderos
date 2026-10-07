"""Build the anatomically proportioned, motion-captured Granadero candidate.

Run with Blender --background --factory-startup --python authoring/build_human.py.
Candidate files are reviewed before replacing the public playground asset.
"""
from pathlib import Path
import sys
import json
import math
import struct
import hashlib
import shutil
import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from human_character import create_character
from human_equipment import create_equipment
from human_motion import apply_animations

OUT = HERE / 'human-review'
OUT.mkdir(exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.render.fps = 30
ctx = create_character()
rig = ctx['rig']
rig.name = 'Granadero_Rig'
create_equipment(ctx)
motion = apply_animations(ctx)
actions = {action.name: action for action in bpy.data.actions}

def activate(name, fraction=0, weapon=None):
    for track in rig.animation_data.nla_tracks:
        track.mute = True
    rig.animation_data.action = actions[name]
    fact = next(c for c in motion['clips'] if c['name'] == name)
    scene.frame_set(1 + int(round(fraction * fact['duration'] * 30)))
    for key, group in ctx['weapons'].items():
        for obj in group.children_recursive:
            obj.hide_render = key != weapon
    bpy.context.view_layer.update()

activate('Idle')
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.render.resolution_x = 900
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.view_settings.view_transform = 'AgX'
scene.world.color = (.10, .11, .12)
ground_mat = bpy.data.materials.new('Review_Ground_Material')
ground_mat.use_nodes = True
ground_mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = (.14, .12, .09, 1)
ground_mat.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value = 1
bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -.012))
ground = bpy.context.object
ground.name = 'Review_Ground'
ground.data.materials.append(ground_mat)
for name, location, power, size in [('Review_Key', (-3, -4, 6), 650, 4), ('Review_Fill', (4, -1, 4), 170, 5), ('Review_Rim', (1, 4, 5), 350, 4)]:
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = power
    data.shape = 'DISK'
    data.size = size
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (Vector((0, 0, 1)) - obj.location).to_track_quat('-Z', 'Y').to_euler()
camera_data = bpy.data.cameras.new('Tactical_Camera')
camera = bpy.data.objects.new('Tactical_Camera', camera_data)
bpy.context.collection.objects.link(camera)
camera.location = (5, -5, .92 + math.sqrt(50) * math.tan(math.radians(30)))
camera.rotation_euler = (Vector((0, 0, .92)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera_data.type = 'ORTHO'
camera_data.ortho_scale = 2.7
scene.camera = camera

# Capture bounds in the neutral animation, with weapons excluded.
def body_bounds():
    depsgraph = bpy.context.evaluated_depsgraph_get()
    points = [obj.evaluated_get(depsgraph).matrix_world @ Vector(v) for obj in ctx['objects'] if obj.type == 'MESH' for v in obj.evaluated_get(depsgraph).bound_box]
    return [min(p[i] for p in points) for i in range(3)], [max(p[i] for p in points) for i in range(3)]

mins, maxs = body_bounds()
for group in ctx['weapons'].values():
    for child in group.children_recursive:
        child.hide_render = False
rig.animation_data.action = None
for track in rig.animation_data.nla_tracks:
    track.mute = False
bpy.ops.object.select_all(action='DESELECT')
for obj in ctx['export_objects']:
    obj.select_set(True)
bpy.context.view_layer.objects.active = rig
glb = OUT / 'granadero-human.glb'
bpy.ops.export_scene.gltf(filepath=str(glb), export_format='GLB', use_selection=True,
    export_yup=True, export_animations=True, export_animation_mode='NLA_TRACKS',
    export_force_sampling=True, export_frame_range=False, export_anim_slide_to_zero=True,
    export_nla_strips=True, export_skins=True, export_morph=False, export_extras=True,
    export_cameras=False, export_lights=False, export_apply=False)

# The Blender exporter does not retain every constant from multiply shaders.
# The material's declared linear colour is the shared renderer contract.
raw = glb.read_bytes()
json_length = struct.unpack_from('<I', raw, 12)[0]
doc = json.loads(raw[20:20+json_length])
for material in doc.get('materials', []):
    source = bpy.data.materials.get(material['name'])
    if source:
        material.setdefault('pbrMetallicRoughness', {})['baseColorFactor'] = list(source.diffuse_color)
encoded = json.dumps(doc, separators=(',', ':')).encode()
encoded += b' ' * (-len(encoded) % 4)
binary = raw[20+json_length:]
raw = struct.pack('<III', 0x46546c67, 2, 20+len(encoded)+len(binary)) + struct.pack('<II', len(encoded), 0x4e4f534a) + encoded + binary
glb.write_bytes(raw)
accessors = doc.get('accessors', [])
triangles = sum(accessors[p['indices']]['count']//3 if 'indices' in p else accessors[p['attributes']['POSITION']]['count']//3 for mesh in doc.get('meshes', []) for p in mesh['primitives'] if p.get('mode', 4) == 4)
clip_facts = []
for clip in doc['animations']:
    source = next(c for c in motion['clips'] if c['name'] == clip['name'])
    duration = max(accessors[s['input']].get('max', [0])[0] for s in clip['samplers'])
    clip_facts.append({'name':clip['name'],'durationSeconds':round(duration,6),'loop':source['loop'],'events':source['events'],'channels':len(clip['channels']),**({'source':source['source']} if 'source' in source else {})})
manifest = {
    'version':2,'asset':'granadero.glb','title':'Granadero — native human anatomy and recorded movement',
    'source':{'type':'Original uniform and equipment on native MakeHuman anatomy; CMU recorded locomotion',
        'script':'authoring/build_human.py','characterScript':'authoring/human_character.py','motionScript':'authoring/human_motion.py',
        'editableScene':'authoring/granadero.blend','blenderVersion':bpy.app.version_string,'units':'metres',
        'vendorManifest':'authoring/vendor/makehuman/source-manifest.json','motionManifest':'authoring/vendor/motion/source-manifest.json'},
    'sha256':hashlib.sha256(raw).hexdigest(),'byteLength':len(raw),
    'coordinates':{'up':'+Y','forward':'+Z','groundY':0,'authoringUp':'+Z','authoringForward':'-Y','adultBodyHeightMetres':ctx['body_height'],'heightWithShakoAndPlumeMetres':round(maxs[2],4)},
    'bounds':{'space':'gltf, Idle frame 1; weapons excluded','min':[round(mins[0],5),round(mins[2],5),round(-maxs[1],5)],'max':[round(maxs[0],5),round(maxs[2],5),round(-mins[1],5)]},
    'statistics':{'triangles':triangles,'meshes':len(doc.get('meshes',[])),'nodes':len(doc.get('nodes',[])),'skins':len(doc.get('skins',[])),'bones':len(rig.data.bones),'materials':len(doc.get('materials',[])),'animationClips':len(doc['animations'])},
    'materials':{'skin':'Skin','uniform':'Navy_Wool','facings':'Crimson_Facings','crossbelts':'Cream_Crossbelts'},
    'nodes':{'rig':'Granadero_Rig','rifle':'weapon_rifle','sabre':'weapon_sabre','pistol':'weapon_pistol','knife':'weapon_knife','rifleMuzzle':'muzzle_rifle','pistolMuzzle':'muzzle_pistol'},
    'weaponForwardLocal':ctx['weapon_forward_local'],'locomotionSpeed':motion['locomotionSpeed'],'clips':clip_facts,
    'notes':['Original body proportions, source joint positions and native weights are preserved.','Walk and Run are retargeted from recorded human movement.','The camera is fixed orthographic, with a 30 degree tactical viewing pitch.','Weapon groups are attached to hand_r; only the selected equipment is visible.']
}
(OUT/'asset-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
activate('Idle')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'granadero-human.blend'),compress=True)
scene.render.filepath = str(OUT/'candidate-isometric.png')
bpy.ops.render.render(write_still=True)
for name, phase, weapon in [('Walk',.20,None),('Run',.20,None),('RifleAim',0,'rifle'),('PistolAim',0,'pistol'),('SabreReady',0,'sabre'),('SabreSlash',.37,'sabre'),('KnifeReady',0,'knife'),('KnifeSlash',.44,'knife')]:
    activate(name,phase,weapon)
    scene.render.resolution_x=700
    scene.render.resolution_y=700
    scene.cycles.samples=16
    scene.render.filepath=str(OUT/(name+'-candidate.png'))
    bpy.ops.render.render(write_still=True)
print('HUMAN_CANDIDATE_READY',json.dumps({'file':str(glb),'bytes':len(raw),'triangles':triangles,'clips':[c['name'] for c in clip_facts]}))
if '--publish' in sys.argv:
    public = HERE.parent / 'public' / 'assets'
    shutil.copy2(glb, public / 'granadero.glb')
    shutil.copy2(OUT / 'asset-manifest.json', public / 'asset-manifest.json')
    shutil.copy2(OUT / 'granadero-human.blend', HERE / 'granadero.blend')
    shutil.copy2(OUT / 'candidate-isometric.png', HERE / 'preview.png')
    for name in ['Walk', 'Run', 'RifleAim', 'PistolAim', 'SabreReady', 'SabreSlash', 'KnifeReady', 'KnifeSlash']:
        shutil.copy2(OUT / (name + '-candidate.png'), HERE / (name + '-review.png'))
    print('PLAYGROUND_ASSET_UPDATED', str(public / 'granadero.glb'))
