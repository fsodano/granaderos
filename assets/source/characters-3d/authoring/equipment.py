"""Historically styled equipment in measured grip-local frames.

Firearm +X is the barrel direction, +Z is up. Group origins are the
trigger-hand grip centres. The motion module fits these frames to the palms.
"""
import math
import bpy
from mathutils import Vector, Matrix


def create_equipment(ctx):
    rig = ctx['rig']
    exported = ctx.get('export_objects', ctx['objects'])
    materials = ctx.get('materials', ctx.get('M', {}))

    def material(name, color, roughness, metallic=0):
        m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
        m.use_nodes = True
        m.diffuse_color = (*color, 1)
        p = m.node_tree.nodes.get('Principled BSDF')
        p.inputs['Base Color'].default_value = (*color, 1)
        p.inputs['Roughness'].default_value = roughness
        p.inputs['Metallic'].default_value = metallic
        return m

    walnut = material('Equipment_Walnut', (.075, .031, .014), .60)
    steel = material('Equipment_Blackened_Steel', (.105, .115, .12), .37, .75)
    brass = material('Equipment_Aged_Brass', (.33, .19, .065), .38, .75)
    leather = material('Equipment_Grip_Leather', (.014, .012, .009), .73)
    blade = material('Equipment_Polished_Blade', (.40, .43, .45), .26, .85)

    def group(name):
        o = bpy.data.objects.new(name, None)
        bpy.context.collection.objects.link(o)
        o.parent = rig
        o.parent_type = 'BONE'
        o.parent_bone = 'hand_r'
        o.matrix_parent_inverse = Matrix.Translation((0, -rig.data.bones['hand_r'].length, 0))
        o.matrix_basis = Matrix.Identity(4)
        exported.append(o)
        return o

    def mesh(name, vertices, faces, mat, parent, smooth=True):
        data = bpy.data.meshes.new(name)
        data.from_pydata(vertices, [], faces)
        data.materials.append(mat)
        data.update()
        o = bpy.data.objects.new(name, data)
        bpy.context.collection.objects.link(o)
        o.parent = parent
        for p in data.polygons:
            p.use_smooth = smooth
        exported.append(o)
        return o

    def tube(name, points, radii, mat, parent, segments=10):
        points = [Vector(p) for p in points]
        if isinstance(radii, (int, float)):
            radii = [radii] * len(points)
        verts = []
        for i, point in enumerate(points):
            tangent = points[min(i+1, len(points)-1)] - points[max(i-1, 0)]
            tangent.normalize()
            helper = Vector((0, 0, 1)) if abs(tangent.z) < .9 else Vector((0, 1, 0))
            u = tangent.cross(helper).normalized()
            v = tangent.cross(u).normalized()
            for j in range(segments):
                a = j*math.tau/segments
                verts.append(tuple(point+radii[i]*(u*math.cos(a)+v*math.sin(a))))
        faces = [tuple(reversed(range(segments))), tuple(range(len(verts)-segments, len(verts)))]
        faces += [(i*segments+j, i*segments+(j+1)%segments, (i+1)*segments+(j+1)%segments, (i+1)*segments+j) for i in range(len(points)-1) for j in range(segments)]
        return mesh(name, verts, faces, mat, parent)

    def stock(name, rings, mat, parent):
        verts = []
        sides = 12
        for x, z, width, depth in rings:
            for i in range(sides):
                a = i*math.tau/sides
                verts.append((x, width*math.cos(a), z+depth*math.sin(a)))
        faces = [tuple(reversed(range(sides))), tuple(range(len(verts)-sides, len(verts)))]
        faces += [(i*sides+j, i*sides+(j+1)%sides, (i+1)*sides+(j+1)%sides, (i+1)*sides+j) for i in range(len(rings)-1) for j in range(sides)]
        return mesh(name, verts, faces, mat, parent)

    def box(name, centre, size, mat, parent, bevel=.002):
        bpy.ops.mesh.primitive_cube_add(size=1)
        o = bpy.context.object
        o.name = name
        o.scale = size
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        if bevel:
            m = o.modifiers.new('Rounded machined edge', 'BEVEL')
            m.width = bevel
            m.segments = 2
            bpy.ops.object.modifier_apply(modifier=m.name)
        o.parent = parent
        o.location = centre
        o.data.materials.append(mat)
        exported.append(o)
        return o

    def marker(name, point, parent):
        o = bpy.data.objects.new(name, None)
        bpy.context.collection.objects.link(o)
        o.parent = parent
        o.location = point
        exported.append(o)
        return o

    rifle = group('weapon_rifle')
    stock('Rifle_Walnut_Stock', [(-.295,.014,.019,.055),(-.255,.008,.022,.062),(-.16,.018,.021,.048),(-.04,.014,.017,.022),(.04,.031,.021,.026),(.18,.027,.020,.021),(.43,.029,.016,.017),(.76,.035,.012,.012)], walnut, rifle)
    tube('Rifle_Barrel', [(.015,0,.055),(.94,0,.055)], [.014,.0105], steel, rifle, 16)
    tube('Rifle_Ramrod', [(.14,0,.014),(.925,0,.030)], .003, steel, rifle, 8)
    for x in (.25,.47,.72):
        box('Rifle_Barrel_Band', (x,0,.043), (.012,.039,.046), brass, rifle, .004)
    box('Rifle_Butt_Plate', (-.296,0,.014), (.008,.039,.113), brass, rifle, .003)
    box('Rifle_Lock_Plate', (.04,-.025,.032), (.105,.010,.033), steel, rifle, .004)
    tube('Rifle_Cock', [(.019,-.032,.041),(.003,-.032,.09),(.035,-.032,.087)], [.006,.005,.004], steel, rifle)
    tube('Rifle_Trigger_Guard', [(-.026,-.008,-.004),(-.019,-.008,-.040),(.050,-.008,-.037),(.065,-.008,.011)], .0035, brass, rifle)
    tube('Rifle_Trigger', [(.025,-.006,.01),(.018,-.006,-.021),(.006,-.006,-.025)], .0023, steel, rifle)
    box('Rifle_Front_Sight', (.9,0,.07), (.012,.005,.013), steel, rifle, .001)
    marker('muzzle_rifle', (.945,0,.055), rifle)

    pistol = group('weapon_pistol')
    tube('Pistol_Stock', [(-.045,0,-.075),(-.026,0,-.050),(0,0,.005),(.075,0,.033),(.24,0,.034)], [.018,.020,.024,.020,.011], walnut, pistol, 12)
    tube('Pistol_Barrel', [(.025,0,.055),(.27,0,.055)], [.015,.0105], steel, pistol, 14)
    tube('Pistol_Trigger_Guard', [(.009,-.008,.007),(.038,-.008,-.028),(.085,-.008,-.012),(.079,-.008,.030)], .003, brass, pistol)
    box('Pistol_Lock', (.07,-.023,.036), (.075,.009,.030), steel, pistol)
    tube('Pistol_Cock', [(.040,-.029,.044),(.026,-.029,.083),(.054,-.029,.082)], .004, steel, pistol)
    tube('Pistol_Butt_Cap', [(-.045,0,-.073),(-.045,0,-.083)], .020, brass, pistol, 12)
    marker('muzzle_pistol', (.275,0,.055), pistol)

    sabre = group('weapon_sabre')
    tube('Sabre_Leather_Grip', [(0,0,-.046),(0,0,.055)], [.012,.011], leather, sabre, 12)
    for i in range(7):
        z = -.035+i*.013
        ring = [(.0125*math.cos(a*math.tau/16),.0125*math.sin(a*math.tau/16),z) for a in range(17)]
        tube('Sabre_Grip_Wire', ring, .0009, brass, sabre, 5)
    tube('Sabre_Pommel', [(0,0,-.052),(0,0,-.043)], .016, brass, sabre, 12)
    tube('Sabre_Crossguard', [(-.060,0,.07),(0,0,.070),(.055,0,.074)], [.005,.008,.005], brass, sabre)
    tube('Sabre_Knuckle_Bow', [(.054,0,.073),(.063,0,.02),(.048,0,-.045),(.01,0,-.054)], .0045, brass, sabre)
    verts=[]
    for i in range(25):
        t=i/24
        z=.078+.76*t
        x=-.060*t*t
        width=.016*(1-.35*t) if i<24 else .0005
        thickness=.0028*(1-.6*t)
        verts.extend([(x-width,0,z),(x,thickness,z),(x+width,0,z),(x,-thickness,z)])
    faces=[(0,3,2,1),tuple(range(len(verts)-4,len(verts)))]
    faces += [(i*4+j,i*4+(j+1)%4,(i+1)*4+(j+1)%4,(i+1)*4+j) for i in range(24) for j in range(4)]
    mesh('Sabre_Curved_Blade',verts,faces,blade,sabre,False)

    # Compact working knife: 18 cm blade, 11 cm wooden grip. Single edge,
    # thick spine and a tapered point, rather than a scaled cavalry sword.
    knife = group('weapon_knife')
    tube('Knife_Wood_Grip', [(0,0,-.055),(0,0,-.035),(0,0,.040),(0,0,.055)], [.012,.015,.014,.011], walnut, knife, 12)
    tube('Knife_Ferrule', [(0,0,.047),(0,0,.058)], .012, brass, knife, 12)
    verts=[]
    for z,back,edge,thick in [(.058,-.010,.019,.0025),(.10,-.010,.020,.0023),(.18,-.009,.015,.0017),(.218,-.006,.007,.001),(.238,-.002,-.001,.0002)]:
        verts.extend([(back,-thick,z),(back,thick,z),(edge,.0002,z),(edge,-.0002,z)])
    faces=[(3,2,1,0),(16,17,18,19)]
    faces += [(i*4+j,i*4+(j+1)%4,(i+1)*4+(j+1)%4,(i+1)*4+j) for i in range(4) for j in range(4)]
    mesh('Knife_Single_Edge_Blade',verts,faces,blade,knife,False)
    ctx['weapons']={'rifle':rifle,'pistol':pistol,'sabre':sabre,'knife':knife}
    ctx['weapon_forward_local']={'rifle':'+X','pistol':'+X','sabreBlade':'+Y','knifeBlade':'+Y'}
    ctx['weapon_grips']={'rifle_support':(.32,0,.045)}
    ctx['equipment_helpers']={'group':group,'mesh':mesh,'tube':tube,'stock':stock,'box':box,'marker':marker,'walnut':walnut,'steel':steel,'brass':brass,'leather':leather,'blade':blade}
    return ctx['weapons']
