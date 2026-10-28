from pathlib import Path
import argparse,json,hashlib,subprocess,os,shutil
parser=argparse.ArgumentParser(description='Read-only byte/source comparison. Optional strict check also pins dependencies, runtime launchers and relevant inherited environment. No gate or root write.')
parser.add_argument('root');parser.add_argument('--strict-runtime',action='store_true');parser.add_argument('--runtime-bin',help='Optional runtime bin directory prepended only for this read-only check.');args=parser.parse_args()
E=Path(__file__).parent;expected=json.loads((E/'before-runtime-test-asset.json').read_text());root=Path(args.root).resolve();env=dict(os.environ)
if args.runtime_bin:env['PATH']=args.runtime_bin+os.pathsep+env['PATH']
def sha(path):
 h=hashlib.sha256()
 with Path(path).open('rb') as f:
  for data in iter(lambda:f.read(1024*1024),b''):h.update(data)
 return h.hexdigest()
files={p for p in subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z'],cwd=root).decode().split('\0') if p and not p.startswith(('docs/','artifacts/'))}
missing=sorted(set(expected)-files);extra=sorted(files-set(expected));different=[];engine=[]
for name,row in expected.items():
 p=root/name
 if name in missing:continue
 if row.get('gitlink'):
  entry=subprocess.check_output(['git','ls-files','-s','--',name],cwd=root,text=True).split();initialized=(p/'.git').exists();exact=len(entry)>1 and entry[1]==row['gitlink'] and initialized==row['initialized'];engine.append({'path':name,'expectedGitlink':row['gitlink'],'actualGitlink':entry[1] if len(entry)>1 else None,'expectedInitialized':row['initialized'],'actualInitialized':initialized,'exact':exact})
 else:exact=p.is_file() and p.stat().st_size==row['bytes'] and sha(p)==row['sha256']
 if not exact:different.append(name)
expected_identity=json.loads((E/'before-input-summary.json').read_text())['buildIdentity'];node=shutil.which('node',path=env['PATH']);assert node,'Node runtime is unavailable.'
actual_identity=json.loads(subprocess.check_output([node,'tools/build-identity.mjs'],cwd=root,env=env,text=True));identity_equal=expected_identity['source']==actual_identity['source'] and expected_identity['version']==actual_identity['version']
result={'root':str(root),'expectedFiles':len(expected),'actualFiles':len(files),'missing':missing,'extra':extra,'different':different,'expectedProductionIdentity':expected_identity,'actualProductionIdentity':actual_identity,'productionSourceIdentityEqual':identity_equal,'engineStates':engine,'strictRuntimeRequested':args.strict_runtime,'scope':'All tracked and non-ignored untracked non-doc/artifact inputs, exact raw bytes, engine gitlink/initialization and production source identity. Root revision label may differ. No tests/build/root writes.'}
source_equal=not(missing or extra or different) and identity_equal
runtime_equal=True
if args.strict_runtime:
 runtime=json.loads((E/'runtime.json').read_text());pinned=json.loads((E/'dependency-files.json').read_text());actual={};dependency_root=(root/'web/node_modules').resolve()
 for directory,dirs,entries in os.walk(dependency_root):
  dirs[:]=sorted(d for d in dirs if d not in ['.cache','.vite','.vite-temp'])
  for name in sorted(entries):
   p=Path(directory)/name
   if p.is_file():actual[str(p.relative_to(dependency_root))]={'sha256':sha(p),'bytes':p.stat().st_size,**({'symlink':os.readlink(p)} if p.is_symlink() else {})}
 dep_diff=sorted(p for p in set(pinned)&set(actual) if pinned[p]!=actual[p]);dep_missing=sorted(set(pinned)-set(actual));dep_extra=sorted(set(actual)-set(pinned));executables={}
 for command,row in runtime['executables'].items():
  found=shutil.which(command,path=env['PATH']);p=Path(found).resolve() if found else None;observed=sha(p) if p and p.is_file() else None
  if p and command=='npm':
   metadata=p.parent.parent/'package.json';version=json.loads(metadata.read_text()).get('version') if metadata.is_file() else None
  elif p:version=subprocess.check_output([str(p),'--version'],env=env,text=True).strip()
  else:version=None
  executables[command]={'expectedPath':row['path'],'actualPath':str(p) if p else None,'expectedSha256':row['sha256'],'actualSha256':observed,'expectedVersion':row['version'],'actualVersion':version,'exact':observed==row['sha256'] and version==row['version']}
 inherited={key:{'expected':value,'actual':env.get(key),'exact':value==env.get(key)} for key,value in runtime['inheritedBuildAndRunnerEnvironment'].items()}
 runtime_equal=not(dep_diff or dep_missing or dep_extra) and all(row['exact'] for row in executables.values()) and all(row['exact'] for row in inherited.values())
 result['runtimeProof']={'dependencyFiles':len(actual),'expectedDependencyFiles':len(pinned),'dependencyRoot':str(dependency_root),'different':dep_diff,'missing':dep_missing,'extra':dep_extra,'executables':executables,'inheritedEnvironment':inherited,'excludedGeneratedDependencyCaches':['.cache','.vite','.vite-temp'],'exact':runtime_equal,'quickWorkerCountIsPinnedInGateReceipt':4}
result['sourceEqual']=source_equal;result['equal']=source_equal and runtime_equal;print(json.dumps(result,indent=2));raise SystemExit(0 if result['equal'] else 1)
