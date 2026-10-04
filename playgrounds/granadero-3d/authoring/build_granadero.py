"""Build the original Granaderos live-3D soldier and its skeletal action library.

Run with Blender 5 or newer:
  blender --background --factory-startup --python authoring/build_granadero.py

The source scene uses metres, Z-up, and -Y forward. glTF export changes this to
Y-up and +Z forward. Every animation is a real armature action; no sprite frames
or runtime-only animation are used. Human topology and skin details use the CC0
MakeHuman/Mindfront sources. Uniform, equipment, and actions are original work.
"""
import bpy
import math
import json
import struct
import hashlib
import sys
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
ASSETS = HERE.parent / "public" / "assets"
ASSETS.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version = 0
for action in list(bpy.data.actions):
    bpy.data.actions.remove(action)
scene = bpy.context.scene
scene.render.fps = 30
scene.unit_settings.system = "METRIC"
scene.unit_settings.scale_length = 1
scene.frame_start = 0
scene.frame_end = 90


def material(name, color, roughness=0.85, metal=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metal
    return m


M = {
    "skin": material("Skin", (0.59, 0.385, 0.255), 0.72),
    "navy": material("Navy_Wool", (0.009, 0.018, 0.034), 0.97),
    "trousers": material("Navy_Trousers", (0.012, 0.020, 0.030), 0.98),
    "red": material("Crimson_Facings", (0.40, 0.022, 0.029), 0.94),
    "cream": material("Cream_Crossbelts", (0.74, 0.685, 0.54), 0.91),
    "brass": material("Aged_Brass", (0.43, 0.28, 0.07), 0.43, 0.78),
    "black": material("Black_Leather", (0.013, 0.015, 0.017), 0.80),
    "sole": material("Boot_Soles", (0.014, 0.012, 0.010), 0.90),
    "hat": material("Black_Shako_Felt", (0.020, 0.021, 0.024), 0.99),
    "hair": material("Dark_Hair", (0.035, 0.025, 0.018), 0.98),
    "eyes": material("Eye_Ivory", (0.66, 0.61, 0.48), 0.60),
    "iris": material("Hazel_Iris", (0.078, 0.048, 0.026), 0.55),
    "pupil": material("Eye_Pupil", (0.008, 0.007, 0.006), 0.50),
    "lip": material("Lip_Tone", (0.35, 0.17, 0.13), 0.90),
    "wood": material("Walnut_Gunstock", (0.115, 0.058, 0.026), 0.78),
    "steel": material("Gunmetal", (0.17, 0.18, 0.18), 0.46, 0.90),
    "blade": material("Sabre_Steel", (0.43, 0.46, 0.46), 0.30, 0.97),
    "seam": material("Wool_Seams", (0.046, 0.067, 0.091), 0.99),
}

# Conventional humanoid bones, with separate coat-tail bones. Mesh vertices use
# real deform groups. Multi-bone sleeve and trouser weights soften joint motion.
arm = bpy.data.armatures.new("Granadero_Skeleton")
rig = bpy.data.objects.new("Granadero_Rig", arm)
bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")
bones = {}


def bone(name, head, tail, parent=None, connected=False):
    b = arm.edit_bones.new(name)
    b.head, b.tail = head, tail
    if parent:
        b.parent = bones[parent]
        b.use_connect = connected
    bones[name] = b


bone("root", (0, 0, 0), (0, 0, 0.16))
bone("hips", (0, 0.02, 0.955), (0, 0.02, 1.095), "root")
bone("spine", (0, 0.02, 1.045), (0, 0.01, 1.255), "hips")
bone("chest", (0, 0.01, 1.255), (0, 0, 1.455), "spine", True)
bone("neck", (0, 0, 1.455), (0, 0, 1.55), "chest", True)
bone("head", (0, 0, 1.55), (0, 0, 1.78), "neck", True)
for side, sign in [("R", -1), ("L", 1)]:
    shoulder = (sign * 0.245, 0, 1.405)
    elbow = (sign * 0.318, 0, 1.10)
    wrist = (sign * 0.342, -0.012, 0.823)
    bone("upper_arm." + side, shoulder, elbow, "chest")
    bone("forearm." + side, elbow, wrist, "upper_arm." + side, True)
    bone("hand." + side, wrist, (sign * 0.349, -0.017, 0.690), "forearm." + side, True)
    hip, knee, ankle = (sign * 0.107, 0.02, 0.955), (sign * 0.118, 0.01, 0.535), (sign * 0.118, 0.025, 0.135)
    bone("thigh." + side, hip, knee, "hips")
    bone("shin." + side, knee, ankle, "thigh." + side, True)
    bone("foot." + side, ankle, (sign * 0.118, -0.175, 0.072), "shin." + side, True)
    bone("coat_tail." + side, (sign * 0.105, 0.102, 0.965), (sign * 0.105, 0.130, 0.525), "hips")
bpy.ops.object.mode_set(mode="OBJECT")
for pb in rig.pose.bones:
    pb.rotation_mode = "QUATERNION"
REST = {b.name: b.matrix_local.copy() for b in arm.bones}
HEADS = {b.name: b.head_local.copy() for b in arm.bones}
TAILS = {b.name: b.tail_local.copy() for b in arm.bones}
body = []
export_objects = [rig]


def weights_for_z(z):
    if z <= 1.025:
        return {"hips": 1.0}
    if z < 1.19:
        blend = (z - 1.025) / 0.165
        return {"hips": 1 - blend, "spine": blend}
    if z < 1.31:
        blend = (z - 1.19) / 0.12
        return {"spine": 1 - blend, "chest": blend}
    return {"chest": 1.0}


def mesh(name, vertices, faces, mat, weights=None, group=None, smooth=True):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    for polygon in data.polygons:
        polygon.use_smooth = smooth
    if weights is not None:
        modifier = obj.modifiers.new("Skeletal_Deformation", "ARMATURE")
        modifier.object = rig
        obj.parent = rig
        groups = {}
        for i, assignment in enumerate(weights):
            for bn, value in assignment.items():
                if value <= 0:
                    continue
                vg = groups.get(bn)
                if vg is None:
                    vg = obj.vertex_groups.new(name=bn)
                    groups[bn] = vg
                vg.add([i], value, "REPLACE")
        body.append(obj)
    elif group:
        obj.parent = group
    export_objects.append(obj)
    return obj


def loft_z(name, rings, mat, weight="chest", segments=20):
    # Each ring: z, centre_x, centre_y, radius_x, radius_y.
    vertices, assignments = [], []
    for z, x, y, rx, ry in rings:
        for n in range(segments):
            a = 2 * math.pi * n / segments
            folds = 1 + (.018 * math.sin(a * 5 + z * 39) + .010 * math.sin(a * 9 - z * 22)) if mat in (M['navy'], M['trousers']) else 1
            vertices.append((x + rx * math.cos(a) * folds, y + ry * math.sin(a) * folds, z))
            assignments.append(weight(z) if callable(weight) else {weight: 1})
    faces = [tuple(reversed(range(segments)))]
    for r in range(len(rings) - 1):
        for n in range(segments):
            k, j = r * segments + n, r * segments + (n + 1) % segments
            faces.append((k, j, j + segments, k + segments))
    faces.append(tuple((len(rings) - 1) * segments + n for n in range(segments)))
    return mesh(name, vertices, faces, mat, assignments)


def ellipsoid(name, centre, scale, mat, weight=None, group=None, segments=16, rings=10):
    vertices, faces = [], []
    for i in range(rings + 1):
        phi = math.pi * i / rings
        for j in range(segments):
            a = 2 * math.pi * j / segments
            vertices.append(tuple(centre[k] + scale[k] * (math.sin(phi) * math.cos(a), math.sin(phi) * math.sin(a), math.cos(phi))[k] for k in range(3)))
    for i in range(rings):
        for j in range(segments):
            a, b = i * segments + j, i * segments + (j + 1) % segments
            faces.append((a, b, b + segments, a + segments))
    assignments = [(weight if isinstance(weight, dict) else {weight: 1})] * len(vertices) if weight else None
    return mesh(name, vertices, faces, mat, assignments, group)


def tube(name, points, radii, mat, weights=None, group=None, segments=10):
    vertices, faces, assignments = [], [], []
    pts = [Vector(p) for p in points]
    for i, p in enumerate(pts):
        d = pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]
        d.normalize()
        reference = Vector((1, 0, 0)) if abs(d.x) < 0.8 else Vector((0, 1, 0))
        u = d.cross(reference).normalized()
        v = d.cross(u).normalized()
        radius = radii[i] if isinstance(radii, list) else radii
        for j in range(segments):
            angle = j * 2 * math.pi / segments
            folds = 1 + (.026 * math.sin(5 * angle + i * 2.3) + .014 * math.sin(8 * angle - i * 1.9)) if mat in (M['navy'], M['trousers']) else 1
            q = p + (u * math.cos(angle) + v * math.sin(angle)) * radius * folds
            vertices.append(tuple(q))
            if weights:
                assignments.append(weights[i] if isinstance(weights, list) else {weights: 1})
    faces.append(tuple(reversed(range(segments))))
    for i in range(len(points) - 1):
        for j in range(segments):
            a, b = i * segments + j, i * segments + (j + 1) % segments
            faces.append((a, b, b + segments, a + segments))
    faces.append(tuple((len(points) - 1) * segments + j for j in range(segments)))
    return mesh(name, vertices, faces, mat, assignments if weights else None, group)


def ribbon(name, points, width, thickness, mat, weight=None, group=None):
    vertices, assignments = [], []
    for i, point in enumerate(points):
        point = Vector(point)
        tangent = Vector(points[min(i + 1, len(points) - 1)]) - Vector(points[max(i - 1, 0)])
        side = tangent.cross(Vector((0, -1, 0))).normalized() * width / 2
        for yoffset in (-thickness / 2, thickness / 2):
            for sign in (-1, 1):
                vertex = point + side * sign + Vector((0, yoffset, 0))
                vertices.append(tuple(vertex))
                if weight:
                    assignments.append(weight(vertex.z) if callable(weight) else {weight: 1})
    faces = []
    for i in range(len(points) - 1):
        a = i * 4
        faces += [(a, a + 4, a + 5, a + 1), (a + 2, a + 3, a + 7, a + 6), (a, a + 2, a + 6, a + 4), (a + 1, a + 5, a + 7, a + 3)]
    faces += [(0, 1, 3, 2), tuple(range(len(vertices) - 4, len(vertices)))]
    return mesh(name, vertices, faces, mat, assignments if weight else None, group, False)


def box(name, centre, size, mat, weight=None, group=None, bevel=0.003):
    bpy.ops.mesh.primitive_cube_add(size=1, location=centre)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new("Soft_edges", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.data.materials.append(mat)
    if weight:
        vg = obj.vertex_groups.new(name=weight)
        vg.add(list(range(len(obj.data.vertices))), 1, "REPLACE")
        mod = obj.modifiers.new("Skeletal_Deformation", "ARMATURE")
        mod.object = rig
        obj.parent = rig
        body.append(obj)
    elif group:
        obj.parent = group
    export_objects.append(obj)
    return obj


# Body: shaped chest, fitted waist, pelvic mass, and four separate articulated
# limbs. The coat is tailored rather than a capsule or oversized block.
loft_z("Tailored_Coat", [
    (0.865, 0, 0.015, .195, .116), (.96, 0, .015, .170, .112),
    (1.055, 0, .012, .159, .104), (1.17, 0, .008, .183, .126),
    (1.29, 0, .005, .217, .143), (1.375, 0, .007, .245, .131),
    (1.425, 0, .008, .201, .109), (1.457, 0, .006, .068, .058),
], M["navy"], weights_for_z, 24)
loft_z("Trouser_Hips", [(0.835, 0, .02, .175, .105), (.93, 0, .02, .168, .112), (.988, 0, .02, .153, .103)], M["trousers"], "hips", 20)
loft_z("Neck", [(1.445, 0, .005, .057, .052), (1.512, 0, .007, .055, .049), (1.552, 0, .007, .056, .051)], M["skin"], "neck", 16)
loft_z("Crimson_Collar", [(1.451, 0, .014, .069, .073), (1.484, 0, .016, .067, .071), (1.520, 0, .016, .063, .067)], M["red"], "neck", 24)
for side, sign in [("R", -1), ("L", 1)]:
    arm_points = [tuple(HEADS["upper_arm." + side]), (sign * .267, -.001, 1.36), (sign * .285, 0, 1.28), (sign * .304, 0, 1.17), (sign * .312, 0, 1.13), (sign * .318, 0, 1.105), (sign * .322, -.002, 1.078), (sign * .326, -.004, 1.043), (sign * .334, -.008, .936), (sign * .342, -.012, .836)]
    arm_weights = [{"chest": .85, "upper_arm." + side: .15}, {"chest": .35, "upper_arm." + side: .65}, {"upper_arm." + side: 1}, {"upper_arm." + side: .90, "forearm." + side: .10}, {"upper_arm." + side: .72, "forearm." + side: .28}, {"upper_arm." + side: .5, "forearm." + side: .5}, {"upper_arm." + side: .25, "forearm." + side: .75}, {"forearm." + side: 1}, {"forearm." + side: 1}, {"forearm." + side: 1}]
    tube("Coat_Sleeve." + side, arm_points, [.071, .074, .065, .060, .063, .058, .061, .056, .047, .039], M["navy"], arm_weights, segments=20)
    ellipsoid("Shoulder_Join." + side, (sign * .235, 0, 1.373), (.086, .087, .090), M["navy"], {"chest": .65, "upper_arm." + side: .35}, segments=18, rings=10)
    tube("Crimson_Cuff." + side, [(sign * .337, -.010, .907), (sign * .342, -.012, .830)], [.046, .043], M["navy"], "forearm." + side, segments=16)
    tube("Cuff_Red_Piping." + side, [(sign * .341, -.012, .845), (sign * .342, -.012, .837)], [.044, .044], M['red'], 'forearm.' + side, segments=16)
    tube("Cuff_Brass_Piping." + side, [(sign * .341, -.012, .852), (sign * .341, -.012, .849)], [.044, .044], M['brass'], 'forearm.' + side, segments=16)
    seam = [(sign * .285, .062, 1.338), (sign * .310, .052, 1.20), (sign * .330, .047, 1.07), (sign * .349, .028, .915)]
    tube("Sleeve_Seam." + side, seam, .0016, M["seam"], [{"upper_arm." + side: 1}, {"upper_arm." + side: 1}, {"upper_arm." + side: .25, "forearm." + side: .75}, {"forearm." + side: 1}], segments=6)
    # Hand geometry is built in bone coordinates, then skinned to that bone.
    hand_matrix = REST["hand." + side]
    def hand_world(p):
        return tuple(hand_matrix @ Vector(p))
    palm = [hand_world((0, y, 0)) for y in (.009, .035, .073)]
    tube("Palm." + side, palm, [.029, .033, .026], M["skin"], "hand." + side, segments=12)
    for finger, x in enumerate((-.021, -.007, .008, .022)):
        end = .129 - abs(x) * .6
        pts = [hand_world((x, .066, -.004)), hand_world((x, .092, -.001)), hand_world((x, end, .012)), hand_world((x, end - .012, .026))]
        tube("Finger_%d.%s" % (finger, side), pts, [.009, .0083, .0075, .0054], M["skin"], "hand." + side, segments=8)
        ellipsoid("Knuckle_%d.%s" % (finger, side), hand_world((x, .080, -.013)), (.009, .008, .008), M["skin"], "hand." + side, segments=10, rings=6)
    tube("Thumb." + side, [hand_world((sign * .029, .038, .007)), hand_world((sign * .041, .062, .016)), hand_world((sign * .026, .082, .027))], [.014, .011, .009], M["skin"], "hand." + side, segments=9)
    # Continuous trouser leg, with blended knee and a realistic taper.
    leg_points = [(sign * .107, .02, .927), (sign * .109, .023, .82), (sign * .114, .016, .66), (sign * .116, .012, .575), (sign * .118, .010, .547), (sign * .118, .010, .522), (sign * .118, .011, .498), (sign * .118, .012, .433), (sign * .118, .018, .330)]
    leg_weights = [{"thigh." + side: 1}, {"thigh." + side: 1}, {"thigh." + side: 1}, {"thigh." + side: .90, "shin." + side: .10}, {"thigh." + side: .66, "shin." + side: .34}, {"thigh." + side: .38, "shin." + side: .62}, {"thigh." + side: .15, "shin." + side: .85}, {"shin." + side: 1}, {"shin." + side: 1}]
    tube("Trouser_Leg." + side, leg_points, [.088, .082, .069, .066, .069, .063, .066, .054, .050], M["trousers"], leg_weights, segments=20)
    stripe_points = [(sign * .193, .02, .92), (sign * .194, .022, .80), (sign * .184, .015, .67), (sign * .181, .010, .54), (sign * .174, .012, .43), (sign * .169, .018, .34)]
    stripe_weights = [{"thigh." + side: 1}, {"thigh." + side: 1}, {"thigh." + side: 1}, {"thigh." + side: .5, "shin." + side: .5}, {"shin." + side: 1}, {"shin." + side: 1}]
    tube("Crimson_Trouser_Stripe." + side, stripe_points, .0038, M["red"], stripe_weights, segments=6)
    loft_z("Boot_Shaft." + side, [(.106, sign * .118, .018, .054, .049), (.17, sign * .118, .02, .053, .050), (.23, sign * .118, .017, .052, .047), (.27, sign * .118, .016, .056, .052), (.38, sign * .118, .012, .059, .055), (.503, sign * .118, .012, .062, .056)], M["black"], "shin." + side, 20)
    loft_z("Boot_Top_Seam." + side, [(.497, sign * .118, .012, .063, .057), (.510, sign * .118, .012, .063, .057)], M["black"], "shin." + side, 20)
    outline = [(-.055, .064), (.055, .064), (.058, -.055), (.060, -.140), (.048, -.178), (.017, -.194), (-.017, -.194), (-.048, -.178), (-.060, -.140), (-.058, -.055)]
    def shoe_layer(zbottom, ztop, mat, name):
        verts = [(sign * .118 + x, y, zbottom) for x, y in outline]
        verts += [(sign * .118 + x * .92, y, ztop if y > -.08 else ztop * .77) for x, y in outline]
        faces = [tuple(reversed(range(10))), tuple(range(10, 20))]
        faces += [(i, (i + 1) % 10, (i + 1) % 10 + 10, i + 10) for i in range(10)]
        obj = mesh(name, verts, faces, mat, [{"foot." + side: 1}] * 20)
        if mat == M['black']:
            bpy.context.view_layer.objects.active = obj
            bevel = obj.modifiers.new('Rounded_Leather_Toe', 'BEVEL')
            bevel.width = .008
            bevel.segments = 3
            bpy.ops.object.modifier_move_up(modifier=bevel.name)
            bpy.ops.object.modifier_apply(modifier=bevel.name)
        return obj
    shoe_layer(.010, .035, M["sole"], "Boot_Sole." + side)
    # A domed instep and tapered rounded toe replace the block upper.
    foot_rings = [(.064, .048, .066), (.024, .053, .098), (-.045, .054, .080), (-.105, .055, .059), (-.150, .051, .041), (-.177, .037, .032), (-.193, .012, .020)]
    upper_vertices = []
    for y, width, height in foot_rings:
        for n in range(13):
            angle = n * math.pi / 12
            upper_vertices.append((sign * .118 + width * math.cos(angle), y, .033 + height * math.sin(angle)))
    upper_faces = [tuple(reversed(range(13))), tuple(range(len(upper_vertices) - 13, len(upper_vertices)))]
    upper_faces += [(r * 13 + n, r * 13 + n + 1, (r + 1) * 13 + n + 1, (r + 1) * 13 + n) for r in range(len(foot_rings) - 1) for n in range(12)]
    upper_faces += [(r * 13, (r + 1) * 13, (r + 1) * 13 + 12, r * 13 + 12) for r in range(len(foot_rings) - 1)]
    mesh('Rounded_Boot_Upper.' + side, upper_vertices, upper_faces, M['black'], [{'foot.' + side: 1}] * len(upper_vertices))
    box("Boot_Heel." + side, (sign * .118, .026, .025), (.109, .080, .045), M["sole"], "foot." + side, bevel=.006)
    # Back panels have a central gap and two articulated tail bones.
    vertices = [
        (sign * .025, .116, .973), (sign * .179, .083, .950),
        (sign * .185, .130, .745), (sign * .137, .160, .542),
        (sign * .022, .174, .548), (sign * .024, .150, .735),
    ]
    back = [(x, y - .011, z) for x, y, z in vertices]
    allverts = vertices + back
    faces = [tuple(range(6)), tuple(reversed(range(6, 12)))]
    faces += [(i, (i + 1) % 6, (i + 1) % 6 + 6, i + 6) for i in range(6)]
    w = []
    for x, y, z in allverts:
        blend = min(1, max(0, (.974 - z) / .25))
        w.append({"hips": 1 - blend, "coat_tail." + side: blend})
    mesh("Coat_Tail." + side, allverts, faces, M["navy"], w)
    tube("Tail_Seam." + side, [(sign * .161, .089, .946), (sign * .174, .143, .74), (sign * .131, .173, .552)], .002, M["seam"], [{"hips": 1}, {"coat_tail." + side: 1}, {"coat_tail." + side: 1}], segments=6)

# Uniform details follow the body, rather than floating on an independent rig.
def coat_point(x, z, back=False):
    profile = [(.865, .195, .116, .015), (.96, .170, .112, .015), (1.055, .159, .104, .012), (1.17, .183, .126, .008), (1.29, .217, .143, .005), (1.375, .245, .131, .007), (1.425, .201, .109, .008)]
    for (za, ra, da, ca), (zb, rb, db, cb) in zip(profile, profile[1:]):
        if z <= zb:
            t = min(1, max(0, (z - za) / (zb - za)))
            radius, depth, centre = ra + (rb - ra) * t, da + (db - da) * t, ca + (cb - ca) * t
            surface = depth * math.sqrt(max(.01, 1 - (x / radius) ** 2)) + .008
            return (x, centre + (surface if back else -surface), z)
    return (x, .012, z)

for sign in (-1, 1):
    if sign == 1:
        ribbon("Front_Diagonal_Crossbelt", [coat_point(.19, 1.405), coat_point(.125, 1.335), coat_point(.035, 1.242), coat_point(-.061, 1.138), coat_point(-.137, 1.031)], .053, .008, M["cream"], weights_for_z)
        ribbon("Back_Diagonal_Crossbelt", [coat_point(.19, 1.405, True), coat_point(.123, 1.33, True), coat_point(.04, 1.23, True), coat_point(-.065, 1.13, True), coat_point(-.137, 1.033, True)], .050, .008, M["cream"], weights_for_z)
    row_points = []
    for z in (1.066, 1.134, 1.207, 1.281, 1.352):
        x = sign * (.11 + .032 * (z - 1.066) / .286)
        point = coat_point(x, z)
        row_points.append(point)
        ellipsoid("Brass_Coat_Button", point, (.0085, .005, .0085), M["brass"], "spine" if z < 1.22 else "chest", segments=12, rings=7)
    ribbon('Front_Red_Piping_' + str(sign), row_points, .004, .004, M['red'], weights_for_z)
    ellipsoid("Shoulder_Epaulette_Trim", (sign * .224, .002, 1.412), (.060, .066, .010), M["cream"], "upper_arm." + ("L" if sign > 0 else "R"), segments=18, rings=8)
    ellipsoid("Shoulder_Epaulette", (sign * .224, .002, 1.420), (.054, .059, .010), M["red"], "upper_arm." + ("L" if sign > 0 else "R"), segments=18, rings=8)
    for k in range(12):
        y = -.051 + k * .0093
        tube("Epaulette_Fringe", [(sign * .270, y, 1.409), (sign * .276, y, 1.335)], [.0032, .0024], M["red"], "upper_arm." + ("L" if sign > 0 else "R"), segments=6)
    ellipsoid("Cuff_Button", (sign * .377, -.021, .866), (.007, .007, .008), M["brass"], "forearm." + ("L" if sign > 0 else "R"), segments=9, rings=6)
box("Belt_Buckle", (0, -.121, 1.023), (.053, .014, .039), M["brass"], "hips", bevel=.004)
loft_z("Waist_Belt", [(1.002, 0, .014, .172, .12), (1.039, 0, .014, .168, .117)], M["cream"], "hips", 32)
box("Cartridge_Pouch", (.151, .134, 1.015), (.121, .061, .129), M["black"], "hips", bevel=.009)
box("Pouch_Flap", (.151, .169, 1.047), (.125, .011, .065), M["black"], "hips", bevel=.004)
ellipsoid("Pouch_Button", (.151, .177, 1.039), (.006, .004, .006), M["brass"], "hips", segments=10, rings=6)

# Adult head: a jaw, cheeks, temples and forehead, with separate facial landmarks.
loft_z("Head_Face", [
    (1.535, 0, -.003, .044, .049), (1.559, 0, -.002, .058, .069),
    (1.592, 0, .003, .071, .081), (1.633, 0, .006, .082, .087),
    (1.669, 0, .009, .079, .085), (1.707, 0, .014, .076, .081),
    (1.745, 0, .014, .067, .072), (1.772, 0, .014, .044, .055),
    (1.782, 0, .014, .013, .025),
], M["skin"], "head", 24)
for sign in (-1, 1):
    ellipsoid("Ear", (sign * .079, .008, 1.641), (.014, .019, .032), M["skin"], "head", segments=12, rings=9)
    ellipsoid("Ear_Inner", (sign * .086, -.002, 1.642), (.008, .013, .019), M["lip"], "head", segments=10, rings=7)
    # Sockets and eyelids keep the eyes small and readable at tactical scale.
    ellipsoid("Eye_Socket", (sign * .031, -.074, 1.665), (.020, .010, .011), M["skin"], "head", segments=14, rings=8)
    ellipsoid("Eye", (sign * .032, -.082, 1.665), (.015, .006, .0065), M["eyes"], "head", segments=14, rings=7)
    ellipsoid("Iris", (sign * .032, -.0874, 1.665), (.0048, .002, .0051), M["iris"], "head", segments=12, rings=7)
    ellipsoid("Pupil", (sign * .032, -.089, 1.665), (.0024, .001, .0031), M["pupil"], "head", segments=10, rings=6)
    tube("Upper_Eyelid", [(sign * .018, -.084, 1.669), (sign * .032, -.087, 1.671), (sign * .046, -.082, 1.668)], [.0025, .0022, .0018], M["skin"], "head", segments=6)
    tube("Eyebrow", [(sign * .015, -.077, 1.685), (sign * .031, -.080, 1.686), (sign * .050, -.073, 1.680)], [.0032, .0034, .0024], M["hair"], "head", segments=7)
    ellipsoid("Cheekbone", (sign * .048, -.066, 1.634), (.026, .018, .017), M["skin"], "head", segments=12, rings=8)
    tube("Sideburn", [(sign * .068, -.012, 1.705), (sign * .073, -.019, 1.658), (sign * .068, -.029, 1.623)], [.011, .010, .006], M["hair"], "head", segments=9)
    ellipsoid("Nose_Wing", (sign * .009, -.092, 1.627), (.008, .009, .0065), M["skin"], "head", segments=12, rings=7)
    ellipsoid("Nostril", (sign * .009, -.098, 1.623), (.0034, .0024, .0017), M["lip"], "head", segments=9, rings=6)
ellipsoid("Nose_Bridge", (0, -.083, 1.650), (.010, .016, .028), M["skin"], "head", segments=14, rings=9)
ellipsoid("Nose_Tip", (0, -.103, 1.634), (.013, .012, .010), M["skin"], "head", segments=14, rings=8)
ellipsoid("Chin", (0, -.063, 1.565), (.031, .017, .017), M["skin"], "head", segments=14, rings=8)
tube("Upper_Lip", [(-.024, -.078, 1.601), (-.010, -.084, 1.604), (0, -.085, 1.602), (.010, -.084, 1.604), (.024, -.078, 1.601)], [.0015, .0024, .0022, .0024, .0015], M["lip"], "head", segments=7)
tube("Lower_Lip", [(-.021, -.078, 1.598), (0, -.085, 1.596), (.021, -.078, 1.598)], [.0015, .0028, .0015], M["lip"], "head", segments=7)
loft_z("Hair_Under_Shako", [(1.715, 0, .028, .074, .069), (1.766, 0, .022, .057, .056)], M["hair"], "head", 24)

# Cylindrical shako and a modest feather plume, kept in adult proportions.
loft_z("Shako_Crown", [(1.727, 0, .008, .087, .111), (1.750, 0, .008, .088, .112), (1.882, 0, .008, .094, .116), (1.909, 0, .008, .097, .119)], M["hat"], "head", 28)
loft_z("Shako_Top", [(1.906, 0, .008, .098, .120), (1.918, 0, .008, .096, .118)], M["black"], "head", 28)
loft_z("Shako_Top_Gold_Band", [(1.898, 0, .008, .098, .120), (1.910, 0, .008, .098, .120)], M['brass'], 'head', 32)
loft_z("Shako_Base_Band", [(1.729, 0, .008, .09, .114), (1.753, 0, .008, .091, .115)], M["black"], "head", 28)
loft_z("Shako_Brass_Piping", [(1.752, 0, .008, .0915, .1155), (1.756, 0, .008, .0915, .1155)], M["brass"], "head", 28)
visorverts = [(-.074, -.046, 1.746), (.074, -.046, 1.746), (.081, -.125, 1.727), (.047, -.151, 1.720), (-.047, -.151, 1.720), (-.081, -.125, 1.727)]
mesh("Shako_Visor", visorverts + [(x, y, z - .009) for x, y, z in visorverts], [tuple(range(6)), tuple(reversed(range(6, 12)))] + [(i, (i + 1) % 6, (i + 1) % 6 + 6, i + 6) for i in range(6)], M["black"], [{"head": 1}] * 12)
ellipsoid('Shako_Crest_Shield', (0, -.111, 1.809), (.022, .009, .038), M['brass'], 'head', segments=20, rings=12)
ellipsoid('Shako_Crest_Sun', (0, -.114, 1.861), (.014, .008, .014), M['brass'], 'head', segments=16, rings=10)
for sign in (-1, 1):
    tube('Crest_Laurel_Stem', [(sign * .012, -.117, 1.778), (sign * .028, -.111, 1.793), (sign * .033, -.107, 1.826), (sign * .023, -.111, 1.849)], .0027, M['brass'], 'head', segments=8)
    for i in range(5):
        ellipsoid('Crest_Laurel_Leaf', (sign * (.026 + .007 * math.sin(i * .6)), -.116, 1.791 + i * .013), (.008, .004, .010), M['brass'], 'head', segments=10, rings=6)
for braid in (-1, 1):
    points = []
    for i in range(40):
        a = math.pi * i / 39
        points.append((.090 * math.cos(a), .008 - .119 * math.sin(a), 1.763 + braid * .0025 * math.sin(i * 2)))
    tube('Shako_Red_Braided_Cord', points, .0042, M['red'], 'head', segments=7)
ellipsoid("Shako_Cockade", (0, -.113, 1.887), (.014, .006, .014), M["cream"], "head", segments=16, rings=9)
tube("Red_Plume_Core", [(0, -.046, 1.912), (.004, -.039, 1.949), (.005, -.032, 1.999), (.005, -.027, 2.018)], [.014, .021, .018, .010], M["red"], "head", segments=16)
for i in range(8):
    z = 1.928 + i * .0105
    for sign in (-1, 1):
        tube("Plume_Feather", [(sign * .003, -.033 + i * .003, z), (sign * (.024 - i * .0015), -.034 + i * .003, z + .018)], [.0035, .0015], M["red"], "head", segments=5)
for sign in (-1, 1):
    tube('Shako_Side_Cord', [(sign * .082, .016, 1.884), (sign * .100, .004, 1.846), (sign * .105, .029, 1.757)], .0045, M['red'], 'head', segments=9)
    ellipsoid('Shako_Tassel_Top', (sign * .105, .029, 1.749), (.010, .009, .018), M['red'], 'head', segments=14, rings=8)
    for k in range(9):
        a = k * math.tau / 9
        tube('Shako_Tassel_Thread', [(sign * .105 + .006 * math.cos(a), .029 + .006 * math.sin(a), 1.736), (sign * .107 + .010 * math.cos(a), .029 + .010 * math.sin(a), 1.681)], .0024, M['red'], 'head', segments=6)
for sign in (-1, 1):
    tube("Shako_Chin_Strap", [(sign * .085, -.025, 1.756), (sign * .076, -.053, 1.623), (sign * .034, -.062, 1.552)], [.004, .0035, .0035], M["black"], "head", segments=6)


def weapon_group(name):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = .035
    bpy.context.collection.objects.link(obj)
    obj.parent = rig
    obj.parent_type = "BONE"
    obj.parent_bone = "hand.R"
    obj.matrix_parent_inverse = Matrix.Translation((0, -arm.bones["hand.R"].length, 0))
    obj.matrix_basis = Matrix.Identity(4)
    export_objects.append(obj)
    return obj


def marker(name, position, parent):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "ARROWS"
    obj.empty_display_size = .025
    obj.location = position
    obj.parent = parent
    bpy.context.collection.objects.link(obj)
    export_objects.append(obj)
    return obj


rifle = weapon_group("weapon_rifle")
# Stock rings are specified along local Z: negative Z is muzzle direction.
stockrings = [(.325, .032, .014, .058), (.285, .020, .018, .061), (.13, .016, .018, .046), (.04, .028, .023, .033), (-.07, .017, .027, .035), (-.20, -.018, .024, .024), (-.41, -.022, .020, .020), (-.72, -.024, .016, .017)]
verts = []
for z, y, width, height in stockrings:
    for angle in range(8):
        a = angle * 2 * math.pi / 8
        verts.append((width * math.cos(a), y + height * math.sin(a), z))
faces = [tuple(reversed(range(8))), tuple(range(len(verts) - 8, len(verts)))]
faces += [(i * 8 + j, i * 8 + (j + 1) % 8, (i + 1) * 8 + (j + 1) % 8, (i + 1) * 8 + j) for i in range(len(stockrings) - 1) for j in range(8)]
mesh("Rifle_Walnut_Stock", verts, faces, M["wood"], group=rifle)
tube("Rifle_Barrel", [(0, -.038, -.98), (0, -.038, -.11)], [.010, .015], M["steel"], group=rifle, segments=14)
tube("Rifle_Ramrod", [(.012, -.010, -.955), (.012, -.010, -.20)], .0031, M["steel"], group=rifle, segments=8)
for z in (-.25, -.46, -.69):
    box("Rifle_Barrel_Band", (0, -.028, z), (.045, .045, .015), M["brass"], group=rifle, bevel=.004)
box("Rifle_Flintlock_Plate", (-.029, -.002, -.027), (.012, .044, .122), M["steel"], group=rifle, bevel=.005)
tube("Rifle_Cock", [(-.035, -.026, .01), (-.038, -.074, -.022), (-.036, -.083, -.046)], [.006, .005, .004], M["steel"], group=rifle, segments=8)
tube("Rifle_Trigger_Guard", [(-.011, .042, -.041), (-.011, .085, -.045), (-.011, .093, .024), (-.011, .039, .043)], .004, M["brass"], group=rifle, segments=8)
box("Rifle_Butt_Plate", (0, .025, .330), (.035, .123, .010), M["brass"], group=rifle, bevel=.004)
box("Rifle_Front_Sight", (0, -.052, -.938), (.006, .016, .009), M["steel"], group=rifle, bevel=.001)
marker("muzzle_rifle", (0, -.038, -.988), rifle)

pistol = weapon_group("weapon_pistol")
tube("Pistol_Barrel", [(0, -.024, -.245), (0, -.024, -.048)], [.011, .017], M["steel"], group=pistol, segments=14)
tube("Pistol_Stock", [(0, -.007, -.225), (0, .004, -.070), (0, .022, -.013), (0, .074, .027), (0, .125, .040)], [.015, .022, .025, .022, .018], M["wood"], group=pistol, segments=12)
box("Pistol_Lock", (-.025, -.002, -.055), (.008, .034, .083), M["steel"], group=pistol, bevel=.003)
tube("Pistol_Flintlock", [(-.028, -.015, -.025), (-.029, -.054, -.038), (-.03, -.060, -.051)], .004, M["steel"], group=pistol, segments=7)
tube("Pistol_Trigger_Guard", [(-.010, .030, -.052), (-.010, .065, -.071), (-.010, .080, -.012), (-.010, .026, .006)], .003, M["brass"], group=pistol, segments=8)
ellipsoid("Pistol_Butt_Cap", (0, .125, .040), (.018, .009, .017), M["brass"], group=pistol, segments=12, rings=7)
marker("muzzle_pistol", (0, -.024, -.251), pistol)

sabre = weapon_group("weapon_sabre")
tube("Sabre_Grip", [(0, .110, 0), (0, .012, 0)], [.012, .010], M["black"], group=sabre, segments=12)
ellipsoid("Sabre_Pommel", (0, .112, 0), (.016, .014, .016), M["brass"], group=sabre, segments=12, rings=8)
tube("Sabre_Crossguard", [(-.064, .007, 0), (0, .007, 0), (.064, .016, 0)], [.006, .007, .004], M["brass"], group=sabre, segments=10)
tube("Sabre_Knuckle_Bow", [(.058, .010, 0), (.062, .075, .003), (.043, .115, .005), (.007, .124, .001)], [.005, .004, .004, .004], M["brass"], group=sabre, segments=8)
bladeverts = []
for i in range(15):
    t = i / 14
    cx = .085 * t * t
    y = -.018 - .84 * t
    width = .018 * (1 - .35 * t) if i < 14 else .0004
    bladeverts.extend([(cx - width, y, -.0032), (cx + width, y, -.0032), (cx + width, y, .0032), (cx - width, y, .0032)])
bladefaces = [(0, 3, 2, 1), tuple(range(len(bladeverts) - 4, len(bladeverts)))]
bladefaces += [(i * 4 + j, i * 4 + (j + 1) % 4, (i + 1) * 4 + (j + 1) % 4, (i + 1) * 4 + j) for i in range(14) for j in range(4)]
mesh("Sabre_Curved_Blade", bladeverts, bladefaces, M["blade"], group=sabre, smooth=False)

# Match the slim adult silhouette of the active illustrated granadero library.
# The former procedural study used broad shoulders and oversized feet.
for obj in body:
    if obj.name.startswith(('Shako', 'Cockade', 'Red_Plume', 'Plume_', 'Crimson_Collar')) or all(group.name == 'head' for group in obj.vertex_groups):
        continue
    inverse = obj.matrix_world.inverted()
    for vertex in obj.data.vertices:
        point = obj.matrix_world @ vertex.co
        point.x *= .72
        point.y *= .88
        vertex.co = inverse @ point
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
for b in arm.edit_bones:
    if b.name in ('head', 'neck'):
        continue
    b.head.x *= .72
    b.tail.x *= .72
    b.head.y *= .88
    b.tail.y *= .88
bpy.ops.object.mode_set(mode='OBJECT')
for b in arm.bones:
    REST[b.name], HEADS[b.name], TAILS[b.name] = b.matrix_local.copy(), b.head_local.copy(), b.tail_local.copy()
for group in (rifle, pistol, sabre):
    group.matrix_parent_inverse = Matrix.Translation((0, -arm.bones['hand.R'].length, 0))

# Join body objects per material. This leaves a small number of render meshes,
# preserves all skin groups, and avoids a separate draw call for every button.
import human_details
HUMAN_SOURCE = human_details.upgrade(globals())
joined = []
export_names = [o.name for o in export_objects]
material_groups = {mat: [o for o in body if o.data.materials[0] == mat] for mat in M.values()}
for mat, objects in material_groups.items():
    if not objects:
        continue
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = "Body_" + mat.name
    # Joined meshes retain the active object's armature modifier.
    for mod in list(obj.modifiers)[1:]:
        obj.modifiers.remove(mod)
    joined.append(obj)
export_objects = [bpy.data.objects[name] for name in export_names if name in bpy.data.objects] + joined
export_objects = list(dict.fromkeys(export_objects))
human_details.fabric_materials(globals())


def reset_pose():
    for pb in rig.pose.bones:
        pb.location = (0, 0, 0)
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.scale = (1, 1, 1)


def qaxis(axis, angle):
    return Quaternion(axis, angle)


def transform_for(name):
    return rig.pose.bones[name].matrix @ REST[name].inverted()


def aim_bone(name, head, tail):
    old_dir = (TAILS[name] - HEADS[name]).normalized()
    new_dir = (Vector(tail) - Vector(head)).normalized()
    rot = old_dir.rotation_difference(new_dir) @ REST[name].to_quaternion()
    rig.pose.bones[name].matrix = Matrix.LocRotScale(Vector(head), rot, Vector((1, 1, 1)))


def hand_rotation(side, head, finger_direction, wrist_pitch=0):
    y = Vector(finger_direction).normalized()
    x = Vector((1, 0, 0))
    x = (x - y * x.dot(y)).normalized()
    z = x.cross(y).normalized()
    mat = Matrix(((x.x, y.x, z.x), (x.y, y.y, z.y), (x.z, y.z, z.z)))
    rot = qaxis((1, 0, 0), wrist_pitch) @ mat.to_quaternion()
    rig.pose.bones["hand." + side].matrix = Matrix.LocRotScale(Vector(head), rot, Vector((1, 1, 1)))


def two_bone_points(a, target, length1, length2, pole):
    a, target, pole = Vector(a), Vector(target), Vector(pole)
    delta = target - a
    distance = max(.02, min(delta.length, length1 + length2 - .002))
    unit = delta.normalized()
    target = a + unit * distance
    along = (length1 * length1 - length2 * length2 + distance * distance) / (2 * distance)
    height = math.sqrt(max(.00001, length1 * length1 - along * along))
    perpendicular = pole - unit * pole.dot(unit)
    perpendicular.normalize()
    return a + unit * along + perpendicular * height, target


def arms(targets, dirs=None, pitch=0):
    bpy.context.view_layer.update()
    chest_xform = transform_for("chest")
    for side, sign in [("R", -1), ("L", 1)]:
        shoulder = chest_xform @ HEADS["upper_arm." + side]
        target = chest_xform @ Vector(targets[side])
        l1 = (TAILS["upper_arm." + side] - HEADS["upper_arm." + side]).length
        l2 = (TAILS["forearm." + side] - HEADS["forearm." + side]).length
        pole = chest_xform.to_quaternion() @ Vector((sign * .12, -.08, -1))
        elbow, wrist = two_bone_points(shoulder, target, l1, l2, pole)
        aim_bone("upper_arm." + side, shoulder, elbow)
        bpy.context.view_layer.update()
        aim_bone("forearm." + side, elbow, wrist)
        bpy.context.view_layer.update()
        direction = dirs[side] if dirs else (0, 0, -1)
        hand_rotation(side, wrist, chest_xform.to_quaternion() @ Vector(direction), pitch if side == "R" else 0)
        bpy.context.view_layer.update()


def legs(phase=None, running=False, stance=False):
    bpy.context.view_layer.update()
    hip_xform = transform_for("hips")
    for side, sign in [("R", -1), ("L", 1)]:
        hip = hip_xform @ HEADS["thigh." + side]
        p = phase + (0 if side == "R" else math.pi) if phase is not None else 0
        stride = .315 if running else .205
        u = (p % math.tau) / math.tau
        foot_y = (-stride + 4 * stride * u if u < .5 else stride - 2 * stride * smoothstep(.5, 1, u)) if phase is not None else (sign * -.060 if stance else .025)
        lift = math.sin((u - .5) * math.tau) ** 1.1 * (.165 if running else .090) if phase is not None and u > .5 else 0
        ankle = Vector((HEADS['foot.' + side].x, foot_y, .135 + lift))
        l1 = (TAILS["thigh." + side] - HEADS["thigh." + side]).length
        l2 = (TAILS["shin." + side] - HEADS["shin." + side]).length
        knee, ankle = two_bone_points(hip, ankle, l1, l2, (0, -1, .05))
        aim_bone("thigh." + side, hip, knee)
        bpy.context.view_layer.update()
        aim_bone("shin." + side, knee, ankle)
        bpy.context.view_layer.update()
        # Keep the planted foot level. Swing lifts the toe slightly.
        pitch = (-.10 * max(0, -math.sin(p))) if phase is not None else 0
        foot_delta = qaxis((1, 0, 0), pitch) @ (TAILS["foot." + side] - HEADS["foot." + side])
        aim_bone("foot." + side, ankle, ankle + foot_delta)
        bpy.context.view_layer.update()


def smoothstep(a, b, t):
    x = min(1, max(0, (t - a) / (b - a)))
    return x * x * (3 - 2 * x)


def pulse(t, attack, peak, release):
    return smoothstep(attack, peak, t) * (1 - smoothstep(peak, release, t))


def path(t, points):
    if t <= points[0][0]:
        return Vector(points[0][1])
    for (a, va), (b, vb) in zip(points, points[1:]):
        if t <= b:
            return Vector(va).lerp(Vector(vb), smoothstep(a, b, t))
    return Vector(points[-1][1])


CLIPS = [
    ("Idle", 90, True, {}), ("Walk", 36, True, {}), ("Run", 24, True, {}),
    ("RifleAim", 60, True, {}), ("RifleFire", 36, False, {"shot": .4}),
    ("SabreReady", 60, True, {}), ("SabreSlash", 36, False, {"hit": .5}),
    ("PistolAim", 60, True, {}), ("PistolFire", 30, False, {"shot": 1 / 3}),
]
actions = []
for name, end, looping, events in CLIPS:
    rig.animation_data_create()
    rig.animation_data.action = None
    for frame in range(end + 1):
        scene.frame_set(frame)
        reset_pose()
        t = frame / end
        breath = math.sin(t * math.tau)
        rig.pose.bones["chest"].scale = (1 + .005 * breath, 1 + .005 * breath, 1 + .010 * breath)
        rig.pose.bones["head"].rotation_quaternion = qaxis((0, 1, 0), .013 * breath)
        arm_targets = {"R": (-.245, -.018, .823), "L": (.245, -.018, .823)}
        hand_dirs = {"R": (0, 0, -1), "L": (0, 0, -1)}
        wrist_pitch = 0
        if name in ("Walk", "Run"):
            running = name == "Run"
            p = t * math.tau
            rig.pose.bones["root"].location.y = (-.030 - .025 * math.cos(2 * p)) if running else (-.015 - .015 * math.cos(2 * p))
            rig.pose.bones["spine"].rotation_quaternion = qaxis((1, 0, 0), .105 if running else .045)
            rig.pose.bones["chest"].rotation_quaternion = qaxis((0, 1, 0), .075 * math.cos(p))
            for side, sign in [("R", -1), ("L", 1)]:
                swing = math.cos(p + (0 if side == "R" else math.pi))
                arm_targets[side] = (sign * .214, swing * (.205 if running else .175), 1.012 + .025 * swing if running else .849 + .015 * abs(swing))
                rig.pose.bones["coat_tail." + side].rotation_quaternion = qaxis((1, 0, 0), .18 + .13 * math.sin(p + (0 if side == "R" else math.pi)))
            legs(p, running)
        else:
            recoil = 0
            if name.startswith("Rifle"):
                seconds = frame / 30
                recoil = pulse(seconds, .4, .47, .85) if name == "RifleFire" else 0
                rig.pose.bones["spine"].rotation_quaternion = qaxis((1, 0, 0), -.025 * recoil)
                rig.pose.bones["chest"].rotation_quaternion = qaxis((0, 1, 0), -.09)
                rig.pose.bones["neck"].rotation_quaternion = qaxis((1, 0, 0), .16)
                rig.pose.bones["head"].rotation_quaternion = qaxis((1, 0, 0), .12) @ qaxis((0, 1, 0), -.08)
                arm_targets = {"R": (-.145, -.270 + .045 * recoil, 1.490 + .015 * recoil), "L": (-.135, -.392 + .035 * recoil, 1.376 + .009 * recoil)}
                hand_dirs["L"] = (0, 0, 1)
                wrist_pitch = -.025 - .035 * recoil
            elif name.startswith("Pistol"):
                seconds = frame / 30
                recoil = pulse(seconds, 1 / 3, .42, .77) if name == "PistolFire" else 0
                arm_targets = {"R": (-.145, -.535 + .043 * recoil, 1.455 + .030 * recoil), "L": (.223, -.11, 1.01)}
                wrist_pitch = -.19 * recoil
            elif name.startswith("Sabre"):
                ready = (-.235, -.15, 1.16)
                rig.pose.bones["chest"].rotation_quaternion = qaxis((0, 1, 0), -.08)
                arm_targets = {"R": ready, "L": (.223, -.11, 1.03)}
                hand_dirs["R"] = (-.15, .10, -.98)
                if name == "SabreSlash":
                    arm_targets["R"] = tuple(path(t, [(0, ready), (.23, (-.25, -.02, 1.47)), (.42, (-.12, -.47, 1.26)), (.62, (-.015, -.33, 1.035)), (.83, (-.215, -.14, 1.08)), (1, ready)]))
                    blade_direction = path(t, [(0, (.15, -.10, .98)), (.23, (-.2, .44, .88)), (.42, (.14, -.94, .30)), (.62, (.73, -.22, -.64)), (.83, (.4, -.05, .91)), (1, (.15, -.10, .98))]).normalized()
                    hand_dirs["R"] = tuple(-blade_direction)
                    rig.pose.bones["chest"].rotation_quaternion = qaxis((0, 1, 0), -.08 + .24 * pulse(t, .23, .45, .85))
            legs(stance=name != "Idle")
            for side in ("R", "L"):
                rig.pose.bones["coat_tail." + side].rotation_quaternion = qaxis((1, 0, 0), .025 * breath)
        arms(arm_targets, hand_dirs, wrist_pitch)
        for pb in rig.pose.bones:
            if '_' in pb.name and pb.name.split('_')[0] in ('thumb', 'index', 'middle', 'ring', 'pinky'):
                curl = .12 if name in ('Idle', 'Walk') else .30 if name == 'Run' else 1.10
                if pb.name.endswith('.L') and not name.startswith('Rifle'):
                    curl = .12
                if pb.name.startswith('thumb'):
                    curl *= .45
                pb.rotation_quaternion = qaxis((1, 0, 0), curl)
        for pb in rig.pose.bones:
            pb.keyframe_insert("location", frame=frame, group=pb.name)
            pb.keyframe_insert("rotation_quaternion", frame=frame, group=pb.name)
            pb.keyframe_insert("scale", frame=frame, group=pb.name)
    action = rig.animation_data.action
    action.name = name
    action.use_fake_user = True
    actions.append(action)
    rig.animation_data.action = None
    track = rig.animation_data.nla_tracks.new()
    track.name = name
    strip = track.strips.new(name, 0, action)
    strip.name = name
    strip.action_frame_start = 0
    strip.action_frame_end = end
    strip.blend_type = "REPLACE"
    track.mute = True

# The native file opens in Idle, with useful lighting and camera settings.
rig.animation_data.action = actions[0]
scene.frame_set(0)
bpy.context.view_layer.update()
scene.world.color = (.075, .083, .095)
scene.render.engine = "CYCLES"
scene.cycles.samples = 24
scene.render.resolution_x = 1100
scene.render.resolution_y = 1100
scene.render.resolution_percentage = 100
scene.render.film_transparent = False
scene.view_settings.view_transform = "AgX"


def look_at(obj, point):
    obj.rotation_euler = (Vector(point) - obj.location).to_track_quat("-Z", "Y").to_euler()


bpy.ops.object.camera_add(location=(4, -4, 5.04))
camera = bpy.context.object
camera.name = "Authoring_Preview_Camera"
camera.data.type = "ORTHO"
camera.data.ortho_scale = 2.48
look_at(camera, (0, 0, 1.04))
scene.camera = camera
for name, location, power, size in [("Key", (-3, -4, 5), 750, 4), ("Fill", (3, -2, 3), 320, 3), ("Rim", (1, 3, 4), 900, 3)]:
    bpy.ops.object.light_add(type="AREA", location=location)
    light = bpy.context.object
    light.name = "Authoring_" + name
    light.data.energy = power
    light.data.shape = "DISK"
    light.data.size = size
    look_at(light, (0, 0, 1))

# Export only the model and locators. Cameras and preview lights stay in .blend.
bpy.ops.object.select_all(action="DESELECT")
for obj in export_objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = rig
rig.animation_data.action = None
for track in rig.animation_data.nla_tracks:
    track.mute = False
GLB = ASSETS / ".granadero-building.glb"
bpy.ops.export_scene.gltf(
    filepath=str(GLB), export_format="GLB", use_selection=True,
    export_yup=True, export_animations=True, export_animation_mode="NLA_TRACKS",
    export_force_sampling=True, export_frame_range=False,
    export_anim_slide_to_zero=True, export_nla_strips=True,
    export_skins=True, export_morph=False, export_extras=True,
    export_cameras=False, export_lights=False, export_apply=False,
)
# Blender currently exports grayscale multiply-node maps without retaining the
# constant factor. Restore explicit linear PBR factors in the glTF document.
export_raw = GLB.read_bytes()
json_bytes = struct.unpack_from('<I', export_raw, 12)[0]
export_doc = json.loads(export_raw[20:20 + json_bytes].decode('utf8'))
for mat in export_doc.get('materials', []):
    source_mat = bpy.data.materials.get(mat['name'])
    if source_mat:
        mat.setdefault('pbrMetallicRoughness', {})['baseColorFactor'] = list(source_mat.diffuse_color)
encoded = json.dumps(export_doc, separators=(',', ':')).encode('utf8')
encoded += b' ' * ((-len(encoded)) % 4)
binary_chunk = export_raw[20 + json_bytes:]
GLB.write_bytes(struct.pack('<III', 0x46546c67, 2, 20 + len(encoded) + len(binary_chunk)) + struct.pack('<II', len(encoded), 0x4e4f534a) + encoded + binary_chunk)
for track in rig.animation_data.nla_tracks:
    track.mute = True
rig.animation_data.action = actions[0]
scene.frame_set(0)
for group in (rifle, pistol, sabre):
    for obj in group.children:
        obj.hide_render = True
bpy.ops.wm.save_as_mainfile(filepath=str(HERE / "granadero.blend"), compress=True)
scene.render.filepath = str(HERE / "preview.png")
bpy.ops.render.render(write_still=True)

# Record facts from the exported glTF document, not just the authoring intent.
raw = GLB.read_bytes()
json_length, chunk_kind = struct.unpack_from("<II", raw, 12)
assert chunk_kind == 0x4E4F534A
doc = json.loads(raw[20:20 + json_length].decode("utf8"))
accessors = doc.get("accessors", [])
triangles = 0
for item in doc.get("meshes", []):
    for primitive in item["primitives"]:
        if primitive.get("mode", 4) == 4:
            triangles += accessors[primitive["indices"]]["count"] // 3 if "indices" in primitive else accessors[primitive["attributes"]["POSITION"]]["count"] // 3
clip_facts = []
for animation in doc["animations"]:
    duration = max(accessors[sampler["input"]].get("max", [0])[0] for sampler in animation["samplers"])
    source = next(row for row in CLIPS if row[0] == animation["name"])
    clip_facts.append({"name": animation["name"], "durationSeconds": round(duration, 6), "loop": source[2], "events": source[3], "channels": len(animation["channels"])})
scene.frame_set(0)
bpy.context.view_layer.update()
points = [obj.matrix_world @ Vector(p) for obj in joined for p in obj.bound_box]
mins = [min(p[k] for p in points) for k in range(3)]
maxs = [max(p[k] for p in points) for k in range(3)]
manifest = {
    "version": 1,
    "asset": "granadero.glb",
    "title": "Argentine Granadero — live skeletal 3D study",
    "source": {"type": "Original Granaderos clothing, equipment and animations fitted to a CC0 MakeHuman human base", "script": "authoring/build_granadero.py", "humanFittingScript": "authoring/human_details.py", "editableScene": "authoring/granadero.blend", "blenderVersion": bpy.app.version_string, "units": "metres", "license": "Original project clothing/equipment/actions plus MakeHuman hm08 topology, male target, rig/weight data and Mindfront Aksel skin maps under CC0 1.0", "vendorManifest": "authoring/vendor/makehuman/source-manifest.json", "vendorLicense": "authoring/vendor/makehuman/LICENSE.ASSETS.md", "humanDetails": HUMAN_SOURCE},
    "sha256": hashlib.sha256(raw).hexdigest(),
    "byteLength": len(raw),
    "coordinates": {"up": "+Y", "forward": "+Z", "groundY": 0, "authoringUp": "+Z", "authoringForward": "-Y", "adultBodyHeightMetres": 1.782, "heightWithShakoAndPlumeMetres": round(maxs[2], 4)},
    "bounds": {"space": "gltf, rest/Idle frame 0; weapons excluded", "min": [round(mins[0], 5), round(mins[2], 5), round(-maxs[1], 5)], "max": [round(maxs[0], 5), round(maxs[2], 5), round(-mins[1], 5)]},
    "statistics": {"triangles": triangles, "meshes": len(doc.get("meshes", [])), "nodes": len(doc.get("nodes", [])), "skins": len(doc.get("skins", [])), "bones": len(arm.bones), "materials": len(doc.get("materials", [])), "animationClips": len(doc["animations"])},
    "materials": {"skin": "Skin", "uniform": "Navy_Wool", "facings": "Crimson_Facings", "crossbelts": "Cream_Crossbelts"},
    "nodes": {"rig": "Granadero_Rig", "rifle": "weapon_rifle", "sabre": "weapon_sabre", "pistol": "weapon_pistol", "rifleMuzzle": "muzzle_rifle", "pistolMuzzle": "muzzle_pistol"},
    "weaponForwardLocal": {"rifle": "-Y", "pistol": "-Y", "sabreBlade": "+Z"},
    "locomotionSpeed": {"Walk": .41 / .6, "Run": .63 / .4},
    "clips": clip_facts,
    "notes": ["Hide all weapon groups for Idle, Walk and Run. Only reveal the group for the selected armed action.", "Weapons are child groups of hand.R. Muzzle locator world transforms follow the exported skeletal animation.", "Aim/ready actions hold their pose with a small breathing cycle. Fire/slash clips begin and end at the matching ready pose.", "The model is an original art study, not a claim of exact historical-uniform reconstruction.", "The runtime should interpolate glTF skeletal tracks with AnimationMixer; it does not need an authored direction bank."],
}
(ASSETS / "asset-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
GLB.replace(ASSETS / 'granadero.glb')
GLB = ASSETS / 'granadero.glb'
print("ASSET_READY", json.dumps({"glb": str(GLB), "bytes": len(raw), "clips": [c["name"] for c in clip_facts], "triangles": triangles, "skins": len(doc.get("skins", []))}))
