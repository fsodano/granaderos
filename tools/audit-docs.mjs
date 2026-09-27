import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,dirname,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFileSync(resolve(root,path),'utf8');
const data=JSON.parse(read('docs/verification/requirements.json'));
const errors=[];
const need=(condition,message)=>{if(!condition)errors.push(message);};
const statuses=['VERIFIED','PARTIAL','LOCAL_ONLY','MISSING','FAILED','UNVERIFIED','SUPERSEDED'];
const nonempty=value=>typeof value==='string'&&value.trim().length>0;
const file=(path,label)=>{
 if(!nonempty(path)){need(false,`${label}: missing path`);return;}
 const target=resolve(root,path),rel=relative(root,target);
 need(!rel.startsWith('..'+sep)&&!rel.startsWith(sep)&&existsSync(target),`${label}: missing or external path ${path}`);
};
need(data.schema===1,'Unsupported requirement schema');
need(/^\d{4}-\d{2}-\d{2}$/.test(data.updated),'Invalid update date');
need(/^[0-9a-f]{40}$/.test(data.baseline),'Baseline must identify an exact commit');
file(data.audit,'Audit');file(data.design,'Design');
const evidence=new Map();
for(const e of data.evidence??[]){
 need(!evidence.has(e.id),`Duplicate evidence ${e.id}`);evidence.set(e.id,e);
 file(e.path,e.id);need(nonempty(e.description),`${e.id}: missing evidence limits`);
 if(e.url)need(/^https:\/\/github\.com\/fsodano\/granaderos\//.test(e.url),`${e.id}: invalid evidence URL`);
}
const ids=new Set();
for(const r of data.requirements??[]){
 need(/^(?:[A-Z]+-\d+|JA2-[A-Z]\d+)$/.test(r.id),`Invalid requirement ID ${r.id}`);
 need(!ids.has(r.id),`Duplicate requirement ${r.id}`);ids.add(r.id);
 need(statuses.includes(r.status),`${r.id}: invalid status ${r.status}`);
 need(['P0','P1','P2'].includes(r.priority),`${r.id}: missing priority`);
 for(const key of ['group','requirement','published','local','acceptance'])need(nonempty(r[key]),`${r.id}: missing ${key}`);
 need(r.status==='VERIFIED'?r.remaining==='':nonempty(r.remaining),`${r.id}: verified scope has a gap, or open scope lacks one`);
 need(Array.isArray(r.evidence)&&r.evidence.length>0,`${r.id}: missing evidence`);
 for(const id of r.evidence??[])need(evidence.has(id),`${r.id}: unknown evidence ${id}`);
 for(const path of r.testFiles??[])file(path,r.id);
 if(r.pr)need(/^https:\/\/github\.com\/fsodano\/granaderos\/pull\/\d+$/.test(r.pr),`${r.id}: invalid PR`);
 if(r.status==='VERIFIED')need(r.testFiles?.length>0||r.id==='DATA-01',`${r.id}: verified scope needs specific tests`);
}
for(const r of data.requirements??[])for(const id of r.parents??[])need(ids.has(id),`${r.id}: unknown parent ${id}`);
const source=JSON.parse(read('docs/evidence/formal-audit-2026-09-27/parity-source.json'));
need(source.requirements.length===87,'The original parity register must retain 87 requirements');
for(const r of source.requirements)need(ids.has(r.id),`Dropped parity requirement ${r.id}`);
const history=read('docs/archive/published-progress-through-pr28.md').split('## Full requirements and acceptance evidence')[1]?.split('## Historical work log')[0]??'';
const original=[...history.matchAll(/^\| ([A-Z]+-\d+) \|/gm)].map(m=>m[1]);
need(original.length===50,'The original register must retain 50 broad requirements');
for(const id of original)need(ids.has(id),`Dropped original requirement ${id}`);
for(const q of data.queue??[]){need(nonempty(q.action),'Queue action missing');for(const id of q.ids??[])need(ids.has(id),`Unknown queued requirement ${id}`);}
const auditPath='docs/evidence/formal-audit-2026-09-27';
const checks=JSON.parse(read(`${auditPath}/checks.json`));
for(const [name,c]of Object.entries(checks)){
 need(c.total===c.passed+c.failed+c.skipped,`${name}: inconsistent test counts`);
 if(c.storedLogSha256){const digest=createHash('sha256').update(read(`${auditPath}/${name}-tests.txt`)).digest('hex');need(digest===c.storedLogSha256,`${name}: altered retained log`);}
}
// Validate local links in the canonical documents, not historical external sites.
for(const path of ['docs/README.md','docs/specification/game-design.md','docs/verification/formal-audit-2026-09-27.md']){
 for(const m of read(path).matchAll(/\]\(([^)]+)\)/g)){
  const link=m[1];if(/^[a-z]+:|^#/.test(link))continue;
  file(relative(root,resolve(root,dirname(path),decodeURIComponent(link.split('#')[0]))),path);
 }
}
if(errors.length){console.error(errors.join('\n'));process.exit(1);}
const cell=text=>String(text??'').replaceAll('|','&#124;').replaceAll('\n',' ').replace(/\[([^\]]+)\]\([^)]+\)/g,'$1');
const link=path=>relative(resolve(root,'docs/verification'),resolve(root,path)).split(sep).join('/');
const counts=Object.fromEntries(statuses.map(s=>[s,data.requirements.filter(r=>r.status===s).length]));
const out=[
 '# Granaderos implementation and verification ledger','',
 '<!-- Generated from requirements.json by npm run docs:progress. Edit the register, not this view. -->','',
 `Updated ${data.updated}. **The complete game and story editor are not accepted.**`,'',
 `Read [the design](${link(data.design)}) for the target and [the formal audit](${link(data.audit)}) for evidence and limits.`,
 `The published baseline assessed here is \`${data.baseline}\`. Later PRs must update this register.`,
 'The larger local sources and the editor prototype are separate from published main.','',
 '## Verified results and current failures','',
 '| Source | Passing / total | Failed | Skipped | Types / build |',
 '|---|---:|---:|---:|---|',
 ...Object.entries(checks).map(([name,c])=>`| ${name} | ${c.passed} / ${c.total} | ${c.failed} | ${c.skipped} | ${c.types} / ${c.build} |`),'',
 'The advanced local suite has three independent failure points; a failed child also fails its parent. Three later route milestones are skipped. The prototype fails at San Lorenzo. Published CI runs a smaller suite and cannot close those failures. The prepared presence feature is local only.','',
 '## Status and maintenance rules','',
 '- VERIFIED: the complete **bounded row** has specific accepted evidence. Parent requirements remain separate.',
 '- PARTIAL: a published subset exists; the row states the remaining work.',
 '- LOCAL_ONLY: relevant implementation exists locally but is not accepted in the published release.',
 '- MISSING: no accepted implementation of the stated capability was found.',
 '- FAILED: required acceptance currently fails, or the combined release is inconsistent.',
 '- UNVERIFIED: available evidence does not establish acceptance.',
 '- SUPERSEDED: an explicit design change replaced the old requirement.','',
 `The register retains ${data.requirements.length} entries: ${Object.entries(counts).map(([s,n])=>`${n} ${s}`).join(', ')}.`,
 'Rows overlap in scope. Neither these counts nor test totals are a completion percentage.','',
 'Edit [requirements.json](requirements.json), record exact source/checks and remaining gaps, then run `npm run docs:progress` and `npm run audit:docs`. Update the design for policy changes. A dated audit stays an evidence snapshot. Do not mark a local branch as published or close a broad row from one passing fixture.','',
 '## Scope changes that override the original specification','',
 '[Current design decisions](../specification/game-design.md#decisions-that-override-earlier-documents) preserve the pesos-only economy, all elite contract terms, hire-only candidates and the approved opening. Old material-production and horse-care requirements do not override those decisions.','',
 '## Delivery order','',
 ...data.queue.map(q=>`${q.order}. **${q.ids.join(', ')}** — ${q.action}`),'',
 'Finish one bounded feature, its controls and persistence, update evidence, pass relevant checks and exact-head CI, then merge. Preserve the unpublished sources and approved pesos/contract policies.',''
];
for(const group of new Set(data.requirements.map(r=>r.group))){
 out.push(`## ${group}`,'','| ID | Requirement | Status | Published scope | Remaining work / acceptance |','|---|---|---|---|---|');
 for(const r of data.requirements.filter(r=>r.group===group)){
  const proof=r.pr?` [PR](${r.pr})`:'';
  out.push(`| ${r.id}${proof} | ${cell(r.requirement)} | ${r.status} | ${cell(r.published)} | ${cell(r.remaining||r.acceptance)} |`);
 }
 out.push('');
}
out.push('## Evidence index','','| ID | Evidence | Scope and limits |','|---|---|---|');
for(const e of data.evidence)out.push(`| ${e.id} | [Record](${link(e.path)})${e.url?` · [CI](${e.url})`:''} | ${cell(e.description)} |`);
out.push('','Per-row acceptance, local assessment, source notes and test paths are retained in [the register](requirements.json). The full 87-row historical parity assessment is preserved in the audit; its old implementation claims are not fresh certification. Earlier milestones remain in [the historical log](../archive/published-progress-through-pr28.md).','');
const rendered=out.join('\n');
if(process.argv.includes('--write'))writeFileSync(resolve(root,'docs/verification/published-progress.md'),rendered);
else if(read('docs/verification/published-progress.md')!==rendered){console.error('docs/verification/published-progress.md is stale. Run npm run docs:progress.');process.exit(1);}
console.log(`Documentation audit passed: ${data.requirements.length} requirements, 50 original rows, 87 parity rows, ${evidence.size} evidence records; progress view matches.`);
