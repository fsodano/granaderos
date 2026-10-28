"""Reviewed native rifle guard and butt-strike arm curves.

The source tables are authored local bone rotations, not a retargeting recipe.
Only these two clips and 36 arm/finger bones are in scope. The body, feet,
weapon path, simulation clock and contact marker retain their existing source.
The right hand releases during preparation, then closes before powered contact.

Blender's integer-frame bake does not retain the reviewed subframe release.
``preserve_export`` therefore restores exactly this registered rotation set
after packing. It does not resample or replace any other channel or metadata.
"""
from copy import deepcopy
from functools import lru_cache
from pathlib import Path
import json
import math
import struct

CLIPS = frozenset(('stand.idle.long-gun', 'stand.butt.long-gun'))
BONES = frozenset(
    [part+'_'+side for side in ('r','l') for part in ('upperarm','lowerarm','hand')]
    + [f'{finger}_{joint:02d}_{side}' for side in ('r','l')
       for finger in ('index','middle','ring','pinky','thumb') for joint in (1,2,3)])


@lru_cache(maxsize=2)
def _source(gender):
    if gender not in ('male','female'):
        raise ValueError('Rifle guard curves require a reviewed native anatomy')
    data=json.loads(Path(__file__).with_name('rifle_guard_curves_'+gender+'.json').read_text())
    if data['version']!=1 or data['anatomy']!=gender or set(data['clips'])!=CLIPS:
        raise ValueError('Invalid rifle guard source contract')
    if set(data['binding'])!=BONES:
        raise ValueError('Rifle guard source bone allowlist changed')
    for name,clip in data['clips'].items():
        times=clip['times']
        if set(clip['rotations'])!=BONES or times[0]!=0 or times[-1]!=clip['duration']:
            raise ValueError('Incomplete rifle guard curve: '+name)
        if any(not math.isfinite(t) or a>=t for a,t in zip(times,times[1:])):
            raise ValueError('Invalid rifle guard sample times: '+name)
        for values in clip['rotations'].values():
            if len(values)!=len(times) or any(len(q)!=4 or any(not math.isfinite(x) for x in q) or abs(sum(x*x for x in q)-1)>1e-4 for q in values):
                raise ValueError('Invalid native quaternion curve: '+name)
    return data


def _native_bind(ctx, data):
    from mathutils import Quaternion, Vector
    rig=ctx['rig']
    for name,expected in data['binding'].items():
        bone=rig.data.bones.get(name)
        if bone is None or bone.parent is None or bone.parent.name!=expected['parent']:
            raise ValueError('Rifle guard native hierarchy changed: '+name)
        local=bone.parent.matrix_local.inverted() @ bone.matrix_local
        q=Quaternion((expected['rotation'][3],*expected['rotation'][:3]))
        actual=local.to_quaternion()
        if (local.translation-Vector(expected['translation'])).length>2e-5 or min((actual-q).magnitude,(actual+q).magnitude)>2e-5:
            raise ValueError('Rifle guard native bind changed: '+name)


def _bags(action):
    for layer in action.layers:
        for strip in layer.strips:
            yield from strip.channelbags


def apply_clip(ctx, meta, fps):
    """Replace authored arm rotation f-curves after the normal clip writer."""
    name=meta['name']
    if name not in CLIPS:
        return
    from mathutils import Quaternion
    data=_source(ctx['gender']);source=data['clips'][name]
    _native_bind(ctx,data)
    if abs(meta['duration']-source['duration'])>1e-7 or meta['loop']!=source['loop'] or meta['markers']!=source['markers']:
        raise ValueError('Rifle guard authored clock/markers changed: '+name)
    rig=ctx['rig'];tracks=[track for track in rig.animation_data.nla_tracks if track.name==name]
    if len(tracks)!=1 or len(tracks[0].strips)!=1:
        raise ValueError('Expected one native rifle action: '+name)
    action=tracks[0].strips[0].action
    if abs(float(action['authored_duration'])-source['duration'])>1e-7:
        raise ValueError('Rifle guard action duration changed: '+name)
    # Existing curves and slots are retained. No new action, bone, or location
    # curve is created, so the normal body/support writer stays authoritative.
    curves={ (curve.data_path,curve.array_index):curve for bag in _bags(action) for curve in bag.fcurves }
    for bone_name,values in source['rotations'].items():
        bone=rig.data.bones[bone_name]
        rest=(bone.parent.matrix_local.inverted() @ bone.matrix_local).to_quaternion().inverted()
        local=[rest @ Quaternion((v[3],*v[:3])) for v in values]
        for index in range(4):
            key=(f'pose.bones["{bone_name}"].rotation_quaternion',index)
            if key not in curves:
                raise ValueError('Missing authored native rotation: '+str(key))
            curve=curves[key];curve.keyframe_points.clear();curve.keyframe_points.add(len(local))
            coordinates=[value for t,q in zip(source['times'],local) for value in (1+fps*t,q[index])]
            curve.keyframe_points.foreach_set('co',coordinates)
            for point in curve.keyframe_points:point.interpolation='LINEAR'
            curve.update()
    meta['gripOffsets']=deepcopy(source['gripOffsets'])
    if 'nativeHandContacts' in source:
        meta['nativeHandContacts']=deepcopy(source['nativeHandContacts'])
    ctx.setdefault('rifle_guard_curve_exports',{})[name]=source


def _append(doc,binary,values,kind):
    width={'SCALAR':1,'VEC4':4}[kind]
    flat=values if width==1 else [x for q in values for x in q]
    raw=struct.pack('<'+'f'*len(flat),*flat);binary.extend(b'\0'*(-len(binary)%4))
    doc['bufferViews'].append({'buffer':0,'byteOffset':len(binary),'byteLength':len(raw)});binary.extend(raw)
    accessor={'bufferView':len(doc['bufferViews'])-1,'componentType':5126,'count':len(values),'type':kind}
    if width==1:accessor.update(min=[values[0]],max=[values[-1]])
    doc['accessors'].append(accessor)
    return len(doc['accessors'])-1


def preserve_export(path, ctx):
    """Restore only registered native arm channels after integer-frame bake."""
    selected=ctx.get('rifle_guard_curve_exports',{})
    if not selected:return
    if not set(selected)<=CLIPS:raise ValueError('Unexpected rifle export clip')
    _native_bind(ctx,_source(ctx['gender']))
    path=Path(path);raw=path.read_bytes();size=struct.unpack_from('<I',raw,12)[0]
    doc=json.loads(raw[20:20+size]);binary=bytearray(raw[28+size:]);seen=set()
    for animation in doc.get('animations',[]):
        name=animation['name']
        if name not in selected:continue
        source=selected[name];found=set();time_index=_append(doc,binary,source['times'],'SCALAR')
        for channel in animation['channels']:
            target=channel['target'];bone=doc['nodes'][target['node']]['name']
            if target['path']!='rotation' or bone not in BONES:continue
            if bone in found:raise ValueError('Duplicate native rifle channel: '+bone)
            old=animation['samplers'][channel['sampler']]
            # Append a sampler rather than mutate one possibly shared by an
            # unrelated channel. Original accessor bytes remain untouched.
            new=dict(old);new.update(input=time_index,output=_append(doc,binary,source['rotations'][bone],'VEC4'),interpolation='LINEAR')
            channel['sampler']=len(animation['samplers']);animation['samplers'].append(new);found.add(bone)
        if found!=BONES:raise ValueError('Incomplete exported rifle arm channels: '+name)
        seen.add(name)
    if seen!=set(selected):raise ValueError('Registered rifle action missing from GLB')
    binary.extend(b'\0'*(-len(binary)%4));doc['buffers']=[{'byteLength':len(binary)}]
    encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*(-len(encoded)%4)
    result=struct.pack('<III',0x46546c67,2,28+len(encoded)+len(binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary
    path.write_bytes(result)
    return result,doc
