import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=fileURLToPath(new URL('../',import.meta.url));
const matching=(await readdir(path.join(root,'tests'),{withFileTypes:true})).filter(entry=>!entry.name.startsWith('.')&&entry.name.endsWith('.test.mjs'));
assert.ok(matching.every(entry=>entry.isFile()),'Matching test targets must be regular files; no target may be silently omitted.');
const all=matching.map(entry=>`tests/${entry.name}`).sort();
assert.ok(all.length>0,'No test files were found.');
const [mode,number]=process.argv.slice(2);
const count=4;
const groups=Array.from({length:count},(_,index)=>all.filter((_,position)=>position%count===index));
assert.deepEqual(groups.flat().sort(),all,'Every test file must belong to exactly one group.');
assert.equal(new Set(groups.flat()).size,all.length,'A test file is repeated.');
assert.ok(groups.every(group=>group.length>0),'A test group is empty.');

if(mode==='--check'&&process.argv.length===3){
 console.log(JSON.stringify({files:all.length,groups:groups.map((files,index)=>({group:index+1,count:files.length,files})),complete:true},null,2));
}else if(mode==='--run'&&/^[1-4]$/.test(number??'')&&process.argv.length===4){
 const files=groups[Number(number)-1];
 console.log(`Running complete test group ${number}/${count}: ${files.length} of ${all.length} files; no name filters.`);
 // An inherited Node test context suppresses nested runners instead of executing files.
 const env={...process.env};delete env.NODE_TEST_CONTEXT;
 const result=spawnSync(process.execPath,['--test','--test-concurrency=2',...files],{cwd:root,stdio:'inherit',env});
 if(result.error)throw result.error;
 process.exitCode=result.status??1;
}else{
 console.error('Usage: node tools/test-shard.mjs --check | --run <1|2|3|4>');
 process.exitCode=2;
}
