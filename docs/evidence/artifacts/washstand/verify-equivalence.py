"""Read-only comparison after corrected bedding and ordered pieces 9 through 14 integration."""
from pathlib import Path
import argparse,hashlib,json,os,subprocess

def sha(raw):return hashlib.sha256(raw).hexdigest()
def meta(path):
    result={'sha256':sha(path.read_bytes()),'bytes':path.stat().st_size}
    if path.is_symlink():result['linkTarget']=os.readlink(path)
    return result
def canonical(value):return sha(json.dumps(value,sort_keys=True,separators=(',',':')).encode())

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--root',required=True,type=Path)
parser.add_argument('--include-dependencies',action='store_true')
parser.add_argument('--production-build-info',type=Path,help='Also compare a specific production output build-info.json.')
args=parser.parse_args();root=args.root.resolve();evidence=Path(__file__).resolve().parent
expected=json.loads((evidence/'inputs-before.json').read_bytes())['orderedIntegrationInputs']
names=subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z'],cwd=root).decode().split('\0')
actual={name:meta(root/name)for name in sorted(set(names))if name and not name.startswith(('docs/','artifacts/'))and name!='web/next-env.d.ts'and not name.endswith('.tsbuildinfo')and(root/name).is_file()}
missing=sorted(expected.keys()-actual.keys());extra=sorted(actual.keys()-expected.keys());changed=[name for name in sorted(expected.keys()&actual.keys())if expected[name]!=actual[name]]
result={'root':str(root),'expectedOrderedIntegrationInputSha256':canonical(expected),'actualOrderedIntegrationInputSha256':canonical(actual),'expectedFiles':len(expected),'actualFiles':len(actual),'missing':missing,'extra':extra,'changed':changed,'exactRuntimeTestAssetAndConfigurationInputs':not(missing or extra or changed)}
def engine_state(directory):
    raw=subprocess.check_output(['git','ls-files','--stage','--','engine'],cwd=directory,text=True).strip()
    metadata,path=raw.split('\t');mode,pin,stage=metadata.split()
    engine=directory/path;initialized=(engine/'.git').exists()
    return {'path':path,'mode':mode,'gitlink':pin,'indexStage':int(stage),'initialized':initialized,'head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=engine,text=True).strip()if initialized else None,'dirtyPorcelain':subprocess.check_output(['git','status','--porcelain','--untracked-files=all'],cwd=engine,text=True)if initialized else None,'uninitializedDirectoryContents':sorted(p.name for p in engine.iterdir())if not initialized and engine.exists()else [],'submoduleStatus':subprocess.check_output(['git','submodule','status','--',path],cwd=directory,text=True).strip()}
expected_engine=json.loads((evidence/'engine-input-pin.json').read_bytes())['engine']
actual_engine=engine_state(root)
result['expectedEngine']=expected_engine;result['actualEngine']=actual_engine
result['expectedInputEntriesIncludingEngine']=len(expected)+1;result['actualInputEntriesIncludingEngine']=len(actual)+1
result['engineGitlinkInitializationAndDirtyStateExact']=expected_engine==actual_engine
baseline=json.loads((evidence/'build-identity-before.json').read_bytes())
current_identity=json.loads(subprocess.check_output(['node','tools/build-identity.mjs'],cwd=root,text=True))
gates=json.loads((evidence/'gate-results.json').read_bytes())
production=gates.get('production-build',{})
production_identity=production.get('buildIdentity')
result['expectedInitialSourceIdentity']=baseline;result['actualSourceIdentity']=current_identity
result['sourceAndVersionExact']=all(current_identity.get(key)==baseline.get(key)for key in ['source','version'])
result['expectedProductionIdentity']=production_identity
result['productionGateSealed']=production.get('exitCode')==0 and production_identity is not None
result['currentSourceAndVersionEqualSealedProduction']=result['productionGateSealed']and all(current_identity.get(key)==production_identity.get(key)for key in ['source','version'])
if args.production_build_info:
    output_identity=json.loads(args.production_build_info.read_bytes())
    result['actualProductionOutputIdentity']=output_identity
    result['productionOutputSourceAndVersionExact']=production_identity is not None and all(output_identity.get(key)==production_identity.get(key)for key in ['source','version'])
if args.include_dependencies:
    before=json.loads((evidence/'dependency-inputs-before.json').read_bytes());files={};links={};omit={'.cache','.vite','.vite-temp','.vinext','.next'};dependencies=root/'web/node_modules'
    for current,dirs,names in os.walk(dependencies,followlinks=False):
        dirs[:]=[name for name in dirs if name not in omit]
        for name in dirs+names:
            path=Path(current)/name;relative=str(path.relative_to(dependencies))
            if path.is_symlink():
                target=os.readlink(path);links[relative]={'target':target,'targetTextSha256':sha(target.encode())}
            elif path.is_file():files[relative]=meta(path)
    result['dependenciesExact']=before['files']==files and before['links']==links
    result['expectedDependencySha256']=before['sha256'];result['actualDependencySha256']=canonical({'files':files,'links':links})
print(json.dumps(result,indent=2))
raise SystemExit(0 if result['exactRuntimeTestAssetAndConfigurationInputs']and result.get('dependenciesExact',True)and result['engineGitlinkInitializationAndDirtyStateExact']and result['sourceAndVersionExact']and result['currentSourceAndVersionEqualSealedProduction']and result.get('productionOutputSourceAndVersionExact',True)else 1)
