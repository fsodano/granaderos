import assert from 'node:assert/strict';
import extendedTests from './test-suite-config.mjs';

const names=['full','quick','extended'];

export function suiteOptions(args){
 let suite='full',specified=false,list=false;
 const runnerArgs=[];
 for(let index=0;index<args.length;index++){
  const arg=args[index];
  if(arg==='--suite'||arg.startsWith('--suite=')){
   assert.ok(!specified,'Usage: specify --suite only once.');
   specified=true;
   suite=arg==='--suite'?args[++index]:arg.slice('--suite='.length);
   assert.ok(names.includes(suite),'Usage: --suite must be full, quick or extended.');
  }else if(arg==='--list'){
   assert.ok(!list,'Usage: specify --list only once.');
   list=true;
  }else runnerArgs.push(arg);
 }
 return {suite,list,runnerArgs};
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

export function suiteManifest(all,suite,configuration=extendedTests){
 assert.ok(names.includes(suite),`Unknown test suite: ${suite}`);
 const {suites,reasons}=partitionTestSuites(all,configuration),selectedFiles=suites[suite];
 assert.ok(selectedFiles.length,`No test files were selected for the ${suite} suite.`);
 const selected=new Set(selectedFiles);
 const excludedFiles=all.filter(file=>!selected.has(file)).map(file=>({file,reason:reasons.get(file)??'Routine regression file included in the quick suite.'}));
 return {suite,totalFiles:all.length,selectedFiles,excludedFiles,partitionCounts:{full:suites.full.length,quick:suites.quick.length,extended:suites.extended.length}};
}
