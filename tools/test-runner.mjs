import {fileURLToPath} from 'node:url';
import {assertFullTestSelection,discoverTests,runnerOptions,runTests} from './test-runner-lib.mjs';
import {suiteOptions,suiteManifest} from './test-suites.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
let options,profile;
try{
 profile=suiteOptions(process.argv.slice(2));
 options=runnerOptions(profile.runnerArgs);
 assertFullTestSelection();
}
catch(error){console.error(error.message);options=undefined;process.exitCode=2;}
if(options){
 const all=await discoverTests(root),selection=suiteManifest(all,profile.suite);
 if(profile.list)console.log(JSON.stringify(selection,null,2));
 else{
  console.log(`${selection.suite.toUpperCase()} suite: ${selection.selectedFiles.length}/${selection.totalFiles} files selected; ${selection.excludedFiles.length} excluded.`);
  if(selection.suite==='quick')for(const entry of selection.excludedFiles)console.log(`EXCLUDED ${entry.file}: ${entry.reason}`);
  if(selection.suite==='extended')for(const file of selection.selectedFiles)console.log(`SELECTED ${file}`);
  process.exitCode=await runTests({root,files:selection.selectedFiles,...options,selection,reportName:selection.suite});
 }
}
