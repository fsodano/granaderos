"""Authored cloth envelopes on the existing native human skeleton.

Crouched, prone and supine shapes keep the sewn garment around posed legs and
above the floor. They export after LOD optimization, with no extra bones.
"""
import math
import bpy
from mathutils import Matrix,Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree
from mathutils.geometry import barycentric_transform


def _body_surface(ctx):
 """Posed clothing/boot surface, excluding the long garment being corrected."""
 vertices=[];faces=[];depsgraph=bpy.context.evaluated_depsgraph_get()
 for obj in ctx['objects']:
  if obj.type!='MESH':continue
  mask=obj.data.attributes.get('Long_Cloth')
  evaluated=obj.evaluated_get(depsgraph);data=evaluated.to_mesh()
  offset=len(vertices);vertices.extend(obj.matrix_world @ v.co for v in data.vertices)
  for face in data.polygons:
   if mask is not None and any(mask.data[i].value>.9 for i in face.vertices):continue
   faces.append(tuple(offset+i for i in face.vertices))
  evaluated.to_mesh_clear()
 return BVHTree.FromPolygons(vertices,faces)


def _relax_cloth(ctx,obj,key,indices,pose):
 """Relax a sewn shell over the actual body, with waist and floor constraints."""
 from motion import _apply_sample
 _apply_sample(ctx['rig'],pose);body=_body_surface(ctx)
 transforms={bone.name:bone.matrix @ bone.bone.matrix_local.inverted() for bone in ctx['rig'].pose.bones}
 selected=set(indices);adjacent={i:set() for i in indices};skins={};points={}
 for face in obj.data.polygons:
  if not all(i in selected for i in face.vertices):continue
  for a,b in zip(face.vertices,list(face.vertices[1:])+[face.vertices[0]]):
   adjacent[a].add(b);adjacent[b].add(a)
 for index in indices:
  vertex=obj.data.vertices[index];skin=Matrix(((0,0,0,0),)*4);total=0
  for group in vertex.groups:
   transform=transforms.get(obj.vertex_groups[group.group].name)
   if transform is not None:skin+=transform*group.weight;total+=group.weight
  skins[index]=skin*(1/total);points[index]=skins[index] @ key.data[index].co
 # Keep the sewn edge and the two faces of the thin shell together, even after
 # optimization has split their vertices. Nearby original stations act as
 # shared stitches; distant folds are never joined across open space.
 tree=KDTree(len(indices))
 for index in indices:tree.insert(obj.data.vertices[index].co,index)
 tree.balance()
 for index in indices:
  for _,other,distance in tree.find_range(obj.data.vertices[index].co,.0045):
   if other!=index:adjacent[index].add(other)
 original={i:p.copy() for i,p in points.items()}
 for iteration in range(18):
  updated={}
  for index,p in points.items():
   rest=obj.data.vertices[index].co;free=max(0,min(1,(1.025-rest.z)/.16))
   neighbours=adjacent[index]
   if not neighbours or free==0:updated[index]=p;continue
   mean=sum((points[n] for n in neighbours),Vector())/len(neighbours)
   q=p.lerp(mean,.36*free)
   travel=q-original[index]
   if travel.length>.060:q=original[index]+travel.normalized()*.060
   nearest,normal,_,_=body.find_nearest(q)
   if nearest is not None:
    clearance=(q-nearest).dot(normal)
    if clearance<.017:q+=normal*(.017-clearance)
   q.z=max(.018,q.z);updated[index]=q
  points=updated
 for index,point in points.items():key.data[index].co=skins[index].inverted_safe() @ point
 print('CLOTH_RELAXED',len(points),18,flush=True)


def _shell_thickness(ctx,obj,key,indices,pose):
 """Separate each side along its settled normal instead of z-fighting."""
 from motion import _apply_sample
 _apply_sample(ctx['rig'],pose)
 transforms={bone.name:bone.matrix @ bone.bone.matrix_local.inverted() for bone in ctx['rig'].pose.bones}
 skins={};points={};selected=set(indices)
 for index in indices:
  vertex=obj.data.vertices[index];skin=Matrix(((0,0,0,0),)*4);total=0
  for group in vertex.groups:
   transform=transforms.get(obj.vertex_groups[group.group].name)
   if transform is not None:skin+=transform*group.weight;total+=group.weight
  skins[index]=skin*(1/total);points[index]=skins[index] @ key.data[index].co
 # Reconstruct the inner face from the final outer surface. Offsetting two
 # independently relaxed faces is insufficient: they can already have crossed
 # by several millimetres and cause dark flickering pockets.
 outer=[];coordinates=[]
 for face in obj.data.polygons:
  if not all(i in selected for i in face.vertices):continue
  centre=sum((obj.data.vertices[i].co for i in face.vertices),Vector())/len(face.vertices)
  radial=Vector((centre.x,centre.y-.012,0))
  if face.normal.dot(radial)<=0:continue
  ids=list(face.vertices)
  for j in range(1,len(ids)-1):
   triangle=(ids[0],ids[j],ids[j+1]);outer.append(triangle)
   coordinates.extend(obj.data.vertices[i].co.copy() for i in triangle)
 surface=BVHTree.FromPolygons(coordinates,[(3*i,3*i+1,3*i+2) for i in range(len(outer))])
 fixed=0
 for index,point in points.items():
  vertex=obj.data.vertices[index];radial=Vector((vertex.co.x,vertex.co.y-.012,0))
  if vertex.normal.dot(radial)<0:
   nearest,_,face,distance=surface.find_nearest(vertex.co)
   if nearest is not None and distance<.022:
    ids=outer[face];rest=[obj.data.vertices[i].co for i in ids];posed=[points[i] for i in ids]
    normal=(posed[1]-posed[0]).cross(posed[2]-posed[0]).normalized()
    point=barycentric_transform(nearest,*rest,*posed)-normal*.003;point.z=max(.014,point.z);fixed+=1
  key.data[index].co=skins[index].inverted_safe() @ point
 print('CLOTH_INNER_FACE_FIT',fixed,flush=True)


def _crawl_clearance(ctx,obj,key,indices,poses):
 """Use a smooth reference-space envelope for the full sampled crawl cycle."""
 from motion import _apply_sample
 rig=ctx['rig'];contacts=[];reference={};selected=set()
 for pose_index,pose in enumerate(poses):
  _apply_sample(rig,pose);body=_body_surface(ctx)
  transforms={bone.name:bone.matrix @ bone.bone.matrix_local.inverted() for bone in rig.pose.bones};skins={}
  for index in indices:
   vertex=obj.data.vertices[index]
   if vertex.co.y<=.012 or vertex.co.z>.90:continue
   skin=Matrix(((0,0,0,0),)*4);total=0
   for group in vertex.groups:
    transform=transforms.get(obj.vertex_groups[group.group].name)
    if transform is not None:skin+=transform*group.weight;total+=group.weight
   if total:
    skins[index]=skin*(1/total)
    if pose_index==0:reference[index]=skins[index].to_3x3().inverted_safe() @ Vector((0,0,1));selected.add(index)
  contacts.append((body,skins))
 required={i:0.0 for i in selected};adjacent={i:set() for i in selected}
 for face in obj.data.polygons:
  ids=[i for i in face.vertices if i in selected]
  for i in ids:adjacent[i].update(j for j in ids if j!=i)
 for body,skins in contacts:
  for index,skin in skins.items():
   point=skin @ key.data[index].co;support=0
   for dx,dy in ((0,0),(.018,0),(-.018,0),(0,.018),(0,-.018)):
    hit,_,_,_=body.ray_cast(Vector((point.x+dx,point.y+dy,1)),Vector((0,0,-1)))
    if hit is not None:support=max(support,hit.z)
   if support:
    response=max(.3,(skin.to_3x3() @ reference[index]).z)
    required[index]=max(required[index],min(.11,(support+.025-point.z)/response))
 # Average the support constraint along sewn neighbours while retaining the
 # required height. Independent vertex lifts changed x/y under a different
 # pose and caused the dark folded pocket visible in the earlier review.
 height=required.copy()
 for iteration in range(28):
  height={i:max(required[i],height[i]*.35+(sum(height[j] for j in adjacent[i])/len(adjacent[i]) if adjacent[i] else height[i])*.65) for i in selected}
 for index,lift in height.items():key.data[index].co+=reference[index]*lift
 print('CLOTH_CRAWL_CLEARANCE',len(poses),max(height.values(),default=0),flush=True)


def _coat_tail_correctives(ctx):
 """Flatten loose rear coat panels at ground contact, without moving the body."""
 selected=[obj for obj in ctx['objects'] if obj.data.attributes.get('Coat_Tail') is not None]
 if not selected:return
 from motion import _collect,_apply_sample,_retarget_samples
 rig=ctx['rig'];saved=_collect(rig)
 samples,_=_retarget_samples(ctx,'fall');frames=[]
 chest=rig.pose.bones['spine_03']
 native_front=chest.bone.matrix_local.to_quaternion().inverted() @ Vector((0,-1,0))
 for number,pose in enumerate(samples):
  _apply_sample(rig,pose)
  fraction=number/(len(samples)-1)
  prone=min(1,fraction/.68)
  facing=max(0,min(1,((chest.matrix.to_quaternion() @ native_front).z-.10)/.65))
  weight=prone*facing*facing*(3-2*facing)
  if weight<.015:continue
  frames.append((weight,{bone.name:bone.matrix @ bone.bone.matrix_local.inverted() for bone in rig.pose.bones}))
 for obj in selected:
  indices=[i for i,value in enumerate(obj.data.attributes['Coat_Tail'].data) if value.value>.9]
  obj.shape_key_add(name='Basis')
  obj.shape_key_add(name='cloth_crouched').value=0
  obj.shape_key_add(name='cloth_prone').value=0
  key=obj.shape_key_add(name='cloth_supine');key.value=0;maximum=0
  for index in indices:
   vertex=obj.data.vertices[index];constraints=[]
   for weight,transforms in frames:
    skin=Matrix(((0,0,0,0),)*4);total=0
    for group in vertex.groups:
     transform=transforms.get(obj.vertex_groups[group.group].name)
     if transform is not None:skin+=transform*group.weight;total+=group.weight
    if not total:continue
    skin*=1/total
    normal=Vector(skin[2][:3])*weight
    constraints.append((normal,.010-(skin @ vertex.co).z))
   delta=Vector()
   # Project onto the contact half-spaces in native rest coordinates. The
   # correction is blended by the same face-up weight as the rendered cloth.
   for _ in range(12):
    for normal,height in constraints:
     gap=height-normal.dot(delta)
     if gap>0 and normal.length_squared>1e-10:delta+=normal*(gap/normal.length_squared)
   assert delta.length<.22,('Excessive coat-tail floor correction',obj.name,index,delta.length)
   key.data[index].co+=delta;maximum=max(maximum,delta.length)
  obj.data.attributes.remove(obj.data.attributes['Coat_Tail'])
  print('COAT_TAIL_GROUND_CLEARANCE',obj.name,len(indices),maximum,flush=True)
 _apply_sample(rig,saved)


def add_cloth_correctives(ctx):
 _coat_tail_correctives(ctx)
 if ctx['preset'] not in ('friar','woman-shawl'):return
 from motion import _collect,_apply_sample,_prone_pose,_retarget_samples,_root_shift,_leg_ik,_aim
 rig=ctx['rig'];saved=_collect(rig);basis={bone.name:bone.matrix_basis.copy() for bone in rig.pose.bones}
 # These are the same adapted native postures used by the animation bank.
 prone=_prone_pose(ctx,saved)
 supine=_retarget_samples(ctx,'fall')[0][-1]
 crawl,metadata=_retarget_samples(ctx,'crawl')
 crawl_poses=[prone]+[_prone_pose(ctx,saved,crawl[round(i*(len(crawl)-1)/8)],metadata['kneeCenter']) for i in range(9)]
 crouch=_retarget_samples(ctx,'crouch')[0][0]
 _apply_sample(rig,crouch)
 _root_shift(rig,(0,0,.66-rig.pose.bones['pelvis'].head.z))
 for side,sign in [('l',1),('r',-1)]:
  _leg_ik(rig,side,(sign*.13,.015,.078),(sign*.14,-.42,.40))
  _aim(rig,'foot_'+side,(0,-.18,-.036));_aim(rig,'ball_'+side,(0,-.10,0))
 crouch=_collect(rig)
 for obj in ctx['objects']:
  mask=obj.data.attributes.get('Long_Cloth')
  if mask is None:continue
  indices=[i for i,value in enumerate(mask.data) if value.value>.9]
  print('CLOTH_MASK',obj.name,len(indices),'of',len(obj.data.vertices),flush=True)
  if not indices:continue
  obj.shape_key_add(name='Basis')
  for name,pose in [('cloth_crouched',crouch),('cloth_prone',prone)]:
   _apply_sample(rig,pose)
   body=_body_surface(ctx) if name=='cloth_prone' else None
   transforms={bone.name:bone.matrix @ bone.bone.matrix_local.inverted() for bone in rig.pose.bones}
   key=obj.shape_key_add(name=name);key.value=0
   before=[];after=[]
   for index in indices:
    vertex=obj.data.vertices[index]
    skin=Matrix(((0,0,0,0),)*4);total=0
    for group in vertex.groups:
     transform=transforms.get(obj.vertex_groups[group.group].name)
     if transform is None:continue
     skin+=transform*group.weight;total+=group.weight
    if not total:continue
    skin*=1/total
    point=skin @ vertex.co;corrected=point.copy()
    corrected.z=max(.018,point.z)
    if body is not None:
     # A skirt encloses the legs. Its rear panel settles over the prone body,
     # while its front panel rests underneath it at the floor. Apply the same
     # envelope to both faces of the thin cloth shell; a normal-based test
     # would leave its inward-facing copy floating above the visible surface.
     loose=max(0,min(1,(1.025-vertex.co.z)/.16));loose=loose*loose*(3-2*loose)
     # Lay each loose ring across the two posed leg centres. Averaged leg
     # skinning alone can bunch adjacent rows and turn a smooth hem into a
     # shelf. This cross-section remains ordered through knees and ankles.
     t=max(0,min(1,(1.06-vertex.co.z)/.96))
     width=.205 if ctx['preset']=='friar' else .20
     depth=.143 if ctx['preset']=='friar' else .145
     theta=math.atan2((vertex.co.y-.012)/(depth*(1+.18*t)+.028*math.sin(math.pi*t)),vertex.co.x/(width*(1+.47*t)))
     centres=[]
     for side in ('l','r'):
      chain=['thigh_'+side,'calf_'+side,'foot_'+side]
      upper,lower=(chain[:2] if vertex.co.z>=ctx['heads'][chain[1]].z else chain[1:])
      a=ctx['heads'][upper].z;b=ctx['heads'][lower].z;along=max(0,min(1,(a-vertex.co.z)/(a-b)))
      centres.append(rig.pose.bones[upper].head.lerp(rig.pose.bones[lower].head,along))
     centre=(centres[0]+centres[1])*.5
     half_width=abs(centres[0].x-centres[1].x)*.5+.095
     corrected.x=corrected.x*(1-loose)+(centre.x+half_width*math.cos(theta))*loose
     corrected.y=corrected.y*(1-loose)+centre.y*loose
     point.x=corrected.x;point.y=corrected.y
     if vertex.co.y>.012:
      hit,_,_,_=body.ray_cast(Vector((point.x,point.y,1.0)),Vector((0,0,-1)))
      if hit is not None:support=hit.z
      else:
       nearest,_,_,_=body.find_nearest(point)
       distance=math.hypot(nearest.x-point.x,nearest.y-point.y) if nearest is not None else 1
       support=nearest.z*math.exp(-(distance/.065)**2) if nearest is not None else 0
      # A sewn panel spans a small area between mesh samples. Use a local
      # support envelope, not isolated vertex rays that can cut through a
      # convex boot or calf between those samples. This also leaves clearance
      # for the modest leg motion of the adapted crawl cycle.
      for radius in (.022,.044):
       for step in range(8):
        angle=step*math.tau/8
        offset=Vector((radius*math.cos(angle),radius*math.sin(angle),0))
        neighbour,_,_,_=body.ray_cast(Vector((point.x,point.y,1.0))+offset,Vector((0,0,-1)))
        if neighbour is not None:support=max(support,neighbour.z-radius*.30)
      fold=.004+.003*math.sin(vertex.co.x*47+vertex.co.z*31)**2
      settled=max(.018,support+.021+fold)
     else:
      # The lower panel stays outside the leg surface too. Pinning every
      # front vertex to the floor collapsed the same panel into the knees
      # when a fallen actor rolled face-up.
      hit,_,_,_=body.ray_cast(Vector((point.x,point.y,-1.0)),Vector((0,0,1)))
      settled=max(.018,hit.z-.024) if hit is not None else .018

     corrected.z=corrected.z*(1-loose)+settled*loose
    key.data[index].co=skin.inverted_safe() @ corrected
    before.append(point.z);after.append(corrected.z)
   if name=='cloth_prone':
    _relax_cloth(ctx,obj,key,indices,prone)
    _crawl_clearance(ctx,obj,key,indices,crawl_poses)
    _shell_thickness(ctx,obj,key,indices,prone)
   print('CLOTH_CORRECTIVE',name,min(before),max(before),min(after),max(after),flush=True)
  # A face-up body rests on the opposite cloth panel. Reusing the prone
  # target placed its underside 7–10 cm below the ground in the actual bank.
  # Start from the fitted shell, then settle this orientation independently.
  prone_key=obj.data.shape_keys.key_blocks['cloth_prone']
  key=obj.shape_key_add(name='cloth_supine');key.value=0
  for index in indices:key.data[index].co=prone_key.data[index].co.copy()
  _relax_cloth(ctx,obj,key,indices,supine)
  _shell_thickness(ctx,obj,key,indices,supine)
  obj.data.attributes.remove(mask)
 for bone in rig.pose.bones:bone.matrix_basis=basis[bone.name]
 bpy.context.view_layer.update()
