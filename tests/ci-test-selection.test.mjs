import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {changedGitPaths,classifyChangedPaths,selectionOptions,testDependencyScopes} from '../tools/ci-test-selection.mjs';

test('campaign content and core mechanic changes select only their relevant test scope',()=>{
 for(const path of ['campaigns/granaderos/content.json','campaigns/custom/assets/portrait.webp','campaigns/custom/assets/dialogue.txt','web/public/campaigns/custom.json','.cache/core-campaign-2026-10-12/pending-input.gz']){
  const result=classifyChangedPaths([path]);assert.equal(result.campaign,true,path);assert.equal(result.core,false,path);
 }
 for(const path of ['game/tactical.js','game/campaign.js','web/app/Battlefield.tsx','assets/characters-3d/manifest.json']){
  const result=classifyChangedPaths([path]);assert.equal(result.core,true,path);assert.equal(result.campaign,false,path);
 }
});
test('documentation skips simulation jobs; shared tooling and unknown changes select both',()=>{
 assert.deepEqual(classifyChangedPaths(['README.md','docs/evidence/report.json','requirements.json']).matched.map(item=>[item.core,item.campaign]),[[false,false],[false,false],[false,false]]);
 for(const path of ['package.json','web/package-lock.json','tools/test-scopes.mjs','.github/workflows/test-core.yml','unmapped-file.bin','tests/deleted-campaign.test.mjs']){
  const result=classifyChangedPaths([path]);assert.equal(result.core,true,path);assert.equal(result.campaign,true,path);
 }
 assert.equal(classifyChangedPaths([]).core,false);assert.equal(classifyChangedPaths([]).campaign,false);
});
test('test ownership includes transitive helpers and shared/deleted fixture references',async t=>{
 const root=await mkdtemp(join(tmpdir(),'granaderos-ci-scope-'));t.after(()=>rm(root,{recursive:true,force:true}));await mkdir(join(root,'tests'));
 await writeFile(join(root,'tests/core.test.mjs'),"import './core-helper.mjs';");
 await writeFile(join(root,'tests/campaign.test.mjs'),"import './campaign-helper.mjs';");
 await writeFile(join(root,'tests/core-helper.mjs'),"import './shared-helper.mjs';");
 await writeFile(join(root,'tests/campaign-helper.mjs'),"import './shared-helper.mjs'; new URL('../.cache/input.bin',import.meta.url); import './deleted-helper.mjs';");
 await writeFile(join(root,'tests/shared-helper.mjs'),"import './core-helper.mjs';");
 const dependencies=testDependencyScopes(root,['tests/core.test.mjs','tests/campaign.test.mjs'],[{file:'tests/campaign.test.mjs',reason:'Synthetic campaign scope.'}]);
 for(const path of ['tests/campaign.test.mjs','tests/campaign-helper.mjs','tests/deleted-helper.mjs','.cache/input.bin']){
  const result=classifyChangedPaths([path],{dependencies});assert.equal(result.campaign,true,path);assert.equal(result.core,false,path);
 }
 const shared=classifyChangedPaths(['tests/shared-helper.mjs'],{dependencies});assert.equal(shared.core,true);assert.equal(shared.campaign,true);
 const core=classifyChangedPaths(['tests/core.test.mjs'],{dependencies});assert.equal(core.core,true);assert.equal(core.campaign,false);
});

function git(root,args){const result=spawnSync('git',args,{cwd:root,encoding:'utf8'});assert.equal(result.status,0,result.stderr);return result.stdout.trim();}
test('complete Git diffs preserve renamed/deleted paths, newline names and PR merge-base semantics',async t=>{
 const root=await mkdtemp(join(tmpdir(),'granaderos-ci-diff-'));t.after(()=>rm(root,{recursive:true,force:true}));
 git(root,['init','-q']);git(root,['config','user.name','CI test']);git(root,['config','user.email','ci-test@example.invalid']);
 await mkdir(join(root,'campaigns'));await mkdir(join(root,'game'));
 await writeFile(join(root,'campaigns/old.json'),'old');await writeFile(join(root,'game/remove.js'),'remove');git(root,['add','.']);git(root,['commit','-qm','base']);const base=git(root,['rev-parse','HEAD']);
 git(root,['switch','-qc','candidate']);git(root,['mv','campaigns/old.json','game/renamed.js']);await rm(join(root,'game/remove.js'));await writeFile(join(root,'campaigns/new\nname.json'),'new');git(root,['add','.']);git(root,['commit','-qm','candidate']);const head=git(root,['rev-parse','HEAD']);
 const paths=changedGitPaths(root,{base,head});assert.deepEqual(paths.sort(),['campaigns/new\nname.json','campaigns/old.json','game/remove.js','game/renamed.js'].sort());const result=classifyChangedPaths(paths);assert.equal(result.core,true);assert.equal(result.campaign,true);
 git(root,['switch','--detach',base]);await writeFile(join(root,'base-only.json'),'base moved');git(root,['add','.']);git(root,['commit','-qm','advanced base']);const advanced=git(root,['rev-parse','HEAD']);
 assert.deepEqual(changedGitPaths(root,{base:advanced,head,comparison:'three-dot'}).sort(),paths.sort());assert.ok(changedGitPaths(root,{base:advanced,head}).includes('base-only.json'));
 assert.deepEqual(changedGitPaths(root,{base:'0'.repeat(40),head}).sort(),['campaigns/new\nname.json','game/renamed.js'].sort());
});
test('CLI options reject missing values, repeated options, invalid references and unsafe paths',()=>{
 assert.deepEqual(selectionOptions(['--base','a'.repeat(40),'--head','b'.repeat(40),'--comparison','three-dot','--github-output']),{comparison:'three-dot',githubOutput:true,base:'a'.repeat(40),head:'b'.repeat(40)});
 assert.throws(()=>selectionOptions(['--base']),/Missing value/);assert.throws(()=>selectionOptions(['--head','a','--head','b']),/Repeated/);assert.throws(()=>selectionOptions(['--unexpected']),/Unknown/);
 assert.throws(()=>changedGitPaths('.',{base:'--option',head:'a'.repeat(40)}),/complete base/);assert.throws(()=>classifyChangedPaths(['../escape']),/inside/);
});
test('Git selection includes changes beyond the hosted path-list limit',async t=>{
 const root=await mkdtemp(join(tmpdir(),'granaderos-ci-large-diff-'));t.after(()=>rm(root,{recursive:true,force:true}));git(root,['init','-q']);git(root,['config','user.name','CI test']);git(root,['config','user.email','ci-test@example.invalid']);git(root,['commit','--allow-empty','-qm','base']);const base=git(root,['rev-parse','HEAD']);
 await mkdir(join(root,'docs'));await mkdir(join(root,'game'));
 for(let start=0;start<3001;start+=100)await Promise.all(Array.from({length:Math.min(100,3001-start)},(_,index)=>writeFile(join(root,`docs/${String(start+index).padStart(4,'0')}.md`),'doc')));
 await writeFile(join(root,'game/tactical.js'),'core');git(root,['add','.']);git(root,['commit','-qm','large change']);const head=git(root,['rev-parse','HEAD']),paths=changedGitPaths(root,{base,head});assert.equal(paths.length,3002);assert.ok(paths.includes('game/tactical.js'));const result=classifyChangedPaths(paths);assert.equal(result.core,true);assert.equal(result.campaign,false);
});
test('CLI writes only explicit boolean GitHub outputs and reports Git failures',async t=>{
 const root=new URL('../',import.meta.url),head=git(root,['rev-parse','HEAD']),folder=await mkdtemp(join(tmpdir(),'granaderos-ci-output-'));t.after(()=>rm(folder,{recursive:true,force:true}));const output=join(folder,'outputs');
 const run=spawnSync(process.execPath,['tools/ci-test-selection.mjs','--base',head,'--head',head,'--github-output'],{cwd:root,encoding:'utf8',env:{...process.env,GITHUB_OUTPUT:output}});assert.equal(run.status,0,run.stderr);assert.equal(await readFile(output,'utf8'),'core=false\ncampaign=false\n');assert.equal(JSON.parse(run.stdout).changedPaths.length,0);
 const failure=spawnSync(process.execPath,['tools/ci-test-selection.mjs','--base','f'.repeat(40),'--head',head],{cwd:root,encoding:'utf8'});assert.equal(failure.status,2);assert.match(failure.stderr,/Git diff failed/);
});
