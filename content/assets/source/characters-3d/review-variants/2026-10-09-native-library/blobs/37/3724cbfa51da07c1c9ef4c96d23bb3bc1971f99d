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


def coat_panel(ctx,name,material,constraints,clearance=.007):
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
 obj=ctx['mesh'](name,coords,polygons,material,weights,uvs);solidify(obj)
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
  details.append(edge(ctx,name+'_Sewn_Edge',[coords[i] for i in path],[weights[i] for i in path],trim_material,.0013))
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
