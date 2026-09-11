import fs from 'node:fs/promises';
import sharp from '../web/node_modules/sharp/lib/index.js';
import {removeExportKey,boundsOf,sheetRectangles,packIllustratedSources} from './pack-illustrated-sprites.mjs';
const [appearance,sequence,direction,source,reference='idle']=process.argv.slice(2);
if(!source)throw Error('APPEARANCE SEQUENCE DIRECTION SOURCE [REFERENCE]');
const name=`${appearance}-${sequence}`,path=`assets/source/illustrated-sprites/family-actions/${name}.registration.json`;
let manifest;try{manifest=JSON.parse(await fs.readFile(path));}catch(e){if(e.code!=='ENOENT')throw e;manifest={version:1,directions:['n','ne','e','se','s','sw','w','nw'],sheets:[]};}
const base=JSON.parse(await fs.readFile('assets/previews/illustrated-sprites/packed/manifest.json'));
const ref=base.atlases[`${appearance}-${reference}`].records.find(r=>r.direction===direction);
const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true}),clean=removeExportKey(data,info.width);
const rectangles=sheetRectangles(clean,info.width,info.height,4,1),cells=[];
for(const {rect,col} of rectangles){const [left,top,width,height]=rect,pixels=await sharp(clean,{raw:{width:info.width,height:info.height,channels:4}}).extract({left,top,width,height}).raw().toBuffer(),bounds=boundsOf(pixels,width,height);let lo=width,hi=0;for(let y=Math.floor(bounds[3]-(bounds[3]-bounds[1])*.08);y<bounds[3];y++)for(let x=0;x<width;x++)if(pixels[(y*width+x)*4+3]){lo=Math.min(lo,x);hi=Math.max(hi,x+1);}cells.push({rect,col,bounds,foot:(lo+hi)/2});}
const scale=(ref.bounds[3]-ref.bounds[1])/(cells[0].bounds[3]-cells[0].bounds[1]);
const sheet={name,source,columns:4,rows:1,frames:4,fps:5,cell:288,logicalCell:96,anchor:[144,225],scale:1,slots:cells.map(c=>({direction,frame:c.col,row:0,col:c.col,rect:c.rect,scale,anchor:[c.foot,c.bounds[3]],calibration:{review:'pending',source:'authored directional strip'}}))};
manifest.sheets=manifest.sheets.map(s=>({...s,slots:s.slots.filter(s=>s.direction!==direction)})).filter(s=>s.slots.length);manifest.sheets.push(sheet);
await fs.writeFile(path,JSON.stringify(manifest,null,2)+'\n');
const directions=new Set(manifest.sheets.flatMap(s=>s.slots.map(s=>s.direction)));
if(directions.size===8){await packIllustratedSources({manifestPath:path,destination:`assets/previews/illustrated-sprites/family-actions/${name}`});console.log(name,'packed');}else console.log(name,directions.size,'directions registered');
