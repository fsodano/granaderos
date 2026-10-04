"""A human-proportioned Granadero built on the unmodified MakeHuman anatomy.

Only uniform meshes are expanded for cloth clearance. The body, source joint
centres, source weights and all limb lengths keep the native adult proportions.
Source assets and their CC0 provenance are in vendor/makehuman.
"""
from pathlib import Path
import json
import math
import bpy
import bmesh
from mathutils import Vector, Matrix
from mathutils.kdtree import KDTree

VENDOR = Path(__file__).resolve().parent / 'vendor' / 'makehuman'

def create_character(preset="granadero", height=1.76):
    from appearances import PRESETS, apply_appearance
    appearance = PRESETS[preset]
    gender = appearance["gender"]
    vertices, uvs, faces = [], [], []
    active_group = ''
    for line in (VENDOR / 'base.obj').read_text().splitlines():
        f = line.split()
        if not f: continue
        if f[0] == 'v': vertices.append(Vector(tuple(map(float, f[1:4]))))
        elif f[0] == 'vt': uvs.append(tuple(map(float, f[1:3])))
        elif f[0] == 'g': active_group = f[1]
        elif f[0] == 'f' and active_group == 'body':
            faces.append([(int(a.split('/')[0])-1, int(a.split('/')[1])-1) for a in f[1:]])
    for line in (VENDOR / ('caucasian-'+gender+'-young.target')).read_text().splitlines():
        f = line.split()
        if len(f) == 4 and f[0].isdigit(): vertices[int(f[0])] += Vector(tuple(map(float, f[1:])))
    used = set(i for face in faces for i, uv in face)
    ymin = min(vertices[i].y for i in used)
    scale = height / (max(vertices[i].y for i in used)-ymin)
    points = [Vector((p.x*scale, -p.z*scale, (p.y-ymin)*scale)) for p in vertices]
    groups = json.loads((VENDOR / 'basemesh_vertex_groups.json').read_text())
    source_rig = json.loads((VENDOR / 'rig.game_engine.json').read_text())
    source_weights = json.loads((VENDOR / 'weights.game_engine.json').read_text())['weights']
    assignments = {i:{} for i in used}
    for bone, weights in source_weights.items():
        for i, weight in weights:
            if i in assignments: assignments[i][bone] = weight
    for i, w in assignments.items():
        total = sum(w.values())
        assignments[i] = {k:v/total for k,v in w.items()} if total else {'pelvis':1}
    def joint(spec):
        ids = spec.get('vertex_indices')
        if ids is None: ids = [i for a,b in groups[spec['cube_name']] for i in range(a,b+1)]
        return sum((points[i] for i in ids), Vector()) / len(ids)

    arm = bpy.data.armatures.new('Native_Human_Armature')
    rig = bpy.data.objects.new('Granadero_Rig', arm)
    bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    for name, spec in source_rig.items():
        bone = arm.edit_bones.new(name)
        bone.head, bone.tail = joint(spec['head']), joint(spec['tail'])
        if (bone.tail-bone.head).length < 1e-5: bone.tail.z += .01
        bone.roll = spec['roll']
        bone.use_deform = name != 'Root'
    for name, spec in source_rig.items():
        if spec['parent']:
            arm.edit_bones[name].parent = arm.edit_bones[spec['parent']]
        arm.edit_bones[name].use_connect = False
    bpy.ops.object.mode_set(mode='OBJECT')
    heads = {b.name:b.head_local.copy() for b in arm.bones}
    tails = {b.name:b.tail_local.copy() for b in arm.bones}
    rest = {b.name:b.matrix_local.copy() for b in arm.bones}
    for p in rig.pose.bones: p.rotation_mode = 'QUATERNION'
    objects = []
    mats = {}
    def material(name, rgba, rough=.75, metallic=0):
        m=bpy.data.materials.new(name); m.diffuse_color=(*rgba,1);m.use_nodes=True
        p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*rgba,1)
        p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metallic
        return m
    mats['skin']=material('Skin',(.49,.29,.18),.78)
    # The neutral diffuse texture allows the viewer to choose a skin palette.
    shader=mats['skin'].node_tree.nodes.get('Principled BSDF')
    tex=mats['skin'].node_tree.nodes.new('ShaderNodeTexImage')
    tex.image=bpy.data.images.load(str(VENDOR/'skin-detail-neutral.png'),check_existing=True);tex.image.pack()
    tint=mats['skin'].node_tree.nodes.new('ShaderNodeMixRGB');tint.blend_type='MULTIPLY';tint.inputs[0].default_value=1;tint.inputs[2].default_value=(.49,.29,.18,1)
    mats['skin'].node_tree.links.new(tex.outputs['Color'],tint.inputs[1]);mats['skin'].node_tree.links.new(tint.outputs['Color'],shader.inputs['Base Color'])
    normaltex=mats['skin'].node_tree.nodes.new('ShaderNodeTexImage')
    normaltex.image=bpy.data.images.load(str(VENDOR/'skin-normal-1024.png'),check_existing=True)
    normaltex.image.colorspace_settings.name='Non-Color';normaltex.image.pack()
    normal=mats['skin'].node_tree.nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.28
    mats['skin'].node_tree.links.new(normaltex.outputs['Color'],normal.inputs['Color'])
    mats['skin'].node_tree.links.new(normal.outputs['Normal'],shader.inputs['Normal'])
    mats['navy']=material('Navy_Wool',(.017,.025,.044),.88)
    mats['trousers']=material('Navy_Trousers',(.019,.027,.043),.91)
    mats['red']=material('Crimson_Facings',(.32,.012,.021),.84)
    mats['cream']=material('Cream_Crossbelts',(.69,.68,.57),.66)
    mats['leather']=material('Boot_Leather',(.012,.011,.010),.45)
    mats['black']=material('Shako_Felt',(.009,.011,.017),.88)
    mats['brass']=material('Aged_Brass',(.48,.30,.064),.33,.72)
    mats['steel']=material('Steel',(.38,.41,.44),.3,.8)
    mats['hair']=material('Brown_Hair',(.027,.013,.008),.93)
    mats['eye']=material('Eye_White',(.56,.51,.44),.28)
    mats['iris']=material('Iris',(.074,.047,.019),.35)
    mats['pupil']=material('Pupil',(.004,.003,.003),.23)
    mats['wood']=material('Walnut',(.10,.040,.016),.7)
    fabric=bpy.data.images.new('Fine_Woven_Wool_Normal',256,256)
    fabric.colorspace_settings.name='Non-Color'
    pixels=[]
    for yy in range(256):
        for xx in range(256):
            nx=.12*math.sin(xx*math.pi/2)+.025*math.sin(xx*13.3+yy*4.3)
            ny=.12*math.sin(yy*math.pi/2)+.025*math.sin(yy*11.3+xx*5.3)
            nz=math.sqrt(max(0,1-nx*nx-ny*ny));pixels.extend(((nx+1)/2,(ny+1)/2,(nz+1)/2,1))
    fabric.pixels.foreach_set(pixels);fabric.update();fabric.pack()
    for key in ('navy','trousers','red'):
        mat=mats[key];p=mat.node_tree.nodes.get('Principled BSDF')
        t=mat.node_tree.nodes.new('ShaderNodeTexImage');t.image=fabric
        n=mat.node_tree.nodes.new('ShaderNodeNormalMap');n.inputs['Strength'].default_value=.22
        mat.node_tree.links.new(t.outputs['Color'],n.inputs['Color']);mat.node_tree.links.new(n.outputs['Normal'],p.inputs['Normal'])
    def mesh(name, coords, polygons, mat, weights=None, uv_coords=None):
        data=bpy.data.meshes.new(name);data.from_pydata(coords,[],polygons);data.update()
        obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);objects.append(obj)
        if mat: data.materials.append(mat)
        for p in data.polygons:p.use_smooth=True
        if uv_coords:
            uv=data.uv_layers.new(name='UVMap')
            for p, polyuv in zip(data.polygons,uv_coords):
                for loop, coord in zip(p.loop_indices,polyuv):uv.data[loop].uv=coord
        if weights is not None:
            if isinstance(weights,str):weights=[{weights:1}]*len(coords)
            if isinstance(weights,dict):weights=[weights]*len(coords)
            names=set(k for w in weights for k in w)
            vg={k:obj.vertex_groups.new(name=k) for k in names}
            for i,w in enumerate(weights):
                for k,v in w.items():
                    if v>1e-7:vg[k].add([i],v,'REPLACE')
            mod=obj.modifiers.new('Native_Skeleton','ARMATURE');mod.object=rig
            obj.parent=rig
        return obj
    def subset(name, filter_face, mat, offset=0):
        fs=[f for f in faces if filter_face(f)]
        ids=sorted(set(i for f in fs for i,uv in f));idx={v:i for i,v in enumerate(ids)}
        obj=mesh(name,[points[i] for i in ids],[[idx[i] for i,uv in f] for f in fs],mat,[assignments[i] for i in ids],[[uvs[uv] for i,uv in f] for f in fs])
        obj['source_vertex_indices']=ids
        if offset:
            for v in obj.data.vertices:v.co+=v.normal*offset
            obj.data.update()
        return obj
    def smooth(obj, iterations=5, factor=.6):
        bpy.context.view_layer.objects.active=obj
        mod=obj.modifiers.new('Cloth_Relaxation','SMOOTH');mod.factor=factor;mod.iterations=iterations
        # Work on rest coordinates; the rig remains last in the stack.
        while obj.modifiers.find(mod.name)>0:bpy.ops.object.modifier_move_up(modifier=mod.name)
        bpy.ops.object.modifier_apply(modifier=mod.name)
        obj.data.update()
    def subdiv(obj,levels=1):
        bpy.context.view_layer.objects.active=obj
        mod=obj.modifiers.new('Tailored_Surface','SUBSURF');mod.levels=levels
        while obj.modifiers.find(mod.name)>0:bpy.ops.object.modifier_move_up(modifier=mod.name)
        bpy.ops.object.modifier_apply(modifier=mod.name)
    def ellipsoid(name,center,radii,mat,weight,segments=20,rings=12,rotation=None):
        coords=[];poly=[]
        for j in range(rings+1):
            a=math.pi*j/rings
            for i in range(segments):
                t=math.tau*i/segments;p=Vector((radii[0]*math.sin(a)*math.cos(t),radii[1]*math.sin(a)*math.sin(t),radii[2]*math.cos(a)))
                if rotation:p=rotation@p
                coords.append(Vector(center)+p)
        for j in range(rings):
            for i in range(segments):a=j*segments+i;b=j*segments+(i+1)%segments;poly.append((a,b,b+segments,a+segments))
        return mesh(name,coords,poly,mat,weight)
    def tube(name,centers,radii,mat,weight,segments=12,caps=True):
        coords=[];polys=[]
        for j,c in enumerate(centers):
            direction=Vector(centers[min(j+1,len(centers)-1)])-Vector(centers[max(j-1,0)])
            direction.normalize();u=direction.cross(Vector((0,0,1)))
            if u.length<.01:u=direction.cross(Vector((0,1,0)))
            u.normalize();v=direction.cross(u).normalized()
            for i in range(segments):
                t=math.tau*i/segments;coords.append(Vector(c)+radii[j]*(math.cos(t)*u+math.sin(t)*v))
        for j in range(len(centers)-1):
            for i in range(segments):a=j*segments+i;b=j*segments+(i+1)%segments;polys.append((a,b,b+segments,a+segments))
        if caps:polys.extend([tuple(range(segments-1,-1,-1)),tuple((len(centers)-1)*segments+i for i in range(segments))])
        return mesh(name,coords,polys,mat,weight)
    def source_weight_at(point):
        _,i,_=tree.find(point);return assignments[i]
    tree=KDTree(len(used))
    for i in used:tree.insert(points[i],i)
    tree.balance()
    skin=subset('Exposed_Human_Skin',lambda f:all((points[i].z>1.495 and abs(points[i].x)<.13) or sum(v for k,v in assignments[i].items() if k.startswith(('hand_','thumb_','index_','middle_','ring_','pinky_')))>.24 or min((points[i]-heads['hand_l']).length,(points[i]-heads['hand_r']).length)<.135 for i,uv in f),mats['skin'])
    subdiv(skin,1)
    # Neck and hands keep original human anatomy. Smooth wool bridges muscle
    # landmarks without changing the skeleton or narrowing any body axis.
    arm_bones={'upperarm_l','upperarm_r','lowerarm_l','lowerarm_r'}
    hand_bones={k for k in source_weights if k.startswith(('hand_','thumb_','index_','middle_','ring_','pinky_'))}
    def limb_weight(i,names):return sum(v for k,v in assignments[i].items() if k in names)
    coat=subset('Tailored_Coat',lambda f:all((.985<points[i].z<1.525 or limb_weight(i,arm_bones)>.35) and limb_weight(i,hand_bones)<.32 for i,uv in f),mats['navy'])
    smooth(coat,14,.62)
    for v in coat.data.vertices:
        p=v.co.copy();normal=v.normal.copy()
        waist=math.exp(-((p.z-1.045)/.10)**2)
        elbow=min((p-heads['lowerarm_l']).length,(p-heads['lowerarm_r']).length)
        fold=.0035*math.sin(elbow*125)*math.exp(-((elbow-.055)/.065)**2)
        fold+=.0020*math.sin(p.z*120+p.x*33)*waist
        v.co+=normal*(.017+fold)
        if abs(p.x)<.160 and 1.065<p.z<1.405 and p.y<-.052:
            front=-.122-.032*math.sin(math.pi*(p.z-1.04)/.43)*math.sqrt(max(0,1-(p.x/.25)**2))
            if gender == 'female':front-=.032*math.exp(-((abs(p.x)-.071)/.060)**2-((p.z-1.318)/.085)**2)
            blend=max(0,min(1,(.166-abs(p.x))/.027))*max(0,min(1,(p.z-1.065)/.035,(1.405-p.z)/.035))
            v.co.y=v.co.y*(1-blend)+(front+.003*math.sin(p.z*110+p.x*29)*waist)*blend
    if gender == 'female':
        for v in coat.data.vertices:
            p=v.co.copy()
            if abs(p.x)<.18 and 1.12<p.z<1.475 and p.y<-.045:
                front=-.133-.038*math.exp(-((abs(p.x)-.071)/.073)**2-((p.z-1.379)/.096)**2)
                blend=min(1,(.18-abs(p.x))/.02,(p.z-1.12)/.025,(1.475-p.z)/.020)
                v.co.y=p.y*(1-blend)+front*blend
    for suffix in ('l','r'):
        wrist=heads['hand_'+suffix];axis=(wrist-heads['lowerarm_'+suffix]).normalized()
        for v in coat.data.vertices:
            delta=v.co-wrist;d=delta.dot(axis);radial=delta-axis*d
            if -.085<d<.025 and radial.length<.085:
                maxradius=.032+.007*max(0,min(1,-d/.085))
                if radial.length>maxradius:v.co=wrist+axis*d+radial.normalized()*maxradius
    coat.data.update()
    bm=bmesh.new();bm.from_mesh(coat.data)
    for v in bm.verts:
        if v.is_boundary and v.co.z>1.46 and abs(v.co.x)<.12: v.co.z=1.508
    bm.to_mesh(coat.data);bm.free();coat.data.update();subdiv(coat,1)
    # Breeches follow native thigh, knee and pelvis topology with cloth ease.
    trousers=subset('Tailored_Breeches',lambda f:all(.425<points[i].z<1.055 and limb_weight(i,hand_bones|arm_bones)<.05 for i,uv in f),mats['trousers'])
    smooth(trousers,7,.64)
    for v in trousers.data.vertices:
        p=v.co.copy();ease=(.016+.014*math.exp(-((p.z-.82)/.17)**2))*max(0,min(1,(p.z-.455)/.105))+.002
        fold=.0060*math.sin(p.z*115+p.x*24)*math.exp(-((p.z-.54)/.095)**2)
        v.co+=v.normal*(ease+fold)
        # Cloth passes over the fly instead of tracing anatomical detail.
        if abs(v.co.x)<.06 and .80<v.co.z<.99 and v.co.y<-.072:v.co.y=max(v.co.y,-.122)
    trousers.data.update();subdiv(trousers,1)
    # Narrow crimson outer seams on the breeches follow their actual surface.
    for suffix,sign in [('l',1),('r',-1)]:
        sv=[];sw=[];sf=[]
        for j in range(29):
            z=.480+.548*j/28
            for dy in (-.006,.006):
                y=.010+dy
                hit,p,n,_=trousers.ray_cast(Vector((sign*1,y,z)),Vector((-sign,0,0)))
                if not hit:p=Vector((sign*.19,y,z));n=Vector((sign,0,0))
                p+=n*.0025;sv.append(p);sw.append(source_weight_at(p))
        for j in range(28):sf.append((j*2,j*2+1,j*2+3,j*2+2))
        mesh('Crimson_Trouser_Seam_'+suffix,sv,sf,mats['red'],sw)
    # Leather is fitted to the actual human feet and lower legs. Rounded toes,
    # narrow ankles and calf contours survive the boot surface construction.
    boots=[]
    for suffix,sign in [('l',1),('r',-1)]:
        boot=subset('Fitted_Boot_'+suffix,lambda f,s=sign:all(.060<points[i].z<.490 and points[i].x*s>0 for i,uv in f),mats['leather'])
        smooth(boot,2,.40)
        for v in boot.data.vertices:
            p=v.co.copy();ankle=heads['foot_'+suffix]
            wrinkle=.0028*math.sin(p.z*145+p.y*29)*math.exp(-((p.z-.12)/.05)**2)
            clearance=.009+wrinkle
            v.co+=v.normal*clearance
            if p.z<.035:v.co.z=max(.007,p.z*.65)
        boot.data.update();subdiv(boot,1);boots.append(boot)
        # Shoe lasts use human foot dimensions, with a closed rounded toe cap.
        # Individual toe topology must not imprint through leather.
        cx=heads['foot_'+suffix].x
        shoe_sections=[(.057,.005,.025,.060),(.047,.030,.017,.073),(.014,.042,.015,.108),(-.035,.045,.015,.117),(-.083,.045,.014,.092),(-.139,.049,.014,.067),(-.192,.044,.014,.052),(-.226,.030,.017,.043),(-.244,.003,.023,.034)]
        shoev=[];shoef=[];shoe_weights=[]
        for y,rx,lo,hi in shoe_sections:
            for j in range(24):
                a=math.tau*j/24
                shoev.append((cx+rx*math.cos(a),y,(lo+hi)/2+(hi-lo)/2*math.sin(a)))
                shoe_weights.append({'foot_'+suffix:1})
        for row in range(len(shoe_sections)-1):
            for j in range(24):a=row*24+j;b=row*24+(j+1)%24;shoef.append((a,b,b+24,a+24))
        shoef.extend([tuple(range(23,-1,-1)),tuple((len(shoe_sections)-1)*24+j for j in range(24))])
        shoe=mesh('Rounded_Boot_Foot_'+suffix,shoev,shoef,mats['leather'],shoe_weights);subdiv(shoe,1)
        # Sole has the same plan shape as the upper, with a low boot heel.
        outline=[]
        for n in range(48):
            a=math.tau*n/48
            width=.048 if math.sin(a)<-.2 else .039
            outline.append(Vector((cx+width*math.cos(a),-.094+.151*math.sin(a),.007)))
        sv=[tuple(p+Vector((0,0,z))) for z in (0,.011) for p in outline]
        sf=[(n,(n+1)%48,(n+1)%48+48,n+48) for n in range(48)]+[tuple(range(48,96))]
        mesh('Boot_Sole_'+suffix,sv,sf,mats['leather'],'foot_'+suffix)
    # Decorations copy the nearest actual coat vertex weights, so they follow
    # the same deformed cloth surface when shoulders and elbows move.
    coat_tree=KDTree(len(coat.data.vertices))
    for vertex in coat.data.vertices:coat_tree.insert(vertex.co,vertex.index)
    coat_tree.balance()
    def coat_weight_at(point):
        _,index,_=coat_tree.find(point)
        weights={coat.vertex_groups[g.group].name:g.weight for g in coat.data.vertices[index].groups if g.weight>1e-7}
        total=sum(weights.values())
        return {name:value/total for name,value in weights.items()} if total else source_weight_at(point)
    # Surface query gives every strap/button the same fit and weights as cloth.
    def surface(x,z,back=False,clearance=.004):
        origin=Vector((x,1 if back else -1,z));direction=Vector((0,-1 if back else 1,0))
        hit,p,n,face=coat.ray_cast(origin,direction)
        if hit:return p+n*clearance
        fitted,index,_=coat_tree.find(Vector((x,.12 if back else -.15,z)))
        return fitted+coat.data.vertices[index].normal*clearance
    def ribbon(name,path,width,mat,back=False,weights=None):
        coords=[];poly=[];ws=[]
        for j,p in enumerate(path):
            p=Vector(p);d=Vector(path[min(j+1,len(path)-1)])-Vector(path[max(j-1,0)])
            side=Vector((d.z,0,-d.x)).normalized()*width/2
            for sign in (-1,1):
                q=p+side*sign
                if abs(d.z)>.01:q=surface(q.x,q.z,back,.007)
                coords.append(q);ws.append(weights or coat_weight_at(q))
        for j in range(len(path)-1):poly.append((2*j,2*j+1,2*j+3,2*j+2))
        obj=mesh(name,coords,poly,mat,ws)
        solid=obj.modifiers.new('Leather_Thickness','SOLIDIFY');solid.thickness=.003
        bpy.context.view_layer.objects.active=obj
        while obj.modifiers.find(solid.name)>0:bpy.ops.object.modifier_move_up(modifier=solid.name)
        bpy.ops.object.modifier_apply(modifier=solid.name)
        return obj
    for back in (False,True):
        path=[surface(.144-.266*(j/32),1.435-.389*(j/32),back) for j in range(33)]
        ribbon('Single_Crossbelt_Back' if back else 'Single_Crossbelt_Front',path,.043,mats['cream'],back)
    # Top of the strap wraps the shoulder instead of ending on the chest.
    across=[]
    for j in range(17):
        y=-.101+.211*j/16
        hit,p,n,_=coat.ray_cast(Vector((.144,y,1.8)),Vector((0,0,-1)))
        if hit:across.append(p+n*.006)
        else:
            fitted,index,_=coat_tree.find(Vector((.144,y,1.455)))
            across.append(fitted+coat.data.vertices[index].normal*.006)
    coords=[]
    for p in across:
        for sign in (-1,1):
            q=p+Vector((sign*.021,0,0))
            hit,fitted,n,_=coat.ray_cast(Vector((q.x,q.y,1.9)),Vector((0,0,-1)))
            if hit:coords.append(fitted+n*.006)
            else:
                fitted,index,_=coat_tree.find(q)
                coords.append(fitted+coat.data.vertices[index].normal*.006)
    mesh('Crossbelt_Shoulder',coords,[(2*j,2*j+1,2*j+3,2*j+2) for j in range(16)],mats['cream'],[coat_weight_at(p) for p in coords])
    # Belt and hip coat skirt are generated from cross-sections of the torso.
    def ring_at(z,clearance=.005):
        result=[]
        for j in range(64):
            a=math.tau*j/64;n=Vector((math.cos(a),math.sin(a),0))
            hit,p,nn,_=coat.ray_cast(Vector((0,.012,z))+n*.285, -n)
            result.append(p+nn*clearance if hit else Vector((.16*n.x,.012+.118*n.y,z)))
        return result
    beltlo,belthi=ring_at(1.039,.009),ring_at(1.072,.009)
    mesh('White_Waist_Belt',beltlo+belthi,[(j,(j+1)%64,(j+1)%64+64,j+64) for j in range(64)],mats['cream'],[coat_weight_at(p) for p in beltlo+belthi])
    buckle=surface(0,1.055,False,.019)
    ellipsoid('Belt_Brass_Buckle',buckle,(.026,.005,.019),mats['brass'],coat_weight_at(buckle),20,8)
    # Two button columns and edge piping keep the front readable at small scale.
    for sign in (-1,1):
        path=[]
        for z in (1.105,1.175,1.245,1.315,1.385):
            x=sign*(.071+.033*(z-1.105)/.28);p=surface(x,z,False,.007);path.append(p)
            ellipsoid('Brass_Coat_Button',p,(.0055,.003,.0055),mats['brass'],coat_weight_at(p),12,8)
        ribbon('Red_Front_Piping',path,.0018,mats['red'])
    # Rear tails end above the knee; blend pelvis/thigh weights prevents rigid
    # planks crossing the legs while the soldier walks.
    waist_ring=ring_at(1.035,.003)
    for sign in (-1,1):
        cv=[];cw=[];rows=11;columns=9
        for j in range(rows):
            t=j/(rows-1)
            for k in range(columns):
                s=k/(columns-1)
                x=sign*(.010+.148*s)*(1+.045*t)
                z=1.038-.340*t+.045*(s**2)*t
                y=.114+.019*math.sin(math.pi*s)+.038*t+.010*math.sin(s*math.tau)*t
                p=Vector((x,y,z));cv.append(p)
                leg='thigh_l' if sign>0 else 'thigh_r';cw.append({'pelvis':1-.60*t,leg:.60*t})
        cp=[(j*columns+k,j*columns+k+1,(j+1)*columns+k+1,(j+1)*columns+k) for j in range(rows-1) for k in range(columns-1)]
        tail=mesh('Wool_Coat_Tail_'+str(sign),cv,cp,mats['navy'],cw)
        solid=tail.modifiers.new('Wool_Thickness','SOLIDIFY');solid.thickness=.004
        bpy.context.view_layer.objects.active=tail
        while tail.modifiers.find(solid.name)>0:bpy.ops.object.modifier_move_up(modifier=solid.name)
        bpy.ops.object.modifier_apply(modifier=solid.name)
    # Collar follows the native neck, with open front edges below the jaw.
    collarv=[];collarf=[]
    for row,z in enumerate((1.480,1.510,1.533)):
        for j in range(48):
            a=math.tau*j/48
            radiusx=.068 if row<2 else .062;radiusy=.078 if row<2 else .072
            collarv.append((radiusx*math.cos(a),-.036+radiusy*math.sin(a),z))
    for row in range(2):
        for j in range(48):a=row*48+j;b=row*48+(j+1)%48;collarf.append((a,b,b+48,a+48))
    mesh('Crimson_Collar',collarv,collarf,mats['red'],'neck_01')
    collar_top=[Vector((.062*math.cos(j*math.tau/48),-.036+.072*math.sin(j*math.tau/48),1.534)) for j in range(49)]
    tube('Fine_Collar_Gold_Edge',collar_top,[.0015]*49,mats['brass'],'neck_01',6)
    # Cuffs use the source sleeve surface, not separate oversized wrist tubes.
    if gender == 'female':
        for v in coat.data.vertices:
            p=v.co.copy()
            if abs(p.x)<.18 and 1.12<p.z<1.475 and p.y<-.045:
                front=-.133-.038*math.exp(-((abs(p.x)-.071)/.073)**2-((p.z-1.379)/.096)**2)
                blend=min(1,(.18-abs(p.x))/.02,(p.z-1.12)/.025,(1.475-p.z)/.020)
                v.co.y=p.y*(1-blend)+front*blend
    for suffix in ('l','r'):
        wrist=heads['hand_'+suffix];elbow=heads['lowerarm_'+suffix]
        axis=(wrist-elbow).normalized()
        # Sample the sleeve itself to fit a clean cuff around the real wrist.
        u=axis.cross(Vector((0,0,1))).normalized();v=axis.cross(u).normalized()
        cv=[];cw=[];cp=[]
        for d in (-.073,-.050,-.014):
            center=wrist+axis*d
            for j in range(32):
                a=math.tau*j/32;n=u*math.cos(a)+v*math.sin(a)
                hit,p,norm,_=coat.ray_cast(center+n*.14,-n)
                if not hit or (p-center).length>.070:p=center+n*(.040 if d<-.025 else .033)
                else:p+=norm*.004
                cv.append(p);cw.append({'lowerarm_'+suffix:1})
        for row in range(2):
            for j in range(32):a=row*32+j;b=row*32+(j+1)%32;cp.append((a,b,b+32,a+32))
        mesh('Crimson_Cuff_'+suffix,cv,cp,mats['red'],cw)
        tube('Cuff_Gold_Edge_'+suffix,cv[-32:]+[cv[-32]],[.0014]*33,mats['brass'],'lowerarm_'+suffix,6)
        shoulder=heads['upperarm_'+suffix];sign=1 if suffix=='l' else -1
        hit,p,n,_=coat.ray_cast(Vector((shoulder.x,.005,1.8)),Vector((0,0,-1)))
        center=p+Vector((sign*.009,0,.008)) if hit else shoulder+Vector((0,0,.05))
        weights={'clavicle_'+suffix:.65,'upperarm_'+suffix:.35}
        ellipsoid('Crimson_Epaulette_'+suffix,center,(.044,.062,.010),mats['red'],weights,24,8)
        for j in range(16):
            a=-math.pi/2+math.pi*j/15
            top=center+Vector((sign*.040*math.cos(a),.056*math.sin(a),0))
            bottom=top+Vector((sign*.002,0,-.041))
            tube('Red_Epaulette_Fringe',[top,bottom],[.0023,.0018],mats['red'],weights,6)
    # Eyeballs fit the actual source sockets. Skin texture carries fine brows.
    for suffix in ('l','r'):
        center=joint({'cube_name':'joint-'+suffix+'-eye'})
        ellipsoid('Eyeball_'+suffix,center,(.0115,.0115,.0115),mats['eye'],'head',24,16)
        ellipsoid('Iris_'+suffix,center+Vector((0,-.0108,0)),(.0046,.0013,.0046),mats['iris'],'head',20,12)
        ellipsoid('Pupil_'+suffix,center+Vector((0,-.0118,0)),(.0021,.0005,.0021),mats['pupil'],'head',16,10)
        brow=[]
        for j in range(9):
            x=center.x-.014+.028*j/8;z=center.z+.014+.004*math.sin(j*math.pi/8)
            hit,p,n,_=skin.ray_cast(Vector((x,-1,z)),Vector((0,1,0)))
            if hit:brow.append(p+n*.0009)
        if len(brow)>1:tube('Natural_Eyebrow_'+suffix,brow,[.0013]*len(brow),mats['hair'],'head',5)
    hair=subset('Short_Hair',lambda f:all(points[i].z>1.64 and (points[i].y>-.024 or points[i].z>1.708) for i,uv in f),mats['hair'],.006)
    # Shako sits over the cranium. Its compact height avoids an elongated toy.
    hat_y=-.052;hat_base=1.692;hrings=[(hat_base,.087,.105),(1.725,.092,.108),(1.838,.101,.111),(1.851,.102,.111)]
    hv=[];hf=[]
    for z,rx,ry in hrings:
        for j in range(64):a=math.tau*j/64;hv.append((rx*math.cos(a),hat_y+ry*math.sin(a),z))
    for row in range(len(hrings)-1):
        for j in range(64):a=row*64+j;b=row*64+(j+1)%64;hf.append((a,b,b+64,a+64))
    hf.append(tuple(range((len(hrings)-1)*64,len(hrings)*64)))
    mesh('Shaped_Shako',hv,hf,mats['black'],'head')
    for z,rx,ry,mat,radius in [(1.846,.102,.111,mats['brass'],.0035),(1.718,.092,.108,mats['red'],.0035)]:
        path=[Vector((rx*math.cos(j*math.tau/64),hat_y+ry*math.sin(j*math.tau/64),z)) for j in range(65)]
        tube('Shako_Rim',path,[radius]*65,mat,'head',8)
    visor=[]
    for z in (1.712,1.718):
        for j in range(33):
            a=math.pi+math.pi*j/32
            visor.extend([( .082*math.cos(a),hat_y+.077*math.sin(a),z),(.099*math.cos(a),hat_y+.132*math.sin(a),z-.007)])
    vp=[]
    for j in range(32):vp.extend([(2*j,2*j+1,2*j+3,2*j+2),(66+2*j,68+2*j,69+2*j,67+2*j)])
    mesh('Curved_Shako_Visor',visor,vp,mats['leather'],'head')
    # Brass crest uses a small shield and raised crown/flame ornament.
    crest=Vector((0,-.164,1.777))
    ellipsoid('Shako_Crest_Shield',crest,(.023,.004,.030),mats['brass'],'head',20,12)
    for x,z,r in [(-.015,1.810,.007),(0,1.821,.009),(.015,1.810,.007)]:
        ellipsoid('Shako_Crest_Crown',(x,-.165,z),(r,.004,r*1.2),mats['brass'],'head',12,8)
    # Red cords, chin strap and compact plume are readable uniform features.
    for sign in (-1,1):
        tube('Shako_Chinstrap',[(sign*.087,-.045,1.712),(sign*.079,-.052,1.608),(sign*.044,-.103,1.545),(0,-.114,1.539)],[.003]*4,mats['leather'],'head',8)
    tube('Red_Shako_Cord',[(-.084,-.082,1.728),(-.046,-.126,1.714),(0,-.143,1.711),(.046,-.126,1.714),(.084,-.082,1.728)],[.004]*5,mats['red'],'head',10)
    tube('Red_Side_Cord',[(.087,-.028,1.801),(.110,-.021,1.73),(.110,-.021,1.681)],[.004,.003,.003],mats['red'],'head',10)
    ellipsoid('Red_Tassel',(.111,-.020,1.668),(.010,.010,.024),mats['red'],'head',16,10)
    ellipsoid('Short_Red_Plume',(0,-.057,1.889),(.014,.016,.047),mats['red'],'head',20,16)
    # A slight irregular surface breaks up the smooth plume outline.
    plume=objects[-1]
    for v in plume.data.vertices:
        p=v.co;v.co+=v.normal*(.0013*math.sin(p.z*290+p.x*710))
    ctx = {'rig':rig,'arm':arm,'objects':objects,'export_objects':[rig]+objects,'materials':mats,'M':mats,'heads':heads,'tails':tails,'rest':rest,'HEADS':heads,'TAILS':tails,'REST':rest,'source_points':points,'source_weights':source_weights,'source_assignments':assignments,'body_height':height,'height':1.948,'body_bounds':(tuple(min(points[i][a] for i in used) for a in range(3)),tuple(max(points[i][a] for i in used) for a in range(3))),'mesh':mesh,'ellipsoid':ellipsoid,'tube':tube,'source_weight_at':source_weight_at,'preset':preset,'gender':gender,'coat':coat,'trousers':trousers,'subset':subset,'source_faces':faces,'skin':skin}
    apply_appearance(ctx)
    ctx['export_objects'] = [rig]+objects
    for cloth in (coat,trousers):
        bpy.ops.object.select_all(action='DESELECT');cloth.select_set(True);bpy.context.view_layer.objects.active=cloth
        bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.smart_project(angle_limit=1.15,island_margin=.004)
        bpy.ops.object.mode_set(mode='OBJECT')
    bpy.context.view_layer.update()
    return ctx


def neutral_pose(ctx):
    """Convenient review stance; actual authored motion is supplied separately."""
    rig=ctx['rig']
    def point(name,direction):
        bpy.context.view_layer.update();bone=rig.pose.bones[name]
        start=bone.head.copy();cur=(bone.tail-bone.head).normalized()
        q=cur.rotation_difference(Vector(direction).normalized())
        bone.matrix=Matrix.Translation(start)@q.to_matrix().to_4x4()@Matrix.Translation(-start)@bone.matrix
        bpy.context.view_layer.update()
    for suffix,sign in [('l',1),('r',-1)]:
        point('thigh_'+suffix,(sign*.025,0,-.43));point('calf_'+suffix,(sign*.005,0,-.44))
        point('upperarm_'+suffix,(sign*.030,-.006,-.25))
        point('lowerarm_'+suffix,(sign*.004,-.037,-.26))
    return ctx


def save_review(ctx,output):
    output=Path(output);output.mkdir(parents=True,exist_ok=True)
    neutral_pose(ctx)
    scene=bpy.context.scene
    scene.render.engine='CYCLES';scene.cycles.samples=32
    scene.world.color=(.14,.14,.14)
    floor=bpy.data.materials.new('Review_Floor');floor.diffuse_color=(.19,.20,.19,1)
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.012));ground=bpy.context.object;ground.name='Review_Ground';ground.data.materials.append(floor)
    def area(name,location,power,size):
        data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
        obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);obj.location=location
        obj.rotation_euler=(Vector((0,0,1))-obj.location).to_track_quat('-Z','Y').to_euler()
    area('Key',(2,-4,5),550,4);area('Fill',(-3,-2,3),250,4);area('Rim',(1,3,4),420,3)
    camera=bpy.data.cameras.new('Review_Camera');cam=bpy.data.objects.new('Review_Camera',camera);bpy.context.collection.objects.link(cam)
    cam.location=(3,-5,3.3);target=Vector((0,0,.98));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();camera.type='ORTHO';camera.ortho_scale=2.25;scene.camera=cam
    scene.render.resolution_x=700;scene.render.resolution_y=850;scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'
    bpy.ops.wm.save_as_mainfile(filepath=str(output/'native-human-review.blend'))
    scene.render.filepath=str(output/'native-human-neutral.png');bpy.ops.render.render(write_still=True)
    cam.location=(4,-4,4.98);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();camera.ortho_scale=2.65
    scene.render.filepath=str(output/'native-human-isometric.png');bpy.ops.render.render(write_still=True)

if __name__=='__main__':
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    character=create_character();save_review(character,Path(__file__).resolve().parent/'human-review')
