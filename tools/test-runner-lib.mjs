import assert from 'node:assert/strict';
import {availableParallelism} from 'node:os';
import {readdir,mkdir} from 'node:fs/promises';
import {readFileSync,writeFileSync,renameSync} from 'node:fs';
import {resolve,relative,dirname} from 'node:path';
import {run} from 'node:test';
import {spec} from 'node:test/reporters';
import {finished} from 'node:stream/promises';

const firstRunPriority=[
 'tests/fresh-ending-route.test.mjs',
 'tests/fresh-campaign-recovery.test.mjs',
 'tests/fresh-northern-route.test.mjs',
 'tests/fresh-cuyo-route.test.mjs',
 'tests/fresh-coastal-route.test.mjs',
 'tests/prisoner-rescue-route.test.mjs',
 'tests/army-funding-route.test.mjs',
 'tests/fresh-historical-loss.test.mjs',
 'tests/illustrated-sprite-repack.test.mjs',
 'tests/artillery-supply.test.mjs',
 'tests/artillery-transport.test.mjs',
 'tests/authored-artillery-transport.test.mjs',
 'tests/artillery-crew-loading.test.mjs',
];

export function assertFullTestSelection(execArgv=process.execArgv,nodeOptions=process.env.NODE_OPTIONS??''){
 const filters=new Set(['--test-name-pattern','--test-skip-pattern','--test-only']);
 const inherited=execArgv.map(arg=>arg.split('=')[0].replaceAll('_','-')).filter(arg=>filters.has(arg));
 for(const match of nodeOptions.replaceAll('_','-').matchAll(/(?:^|[\s"'])--(test-name-pattern|test-skip-pattern|test-only)(?=$|[\s="'])/g)){
  inherited.push(`--${match[1]}`);
 }
 assert.equal(inherited.length,0,`Full test runs reject inherited test-selection flags (${[...new Set(inherited)].join(', ')}). Remove these flags from node arguments and NODE_OPTIONS.`);
}

export function normalizeTestFile(file){return file.replaceAll('\\','/');}

export function runnerOptions(args,env=process.env,cpus=availableParallelism()){
 let explicit;
 for(let index=0;index<args.length;index++){
  const arg=args[index];
  if(arg==='--concurrency'&&explicit===undefined)explicit=args[++index];
  else if(arg.startsWith('--concurrency=')&&explicit===undefined)explicit=arg.slice('--concurrency='.length);
  else throw Error('Usage: --concurrency <1-64> (optional)');
  if(explicit===undefined)throw Error('Usage: --concurrency <1-64> (optional)');
 }
 const requested=explicit??env.GRANADEROS_TEST_CONCURRENCY;
 if(requested!==undefined&&(!/^[1-9]\d*$/.test(requested)||Number(requested)>64)){
  throw Error('Usage: GRANADEROS_TEST_CONCURRENCY or --concurrency must be an integer from 1 to 64.');
 }
 return {concurrency:requested===undefined?Math.min(8,cpus):Number(requested),cpus};
}

export async function discoverTests(root){
 const matching=(await readdir(resolve(root,'tests'),{withFileTypes:true}))
  .filter(entry=>!entry.name.startsWith('.')&&entry.name.endsWith('.test.mjs'));
 assert.ok(matching.every(entry=>entry.isFile()),'Matching test targets must be regular files; no target may be silently omitted.');
 const files=matching.map(entry=>`tests/${entry.name}`).sort();
 assert.ok(files.length>0,'No test files were found.');
 return files;
}

export function scheduleTests(files,previous=[]){
 assert.equal(new Set(files).size,files.length,'A test file is repeated.');
 const durations=new Map((Array.isArray(previous)?previous:[]).filter(entry=>entry&&typeof entry.file==='string'&&Number.isFinite(entry.duration_ms)&&entry.duration_ms>=0)
  .map(entry=>[entry.file,entry.duration_ms]));
 const score=file=>durations.get(file)??(firstRunPriority.includes(file)?1e9-firstRunPriority.indexOf(file):0);
 return [...files].sort((left,right)=>score(right)-score(left)||left.localeCompare(right));
}

function previousDurations(reportPath){
 try{
  const previous=JSON.parse(readFileSync(reportPath,'utf8'));
  return Array.isArray(previous?.files)?previous.files:[];
 }
 catch(error){
  if(error.code!=='ENOENT')console.warn(`Previous test timing report could not be read: ${error.message}`);
  return [];
 }
}

export async function runTests({root,files,concurrency,cpus,reportName='full',selection}){
 assertFullTestSelection();
 const reportPath=resolve(root,'.cache/test-times',`${reportName}.json`);
 const previous=previousDurations(reportPath);
 const fallback=reportName==='full'||previous.length?previous:previousDurations(resolve(root,'.cache/test-times/full.json'));
 const scheduled=scheduleTests(files,fallback);
 const expected=new Set(scheduled),records=new Map();
 const report={...selection,node:process.version,concurrency,cpus,expectedFiles:scheduled.length,scheduledFiles:scheduled,complete:false,files:[]};
 await mkdir(dirname(reportPath),{recursive:true});
 function save(){
  report.files=[...records.values()].sort((left,right)=>right.duration_ms-left.duration_ms||left.file.localeCompare(right.file));
  const temporary=`${reportPath}.${process.pid}.tmp`;
  writeFileSync(temporary,JSON.stringify(report,null,2)+'\n');
  renameSync(temporary,reportPath);
 }
 save();
 console.log(`Running all ${scheduled.length} selected test files with ${concurrency} worker processes (${cpus} available CPUs). No test-name filters.`);
 console.log(`Per-file timing report: ${reportPath}`);
 // Nested fixture runners otherwise inherit a context that suppresses execution.
 delete process.env.NODE_TEST_CONTEXT;
 // Node 22.13 does not support run({cwd}); use the same root as the CLI runner.
 const previousCwd=process.cwd();
 process.chdir(root);
 try{
  const stream=run({files:scheduled.map(file=>resolve(root,file)),concurrency,isolation:'process',setup(events){
   events.on('test:summary',data=>{
    if(data.file){
     const file=normalizeTestFile(relative(root,data.file));
     assert.ok(expected.has(file),`Unexpected test file in summary: ${file}`);
     records.set(file,{...records.get(file),file,duration_ms:records.get(file)?.duration_ms??data.duration_ms,counts:data.counts,success:data.success});
    }else{
     report.summary={counts:data.counts,duration_ms:data.duration_ms,success:data.success};
    }
    save();
   });
   events.on('test:complete',data=>{
    if(data.file&&data.name===data.file&&data.nesting===0){
     const file=normalizeTestFile(relative(root,data.file));
     assert.ok(expected.has(file),`Unexpected completed test file: ${file}`);
     records.set(file,{...records.get(file),file,duration_ms:data.details.duration_ms,success:data.details.passed});
     save();
     console.log(`FILE ${data.details.passed?'PASS':'FAIL'} ${file} ${(data.details.duration_ms/1000).toFixed(2)}s`);
    }
   });
  }});
  const reporter=stream.compose(spec);
  reporter.pipe(process.stdout,{end:false});
  await finished(reporter);
  assert.equal(records.size,expected.size,'The test runner did not finish every selected file.');
  report.complete=true;
  save();
  console.log('Slowest test files:');
  for(const entry of report.files.slice(0,10))console.log(`  ${(entry.duration_ms/1000).toFixed(2)}s ${entry.file}`);
  console.log(`Completed ${records.size}/${expected.size} files. Timing report: ${reportPath}`);
  return report.summary?.success&&report.files.every(entry=>entry.success)?0:1;
 }finally{
  process.chdir(previousCwd);
 }
}
