"""Small authored cloth corrections on the existing native human skeleton.

The two shapes keep long hems above the floor and let cloth lie over prone
legs. They are exported after LOD optimization, with no extra bones or clocks.
"""
import math
import bpy
from mathutils import Matrix


def add_cloth_correctives(ctx):
 if ctx['preset'] not in ('friar','woman-shawl'):return
 from motion import _collect,_apply_sample,_prone_pose,_retarget_samples,_root_shift,_leg_ik,_aim
 rig=ctx['rig'];saved=_collect(rig);basis={bone.name:bone.matrix_basis.copy() for bone in rig.pose.bones}
 # These are the same adapted native postures used by the animation bank.
 prone=_prone_pose(ctx,saved)
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
    if name=='cloth_prone' and corrected.z>.27:
     # Cloth rests over the 20.5 cm pelvis and low legs. Preserve rounded folds
     # rather than leaving the original circular section rigid in the air.
     corrected.z=.27+.04*(1-math.exp(-(corrected.z-.27)/.04))
    key.data[index].co=skin.inverted_safe() @ corrected
    before.append(point.z);after.append(corrected.z)
   print('CLOTH_CORRECTIVE',name,min(before),max(before),min(after),max(after),flush=True)
  obj.data.attributes.remove(mask)
 for bone in rig.pose.bones:bone.matrix_basis=basis[bone.name]
 bpy.context.view_layer.update()
