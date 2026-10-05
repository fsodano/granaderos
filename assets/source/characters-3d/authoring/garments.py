"""Owned inventory garments: actual fitted and skinned meshes for both anatomies."""
import bpy
from appearances import draped,make_hat

def create_garments(ctx):
 allobjects=ctx['objects'];before=set(allobjects)
 draped('garment_poncho',ctx,top=1.48,bottom=.89,shoulder=True,material=ctx['M']['trousers'],width=.36,depth=.22)
 for original,name in [(ctx['coat'],'garment_linen_shirt'),(ctx['trousers'],'garment_trousers')]:
  o=original.copy();o.data=original.data.copy();bpy.context.collection.objects.link(o);o.name=name
  o.data.materials.clear();o.data.materials.append(ctx['M']['cream'] if name.endswith('shirt') else ctx['M']['trousers']);allobjects.append(o)
 make_hat(ctx)
 garmentobjects=[o for o in allobjects if o not in before]
 for o in garmentobjects:
  o['part']='garment_hat' if o.name.startswith('Felt_Hat') else o.name
  o['appearance']='owned-garment'
 for o in list(before):bpy.data.objects.remove(o,do_unlink=True)
 ctx['objects']=garmentobjects;ctx['export_objects']=[ctx['rig']]+garmentobjects
 return ctx
