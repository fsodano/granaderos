import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {runnerOptions,scheduleTests,assertFullTestSelection,normalizeTestFile} from '../tools/test-runner-lib.mjs';

function fixture(t,files){
 const root=mkdtempSync(path.join(tmpdir(),'granaderos-runner-test-'));
 t.after(()=>rmSync(root,{recursive:true,force:true}));
 mkdirSync(path.join(root,'tools'));
 mkdirSync(path.join(root,'tests'));
 for(const name of ['test-runner.mjs','test-runner-lib.mjs'])copyFileSync(fileURLToPath(new URL(`../tools/${name}`,import.meta.url)),path.join(root,'tools',name));
 for(const [name,contents]of Object.entries(files))writeFileSync(path.join(root,'tests',name),contents);
 return {
  root,
  run:(args=[],env={},nodeArgs=[])=>spawnSync(process.execPath,[...nodeArgs,path.join(root,'tools/test-runner.mjs'),...args],{encoding:'utf8',timeout:15000,env:{...process.env,GRANADEROS_TEST_CONCURRENCY:'2',...env}}),
  report:()=>JSON.parse(readFileSync(path.join(root,'.cache/test-times/full.json'),'utf8')),
 };
}
const passing="import test from 'node:test';test('fixture case',()=>{});\n";

test('automatic workers follow available CPU capacity with an eight-worker default cap',()=>{
 for(const [cpus,expected]of [[1,1],[4,4],[12,8],[64,8]])assert.equal(runnerOptions([],{},cpus).concurrency,expected);
 assert.equal(runnerOptions([],{GRANADEROS_TEST_CONCURRENCY:'3'},12).concurrency,3);
 assert.equal(runnerOptions(['--concurrency','12'],{GRANADEROS_TEST_CONCURRENCY:'3'},12).concurrency,12);
 assert.equal(runnerOptions(['--concurrency=5'],{},12).concurrency,5);
 for(const value of ['','0','-1','1.5','Infinity','65','1e1','2extra']){
  assert.throws(()=>runnerOptions(['--concurrency',value],{},12),/Usage:/);
  assert.throws(()=>runnerOptions([],{GRANADEROS_TEST_CONCURRENCY:value},12),/Usage:/);
 }
 for(const args of [['--concurrency'],['--concurrency','2','--concurrency','3'],['--skip','slow'],['tests/a.test.mjs']])assert.throws(()=>runnerOptions(args,{},12),/Usage:/);
});

test('inherited include, exclude and only filters cannot change a full run',t=>{
 const f=fixture(t,{'sample.test.mjs':"import test from 'node:test';import assert from 'node:assert/strict';test('passing',()=>{});test('failing',()=>assert.fail('must execute this assertion'));\n"});
 for(const args of [['--test-name-pattern=sample|passing'],['--test-name-pattern','sample|passing'],['--test-skip-pattern=failing'],['--test-only'],['--test_name_pattern=sample|passing'],['--test_skip_pattern=failing'],['--test_only'],['--test_name-pattern=sample|passing'],['--test-skip_pattern=failing']]){
  const result=f.run([],{},args);
  assert.notEqual(result.status,0,JSON.stringify(args));
  assert.match(result.stderr,/Full test runs reject inherited test-selection flags/);
 }
 for(const option of ['--test-name-pattern=sample|passing','--test-skip-pattern=failing','--test-only','"--test-only"','--test_name_pattern=sample|passing','--test_skip_pattern=failing','--test_only','--test_name-pattern=sample|passing','--test-skip_pattern=failing']){
  assert.throws(()=>assertFullTestSelection([],option),/Full test runs reject inherited test-selection flags/);
  const result=f.run([],{NODE_OPTIONS:option});
  assert.notEqual(result.status,0,option);
 }
 assert.doesNotThrow(()=>assertFullTestSelection(['--test','--enable-source-maps'],'--enable-source-maps'));
 const unfiltered=f.run();
 assert.equal(unfiltered.status,1,unfiltered.stdout+unfiltered.stderr);
 assert.match(unfiltered.stdout,/must execute this assertion/);
});

test('Windows file-event paths match portable scheduled paths and timing reports',()=>{
 const scheduled=new Set(['tests/sample.test.mjs']);
 for(const eventPath of ['tests/sample.test.mjs','tests\\sample.test.mjs']){
  assert.ok(scheduled.has(normalizeTestFile(eventPath)));
 }
});

test('slow-first scheduling retains every file exactly once and uses prior measured durations',()=>{
 const files=['tests/z.test.mjs','tests/a.test.mjs','tests/fresh-ending-route.test.mjs'];
 assert.equal(scheduleTests(files)[0],'tests/fresh-ending-route.test.mjs');
 const scheduled=scheduleTests(files,[{file:'tests/z.test.mjs',duration_ms:1000},{file:'tests/a.test.mjs',duration_ms:20},{file:'tests/fresh-ending-route.test.mjs',duration_ms:10}]);
 assert.deepEqual(scheduled,['tests/z.test.mjs','tests/a.test.mjs','tests/fresh-ending-route.test.mjs']);
 assert.deepEqual([...scheduled].sort(),[...files].sort());
 assert.throws(()=>scheduleTests(['tests/a.test.mjs','tests/a.test.mjs']),/repeated/);
});

test('the full runner executes every matching file, preserves skip totals and reports file durations',t=>{
 const f=fixture(t,{
  'a.test.mjs':passing,
  'b.test.mjs':"import test from 'node:test';test('second fixture',()=>{});test.skip('explicit existing skip',()=>{});\n",
  'helper.mjs':"throw Error('not a test target');\n",
 });
 const result=f.run(['--concurrency','2']);
 assert.equal(result.status,0,result.stdout+result.stderr);
 const report=f.report();
 assert.equal(report.complete,true);
 assert.equal(report.expectedFiles,2);
 assert.equal(report.concurrency,2);
 assert.deepEqual(report.files.map(entry=>entry.file).sort(),['tests/a.test.mjs','tests/b.test.mjs']);
 assert.ok(report.files.every(entry=>entry.success&&entry.duration_ms>0));
 assert.equal(report.summary.counts.tests,3);
 assert.equal(report.summary.counts.skipped,1);
 assert.equal(report.summary.counts.failed,0);
 assert.equal(report.summary.success,true);
 assert.match(result.stdout,/Completed 2\/2 files/);
});

test('file concurrency reaches the selected limit without exceeding it',t=>{
 const marker=path.join(tmpdir(),`granaderos-concurrency-${process.pid}-${Date.now()}.jsonl`);
 t.after(()=>rmSync(marker,{force:true}));
 const files={};
 for(let index=0;index<4;index++)files[`case-${index}.test.mjs`]=`import test from 'node:test';import {appendFileSync} from 'node:fs';test('concurrency fixture ${index}',async()=>{appendFileSync(${JSON.stringify(marker)},JSON.stringify({type:'start',file:${index}})+'\\n');await new Promise(resolve=>setTimeout(resolve,150));appendFileSync(${JSON.stringify(marker)},JSON.stringify({type:'finish',file:${index}})+'\\n');});\n`;
 const f=fixture(t,files),result=f.run(['--concurrency','2']);
 assert.equal(result.status,0,result.stdout+result.stderr);
 let active=0,maximum=0;
 for(const event of readFileSync(marker,'utf8').trim().split('\n').map(line=>JSON.parse(line))){
  active+=event.type==='start'?1:-1;
  maximum=Math.max(maximum,active);
  assert.ok(active>=0&&active<=2);
 }
 assert.equal(maximum,2);
 assert.equal(active,0);
});

test('cached timings change actual execution order while malformed cache data cannot omit files',t=>{
 const marker=path.join(tmpdir(),`granaderos-order-${process.pid}-${Date.now()}.jsonl`);
 t.after(()=>rmSync(marker,{force:true}));
 const code=name=>`import test from 'node:test';import {appendFileSync} from 'node:fs';test('ordered fixture',()=>appendFileSync(${JSON.stringify(marker)},${JSON.stringify(name+'\n')}));\n`;
 const f=fixture(t,{'a.test.mjs':code('a'),'z.test.mjs':code('z')});
 mkdirSync(path.join(f.root,'.cache/test-times'),{recursive:true});
 writeFileSync(path.join(f.root,'.cache/test-times/full.json'),JSON.stringify({files:[{file:'tests/z.test.mjs',duration_ms:200},{file:'tests/a.test.mjs',duration_ms:1}]}));
 let result=f.run(['--concurrency','1']);
 assert.equal(result.status,0,result.stdout+result.stderr);
 assert.equal(readFileSync(marker,'utf8'),'z\na\n');
 writeFileSync(path.join(f.root,'.cache/test-times/full.json'),JSON.stringify({files:{unexpected:'shape'}}));
 result=f.run(['--concurrency','1']);
 assert.equal(result.status,0,result.stdout+result.stderr);
 assert.equal(f.report().files.length,2);
});

test('a failed assertion and an early file crash fail the complete run without dropping other files',t=>{
 const f=fixture(t,{
  'a.test.mjs':"import test from 'node:test';import assert from 'node:assert/strict';test('expected failure',()=>assert.fail('fixture failure'));\n",
  'b.test.mjs':"throw Error('fixture module crash');\n",
  'c.test.mjs':passing,
 });
 const result=f.run();
 assert.equal(result.status,1,result.stdout+result.stderr);
 const report=f.report();
 assert.equal(report.complete,true);
 assert.equal(report.files.length,3);
 assert.equal(report.files.filter(entry=>!entry.success).length,2);
 assert.equal(report.summary.success,false);
 assert.ok(report.summary.counts.failed>=2);
 assert.match(result.stdout,/fixture failure/);
 assert.match(result.stdout,/fixture module crash/);
});

test('a matching non-file or an unknown CLI option cannot silently reduce full coverage',t=>{
 const f=fixture(t,{'a.test.mjs':passing});
 const invalid=f.run(['--test-name-pattern','fast']);
 assert.equal(invalid.status,2);
 assert.match(invalid.stderr,/Usage:/);
 mkdirSync(path.join(f.root,'tests','hidden.test.mjs'));
 const missing=f.run();
 assert.notEqual(missing.status,0);
 assert.match(missing.stderr,/no target may be silently omitted/);
});
