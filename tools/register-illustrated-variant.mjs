// Register an imagegen appearance edit of a reviewed pose reference. The
// Match the corresponding reviewed pose bounds after the authoring tool moves
// or resizes a figure inside its cell. This changes extraction only, not art.
import {readFile,writeFile} from 'node:fs/promises';
import sharp from '../web/node_modules/sharp/lib/index.js';
import {removeExportKey,boundsOf,sheetRectangles} from './pack-illustrated-sprites.mjs';
import {SPRITE_APPEARANCES} from '../game/sprite-appearances.js';

const exportKey=process.argv.includes('--white-key')?'white':'magenta';
const [source,name,referenceName,half='all',regionFile]=process.argv.slice(2).filter(a=>a!=='--white-key');
if(!source||!name||!referenceName||!['all','north','south'].includes(half))
 throw Error('Usage: node tools/register-illustrated-variant.mjs SOURCE NAME REVIEWED_ATLAS [all|north|south] [REGIONS_JSON]');
const staged=JSON.parse(await readFile('assets/previews/illustrated-sprites/packed/manifest.json'));
const reference=staged.atlases[referenceName];
if(!reference)throw Error(`Missing reviewed atlas ${referenceName}`);
const referencePath=`assets/source/illustrated-sprites/${referenceName}${half==='all'?'':`-${half}`}-reviewed-reference.png`;
const provenance=JSON.parse(await readFile(referencePath.replace(/\.png$/,'.provenance.json')));
const frames=reference.framesPerDirection,rows=frames===1?2:4;
if((frames===1&&half!=='all')||(frames!==1&&half==='all'))throw Error('Direction half does not match reference layout');
const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const cellWidth=info.width/4,cellHeight=info.height/rows;
if(Math.abs(cellWidth-cellHeight)>1)throw Error('Variant must preserve square reference cells');
const pixels=removeExportKey(data,info.width,exportKey),scale=reference.cell/cellWidth;
const directions=half==='north'?staged.directions.slice(0,4):half==='south'?staged.directions.slice(4):staged.directions;
const regions=[];
for(let row=0;row<rows;row++)for(let col=0;col<4;col++){
 const left=Math.round(col*cellWidth),top=Math.round(row*cellHeight);
 const width=Math.round((col+1)*cellWidth)-left,height=Math.round((row+1)*cellHeight)-top;
 regions.push({row,col,rect:[left,top,width,height]});
}
async function readRegions(input,requireMargin){
 const result=[];
 for(const {row,col,rect:[left,top,width,height]} of input){
 const crop=await sharp(pixels,{raw:{width:info.width,height:info.height,channels:4}}).extract({left,top,width,height}).raw().toBuffer();
 const bounds=boundsOf(crop,width,height);
 if(!bounds||(requireMargin&&(bounds[0]<1||bounds[1]<1||bounds[2]>width-1||bounds[3]>height-1)))
  throw Error(`${source}: empty or boundary-touching pose ${row},${col}`);
 const rect=[left+bounds[0]-2,top+bounds[1]-2,bounds[2]-bounds[0]+4,bounds[3]-bounds[1]+4];
 result.push({direction:directions[frames===1?row*4+col:row],frame:frames===1?0:col,row,col,rect,
  sourceBounds:[2,2,rect[2]-2,rect[3]-2]});
 }
 return result;
}
// Some exports move a whole row across its nominal grid line. Clear gutters
// can prove the full pose is present; reject a merged or missing row instead.
let slots;
if(regionFile){
 const explicit=JSON.parse(await readFile(regionFile));
 if(explicit.length!==rows*4||new Set(explicit.map(r=>`${r.row}:${r.col}`)).size!==rows*4||explicit.some(r=>r.row<0||r.row>=rows||r.col<0||r.col>=4))throw Error('Invalid reviewed regions');
 slots=await readRegions(explicit,true);
}else{
 try{slots=await readRegions(regions,true);}
 catch{slots=await readRegions(sheetRectangles(pixels,info.width,info.height,4,rows),false);}
}
const ground=name.includes('-prone-')||name.endsWith('-dead-idle')||name.endsWith('-unconscious-breathe');
const appearance=Object.keys(SPRITE_APPEARANCES).find(id=>name.startsWith(id+'-'));
const referenceAppearance=Object.keys(SPRITE_APPEARANCES).find(id=>referenceName.startsWith(id+'-'));
for(const slot of slots){
 const sourceFirst=slots.find(s=>s.direction===slot.direction&&s.frame===0);
 const referenceFirst=reference.records.find(r=>r.direction===slot.direction&&r.frame===0);
 const sourceWidth=sourceFirst.rect[2]-4,sourceHeight=sourceFirst.rect[3]-4;
 const referenceWidth=referenceFirst.bounds[2]-referenceFirst.bounds[0],referenceHeight=referenceFirst.bounds[3]-referenceFirst.bounds[1];
 // One scale per direction keeps authored action phases consistent. Ground
 // poses use their longest axis; upright actors use their full body height.
 const basePoseScale=ground?Math.max(referenceWidth,referenceHeight)/Math.max(sourceWidth,sourceHeight):referenceHeight/sourceHeight;
 const idle=staged.atlases[`${appearance}-idle`]?.records.find(r=>r.direction===slot.direction);
 const baseIdle=staged.atlases[`${referenceAppearance}-idle`]?.records.find(r=>r.direction===slot.direction);
 const bodyRatio=idle&&baseIdle&&!name.includes('-mounted-')?(idle.bounds[3]-idle.bounds[1])/(baseIdle.bounds[3]-baseIdle.bounds[1]):1;
 const poseScale=basePoseScale*bodyRatio;
 const pose=reference.records.find(r=>r.direction===slot.direction&&r.frame===slot.frame);
 slot.scale=Number(poseScale.toFixed(6));
 slot.anchor=[2+(reference.anchor[0]-pose.bounds[0])/basePoseScale,2+(reference.anchor[1]-pose.bounds[1])/basePoseScale].map(v=>Number(v.toFixed(3)));
 slot.anchorMethod='aligned to corresponding reviewed pose bounds; one scale per direction; inspect identity and motion';
}
const path='assets/source/illustrated-sprites/sources.json',manifest=JSON.parse(await readFile(path));
const job={name,source,prompt:source.replace(/\.png$/,'.prompt.txt'),columns:4,rows,frames,fps:reference.fps,
 cell:reference.cell,logicalCell:reference.logicalCell,anchor:reference.anchor,scale,
 poseReference:{name:referenceName,file:referencePath,sha256:provenance.sha256,half},slots};
if(regionFile)job.regionFile=regionFile;
if(exportKey==='white')job.exportKey=exportKey;
const existing=manifest.sheets.findIndex(j=>j.source===source);
if(existing<0)manifest.sheets.push(job);else manifest.sheets[existing]=job;
await writeFile(path,JSON.stringify(manifest,null,2)+'\n');
console.log(`Registered ${slots.length} edited poses for ${name}; inspect layout and identity before publishing.`);
