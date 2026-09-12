// Register a reviewed 8-direction, 4-phase sheet without altering its source.
import fs from 'node:fs/promises';
import sharp from '../web/node_modules/sharp/lib/index.js';
import {removeExportKey,boundsOf,sheetRectangles,packIllustratedSources} from './pack-illustrated-sprites.mjs';
const [appearance,sequence,source,referenceSequence='mounted-idle']=process.argv.slice(2);
if(!source)throw Error('Usage: APPEARANCE SEQUENCE SOURCE [REFERENCE_SEQUENCE]');
const directions=['n','ne','e','se','s','sw','w','nw'];
const manifest=JSON.parse(await fs.readFile('assets/previews/illustrated-sprites/packed/manifest.json'));
const reference=manifest.atlases[`${appearance}-${referenceSequence}`];
if(!reference)throw Error('Missing scale reference');
const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const clean=removeExportKey(data,info.width);
const rectangles=sheetRectangles(clean,info.width,info.height,4,8);
const name=`${appearance}-${sequence}`;
const sheet={name,source,prompt:source.replace('.png','.prompt.txt'),columns:4,rows:8,frames:4,fps:sequence==='mounted-run'?7:5,cell:288,logicalCell:96,anchor:[144,225],scale:1,slots:[]};
for(let row=0;row<8;row++){
 const cells=[];
 for(let col=0;col<4;col++){
  const [left,top,width,height]=rectangles.find(r=>r.row===row&&r.col===col).rect;
  const pixels=await sharp(clean,{raw:{width:info.width,height:info.height,channels:4}}).extract({left,top,width,height}).raw().toBuffer();
  const bounds=boundsOf(pixels,width,height);if(!bounds)throw Error('Empty source cell');
  let footLeft=width,footRight=0;
  for(let y=Math.floor(bounds[3]-(bounds[3]-bounds[1])*.08);y<bounds[3];y++)for(let x=0;x<width;x++)if(pixels[(y*width+x)*4+3]){footLeft=Math.min(footLeft,x);footRight=Math.max(footRight,x+1);}
  cells.push({col,rect:[left,top,width,height],bounds,footCentre:(footLeft+footRight)/2});
 }
 const ref=reference.records.find(r=>r.direction===directions[row]);
 const targetHeight=ref.bounds[3]-ref.bounds[1];
 const maxHeight=Math.max(...cells.map(c=>c.bounds[3]-c.bounds[1]));
 const scale=targetHeight/(sequence==='mounted-run'?maxHeight:cells[0].bounds[3]-cells[0].bounds[1]);
 const ground=Math.max(...cells.map(c=>c.bounds[3]));
 for(const c of cells)sheet.slots.push({direction:directions[row],frame:c.col,row,col:c.col,rect:c.rect,scale,anchor:[sequence==='mounted-run'?(c.bounds[0]+c.bounds[2])/2:c.footCentre,ground],sourceBounds:c.bounds,anchorMethod:'shared row ground; silhouette centre; scale matched to approved idle',calibration:{review:'pending'}});
}
const registration={version:1,directions,sheets:[sheet]};
const path=`assets/source/illustrated-sprites/family-actions/${name}.registration.json`;
await fs.writeFile(path,JSON.stringify(registration,null,2)+'\n');
const output=`assets/previews/illustrated-sprites/family-actions/${name}`;
const packed=await packIllustratedSources({manifestPath:path,destination:output});
console.log(JSON.stringify({name,frames:packed.atlases[name].records.length,output}));
