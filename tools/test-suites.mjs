import assert from 'node:assert/strict';
import extendedTests from './test-suite-config.mjs';
import campaignTests from './test-campaign-config.mjs';
import {partitionTestScopes} from './test-scopes.mjs';

const names=['full','quick','extended','core','campaign'];

export function suiteOptions(args){
 let suite='full',specified=false,list=false,duration;
 const runnerArgs=[];
 for(let index=0;index<args.length;index++){
  const arg=args[index];
  if(arg==='--suite'||arg.startsWith('--suite=')){
   assert.ok(!specified,'Usage: specify --suite only once.');
   specified=true;
   suite=arg==='--suite'?args[++index]:arg.slice('--suite='.length);
   assert.ok(names.includes(suite),'Usage: --suite must be full, quick, extended, core or campaign.');
  }else if(arg==='--duration'||arg.startsWith('--duration=')){
   assert.equal(duration,undefined,'Usage: specify --duration only once.');
   duration=arg==='--duration'?args[++index]:arg.slice('--duration='.length);
   assert.ok(['full','quick','extended'].includes(duration),'Usage: --duration must be full, quick or extended.');
  }else if(arg==='--list'){
   assert.ok(!list,'Usage: specify --list only once.');
   list=true;
  }else runnerArgs.push(arg);
 }
 assert.ok(duration===undefined||['core','campaign'].includes(suite),'Usage: --duration applies only to core or campaign.');
 return {suite,list,runnerArgs,...(duration===undefined?{}:{duration})};
}

export function partitionTestSuites(all,configuration=extendedTests){
 assert.ok(all.length>0,'No test files were found.');
 assert.equal(new Set(all).size,all.length,'A test file is repeated.');
 assert.ok(Array.isArray(configuration),'The extended test list must be an array.');
 const discovered=new Set(all),extended=new Map();
 for(const entry of configuration){
  assert.ok(entry&&typeof entry.file==='string'&&typeof entry.reason==='string'&&entry.reason.trim(),'Each extended test needs a file and a reason.');
  assert.ok(discovered.has(entry.file),`An extended test target is missing: ${entry.file}. Update the reviewed test-suite configuration.`);
  assert.ok(!extended.has(entry.file),`An extended test target is repeated: ${entry.file}`);
  extended.set(entry.file,entry.reason);
 }
 const suites={full:[...all],quick:all.filter(file=>!extended.has(file)),extended:all.filter(file=>extended.has(file))};
 const union=[...suites.quick,...suites.extended];
 assert.equal(new Set(union).size,all.length,'Quick and extended test files overlap.');
 assert.deepEqual([...union].sort(),[...all].sort(),'Quick and extended must cover every discovered file exactly once.');
 return {suites,reasons:extended};
}

export function suiteManifest(all,suite,configuration=extendedTests,campaignConfiguration=campaignTests,duration='full'){
 assert.ok(names.includes(suite),`Unknown test suite: ${suite}`);
 assert.ok(['full','quick','extended'].includes(duration),`Unknown duration profile: ${duration}`);
 const {suites,reasons}=partitionTestSuites(all,configuration),scopePartition=partitionTestScopes(all,campaignConfiguration);
 const semantic=['core','campaign'].includes(suite),durationFiles=new Set(suites[duration]);
 Object.assign(suites,scopePartition.scopes);
 const selectedFiles=semantic?suites[suite].filter(file=>durationFiles.has(file)):suites[suite];
 assert.ok(selectedFiles.length,`No test files were selected for the ${suite} suite.`);
 const selected=new Set(selectedFiles);
 const excludedFiles=all.filter(file=>!selected.has(file)).map(file=>({file,reason:semantic&&suites[suite].includes(file)?reasons.get(file)??'Routine regression file included in the quick duration profile.':semantic?scopePartition.reasons.get(file)??'Reusable engine, renderer or tooling regression in the core suite.':reasons.get(file)??'Routine regression file included in the quick suite.'}));
 return {suite,...(semantic?{durationProfile:duration}:{}),totalFiles:all.length,selectedFiles,excludedFiles,partitionCounts:{full:suites.full.length,quick:suites.quick.length,extended:suites.extended.length,core:suites.core.length,campaign:suites.campaign.length}};
}
