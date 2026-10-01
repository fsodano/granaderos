import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,copyFileSync,rmSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,dirname,join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const auditPath='docs/evidence/formal-audit-2026-09-27';
const archived=JSON.parse(readFileSync(join(root,auditPath,'checks.json'),'utf8'));
const register=JSON.parse(readFileSync(join(root,'docs/verification/requirements.json'),'utf8'));

function legacy(){
 const data=structuredClone(register);
 for(const key of ['latestLocalCheck','latestPublishedCheck','sourceRelationship','snapshotSummary'])delete data[key];
 return data;
}
function current(){
 const data=legacy(),evidenceId=data.evidence[0].id;
 data.baseline='c'.repeat(40);
 data.latestPublishedCheck={source:'b'.repeat(40),total:29,passed:29,failed:0,skipped:0,types:'PASS',build:'PASS',evidenceId};
 data.latestLocalCheck={source:'a'.repeat(40),total:31,passed:31,failed:0,skipped:0,types:'PASS',build:'PASS',evidenceId};
 data.sourceRelationship='The published source and later local candidate have separate evidence.';
 data.snapshotSummary='The dated failures remain historical. Current checks do not certify full gameplay or loaded performance.';
 return data;
}
function fixture(t,data){
 const dir=mkdtempSync(join(tmpdir(),'granaderos-docs-audit-'));
 t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const put=(path,text)=>{mkdirSync(dirname(join(dir,path)),{recursive:true});writeFileSync(join(dir,path),text);};
 const copy=path=>{mkdirSync(dirname(join(dir,path)),{recursive:true});copyFileSync(join(root,path),join(dir,path));};
 // The audit treats evidence and test paths as references. Keep real audit
 // records/logs below, and create only existence placeholders for opaque files.
 for(const path of [data.audit,data.design,...data.evidence.map(e=>e.path),...data.requirements.flatMap(r=>r.testFiles??[])]){
  if(statSync(join(root,path)).isDirectory())mkdirSync(join(dir,path),{recursive:true});
  else put(path,'Fixture reference\n');
 }
 const canonical=['docs/README.md','docs/specification/game-design.md','docs/verification/formal-audit-2026-09-27.md'];
 for(const path of canonical){
  const text=readFileSync(join(root,path),'utf8');
  for(const match of text.matchAll(/\]\(([^)]+)\)/g)){
   const link=match[1];if(/^[a-z]+:|^#/.test(link))continue;
   const target=relative(root,resolve(root,dirname(path),decodeURIComponent(link.split('#')[0])));
   if(statSync(join(root,target)).isDirectory())mkdirSync(join(dir,target),{recursive:true});
   else put(target,'Fixture link target\n');
  }
 }
 for(const path of [...canonical,'tools/audit-docs.mjs','docs/archive/published-progress-through-pr28.md',`${auditPath}/parity-source.json`,`${auditPath}/checks.json`,...Object.entries(archived).filter(([,c])=>c.storedLogSha256).map(([name])=>`${auditPath}/${name}-tests.txt`)])copy(path);
 put('docs/verification/requirements.json',JSON.stringify(data));
 return {dir,put,run:(...args)=>spawnSync(process.execPath,[join(dir,'tools/audit-docs.mjs'),...args],{encoding:'utf8'}),view:()=>readFileSync(join(dir,'docs/verification/published-progress.md'),'utf8')};
}
function passed(result){assert.equal(result.status,0,result.stderr||result.stdout);}
function rejected(result,message){assert.equal(result.status,1,result.stderr||result.stdout);assert.match(result.stderr,message);}

test('legacy register retains original published checks and historical wording',t=>{
 const f=fixture(t,legacy());passed(f.run('--write'));
 const view=f.view();
 assert.ok(view.includes('The larger local sources and the editor prototype are separate from published main.'));
 assert.ok(view.includes('The advanced local suite has three independent failure points;'));
 for(const [name,c]of Object.entries(archived))assert.ok(view.includes(`| ${name} | ${c.passed} / ${c.total} | ${c.failed} | ${c.skipped} |`));
 assert.ok(!view.includes('local-candidate'));assert.ok(!view.includes('(2026-09-27 snapshot)'));
 passed(f.run());
});

test('current published and local checks have separate rows while old failures keep dated labels',t=>{
 const data=current(),f=fixture(t,data);passed(f.run('--write'));
 const view=f.view();
 assert.ok(view.includes(`The published baseline assessed here is \`${data.baseline}\``));
 assert.ok(view.includes(data.sourceRelationship));assert.ok(view.includes(data.snapshotSummary));
 assert.ok(view.includes('| published | 29 / 29 | 0 | 0 | PASS / PASS |'));
 assert.ok(view.includes('| local-candidate | 31 / 31 | 0 | 0 | PASS / PASS |'));
 for(const name of ['original','prototype','presence']){
  const c=archived[name];assert.ok(view.includes(`| ${name} (2026-09-27 snapshot) | ${c.passed} / ${c.total} | ${c.failed} | ${c.skipped} |`));
 }
 assert.ok(!view.includes('The advanced local suite has three independent failure points;'));
 assert.ok(view.includes(`The register retains ${data.requirements.length} entries:`));
 for(const row of data.requirements)assert.match(view,new RegExp(`\\| ${row.id}(?: \\[PR\\]| \\|)`));
 passed(f.run());
});

test('current local evidence requires an exact source commit',t=>{
 const data=current();data.latestLocalCheck.source='branch-name';
 rejected(fixture(t,data).run('--write'),/Latest local check needs an exact source commit/);
});

test('current local evidence must resolve to a registered record',t=>{
 const data=current();data.latestLocalCheck.evidenceId='UNKNOWN';
 rejected(fixture(t,data).run('--write'),/Latest local check needs registered evidence/);
});

test('current local counts must reconcile before publishing the generated view',t=>{
 const data=current();data.latestLocalCheck.total++;
 rejected(fixture(t,data).run('--write'),/local-candidate: inconsistent test counts/);
});

test('optional source and snapshot prose reject empty values',async t=>{
 for(const key of ['sourceRelationship','snapshotSummary'])await t.test(key,t=>{
  const data=current();data[key]='  ';
  rejected(fixture(t,data).run('--write'),new RegExp(`Invalid ${key}`));
 });
});

test('dated display labels still verify the original retained log paths and hashes',t=>{
 const f=fixture(t,current());passed(f.run('--write'));
 const name=Object.keys(archived).find(name=>name!=='published'&&archived[name].storedLogSha256);
 assert.ok(name);f.put(`${auditPath}/${name}-tests.txt`,'Altered historical log\n');
 rejected(f.run('--write'),new RegExp(`${name}: altered retained log`));
});

test('audit rejects a stale generated view and accepts regeneration without changing the register',t=>{
 const data=current(),f=fixture(t,data);passed(f.run('--write'));
 const exact=f.view(),json=readFileSync(join(f.dir,'docs/verification/requirements.json'),'utf8');
 f.put('docs/verification/published-progress.md',exact+'stale\n');
 rejected(f.run(),/published-progress\.md is stale/);
 passed(f.run('--write'));assert.equal(f.view(),exact);passed(f.run());
 assert.equal(readFileSync(join(f.dir,'docs/verification/requirements.json'),'utf8'),json);
});
