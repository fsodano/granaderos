#!/usr/bin/env python3
"""Publish selected native equipment meshes and preserve the complete library."""
from pathlib import Path
import argparse,copy,hashlib,importlib.util,json,subprocess,tempfile

ROOT=Path(__file__).resolve().parents[2]
HERE=ROOT/'assets/source/characters-3d/authoring'
OUT=ROOT/'web/public/models/characters'
parser=argparse.ArgumentParser()
parser.add_argument('--item',action='append',required=True)
parser.add_argument('--allow-mesh-node-transforms',action='store_true',help='Allow selected leaf mesh origins to change; roots and named markers must retain their native attachment')
parser.add_argument('--blender',default='/Applications/Blender.app/Contents/MacOS/Blender')
args=parser.parse_args()
spec=importlib.util.spec_from_file_location('animation_merge',Path(__file__).with_name('merge-animation-bank.py'))
merge=importlib.util.module_from_spec(spec);spec.loader.exec_module(merge)
spec=importlib.util.spec_from_file_location('gltf_pack',HERE/'gltf_pack.py')
packing=importlib.util.module_from_spec(spec);spec.loader.exec_module(packing)
manifest_path=OUT/'manifest.json'
manifest=json.loads(manifest_path.read_text())
assert manifest['complete']
for item in args.item:assert item in manifest['equipment']['items'],item
with tempfile.TemporaryDirectory(prefix='granaderos-equipment-')as directory:
    directory=Path(directory)
    command=[args.blender,'--background','--factory-startup','--python',str(HERE/'build.py'),'--','equipment','--output-dir',str(directory),'--metadata-dir',str(directory)]
    result=subprocess.run(command,cwd=ROOT,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
    assert result.returncode==0 and 'ASSET_READY equipment'in result.stdout,result.stdout[-3000:]
    target=OUT/'equipment.glb'
    doc,binary=merge.read_glb(target);fresh,data=merge.read_glb(directory/'equipment.glb')
    materials={entry.get('name'):index for index,entry in enumerate(doc['materials'])}
    views={};accessors={}
    def view(index):
        if index not in views:
            source=fresh['bufferViews'][index];assert source.get('buffer',0)==0
            binary.extend(b'\0'*(-len(binary)%4))
            entry=copy.deepcopy(source);entry.update(buffer=0,byteOffset=len(binary))
            start=source.get('byteOffset',0);binary.extend(data[start:start+source['byteLength']])
            views[index]=len(doc['bufferViews']);doc['bufferViews'].append(entry)
        return views[index]
    def accessor(index):
        if index not in accessors:
            entry=copy.deepcopy(fresh['accessors'][index]);entry['bufferView']=view(entry['bufferView'])
            assert 'sparse'not in entry
            accessors[index]=len(doc['accessors']);doc['accessors'].append(entry)
        return accessors[index]
    def descendants(source,node):
        result=[node]
        for child in source['nodes'][node].get('children',[]):result.extend(descendants(source,child))
        return result
    nodes={entry['name']:index for index,entry in enumerate(doc['nodes'])}
    fresh_nodes={entry['name']:index for index,entry in enumerate(fresh['nodes'])}
    for item in args.item:
        name=manifest['equipment']['items'][item]['node']
        old={doc['nodes'][index]['name']:index for index in descendants(doc,nodes[name])}
        new={fresh['nodes'][index]['name']:index for index in descendants(fresh,fresh_nodes[name])}
        assert set(old)==set(new),name+' changes attachment nodes'
        for name,index in new.items():
            source=fresh['nodes'][index];existing=doc['nodes'][old[name]]
            transform_keys=('translation','rotation','scale','matrix')
            if {key:source.get(key)for key in transform_keys}!={key:existing.get(key)for key in transform_keys}:
                # A material batch may change its local origin when its mesh
                # changes. That origin belongs to the selected geometry, not
                # the held-item attachment or its named muzzle marker.
                assert args.allow_mesh_node_transforms and 'mesh'in source and 'mesh'in existing and not source.get('children') and not existing.get('children') and 'skin'not in source and 'skin'not in existing,name+' changes native attachment'
                for key in transform_keys:
                    if key in source:existing[key]=copy.deepcopy(source[key])
                    else:existing.pop(key,None)
            if'mesh'not in source:continue
            mesh=copy.deepcopy(fresh['meshes'][source['mesh']])
            for primitive in mesh['primitives']:
                primitive['attributes']={key:accessor(value)for key,value in primitive['attributes'].items()}
                if'indices'in primitive:primitive['indices']=accessor(primitive['indices'])
                if'material'in primitive:primitive['material']=materials[fresh['materials'][primitive['material']]['name']]
                assert 'targets'not in primitive
            doc['meshes'][existing['mesh']]=mesh
    merge.write_glb(target,doc,binary)
    raw,_=packing.pack(target,{})
# Read the manifest again in case another independent increment completed.
manifest=json.loads(manifest_path.read_text())
manifest['equipment'].update(bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest())
manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'items':args.item,'bytes':len(raw),'sha256':manifest['equipment']['sha256']},indent=2))
