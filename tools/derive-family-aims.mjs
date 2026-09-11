// A held aim is the authored pre-shot frame, not a fabricated animation.
import fs from 'node:fs/promises';
import sharp from '../web/node_modules/sharp/lib/index.js';
import {createHash} from 'node:crypto';
import {SPRITE_APPEARANCES} from '../game/sprite-appearances.js';
const root='assets/previews/illustrated-sprites/family-actions';
const baseRoot='assets/previews/illustrated-sprites/packed';
const base=JSON.parse(await fs.readFile(`${baseRoot}/manifest.json`));
const sha=b=>createHash('sha256').update(b).digest('hex');
for(const appearance of Object.keys(SPRITE_APPEARANCES))for(const [aim,fire] of [['aim-idle','fire'],['crouch-aim-idle','crouch-fire'],['prone-aim-idle','prone-armed-fire']]){
 const sourceName=`${appearance}-${fire}`,name=`${appearance}-${aim}`;
 let entry=base.atlases[sourceName],directory=baseRoot;
 try{const m=JSON.parse(await fs.readFile(`${root}/${sourceName}/manifest.json`));entry=m.atlases[sourceName];directory=`${root}/${sourceName}`;}catch(e){if(e.code!=='ENOENT')throw e;}
 if(!entry){console.log('Missing source',sourceName);continue;}
 const layers=[],records=[];
 for(let d=0;d<8;d++){
  const bytes=await sharp(`${directory}/${entry.file}`).extract({left:0,top:d*entry.cell,width:entry.cell,height:entry.cell}).png().toBuffer();
  layers.push({input:bytes,left:d*entry.cell,top:0});
  records.push({...entry.records.find(r=>r.direction===base.directions[d]&&r.frame===0),frame:0,sha256:sha(bytes)});
 }
 const bytes=await sharp({create:{width:entry.cell*8,height:entry.cell,channels:4,background:'#00000000'}}).composite(layers).png().toBuffer();
 const output=`${root}/${name}`;await fs.mkdir(output,{recursive:true});await fs.writeFile(`${output}/${name}.png`,bytes);
 const derived={...entry,file:`${name}.png`,framesPerDirection:1,fps:0,size:[entry.cell*8,entry.cell],records,sha256:sha(bytes),derivedFrom:{atlas:sourceName,frame:0,reason:'hold authored pre-shot aim'}};
 await fs.writeFile(`${output}/manifest.json`,JSON.stringify({version:1,style:'illustrated-pixel-art',status:'staging',directions:base.directions,atlases:{[name]:derived}},null,2)+'\n');console.log(name);
}
