// Completion gate for the full replacement, separate from staging pack tests.
// A valid partial atlas set is useful progress but never a completed migration.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {SPRITE_APPEARANCES} from '../game/sprite-appearances.js';
import {ILLUSTRATED_SEQUENCES} from './illustrated-sprite-prompts.mjs';

const directory='assets/previews/illustrated-sprites/packed';
const manifest=JSON.parse(await readFile(`${directory}/manifest.json`,'utf8'));
const missing=[],invalid=[];
let expected=0;
for(const appearance of Object.keys(SPRITE_APPEARANCES)){
 const sequences=appearance==='civilian'?['idle','walk','dead-idle','unconscious-breathe']:ILLUSTRATED_SEQUENCES;
 for(const sequence of sequences){
  expected++;
  const name=`${appearance}-${sequence}`,entry=manifest.atlases[name];
  if(!entry){missing.push(name);continue;}
  const bytes=await readFile(`${directory}/${entry.file}`);
  if(entry.records.length!==8*entry.framesPerDirection||createHash('sha256').update(bytes).digest('hex')!==entry.sha256)invalid.push(name);
 }
}
console.log(JSON.stringify({status:missing.length||invalid.length?'incomplete':'asset-coverage-complete',expected,packed:expected-missing.length,missingCount:missing.length,invalid,missing},null,2));
if(process.argv.includes('--require-complete')&&(missing.length||invalid.length))process.exitCode=1;
