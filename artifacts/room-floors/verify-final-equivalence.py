"""Read-only comparison of final piece 18 source, engine, production identity and optional runtime inputs."""
from pathlib import Path
import argparse, hashlib, json, os, re, shutil, subprocess

def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda:stream.read(1024*1024),b''): h.update(block)
    return h.hexdigest()
def meta(path):
    row={'sha256':sha(path),'bytes':path.stat().st_size}
    if path.is_symlink(): row['linkTarget']=os.readlink(path)
    return row
def canonical(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def engine(root):
    raw=subprocess.check_output(['git','ls-files','--stage','--','engine'],cwd=root,text=True).strip()
    metadata,path=raw.split('\t');mode,pin,stage=metadata.split();p=root/path;initialized=(p/'.git').exists()
    return {'path':path,'mode':mode,'gitlink':pin,'indexStage':int(stage),'initialized':initialized,
            'head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=p,text=True).strip() if initialized else None,
            'dirtyPorcelain':subprocess.check_output(['git','status','--porcelain','--untracked-files=all'],cwd=p,text=True) if initialized else None,
            'uninitializedDirectoryContents':sorted(x.name for x in p.iterdir()) if not initialized and p.exists() else [],
            'submoduleStatus':subprocess.check_output(['git','submodule','status','--',path],cwd=root,text=True).strip()}
def dependencies(root):
    files={};links={};omit={'.cache','.vite','.vite-temp','.vinext','.next'}
    for directory,dirs,names in os.walk(root,followlinks=False):
        dirs[:]=sorted(d for d in dirs if d not in omit)
        for name in dirs+sorted(names):
            p=Path(directory)/name;relative=str(p.relative_to(root))
            if p.is_symlink():
                target=os.readlink(p);links[relative]={'target':target,'targetTextSha256':hashlib.sha256(target.encode()).hexdigest()}
            elif p.is_file(): files[relative]=meta(p)
    return files,links

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('root',type=Path)
parser.add_argument('--include-dependencies',action='store_true')
parser.add_argument('--strict-runtime',action='store_true',help='Also compare private installed dependencies, tool launchers, package files, library bytes, actual versions and relevant environment.')
parser.add_argument('--runtime-path-prefix',help='Optional read-only PATH prefix. For the accepted runtime use /usr/bin:/bin:/opt/homebrew/bin.')
parser.add_argument('--production-build-info',type=Path)
args=parser.parse_args();root=args.root.resolve();E=Path(__file__).resolve().parent
expected=json.loads((E/'source-inputs.json').read_bytes())
names=subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z'],cwd=root).decode().split('\0')
actual={name:meta(root/name) for name in sorted(set(names)) if name and not name.startswith(('docs/','artifacts/')) and name!='web/next-env.d.ts' and not name.endswith('.tsbuildinfo') and (root/name).is_file()}
missing=sorted(set(expected)-set(actual));extra=sorted(set(actual)-set(expected));changed=sorted(n for n in set(expected)&set(actual) if expected[n]!=actual[n])
env=dict(os.environ)
if args.runtime_path_prefix: env['PATH']=args.runtime_path_prefix+os.pathsep+env['PATH']
node=shutil.which('node',path=env['PATH']);assert node
expected_identity=json.loads((E/'build-identity-before.json').read_bytes())
observed_identity=json.loads(subprocess.check_output([node,'tools/build-identity.mjs'],cwd=root,env=env,text=True))
identity_exact=all(expected_identity[k]==observed_identity[k] for k in ['source','version'])
expected_engine=json.loads((E/'engine-input-pin.json').read_bytes())['engine'];observed_engine=engine(root)
result={'root':str(root),'scope':'All tracked and nonignored non-doc/artifact input files, raw bytes, engine state and production source/version identity. Generated next-env.d.ts, *.tsbuildinfo and ignored build/dependency caches are outputs. Revision labels may differ. No gate or root write.',
        'expectedFiles':len(expected),'actualFiles':len(actual),'expectedInputEntriesIncludingEngine':len(expected)+1,'actualInputEntriesIncludingEngine':len(actual)+1,
        'missing':missing,'extra':extra,'changed':changed,'sourceInputsExact':not(missing or extra or changed),
        'expectedInputDigest':canonical(expected),'actualInputDigest':canonical(actual),
        'expectedProductionIdentity':expected_identity,'actualSourceIdentity':observed_identity,'productionSourceAndVersionExact':identity_exact,
        'expectedEngine':expected_engine,'actualEngine':observed_engine,'engineExact':expected_engine==observed_engine}
equal=result['sourceInputsExact'] and identity_exact and result['engineExact']
if args.production_build_info:
    output_identity=json.loads(args.production_build_info.read_bytes())
    result['actualProductionOutputIdentity']=output_identity
    result['productionOutputSourceAndVersionExact']=all(expected_identity[k]==output_identity[k] for k in ['source','version'])
    equal=equal and result['productionOutputSourceAndVersionExact']
if args.include_dependencies or args.strict_runtime:
    pinned=json.loads((E/'dependency-inputs-before.json').read_bytes());files,links=dependencies(root/'web/node_modules')
    result['dependencies']={'expectedFiles':pinned['fileCount'],'actualFiles':len(files),'expectedLinks':pinned['linkCount'],'actualLinks':len(links),
                            'exact':pinned['files']==files and pinned['links']==links,
                            'expectedDigest':pinned['sha256'],'actualDigest':canonical({'files':files,'links':links})}
    equal=equal and result['dependencies']['exact']
if args.strict_runtime:
    runtime=json.loads((E/'runtime.json').read_bytes());assets=json.loads((E/'runtime-assets-before.json').read_bytes());tools={}
    for name,row in runtime['executables'].items():
        found=shutil.which(name,path=env['PATH']);p=Path(found).resolve() if found else None
        if name=='npm' and p:
            version=json.loads((p.parent.parent/'package.json').read_bytes())['version'];expected_version=runtime['npmVersion']
        elif name=='node' and p: version=subprocess.check_output([str(p),'--version'],env=env,text=True).strip();expected_version=runtime['nodeVersion']
        elif name=='python3' and p: version=subprocess.check_output([str(p),'--version'],env=env,text=True).strip().split()[-1];expected_version=runtime['pythonVersion']
        else: version=expected_version=None
        tools[name]={'expectedPath':row['path'],'actualPath':str(p) if p else None,'expectedVersion':expected_version,'actualVersion':version,
                     'exact':p is not None and str(p)==row['path'] and meta(p)=={k:v for k,v in row.items() if k!='path'} and version==expected_version}
    package_rows={}
    package_roots={'npm':Path(runtime['npmPath']).parent.parent,'numpy':Path(runtime['numpyPath']).parent,'pillow':Path(runtime['pillowPath']).parent}
    for label,package_root in package_roots.items():
        for directory,dirs,names in os.walk(package_root):
            dirs[:]=sorted(d for d in dirs if d not in ['__pycache__','.cache'] and (label!='npm' or d not in ['docs','man']))
            for name in sorted(names):
                if name.endswith(('.pyc','.pyo')): continue
                p=Path(directory)/name
                if p.is_file(): package_rows[label+'/'+str(p.relative_to(package_root))]={'path':str(p),**meta(p)}
    package_exact=package_rows==assets['packageFiles']
    libraries_exact=all(Path(path).is_file() and meta(Path(path))==row for path,row in assets['dynamicLibraries'].items())
    probe="import sys,json,numpy,PIL;print(json.dumps({'pythonVersion':sys.version.split()[0],'pythonPath':sys.executable,'numpyVersion':numpy.__version__,'numpyPath':numpy.__file__,'pillowVersion':PIL.__version__,'pillowPath':PIL.__file__}))"
    python=shutil.which('python3',path=env['PATH']);python_observed=json.loads(subprocess.check_output([python,'-c',probe],env=env,text=True))
    python_exact=all(python_observed[key]==runtime[key] for key in python_observed)
    inherited={key:{'expected':value,'actual':env.get(key),'exact':value==env.get(key)} for key,value in runtime['environment'].items() if key not in ['PATH','GRANADEROS_TEST_CONCURRENCY']}
    runtime_exact=all(row['exact'] for row in tools.values()) and package_exact and libraries_exact and python_exact and all(row['exact'] for row in inherited.values())
    result['runtime']={'tools':tools,'packageFiles':assets['packageFilesCount'],'packageFilesExact':package_exact,
                       'dynamicLibraries':assets['dynamicLibraryCount'],'dynamicLibrariesExact':libraries_exact,
                       'observedPythonVersionsAndPaths':python_observed,'pythonExact':python_exact,'inheritedEnvironment':inherited,
                       'scope':assets['scope'],'exact':runtime_exact}
    equal=equal and runtime_exact
result['equal']=equal
print(json.dumps(result,indent=2))
raise SystemExit(0 if equal else 1)
