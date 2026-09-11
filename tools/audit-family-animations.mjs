import fs from 'node:fs/promises';
import {SPRITE_APPEARANCES} from '../game/sprite-appearances.js';
import {FAMILY_SPRITE_SEQUENCES,FAMILY_SPRITE_DIRECTIONS} from '../game/sprite-family-sequences.js';
const baseline=JSON.parse(await fs.readFile('assets/previews/illustrated-sprites/packed/manifest.json'));
const candidateRoot='assets/previews/illustrated-sprites/family-actions';
const candidates={};
for(const d of await fs.readdir(candidateRoot,{withFileTypes:true}))if(d.isDirectory()){
 try{Object.assign(candidates,JSON.parse(await fs.readFile(`${candidateRoot}/${d.name}/manifest.json`)).atlases);}catch(e){if(e.code!=='ENOENT')throw e;}
}
const missing=[],existing=[],staged=[],invalid=[];
for(const appearance of Object.keys(SPRITE_APPEARANCES))for(const sequence of FAMILY_SPRITE_SEQUENCES){
 const name=`${appearance}-${sequence}`,entry=candidates[name]??baseline.atlases[name];
 if(!entry){missing.push(name);continue;}
 for(const direction of FAMILY_SPRITE_DIRECTIONS)for(let frame=0;frame<entry.framesPerDirection;frame++)if(entry.records.filter(r=>r.direction===direction&&r.frame===frame).length!==1)invalid.push(`${name}:${direction}:${frame}`);
 (candidates[name]?staged:existing).push(name);
}
const report={scope:'27 sequences x 8 variants; staging presence only, visual acceptance and runtime integration checked separately',required:216,existing:existing.length,staged:staged.length,missingCount:missing.length,invalid,missing};
await fs.writeFile(`${candidateRoot}/coverage.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(process.argv.includes('--require-complete')&&(missing.length||invalid.length))process.exitCode=1;
