#!/usr/bin/env python3
"""Graft two bounded native poncho normal patches below the frozen colour layers.

Only owned constant-UV poncho normals may change. Every old
binary byte remains an exact prefix; other triangles retain their original
indices and attribute rows. The original complete body and record are exactly
recoverable. Source patches never replace a complete outfit or body.
"""
from pathlib import Path
import argparse
import copy
import hashlib
import importlib.util
import json
import math
import struct
import subprocess
import sys
import tempfile

FIELD = 'coarseGarmentSurface'
TARGETS = {
    ('gaucho', 1): {'role': 'poncho', 'anchor': [0.015625, 0.984375], 'oldTriangles': 414, 'maxGrowth': 0, 'maxOffset': 0},
    ('gaucho', 2): {'role': 'poncho', 'anchor': [0.015625, 0.984375], 'oldTriangles': 154, 'maxGrowth': 0, 'maxOffset': 0},
}
FORMAT = {5120: 'b', 5121: 'B', 5122: 'h', 5123: 'H', 5125: 'I', 5126: 'f'}
WIDTH = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path); result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result); return result


def sha(raw): return hashlib.sha256(raw).hexdigest()


def json_sha(value):
    encoded = subprocess.check_output(['node', '-e', "let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',v=>s+=v);function stable(v){if(Array.isArray(v))return v.map(stable);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));return v;}process.stdin.on('end',()=>process.stdout.write(JSON.stringify(stable(JSON.parse(s)))));"], input=json.dumps(value), text=True)
    return sha(encoded.encode())


def encode_glb(doc, binary):
    assert len(binary) % 4 == 0 and doc['buffers'] == [{'byteLength': len(binary)}], 'Unaligned garment body'
    encoded = json.dumps(doc, separators=(',', ':')).encode(); encoded += b' ' * (-len(encoded) % 4)
    return (struct.pack('<III', 0x46546c67, 2, 28 + len(encoded) + len(binary))
            + struct.pack('<II', len(encoded), 0x4e4f534a) + encoded
            + struct.pack('<II', len(binary), 0x004e4942) + bytes(binary))


def rows(doc, binary, index):
    accessor = doc['accessors'][index]; assert 'sparse' not in accessor, 'Unexpected sparse outfit attribute'
    width = WIDTH[accessor['type']]; fmt = FORMAT[accessor['componentType']]; size = struct.calcsize('<' + fmt * width)
    view = doc['bufferViews'][accessor['bufferView']]; assert view.get('buffer', 0) == 0
    start = view.get('byteOffset', 0) + accessor.get('byteOffset', 0); stride = view.get('byteStride', size)
    return [struct.unpack_from('<' + fmt * width, binary, start + index * stride) for index in range(accessor['count'])]


def append_rows(doc, binary, source, values, *, indices=False):
    accessor = {key: copy.deepcopy(value) for key, value in source.items() if key in ('componentType', 'type', 'normalized')}
    width = WIDTH[accessor['type']]; assert values and all(len(row) == width for row in values)
    raw = struct.pack('<' + FORMAT[accessor['componentType']] * len(values) * width, *(item for row in values for item in row))
    binary.extend(b'\0' * (-len(binary) % 4)); offset = len(binary); binary.extend(raw)
    accessor.update(bufferView=len(doc['bufferViews']), count=len(values))
    if accessor['componentType'] == 5126:
        accessor['min'] = [min(row[axis] for row in values) for axis in range(width)]
        accessor['max'] = [max(row[axis] for row in values) for axis in range(width)]
    doc['bufferViews'].append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(raw), 'target': 34963 if indices else 34962})
    doc['accessors'].append(accessor); return len(doc['accessors']) - 1


def primitive_for(doc, lod):
    matches = [node['mesh'] for node in doc['nodes'] if node.get('name') == f'Human_outfit_LOD{lod}']
    assert len(matches) == 1, 'Missing or duplicate owned outfit'
    mesh = matches[0]; assert len(doc['meshes'][mesh]['primitives']) == 1, 'Unexpected outfit draw inventory'
    primitive = doc['meshes'][mesh]['primitives'][0]
    assert primitive.get('mode', 4) == 4 and not primitive.get('targets'), 'Outfit must be native triangles without cloth targets'
    assert set(primitive['attributes']) == {'POSITION', 'NORMAL', 'TEXCOORD_0', 'COLOR_0', 'JOINTS_0', 'WEIGHTS_0'}, 'Unexpected outfit attribute inventory'
    return mesh, primitive


def triangles(doc, binary, primitive):
    indices = [row[0] for row in rows(doc, binary, primitive['indices'])]
    assert len(indices) % 3 == 0; return [indices[index:index + 3] for index in range(0, len(indices), 3)]


def owned_mask(doc, binary, primitive, anchor):
    uv = rows(doc, binary, primitive['attributes']['TEXCOORD_0'])
    return [index for index, triangle in enumerate(triangles(doc, binary, primitive))
            if all(all(abs(uv[vertex][axis] - anchor[axis]) < 1e-7 for axis in range(2)) for vertex in triangle)]


def stream_hash(doc, binary, primitive, mask, *, exclude=()):
    values = {key: rows(doc, binary, index) for key, index in primitive['attributes'].items() if key not in exclude}
    selected = triangles(doc, binary, primitive)
    # Hash raw component values in oriented triangle/corner order, independent
    # of exporter splits or accessor indices, while retaining all material roles.
    stream = bytearray()
    for triangle_index in mask:
        for vertex in selected[triangle_index]:
            for semantic in sorted(values):
                fmt = FORMAT[doc['accessors'][primitive['attributes'][semantic]]['componentType']]
                stream.extend(struct.pack('<' + fmt * len(values[semantic][vertex]), *values[semantic][vertex]))
    return sha(bytes(stream))


def _rig(doc, binary):
    assert len(doc['skins']) == 1, 'Unexpected patch skin inventory'
    skin = doc['skins'][0]; joints = skin['joints']; names = [doc['nodes'][index]['name'] for index in joints]
    assert len(names) == 53 and len(set(names)) == 53, 'Patch does not use the native rig'
    parents = {child: index for index, node in enumerate(doc['nodes']) for child in node.get('children', [])}
    pose = {name: {key: copy.deepcopy(doc['nodes'][index][key]) for key in ('translation', 'rotation', 'scale', 'matrix') if key in doc['nodes'][index]}
            for name, index in zip(names, joints)}
    hierarchy = {name: doc['nodes'][parents[index]].get('name') if index in parents else None for name, index in zip(names, joints)}
    binds = dict(zip(names, rows(doc, binary, skin['inverseBindMatrices'])))
    return names, pose, hierarchy, binds


def _patch_primitive(doc):
    primitives = [primitive for mesh in doc['meshes'] for primitive in mesh['primitives']]
    assert len(primitives) == 1, 'A garment patch must contain exactly one mesh primitive'
    primitive = primitives[0]
    assert primitive.get('mode', 4) == 4 and not primitive.get('targets'), 'Patch contains unsupported geometry'
    assert set(primitive['attributes']) == {'POSITION', 'NORMAL', 'TEXCOORD_0', 'COLOR_0', 'JOINTS_0', 'WEIGHTS_0'}, 'Patch attribute inventory differs'
    return primitive


def _near(a, b, tolerance=1e-6):
    return len(a) == len(b) and all(abs(x - y) <= tolerance for x, y in zip(a, b))


def _cross(a, b): return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])
def _sub(a, b): return tuple(x-y for x,y in zip(a,b))
def _dot(a, b): return sum(x*y for x,y in zip(a,b))
def _norm(a): return math.sqrt(_dot(a,a))


def recipe_for(root):
    paths = ['assets/source/characters-3d/authoring/coarse_garment_surfaces.py',
             'tools/characters-3d/build-coarse-garment-surfaces.py',
             'tools/characters-3d/coarse_garment_context.py', 'tools/characters-3d/family_fold_context.py']
    return {'method':'bounded-native-outfit-graft-v1', 'sourceSha256':{path:sha((root/path).read_bytes()) for path in paths},
            'targets':[{'preset':preset,'lod':lod,**limits} for (preset,lod),limits in TARGETS.items()],
            'retainedOriginalBinaryAndUnownedTriangles':True}


def restore_record(record):
    restored=copy.deepcopy(record); meta=restored.pop(FIELD)
    restored.update(bytes=meta['beforeBytes'],sha256=meta['beforeSha256'],triangles=meta['beforeTriangles'])
    assert json_sha(restored)==meta['originalRecordJSONSha256'], 'Original correction LOD record changed'
    return restored


def restore_body(doc,binary,metadata):
    restored=copy.deepcopy(doc)
    assert restored.get('extras',{}).get(FIELD)==metadata, 'Inconsistent coarse garment receipt'
    item=metadata['primitive']; primitive=restored['meshes'][item['mesh']]['primitives'][item['primitive']]
    assert primitive['attributes']==item['attributes'] and primitive['indices']==item['indices'], 'Changed coarse garment bindings'
    primitive['attributes']=copy.deepcopy(item['originalAttributes']); primitive['indices']=item['originalIndices']
    restored['accessors']=restored['accessors'][:metadata['originalAccessorCount']]
    restored['bufferViews']=restored['bufferViews'][:metadata['originalViewCount']]
    restored['buffers']=copy.deepcopy(metadata['originalBuffers'])
    del restored['extras'][FIELD]
    if not metadata['originalHadExtras']: del restored['extras']
    old_binary=bytes(binary[:metadata['originalBinaryBytes']])
    assert sha(old_binary)==metadata['originalBinarySha256'], 'Retained correction binary changed'
    assert json_sha(restored)==metadata['originalJSONSha256'], 'Retained correction JSON changed'
    assert sha(encode_glb(restored,old_binary))==metadata['beforeSha256'], 'Exact correction predecessor differs from historical SHA'
    return restored,old_binary


def _verify_native(doc,binary,record,recipe,root=None):
    meta=record[FIELD]; assert meta['recipe']==recipe, 'Changed coarse garment source recipe'
    assert (meta['preset'],record['lod']) in TARGETS and meta['lod']==record['lod'] and Path(record['url']).name==f"{meta['preset']}-lod{meta['lod']}.glb", 'Completed correction identity differs from its selected body'
    assert meta['role']==TARGETS[(meta['preset'],record['lod'])]['role'], 'Completed correction garment role differs'
    assert meta['sourceProof']['sourceSha256']==recipe['sourceSha256']['assets/source/characters-3d/authoring/coarse_garment_surfaces.py'], 'Completed correction export source differs from its recipe'
    assert doc.get('extras',{}).get(FIELD)==meta, 'Inconsistent completed coarse garment metadata'
    assert not set(record).intersection(('clothDepth','familyClothDepth','apparelSurface')), 'Verify correction on the explicitly unwrapped native body'
    assert type(meta['primitive']['primitive']) is int and meta['primitive']['primitive']==0, 'Completed correction names an unowned primitive'
    before,old_binary=restore_body(doc,binary,meta); restore_record(record)
    mesh,primitive=primitive_for(doc,record['lod']); old_mesh,old_primitive=primitive_for(before,record['lod'])
    item=meta['primitive']; assert mesh==old_mesh==item['mesh'] and primitive['material']==old_primitive['material'], 'Correction changes owned material or draw role'
    limits=TARGETS[(meta['preset'],record['lod'])]; old_mask=owned_mask(before,old_binary,old_primitive,limits['anchor'])
    assert all(type(index) is int for index in item['oldOwnedTriangles']+item['ownedTriangles']), 'Completed correction triangle masks require native integer indices'
    assert old_mask==item['oldOwnedTriangles'] and len(old_mask)==limits['oldTriangles'], 'Original owned triangle mask changed'
    new_mask=owned_mask(doc,binary,primitive,limits['anchor']); assert new_mask==item['ownedTriangles'], 'Current owned triangle mask changed'
    old_count=before['accessors'][old_primitive['attributes']['POSITION']]['count']
    assert type(item['originalVertexCount']) is int and type(item['patchVertexCount']) is int and item['originalVertexCount']==old_count and item['patchVertexCount']==3*len(new_mask), 'Completed correction corner counts differ from its retained and split geometry'
    assert all(doc['accessors'][index]['count']==old_count+item['patchVertexCount'] for index in primitive['attributes'].values()), 'Completed correction attributes have inconsistent corner counts'
    old_tris=triangles(before,old_binary,old_primitive); new_tris=triangles(doc,binary,primitive)
    assert [new_tris[index] for index in new_mask]==[[old_count+3*index+corner for corner in range(3)] for index in range(len(new_mask))], 'Completed correction split corner indices differ'
    unowned=[index for index in range(len(old_tris)) if index not in set(old_mask)]
    assert len(new_tris)==len(unowned)+len(old_mask) and new_mask==list(range(len(unowned),len(new_tris))), 'Completed correction contains unaccounted outfit triangles'
    assert new_tris[:len(unowned)]==[old_tris[index] for index in unowned], 'Unowned outfit triangle indices changed'
    for semantic,index in old_primitive['attributes'].items():
        old=rows(before,old_binary,index); new=rows(doc,binary,primitive['attributes'][semantic])
        assert new[:len(old)]==old, 'Unowned native attribute rows changed'
    # Raw corner hashes do not describe normalized interpretation, bounds,
    # element formats or view lengths. Rebuild the deterministic packing
    # contract from the retained body and the checked active rows.
    packed=copy.deepcopy(before);packed_binary=bytearray(old_binary);packed_primitive=packed['meshes'][mesh]['primitives'][0]
    for semantic,index in old_primitive['attributes'].items():
        packed_primitive['attributes'][semantic]=append_rows(packed,packed_binary,before['accessors'][index],rows(doc,binary,primitive['attributes'][semantic]))
    packed_primitive['indices']=append_rows(packed,packed_binary,{'componentType':5123 if old_count+item['patchVertexCount']<=65536 else 5125,'type':'SCALAR'},[(vertex,) for triangle in new_tris for vertex in triangle],indices=True)
    packed_binary.extend(b'\0'*(-len(packed_binary)%4));packed['buffers']=[{'byteLength':len(packed_binary)}]
    assert doc['accessors']==packed['accessors'] and doc['bufferViews']==packed['bufferViews'] and doc['buffers']==packed['buffers'] and primitive==packed_primitive, 'Completed correction appended accessors or views differ from their packed contract'
    assert bytes(binary)==bytes(packed_binary), 'Completed correction appended binary differs from its packed contract'
    assert stream_hash(before,old_binary,old_primitive,unowned)==item['unownedStreamSha256']==stream_hash(doc,binary,primitive,range(len(unowned))), 'Unowned corner/material UV data changed'
    assert stream_hash(before,old_binary,old_primitive,old_mask)==item['oldOwnedStreamSha256'], 'Original owned garment stream changed'
    assert stream_hash(doc,binary,primitive,new_mask)==item['ownedStreamSha256'], 'Delivered owned garment data changed'
    assert len(new_mask)-len(old_mask)<=limits['maxGrowth'], 'Owned garment exceeds triangle budget'
    assert record['drawCalls']==meta['beforeDrawCalls'] and record['triangles']==meta['beforeTriangles']+len(new_mask)-len(old_mask), 'Correction triangle/draw receipt differs'
    if limits['role']=='poncho':
        assert len(new_mask)==len(old_mask), 'Poncho changes triangle count'
        assert stream_hash(before,old_binary,old_primitive,old_mask,exclude=('NORMAL',))==stream_hash(doc,binary,primitive,new_mask,exclude=('NORMAL',)), 'Poncho changes oriented geometry, UV, colour or skin weights'
        position=rows(doc,binary,primitive['attributes']['POSITION']);normal=rows(doc,binary,primitive['attributes']['NORMAL'])
        for index in new_mask:
            triangle=new_tris[index]; face=_cross(_sub(position[triangle[1]],position[triangle[0]]),_sub(position[triangle[2]],position[triangle[0]]));length=_norm(face)
            assert length>1e-10 and all(abs(_norm(normal[vertex])-1)<1e-5 and _dot(face,normal[vertex])/length>.999 for vertex in triangle), 'Poncho corner normal is not a unit geometric panel normal'
    return {'preset':meta['preset'],'lod':record['lod'],'triangles':len(new_mask),'restorationExact':True,'unownedTrianglesExact':True,'repeat':True}


def prepare_body(root,doc,binary,record,patch_path,proposal_path,*,recorded_source=False):
    root=Path(root).resolve(); recipe=recipe_for(root); proposal=json.loads(Path(proposal_path).read_bytes())
    preset,lod=proposal['preset'],proposal['lod']; assert (preset,lod) in TARGETS and record['lod']==lod and Path(record['url']).name==f'{preset}-lod{lod}.glb', 'Wrong selected correction identity'
    assert not set(record).intersection((FIELD,'clothDepth','familyClothDepth','apparelSurface')), 'Graft requires an explicitly restored native predecessor'
    limits=TARGETS[(preset,lod)]; assert proposal['role']==limits['role'] and _near(proposal['atlasAnchor'],limits['anchor'],1e-7), 'Source changes original garment role'
    assert proposal['sourceSha256']==recipe['sourceSha256']['assets/source/characters-3d/authoring/coarse_garment_surfaces.py'], 'Source patch recipe changed after export'
    if not recorded_source:
        source_fact=proposal['patch'];raw_patch=Path(patch_path).read_bytes()
        assert source_fact['sha256']==sha(raw_patch) and source_fact['bytes']==len(raw_patch), 'Source patch bytes differ from export proof'
    glb=module('coarse_patch_glb',root/'tools/characters-3d/merge-animation-bank.py'); patch_doc,patch_binary=glb.read_glb(Path(patch_path)); patch=_patch_primitive(patch_doc)
    names,pose,hierarchy,binds=_rig(doc,binary); patch_names,patch_pose,patch_hierarchy,patch_binds=_rig(patch_doc,patch_binary)
    assert pose==patch_pose and hierarchy==patch_hierarchy and all(_near(binds[name],patch_binds[name]) for name in names), 'Patch rig, rest transforms or bind matrices differ'
    mesh,primitive=primitive_for(doc,lod); roles=module('coarse_patch_roles',root/'tools/characters-3d/cloth_material_roles.py')
    assert roles.material_signature(doc,doc['materials'][primitive['material']])==roles.material_signature(patch_doc,patch_doc['materials'][patch['material']]), 'Patch changes original outfit material or map roles'
    assets=root/'web/public/models/characters'
    for image in patch_doc.get('images',[]):
        uri=image['uri']; assert (assets/uri).read_bytes()==(Path(patch_path).parent/uri).read_bytes(), 'Patch changes original colour/MR/normal map bytes'
    old_mask=owned_mask(doc,binary,primitive,limits['anchor']); assert len(old_mask)==limits['oldTriangles'], 'Original owned role mask differs from approved source'
    patch_tris=triangles(patch_doc,patch_binary,patch)
    assert owned_mask(patch_doc,patch_binary,patch,limits['anchor'])==list(range(len(patch_tris))), 'Patch contains an unowned pigment or UV role'
    assert len(patch_tris)-len(old_mask)<=limits['maxGrowth'] and patch_tris, 'Patch exceeds approved triangle budget'
    before=copy.deepcopy(doc); old_binary=bytes(binary); old_record=copy.deepcopy(record); next_doc=copy.deepcopy(doc);next_binary=bytearray(binary)
    next_primitive=next_doc['meshes'][mesh]['primitives'][0]
    native_values={key:rows(doc,binary,index) for key,index in primitive['attributes'].items()}
    patch_values={key:rows(patch_doc,patch_binary,index) for key,index in patch['attributes'].items()}
    if limits['role']=='poncho':
        # Standalone glTF export introduces tiny transform round-off. Import
        # only the intended geometric normal and keep all retained native
        # corner data byte-exact, including position and old base COLOR_0.
        source_triangles=triangles(patch_doc,patch_binary,patch)
        source_positions=patch_values['POSITION'];old_triangles=triangles(doc,binary,primitive)
        def triangle_key(positions):
            return min(tuple(round(value,5) for point in positions[offset:]+positions[:offset] for value in point) for offset in range(3))
        lookup={}
        for index,triangle in enumerate(source_triangles):
            lookup.setdefault(triangle_key([source_positions[vertex] for vertex in triangle]),[]).append(index)
        exact={key:[] for key in native_values};ordered=[];used=set()
        for triangle_index in old_mask:
            triangle=old_triangles[triangle_index];positions=[native_values['POSITION'][vertex] for vertex in triangle];matches=[]
            for candidate_index in range(len(source_triangles)):
                candidate=source_triangles[candidate_index]
                for offset in range(3):
                    rotated=candidate[offset:]+candidate[:offset]
                    if all(_near(source_positions[vertex],positions[corner]) for corner,vertex in enumerate(rotated)):matches.append((candidate_index,rotated))
            assert len(matches)==1 and matches[0][0] not in used, 'Source poncho changes native oriented triangles'
            candidate_index,candidate=matches[0];used.add(candidate_index)
            face=_cross(_sub(positions[1],positions[0]),_sub(positions[2],positions[0]));length=_norm(face);assert length>1e-10
            normal=struct.unpack('<fff',struct.pack('<fff',*(value/length for value in face)))
            start=len(exact['POSITION']);ordered.append([start,start+1,start+2])
            for old_vertex,new_vertex in zip(triangle,candidate):
                assert _dot(normal,patch_values['NORMAL'][new_vertex])>.999, 'Source normal is not its geometric panel normal'
                for key in exact:
                    if key=='NORMAL':value=normal
                    else:
                        value=native_values[key][old_vertex]
                        assert _near(value,patch_values[key][new_vertex],3e-6), 'Source poncho changes UV, colour or skin weights'
                    exact[key].append(value)
        assert len(used)==len(source_triangles), 'Source poncho includes an unowned triangle'
        patch_values=exact;patch_tris=ordered
    count=len(native_values['POSITION']); patch_count=len(patch_values['POSITION'])
    assert all(len(value)==patch_count for value in patch_values.values()), 'Patch attributes have unequal vertex counts'
    for key,values in patch_values.items():
        old_accessor=doc['accessors'][primitive['attributes'][key]]; candidate_accessor=patch_doc['accessors'][patch['attributes'][key]]
        assert {k:old_accessor.get(k) for k in ('componentType','type','normalized')}=={k:candidate_accessor.get(k) for k in ('componentType','type','normalized')}, 'Patch changes native component format'
        assert all(math.isfinite(value) and abs(value)<2.1 for row in values for value in row) if key not in ('JOINTS_0',) else all(0<=value<53 for row in values for value in row), 'Invalid bounded patch values'
        if key=='JOINTS_0': values=[tuple(names.index(patch_names[index]) for index in row) for row in values];patch_values[key]=values
        next_primitive['attributes'][key]=append_rows(next_doc,next_binary,old_accessor,native_values[key]+values)
    old_tris=triangles(doc,binary,primitive); unowned=[index for index in range(len(old_tris)) if index not in set(old_mask)]
    new_tris=[old_tris[index] for index in unowned]+[[vertex+count for vertex in triangle] for triangle in patch_tris]
    component=5123 if count+patch_count<=65536 else 5125
    next_primitive['indices']=append_rows(next_doc,next_binary,{'componentType':component,'type':'SCALAR'},[(vertex,) for triangle in new_tris for vertex in triangle],indices=True)
    next_binary.extend(b'\0'*(-len(next_binary)%4));next_doc['buffers']=[{'byteLength':len(next_binary)}]
    owned=list(range(len(unowned),len(new_tris))); old_to_new={old:new for new,old in enumerate(unowned)}
    item={'mesh':mesh,'primitive':0,'originalAttributes':copy.deepcopy(primitive['attributes']),'originalIndices':primitive['indices'],
          'attributes':copy.deepcopy(next_primitive['attributes']),'indices':next_primitive['indices'],
          'originalVertexCount':count,'patchVertexCount':patch_count,'oldOwnedTriangles':old_mask,'ownedTriangles':owned,
          'oldOwnedStreamSha256':stream_hash(doc,binary,primitive,old_mask),'ownedStreamSha256':stream_hash(next_doc,next_binary,next_primitive,owned),
          'unownedStreamSha256':stream_hash(doc,binary,primitive,unowned)}
    meta={'recipe':recipe,'preset':preset,'lod':lod,'role':limits['role'],'beforeSha256':record['sha256'],'beforeBytes':record['bytes'],
          'beforeTriangles':record['triangles'],'beforeDrawCalls':record['drawCalls'],'originalRecordJSONSha256':json_sha(old_record),
          'originalJSONSha256':json_sha(before),'originalBinarySha256':sha(old_binary),'originalBinaryBytes':len(old_binary),
          'originalBuffers':copy.deepcopy(doc['buffers']),'originalAccessorCount':len(doc['accessors']),'originalViewCount':len(doc['bufferViews']),
          'originalHadExtras':'extras' in doc,'primitive':item,
          'sourcePatchSha256':sha(Path(patch_path).read_bytes()),'sourceProposalSha256':sha(Path(proposal_path).read_bytes()),
          'sourceProof':{key:proposal[key] for key in ('method','sourceSha256','boundsZUp','coordinateSystem') if key in proposal},'sourceMaterial':proposal['sourceMaterial']}
    next_doc.setdefault('extras',{})[FIELD]=meta
    raw=encode_glb(next_doc,next_binary);next_record=copy.deepcopy(old_record)
    next_record.update(bytes=len(raw),sha256=sha(raw),triangles=old_record['triangles']+len(patch_tris)-len(old_mask));next_record[FIELD]=meta
    _verify_native(next_doc,next_binary,next_record,recipe,root)
    assert restore_body(next_doc,next_binary,meta)==(before,old_binary) and restore_record(next_record)==old_record, 'Complete original body or record restoration differs'
    return raw,next_record


def verify_completed(root,presets=None):
    root=Path(root).resolve();assets=root/'web/public/models/characters';manifest=json.loads((assets/'manifest.json').read_bytes());recipe=recipe_for(root)
    glb=module('coarse_completed_glb',root/'tools/characters-3d/merge-animation-bank.py');verified=[]
    for preset,appearance in manifest['appearances'].items():
        if presets is not None and preset not in presets:continue
        for record in appearance['lods']:
            path=assets/Path(record['url']).name
            if not path.is_file():continue
            raw=path.read_bytes();assert sha(raw)==record['sha256'] and len(raw)==record['bytes'], 'Correction body differs from manifest'
            doc,binary=glb.read_glb(path); assert (FIELD in record)==(FIELD in doc.get('extras',{})), 'Ambiguous completed correction state'
            if FIELD in record:
                assert (preset,record['lod']) in TARGETS, 'Unowned completed correction target'
                verified.append(_verify_native(doc,binary,record,recipe,root))
    return {'method':'verified-bounded-native-outfit-graft','rows':verified,'pendingWrites':0}


def _check_source_inputs(patch_dir,pins):
    """Reject changed external inputs; validation uses their private copies."""
    patch_dir=Path(patch_dir).resolve()
    for name,fact in pins.items():
        path=patch_dir/name
        assert path.is_file(), 'Selected source input disappeared during validation'
        raw=path.read_bytes()
        assert len(raw)==fact['bytes'] and sha(raw)==fact['sha256'], 'Selected source input changed during validation'


def _snapshot_source_inputs(root,selected,patch_dir,target):
    """Read every selected source file once into an isolated input batch."""
    target.mkdir(parents=True);pins={}
    def retain(name):
        relative=Path(name)
        assert not relative.is_absolute() and '..' not in relative.parts, 'Source input escapes its patch directory'
        source=(patch_dir/relative).resolve()
        assert source.is_file(), 'Selected source job lacks its bounded patch proof or image'
        if name not in pins:
            raw=source.read_bytes();pins[name]={'sha256':sha(raw),'bytes':len(raw)}
            destination=target/relative;destination.parent.mkdir(parents=True,exist_ok=True);destination.write_bytes(raw)
        return target/relative
    glb=module('coarse_source_batch_glb',root/'tools/characters-3d/merge-animation-bank.py')
    for preset,lod in selected:
        retain(f'{preset}-lod{lod}-coarse-patch.json')
        patch=retain(f'{preset}-lod{lod}-coarse-patch.glb');doc,_=glb.read_glb(patch)
        for image in doc.get('images',[]):retain(image['uri'])
    _check_source_inputs(patch_dir,pins)
    return pins


def prepare_selected_jobs(root,jobs,patch_dir):
    """Complete selected source patches privately; never install source bodies.

    Return final file bytes and complete current LOD records. The caller may
    publish them only through its ordinary checked selected-job installation.
    """
    from coarse_garment_context import create_native_snapshot,replay_colours
    from family_surface_context import _pins,_checked_outputs,_check_pins
    root=Path(root).resolve();patch_dir=Path(patch_dir).resolve()
    selected=[(preset,lod) for kind,preset,lod in jobs if kind=='appearance' and (preset,lod) in TARGETS]
    assert len(selected)==len(set(selected)), 'Duplicate selected garment correction job'
    if not selected:return {},{}, {'selected':[],'changedFiles':[],'exactNoOp':True}
    pins=_pins(root);assets=root/'web/public/models/characters';before=json.loads((assets/'manifest.json').read_bytes())
    with tempfile.TemporaryDirectory(prefix='granaderos-coarse-graft-') as folder:
        source_batch=Path(folder)/'source';source_pins=_snapshot_source_inputs(root,selected,patch_dir,source_batch)
        private=Path(folder)/'root';create_native_snapshot(root,private)
        private_assets=private/'web/public/models/characters';mp=private_assets/'manifest.json';manifest=json.loads(mp.read_bytes())
        glb=module('coarse_candidate_glb',root/'tools/characters-3d/merge-animation-bank.py')
        for preset,lod in selected:
            patch=source_batch/f'{preset}-lod{lod}-coarse-patch.glb';proposal=source_batch/f'{preset}-lod{lod}-coarse-patch.json'
            assert patch.is_file() and proposal.is_file(), 'Selected source job lacks its bounded patch proof'
            index=next(index for index,row in enumerate(manifest['appearances'][preset]['lods']) if row['lod']==lod)
            record=manifest['appearances'][preset]['lods'][index];path=private_assets/Path(record['url']).name;doc,binary=glb.read_glb(path)
            if FIELD in record:
                doc,binary=restore_body(doc,binary,record[FIELD]);record=restore_record(record)
            raw,record=prepare_body(private,doc,binary,record,patch,proposal)
            # The snapshot may retain linked inputs in other entry points.
            path.unlink();path.write_bytes(raw);manifest['appearances'][preset]['lods'][index]=record
        mp.write_text(json.dumps(manifest,indent=2)+'\n');native_result=verify_completed(private);replay_colours(private)
        final=json.loads(mp.read_bytes());allowed={f'{preset}-lod{lod}.glb' for preset,lod in selected}
        changed=_checked_outputs(assets,private_assets,before,final,allowed);_check_pins(root,pins);_check_source_inputs(patch_dir,source_pins)
        records={f'{preset}-lod{lod}.glb':copy.deepcopy(next(row for row in final['appearances'][preset]['lods'] if row['lod']==lod)) for preset,lod in selected}
        files={name:private_assets.joinpath(name).read_bytes() for name in allowed}
        files.update({name:raw for name,raw in changed.items() if name.startswith('textures/')})
        return records,files,{'method':'checked-native-garment-graft-and-frozen-colour-replay','selected':sorted(allowed),
                             'changedFiles':sorted(changed),'exactNoOp':not changed,'native':native_result,'sourceInputs':source_pins}


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[2])
    parser.add_argument('--patch-dir',type=Path);parser.add_argument('--presets',nargs='+');parser.add_argument('--receipt',type=Path)
    parser.add_argument('--verify-only',action='store_true');args=parser.parse_args();root=args.root.resolve()
    if args.verify_only or args.patch_dir is None:
        from coarse_garment_context import create_native_snapshot
        with tempfile.TemporaryDirectory(prefix='granaderos-coarse-verification-') as folder:
            native=Path(folder)/'root';create_native_snapshot(root,native);result=verify_completed(native,args.presets)
    else:
        from family_surface_context import _pins,_check_pins,_install
        pins=_pins(root);assets=root/'web/public/models/characters';mp=assets/'manifest.json';manifest=json.loads(mp.read_bytes())
        selected=[('appearance',preset,lod) for preset,lod in TARGETS if (not args.presets or preset in args.presets)
                  and (args.patch_dir/f'{preset}-lod{lod}-coarse-patch.glb').is_file()]
        assert selected,'No selected source correction patches'
        records,files,result=prepare_selected_jobs(root,selected,args.patch_dir)
        for kind,preset,lod in selected:
            index=next(index for index,row in enumerate(manifest['appearances'][preset]['lods']) if row['lod']==lod)
            manifest['appearances'][preset]['lods'][index]=records[f'{preset}-lod{lod}.glb']
        if not result['exactNoOp']:
            files['manifest.json']=(json.dumps(manifest,indent=2)+'\n').encode()
            changed={name:raw for name,raw in files.items() if not (assets/name).is_file() or (assets/name).read_bytes()!=raw}
            _check_pins(root,pins);_check_source_inputs(args.patch_dir,result['sourceInputs']);_install(assets,changed)
    if args.receipt:args.receipt.parent.mkdir(parents=True,exist_ok=True);args.receipt.write_text(json.dumps(result,indent=2)+'\n')
    print('COARSE_GARMENT_SURFACES_READY',json.dumps(result))


if __name__=='__main__':main()
