// Replace selected source frames with visually reviewed imagegen corrections.
// The region file records the exact cells selected from a correction sheet.
import {readFile,writeFile} from 'node:fs/promises';
import sharp from '../web/node_modules/sharp/lib/index.js';
import {removeExportKey,boundsOf,sheetRectangles} from './pack-illustrated-sprites.mjs';
import {SPRITE_APPEARANCES} from '../game/sprite-appearances.js';

const exportKey=process.argv.includes('--white-key')?'white':'magenta';
const [source,name,referenceName,regionFile]=process.argv.slice(2).filter(a=>a!=='--white-key');
if(!regionFile)throw Error('Usage: node tools/register-illustrated-correction.mjs SOURCE NAME REVIEWED_ATLAS REGIONS_JSON');
const path='assets/source/illustrated-sprites/sources.json';
const manifest=JSON.parse(await readFile(path));
const staged=JSON.parse(await readFile('assets/previews/illustrated-sprites/packed/manifest.json'));
const spec=JSON.parse(await readFile(regionFile)),reference=staged.atlases[referenceName];
if(!reference||!spec.slots?.length||new Set(spec.slots.map(r=>`${r.direction}:${r.frame}`)).size!==spec.slots.length)throw Error('Invalid correction specification');
const appearance=Object.keys(SPRITE_APPEARANCES).find(id=>name.startsWith(id+'-'));
const baseAppearance=Object.keys(SPRITE_APPEARANCES).find(id=>referenceName.startsWith(id+'-'));
const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const pixels=removeExportKey(data,info.width,exportKey);
const detected=spec.slots.some(s=>!s.rect)?sheetRectangles(pixels,info.width,info.height,spec.columns,spec.rows):[];
const slots=[];
for(const item of spec.slots){
 const [left,top,width,height]=item.rect??detected.find(r=>r.row===item.row&&r.col===item.col)?.rect??[];
 const crop=await sharp(pixels,{raw:{width:info.width,height:info.height,channels:4}}).extract({left,top,width,height}).raw().toBuffer();
 const b=boundsOf(crop,width,height);
 if(!b||b[0]<1||b[1]<1||b[2]>width-1||b[3]>height-1)throw Error('Empty or clipped correction region');
 const rect=[left+b[0]-2,top+b[1]-2,b[2]-b[0]+4,b[3]-b[1]+4];
 const pose=reference.records.find(p=>p.direction===item.direction&&p.frame===item.frame);
 if(!pose)throw Error('Unknown reference pose');
 const idle=staged.atlases[appearance+'-idle'].records.find(p=>p.direction===item.direction);
 const base=staged.atlases[baseAppearance+'-idle'].records.find(p=>p.direction===item.direction);
 const ratio=name.includes('-mounted-')?1:(idle.bounds[3]-idle.bounds[1])/(base.bounds[3]-base.bounds[1]);
 const rw=pose.bounds[2]-pose.bounds[0],rh=pose.bounds[3]-pose.bounds[1];
 const byHeight=(item.scaleMode??spec.scaleMode)==='height';
 const baseScale=(byHeight?rh:Math.max(rw,rh))/(byHeight?rect[3]-4:Math.max(rect[2]-4,rect[3]-4));
 slots.push({direction:item.direction,frame:item.frame,row:item.row??0,col:item.col??0,rect,
  scale:Number((baseScale*ratio).toFixed(6)),anchor:[2+(reference.anchor[0]-pose.bounds[0])/baseScale,2+(reference.anchor[1]-pose.bounds[1])/baseScale],
  anchorMethod:'reviewed correction aligned to corresponding pose bounds and idle body size'});
}
for(const job of manifest.sheets)if(job.name===name)job.slots=job.slots.filter(s=>!slots.some(r=>r.direction===s.direction&&r.frame===s.frame));
manifest.sheets=manifest.sheets.filter(j=>j.slots.length&&j.source!==source);
manifest.sheets.push({name,source,prompt:source.replace(/\.png$/,'.prompt.txt'),regionFile,...(exportKey==='white'?{exportKey}:{}),
 columns:spec.columns,rows:spec.rows,frames:reference.framesPerDirection,fps:reference.fps,
 cell:reference.cell,logicalCell:reference.logicalCell,anchor:reference.anchor,scale:slots[0].scale,
 correctionReference:{name:referenceName,sha256:reference.sha256},slots});
await writeFile(path,JSON.stringify(manifest,null,2)+'\n');
console.log(`Registered ${slots.length} reviewed corrections for ${name}.`);
