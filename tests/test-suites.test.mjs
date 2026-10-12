import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {partitionTestSuites,suiteManifest,suiteOptions} from '../tools/test-suites.mjs';

function fixture(t,files,extended,campaign=[]){
 const root=mkdtempSync(path.join(tmpdir(),'granaderos-suite-test-'));
 t.after(()=>rmSync(root,{recursive:true,force:true}));
 mkdirSync(path.join(root,'tools'));
 mkdirSync(path.join(root,'tests'));
 for(const name of ['test-runner.mjs','test-runner-lib.mjs','test-suites.mjs','test-scopes.mjs'])copyFileSync(fileURLToPath(new URL(`../tools/${name}`,import.meta.url)),path.join(root,'tools',name));
 writeFileSync(path.join(root,'tools/test-suite-config.mjs'),`export default ${JSON.stringify(extended)};\n`);
 writeFileSync(path.join(root,'tools/test-campaign-config.mjs'),`export default ${JSON.stringify(campaign)};export const reviewedCoreCampaignFixtures=[];\n`);
 for(const [name,contents]of Object.entries(files))writeFileSync(path.join(root,'tests',name),contents);
 return {
  root,
  run:(args=[],nodeArgs=[])=>spawnSync(process.execPath,[...nodeArgs,path.join(root,'tools/test-runner.mjs'),...args],{encoding:'utf8',timeout:15000,env:{...process.env,GRANADEROS_TEST_CONCURRENCY:'2'}}),
  report:suite=>JSON.parse(readFileSync(path.join(root,`.cache/test-times/${suite}.json`),'utf8')),
 };
}

test('quick and extended form a complete disjoint partition and new files enter quick',()=>{
 const all=['tests/new.test.mjs','tests/routine.test.mjs','tests/long.test.mjs'];
 const extended=[{file:'tests/long.test.mjs',reason:'Complete campaign acceptance.'}];
 const {suites}=partitionTestSuites(all,extended);
 assert.deepEqual(suites.full,all);
 assert.deepEqual(suites.quick,['tests/new.test.mjs','tests/routine.test.mjs']);
 assert.deepEqual(suites.extended,['tests/long.test.mjs']);
 assert.deepEqual([...suites.quick,...suites.extended].sort(),[...all].sort());
 assert.deepEqual(suiteManifest(all,'quick',extended,[]).excludedFiles,extended);
 assert.throws(()=>partitionTestSuites(all,[{file:'tests/missing.test.mjs',reason:'Missing target.'}]),/target is missing/);
 assert.throws(()=>partitionTestSuites(all,[...extended,...extended]),/target is repeated/);
 assert.throws(()=>partitionTestSuites([...all,all[0]],extended),/file is repeated/);
 assert.throws(()=>partitionTestSuites(all,[{file:'tests/long.test.mjs',reason:''}]),/file and a reason/);
 assert.throws(()=>suiteManifest(all,'unknown',extended),/Unknown test suite/);
});

test('profile arguments default to exhaustive full and leave concurrency validation in the shared runner',()=>{
 assert.deepEqual(suiteOptions([]),{suite:'full',list:false,runnerArgs:[]});
 assert.deepEqual(suiteOptions(['--suite','quick','--concurrency','4','--list']),{suite:'quick',list:true,runnerArgs:['--concurrency','4']});
 assert.equal(suiteOptions(['--suite=extended']).suite,'extended');
 assert.deepEqual(suiteOptions(['--duration=quick','--suite=campaign']),{suite:'campaign',list:false,runnerArgs:[],duration:'quick'});
 for(const args of [['--duration'],['--duration=unknown'],['--duration=quick'],['--suite=quick','--duration=full'],['--suite=core','--duration=quick','--duration=full']])assert.throws(()=>suiteOptions(args),/Usage:/);
 for(const args of [['--suite'],['--suite','unknown'],['--suite','quick','--suite','full'],['--list','--list']])assert.throws(()=>suiteOptions(args),/Usage:/);
});

test('semantic suites intersect duration without overlap or losing full and extended files',()=>{
 const all=['tests/core-quick.test.mjs','tests/core-long.test.mjs','tests/campaign-quick.test.mjs','tests/campaign-long.test.mjs'];
 const extended=[{file:all[1],reason:'Full asset repack.'},{file:all[3],reason:'Complete campaign.'}];
 const campaign=all.slice(2).map(file=>({file,reason:'Actual scenario acceptance.'}));
 for(const duration of ['full','quick','extended']){
  const core=suiteManifest(all,'core',extended,campaign,duration),story=suiteManifest(all,'campaign',extended,campaign,duration);
  assert.equal(core.durationProfile,duration);assert.equal(story.durationProfile,duration);
  assert.deepEqual(core.partitionCounts,{full:4,quick:2,extended:2,core:2,campaign:2});
  assert.deepEqual([...core.selectedFiles,...story.selectedFiles].sort(),suiteManifest(all,duration,extended,campaign).selectedFiles.sort());
  assert.equal(new Set([...core.selectedFiles,...story.selectedFiles]).size,core.selectedFiles.length+story.selectedFiles.length);
  for(const selection of [core,story])assert.equal(selection.selectedFiles.length+selection.excludedFiles.length,all.length);
 }
 assert.deepEqual(suiteManifest(all,'campaign',extended,campaign).selectedFiles,all.slice(2));
 assert.equal(suiteManifest(all,'campaign',extended,campaign,'quick').excludedFiles.find(row=>row.file===all[3]).reason,'Complete campaign.');
 assert.throws(()=>suiteManifest(all,'campaign',extended,campaign,'unknown'),/Unknown duration/);
 assert.throws(()=>suiteManifest(all,'campaign',extended,[], 'quick'),/No test files were selected/);
});

test('semantic quick runs all selected assertions and propagates failures while extended requires explicit selection',t=>{
 const passing="import test from 'node:test';test('first',()=>{});test('second',()=>{});\n";
 const f=fixture(t,{
  'core-quick.test.mjs':passing,
  'core-long.test.mjs':"import test from 'node:test';test('explicit long core',()=>{});\n",
  'campaign-quick.test.mjs':"import test from 'node:test';import assert from 'node:assert/strict';test('campaign first',()=>{});test('campaign failure',()=>assert.fail('selected campaign assertion'));\n",
  'campaign-long.test.mjs':"import test from 'node:test';test('explicit campaign continuation',()=>{});\n",
 },[{file:'tests/core-long.test.mjs',reason:'Asset repack.'},{file:'tests/campaign-long.test.mjs',reason:'Complete route.'}],['tests/campaign-quick.test.mjs','tests/campaign-long.test.mjs'].map(file=>({file,reason:'Scenario.'})));
 let result=f.run(['--suite=core','--duration=quick']);assert.equal(result.status,0,result.stdout+result.stderr);
 let report=f.report('core-quick');assert.equal(report.summary.counts.tests,2);assert.equal(report.summary.counts.skipped,0);assert.deepEqual(report.selectedFiles,['tests/core-quick.test.mjs']);
 result=f.run(['--suite=campaign','--duration=quick']);assert.equal(result.status,1,result.stdout+result.stderr);assert.match(result.stdout,/selected campaign assertion/);
 report=f.report('campaign-quick');assert.equal(report.complete,true);assert.equal(report.summary.counts.tests,2);assert.equal(report.summary.counts.failed,1);assert.equal(report.durationProfile,'quick');assert.deepEqual(report.selectedFiles,['tests/campaign-quick.test.mjs']);
 result=f.run(['--suite=campaign','--duration=extended']);assert.equal(result.status,0,result.stdout+result.stderr);assert.deepEqual(f.report('campaign-extended').selectedFiles,['tests/campaign-long.test.mjs']);
 result=f.run(['--suite=campaign']);assert.equal(result.status,1,result.stdout+result.stderr);assert.equal(f.report('campaign').summary.counts.tests,3);
 for(const suite of ['core','campaign']){const filtered=f.run([`--suite=${suite}`,'--duration=quick'],['--test-name-pattern=first']);assert.notEqual(filtered.status,0);assert.match(filtered.stderr,/reject inherited test-selection/);}
});

test('profiles execute every selected case, disclose omissions and propagate extended and full failures',t=>{
 const f=fixture(t,{
  'routine.test.mjs':"import test from 'node:test';test('routine first',()=>{});test('routine second',()=>{});\n",
  'long.test.mjs':"import test from 'node:test';import assert from 'node:assert/strict';test('extended failure',()=>assert.fail('extended assertion must run'));\n",
 },[{file:'tests/long.test.mjs',reason:'Complete campaign acceptance.'}]);
 let result=f.run(['--suite','quick']);
 assert.equal(result.status,0,result.stdout+result.stderr);
 assert.match(result.stdout,/QUICK suite: 1\/2 files selected; 1 excluded/);
 assert.match(result.stdout,/EXCLUDED tests\/long.test.mjs: Complete campaign acceptance/);
 let report=f.report('quick');
 assert.equal(report.complete,true);
 assert.equal(report.summary.counts.tests,2);
 assert.deepEqual(report.selectedFiles,['tests/routine.test.mjs']);
 assert.deepEqual(report.excludedFiles,[{file:'tests/long.test.mjs',reason:'Complete campaign acceptance.'}]);
 result=f.run(['--suite','extended']);
 assert.equal(result.status,1,result.stdout+result.stderr);
 report=f.report('extended');
 assert.equal(report.files.length,1);
 assert.equal(report.summary.counts.tests,1);
 assert.equal(report.summary.success,false);
 assert.deepEqual(report.selectedFiles,['tests/long.test.mjs']);
 assert.match(result.stdout,/extended assertion must run/);
 result=f.run();
 assert.equal(result.status,1,result.stdout+result.stderr);
 report=f.report('full');
 assert.equal(report.files.length,2);
 assert.equal(report.summary.counts.tests,3);
 assert.deepEqual(report.excludedFiles,[]);
});

test('list mode proves full partition without execution and stale configuration fails closed',t=>{
 const f=fixture(t,{
  'routine.test.mjs':"throw Error('list mode must not execute files');\n",
  'long.test.mjs':"throw Error('list mode must not execute files');\n",
 },[{file:'tests/long.test.mjs',reason:'Complete campaign acceptance.'}]);
 for(const suite of ['full','quick','extended']){
  const result=f.run(['--suite',suite,'--list']);
  assert.equal(result.status,0,result.stdout+result.stderr);
  const manifest=JSON.parse(result.stdout);
  assert.deepEqual(manifest.partitionCounts,{full:2,quick:1,extended:1,core:2,campaign:0});
  assert.equal(manifest.selectedFiles.length+manifest.excludedFiles.length,2);
 }
 rmSync(path.join(f.root,'tests/long.test.mjs'));
 const missing=f.run(['--list']);
 assert.notEqual(missing.status,0);
 assert.match(missing.stderr,/extended test target is missing/);
});

test('quick and extended reject inherited assertion filters just as full does',t=>{
 const code="import test from 'node:test';import assert from 'node:assert/strict';test('passing',()=>{});test('failing',()=>assert.fail('no filtering'));\n";
 const f=fixture(t,{'routine.test.mjs':code,'long.test.mjs':code},[{file:'tests/long.test.mjs',reason:'Complete campaign acceptance.'}]);
 for(const suite of ['quick','extended'])for(const option of ['--test_name_pattern=passing','--test_skip_pattern=failing','--test_only']){
  const result=f.run(['--suite',suite],[option]);
  assert.notEqual(result.status,0,suite+': '+option);
  assert.match(result.stderr,/reject inherited test-selection flags/);
 }
});

test('a profile without cached timings starts measured slow files first using the full report',t=>{
 const marker=path.join(tmpdir(),`granaderos-suite-order-${process.pid}-${Date.now()}.txt`);
 t.after(()=>rmSync(marker,{force:true}));
 const code=name=>`import test from 'node:test';import {appendFileSync} from 'node:fs';test('ordered fixture',()=>appendFileSync(${JSON.stringify(marker)},${JSON.stringify(name+'\n')}));\n`;
 const f=fixture(t,{'a.test.mjs':code('a'),'z.test.mjs':code('z'),'long.test.mjs':code('long')},[{file:'tests/long.test.mjs',reason:'Complete campaign acceptance.'}]);
 mkdirSync(path.join(f.root,'.cache/test-times'),{recursive:true});
 const full={files:[{file:'tests/z.test.mjs',duration_ms:200},{file:'tests/a.test.mjs',duration_ms:1}]};
 writeFileSync(path.join(f.root,'.cache/test-times/full.json'),JSON.stringify(full));
 const result=f.run(['--suite','quick','--concurrency','1']);
 assert.equal(result.status,0,result.stdout+result.stderr);
 assert.equal(readFileSync(marker,'utf8'),'z\na\n');
 assert.deepEqual(f.report('quick').scheduledFiles,['tests/z.test.mjs','tests/a.test.mjs']);
 assert.deepEqual(JSON.parse(readFileSync(path.join(f.root,'.cache/test-times/full.json'),'utf8')),full);
});
