import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const python = source => JSON.parse(execFileSync('python3', ['-c', `
from pathlib import Path
import sys, json, copy, importlib.util
root=Path.cwd();sys.path.insert(0,str(root/'tools/characters-3d'))
from cloth_material_roles import retained_charcoal_material
from apparel_surface_context import unwrap_body_and_record
s=importlib.util.spec_from_file_location('glb',root/'tools/characters-3d/merge-animation-bank.py');glb=importlib.util.module_from_spec(s);s.loader.exec_module(glb)
doc,binary,predecessor=unwrap_body_and_record(root,'woman-shawl',0)
mesh=next(n['mesh'] for n in doc['nodes'] if n.get('name')=='Human_legwear_LOD0');active=doc['meshes'][mesh]['primitives'][0]['material']
${source}
`], {cwd:new URL('..',import.meta.url),encoding:'utf8'}));

test('active hem maps select the correct charcoal source despite an earlier inactive material with the same name', () => {
  const result=python(`
selected=retained_charcoal_material(doc,active);before=copy.deepcopy(doc)
wrong=copy.deepcopy(doc['materials'][selected]);wrong['normalTexture']['scale']=.5
doc['materials'].insert(0,wrong)
assert retained_charcoal_material(doc,active+1)==selected+1
assert doc['materials'][0]==wrong and doc['materials'][1:]==before['materials']
print(json.dumps({'correctActiveRole':True,'inactiveProvenanceRetained':True}))
`);
  assert.deepEqual(result,{correctActiveRole:true,inactiveProvenanceRetained:true});
});

test('equivalent texture aliases preserve the selected surface without mutating its document', () => {
  const result=python(`
selected=retained_charcoal_material(doc,active);equivalent=copy.deepcopy(doc['materials'][selected])
for key,parent in [('normalTexture',equivalent),('baseColorTexture',equivalent['pbrMetallicRoughness']),('metallicRoughnessTexture',equivalent['pbrMetallicRoughness'])]:
 texture=copy.deepcopy(doc['textures'][parent[key]['index']]);image=copy.deepcopy(doc['images'][texture['source']]);image['name']='An inactive alias of the same image';doc['images'].append(image);texture['source']=len(doc['images'])-1;doc['textures'].append(texture);parent[key]['index']=len(doc['textures'])-1
doc['materials'].append(equivalent);before=copy.deepcopy(doc)
assert retained_charcoal_material(doc,active)==selected and doc==before
print(json.dumps({'equivalentResourcesAccepted':True,'documentExact':True}))
`);
  assert.deepEqual(result,{equivalentResourcesAccepted:true,documentExact:true});
});

test('missing surface bindings and conflicting charcoal resources fail instead of selecting a name match', () => {
  const result=python(`
selected=retained_charcoal_material(doc,active);errors=[]
original=copy.deepcopy(doc);wrong=copy.deepcopy(doc['materials'][selected]);wrong['pbrMetallicRoughness']['baseColorTexture']['index']=doc['materials'][active]['pbrMetallicRoughness']['baseColorTexture']['index'];wrong['pbrMetallicRoughness']['baseColorTexture'].pop('texCoord',None);doc['materials'].append(wrong)
try:retained_charcoal_material(doc,active)
except AssertionError as error:assert 'Ambiguous' in str(error);errors.append('ambiguous colour resource')
doc=original;doc['materials'][selected]['normalTexture']['scale']=.5
try:retained_charcoal_material(doc,active)
except AssertionError as error:assert 'Missing retained' in str(error);errors.append('missing active surface')
print(json.dumps({'rejected':errors}))
`);
  assert.deepEqual(result,{rejected:['ambiguous colour resource','missing active surface']});
});
