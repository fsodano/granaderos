"""Geometric panel normals for the two coarse Gaucho poncho jobs.

Run after the unchanged LOD reduction, before atlas packing and outfit join.
Positions, oriented triangles, colour, UVs and native weights stay unchanged.
A private patch export lets composition retain every other native corner.
"""
from pathlib import Path
import hashlib
import bpy

JOBS = {('gaucho', 1): 'Gaucho_Poncho', ('gaucho', 2): 'Gaucho_Poncho'}


def _weights(obj, vertex):
    values = [(obj.vertex_groups[group.group].name, group.weight)
              for group in vertex.groups if group.weight > 0]
    assert len(values) <= 4, 'The ordinary reduced poncho must have four weights'
    return sorted(values)


def prepare(ctx, lod):
    if ctx.get('source_kind', 'appearance') != 'appearance':
        return None
    name = JOBS.get((ctx['preset'], lod))
    if name is None:
        return None
    matches = [obj for obj in ctx['objects'] if obj.name == name]
    assert len(matches) == 1, 'Missing unique coarse poncho: ' + name
    obj = matches[0]
    return {'object': obj, 'material': obj.data.materials[0], 'built': False,
            'facts': {'version': 1, 'preset': ctx['preset'], 'lod': lod,
                      'method': 'coarse-poncho-geometric-face-normals',
                      'sourceSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                      'ownedObject': name, 'ownedPart': 'outfit',
                      'initialOffset': 0, 'maximumOffset': 0,
                      'minimumRestGap': 0, 'fitIncrement': 0}}


def after_reduction(ctx, obj, plan):
    if plan is None or obj != plan['object']:
        return
    before = [tuple(poly.vertices) for poly in obj.data.polygons]
    positions = [list(vertex.co) for vertex in obj.data.vertices]
    for poly in obj.data.polygons:
        poly.use_smooth = False
    obj.data.update()
    assert before == [tuple(poly.vertices) for poly in obj.data.polygons]
    assert positions == [list(vertex.co) for vertex in obj.data.vertices]
    plan['built'] = True
    plan['facts'].update(shellTriangles=sum(len(poly.vertices) - 2 for poly in obj.data.polygons),
                         ponchoVertices=[{'id': v.index, 'position': list(v.co),
                                          'weights': _weights(obj, v)} for v in obj.data.vertices],
                         ponchoTriangles=[{'id': p.index, 'vertices': list(p.vertices),
                                           'normal': list(p.normal)} for p in obj.data.polygons],
                         unchangedPositionsAndOrientedPolygons=True)


def capture_packed(ctx, obj, plan, sources, side, tile):
    if plan is None or obj != plan['object']:
        return
    assert plan['built']
    patch = obj.copy()
    patch.data = obj.data.copy()
    patch.name = obj.name + '_Coarse_Donor'
    bpy.context.collection.objects.link(patch)
    ctx['coarse_patch_object'] = patch
    material = plan['material']
    index = sources.index(material)
    bs = material.node_tree.nodes.get('Principled BSDF')
    facts = plan['facts']
    facts['sourceMaterial'] = {'name': material.name, 'baseColorLinear': list(material.diffuse_color),
                               'roughness': bs.inputs['Roughness'].default_value,
                               'metallic': bs.inputs['Metallic'].default_value,
                               'atlasIndex': index, 'atlasTile': [index % side, index // side],
                               'constantUV': [(index % side + 2 / tile) / side,
                                              1 - (index // side + 2 / tile) / side]}
    facts['sourceMaterialInventory'] = [m.name for m in sources]
    used = sorted({index for poly in obj.data.polygons for index in poly.vertices})
    facts['bounds'] = {'minimum': [min(obj.data.vertices[index].co[axis] for index in used) for axis in range(3)],
                       'maximum': [max(obj.data.vertices[index].co[axis] for index in used) for axis in range(3)]}
    facts['indexedVertices'] = len(used)
    facts['coordinateSystem'] = 'Blender Z-up metres; glTF [x,y,z] = source [x,z,-y]'
    ctx['coarse_garment_surface'] = facts


def proposal(facts):
    """Canonical ordered corners survive the exporter's flat-normal splits."""
    y_up = lambda p: [p[0], p[2], -p[1]]
    vertices = {v['id']: v for v in facts['ponchoVertices']}
    rows = []
    for triangle in facts['ponchoTriangles']:
        assert len(triangle['vertices']) == 3
        rows.append({'id': triangle['id'], 'faceNormal': y_up(triangle['normal']),
                     'corners': [{'position': y_up(vertices[index]['position']),
                                  'weights': vertices[index]['weights'], 'sourceVertex': index}
                                 for index in triangle['vertices']]})
    return {'version': 1, 'preset': facts['preset'], 'lod': facts['lod'], 'role': 'poncho',
            'method': facts['method'], 'sourceSha256': facts['sourceSha256'],
            'sourceMaterial': facts['sourceMaterial'],
            'sourceMaterialInventory': facts['sourceMaterialInventory'],
            'atlasAnchor': facts['sourceMaterial']['constantUV'],
            'patchUrl': Path(facts['patch']['url']).name, 'patch': facts['patch'],
            'initialOffset': 0, 'maximumOffset': 0, 'actualOffset': 0, 'addedOffset': 0,
            'minimumRestGap': 0, 'restClearance': None,
            'boundsZUp': facts['bounds'], 'sourceTriangleRows': rows,
            'coordinateSystem': 'glTF Y-up metres; source corner IDs refer to the pre-join poncho'}
