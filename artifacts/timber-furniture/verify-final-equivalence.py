"""Read only: compare every non-document input with the gated piece12 inputs."""
from pathlib import Path
import hashlib,json,sys,subprocess
reference=Path(__file__).parent;root=Path(sys.argv[1]).resolve()
expected=json.loads((reference/'before-inputs.json').read_text());sha=lambda raw:hashlib.sha256(raw).hexdigest()
# git ls-files applies the repository ignore rules to generated caches/outputs.
# Only docs/ and artifacts/ are excluded from the captured input file map.
in_scope=lambda p:not p.startswith(('docs/','artifacts/'))
selected={p:r for p,r in expected['allRepositoryInputFiles'].items() if in_scope(p)}
expected_links=json.loads((reference/'gitlink-inputs.json').read_text())['pins']
expected_links={p:v for p,v in expected_links.items() if in_scope(p)}
mismatches=[]
for rel,pin in selected.items():
 p=root/rel
 if 'link' in pin:
  if not p.is_symlink() or str(p.readlink())!=pin['link']:mismatches.append({'path':rel,'reason':'symlink differs'})
 elif not p.is_file():mismatches.append({'path':rel,'reason':'missing file'})
 elif sha(p.read_bytes())!=pin['sha256']:mismatches.append({'path':rel,'reason':'hash differs'})
links={}
for item in subprocess.check_output(['git','ls-files','--stage','-z'],cwd=root).decode().split('\0'):
 if not item:continue
 spec,path=item.split('\t',1);mode,oid,stage=spec.split()
 if mode=='160000' and in_scope(path):
  if stage!='0':mismatches.append({'path':path,'reason':'unresolved gitlink'})
  links[path]=oid
paths=set(subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z'],cwd=root).decode().split('\0'))-{''}
unexpected=sorted(p for p in paths if in_scope(p) and p not in selected and p not in expected_links)
link_errors=[]
for rel,oid in links.items():
 p=root/rel
 if (p/'.git').exists():
  actual=subprocess.check_output(['git','rev-parse','HEAD'],cwd=p,text=True).strip()
  dirty=subprocess.check_output(['git','status','--porcelain'],cwd=p,text=True)
  if actual!=oid or dirty:link_errors.append({'path':rel,'head':actual,'expected':oid,'dirty':dirty})
identity=json.loads(subprocess.check_output(['node',str(root/'tools/build-identity.mjs')],cwd=root,text=True))
wanted=json.loads((reference/'production-source-identity.json').read_text())
result={'comparedRoot':str(root),'scope':'all tracked and nonignored untracked input files; exclude docs/artifacts and ignored generated caches/outputs only','expectedInputFiles':len(selected),'mismatches':mismatches,'unexpectedInputPaths':unexpected,'expectedGitlinks':expected_links,'actualGitlinks':links,'gitlinkPinsExact':links==expected_links,'gitlinkWorkingTreeErrors':link_errors,'sourceIdentityExact':identity['source']==wanted['source'],'sourceIdentity':identity['source'],'gitRevisionMayDiffer':identity['revision']!=wanted['revision'],'allNonDocumentInputHashesExact':not mismatches and not unexpected and links==expected_links and not link_errors}
runtime_ok=True
if '--runtime' in sys.argv[2:]:
 run=subprocess.run([sys.executable,str(reference/'verify-runtime.py'),str(root)],capture_output=True,text=True)
 result['runtimeAndDependencyProof']=json.loads(run.stdout)
 runtime_ok=run.returncode==0
print(json.dumps(result,indent=2))
sys.exit(0 if result['allNonDocumentInputHashesExact'] and result['sourceIdentityExact'] and runtime_ok else 1)
