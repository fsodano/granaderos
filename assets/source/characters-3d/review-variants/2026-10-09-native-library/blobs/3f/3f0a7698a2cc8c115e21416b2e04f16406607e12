"""Named item attachment frames derived from the native human hand anatomy."""
import bpy
from mathutils import Matrix,Vector

def create_sockets(ctx):
 from motion import _palm_basis,_hand_rotation
 from firearm_grips import grip_frame
 rig=ctx['rig'];result={};items=[]
 def marker(name,bone_name,matrix):
  bone=rig.data.bones[bone_name]
  o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o)
  o.parent=rig;o.parent_type='BONE';o.parent_bone=bone_name
  o.matrix_parent_inverse=Matrix.Translation((0,-bone.length,0));o.matrix_basis=matrix
  items.append(o);return name
 for side,role in [('r','handRight'),('l','handLeft')]:
  for grip in ('rifle','pistol','sabre','tool'):
   local,h=grip_frame(rig,side,grip,_palm_basis,_hand_rotation,ctx.get('gender'))
   name='socket_'+role+'_'+grip;matrix=Matrix.LocRotScale(local,h.inverted(),Vector((1,1,1)))
   result[role+'_'+grip]={'node':marker(name,'hand_'+side,matrix),'bone':'hand_'+side,'position':[0,0,0],'rotation':[0,0,0],'scale':1}
   if role=='handLeft'and grip=='pistol':
    # Keep the barrel and upper frame symmetric through native hand rolls.
    # glTF uses +Y up, so reverse local Z to restore a proper reflected frame.
    result[role+'_'+grip]['mirror']={'socket':'handRight_pistol','localAxis':'z'}
 for role,bone_name,point,rot in [('back','spine_03',(.09,.19,.84),(0,-1.570796,-.23)),('hipLeft','pelvis',(.18,.01,.99),(3.141593,0,0)),('hipRight','pelvis',(-.18,.01,.99),(0,0,0))]:
  from mathutils import Euler
  matrix=rig.data.bones[bone_name].matrix_local.inverted()@Matrix.LocRotScale(Vector(point),Euler(rot).to_quaternion(),Vector((1,1,1)))
  result[role]={'node':marker('socket_'+role,bone_name,matrix),'bone':bone_name,'position':[0,0,0],'rotation':[0,0,0],'scale':1}
 ctx['socket_objects']=items;ctx['sockets']=result;ctx['export_objects'].extend(items)
 return result
