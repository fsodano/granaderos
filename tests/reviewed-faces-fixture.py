"""Small native-bind fixture for the actual accepted face compositor."""
from pathlib import Path
import copy,json,sys,tempfile
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
AUTHOR=ROOT/'assets/source/characters-3d/authoring'
sys.path.insert(0,str(AUTHOR))
from accepted_faces import Writer,load,compose_accepted_face,digest
SOURCE=AUTHOR/'vendor/reviewed-faces/granadero-lod2.glb'


def fixture(path):
    source,read,_=load(SOURCE)
    doc=copy.deepcopy(source)
    for key in ('accessors','bufferViews','materials','images','textures','samplers'):doc[key]=[]
    doc.pop('extensionsUsed',None)
    doc['materials']=[{'name':'Skin','pbrMetallicRoughness':{'baseColorFactor':[.4,.3,.2,1],'roughnessFactor':.71},'extras':{'mainHandContract':True}}, {'name':'Retained_Cloth','pbrMetallicRoughness':{'baseColorFactor':[.1,.2,.3,1]},'extras':{'mainClothContract':True}}]
    doc['meshes']=[{'name':'Exposed_Human_Skin','primitives':[]},{'name':'Retained_Cloth','primitives':[],'weights':[.25],'extras':{'targetNames':['retained_shape']}}]
    doc['nodes'].append({'name':'Retained_Cloth','mesh':1,'skin':0});doc['scenes'][0]['nodes'].append(len(doc['nodes'])-1)
    writer=Writer(doc)
    skin=writer.doc['skins'][0];skin['inverseBindMatrices']=writer.array(read(source['skins'][0]['inverseBindMatrices']),source['accessors'][source['skins'][0]['inverseBindMatrices']],target=None)
    names=[doc['nodes'][i]['name']for i in skin['joints']]
    pos=np.array([[-.01,1.66,.13],[.01,1.66,.13],[0,1.68,.13],[.4,1.1,.2],[.42,1.1,.2],[.41,1.12,.2]],dtype='<f4')
    def attribute(values,kind,component=5126):return writer.array(values,{'componentType':component,'type':kind})
    joints=np.array([[names.index('head'),0,0,0]]*3+[[names.index('hand_l'),0,0,0]]*3,dtype='<u2')
    attributes={'POSITION':attribute(pos,'VEC3'),'NORMAL':attribute([[0,0,1]]*6,'VEC3'),'TEXCOORD_0':attribute([[.1,.2],[.2,.2],[.1,.3]]*2,'VEC2'),'COLOR_0':attribute([[.8,.9,1,1]]*6,'VEC4'),'JOINTS_0':attribute(joints,'VEC4',5123),'WEIGHTS_0':attribute([[1,0,0,0]]*6,'VEC4')}
    indices=writer.array([0,1,2,3,4,5],target=34963)
    writer.doc['meshes'][0]['primitives']=[{'attributes':attributes,'indices':indices,'material':0}]
    # A sparse costume morph exercises the real retained accessor/view contract.
    morph=attribute(np.zeros((6,3)),'VEC3');a=writer.doc['accessors'][morph];a.pop('bufferView')
    sparse_index=attribute([2],'SCALAR',5123);sparse_value=attribute([[.001,.002,.003]],'VEC3')
    a['sparse']={'count':1,'indices':{'bufferView':writer.doc['accessors'][sparse_index]['bufferView'],'componentType':5123},'values':{'bufferView':writer.doc['accessors'][sparse_value]['bufferView']}}
    writer.doc['meshes'][1]['primitives']=[{'attributes':copy.deepcopy(attributes),'indices':indices,'material':1,'targets':[{'POSITION':morph}]}]
    writer.write(path)


def main(case):
    with tempfile.TemporaryDirectory(prefix='reviewed-face-test-')as temp:
        root=Path(temp);base=root/'base.glb';fixture(base);doc,read,binary=load(base)
        output=root/'composed.glb'
        if case=='wrong-rig':
            writer=Writer(doc,binary);joint=writer.doc['skins'][0]['joints'][0];writer.doc['nodes'][joint]['translation']=[.2,0,0];writer.write(base)
        elif case=='connected-boundary':
            writer=Writer(doc,binary);writer.doc['meshes'][0]['primitives'][0]['indices']=writer.array([0,1,2,3,4,5,0,2,3],target=34963);writer.write(base)
        before=base.read_bytes()
        if case in ('wrong-rig','connected-boundary'):
            output.write_bytes(b'original destination')
            try:compose_accepted_face(base,SOURCE,output,preset='granadero')
            except ValueError:pass
            else:raise AssertionError('Malformed native source was accepted')
            assert base.read_bytes()==before
            assert output.read_bytes()==b'original destination','Failure overwrote the output'
            return
        compose_accepted_face(base,SOURCE,output,preset='granadero')
        actual,aread,abinary=load(output)
        if case=='deterministic':
            second=root/'second.glb';compose_accepted_face(base,SOURCE,second,preset='granadero');assert second.read_bytes()==output.read_bytes()
        elif case=='preservation':
            assert abinary[:len(binary)]==binary
            for key in ('nodes','skins','scenes'):assert actual[key]==doc[key],key
            assert actual['accessors'][:len(doc['accessors'])]==doc['accessors']
            assert actual['bufferViews'][:len(doc['bufferViews'])]==doc['bufferViews']
            assert actual['materials'][:len(doc['materials'])]==doc['materials']
            assert actual['meshes'][1]==doc['meshes'][1]
            retained=actual['meshes'][0]['primitives'][0];old=doc['meshes'][0]['primitives'][0]
            assert retained['attributes']==old['attributes']
            assert aread(retained['indices']).ravel().tolist()==[3,4,5]
            assert np.array_equal(aread(actual['meshes'][1]['primitives'][0]['targets'][0]['POSITION']),read(doc['meshes'][1]['primitives'][0]['targets'][0]['POSITION']))
            assert base.read_bytes()==before
        elif case=='repeated-application':
            saved=output.read_bytes()
            try:compose_accepted_face(output,SOURCE,preset='granadero')
            except ValueError:pass
            else:raise AssertionError('Repeated face composition was accepted')
            assert output.read_bytes()==saved
        else:raise ValueError(case)

if __name__=='__main__':
    main(sys.argv[1]);print(json.dumps({'case':sys.argv[1],'pass':True}))
