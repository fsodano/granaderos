#!/usr/bin/env python3
"""Publish selected native equipment meshes and preserve the complete library."""
from pathlib import Path
import argparse,copy,hashlib,importlib.util,json,shutil,subprocess,tempfile
from library_publication import publication_lock

ROOT=Path(__file__).resolve().parents[2]
HERE=ROOT/'assets/source/characters-3d/authoring'
OUT=ROOT/'web/public/models/characters'
parser=argparse.ArgumentParser()
parser.add_argument('--item',action='append',required=True)
parser.add_argument('--allow-mesh-node-transforms',action='store_true',help='Allow selected leaf mesh origins to change; roots and named markers retain their native attachment')
parser.add_argument('--blender',default='/Applications/Blender.app/Contents/MacOS/Blender')
parser.add_argument('--directory',type=Path,default=OUT,help='Existing complete library; use a private copy for review')
parser.add_argument('--source-directory',type=Path,default=HERE,help='Frozen authoring source for a private review build')
parser.add_argument('--update-child-transforms',action='store_true',help='Apply intentional selected-item child transforms, while preserving the item attachment root')
args=parser.parse_args()
if args.source_directory.resolve()!=HERE.resolve() and args.directory.resolve()==OUT.resolve():
    raise ValueError('Build frozen sources into a private library; production must use current source.')
OUT=args.directory.resolve()
HERE=args.source_directory.resolve()
sources={str(path):hashlib.sha256(path.read_bytes()).hexdigest()for path in HERE.glob('*.py')}
spec=importlib.util.spec_from_file_location('animation_merge',Path(__file__).with_name('merge-animation-bank.py'))
merge=importlib.util.module_from_spec(spec);spec.loader.exec_module(merge)
spec=importlib.util.spec_from_file_location('gltf_pack',HERE/'gltf_pack.py')
packing=importlib.util.module_from_spec(spec);spec.loader.exec_module(packing)
manifest_path=OUT/'manifest.json'
manifest=json.loads(manifest_path.read_text())
assert manifest['complete']
initial_equipment=copy.deepcopy(manifest['equipment'])
destination=OUT/'equipment.glb'
before=hashlib.sha256(destination.read_bytes()).hexdigest()
for item in args.item:assert item in manifest['equipment']['items'],item
with tempfile.TemporaryDirectory(prefix='granaderos-equipment-')as directory:
    directory=Path(directory)
    command=[args.blender,'--background','--factory-startup','--python',str(HERE/'build.py'),'--','equipment','--output-dir',str(directory),'--metadata-dir',str(directory)]
    result=subprocess.run(command,cwd=ROOT,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
    assert result.returncode==0 and 'ASSET_READY equipment'in result.stdout,result.stdout[-3000:]
    if any(hashlib.sha256(Path(path).read_bytes()).hexdigest()!=value for path,value in sources.items()):
        raise ValueError('Authoring source changed during the build; no assets were published.')
    if hashlib.sha256(destination.read_bytes()).hexdigest()!=before:
        raise ValueError('Another build changed the equipment; no assets were published.')
    target=directory/'equipment-merged.glb'
    shutil.copy2(destination,target)
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
        root_name=name
        old={doc['nodes'][index]['name']:index for index in descendants(doc,nodes[name])}
        new={fresh['nodes'][index]['name']:index for index in descendants(fresh,fresh_nodes[name])}
        assert set(old)==set(new),name+' changes attachment nodes'
        for name,index in new.items():
            source=fresh['nodes'][index];existing=doc['nodes'][old[name]]
            keys=('translation','rotation','scale','matrix')
            leaf_mesh=(name!=root_name and 'mesh'in source and 'mesh'in existing and not source.get('children') and not existing.get('children') and 'skin'not in source and 'skin'not in existing)
            if (args.update_child_transforms and name!=root_name) or (args.allow_mesh_node_transforms and leaf_mesh):
                for key in keys:
                    if key in source:existing[key]=copy.deepcopy(source[key])
                    else:existing.pop(key,None)
            else:assert {key:source.get(key)for key in keys}=={key:existing.get(key)for key in keys},name+' changes native attachment'
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
    with publication_lock(OUT):
        # Keep unrelated metadata from independent appearance/motion increments.
        manifest=json.loads(manifest_path.read_text())
        if manifest['equipment']!=initial_equipment or hashlib.sha256(destination.read_bytes()).hexdigest()!=before:
            raise ValueError('Another build changed the equipment; no assets were published.')
        manifest['equipment'].update(bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest())
        pending=destination.with_suffix('.glb.pending')
        shutil.copy2(target,pending)
        pending.replace(destination)
        pending=manifest_path.with_suffix('.json.pending')
        pending.write_text(json.dumps(manifest,indent=2)+'\n')
        pending.replace(manifest_path)
print(json.dumps({'items':args.item,'bytes':len(raw),'sha256':manifest['equipment']['sha256']},indent=2))
