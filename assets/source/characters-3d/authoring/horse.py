"""CC0 horse by Lyndon Daniels: measured scale, weighted hair/eyes, saddle and gait.

Original source is retained unchanged. All repairs are reproducible here.
"""
from pathlib import Path
import math
import bpy
from mathutils import Vector,Matrix,Quaternion
from mathutils.kdtree import KDTree
NAMES={'Bone':'horse_body','Bone.001':'horse_neck','Bone.002':'horse_head','Bone.001_L':'horse_ear_l','Bone.001_R':'horse_ear_r','Bone_L':'horse_front_upper_l','Bone_L.001':'horse_front_lower_l','Bone_L.002':'horse_front_hoof_l','Bone_R':'horse_front_upper_r','Bone_R.001':'horse_front_lower_r','Bone_R.002':'horse_front_hoof_r','Bone_L.003':'horse_rear_upper_l','Bone_L.004':'horse_rear_lower_l','Bone_L.005':'horse_rear_hoof_l','Bone_R.003':'horse_rear_upper_r','Bone_R.004':'horse_rear_lower_r','Bone_R.005':'horse_rear_hoof_r','Bone.003':'horse_tail_01','Bone.004':'horse_tail_02'}

def create_horse(lod=0):
 path=Path(__file__).resolve().parent/'vendor/horse/riggedHorse.blend'
 with bpy.data.libraries.load(str(path),link=False) as (source,dest):dest.objects=[n for n in source.objects if n in ['Armature','Plane','BezierCurve','BezierCurve.005','Sphere','Sphere.002']]
 imported=[o for o in dest.objects if o]
 for o in imported:bpy.context.collection.objects.link(o)
 bpy.context.view_layer.update()
 oldrig=next(o for o in imported if o.type=='ARMATURE');body=next(o for o in imported if o.name.startswith('Plane'))
 world=[body.matrix_world@v.co for v in body.data.vertices];low=min(p.z for p in world)
 withers=oldrig.matrix_world@oldrig.data.bones['Bone'].tail_local
 withers_top=max(p.z for p in world if abs(p.y-withers.y)<.8)
 scale=1.51/(withers_top-low);centre=(oldrig.matrix_world@oldrig.data.bones['Bone'].head_local).lerp(withers,.5)
 T=Matrix.Scale(scale,4)@Matrix.Translation(Vector((-centre.x,-centre.y,-low)))
 arm=bpy.data.armatures.new('Horse_Armature');rig=bpy.data.objects.new('Horse_Rig',arm);bpy.context.collection.objects.link(rig)
 bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
 for old in oldrig.data.bones:
  b=arm.edit_bones.new(NAMES[old.name]);b.head=T@oldrig.matrix_world@old.head_local;b.tail=T@oldrig.matrix_world@old.tail_local;b.align_roll((oldrig.matrix_world.to_3x3()@old.z_axis).normalized())
 for old in oldrig.data.bones:
  b=arm.edit_bones[NAMES[old.name]]
  if old.parent:b.parent=arm.edit_bones[NAMES[old.parent.name]]
  elif old.name!='Bone':b.parent=arm.edit_bones['horse_body']
 bpy.ops.object.mode_set(mode='OBJECT');objects=[]
 def mat(name,color,rough):
  m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*color,1);p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;return m
 coat=mat('Horse_Coat',(.095,.041,.020),.72);hair=mat('Horse_Mane',(.015,.012,.009),.82);eye=mat('Horse_Eyes',(.006,.005,.003),.20);leather=mat('Saddle_Leather',(.055,.024,.010),.63)
 source_groups={g.index:g.name for g in body.vertex_groups};tree=KDTree(len(body.data.vertices));native=[]
 for v in body.data.vertices:
  point=T@body.matrix_world@v.co;tree.insert(point,v.index)
  w={NAMES[source_groups[g.group]]:g.weight for g in v.groups if source_groups[g.group] in NAMES};total=sum(w.values());native.append({k:v/total for k,v in w.items()} if total else {'horse_body':1})
 tree.balance()
 for old in imported:
  if old.type!='MESH':continue
  data=old.data.copy();coords=[T@old.matrix_world@v.co for v in data.vertices]
  for v,p in zip(data.vertices,coords):v.co=p
  name='Horse_Body' if old==body else 'Horse_Eye' if old.name.startswith('Sphere') else 'Horse_Tail' if old.name=='BezierCurve' else 'Horse_Mane'
  obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);objects.append(obj)
  data.materials.clear();data.materials.append(coat if old==body else eye if 'Eye' in name else hair)
  if old==body:
   data.materials.append(hair)
   for poly in data.polygons:
    if all(data.vertices[i].co.z<.13 for i in poly.vertices):poly.material_index=1
  for f in data.polygons:f.use_smooth=True
  groups={name:obj.vertex_groups.new(name=name) for name in NAMES.values()}
  for v in data.vertices:
   if old==body:w=native[v.index]
   elif 'Eye' in name:w={'horse_head':1}
   elif 'Tail' in name:
    a=arm.bones['horse_tail_01'];b=arm.bones['horse_tail_02'];t=max(0,min(1,(v.co-a.head_local).length/(b.tail_local-a.head_local).length));w={'horse_tail_01':1-t,'horse_tail_02':t}
   else:
    _,i,_=tree.find(v.co);w=native[i]
   for k,vv in w.items():
    if vv>0:groups[k].add([v.index],vv,'REPLACE')
  obj.parent=rig;mod=obj.modifiers.new('Horse_Skin','ARMATURE');mod.object=rig
  if lod:
   bpy.context.view_layer.objects.active=obj;dec=obj.modifiers.new('Horse_LOD','DECIMATE');dec.ratio=(.55 if lod==1 else .25);bpy.ops.object.modifier_move_up(modifier=dec.name);bpy.ops.object.modifier_apply(modifier=dec.name)
 for o in imported:bpy.data.objects.remove(o,do_unlink=True)
 # Seat uses the source back height. Saddle and cloth are genuinely curved.
 bodymesh=next(o for o in objects if o.name=='Horse_Body')
 backz=max(v.co.z for v in bodymesh.data.vertices if abs(v.co.x)<.16 and abs(v.co.y)<.3)
 seat=Vector((0,.02,backz+.04));verts=[];faces=[]
 for j in range(13):
  y=seat.y-.24+j*.04
  for i in range(13):
   x=-.31+i*.052;z=seat.z-.29*(abs(x)/.31)**1.65+.025*math.cos((y-seat.y)*10)
   verts.append((x,y,z))
 for j in range(12):
  for i in range(12):a=j*13+i;faces.append((a,a+1,a+14,a+13))
 d=bpy.data.meshes.new('Saddle');d.from_pydata(verts,[],faces);d.materials.append(leather);o=bpy.data.objects.new('Saddle',d);bpy.context.collection.objects.link(o);o.parent=rig;vg=o.vertex_groups.new(name='horse_body');vg.add(list(range(len(verts))),1,'REPLACE');mod=o.modifiers.new('Horse_Skin','ARMATURE');mod.object=rig;objects.append(o)
 # Tack is separate real geometry, fitted to the measured back/head frames.
 def strap(name,points,radius,mat,bone='horse_body',sides=8):
  vs=[];fs=[];points=[Vector(p) for p in points]
  for j,p in enumerate(points):
   axis=(points[min(j+1,len(points)-1)]-points[max(j-1,0)]).normalized();u=axis.cross(Vector((0,0,1)))
   if u.length<.01:u=axis.cross(Vector((0,1,0)))
   u.normalize();v=axis.cross(u)
   for i in range(sides):a=i*math.tau/sides;vs.append(p+radius*(u*math.cos(a)+v*math.sin(a)))
  for j in range(len(points)-1):
   for i in range(sides):a=j*sides+i;b=j*sides+(i+1)%sides;fs.append((a,b,b+sides,a+sides))
  data=bpy.data.meshes.new(name);data.from_pydata(vs,[],fs);data.materials.append(mat)
  o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);objects.append(o);o.parent=rig
  for f in data.polygons:f.use_smooth=True
  vg=o.vertex_groups.new(name=bone);vg.add(list(range(len(vs))),1,'REPLACE');mod=o.modifiers.new('Horse_Skin','ARMATURE');mod.object=rig
  return o
 for y,rise in [(-.18,.075),(.20,.12)]:
  strap('Saddle_Raised_Edge',[(.24*math.cos(j*math.pi/16),seat.y+y,seat.z+rise-.22*math.cos(j*math.pi/16)**2) for j in range(17)],.025,leather)
  panel=[];faces=[]
  for j in range(17):
   x=.24*math.cos(j*math.pi/16);base=seat.z-.22*math.cos(j*math.pi/16)**2
   panel.extend([(x,seat.y+y,base),(x,seat.y+y,base+rise)])
  for j in range(16):faces.append((2*j,2*j+1,2*j+3,2*j+2))
  d=bpy.data.meshes.new('Saddle_Cantle');d.from_pydata(panel,[],faces);d.materials.append(leather);o=bpy.data.objects.new('Saddle_Cantle',d);bpy.context.collection.objects.link(o);o.parent=rig;g=o.vertex_groups.new(name='horse_body');g.add(list(range(len(panel))),1,'REPLACE');mod=o.modifiers.new('Horse_Skin','ARMATURE');mod.object=rig;objects.append(o)
 for sign in (-1,1):
  strap('Stirrup_Leather',[(sign*.21,seat.y,seat.z),(sign*.32,seat.y,seat.z-.30),(sign*.32,seat.y,seat.z-.49)],.011,leather)
  strap('Iron_Stirrup',[(sign*.32+.047*math.cos(j*math.tau/24),seat.y,seat.z-.52+.070*math.sin(j*math.tau/24)) for j in range(25)],.005,hair)
 head=arm.bones['horse_head'];poll=head.head_local;mouth=poll.lerp(head.tail_local,.81)
 tangent=(head.tail_local-poll).normalized();side=Vector((1,0,0));up=side.cross(tangent).normalized()
 strap('Leather_Noseband',[mouth+.080*math.cos(j*math.tau/32)*side+.078*math.sin(j*math.tau/32)*up for j in range(33)],.006,leather,'horse_head')
 for sign in (-1,1):
  strap('Bridle_Cheek',[mouth+Vector((sign*.082,0,0)),poll+Vector((sign*.12,0,.07)),poll+Vector((0,0,.12))],.006,leather,'horse_head')
  strap('Leather_Rein',[mouth+Vector((sign*.084,0,0)),mouth.lerp(seat,.45)+Vector((sign*.16,0,-.09)),seat+Vector((sign*.13,-.24,.03))],.004,leather)
 socket=bpy.data.objects.new('socket_saddle',None);bpy.context.collection.objects.link(socket);socket.parent=rig;socket.parent_type='BONE';socket.parent_bone='horse_body';socket.matrix_parent_inverse=Matrix.Translation((0,-arm.bones['horse_body'].length,0));socket.matrix_basis=arm.bones['horse_body'].matrix_local.inverted()@Matrix.Translation(seat+Vector((0,0,.045)))
 # Native bone X axes are not sagittal hinges. Express world X in each
 # bone's rest frame; the resulting rotations keep every leg in its own
 # sagittal plane without modifying source joint centres or lengths.
 sagittal={bone.name:(bone.matrix_local.to_3x3().inverted()@Vector((1,0,0))).normalized() for bone in arm.bones}
 hoof_names=[name for name in NAMES.values() if '_hoof_' in name]
 group_names={g.index:g.name for g in bodymesh.vertex_groups}
 markers={name:[] for name in hoof_names}
 for vertex in bodymesh.data.vertices:
  if vertex.co.z>.18:continue
  name=min(hoof_names,key=lambda n:(vertex.co.xy-arm.bones[n].head_local.xy).length)
  weights={group_names[g.group]:g.weight for g in vertex.groups if group_names.get(g.group) in NAMES.values()}
  total=sum(weights.values())
  if total:markers[name].append((vertex.co.copy(),{k:v/total for k,v in weights.items()}))
 assert all(markers.values()),'Every native hoof must have ground-contact markers'
 def evaluate_hooves():
  matrices={bone.name:rig.pose.bones[bone.name].matrix@bone.matrix_local.inverted() for bone in arm.bones}
  result={}
  for name,points in markers.items():
   posed=[sum(((matrices[n]@point)*weight for n,weight in weights.items()),Vector()) for point,weights in points]
   lowest=min(v.z for v in posed);sole=[v for v in posed if v.z<=lowest+.015]
   result[name]=(sum(sole,Vector())/len(sole),lowest)
  return result
 # Two-link sagittal solve, with the native distal segment completing the
 # hoof target. Lateral joint spacing and all native lengths stay fixed.
 rest_sole={name:sum((point for point,w in points if point.z<=min(p.z for p,w in points)+.015),Vector())/sum(point.z<=min(p.z for p,w in points)+.015 for point,w in points) for name,points in markers.items()}
 def rotate_world_x(name,angle):
  bone=arm.bones[name];pb=rig.pose.bones[name]
  head=rig.pose.bones[bone.parent.name].matrix@bone.parent.matrix_local.inverted()@bone.head_local if bone.parent else bone.head_local
  q=Quaternion(Vector((1,0,0)),angle)@bone.matrix_local.to_quaternion()
  pb.matrix=Matrix.LocRotScale(head,q,Vector((1,1,1)))
  bpy.context.view_layer.update()
 def aim_sagittal(name,direction):
  bone=arm.bones[name];rest=bone.tail_local-bone.head_local
  # Rotation around X: angle in the YZ plane, independent of bone roll.
  angle=math.atan2(direction.z,direction.y)-math.atan2(rest.z,rest.y)
  rotate_world_x(name,angle)
 def place_hoof(end,side,target):
  names=['horse_'+end+'_'+part+'_'+side for part in ('upper','lower','hoof')]
  upper,lower,hoof=(arm.bones[n] for n in names)
  hip=rig.pose.bones[names[0]].head.copy();target=Vector(target)
  rest_delta=rest_sole[names[2]]-hoof.head_local
  line=target-hip
  angle=math.atan2(line.z,line.y)-math.atan2(rest_delta.z,rest_delta.y)
  # Source hoof mesh and shank share one bone; this rolls the hoof through
  # contact naturally, without inventing an extra joint or scaling a limb.
  ankle=target-Quaternion(Vector((1,0,0)),angle)@rest_delta
  ankle.x=hoof.head_local.x
  d=Vector((ankle.y-hip.y,ankle.z-hip.z));distance=d.length
  l1=math.sqrt(max(.0001,upper.length**2-(upper.tail_local.x-upper.head_local.x)**2))
  l2=math.sqrt(max(.0001,lower.length**2-(lower.tail_local.x-lower.head_local.x)**2))
  distance=max(abs(l1-l2)+.001,min(l1+l2-.001,distance));d.normalize()
  pole=Vector((-1 if end=='front' else 1,0));pole-=d*pole.dot(d);pole.normalize()
  along=(l1*l1-l2*l2+distance*distance)/(2*distance)
  joint=d*along+pole*math.sqrt(max(0,l1*l1-along*along))
  knee=Vector((upper.tail_local.x,hip.y+joint.x,hip.z+joint.y))
  ankle=Vector((hoof.head_local.x,hip.y+d.x*distance,hip.z+d.y*distance))
  aim_sagittal(names[0],knee-hip);aim_sagittal(names[1],ankle-knee);rotate_world_x(names[2],angle)
 clips=[];scene=bpy.context.scene;scene.render.fps=30
 for name,duration,amplitude in [('HorseIdle',2.4,.015),('HorseWalk',1.1,.28),('HorseRun',.72,.52)]:
  action=bpy.data.actions.new(name);rig.animation_data_create();rig.animation_data.action=action
  frames=round(duration*30);duration=frames/30;contacts=[]
  for f in range(frames+1):
   t=f/frames;phase=t*math.tau
   for bone in rig.pose.bones:bone.rotation_mode='QUATERNION';bone.rotation_quaternion=Quaternion();bone.location=(0,0,0)
   rig.pose.bones['horse_neck'].rotation_quaternion=Quaternion(sagittal['horse_neck'],.025*math.sin(phase))
   tail=rig.pose.bones['horse_tail_01'];tail.rotation_quaternion=Quaternion(tail.bone.matrix_local.to_3x3().inverted()@Vector((0,0,1)),.05*math.sin(phase))
   if name!='HorseIdle':
    root=rig.pose.bones['horse_body'];root.matrix=Matrix.Translation((0,0,-.065))@root.matrix
    bpy.context.view_layer.update()
    duty=.65 if name=='HorseWalk' else .5;stroke=.72 if name=='HorseWalk' else 1.02;lift=.13 if name=='HorseWalk' else .22
    for end in ('front','rear'):
     for side in ('l','r'):
      # Actual stance contacts travel rearward at a constant speed. The
      # return stroke lifts the hoof and uses a smooth ease at touchdown.
      offset=(0 if side=='l' else .5)+(.25 if end=='rear' and name=='HorseWalk' else .5 if end=='rear' else 0)
      cycle=(t+offset)%1;target=rest_sole['horse_'+end+'_hoof_'+side].copy()
      if cycle<duty:
       phase=cycle/duty;target.y+=stroke*(phase-.5);target.z=.004
      else:
       phase=(cycle-duty)/(1-duty);ease=phase*phase*(3-2*phase);target.y+=stroke*(.5-ease);target.z=.004+lift*math.sin(math.pi*phase)
      place_hoof(end,side,target)
   bpy.context.view_layer.update()
   hooves=evaluate_hooves();low=min(v[1]for v in hooves.values())
   root=rig.pose.bones['horse_body'];root.matrix=Matrix.Translation((0,0,.004-low))@root.matrix
   bpy.context.view_layer.update();contacts.append(evaluate_hooves())
   for bone in rig.pose.bones:
    bone.keyframe_insert('rotation_quaternion',frame=f+1,group=bone.name)
    bone.keyframe_insert('location',frame=f+1,group=bone.name)
  # Measure the actual sole-marker path during low backward contact, rather
  # than infer stride from a bone angle or a desired game travel speed.
  velocities=[]
  for f in range(1,frames):
   for hoof in hoof_names:
    a=contacts[f-1][hoof][0];p,z=contacts[f][hoof];b=contacts[f+1][hoof][0]
    velocity=(b.y-a.y)*15
    if z<.045 and velocity>.03:velocities.append(velocity)
  velocities.sort();speed=velocities[len(velocities)//2] if velocities else 0
  if name!='HorseIdle':assert speed>.05,'No measurable planted-hoof stride: '+name
  track=rig.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,1,action);rig.animation_data.action=None
  clips.append({'name':name,'duration':duration,'loop':True,'locomotionSpeed':round(speed,5),'strideDistance':round(speed*duration,5),'strideMeasurement':'median rearward sole velocity below 4.5 cm','gait':'idle'if name=='HorseIdle'else'walk'if name=='HorseWalk'else'trot','nativeBoneCount':len(arm.bones)})
 for track in rig.animation_data.nla_tracks:track.mute=False
 return {'rig':rig,'objects':objects,'export_objects':[rig]+objects+[socket],'materials':{'coat':coat},'clips':clips,'saddle':{'node':'socket_saddle','position':[0,round(seat.z+.045,5),-seat.y]},'height':1.51,'sourceScale':scale}
