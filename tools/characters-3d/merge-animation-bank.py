"""Replace selected GLB animations without rebuilding unrelated geometry/clips."""
import copy,json,struct
from pathlib import Path

def read_glb(path):
    raw=Path(path).read_bytes();size=struct.unpack_from('<I',raw,12)[0]
    assert struct.unpack_from('<III',raw)==(0x46546c67,2,len(raw))
    return json.loads(raw[20:20+size]),bytearray(raw[28+size:])

def write_glb(path,doc,binary):
    binary+=b'\0'*(-len(binary)%4);doc['buffers']=[{'byteLength':len(binary)}]
    encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*(-len(encoded)%4)
    raw=struct.pack('<III',0x46546c67,2,28+len(encoded)+len(binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary
    Path(path).write_bytes(raw);return raw

def merge(target,increment,bones=None,existing_only=False):
    doc,binary=read_glb(target);added,data=read_glb(increment)
    names={node['name']:i for i,node in enumerate(doc['nodes']) if 'name'in node}
    views={};accessors={}
    def view(index):
        if index in views:return views[index]
        source=added['bufferViews'][index];assert source.get('buffer',0)==0
        start=source.get('byteOffset',0);binary.extend(b'\0'*(-len(binary)%4))
        result=copy.deepcopy(source);result['byteOffset']=len(binary);result['buffer']=0
        binary.extend(data[start:start+source['byteLength']]);views[index]=len(doc.setdefault('bufferViews',[]));doc['bufferViews'].append(result)
        return views[index]
    def accessor(index):
        if index in accessors:return accessors[index]
        result=copy.deepcopy(added['accessors'][index])
        if'bufferView'in result:result['bufferView']=view(result['bufferView'])
        for source in result.get('sparse',{}).values():
            if isinstance(source,dict)and'bufferView'in source:source['bufferView']=view(source['bufferView'])
        accessors[index]=len(doc.setdefault('accessors',[]));doc['accessors'].append(result);return accessors[index]
    replacements={}
    existing={animation['name']:animation for animation in doc.get('animations',[])}
    for source in added['animations']:
        if existing_only and source['name']not in existing:continue
        if bones:
            animation=copy.deepcopy(existing[source['name']]);updates={}
            for channel in source['channels']:
                name=added['nodes'][channel['target']['node']]['name']
                if name not in bones or channel['target']['path']!='rotation':continue
                sampler=copy.deepcopy(source['samplers'][channel['sampler']])
                sampler['input']=accessor(sampler['input']);sampler['output']=accessor(sampler['output'])
                updates[(name,'rotation')]=len(animation['samplers']);animation['samplers'].append(sampler)
            assert set(name for name,path in updates)==set(bones),source['name']+' lacks native leg rotations'
            for channel in animation['channels']:
                key=(doc['nodes'][channel['target']['node']]['name'],channel['target']['path'])
                if key in updates:channel['sampler']=updates.pop(key)
            assert not updates,source['name']+' changes native animation targets'
            used=sorted({channel['sampler']for channel in animation['channels']});indices={old:new for new,old in enumerate(used)}
            animation['samplers']=[animation['samplers'][index]for index in used]
            for channel in animation['channels']:channel['sampler']=indices[channel['sampler']]
            replacements[animation['name']]=animation
            continue
        animation=copy.deepcopy(source)
        for sampler in animation['samplers']:
            sampler['input']=accessor(sampler['input']);sampler['output']=accessor(sampler['output'])
        for channel in animation['channels']:
            name=added['nodes'][channel['target']['node']]['name']
            assert name in names,'Increment changes native rig: '+name
            channel['target']['node']=names[name]
        assert animation['name']not in replacements,'Duplicate increment clip'
        replacements[animation['name']]=animation
    animations=[]
    for existing in doc.get('animations',[]):animations.append(replacements.pop(existing['name'],existing))
    doc['animations']=animations+list(replacements.values())
    return write_glb(target,doc,binary)
