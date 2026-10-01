import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

// A fresh process is necessary: the test runner's warmed ESM cache can hide
// initialization cycles that break the first import in a route or web bundle.
for(const entry of ['medical-care','assignments','sleep']){
 test(`${entry} can initialize care and assignment notices as the first import`,()=>{
  const url=new URL(`../game/${entry}.js`,import.meta.url).href;
  const care=new URL('../game/medical-care.js',import.meta.url).href;
  const attention=new URL('../game/assignment-attention.js',import.meta.url).href;
  const result=spawnSync(process.execPath,['--input-type=module','-e',`
   await import(${JSON.stringify(url)});
   const care=await import(${JSON.stringify(care)});
   const attention=await import(${JSON.stringify(attention)});
   if(care.doctorRate({medical:60})!==5)throw Error('Invalid medical rate');
   if(care.ALL_ASSIGNMENTS.patient!=='Paciente'||care.ALL_ASSIGNMENTS.repair!=='Reparación')throw Error('Missing assignment labels');
   if(attention.assignmentStates({recruited:[],operativeState:{},militiaTraining:[]},[]).length!==0)throw Error('Unexpected assignments');
  `],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
 });
}
