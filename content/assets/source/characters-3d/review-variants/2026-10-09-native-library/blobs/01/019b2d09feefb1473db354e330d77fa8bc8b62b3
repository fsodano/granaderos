"""Keep exact authored endpoints across Blender's integer-frame NLA bake.

The writer pads a fractional final frame with the same terminal pose. Export
then trims that one padding timestamp. Earlier samples and event times do not
move, and a non-loop action retains its own terminal pose rather than its start.
"""
import json
import struct
from pathlib import Path


def trim_endpoints(path,durations):
    path=Path(path);raw=path.read_bytes();length=struct.unpack_from('<I',raw,12)[0]
    doc=json.loads(raw[20:20+length]);binary=bytearray(raw[28+length:])
    views=doc['bufferViews'];accessors=doc['accessors'];cache={}
    for animation in doc.get('animations',[]):
        if animation['name'] not in durations:continue
        duration=durations[animation['name']]
        for sampler in animation['samplers']:
            old=sampler['input'];source=accessors[old];key=(old,duration)
            if key in cache:
                sampler['input'],drop=cache[key]
                if drop is not None:sampler['output']=_drop_sample(doc,binary,sampler['output'],drop)
                continue
            if source['componentType']!=5126 or source['type']!='SCALAR':raise ValueError('Expected float animation time')
            view=views[source['bufferView']];offset=view.get('byteOffset',0)+source.get('byteOffset',0);stride=view.get('byteStride',4)
            times=[struct.unpack_from('<f',binary,offset+i*stride)[0] for i in range(source['count'])]
            if len(times)==1:continue
            if times[-1]<duration-1e-5:raise ValueError('Missing padded terminal pose: '+animation['name'])
            # Rounded metadata can put the exact end a few microseconds
            # after an integer-frame key. Keep the authored terminal value
            # and discard that redundant almost-terminal bake sample.
            drop=len(times)-2 if abs(times[-2]-duration)<1e-5 else None
            if drop is not None:
                times.pop(drop);sampler['output']=_drop_sample(doc,binary,sampler['output'],drop)
            if len(times)>1 and times[-2]>=duration:raise ValueError('Unexpected samples after authored endpoint: '+animation['name'])
            times[-1]=duration
            binary.extend(b'\0'*(-len(binary)%4));offset=len(binary)
            data=struct.pack('<'+'f'*len(times),*times);binary.extend(data)
            views.append({'buffer':0,'byteOffset':offset,'byteLength':len(data)})
            accessor=dict(source);accessor.update(bufferView=len(views)-1,byteOffset=0,count=len(times),min=[times[0]],max=[duration])
            accessors.append(accessor);sampler['input']=len(accessors)-1;cache[key]=(sampler['input'],drop)
    binary.extend(b'\0'*(-len(binary)%4));doc['buffers']=[{'byteLength':len(binary)}]
    encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*(-len(encoded)%4)
    path.write_bytes(struct.pack('<III',0x46546c67,2,28+len(encoded)+len(binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary)


def _drop_sample(doc,binary,index,drop):
    source=doc['accessors'][index];size={'VEC3':3,'VEC4':4}.get(source['type'])
    if source['componentType']!=5126 or size is None:raise ValueError('Expected float bone channel')
    view=doc['bufferViews'][source['bufferView']];offset=view.get('byteOffset',0)+source.get('byteOffset',0)
    stride=view.get('byteStride',size*4)
    data=b''.join(binary[offset+i*stride:offset+i*stride+size*4] for i in range(source['count']) if i!=drop)
    binary.extend(b'\0'*(-len(binary)%4));offset=len(binary);binary.extend(data)
    doc['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(data)})
    accessor=dict(source);accessor.update(bufferView=len(doc['bufferViews'])-1,byteOffset=0,count=source['count']-1)
    # Optional bounds are no longer needed on animation output accessors.
    accessor.pop('min',None);accessor.pop('max',None)
    doc['accessors'].append(accessor)
    return len(doc['accessors'])-1


def authored_durations(rig):
    return {track.name:float(strip.action['authored_duration'])
            for track in rig.animation_data.nla_tracks for strip in track.strips
            if strip.action and 'authored_duration' in strip.action}


def calibrate_crawl(path,clips):
    """Measure final GLB interpolation, rather than pre-bake contact keys.

    The bank must contain the unarmed crawl, whose forearms support the body.
    Its carried variants keep that body stride even while a hand holds a prop.
    """
    from bisect import bisect_right
    from statistics import median
    reference=next((clip for clip in clips if clip['name']=='prone.crawl.unarmed'),None)
    if reference is None:return
    if reference.get('strideMeasurement',{}).get('method')=='native forearm planted pull displacement':
        # This worker exports a rig-only bank. The final Node compiler measures
        # the actual skinned forearm surface with the matching published body.
        # Bone-pivot height is not skin contact, and carried crawls keep their
        # own calibration rather than inheriting this new unarmed gait.
        return reference['nativeStrideSpeed']
    from mathutils import Matrix,Quaternion,Vector
    raw=Path(path).read_bytes();length=struct.unpack_from('<I',raw,12)[0]
    doc=json.loads(raw[20:20+length]);binary=raw[28+length:];cache={}
    def access(index):
        if index in cache:return cache[index]
        a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']]
        size={'SCALAR':1,'VEC3':3,'VEC4':4}[a['type']]
        if a['componentType']!=5126:raise ValueError('Expected floating-point bone animation')
        start=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',size*4)
        cache[index]=[struct.unpack_from('<'+'f'*size,binary,start+i*stride)for i in range(a['count'])]
        return cache[index]
    def quaternion(values):return Quaternion((values[3],values[0],values[1],values[2]))
    parents={child:index for index,node in enumerate(doc['nodes'])for child in node.get('children',[])}
    defaults=[]
    for node in doc['nodes']:
        if 'matrix' in node:
            values=node['matrix'];matrix=Matrix([values[i:i+4]for i in range(0,16,4)]).transposed()
            defaults.append(matrix.decompose())
        else:defaults.append((Vector(node.get('translation',(0,0,0))),quaternion(node.get('rotation',(0,0,0,1))),Vector(node.get('scale',(1,1,1)))))
    animation=next(animation for animation in doc['animations']if animation['name']==reference['name'])
    elbows=[next(i for i,node in enumerate(doc['nodes'])if node.get('name')==name)for name in ('lowerarm_l','lowerarm_r')]
    count=round(reference['duration']*reference['sampleRate']);duration=reference['duration'];contacts=[]
    for frame in range(count+1):
        time=duration*frame/count;pose=[[p.copy(),q.copy(),s.copy()]for p,q,s in defaults]
        for channel in animation['channels']:
            sampler=animation['samplers'][channel['sampler']];times=[v[0]for v in access(sampler['input'])];values=access(sampler['output'])
            i=max(0,min(len(times)-1,bisect_right(times,time)-1));j=min(i+1,len(times)-1)
            blend=max(0,min(1,(time-times[i])/(times[j]-times[i])))if i!=j else 0
            kind=channel['target']['path'];node=channel['target']['node']
            if sampler.get('interpolation','LINEAR')=='STEP':blend=0
            if kind=='rotation':pose[node][1]=quaternion(values[i]).slerp(quaternion(values[j]),blend)
            elif kind in ('translation','scale'):pose[node][0 if kind=='translation' else 2]=Vector(values[i]).lerp(Vector(values[j]),blend)
        world={}
        def matrix(index):
            if index not in world:
                local=Matrix.LocRotScale(*pose[index])
                world[index]=matrix(parents[index]) @ local if index in parents else local
            return world[index]
        contacts.append([matrix(index).translation.copy()for index in elbows])
    speeds=[];height=reference['strideMeasurement']['maximumContactHeight'];step=duration/count
    for index in range(1,len(contacts)-1):
        for side in (0,1):
            before,current,after=(contacts[i][side]for i in (index-1,index,index+1))
            velocity=(before.z-after.z)/(2*step)
            if current.y<=height and velocity>0:speeds.append(velocity)
    if not speeds:raise ValueError('Exported crawl has no supporting forearm travel')
    speed=round(median(speeds),6)
    for clip in clips:
        if clip.get('gesture')!='crawl':continue
        clip.update(locomotionSpeed=speed,nativeStrideSpeed=speed,authoredStrideSpeed=speed,
                    strideDistance=round(speed*clip['duration'],6))
        clip['strideMeasurement'].update(sampleCount=len(speeds),sampledFrom='exported-glb')
    return speed
