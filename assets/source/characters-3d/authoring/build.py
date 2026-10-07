"""Blender worker used by tools/characters-3d/build-library.py."""
from pathlib import Path
import sys,json,struct,hashlib,argparse,math
import bpy
from mathutils import Vector
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3];OUT=ROOT/'web/public/models/characters';META=HERE/'.build';META.mkdir(exist_ok=True);OUT.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,str(HERE))
from character import create_character,neutral_pose
from optimize import optimize_character
from sockets import create_sockets

parser=argparse.ArgumentParser();parser.add_argument('kind');parser.add_argument('--preset',default='granadero');parser.add_argument('--lod',type=int,default=0);parser.add_argument('--review',action='store_true');parser.add_argument('--output-dir',type=Path);parser.add_argument('--metadata-dir',type=Path);args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
if args.output_dir:OUT=args.output_dir;OUT.mkdir(parents=True,exist_ok=True)
if args.metadata_dir:META=args.metadata_dir;META.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.render.fps=30

def export(ctx,path,animations=False):
 bpy.ops.object.select_all(action='DESELECT')
 for o in ctx['export_objects']:o.select_set(True)
 bpy.context.view_layer.objects.active=ctx.get('rig') or ctx['export_objects'][0]
 bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_yup=True,export_animations=animations,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=False,export_anim_slide_to_zero=True,export_nla_strips=True,export_skins=True,export_morph=True,export_extras=False,export_cameras=False,export_lights=False,export_apply=False,export_all_influences=False)
 from gltf_pack import pack
 raw,doc=pack(path,{m.name:list(m.diffuse_color) for m in bpy.data.materials})
 ac=doc.get('accessors',[]);triangles=sum(ac[p['indices']]['count']//3 for m in doc.get('meshes',[]) for p in m['primitives'] if 'indices'in p)
 return {'url':'/models/characters/'+path.name,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'triangles':triangles,'meshes':len(doc.get('meshes',[])),'drawCalls':sum(len(m['primitives'])for m in doc.get('meshes',[])),'materials':[m['name']for m in doc.get('materials',[])],'bones':len(ctx['rig'].data.bones) if ctx.get('rig') else 0,'nodes':[n.get('name')for n in doc.get('nodes',[])]},doc

if args.kind in ('appearance','garments','animations'):
 ctx=create_character(args.preset);gender=ctx['gender']
 if args.kind=='garments':
  from garments import create_garments
  create_garments(ctx);optimize_character(ctx,1);name=gender+'-garments'
 elif args.kind=='animations':
  from equipment import create_equipment
  from motion import apply_animations
  create_equipment(ctx);motion=apply_animations(ctx);optimize_character(ctx,2)
  rig=ctx['rig'];rig.animation_data.action=None
  for t in rig.animation_data.nla_tracks:t.mute=False
  name=gender+'-animations'
 else:
  optimize_character(ctx,args.lod)
  from cloth_correctives import add_cloth_correctives
  add_cloth_correctives(ctx);create_sockets(ctx);name=args.preset+'-lod'+str(args.lod)
 facts,doc=export(ctx,OUT/(name+'.glb'),args.kind=='animations');facts.update(kind=args.kind,preset=args.preset,gender=gender,lod=args.lod,height=ctx['body_height'])
 if args.kind=='appearance':facts['sockets']=ctx['sockets']
 if args.kind=='animations':facts['clips']=motion['clips'];facts['locomotionSpeed']=motion['locomotionSpeed']
elif args.kind=='equipment':
 from equipment_library import create_library
 ctx=create_character();records=create_library(ctx);ctx.pop('rig');name='equipment';facts,doc=export(ctx,OUT/(name+'.glb'));facts.update(kind='equipment',items=records)
elif args.kind=='horse':
 from horse import create_horse
 ctx=create_horse(args.lod);name='horse-lod'+str(args.lod);facts,doc=export(ctx,OUT/(name+'.glb'),True);facts.update(kind='horse',lod=args.lod,clips=ctx['clips'],saddle=ctx['saddle'],height=ctx['height'])
else:raise ValueError(args.kind)
(META/(name+'.json')).write_text(json.dumps(facts,indent=2)+'\n');print('ASSET_READY',name,facts['triangles'],facts['bytes'])
if args.review and args.kind!='equipment':
 if args.kind!='horse':
  if ctx['rig'].animation_data:
   ctx['rig'].animation_data.action=None
   for t in ctx['rig'].animation_data.nla_tracks:t.mute=True
  neutral_pose(ctx)
 else:
  for t in ctx['rig'].animation_data.nla_tracks:t.mute=True
 scene.render.engine='CYCLES';scene.cycles.samples=16;scene.world.color=(.14,.14,.14)
 for loc,power,size in [((2,-4,6),650,4),((-3,-1,4),220,4),((1,4,5),350,4)]:
  d=bpy.data.lights.new('Light','AREA');d.energy=power;d.size=size;o=bpy.data.objects.new('Light',d);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
 d=bpy.data.cameras.new('Camera');o=bpy.data.objects.new('Camera',d);bpy.context.collection.objects.link(o);o.location=(5,-5,5.1);o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler();d.type='ORTHO';d.ortho_scale=3.2 if args.kind=='horse' else 2.6;scene.camera=o
 scene.render.resolution_x=650;scene.render.resolution_y=650;scene.render.resolution_percentage=100;scene.render.filepath=str(META/(name+'.png'));bpy.ops.render.render(write_still=True)
