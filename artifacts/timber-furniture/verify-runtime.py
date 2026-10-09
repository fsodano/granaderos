"""Read-only strict comparison with the captured piece12 executable/dependency code."""
from pathlib import Path
import json,sys
from runtime_inventory import inventory,runtime,digest
out=Path(__file__).parent;root=Path(sys.argv[1]).resolve();wanted=json.loads((out/'runtime-seal.json').read_text());actual=runtime();w=wanted['identity'];identity_errors=[]
for group,fields in {'node':['version','platform','arch','binarySha256'],'npm':['version','cliSha256'],'python':['version','binarySha256'],'host':['system','release','machine','macVersion']}.items():
 for field in fields:
  if actual[group][field]!=w[group][field]:identity_errors.append({'component':group,'field':field,'expected':w[group][field],'actual':actual[group][field]})
if actual['python'].get('sharedFramework',{}).get('sha256')!=w['python'].get('sharedFramework',{}).get('sha256'):identity_errors.append({'component':'python','field':'sharedFramework','reason':'Python shared framework hash differs'})
for name,expected in w['optionalPythonPackages'].items():
 found=actual['optionalPythonPackages'].get(name,{})
 for field in ['installed','version','entrySha256']:
  if found.get(field)!=expected.get(field):identity_errors.append({'component':'pythonPackage:'+name,'field':field,'expected':expected.get(field),'actual':found.get(field)})
results={};code,cache=inventory(root/'web/node_modules');expected=wanted['trees']['webNodeModules']
def compare(name,rows,expected):
 wanted_rows=expected['files'];changed=[p for p in sorted(set(rows)|set(wanted_rows)) if rows.get(p)!=wanted_rows.get(p)]
 return {'capturedFileCount':expected['fileCount'],'actualFileCount':len(rows),'expectedManifestSha256':expected['manifestSha256'],'actualManifestSha256':digest(rows),'exact':not changed,'changedPathCount':len(changed),'changedPaths':changed[:30]}
results['webNodeModules']=compare('webNodeModules',code,expected)
if not identity_errors:
 roots={'npmDistribution':actual['npm']['packageRoot'],'pythonStdlib':actual['python']['stdlibRoot']}
 for name,row in actual['optionalPythonPackages'].items():
  if row['installed']:roots['pythonPackage:'+name]=row['packageRoot']
 for name,path in roots.items():
  code,_=inventory(path);results[name]=compare(name,code,wanted['trees'][name])
passed=not identity_errors and all(row['exact'] for row in results.values()) and len(results)==len(wanted['trees'])
r={'root':str(root),'strictRuntimeAndDependencyCodeExact':passed,'identityErrors':identity_errors,'treeProofs':results,'actualRuntimeIdentity':actual,'generatedWebDependencyCachesReportedSeparately':{'actualFileCount':len(cache),'initialSealFileCount':len(wanted['generatedWebDependencyFiles']),'excludedFromCodeIdentity':True},'limits':wanted['coverage'][-1],'readOnly':True}
print(json.dumps(r,indent=2));sys.exit(0 if passed else 1)
