"""Deterministic real-mesh LODs and a common PBR apparel atlas.

Run after all fitting queries. Never changes source rig or bakes posed skinning.
"""
import math
import bpy
from mathutils import Vector

RATIOS=(.22,.075,.028)

def optimize_character(ctx,lod=0):
 rig=ctx['rig'];objects=ctx['objects']
 if lod==2:
  omit=('Red_Epaulette_Fringe','Natural_Eyebrow','Iris','Pupil','Fine_Collar_Gold_Edge','Cuff_Gold_Edge','Shako_Crest_Crown')
  for o in list(objects):
   if o.name.startswith(omit):objects.remove(o);bpy.data.objects.remove(o,do_unlink=True)
 # Palette tiles carry actual material albedo/roughness/metallicity. This joins
 # dozens of small trim meshes without losing brass/leather PBR response.
 sources=[]
 for o in objects:
  for m in o.data.materials:
   if m and m!=ctx['M']['skin'] and m not in sources:sources.append(m)
 atlas=bpy.data.materials.new('Apparel_Atlas');atlas.use_nodes=True;atlas.diffuse_color=(1,1,1,1)
 p=atlas.node_tree.nodes.get('Principled BSDF');p.inputs['Roughness'].default_value=1;p.inputs['Metallic'].default_value=1
 side=4;tile=32;size=side*tile
 for channel in ('Color','MetalRough','Normal'):
  im=bpy.data.images.new('Apparel_'+channel,width=size,height=size)
  if channel!='Color':im.colorspace_settings.name='Non-Color'
  values=[]
  for y in range(size):
   for x in range(size):
    index=(y//tile)*side+x//tile;m=sources[index] if index<len(sources) else None
    if m:
     bs=m.node_tree.nodes.get('Principled BSDF');r=bs.inputs['Roughness'].default_value;metal=bs.inputs['Metallic'].default_value
     if channel=='Color':
      # Generated PNG pixels are sRGB-encoded values. Material colors are
      # linear; encode once here so glTF/Three decodes back to the same color.
      value=tuple((12.92*c if c<=.0031308 else 1.055*c**(1/2.4)-.055) for c in m.diffuse_color[:3])+(1,)
     elif channel=='MetalRough':value=(1,r,metal,1)
     else:
      woven='Wool' in m.name or 'Trousers' in m.name or 'Facings' in m.name
      nx=.018*math.sin(x*math.pi/2) if woven else 0;ny=.018*math.sin(y*math.pi/2) if woven else 0
      value=((nx+1)/2,(ny+1)/2,math.sqrt(1-nx*nx-ny*ny)*.5+.5,1)
    else:value=(1,1,1,1) if channel!='Normal' else (.5,.5,1,1)
    values.extend(value)
  im.pixels.foreach_set(values);im.update();im.pack()
  tex=atlas.node_tree.nodes.new('ShaderNodeTexImage');tex.image=im;tex.interpolation='Linear'
  if channel=='Color':atlas.node_tree.links.new(tex.outputs['Color'],p.inputs['Base Color'])
  elif channel=='MetalRough':
   sep=atlas.node_tree.nodes.new('ShaderNodeSeparateColor');atlas.node_tree.links.new(tex.outputs['Color'],sep.inputs[0]);atlas.node_tree.links.new(sep.outputs['Green'],p.inputs['Roughness']);atlas.node_tree.links.new(sep.outputs['Blue'],p.inputs['Metallic'])
  else:
   n=atlas.node_tree.nodes.new('ShaderNodeNormalMap');atlas.node_tree.links.new(tex.outputs['Color'],n.inputs['Color']);atlas.node_tree.links.new(n.outputs['Normal'],p.inputs['Normal'])
 for obj in objects:
  if obj.type!='MESH':continue
  bpy.context.view_layer.objects.active=obj
  # Decimation is placed before the armature to preserve rest-space geometry.
  dec=obj.modifiers.new('Real_Mesh_LOD_'+str(lod),'DECIMATE');dec.ratio=min(1,max(RATIOS[lod],(35 if lod==2 else 100)/max(1,len(obj.data.polygons))));dec.use_collapse_triangulate=True
  while obj.modifiers.find(dec.name)>0:bpy.ops.object.modifier_move_up(modifier=dec.name)
  if len(obj.data.polygons)>150 and not any(n in obj.name for n in ('Crossbelt','Waist_Belt','Trouser_Seam')):bpy.ops.object.modifier_apply(modifier=dec.name)
  else:obj.modifiers.remove(dec)
  # At most four normalized bone influences, preserving the strongest native
  # weights. The exporter therefore has one four-influence joint attribute.
  for v in obj.data.vertices:
   groups=sorted([(g.group,g.weight) for g in v.groups],key=lambda x:-x[1])
   if len(groups)>4:
    for idx,val in groups[4:]:obj.vertex_groups[idx].remove([v.index])
   total=sum(x[1] for x in groups[:4])
   if total:
    for idx,val in groups[:4]:obj.vertex_groups[idx].add([v.index],val/total,'REPLACE')
  if obj.data.materials and obj.data.materials[0]!=ctx['M']['skin']:
   uv=obj.data.uv_layers.active or obj.data.uv_layers.new(name='UVMap')
   for poly in obj.data.polygons:
    source=obj.data.materials[poly.material_index];index=sources.index(source);tx=index%side;ty=index//side
    for li in poly.loop_indices:
     old=uv.data[li].uv.copy();u=old.x%1;v=old.y%1
     # Two pixel inset isolates palette tiles under mip filtering.
     uv.data[li].uv=((tx+(2+u*(tile-4))/tile)/side,(ty+(2+v*(tile-4))/tile)/side)
    poly.material_index=0
   obj.data.materials.clear();obj.data.materials.append(atlas)
  for key in list(obj.keys()):
   if key not in ('part','appearance'):del obj[key]
 # Keep optional headwear in its own batch; body has Skin + Apparel primitives.
 result=[]
 batches={part:[o for o in objects if o.get('part','skin')==part] for part in set(o.get('part','skin') for o in objects)}
 for part in ('skin','outfit','legwear','footwear','headwear','garment_poncho','garment_linen_shirt','garment_trousers','garment_hat'):
  selected=batches.get(part,[])
  if not selected:continue
  bpy.ops.object.select_all(action='DESELECT')
  for o in selected:o.select_set(True)
  bpy.context.view_layer.objects.active=selected[0]
  bpy.ops.object.join();joined=bpy.context.object;joined.name=part if part.startswith('garment_') else 'Human_'+part+'_LOD'+str(lod);result.append(joined)
 ctx['objects']=result;ctx['export_objects']=[rig]+result;ctx['lod']=lod
 return ctx
