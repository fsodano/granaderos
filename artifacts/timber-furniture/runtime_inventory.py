"""Read-only executable/dependency identity utilities, outside candidate source."""
from pathlib import Path
import hashlib,json,stat,subprocess,sys,sysconfig,shutil,os,importlib,importlib.util,platform
sha=lambda raw:hashlib.sha256(raw).hexdigest()
def generated(rel):
 parts=Path(rel).parts
 return any(p in ['.vite','.vite-temp','.cache','__pycache__'] for p in parts) or rel.endswith(('.pyc','.pyo')) or Path(rel).name=='.DS_Store'
def inventory(root):
 root=Path(root);code={};cache={}
 for p in sorted(root.rglob('*')):
  if p.is_dir() and not p.is_symlink():continue
  rel=p.relative_to(root).as_posix();mode=stat.S_IMODE(p.lstat().st_mode)
  if p.is_symlink():row={'link':str(p.readlink()),'mode':mode}
  elif p.is_file():raw=p.read_bytes();row={'sha256':sha(raw),'bytes':len(raw),'mode':mode}
  else:continue
  (cache if generated(rel) else code)[rel]=row
 return code,cache
canonical=lambda value:json.dumps(value,sort_keys=True,separators=(',',':')).encode()
def digest(rows):return sha(canonical(rows))
def runtime():
 env=os.environ.copy();env['PYTHONDONTWRITEBYTECODE']='1'
 node=json.loads(subprocess.check_output(['node','-p','JSON.stringify({version:process.version,execPath:process.execPath,platform:process.platform,arch:process.arch})'],text=True,env=env));node['binarySha256']=sha(Path(node['execPath']).read_bytes())
 npm_cli=Path(shutil.which('npm')).resolve();assert npm_cli.name=='npm-cli.js';npm_root=npm_cli.parent.parent
 r={'node':node,'npm':{'version':subprocess.check_output(['npm','--version'],text=True,env=env).strip(),'cliPath':str(npm_cli),'cliSha256':sha(npm_cli.read_bytes()),'packageRoot':str(npm_root)},'python':{'version':platform.python_version(),'executable':str(Path(sys.executable).resolve()),'binarySha256':sha(Path(sys.executable).read_bytes()),'stdlibRoot':sysconfig.get_path('stdlib')},'host':{'system':platform.system(),'release':platform.release(),'machine':platform.machine(),'macVersion':platform.mac_ver()[0]},'optionalPythonPackages':{}}
 sys.dont_write_bytecode=True
 for name in ['PIL','numpy','trimesh']:
  spec=importlib.util.find_spec(name)
  if spec is None:r['optionalPythonPackages'][name]={'installed':False};continue
  mod=importlib.import_module(name);r['optionalPythonPackages'][name]={'installed':True,'version':getattr(mod,'__version__',None),'packageRoot':str(Path(mod.__file__).parent),'entryFile':str(Path(mod.__file__)),'entrySha256':sha(Path(mod.__file__).read_bytes())}
 framework=Path(sys.base_prefix)/'Python3'
 if framework.is_file():r['python']['sharedFramework']={'path':str(framework),'sha256':sha(framework.read_bytes())}
 return r
