"""Fit CC0 MakeHuman male anatomy to the original Granaderos study rig.

The body topology, adult male morph, joints, weights, and photographic skin
details retain their source UVs and attribution in vendor/makehuman. Clothing,
weapons and the animation library remain original Granaderos work.
"""
import json
import math
from pathlib import Path
import bpy
import bmesh
from mathutils import Vector, Matrix


def upgrade(ctx):
    vendor = Path(__file__).resolve().parent / 'vendor' / 'makehuman'
    vertices, uvs, faces = [], [], []
    active_group = ''
    for line in (vendor / 'base.obj').read_text().splitlines():
        fields = line.split()
        if not fields:
            continue
        if fields[0] == 'v':
            vertices.append(Vector(tuple(map(float, fields[1:4]))))
        elif fields[0] == 'vt':
            uvs.append(tuple(map(float, fields[1:3])))
        elif fields[0] == 'g':
            active_group = fields[1]
        elif fields[0] == 'f' and active_group == 'body':
            indices = [f.split('/') for f in fields[1:]]
            faces.append([(int(f[0]) - 1, int(f[1]) - 1) for f in indices])
    for line in (vendor / 'caucasian-male-young.target').read_text().splitlines():
        fields = line.split()
        if len(fields) == 4 and fields[0].isdigit():
            vertices[int(fields[0])] += Vector(tuple(map(float, fields[1:])))
    groups = json.loads((vendor / 'basemesh_vertex_groups.json').read_text())
    source_rig = json.loads((vendor / 'rig.game_engine.json').read_text())
    source_weights = json.loads((vendor / 'weights.game_engine.json').read_text())['weights']
    used = set(v for face in faces for v, uv in face)
    ymin, ymax = min(vertices[i].y for i in used), max(vertices[i].y for i in used)
    scale = 1.782 / (ymax - ymin)

    def converted(p):
        return Vector((p.x * scale, -p.z * scale, (p.y - ymin) * scale))

    points = [converted(p) for p in vertices]

    def source_joint(spec):
        ids = spec.get('vertex_indices')
        if ids is None:
            ids = [i for a, b in groups[spec['cube_name']] for i in range(a, b + 1)]
        return sum((points[i] for i in ids), Vector()) / len(ids)

    rig, arm = ctx['rig'], ctx['arm']
    # Remove the interim disconnected facial landmarks and primitive hands.
    old_mats = {ctx['M'][name] for name in ('skin', 'eyes', 'iris', 'pupil', 'lip', 'hair')}
    old = [o for o in ctx['body'] if o.data.materials[0] in old_mats]
    for obj in old:
        ctx['body'].remove(obj)
        ctx['export_objects'].remove(obj)
        bpy.data.objects.remove(obj, do_unlink=True)

    # The body uses a shared neutral photographic detail map, so runtime skin
    # palettes multiply luminance detail instead of tinting an existing hue.
    skin = ctx['M']['skin']
    bsdf = skin.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (.84, .65, .51, 1)
    tex = skin.node_tree.nodes.new('ShaderNodeTexImage')
    tex.name = 'Neutral_Photographic_Skin_Detail'
    tex.image = bpy.data.images.load(str(vendor / 'skin-detail-neutral.png'))
    tex.image.pack()
    tint = skin.node_tree.nodes.new('ShaderNodeMixRGB')
    tint.blend_type = 'MULTIPLY'
    tint.inputs[0].default_value = 1
    tint.inputs[2].default_value = (.59, .385, .255, 1)
    skin.node_tree.links.new(tex.outputs['Color'], tint.inputs[1])
    skin.node_tree.links.new(tint.outputs['Color'], bsdf.inputs['Base Color'])
    normal_tex = skin.node_tree.nodes.new('ShaderNodeTexImage')
    normal_tex.image = bpy.data.images.load(str(vendor / 'skin-normal-1024.png'))
    normal_tex.image.colorspace_settings.name = 'Non-Color'
    normal_tex.image.pack()
    normal = skin.node_tree.nodes.new('ShaderNodeNormalMap')
    normal.inputs['Strength'].default_value = .35
    skin.node_tree.links.new(normal_tex.outputs['Color'], normal.inputs['Color'])
    skin.node_tree.links.new(normal.outputs['Normal'], bsdf.inputs['Normal'])

    def make_part(name, keep_faces, transform, assign):
        subset = [f for f in faces if keep_faces(f)]
        ids = sorted(set(v for f in subset for v, uv in f))
        index = {v: i for i, v in enumerate(ids)}
        obj = ctx['mesh'](name, [tuple(transform(i)) for i in ids], [tuple(index[v] for v, uv in f) for f in subset], skin, [assign(i) for i in ids])
        uv_layer = obj.data.uv_layers.new(name='MakeHuman_UV')
        for polygon, source in zip(obj.data.polygons, subset):
            for loop_index, (v, uv) in zip(polygon.loop_indices, source):
                uv_layer.data[loop_index].uv = uvs[uv]
        return obj

    def head_transform(i):
        point = points[i].copy()
        point.y = point.y * .92 + .043
        point.z -= .018
        if point.z < 1.585:
            blend = min(1, max(0, (point.z - 1.495) / .09))
            radial = math.sqrt((point.x / .056) ** 2 + ((point.y - .006) / .052) ** 2)
            if radial > 1:
                factor = 1 + (1 / radial - 1) * (1 - blend)
                point.x *= factor
                point.y = .006 + (point.y - .006) * factor
        return point

    def head_weights(i):
        z = points[i].z
        blend = min(1, max(0, (z - 1.525) / .05))
        return {'head': blend, 'neck': 1 - blend}

    head = make_part('Human_Head_Neck', lambda face: all(points[i].z > 1.472 and abs(points[i].x) < .115 for i, uv in face), head_transform, head_weights)

    # Use source joint centres to rotate each hand from the MakeHuman rest pose
    # into the existing wrist frame. Continuous palm/finger topology is retained.
    hand_transforms, hand_bone_maps = {}, {}
    finger_names = ('thumb', 'index', 'middle', 'ring', 'pinky')
    for side, suffix in [('R', 'r'), ('L', 'l')]:
        source_hand = source_rig['hand_' + suffix]
        wrist = source_joint(source_hand['head'])
        knuckle = source_joint(source_rig['middle_01_' + suffix]['head'])
        source_axis = (knuckle - wrist).normalized()
        across = source_joint(source_rig['index_01_' + suffix]['head']) - source_joint(source_rig['pinky_01_' + suffix]['head'])
        across = (across - source_axis * across.dot(source_axis)).normalized()
        palm_normal = across.cross(source_axis).normalized()
        source_frame = Matrix(((across.x, source_axis.x, palm_normal.x), (across.y, source_axis.y, palm_normal.y), (across.z, source_axis.z, palm_normal.z)))
        rotation = ctx['REST']['hand.' + side].to_3x3() @ source_frame.inverted()
        target = ctx['HEADS']['hand.' + side]
        def transformed(point, wrist=wrist, rotation=rotation, target=target):
            return target + rotation @ (point - wrist)
        hand_transforms[side] = transformed
        mapping = {'hand_' + suffix: 'hand.' + side, 'lowerarm_' + suffix: 'hand.' + side}
        for finger in finger_names:
            for n in (1, 2, 3):
                mapping[f'{finger}_{n:02d}_{suffix}'] = f'{finger}_{n:02d}.{side}'
        hand_bone_maps[side] = mapping

    bpy.ops.object.select_all(action='DESELECT')
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    for side, suffix in [('R', 'r'), ('L', 'l')]:
        transform = hand_transforms[side]
        mapping = hand_bone_maps[side]
        for finger in finger_names:
            for n in (1, 2, 3):
                source_name = f'{finger}_{n:02d}_{suffix}'
                source = source_rig[source_name]
                b = arm.edit_bones.new(mapping[source_name])
                b.head = transform(source_joint(source['head']))
                b.tail = transform(source_joint(source['tail']))
                b.parent = arm.edit_bones[mapping.get(source['parent'], 'hand.' + side)]
                b.use_connect = n > 1
                b.align_roll(ctx['REST']['hand.' + side].to_3x3().col[2])
    bpy.ops.object.mode_set(mode='OBJECT')
    for b in arm.bones:
        ctx['REST'][b.name] = b.matrix_local.copy()
        ctx['HEADS'][b.name] = b.head_local.copy()
        ctx['TAILS'][b.name] = b.tail_local.copy()
        rig.pose.bones[b.name].rotation_mode = 'QUATERNION'

    for side, suffix in [('R', 'r'), ('L', 'l')]:
        mapping, transform = hand_bone_maps[side], hand_transforms[side]
        assignments, total = {}, {}
        for source, destination in mapping.items():
            for i, value in source_weights[source]:
                assignments.setdefault(i, {})[destination] = assignments.setdefault(i, {}).get(destination, 0) + value
                if source != 'lowerarm_' + suffix:
                    total[i] = total.get(i, 0) + value
        def hand_weights(i):
            values = assignments.get(i, {'hand.' + side: 1})
            norm = sum(values.values())
            return {name: value / norm for name, value in values.items()}
        make_part('Human_Hand.' + side, lambda face: all(total.get(i, 0) > .40 for i, uv in face), lambda i: transform(points[i]), hand_weights)

    # One continuous cloth surface retains the human chest, shoulders, elbow
    # and forearm topology. Source skin weights blend shoulder motion into the
    # torso, so the shoulder seam cannot open into separate rigid parts.
    old_sleeves = [obj for obj in ctx['body'] if obj.name.startswith(('Tailored_Coat', 'Coat_Sleeve.', 'Sleeve_Seam.', 'Shoulder_Join.', 'Crimson_Cuff.', 'Cuff_', 'Shoulder_Epaulette', 'Epaulette_Fringe'))]
    for obj in old_sleeves:
        ctx['body'].remove(obj)
        ctx['export_objects'].remove(obj)
        bpy.data.objects.remove(obj, do_unlink=True)
    assignments, transforms, mapped, arm_total, hand_total = {}, {}, {}, {}, {}
    torso_mapping = {'Root': 'hips', 'pelvis': 'hips', 'spine_01': 'spine', 'spine_02': 'spine', 'spine_03': 'chest', 'neck_01': 'neck', 'head': 'neck', 'clavicle_r': 'chest', 'clavicle_l': 'chest', 'thigh_l': 'hips', 'thigh_r': 'hips'}
    def body_transform(p):
        return Vector((p.x * .88, p.y * .82 + .016, p.z - .020))
    for source, destination in torso_mapping.items():
        mapped[source] = destination
        transforms[source] = body_transform
    for side, suffix in [('R', 'r'), ('L', 'l')]:
        for source, destination in {'upperarm_' + suffix: 'upper_arm.' + side, 'lowerarm_' + suffix: 'forearm.' + side}.items():
            spec = source_rig[source]
            a, b = source_joint(spec['head']), source_joint(spec['tail'])
            target_a, target_b = ctx['HEADS'][destination], ctx['TAILS'][destination]
            rotation = (b - a).normalized().rotation_difference((target_b - target_a).normalized())
            ratio = (target_b - target_a).length / (b - a).length
            transforms[source] = lambda point, a=a, target_a=target_a, rotation=rotation, ratio=ratio: target_a + rotation @ (point - a) * ratio
            mapped[source] = destination
            for i, value in source_weights[source]:
                arm_total[i] = arm_total.get(i, 0) + value
        for source in hand_bone_maps[side]:
            if source.startswith('lowerarm'):
                continue
            for i, value in source_weights[source]:
                hand_total[i] = hand_total.get(i, 0) + value
    for source in mapped:
        for i, value in source_weights[source]:
            assignments.setdefault(i, {})[source] = value
    subset = [face for face in faces if all(hand_total.get(i, 0) < .35 and ((.955 < points[i].z < 1.545) or arm_total.get(i, 0) > .30) for i, uv in face)]
    ids = sorted(set(i for face in subset for i, uv in face))
    index = {v: i for i, v in enumerate(ids)}
    transformed, mapped_weights = [], []
    for i in ids:
        weight = assignments.get(i, {'spine_03': 1})
        norm = sum(weight.values())
        p = sum((transforms[source](points[i]) * value / norm for source, value in weight.items()), Vector())
        transformed.append(tuple(p))
        values = {}
        for source, value in weight.items():
            values[mapped[source]] = values.get(mapped[source], 0) + value / norm
        mapped_weights.append(values)
    sleeve = ctx['mesh']('Continuous_Anatomical_Coat', transformed, [tuple(index[i] for i, uv in f) for f in subset], ctx['M']['navy'], mapped_weights)
    sleeve.data.update()
    elbows = [ctx['HEADS']['forearm.' + side] for side in ('R', 'L')]
    for vertex in sleeve.data.vertices:
        distance = min((vertex.co - elbow).length for elbow in elbows)
        crease = .003 * math.sin(distance * 150) * math.exp(-((distance - .050) / .060) ** 2)
        crease += .0025 * math.sin(vertex.co.z * 120 + vertex.co.x * 40) * math.exp(-((vertex.co.z - 1.06) / .09) ** 2)
        vertex.co += vertex.normal * (.009 + crease)
        if vertex.co.z > 1.46 and abs(vertex.co.x) < .13:
            blend = min(1, (vertex.co.z - 1.46) / .04)
            radial = math.sqrt((vertex.co.x / .055) ** 2 + ((vertex.co.y - .016) / .055) ** 2)
            if radial > 1:
                factor = 1 + (1 / radial - 1) * blend
                vertex.co.x *= factor
                vertex.co.y = .016 + (vertex.co.y - .016) * factor
    # Tailoring: smooth chest muscle landmarks into wool, retain joint anatomy.
    smooth = sleeve.modifiers.new('Cloth_Smoothing', 'SMOOTH')
    smooth.factor = .55
    smooth.iterations = 5
    bpy.context.view_layer.objects.active = sleeve
    bpy.ops.object.modifier_move_up(modifier=smooth.name)
    bpy.ops.object.modifier_apply(modifier=smooth.name)
    # Close the upper neckline below the collar. No disconnected shoulder cap
    # is used; the continuous torso/arm topology carries the complete seam.
    bm = bmesh.new()
    bm.from_mesh(sleeve.data)
    neck_edges = [edge for edge in bm.edges if edge.is_boundary and min(vertex.co.z for vertex in edge.verts) > 1.36]
    if neck_edges:
        bmesh.ops.holes_fill(bm, edges=neck_edges, sides=0)
    bm.to_mesh(sleeve.data)
    bm.free()
    sleeve.data.update()
    # Fit surface details to the new tailored cloth. Ray casts sample its actual
    # chest/waist surface rather than the old oval torso approximation.
    old_details = [obj for obj in ctx['body'] if obj.name.startswith(('Front_Diagonal', 'Back_Diagonal', 'Brass_Coat_Button', 'Front_Red_Piping_', 'Waist_Belt'))]
    for obj in old_details:
        ctx['body'].remove(obj)
        ctx['export_objects'].remove(obj)
        bpy.data.objects.remove(obj, do_unlink=True)
    def coat_surface(x, z, back=False):
        origin = Vector((x, 1 if back else -1, z))
        direction = Vector((0, -1 if back else 1, 0))
        hit, point, normal, face = sleeve.ray_cast(origin, direction)
        return tuple(point + normal * .005) if hit else (x, .08 if back else -.11, z)
    for back in (False, True):
        points_belt = []
        for n in range(31):
            t = n / 30
            x, z = .162 - .280 * t, 1.436 - .416 * t
            points_belt.append(coat_surface(x, z, back))
        ctx['ribbon']('Fitted_Back_Diagonal_Crossbelt' if back else 'Fitted_Front_Diagonal_Crossbelt', points_belt, .044, .006, ctx['M']['cream'], ctx['weights_for_z'])
    front = Vector(coat_surface(.162, 1.436, False))
    back = Vector(coat_surface(.162, 1.436, True))
    over_shoulder = []
    for n in range(13):
        t = n / 12
        y = front.y + (back.y - front.y) * t
        hit, point, normal, face = sleeve.ray_cast(Vector((.162, y, 1.9)), Vector((0, 0, -1)))
        over_shoulder.append(tuple(point + Vector((0, 0, .004))) if hit else (.162, y, 1.46))
    ctx['ribbon']('Fitted_Crossbelt_Shoulder', over_shoulder, .044, .006, ctx['M']['cream'], 'chest')
    for sign in (-1, 1):
        piping = []
        for z in (1.066, 1.134, 1.207, 1.281, 1.352):
            x = sign * (.068 + .020 * (z - 1.066) / .286)
            point = coat_surface(x, z)
            piping.append(point)
            ctx['ellipsoid']('Fitted_Brass_Coat_Button', point, (.0067, .004, .0067), ctx['M']['brass'], 'spine' if z < 1.22 else 'chest', segments=12, rings=7)
        ctx['ribbon']('Fitted_Front_Red_Piping_' + str(sign), piping, .0032, .003, ctx['M']['red'], ctx['weights_for_z'])
    belt_vertices = []
    for z in (1.008, 1.040):
        for n in range(48):
            angle = n * math.tau / 48
            normal = Vector((math.cos(angle), math.sin(angle), 0))
            hit, point, surface_normal, face = sleeve.ray_cast(Vector((0, .016, z)) + normal, -normal)
            if not hit:
                point = Vector((.135 * normal.x, .016 + .108 * normal.y, z))
            belt_vertices.append(tuple(point + normal * .004))
    belt_faces = [(n, (n + 1) % 48, (n + 1) % 48 + 48, n + 48) for n in range(48)]
    ctx['mesh']('Fitted_White_Waist_Belt', belt_vertices, belt_faces, ctx['M']['cream'], [{'hips': 1}] * len(belt_vertices))
    for side in ('R', 'L'):
        forearm = 'forearm.' + side
        wrist = ctx['HEADS']['hand.' + side]
        direction = (ctx['TAILS'][forearm] - ctx['HEADS'][forearm]).normalized()
        ctx['tube']('Fitted_Navy_Cuff.' + side, [tuple(wrist - direction * .075), tuple(wrist - direction * .012)], [.038, .033], ctx['M']['navy'], forearm, segments=20)
        ctx['tube']('Fitted_Cuff_Red_Piping.' + side, [tuple(wrist - direction * .025), tuple(wrist - direction * .018)], [.035, .0348], ctx['M']['red'], forearm, segments=20)
        ctx['tube']('Fitted_Cuff_Gold_Piping.' + side, [tuple(wrist - direction * .031), tuple(wrist - direction * .028)], [.0355, .0354], ctx['M']['brass'], forearm, segments=20)
        shoulder = ctx['HEADS']['upper_arm.' + side]
        sign = -1 if side == 'R' else 1
        w = {'chest': .60, 'upper_arm.' + side: .40}
        center = shoulder + Vector((sign * .012, 0, .028))
        hit, top_point, normal, face = sleeve.ray_cast(Vector((center.x, center.y, 1.9)), Vector((0, 0, -1)))
        if hit:
            center.z = top_point.z + .010
        ctx['ellipsoid']('Fitted_Epaulette_Trim.' + side, tuple(center), (.040, .055, .006), ctx['M']['cream'], w, segments=18, rings=8)
        ctx['ellipsoid']('Fitted_Crimson_Epaulette.' + side, tuple(center + Vector((0, 0, .004))), (.035, .050, .006), ctx['M']['red'], w, segments=18, rings=8)
        for n in range(12):
            y = -.046 + n * .0083
            ctx['tube']('Fitted_Epaulette_Fringe.' + side, [tuple(Vector((center.x + sign * .034, y, center.z - .001))), tuple(Vector((center.x + sign * .036, y, center.z - .046)))], [.0028, .0021], ctx['M']['red'], [w, w], segments=6)

    # Eye sockets/eyelids are part of the human topology. Only the small globes,
    # irises and pupils use separate materials and remain immune to skin tint.
    for side, suffix in [('R', 'r'), ('L', 'l')]:
        center = source_joint({'cube_name': 'joint-' + suffix + '-eye'})
        center.y = center.y * .92 + .043
        center.z -= .018
        ctx['ellipsoid']('Human_Eyeball.' + side, tuple(center), (.0113, .0113, .0108), ctx['M']['eyes'], 'head', segments=20, rings=14)
        iris = center + Vector((0, -.0106, 0))
        ctx['ellipsoid']('Human_Iris.' + side, tuple(iris), (.0044, .0013, .0044), ctx['M']['iris'], 'head', segments=18, rings=10)
        pupil = center + Vector((0, -.0116, 0))
        ctx['ellipsoid']('Human_Pupil.' + side, tuple(pupil), (.0020, .0008, .0020), ctx['M']['pupil'], 'head', segments=14, rings=8)

    return {'source': 'MakeHuman hm08 adult male morphology + Mindfront Aksel CC0 skin details', 'scale': scale, 'vertices': sum(len(o.data.vertices) for o in ctx['body'] if o.name.startswith('Human_')), 'headVertices': len(head.data.vertices), 'fingerBones': 30}


def fabric_materials(ctx):
    """Embed original woven wool detail; keep reflective metals untextured."""
    size = 256
    color = bpy.data.images.new('Original_Wool_Weave', size, size)
    normal = bpy.data.images.new('Original_Wool_Normal', size, size)
    pixels, normals = [], []
    for y in range(size):
        for x in range(size):
            weave = .91 + .035 * math.sin(x * 1.7) * math.sin(y * 1.7) + .018 * math.sin(x * 13.3 + y * 9.7)
            pixels.extend((weave, weave, weave, 1))
            nx, ny = .065 * math.sin(x * 1.7), .065 * math.sin(y * 1.7)
            nz = math.sqrt(1 - nx * nx - ny * ny)
            normals.extend(((nx + 1) / 2, (ny + 1) / 2, (nz + 1) / 2, 1))
    color.pixels.foreach_set(pixels)
    normal.pixels.foreach_set(normals)
    normal.colorspace_settings.name = 'Non-Color'
    color.pack()
    normal.pack()
    wool = {ctx['M'][key] for key in ('navy', 'trousers', 'red', 'cream')}
    for mat in wool:
        bsdf = mat.node_tree.nodes.get('Principled BSDF')
        factor = bsdf.inputs['Base Color'].default_value[:]
        tex = mat.node_tree.nodes.new('ShaderNodeTexImage')
        tex.image = color
        mix = mat.node_tree.nodes.new('ShaderNodeMixRGB')
        mix.blend_type = 'MULTIPLY'
        mix.inputs[0].default_value = 1
        mix.inputs[2].default_value = factor
        mat.node_tree.links.new(tex.outputs['Color'], mix.inputs[1])
        mat.node_tree.links.new(mix.outputs['Color'], bsdf.inputs['Base Color'])
        normal_tex = mat.node_tree.nodes.new('ShaderNodeTexImage')
        normal_tex.image = normal
        normal_node = mat.node_tree.nodes.new('ShaderNodeNormalMap')
        normal_node.inputs['Strength'].default_value = .22
        mat.node_tree.links.new(normal_tex.outputs['Color'], normal_node.inputs['Color'])
        mat.node_tree.links.new(normal_node.outputs['Normal'], bsdf.inputs['Normal'])
    for obj in ctx['joined']:
        if obj.data.materials[0] not in wool:
            continue
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=.008)
        bpy.ops.object.mode_set(mode='OBJECT')
