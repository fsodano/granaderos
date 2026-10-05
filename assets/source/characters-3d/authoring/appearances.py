"""Eight campaign appearances fitted to native male/female human anatomy.

Garment surfaces keep the original skeleton and source-derived body weights.
The defaults intentionally share a human size; gameplay owns actor body height.
"""
import math
import bpy
from mathutils import Vector

PRESETS = {
 'granadero':dict(gender='male',title='Granadero',coat=(.017,.025,.044),trousers=(.019,.027,.043),headwear='shako'),
 'royalist':dict(gender='male',title='Realista',coat=(.62,.57,.45),trousers=(.59,.54,.43),headwear='shako'),
 'worker':dict(gender='male',title='Trabajador',coat=(.42,.36,.25),trousers=(.13,.092,.056),headwear=None),
 'surgeon':dict(gender='male',title='Cirujano',coat=(.068,.043,.031),trousers=(.051,.039,.033),headwear=None),
 'gaucho':dict(gender='male',title='Gaucho',coat=(.16,.098,.047),trousers=(.052,.042,.031),headwear='felt-hat'),
 'friar':dict(gender='male',title='Fraile',coat=(.093,.049,.022),trousers=(.093,.049,.022),headwear=None),
 'woman-scout':dict(gender='female',title='Exploradora',coat=(.105,.128,.069),trousers=(.30,.26,.18),headwear=None),
 'woman-shawl':dict(gender='female',title='Mujer con mantón',coat=(.58,.50,.36),trousers=(.105,.025,.035),headwear=None),
}

def apply_appearance(ctx):
 p=ctx['preset']; spec=PRESETS[p];objects=ctx['objects'];M=ctx['M'];mesh=ctx['mesh'];tube=ctx['tube'];ellipsoid=ctx['ellipsoid'];weight=ctx['source_weight_at'];heads=ctx['heads']
 def color(key,value):
  M[key].diffuse_color=(*value,1);M[key].node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(*value,1)
 color('navy',spec['coat']);color('trousers',spec['trousers'])
 def remove(prefixes):
  for o in list(objects):
   if o.name.startswith(tuple(prefixes)):
    objects.remove(o);bpy.data.objects.remove(o,do_unlink=True)
 military=p in ('granadero','royalist')
 if not military:
  remove(['Shaped_Shako','Shako_','Curved_Shako','Red_Shako','Red_Side_Cord','Red_Tassel','Short_Red_Plume','Single_Crossbelt','Crossbelt_Shoulder','Crimson_Epaulette','Red_Epaulette_Fringe','Fine_Collar_Gold','Cuff_Gold','Crimson_Trouser_Seam','Red_Front_Piping'])
  color('red',spec['coat']);color('brass',(.18,.12,.057))
 if p in ('worker','gaucho','friar','woman-scout','woman-shawl'):
  remove(['Wool_Coat_Tail','Brass_Coat_Button','Belt_Brass_Buckle'])
 if p in ('worker','friar','woman-shawl'):
  remove(['White_Waist_Belt'])
 if p=='royalist':
  color('red',(.31,.025,.018));color('cream',(.76,.71,.59))
 # Native fitted human head remains visible. Hair additions are small head-bound
 # geometry, not disconnected oversized heads or a substitute body silhouette.
 if p=='woman-scout':
  for j in range(21):
   t=j/20;center=Vector((.010*math.sin(t*25),.084+.040*t,1.670-.295*t))
   ellipsoid('Braided_Hair',center,(.016*(1-.55*t),.014*(1-.55*t),.020),M['hair'],'head',10,6)
  tube('Braid_Tie',[(-.009,.122,1.400),(.009,.122,1.400)],[.004,.004],M['red'],'head',6)
 elif p=='woman-shawl':
  ellipsoid('Bound_Hair_Bun',(0,.078,1.673),(.047,.037,.042),M['hair'],'head',20,12)
 elif p=='friar':
  # Tonsure exposes source skin across the crown.
  for o in objects:
   if o.name.startswith('Short_Hair'):
    for v in o.data.vertices:
     if v.co.z>1.735:v.co.z-=.012
 # Civilian shirts show a modest open collar and chest placket.
 if p in ('worker','woman-scout','woman-shawl'):
  color('cream',(.64,.56,.40))
  tube('Shirt_Centre_Seam',[(0,-.171,1.43),(0,-.170,1.10)],[.0025,.0025],M['cream'],{'spine_02':.5,'spine_03':.5},6)
  for z in (1.35,1.25,1.15):ellipsoid('Shirt_Button',(0,-.174,z),(.003,.002,.003),M['brass'],{'spine_02':.5,'spine_03':.5},8,6)
 if p=='worker':
  # Waistcoat lies on the native coat surface and follows identical skinning.
  coat=ctx['coat'];vv=[];ff=[];ww=[]
  for v in coat.data.vertices:
   vv.append(v.co+v.normal*.003);ww.append({coat.vertex_groups[g.group].name:g.weight for g in v.groups})
  for f in coat.data.polygons:
   if all(abs(coat.data.vertices[i].co.x)<.19 and 1.005<coat.data.vertices[i].co.z<1.445 for i in f.vertices):ff.append(tuple(f.vertices))
  vestmat=M['trousers'];mesh('Worker_Waistcoat',vv,ff,vestmat,ww)
 if p=='surgeon':
  color('cream',(.67,.60,.45))
  ellipsoid('Linen_Cravat',(0,-.106,1.487),(.029,.020,.029),M['cream'],'neck_01',16,8)
  # Fine spectacles are part of the historical appearance, fitted to face.
  for side in (-1,1):
   center=Vector((side*.031,-.131,1.661));pts=[center+Vector((.024*math.cos(j*math.tau/24),0,.018*math.sin(j*math.tau/24))) for j in range(25)]
   tube('Wire_Spectacles',pts,[.001]*25,M['steel'],'head',5)
  tube('Spectacles_Bridge',[(-.007,-.132,1.664),(.007,-.132,1.664)],[.001,.001],M['steel'],'head',5)
 if p=='gaucho':
  # Poncho shoulder mantle with a neck opening, broad folds and free hem.
  draped('Gaucho_Poncho',ctx,top=1.48,bottom=.89,shoulder=True,material=M['navy'],width=.36,depth=.22)
  color('red',(.31,.026,.020));ellipsoid('Neck_Scarf',(0,-.062,1.496),(.071,.071,.025),M['red'],'neck_01',24,10)
  tube('Scarf_Tails',[(0,-.13,1.48),(.025,-.178,1.35),(.031,-.179,1.30)],[.015,.020,.010],M['red'],{'spine_03':1},8)
  make_hat(ctx)
 if p=='friar':
  draped('Friar_Habit_Skirt',ctx,top=1.07,bottom=.09,shoulder=False,material=M['navy'],width=.205,depth=.143)
  path=[(.184*math.cos(j*math.tau/48),.012+.140*math.sin(j*math.tau/48),1.06) for j in range(49)]
  tube('Rope_Belt',path,[.005]*49,M['cream'],'pelvis',8)
  tube('Rope_Knot_Tails',[(.12,-.13,1.05),(.14,-.14,.87),(.13,-.14,.81)],[.005]*3,M['cream'],'pelvis',8)
  # Hood rests on upper back, open folded cloth, not a second head.
  ellipsoid('Folded_Hood',(0,.127,1.406),(.093,.030,.090),M['navy'],'spine_03',20,12)
 if p=='woman-shawl':
  draped('Long_Skirt',ctx,top=1.06,bottom=.10,shoulder=False,material=M['trousers'],width=.20,depth=.145)
  coat=ctx['coat'];vv=[v.co+v.normal*.009 for v in coat.data.vertices];ww=[{coat.vertex_groups[g.group].name:g.weight for g in v.groups} for v in coat.data.vertices]
  ff=[tuple(f.vertices) for f in coat.data.polygons if all(coat.data.vertices[i].co.z>1.265 for i in f.vertices)]
  mesh('Burgundy_Shawl',vv,ff,M['trousers'],ww)
 # Semantic parts are retained through optimization for optional body equipment.
 for o in objects:
  n=o.name
  o['appearance']=p
  if any(s in n for s in ('Shako','Plume','Tassel','Felt_Hat')):part='headwear'
  elif any(s in n for s in ('Boot','Sole')):part='footwear'
  elif any(s in n for s in ('Breeches','Trouser_Seam','Long_Skirt')):part='legwear'
  elif any(s in n for s in ('Skin','Hair','Eyeball','Iris','Pupil','Eyebrow','Spectacles','Braid')):part='skin'
  else:part='outfit'
  o['part']=part
 ctx['appearance']=spec;ctx['material_roles']={'skin':'Skin','cloth':'Apparel_Atlas','hair':'Apparel_Atlas','metal':'Apparel_Atlas'}

def draped(name,ctx,top,bottom,shoulder,material,width,depth):
 """Radially sampled sewn cloth with a real neck hole and source weight blend."""
 vv=[];ff=[];ww=[];N=64;R=24
 for row in range(R):
  t=row/(R-1);z=top+(bottom-top)*t
  for j in range(N):
   a=j*math.tau/N
   if shoulder:
    ease=min(1,t*8.5);rx=.077+(width-.077)*ease;ry=.085+(depth-.085)*ease
    zz=z-.020*abs(math.cos(a))*math.sin(math.pi*t)
   else:rx=width*(1+.47*t);ry=depth*(1+.63*t);zz=z
   fold=(.007+.010*t)*math.sin(12*a+.25*math.sin(t*math.pi))*(.3+.7*t)
   q=Vector(((rx+fold)*math.cos(a),.012+(ry+fold)*math.sin(a),zz))
   if shoulder:
    outward=Vector((math.cos(a),math.sin(a),0))
    hit,cp,cn,_=ctx['coat'].ray_cast(Vector((0,.012,zz))+outward*.65,-outward)
    if hit and abs(cp.x)<.30 and Vector((cp.x,cp.y-.012,0)).length>Vector((q.x,q.y-.012,0)).length:q=cp+cn*.015
   vv.append(q)
   if shoulder:
    w=dict(ctx['source_weight_at'](q));w={k:v for k,v in w.items() if not k.startswith(('hand','thumb','index','middle','ring','pinky'))}
    if not w:w={'spine_03':1}
   else:
    side='l' if q.x>0 else 'r';leg=min(.85,t*.85);w={'pelvis':1-leg,'thigh_'+side:leg}
   s=sum(w.values());ww.append({k:v/s for k,v in w.items()})
 for row in range(R-1):
  for j in range(N):a=row*N+j;b=row*N+(j+1)%N;ff.append((a,b,b+N,a+N))
 o=ctx['mesh'](name,vv,ff,material,ww)
 # Solidify before the armature; thickness remains when mesh is exported.
 bpy.context.view_layer.objects.active=o
 mod=o.modifiers.new('Sewn_Cloth_Thickness','SOLIDIFY');mod.thickness=.003
 while o.modifiers.find(mod.name)>0:bpy.ops.object.modifier_move_up(modifier=mod.name)
 bpy.ops.object.modifier_apply(modifier=mod.name)
 return o

def make_hat(ctx):
 M=ctx['M'];vv=[];ff=[];N=48
 for z,rx,ry in [(1.71,.092,.106),(1.81,.083,.099),(1.825,.07,.089)]:
  for j in range(N):a=j*math.tau/N;vv.append((rx*math.cos(a),-.045+ry*math.sin(a),z))
 for row in range(2):
  for j in range(N):a=row*N+j;b=row*N+(j+1)%N;ff.append((a,b,b+N,a+N))
 ff.append(tuple(range(2*N,3*N)));ctx['mesh']('Felt_Hat_Crown',vv,ff,M['trousers'],'head')
 vv=[];ff=[]
 for rx,ry in [(.088,.104),(.175,.168)]:
  for j in range(N):a=j*math.tau/N;vv.append((rx*math.cos(a),-.045+ry*math.sin(a),1.716+.015*math.cos(a)**2))
 for j in range(N):ff.append((j,(j+1)%N,(j+1)%N+N,j+N))
 ctx['mesh']('Felt_Hat_Brim',vv,ff,M['trousers'],'head')
