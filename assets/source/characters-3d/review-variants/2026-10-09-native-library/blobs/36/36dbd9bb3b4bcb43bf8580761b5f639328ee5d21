"""Deterministic real-mesh LODs and a common PBR apparel atlas.

Run after all fitting queries. Never changes source rig or bakes posed skinning.
"""
import math
import bpy
from mathutils import Vector
from surface_atlas import TILE_SIZE, TILE_GUTTER, atlas_pixels

RATIOS=(.22,.075,.028)
LONG_CLOTH_RATIOS=(.65,.35,.16)
HAIR_RATIOS=(.55,.25,.12)

def optimize_character(ctx,lod=0):
 rig=ctx['rig'];objects=ctx['objects']
 # The distant fallback is a flat taper. At inspection/game close distance,
 # individual fitted hairs supply the brow, without a painted strip below.
 if lod<2:
  for o in list(objects):
   if o.name.startswith('Natural_Eyebrow_Bed'):
    objects.remove(o);bpy.data.objects.remove(o,do_unlink=True)
 if lod>0:
  omit=('Crest_Sun_Ray','Crest_Leaf','Crest_Central_Relief','Chinstrap_Brass_Scale')
  if lod==2:omit+=('Red_Epaulette_Fringe','Natural_Eyebrow_Hair','Fine_Collar_Gold_Edge','Cuff_Gold_Edge','Shako_Crest_Crown','Tailored_Shoulder_Seam','Coat_Back_Panel_Seam','Coat_Centre_Closure','Epaulette_Inner_Braid','Epaulette_Metal_Crescent','Epaulette_Button','Crest_Lower_Scroll','Crest_Laurel')
  for o in list(objects):
   if o.name.startswith(omit):objects.remove(o);bpy.data.objects.remove(o,do_unlink=True)
 # Close leather straps must fit the actual LOD surface, not a separate
 # reduction of the high-density coat. Reduce that support once, then cut
 # the three military strap panels from its triangles and native weights.
 reduced_coat=None
 if ctx.get('preset') in ('granadero','royalist') and any(o.name.startswith('Single_Crossbelt') for o in objects):
  reduced_coat=ctx['coat'];bpy.context.view_layer.objects.active=reduced_coat
  reduction=reduced_coat.modifiers.new('Crossbelt_Support_LOD','DECIMATE')
  reduction.ratio=min(1,max(RATIOS[lod],(35 if lod==2 else 100)/max(1,len(reduced_coat.data.polygons))))
  reduction.use_collapse_triangulate=True
  while reduced_coat.modifiers.find(reduction.name)>0:bpy.ops.object.modifier_move_up(modifier=reduction.name)
  if len(reduced_coat.data.polygons)>150:bpy.ops.object.modifier_apply(modifier=reduction.name)
  else:reduced_coat.modifiers.remove(reduction)
  from crossbelts import fit_crossbelts
  fit_crossbelts(ctx)
 # Allocate useful UV space and material-scale pigment after the fitted
 # straps exist. This leaves all rest vertices and native weights unchanged.
 from garment_detail import prepare_apparel_surface
 prepare_apparel_surface(ctx, objects)
 # Use a single attribute name on every object before decimation and joining.
 # Appearance pieces and owned garments may have been added after the native
 # body's face/cloth pigments. Missing attributes would otherwise become black
 # on a joined COLOR_0 primitive.
 for o in objects:
  if o.type!='MESH':continue
  colours=o.data.color_attributes.get('Human_Surface_Tone')
  if colours is None:
   colours=o.data.color_attributes.new(name='Human_Surface_Tone',type='FLOAT_COLOR',domain='POINT')
   cloth=any(word in o.name for word in ('Poncho','Skirt','Shawl','Waistcoat','Habit','Hood','garment_'))
   for vertex,entry in zip(o.data.vertices,colours.data):
    p=vertex.co;shade=.96+.02*math.sin(p.z*19+p.x*13)+.015*math.sin(p.z*37-p.y*17) if cloth else 1
    entry.color=(shade,shade,shade,1)
  o.data.color_attributes.active_color_index=list(o.data.color_attributes).index(colours)
  o.data.color_attributes.render_color_index=o.data.color_attributes.active_color_index
 # Palette tiles carry actual material albedo/roughness/metallicity. This joins
 # dozens of small trim meshes without losing brass/leather PBR response.
 sources=[]
 for o in objects:
  for m in o.data.materials:
   if m and m!=ctx['M']['skin'] and m not in sources:sources.append(m)
 atlas=bpy.data.materials.new('Apparel_Atlas');atlas.use_nodes=True;atlas.diffuse_color=(1,1,1,1)
 p=atlas.node_tree.nodes.get('Principled BSDF');p.inputs['Roughness'].default_value=1;p.inputs['Metallic'].default_value=1;p.inputs['Specular IOR Level'].default_value=.28
 # New cloth, braid, plume and relief materials exceed the old sixteen tiles.
 # Size the shared palette from its actual sources, with power-of-two images.
 side=2**max(2,math.ceil(math.log2(max(1,len(sources)))/2));tile=TILE_SIZE;size=side*tile
 surfaces=atlas_pixels(sources,side,tile)
 for channel in ('Color','MetalRough','Normal'):
  im=bpy.data.images.new('Apparel_'+channel,width=size,height=size)
  if channel!='Color':im.colorspace_settings.name='Non-Color'
  im.pixels.foreach_set(surfaces[channel].ravel());im.update();im.pack()
  tex=atlas.node_tree.nodes.new('ShaderNodeTexImage');tex.image=im;tex.interpolation='Linear'
  if channel=='Color':
   pigment=atlas.node_tree.nodes.new('ShaderNodeVertexColor');pigment.layer_name='Human_Surface_Tone'
   multiply=atlas.node_tree.nodes.new('ShaderNodeMix');multiply.data_type='RGBA';multiply.blend_type='MULTIPLY';multiply.inputs[0].default_value=1
   atlas.node_tree.links.new(tex.outputs['Color'],multiply.inputs[6]);atlas.node_tree.links.new(pigment.outputs['Color'],multiply.inputs[7]);atlas.node_tree.links.new(multiply.outputs[2],p.inputs['Base Color'])
  elif channel=='MetalRough':
   sep=atlas.node_tree.nodes.new('ShaderNodeSeparateColor');atlas.node_tree.links.new(tex.outputs['Color'],sep.inputs[0]);atlas.node_tree.links.new(sep.outputs['Green'],p.inputs['Roughness']);atlas.node_tree.links.new(sep.outputs['Blue'],p.inputs['Metallic'])
  else:
   n=atlas.node_tree.nodes.new('ShaderNodeNormalMap');atlas.node_tree.links.new(tex.outputs['Color'],n.inputs['Color']);atlas.node_tree.links.new(n.outputs['Normal'],p.inputs['Normal'])
 for obj in objects:
  if obj.type!='MESH':continue
  bpy.context.view_layer.objects.active=obj
  # Decimation is placed before the armature to preserve rest-space geometry.
  detail=obj.name.startswith(('Red_Epaulette_Fringe','Red_Shako_Cord','Red_Side_Cord','Red_Tassel','Crest_','Cockade_','Epaulette_','Chinstrap_'))
  minimum=(18 if lod==2 else 36 if lod==1 else 50) if detail else (35 if lod==2 else 100)
  # Long drapes and fitted overlays must retain connected surface curvature.
  # Heavy reduction makes drapes angular and cuts shawl chords into the coat.
  fitted_cloth=any(obj.data.attributes.get(name) is not None for name in ('Long_Cloth','Fitted_Cloth'))
  ratio=LONG_CLOTH_RATIOS[lod] if fitted_cloth else RATIOS[lod]
  if obj.data.attributes.get('Hair_Surface') is not None or obj.name.startswith(('Short_Hair','Braided_Hair','Bound_Hair')):
   ratio=HAIR_RATIOS[lod]
  dec=obj.modifiers.new('Real_Mesh_LOD_'+str(lod),'DECIMATE');dec.ratio=min(1,max(ratio,minimum/max(1,len(obj.data.polygons))));dec.use_collapse_triangulate=True
  while obj.modifiers.find(dec.name)>0:bpy.ops.object.modifier_move_up(modifier=dec.name)
  # Paired neckline loops are sewn to different moving surfaces. Collapsing
  # them independently can reopen a gap or cut the thin collar into the neck.
  fitted_edges=('Crossbelt','Waist_Belt','Trouser_Seam','Crimson_Collar','Fine_Collar_Gold_Edge','Iris','Pupil','Natural_Eyebrow')
  if obj is not reduced_coat and len(obj.data.polygons)>(60 if detail else 150) and not any(n in obj.name for n in fitted_edges):bpy.ops.object.modifier_apply(modifier=dec.name)
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
   # Newly fitted trim without explicit sewn UVs still needs a surface domain.
   # A blank layer samples one texel and erases all material finish variation.
   if not obj.data.uv_layers.active:
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=1.15,island_margin=.012)
    bpy.ops.object.mode_set(mode='OBJECT')
   uv=obj.data.uv_layers.active
   for poly in obj.data.polygons:
    source=obj.data.materials[poly.material_index];index=sources.index(source);tx=index%side;ty=index//side
    for li in poly.loop_indices:
     old=uv.data[li].uv.copy();u=max(0,min(1,old.x));v=max(0,min(1,old.y))
     # Sample texel centres inside the padded surface tile.
     inset=TILE_GUTTER+.5;span=tile-2*TILE_GUTTER-1
     uv.data[li].uv=((tx+(inset+u*span)/tile)/side,(ty+(inset+v*span)/tile)/side)
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
