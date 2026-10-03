import {fileURLToPath} from 'node:url';
import {discoverTests,runnerOptions,runTests} from './test-runner-lib.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
let options;
try{options=runnerOptions(process.argv.slice(2));}
catch(error){console.error(error.message);process.exitCode=2;}
if(options){
 const files=await discoverTests(root);
 process.exitCode=await runTests({root,files,...options});
}
