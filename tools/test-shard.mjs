import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {discoverTests,runnerOptions,runTests} from './test-runner-lib.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const all=await discoverTests(root);
const [mode,number,...options]=process.argv.slice(2);
const count=4;
const groups=Array.from({length:count},(_,index)=>all.filter((_,position)=>position%count===index));
assert.deepEqual(groups.flat().sort(),all,'Every test file must belong to exactly one group.');
assert.equal(new Set(groups.flat()).size,all.length,'A test file is repeated.');
assert.ok(groups.every(group=>group.length>0),'A test group is empty.');

if(mode==='--check'&&process.argv.length===3){
 console.log(JSON.stringify({files:all.length,groups:groups.map((files,index)=>({group:index+1,count:files.length,files})),complete:true},null,2));
}else if(mode==='--run'&&/^[1-4]$/.test(number??'')){
 const files=groups[Number(number)-1];
 let parsed;
 try{parsed=runnerOptions(options);}
 catch(error){console.error(error.message);process.exitCode=2;}
 if(parsed){
  console.log(`Running complete test group ${number}/${count}: ${files.length} of ${all.length} files.`);
  process.exitCode=await runTests({root,files,...parsed,reportName:`group-${number}`});
 }
}else{
 console.error('Usage: node tools/test-shard.mjs --check | --run <1|2|3|4> [--concurrency <1-64>]');
 process.exitCode=2;
}
