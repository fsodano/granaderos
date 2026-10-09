"""Register the unchanged generated Granadero albedo after lossless GLB packing.

UV0, native geometry, weights, normals and all existing buffer bytes stay intact.
The new UV1 is used by the albedo alone; normal/roughness retain UV0.
"""
from pathlib import Path
import hashlib,json,struct
import numpy as np

HERE=Path(__file__).resolve().parent
SOURCE=HERE/'generated/granadero-skin-colour.png'
SOURCE_SHA256='040b6c27fc46ce2da45430b075721781c0200c75729387d7937f45ab30399f1d'
REFERENCE=(.846873231509858,.4232676699860717,.2788942634768104)
LIGHT_SRGB='#d5a07d'

def uses_generated_skin(preset):
    return preset in ('granadero','worker')

def registered_uv(uv,position):
    result=uv.copy();u,v=uv[:,0],uv[:,1]
    mouth=np.exp(-((u-.914)/.018)**2-((v-.516)/.040)**2)
    mouth[mouth<.0001]=0
    result[:,1]+=.28*(v-.516)*mouth
    def bump(value,centre,radius):
        t=np.clip(1-((value-centre)/radius)**2,0,1)
        return t*t*(3-2*t)
    face=(position[:,1]>1.65)&(np.abs(position[:,0])>.032)&(np.abs(position[:,0])<.082)&(position[:,2]>.10)
    brow=np.zeros(len(uv))
    for centre,tail in ((.485,.457),(.547,.575)):
        brow+=.30*(v-centre)*bump(u,.815,.015)*bump(v,tail,.023)*face
    result[:,1]+=np.clip(brow,-.004,.004)
    return result

def apply_generated_skin(path,preset):
    if not uses_generated_skin(preset):return None
    path=Path(path);raw=path.read_bytes();size=struct.unpack_from('<I',raw,12)[0]
    doc=json.loads(raw[20:20+size]);binary=raw[28+size:]
    material_id=next(i for i,m in enumerate(doc['materials'])if m['name']=='Skin')
    material=doc['materials'][material_id]
    source=SOURCE.read_bytes()
    if hashlib.sha256(source).hexdigest()!=SOURCE_SHA256:raise ValueError('Generated Granadero source pixels changed')
    def read(index):
        a=doc['accessors'][index];view=doc['bufferViews'][a['bufferView']]
        width={'VEC2':2,'VEC3':3}[a['type']]
        if a['componentType']!=5126 or 'sparse'in a:raise ValueError('Expected packed native float skin attributes')
        return np.ndarray((a['count'],width),dtype='<f4',buffer=binary,
            offset=view.get('byteOffset',0)+a.get('byteOffset',0),
            strides=(view.get('byteStride',width*4),4)).copy()
    for mesh in doc['meshes']:
        for primitive in mesh['primitives']:
            if primitive['material']!=material_id:continue
            attributes=primitive['attributes']
            if 'TEXCOORD_1'in attributes:raise ValueError('Generated albedo was already registered')
            uv=registered_uv(read(attributes['TEXCOORD_0']),read(attributes['POSITION']))
            binary+=b'\0'*(-len(binary)%4);offset=len(binary);data=uv.tobytes();binary+=data
            view=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(data),'target':34962})
            index=len(doc['accessors']);doc['accessors'].append({'bufferView':view,'componentType':5126,'count':len(uv),'type':'VEC2','min':uv.min(0).tolist(),'max':uv.max(0).tolist()})
            attributes['TEXCOORD_1']=index
    texture=doc['textures'][material['pbrMetallicRoughness']['baseColorTexture']['index']]
    image=len(doc['images']);uri='textures/'+SOURCE_SHA256[:20]+'.png'
    doc['images'].append({'name':'skin-granadero-generated-colour','uri':uri})
    index=len(doc['textures']);doc['textures'].append({**texture,'source':image})
    material['pbrMetallicRoughness']['baseColorTexture']={'index':index,'texCoord':1}
    srgb=[int(LIGHT_SRGB[i:i+2],16)/255 for i in (1,3,5)]
    linear=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in srgb]
    material['pbrMetallicRoughness']['baseColorFactor']=[v/r for v,r in zip(linear,REFERENCE)]+[1]
    material.setdefault('extras',{}).update({'skinAlbedoReference':list(REFERENCE),'skinAlbedoReferenceSpace':'linear-srgb','skinAlbedoSourceSha256':SOURCE_SHA256})
    doc['buffers'][0]['byteLength']=len(binary)
    encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*(-len(encoded)%4);binary+=b'\0'*(-len(binary)%4)
    output=struct.pack('<III',0x46546c67,2,28+len(encoded)+len(binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary
    destination=path.parent/uri;destination.parent.mkdir(parents=True,exist_ok=True);destination.write_bytes(source)
    path.write_bytes(output)
    return output,doc
