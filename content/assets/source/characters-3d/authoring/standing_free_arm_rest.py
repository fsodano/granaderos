"""Reuse the native relaxed left arm in three standing weapon rest clips.

Only the three left-arm rotation bindings change. The native upper-arm and
hand curves are reused. Three bounded lower-arm curves are appended per bank.
The donor and target input clocks must be exact; rigs, geometry and action
clocks remain unchanged.
"""
import copy
import hashlib
import struct
import math

SOURCE='stand.idle.unarmed'
TARGETS=('stand.idle.short-gun','stand.idle.blade','stand.idle.knife')
BONES=('upperarm_l','lowerarm_l','hand_l')
OUTWARD_DEGREES={'male':4,'female':12}


def rows(doc,binary,index):
    accessor=doc['accessors'][index]
    assert accessor['componentType']==5126 and accessor['type'] in ('SCALAR','VEC4') and not accessor.get('normalized') and 'sparse' not in accessor, 'Unsupported native arm sampler format'
    width=1 if accessor['type']=='SCALAR' else 4;size=4*width
    view=doc['bufferViews'][accessor['bufferView']];offset=view.get('byteOffset',0)+accessor.get('byteOffset',0);stride=view.get('byteStride',size)
    assert view.get('buffer',0)==0 and offset+(accessor['count']-1)*stride+size<=view.get('byteOffset',0)+view['byteLength']<=len(binary), 'Native arm sampler exceeds its buffer view'
    return [struct.unpack_from('<'+'f'*width,binary,offset+i*stride) for i in range(accessor['count'])]


def sampler_map(doc,clip):
    result={}
    for index,channel in enumerate(clip['channels']):
        key=(doc['nodes'][channel['target']['node']]['name'],channel['target']['path'])
        assert key not in result, 'Duplicate native animation channel'
        result[key]=(index,clip['samplers'][channel['sampler']])
    return result


def curve_hash(doc,binary,sampler):
    raw=b''.join(struct.pack('<f',row[0]) for row in rows(doc,binary,sampler['input']))
    raw+=b''.join(struct.pack('<4f',*row) for row in rows(doc,binary,sampler['output']))
    return hashlib.sha256(raw).hexdigest()


def qmul(a,b):
    x,y,z,w=a;u,v,s,t=b
    return (w*u+x*t+y*s-z*v,w*v-x*s+y*t+z*u,w*s+x*v-y*u+z*t,w*t-x*u-y*v-z*s)


def qnormalize(q):
    length=math.sqrt(sum(v*v for v in q));assert length>1e-12,'Invalid native quaternion'
    return tuple(v/length for v in q)


def qinverse(q):
    x,y,z,w=q;length=sum(v*v for v in q);return (-x/length,-y/length,-z/length,w/length)


def qsample(doc,binary,sampler,time):
    times=[r[0]for r in rows(doc,binary,sampler['input'])];values=rows(doc,binary,sampler['output'])
    assert len(times)==len(values),'Unsupported native rotation curve'
    if sampler.get('interpolation','LINEAR')=='STEP':
        assert all(value==values[0]for value in values),'Standing rest parent STEP curve is not static'
        return values[0]
    assert sampler.get('interpolation','LINEAR')=='LINEAR','Unsupported native rotation interpolation'
    if time<=times[0]:return values[0]
    if time>=times[-1]:return values[-1]
    i=next(i for i in range(len(times)-1)if times[i]<=time<times[i+1]);a=values[i];b=values[i+1];t=(time-times[i])/(times[i+1]-times[i]);cos=sum(x*y for x,y in zip(a,b))
    if cos<0:b=tuple(-v for v in b);cos=-cos
    if cos>=1:return a
    sin2=1-cos*cos
    if sin2<2.220446049250313e-16:return qnormalize(tuple(x*(1-t)+y*t for x,y in zip(a,b)))
    sin=math.sqrt(sin2);angle=math.atan2(sin,cos);wa=math.sin((1-t)*angle)/sin;wb=math.sin(t*angle)/sin
    return tuple(x*wa+y*wb for x,y in zip(a,b))


def corrected_lower_rows(doc,binary,clip,donor,gender):
    """Apply the proved chest-forward rotation to the existing native donor."""
    mapping=sampler_map(doc,clip);parents={child:parent for parent,node in enumerate(doc['nodes'])for child in node.get('children',[])}
    nodes={node['name']:index for index,node in enumerate(doc['nodes'])if 'name'in node}
    lower=nodes['lowerarm_l'];parent=parents[lower];chest=nodes['spine_03'];times=[r[0]for r in rows(doc,binary,donor['input'])];result=[]
    for time,base in zip(times,rows(doc,binary,donor['output'])):
        world={}
        def rotation(index):
            if index in world:return world[index]
            node=doc['nodes'][index];assert 'matrix' not in node,'Unsupported native matrix bone'
            curve=mapping.get((node.get('name'),'rotation'));local=qsample(doc,binary,curve[1],time)if curve else tuple(node.get('rotation',(0,0,0,1)))
            world[index]=qmul(rotation(parents[index]),local)if index in parents else local;return world[index]
        relative=qmul(qinverse(rotation(parent)),rotation(chest));axis=qmul(qmul(relative,(0,0,1,0)),qinverse(relative))[:3]
        length=math.sqrt(sum(v*v for v in axis));half=OUTWARD_DEGREES[gender]*math.pi/360
        correction=tuple(v/length*math.sin(half)for v in axis)+(math.cos(half),)
        result.append(qnormalize(qmul(correction,base)))
    return result


def compose(doc,binary,gender):
    """Return a copied bank graph and compact reversible binding patches."""
    assert gender in OUTWARD_DEGREES,'Unknown standing free arm anatomy'
    result=copy.deepcopy(doc);binary=bytearray(binary);clips={clip['name']:clip for clip in result['animations']}
    assert len(clips)==len(result['animations']) and SOURCE in clips and all(name in clips for name in TARGETS), 'Missing standing rest clip inventory'
    source=sampler_map(result,clips[SOURCE]);patches=[]
    for name in TARGETS:
        clip=clips[name];mapping=sampler_map(result,clip);patch={'name':name,'originalSamplerCount':len(clip['samplers']),'channels':[]}
        for bone in BONES:
            index,target=mapping[bone,'rotation'];_,donor=source[bone,'rotation']
            assert target.get('interpolation','LINEAR')==donor.get('interpolation','LINEAR')=='LINEAR', 'Standing free arm requires native linear quaternion curves'
            assert rows(result,binary,target['input'])==rows(result,binary,donor['input']), 'Standing free arm input clocks differ'
            assert rows(result,binary,target['output'])!=rows(result,binary,donor['output']), 'Standing free arm already has an unreceipted donor binding'
            replacement=copy.deepcopy(target);replacement['output']=donor['output']
            if bone=='lowerarm_l':
                # The upper arm donor has already been bound before this row.
                values=corrected_lower_rows(result,binary,clip,donor,gender);raw=b''.join(struct.pack('<4f',*row)for row in values)
                assert len(binary)%4==0,'Native bank is not aligned'
                view=len(result['bufferViews']);result['bufferViews'].append({'buffer':0,'byteOffset':len(binary),'byteLength':len(raw)});binary.extend(raw)
                replacement['output']=len(result['accessors']);result['accessors'].append({'bufferView':view,'componentType':5126,'count':len(values),'type':'VEC4'})
            new_index=len(clip['samplers']);clip['samplers'].append(replacement)
            old_index=clip['channels'][index]['sampler'];clip['channels'][index]['sampler']=new_index
            patch['channels'].append({'channel':index,'bone':bone,'originalSampler':old_index,'sampler':new_index,'originalCurveSha256':curve_hash(result,binary,target),'donorCurveSha256':curve_hash(result,binary,donor)})
        patches.append(patch)
    result['buffers'][0]['byteLength']=len(binary)
    return result,bytes(binary),patches
