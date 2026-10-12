import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {appendFileSync,readFileSync} from 'node:fs';
import {dirname,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import campaignTests from './test-campaign-config.mjs';
import {discoverTests} from './test-runner-lib.mjs';
import {partitionTestScopes} from './test-scopes.mjs';

const sharedPackages=new Set(['package.json','package-lock.json','web/package.json','web/package-lock.json']);
const documentation=new Set(['requirements.json','LICENSE','LICENSE.md','NOTICE']);
const relativeReferences=/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\bnew\s+URL\s*\(\s*|\b(?:readFileSync|readFile)\s*\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g;

function repositoryPath(path){
 assert.equal(typeof path,'string','A changed path must be a string.');
 const clean=path.replace(/^\.\//,'');
 assert.ok(clean&&!clean.startsWith('/')&&!clean.split('/').includes('..'),'A changed path must stay inside the repository.');
 return clean;
}
function combine(map,path,scope){
 const current=map.get(path)??{core:false,campaign:false};
 map.set(path,{core:current.core||scope.core,campaign:current.campaign||scope.campaign});
}

// Trace helper and fixture ownership from the reviewed test scopes. Traversal
// stays in tests/. Runtime modules keep their explicit source scope below.
export function testDependencyScopes(root,all,configuration=campaignTests){
 const {scopes}=partitionTestScopes(all,configuration),dependencies=new Map();
 for(const name of ['core','campaign']){
  const scope={core:name==='core',campaign:name==='campaign'},visited=new Set();
  function visit(file){
   if(visited.has(file))return;visited.add(file);combine(dependencies,file,scope);
   if(!file.startsWith('tests/')||! /\.[cm]?[jt]sx?$/.test(file))return;
   let source;try{source=readFileSync(resolve(root,file),'utf8');}catch(error){if(error.code==='ENOENT')return;throw error;}
   for(const match of source.matchAll(relativeReferences)){
    const dependency=relative(root,resolve(root,dirname(file),match[1])).replaceAll('\\','/');
    if(dependency.startsWith('tests/')||dependency.startsWith('.cache/'))visit(dependency);
   }
  }
  for(const file of scopes[name])visit(file);
 }
 return dependencies;
}

export function classifyChangedPaths(paths,{dependencies=new Map(),campaignFiles=new Set(campaignTests.map(entry=>entry.file))}={}){
 const changedPaths=[...new Set(paths.map(repositoryPath))].sort();
 const matched=changedPaths.map(path=>{
  let core=false,campaign=false,reason;
  if(path.startsWith('docs/')||/\.(?:md|rst)$/.test(path)||documentation.has(path))reason='Documentation only.';
  else if(sharedPackages.has(path)||path.startsWith('tools/test-')||path==='tools/ci-test-selection.mjs'||/^\.github\/workflows\/(?:test|ci-test)/.test(path)){
   core=true;campaign=true;reason='Shared test tooling or dependencies.';
  }else if(path.startsWith('campaigns/')||path.startsWith('web/public/campaigns/')){
   campaign=true;reason='Campaign content.';
  }else if(path.startsWith('game/')||path.startsWith('web/')||path.startsWith('assets/')||path.startsWith('tools/')||/^\.github\/workflows\/(?:web|build-windows)\.yml$/.test(path)){
   core=true;reason='Reusable engine, renderer, editor or build source.';
  }else if(dependencies.has(path)){
   ({core,campaign}=dependencies.get(path));reason='Reviewed test or its helper/fixture dependency.';
  }else if(path.startsWith('.cache/core-campaign-')||campaignFiles.has(path)){
   campaign=true;reason='Earned campaign input or declared campaign test.';
  }else{
   core=true;campaign=true;reason='Unmapped change; validate both scopes.';
  }
  return {path,core,campaign,reason};
 });
 return {core:matched.some(item=>item.core),campaign:matched.some(item=>item.campaign),changedPaths,matched};
}

function git(root,args,options={}){
 const result=spawnSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:64*1024*1024,...options});
 if(result.error)throw result.error;
 assert.equal(result.status,0,`Git diff failed: ${result.stderr?.trim()}`);
 return result.stdout;
}
export function changedGitPaths(root,{base,head,comparison='two-dot'}){
 assert.ok(/^(?:[a-f\d]{40}|[a-f\d]{64})$/i.test(base??''),'A complete base commit SHA is required.');
 assert.ok(/^(?:[a-f\d]{40}|[a-f\d]{64})$/i.test(head??''),'A complete head commit SHA is required.');
 assert.ok(['two-dot','three-dot'].includes(comparison),'Comparison must be two-dot or three-dot.');
 if(/^0+$/.test(base)){
  assert.equal(comparison,'two-dot','A new branch uses a two-dot comparison.');
  base=git(root,['hash-object','-t','tree','--stdin'],{input:''}).trim();
 }
 // Disable rename collapsing: old and new names each retain their test scope.
 return git(root,['diff','--no-renames','--name-only','-z',`${base}${comparison==='three-dot'?'...':'..'}${head}`,'--']).split('\0').filter(Boolean);
}
export function selectionOptions(args){
 const options={comparison:'two-dot',githubOutput:false},seen=new Set();
 for(let index=0;index<args.length;index++){
  const arg=args[index];assert.ok(!seen.has(arg),`Repeated option: ${arg}`);seen.add(arg);
  if(arg==='--github-output')options.githubOutput=true;
  else{
   assert.ok(['--base','--head','--comparison'].includes(arg),`Unknown option: ${arg}`);
   const value=args[++index];assert.ok(value&&!value.startsWith('--'),`Missing value for ${arg}`);
   options[arg.slice(2)]=value;
  }
 }
 return options;
}
export async function selectChangedTests(root,options){
 const paths=changedGitPaths(root,options),all=await discoverTests(root);
 // New core tests are discovered and mapped above. An absent test removed
 // from the current manifest stays unmapped and therefore selects both.
 return classifyChangedPaths(paths,{dependencies:testDependencyScopes(root,all)});
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const root=fileURLToPath(new URL('../',import.meta.url)),options=selectionOptions(process.argv.slice(2)),selection=await selectChangedTests(root,options);
  if(options.githubOutput){assert.ok(process.env.GITHUB_OUTPUT,'GITHUB_OUTPUT is required for --github-output.');appendFileSync(process.env.GITHUB_OUTPUT,`core=${selection.core}\ncampaign=${selection.campaign}\n`);}
  console.log(JSON.stringify(selection,null,2));
 }catch(error){console.error(error.message);process.exitCode=2;}
}
