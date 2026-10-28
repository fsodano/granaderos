from pathlib import Path
import json,hashlib,subprocess,sys
E=Path(__file__).parent;expected=json.loads((E/'before-runtime-test-asset.json').read_text());root=Path(sys.argv[1]).resolve()
def sha(path):
 h=hashlib.sha256()
 with path.open('rb') as stream:
  for data in iter(lambda:stream.read(1024*1024),b''):h.update(data)
 return h.hexdigest()
files={p for p in subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z'],cwd=root).decode().split('\0') if p and not p.startswith(('docs/','artifacts/'))}
missing=sorted(set(expected)-files);extra=sorted(files-set(expected));different=[]
for file,row in expected.items():
 p=root/file
 if file in missing:continue
 if row.get('gitlink'):
  actual=subprocess.check_output(['git','ls-files','-s','--',file],cwd=root,text=True).split();equal=len(actual)>1 and actual[1]==row['gitlink']
 else:equal=p.is_file() and p.stat().st_size==row['bytes'] and sha(p)==row['sha256']
 if not equal:different.append(file)
expected_identity=json.loads((E/'before-input-summary.json').read_text())['buildIdentity']
actual_identity=json.loads(subprocess.check_output(['node','tools/build-identity.mjs'],cwd=root,text=True))
identity_equal=expected_identity['source']==actual_identity['source'] and expected_identity['version']==actual_identity['version']
result={'expectedProductionIdentity':expected_identity,'actualProductionIdentity':actual_identity,'productionSourceIdentityEqual':identity_equal,'root':str(root),'expectedFiles':len(expected),'actualFiles':len(files),'missing':missing,'extra':extra,'different':different,'equal':not(missing or extra or different) and identity_equal,'scope':'All tracked and non-ignored untracked non-doc/artifact source, tests and assets; exact bytes, gitlink and production source identity. Read-only check.'};print(json.dumps(result,indent=2));raise SystemExit(0 if result['equal'] else 1)
