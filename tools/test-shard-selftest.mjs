import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const source=fileURLToPath(new URL('./test-shard.mjs',import.meta.url));
function fixture(t){
 const root=mkdtempSync(path.join(tmpdir(),'granaderos-shard-test-'));t.after(()=>rmSync(root,{recursive:true,force:true}));mkdirSync(path.join(root,'tools'));mkdirSync(path.join(root,'tests'));const script=path.join(root,'tools/test-shard.mjs');copyFileSync(source,script);
 for(let i=0;i<8;i++)writeFileSync(path.join(root,`tests/case-${i}.test.mjs`),"import test from 'node:test';test('fixture case',()=>{});\n");
 return {root,run:(...args)=>spawnSync(process.execPath,[script,...args],{encoding:'utf8',timeout:15000})};
}
test('the partition covers every matching fixture file exactly once',t=>{
 const f=fixture(t),result=f.run('--check');assert.equal(result.status,0,result.stderr);const manifest=JSON.parse(result.stdout);assert.equal(manifest.files,8);assert.deepEqual(manifest.groups.map(g=>g.count),[2,2,2,2]);assert.deepEqual(manifest.groups.flatMap(g=>g.files).sort(),Array.from({length:8},(_,i)=>`tests/case-${i}.test.mjs`));
});
test('missing, extra, fractional and out-of-range arguments fail instead of silently selecting tests',t=>{
 const f=fixture(t);for(const args of [[],['--run','0'],['--run','5'],['--run','1.0'],['--run','1','extra'],['--bogus'],['--check','extra']]){const r=f.run(...args);assert.equal(r.status,2,JSON.stringify(args));assert.match(r.stderr,/Usage:/);}
});
test('a matching non-file target fails coverage verification',t=>{
 const f=fixture(t);mkdirSync(path.join(f.root,'tests/extra.test.mjs'));const r=f.run('--check');assert.notEqual(r.status,0);assert.match(r.stderr,/no target may be silently omitted/);
});
test('a selected failing test propagates failure while another complete group succeeds',t=>{
 const f=fixture(t);writeFileSync(path.join(f.root,'tests/case-0.test.mjs'),"import test from 'node:test';import assert from 'node:assert/strict';test('intentional fixture failure',()=>assert.fail('expected fixture failure'));\n");const failed=f.run('--run','1');assert.equal(failed.status,1,failed.stdout+failed.stderr);assert.match(failed.stdout,/intentional fixture failure/);const passed=f.run('--run','2');assert.equal(passed.status,0,passed.stderr);
});
