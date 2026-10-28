"""Fitted sewn panels and edges on the existing native coat and weights."""
import math
import bpy
from mathutils import Vector
from mathutils.kdtree import KDTree
from mathutils.geometry import closest_point_on_tri


def surface_sample(coat,origin,direction,clearance=.004):
 """Ray-hit weights interpolate the same native face as the fitted point."""
 hit,point,normal,face_index=coat.ray_cast(origin,direction)
 if not hit:return None
 face=coat.data.polygons[face_index];indices=list(face.vertices);best=None
 for i in range(1,len(indices)-1):
  triangle=[coat.data.vertices[index] for index in (indices[0],indices[i],indices[i+1])]
  a,b,c=[v.co for v in triangle];near=closest_point_on_tri(point,a,b,c)
  distance=(near-point).length
  if best is not None and distance>=best[0]:continue
  ab=b-a;ac=c-a;ap=near-a;d00=ab.dot(ab);d01=ab.dot(ac);d11=ac.dot(ac)
  denominator=d00*d11-d01*d01
  if abs(denominator)<1e-15:continue
  v=(d11*ap.dot(ab)-d01*ap.dot(ac))/denominator;w=(d00*ap.dot(ac)-d01*ap.dot(ab))/denominator
  weights={}
  for vertex,factor in zip(triangle,(1-v-w,v,w)):
   for group in vertex.groups:
    name=coat.vertex_groups[group.group].name
    weights[name]=weights.get(name,0)+group.weight*factor
  weights={name:max(0,value) for name,value in weights.items() if value>1e-7}
  total=sum(weights.values());weights={name:value/total for name,value in weights.items()}
  best=(distance,weights)
 return point+normal*clearance,best[1] if best else {'pelvis':1}


def coat_sampler(ctx):
 coat=ctx['coat'];tree=KDTree(len(coat.data.vertices))
 for v in coat.data.vertices:tree.insert(v.co,v.index)
 tree.balance()
 def sample(x,z,back=False,clearance=.004):
  result=surface_sample(coat,Vector((x,1 if back else -1,z)),Vector((0,-1 if back else 1,0)),clearance)
  if result:return result
  point,index,_=tree.find(Vector((x,.12 if back else -.15,z)))
  vertex=coat.data.vertices[index]
  weights={coat.vertex_groups[g.group].name:g.weight for g in vertex.groups}
  return point+vertex.normal*clearance,weights
 return sample


def waist_attachment(ctx,angle,z,clearance=.004):
 radial=Vector((math.cos(angle),math.sin(angle),0))
 return surface_sample(ctx['coat'],radial*.30+Vector((0,0,z)),-radial,clearance)


def joined(ctx,base,details):
 """Keep detail in the same equipment-replacement part as its garment."""
 if not details:return base
 bpy.ops.object.select_all(action='DESELECT')
 for obj in [base]+details:obj.select_set(True)
 bpy.context.view_layer.objects.active=base
 for obj in details:ctx['objects'].remove(obj)
 bpy.ops.object.join()
 return base


def edge(ctx,name,points,weights,material,radius=.0014):
 if len(points)<2:return None
 return ctx['tube'](name,points,[radius]*len(points),material,
                    [dict(w) for w in weights for _ in range(6)],6)


def solidify(obj,thickness=.002):
 bpy.context.view_layer.objects.active=obj
 modifier=obj.modifiers.new('Sewn_Panel_Thickness','SOLIDIFY');modifier.thickness=thickness
 while obj.modifiers.find(modifier.name)>0:bpy.ops.object.modifier_move_up(modifier=modifier.name)
 bpy.ops.object.modifier_apply(modifier=modifier.name)


def coat_panel(ctx,name,material,constraints,clearance=.007,thickness=.002,edge_radius=.0013):
 """Cut a sewn boundary through native cloth faces without changing weights.

 A projected grid does not follow the same interpolation as the underlying
 skinned mesh and can sink into it. This panel preserves that topology, and
 only adds interpolated vertices where its hem crosses a source face.
 """
 coat=ctx['coat'];uv_layer=coat.data.uv_layers.active
 coords=[];weights=[];polygons=[];uvs=[];cache={}
 def interpolate(a,b,t):
  names=set(a['w'])|set(b['w'])
  return {'p':a['p'].lerp(b['p'],t),'n':a['n'].lerp(b['n'],t).normalized(),
          'w':{key:a['w'].get(key,0)*(1-t)+b['w'].get(key,0)*t for key in names},
          'uv':a['uv'].lerp(b['uv'],t)}
 for face in coat.data.polygons:
  polygon=[]
  for index,loop in zip(face.vertices,face.loop_indices):
   v=coat.data.vertices[index]
   polygon.append({'p':v.co.copy(),'n':v.normal.copy(),
      'w':{coat.vertex_groups[g.group].name:g.weight for g in v.groups},
      'uv':uv_layer.data[loop].uv.copy() if uv_layer else Vector((v.co.x+.5,v.co.z/2))})
  for distance in constraints:
   if not polygon:break
   clipped=[];a=polygon[-1];da=distance(a['p'])
   for b in polygon:
    db=distance(b['p'])
    if (da>=0)!=(db>=0):clipped.append(interpolate(a,b,da/(da-db)))
    if db>=0:clipped.append(b)
    a=b;da=db
   polygon=clipped
  if len(polygon)<3:continue
  indices=[]
  for point in polygon:
   position=point['p']+point['n']*clearance;key=tuple(round(value,6) for value in position)
   if key not in cache:cache[key]=len(coords);coords.append(position);weights.append(point['w'])
   indices.append(cache[key])
  if len(set(indices))<3:continue
  polygons.append(tuple(indices));uvs.append([tuple(point['uv']) for point in polygon])
 obj=ctx['mesh'](name,coords,polygons,material,weights,uvs);solidify(obj,thickness)
 counts={}
 for face in polygons:
  for a,b in zip(face,face[1:]+face[:1]):
   key=tuple(sorted((a,b)));counts[key]=counts.get(key,0)+1
 neighbours={};remaining=set()
 for (a,b),count in counts.items():
  if count==1:
   neighbours.setdefault(a,[]).append(b);neighbours.setdefault(b,[]).append(a);remaining.add((a,b))
 trim_material=material.copy();trim_material.name=material.name+'_Sewn_Wool_Edge'
 trim_material.diffuse_color=(*(v*.76 for v in material.diffuse_color[:3]),1)
 trim_material.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=trim_material.diffuse_color
 details=[]
 while remaining:
  pair=next(iter(remaining));remaining.remove(pair);path=[pair[0],pair[1]]
  while True:
   options=[i for i in neighbours[path[-1]] if tuple(sorted((path[-1],i))) in remaining]
   if not options:break
   following=options[0];remaining.remove(tuple(sorted((path[-1],following))));path.append(following)
   if following==path[0]:break
  details.append(edge(ctx,name+'_Sewn_Edge',[coords[i] for i in path],[weights[i] for i in path],trim_material,edge_radius))
 obj=joined(ctx,obj,details)
 # A close sewn overlay must retain its curved support surface at lower
 # detail levels. Independent aggressive collapse puts shoulder chords
 # inside the shirt, even when both layers share native skin weights.
 fitted=obj.data.attributes.new(name='Fitted_Cloth',type='FLOAT',domain='POINT')
 for value in fitted.data:value.value=1
 return obj


def civilian_placket(ctx):
 sample=coat_sampler(ctx);M=ctx['M'];points=[];weights=[]
 for index in range(35):
  p,w=sample(.002,1.43-index*.0096,False,.004)
  points.append(p);weights.append(w)
 edge(ctx,'Linen_Shirt_Placket',points,weights,M['seam'],.0009)
 for z in (1.39,1.30,1.21,1.12):
  p,w=sample(.012,z,False,.006)
  ctx['ellipsoid']('Linen_Shirt_Button',p,(.0027,.0018,.0027),M['cream'],w,10,6)


def waistcoat(ctx):
 sample=coat_sampler(ctx);M=ctx['M']
 def neck(p):
  top=1.325+.130*min(1,abs(p.x)/.178)**.72 if p.y<-.02 else 1.456
  return top-p.z
 coat_panel(ctx,'Worker_Wool_Waistcoat',M['trousers'],[
  lambda p:.179-abs(p.x),lambda p:p.z-1.022,neck],.009)
 for z in (1.30,1.225,1.15,1.075):
  p,w=sample(.014,z,False,.015)
  ctx['ellipsoid']('Waistcoat_Button',p,(.0038,.002,.0038),M['brass'],w,10,6)
 points=[];weights=[]
 for j in range(32):
  p,w=sample(.002,1.315-.286*j/31,False,.013);points.append(p);weights.append(w)
 edge(ctx,'Waistcoat_Centre_Closure',points,weights,M['seam'],.0011)
 for sign in (-1,1):
  points=[];weights=[]
  for j in range(12):
   p,w=sample(sign*(.062+.065*j/11),1.132-.014*j/11,False,.015)
   points.append(p);weights.append(w)
  edge(ctx,'Waistcoat_Welt_Pocket',points,weights,M['seam'],.0018)


def rebozo(ctx):
 """One continuous shoulder wrap, with a low back and diagonal front overlap."""
 M=ctx['M'];sample=coat_sampler(ctx)
 def hem(p):
  side=min(1,abs(p.x)/.225)
  if p.y<-.025:
   bottom=1.16+.19*side+(.025 if p.x>0 else 0)
  elif p.y>.025:bottom=1.205+.14*side
  else:bottom=1.30+.045*side
  return p.z-bottom
 coat_panel(ctx,'Burgundy_Wool_Rebozo',M['trousers'],[hem],.010)
 # A diagonal turned front edge reads as overlapping woven cloth.
 points=[];weights=[]
 for j in range(34):
  t=j/33;p,w=sample(-.068+.144*t,1.458-.238*t,False,.016)
  points.append(p);weights.append(w)
 edge(ctx,'Rebozo_Overlap_Seam',points,weights,M['seam'],.0014)


def fitted_rope_and_hood(ctx):
 M=ctx['M'];sample=coat_sampler(ctx);points=[];weights=[]
 for j in range(97):
  a=j*math.tau/96
  p,w=waist_attachment(ctx,a,1.065,.008)
  points.append(p);weights.append(w)
 edge(ctx,'Linen_Rope_Belt',points,weights,M['cream'],.0038)
 knot,w=sample(.10,1.055,False,.014)
 ctx['ellipsoid']('Linen_Rope_Knot',knot,(.007,.0045,.008),M['cream'],w,12,8)
 skirt=next(obj for obj in ctx['objects'] if obj.name.startswith('Friar_Habit_Skirt'))
 for offset,length in ((-.005,.19),(.005,.145)):
  path=[];ws=[]
  for j in range(17):
   t=j/16;x=.10+offset+.012*math.sin(t*2);z=1.052-length*t
   result=surface_sample(skirt,Vector((x,-1,z)),Vector((0,1,0)),.006)
   p,bw=result if result else sample(x,z,False,.013)
   path.append(p);ws.append(bw)
  tail=edge(ctx,'Linen_Rope_Tail',path,ws,M['cream'],.0030)
  mask=tail.data.attributes.new(name='Long_Cloth',type='FLOAT',domain='POINT')
  for value in mask.data:value.value=1
 def hood_boundary(p):
  v=max(0,min(1,(1.492-p.z)/.21));width=.033+.062*math.sin(math.pi*v)**.7
  return width-abs(p.x)
 obj=coat_panel(ctx,'Folded_Wool_Hood',M['navy'],[
  lambda p:p.y-.02,lambda p:p.z-1.282,lambda p:1.492-p.z,hood_boundary],.008)
 # Fold depth is added to the matched native panel, never to a floating form.
 for vertex in obj.data.vertices:
  p=vertex.co;v=max(0,min(1,(1.492-p.z)/.21))
  p.y+=.016*math.sin(math.pi*v)*math.exp(-(p.x/.050)**2)


def prepare_apparel_surface(ctx, objects):
 """Allocate UVs and sewn panel tones without changing any fitted surface.

 Native coat smart-unwrapping creates many tiny islands. A torso panel and
 each sleeve now get a full material domain, so the shared 256-pixel tile can
 resolve yarn structure. Mapping is in rest space and follows native skinning.
 No position, topology, bone weight, morph or semantic part is changed here.
 """
 def material_copy(obj, name, roughness):
  source=obj.data.materials[0]
  material=bpy.data.materials.get(name)
  if material is None:
   material=source.copy();material.name=name
   material.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=roughness
  obj.data.materials[0]=material
 def remap(obj, coordinate):
  layer=obj.data.uv_layers.active or obj.data.uv_layers.new(name='UVMap')
  for face in obj.data.polygons:
   points=[obj.data.vertices[i].co for i in face.vertices]
   values=coordinate(points, face)
   for loop, value in zip(face.loop_indices, values):layer.data[loop].uv=value
 def cylinder(points, centre, zmin, height):
  angles=[(math.atan2(p.x-centre[0],-(p.y-centre[1]))/math.tau+.5) for p in points]
  if max(angles)-min(angles)>.5:
   # Seam lies at the rear. Keep the crossing face continuous in its tile.
   angles=[a+1 if a<.5 else a for a in angles]
   angles=[a-1 if min(angles)>=1 else a for a in angles]
  return [(max(0,min(1,a)),max(0,min(1,(p.z-zmin)/height))) for a,p in zip(angles,points)]
 for obj in objects:
  if obj.type!='MESH' or not obj.data.materials or obj.data.materials[0] is ctx['M']['skin']:continue
  name=obj.name
  if name.startswith('Curved_Shako_Visor'):
   material_copy(obj,'Shako_Polished_Leather',.31)
   remap(obj,lambda ps,f:[((p.x+.105)/.21,(p.y+.190)/.15) for p in ps])
  elif name.startswith(('Single_Crossbelt','Crossbelt_Shoulder','White_Waist_Belt')) and ctx.get('preset') in ('granadero','royalist'):
   material_copy(obj,'Cream_Buff_Leather',.69)
  if name.startswith(('Shaped_Shako','Broad_Yellow_Hat_Band')):
   lo=min(v.co.z for v in obj.data.vertices);hi=max(v.co.z for v in obj.data.vertices)
   def hat_uv(ps,face):
    if abs(face.normal.z)>.8:return [((p.x+.105)/.21,(p.y+.166)/.228) for p in ps]
    return cylinder(ps,(0,-.052),lo,max(.001,hi-lo))
   remap(obj,hat_uv)
  elif name.startswith(('Short_Hair','Braided_Hair_Root','Bound_Hair_Root','Bound_Hair_Bun')):
   # A scalp must use a hair domain, not the small head patch inside the
   # original full-body skin UV. Roots/buns use the same strand direction.
   lo=min(v.co.z for v in obj.data.vertices);hi=max(v.co.z for v in obj.data.vertices)
   xmid=(min(v.co.x for v in obj.data.vertices)+max(v.co.x for v in obj.data.vertices))*.5
   ymid=(min(v.co.y for v in obj.data.vertices)+max(v.co.y for v in obj.data.vertices))*.5
   if name.startswith('Short_Hair'):
    def scalp_uv(ps,face):
     values=[]
     for p in ps:
      arc=math.atan2(p.z-1.655,-(p.y+.020))
      if arc<0:arc+=math.tau
      # Strands run from forehead over crown to nape, rather than radiating
      # vertically from a cylindrical cap. The existing hairstyle is retained.
      back=max(0,min(1,(p.y+.10)/.19))
      u=.5+(p.x-xmid)/(.175*(1-.20*back))
      values.append((max(0,min(1,u)),max(0,min(1,arc/(math.pi*1.25)))))
     return values
    remap(obj,scalp_uv)
   else:remap(obj,lambda ps,f:cylinder(ps,(xmid,ymid),lo,max(.001,hi-lo)))
  elif name.startswith(('Braided_Hair_Lock','Bound_Hair_Coil')):
   # Authored tubes retain their ring order before LOD. Unwrap each lock
   # continuously along its length instead of making a tiny island per face.
   segments=8 if name.startswith('Braided_Hair_Lock') else 6
   rings=len(obj.data.vertices)//segments
   def lock_uv(ps,face):
    columns=[index%segments for index in face.vertices]
    if max(columns)-min(columns)>segments/2:columns=[segments if c==0 else c for c in columns]
    return [(column/segments*.20,(index//segments)/max(1,rings-1)) for column,index in zip(columns,face.vertices)]
   remap(obj,lock_uv)
  elif name.startswith(('Burgundy_Wool_Rebozo','Worker_Wool_Waistcoat','Long_Skirt_Waistband','Folded_Wool_Hood')):
   # These sewn overlays share body positions and weights, but need their
   # own fabric panels rather than the small source-body texture islands.
   lo=min(v.co.z for v in obj.data.vertices);hi=max(v.co.z for v in obj.data.vertices)
   xmin=min(v.co.x for v in obj.data.vertices);xmax=max(v.co.x for v in obj.data.vertices)
   remap(obj,lambda ps,f:[((p.x-xmin)/max(.001,xmax-xmin),(p.z-lo)/max(.001,hi-lo)) for p in ps])
  elif obj is ctx.get('coat'):
   def coat_uv(ps,face):
    centre=sum(ps,Vector())/len(ps)
    if abs(centre.x)>.19:
     suffix='l' if centre.x>0 else 'r'
     start=ctx['heads']['upperarm_'+suffix];end=ctx['heads']['hand_'+suffix]
     axis=(end-start).normalized();side=axis.cross(Vector((0,1,0))).normalized()
     values=[]
     for p in ps:
      d=p-start;angle=math.atan2(d.dot(side),d.y)/math.tau+.5
      values.append((angle,max(0,min(1,d.dot(axis)/(end-start).length))))
     return values
    return [((p.x+.22)/.44,(p.z-1.01)/.53) for p in ps]
   remap(obj,coat_uv)
   tone=obj.data.color_attributes.get('Human_Surface_Tone')
   if tone:
    for vertex,value in zip(obj.data.vertices,tone.data):
     p=vertex.co;front=max(0,min(1,(-p.y-.055)/.05))
     # Compression beside the closure and below the collar: small sewn
     # construction shadows remain legible when fibre detail is filtered.
     closure=.105*math.exp(-(p.x/.008)**2)*front
     collar=.070*math.exp(-((p.z-1.480)/.012)**2)*max(0,1-abs(p.x)/.19)
     shade=1-closure-collar
     value.color=(*(component*shade for component in value.color[:3]),value.color[3])
  elif name.startswith('Tailored_Breeches'):
   remap(obj,lambda ps,f:cylinder(ps,(.09 if sum(p.x for p in ps)>0 else -.09,0),.425,.63))
