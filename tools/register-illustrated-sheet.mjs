// Record extraction rectangles from clear gutters. The resulting source
// manifest is reviewable and is the packer's input, not an implicit heuristic
// applied afresh whenever the game builds.
import {readFile,writeFile} from 'node:fs/promises';
import sharp from '../web/node_modules/sharp/lib/index.js';
import {removeExportKey,sheetRectangles,boundsOf} from './pack-illustrated-sprites.mjs';

const [source,name,directionList,framesText='1',scaleText='.29',logicalCellText='52',pivotMethod='upright']=process.argv.slice(2);
if(!source||!name||!directionList)throw Error('Usage: node tools/register-illustrated-sheet.mjs SOURCE NAME n,ne,e,se,s,sw,w,nw FRAMES SCALE [LOGICAL_CELL] [upright|ground]');
const directions=directionList.split(','),frames=Number(framesText),scale=Number(scaleText);
const logicalCell=Number(logicalCellText),anchors={52:[78,138],70:[105,186],76:[114,189],80:[120,141],96:[144,165]};
if(!anchors[logicalCell]||!['upright','ground'].includes(pivotMethod))throw Error('Unsupported layout or pivot method');
const columns=4,rows=frames===1?directions.length/columns:directions.length;
if(!Number.isInteger(rows)||!Number.isFinite(scale)||scale<=0||![1,4].includes(frames))throw Error('Invalid authored sheet layout');
const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const pixels=removeExportKey(data,info.width),rects=sheetRectangles(pixels,info.width,info.height,columns,rows);
const slots=[];
for(const {row,col,rect} of rects){
 const slot={direction:directions[frames===1?row*columns+col:row],frame:frames===1?0:col,row,col,rect};
 if(frames>1||pivotMethod==='ground'){
  const [left,top,width,height]=rect;
  const crop=await sharp(pixels,{raw:{width:info.width,height:info.height,channels:4}}).extract({left,top,width,height}).raw().toBuffer();
  const bounds=boundsOf(crop,width,height);
  // The head remains above the pelvis in these upright walk sheets. Read
  // its centre independently from moving feet and the long diagonal weapon.
  const centres=[];
  for(let y=Math.round(height*.10);y<Math.round(height*.23);y++){
   let start=-1,longest=[0,0];
   for(let x=0;x<=width;x++){
    if(x<width&&crop[(y*width+x)*4+3]&&start<0)start=x;
    if((x===width||!crop[(y*width+x)*4+3])&&start>=0){if(x-start>longest[1]-longest[0])longest=[start,x];start=-1;}
   }
   if(longest[1]>longest[0])centres.push((longest[0]+longest[1])/2);
  }
  centres.sort((a,b)=>a-b);
  slot.anchor=pivotMethod==='ground'?[(bounds[0]+bounds[2])/2,(bounds[1]+bounds[3])/2]:[centres[Math.floor(centres.length/2)],height-2];
  slot.anchorMethod=pivotMethod==='ground'?'provisional body-centre; requires pose review':'head-centre-and-row-ground; requires animation review';
  slot.sourceBounds=bounds;
 }
 slots.push(slot);
}
const manifestPath='assets/source/illustrated-sprites/sources.json';
const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
const sheet={name,source,prompt:source.replace(/\.png$/,'.prompt.txt'),columns,rows,frames,fps:frames===1?0:name.includes('unconscious')?1:5,cell:logicalCell*3,logicalCell,anchor:anchors[logicalCell],scale,slots};
const existing=manifest.sheets.findIndex(item=>item.source===source);
if(existing>=0)manifest.sheets[existing]=sheet;else manifest.sheets.push(sheet);
await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
console.log(`Registered ${slots.length} source frames for ${name}. Inspect anchors before publishing.`);
