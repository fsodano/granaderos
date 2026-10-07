"""Actual period equipment with independent named held/dropped nodes."""
import math
import bpy
from mathutils import Matrix,Vector
from equipment import create_equipment
from equipment_dimensions import RIFLE_STRETCH,PISTOL_STRETCH,PISTOL_BARREL_OFFSETS

def create_library(ctx):
 create_equipment(ctx);h=ctx['equipment_helpers'];exports=[];records={};weapons=ctx['weapons']
 def clone_tree(source,name,stretch=1):
  parent=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(parent);exports.append(parent)
  for old in source.children:
   o=old.copy()
   if old.data:o.data=old.data.copy()
   bpy.context.collection.objects.link(o);o.parent=parent;o.matrix_basis=old.matrix_basis.copy();o.name=name+'_'+old.name
   # Vertex positions and part centres share the same grip-local length.
   # Scaling only local vertices leaves locks, sights and bands displaced.
   o.location.x*=stretch
   if o.type=='MESH':
    for v in o.data.vertices:v.co.x*=stretch
   exports.append(o)
  return parent
 def record(key,group,category,grip,stow='hipLeft'):
  muzzle=next((o for o in group.children if o.type=='EMPTY' and 'muzzle' in o.name),None)
  if muzzle:muzzle.name='muzzle_'+key
  records[key]={'node':group.name,'category':category,'grip':grip,'socket':'handRight_'+grip,'leftSocket':'handLeft_'+grip,'position':[0,0,0],'rotation':[0,0,0],'scale':1,'stowedSocket':stow,**({'muzzle':muzzle.name} if muzzle else {})}
 for key,scale in RIFLE_STRETCH.items():
  g=clone_tree(weapons['rifle'],'item_'+key,scale)
  # The supplied Escopeta Criolla reference has one bore, matching its
  # capacity-one firearm definition. Its native muzzle stays on that axis.
  if key=='1807':
   for o in g.children:
    if 'Rifle_Barrel' in o.name and 'Band' not in o.name:
     for v in o.data.vertices:
      flare=1+max(0,(v.co.x-.40)/.14)*1.8;v.co.y*=flare;v.co.z=.055+(v.co.z-.055)*flare
  record(key,g,'rifle','rifle','back')
 for key,scale in PISTOL_STRETCH.items():
  g=clone_tree(weapons['pistol'],'item_'+key,scale)
  if key=='1808':
   offsets=PISTOL_BARREL_OFFSETS[key];barrel=next(o for o in g.children if 'Pistol_Barrel' in o.name);barrel.location.y=offsets[0];other=barrel.copy();other.data=barrel.data.copy();other.location.y=offsets[1];bpy.context.collection.objects.link(other);exports.append(other)
  record(key,g,'pistol','pistol','hipRight')
 for key in ('1809','1810','1813','1811'):
  g=clone_tree(weapons['knife'] if key=='1813' else weapons['sabre'],'item_'+key)
  for o in list(g.children):
   if key in ('1813','1811') and any(n in o.name for n in ('Knuckle','Grip_Wire')):
    exports.remove(o);bpy.data.objects.remove(o,do_unlink=True);continue
   if o.type=='MESH':
    for v in o.data.vertices:
     if 'Blade' in o.name:
      if key=='1810':v.co.x*=.45
      if key=='1811':v.co.z*=.58;v.co.x*=.35
  record(key,g,'knife' if key in ('1811','1813') else 'sabre','sabre')
 def fresh(key):
  g=h['group']('item_'+key);g.parent=None;g.matrix_world=Matrix.Identity(4);exports.append(g);return g
 def done(key,g,category='tool',grip='tool'):
  for o in g.children_recursive:
   if o not in exports:exports.append(o)
  record(key,g,category,grip)
 g=fresh('1812');h['tube']('Lance_Shaft',[(0,0,-.8),(0,0,1.85)],[.017,.010],h['walnut'],g,12);h['stock']('Lance_Head',[(1.84,0,.014,.012),(2.05,0,.003,.002)],h['blade'],g)
 # The spearhead is aligned with the long shaft (+Z in Blender).
 tip=next(child for child in g.children if child.name=='Lance_Head')
 for v in tip.data.vertices:v.co=Vector((v.co.y,v.co.z,v.co.x))
 done('1812',g,'lance','sabre')
 g=fresh('ramrod');h['tube']('Loose_Ramrod',[(0,0,-.10),(0,0,.75)],.003,h['steel'],g,8);done('ramrod',g)
 g=fresh('crowbar');h['tube']('Forged_Crowbar',[(0,0,-.12),(0,0,.49),(.06,0,.56)],.012,h['steel'],g,10);done('crowbar',g)
 g=fresh('key');h['tube']('Key_Stem',[(0,0,-.02),(0,0,.08)],.004,h['brass'],g,8);h['box']('Key_Teeth',(.012,0,.072),(.025,.006,.019),h['brass'],g);h['tube']('Key_Bow',[(.018*math.cos(j*math.tau/20),0,-.037+.020*math.sin(j*math.tau/20)) for j in range(21)],.004,h['brass'],g,6);done('key',g)
 g=fresh('lockpick');h['tube']('Lock_Pick',[(0,0,-.06),(0,0,.07),(.014,0,.08)],.0025,h['steel'],g,6);done('lockpick',g)
 g=fresh('pliers')
 for sign in (-1,1):h['tube']('Pliers_Jaw',[(sign*.023,0,-.08),(sign*.006,0,.01),(sign*.014,0,.07)],[.006,.009,.004],h['steel'],g,8)
 done('pliers',g)
 g=fresh('torches');h['tube']('Torch_Wood',[(0,0,-.10),(0,0,.37)],.017,h['walnut'],g,10);h['tube']('Wrapped_Torch',[(0,0,.28),(0,0,.41)],[.025,.032],ctx['M']['cream'],g,12);h['marker']('torch_flame',(0,0,.45),g);done('torches',g,'supply')
 g=fresh('boleadoras')
 for sign in (-1,0,1):
  pts=[(sign*.12*t,0,-.35*t) for t in [0,.25,.5,.75,1]];h['tube']('Bolas_Cord',pts,.003,h['leather'],g,6)
  bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,radius=.031,location=(sign*.12,0,-.35));o=bpy.context.object;o.name='Bolas_Weight';o.parent=g;o.data.materials.append(h['leather'])
 done('boleadoras',g,'supply')
 for key in ('rations','medkits','grenade','ammunition','item'):
  g=fresh(key)
  if key=='grenade':
   bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=10,radius=.048);o=bpy.context.object;o.name='Grenade_Iron';o.parent=g;o.data.materials.append(h['steel']);h['tube']('Grenade_Fuse',[(0,0,.044),(.010,0,.073)],.003,ctx['M']['cream'],g,6)
  else:
   size=(.115,.045,.075) if key=='medkits' else (.073,.037,.095)
   h['box']('Wrapped_'+key,(0,0,.035),size,ctx['M']['cream'] if key=='medkits' else h['leather'],g,.014)
   h['tube']('Package_Tie',[(-size[0]/2,-.025,0),(size[0]/2,-.025,0)],.004,h['walnut'],g,6)
  done(key,g,'supply')
 # Each item becomes one object per material while muzzle/ramrod markers retain
 # exact named transforms. Inventory may clone any item for left hand or ground.
 for key,r in records.items():
  group=bpy.data.objects[r['node']];batches={}
  for o in list(group.children):
   if o.type=='MESH':batches.setdefault(o.data.materials[0].name,[]).append(o)
  for mat,parts in batches.items():
   if len(parts)<2:continue
   bpy.ops.object.select_all(action='DESELECT')
   for o in parts:o.select_set(True)
   bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join()
  for o in group.children:
   for k in list(o.keys()):del o[k]
 exports=[o for r in records.values() for o in [bpy.data.objects[r['node']],*bpy.data.objects[r['node']].children_recursive]]
 ctx['equipment_records']=records;ctx['export_objects']=exports
 return records
