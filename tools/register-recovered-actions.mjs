import fs from 'node:fs/promises';
import sharp from '../web/node_modules/sharp/lib/index.js';
import {removeExportKey,boundsOf,sheetRectangles,packIllustratedSources} from './pack-illustrated-sprites.mjs';
const [appearance,sequence,north,south]=process.argv.slice(2);
if(!south)throw Error('Usage: APPEARANCE SEQUENCE NORTH_SUFFIX SOUTH_SUFFIX');
const local=process.argv.includes('--local');
const root=local?'assets/source/illustrated-sprites/family-actions':'/Users/fsodano/fibradev/games/granaderos-sprite-recovery/assets/source/illustrated-sprites/complete-actions';
const dir=local?'assets/source/illustrated-sprites/family-actions':'assets/source/illustrated-sprites/complete-actions';await fs.mkdir(dir,{recursive:true});
const baseline=JSON.parse(await fs.readFile('assets/previews/illustrated-sprites/packed/manifest.json'));
const reference=process.argv.find(a=>a.startsWith('--reference='))?.split('=')[1]??'crouch-idle';
const idle=baseline.atlases[`${appearance}-${reference}`],directions=['n','ne','e','se','s','sw','w','nw'];
const name=`${appearance}-${sequence}`,sheets=[];
for(const [suffix,ds] of [[north,directions.slice(0,4)],[south,directions.slice(4)]]){
 const file=`${name}-${suffix}.png`,source=`${dir}/${file}`;
 if(!local)await fs.copyFile(`${root}/${file}`,source);
 try{if(!local)await fs.copyFile(`${root}/${file.replace('.png','.prompt.txt')}`,source.replace('.png','.prompt.txt'));}catch(e){if(e.code!=='ENOENT')throw e;}
 const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const clean=removeExportKey(data,info.width);
 let rectangles;
 try{rectangles=sheetRectangles(clean,info.width,info.height,4,4);}catch(e){
  if(!process.argv.includes('--grid'))throw e;
  rectangles=Array.from({length:16},(_,i)=>{const row=Math.floor(i/4),col=i%4,left=Math.round(col*info.width/4),top=Math.round(row*info.height/4);return {row,col,rect:[left,top,Math.round((col+1)*info.width/4)-left,Math.round((row+1)*info.height/4)-top]};});
 }

 const sheet={name,source,columns:4,rows:4,frames:4,fps:5,cell:288,logicalCell:96,anchor:[144,225],scale:1,slots:[]};
 for(let row=0;row<4;row++){
  const cells=[];
  for(let col=0;col<4;col++){
   const rect=rectangles.find(r=>r.row===row&&r.col===col).rect,[left,top,width,height]=rect;
   const pixels=await sharp(clean,{raw:{width:info.width,height:info.height,channels:4}}).extract({left,top,width,height}).raw().toBuffer();
   const bounds=boundsOf(pixels,width,height);let lo=width,hi=0;
   for(let y=Math.floor(bounds[3]-(bounds[3]-bounds[1])*.08);y<bounds[3];y++)for(let x=0;x<width;x++)if(pixels[(y*width+x)*4+3]){lo=Math.min(lo,x);hi=Math.max(hi,x+1);}
   cells.push({rect,bounds,foot:(lo+hi)/2,col});
  }
  const ref=idle.records.find(r=>r.direction===ds[row]);
  const scale=(ref.bounds[3]-ref.bounds[1])/(cells[0].bounds[3]-cells[0].bounds[1]);
  const ground=Math.max(...cells.map(c=>c.bounds[3]));
  for(const c of cells)sheet.slots.push({direction:ds[row],frame:c.col,row,col:c.col,rect:c.rect,scale,anchor:[c.foot,ground],calibration:{review:'pending',source:'recovered authored sheet'}});
 }
 sheets.push(sheet);
}
const path=`${dir}/${name}.registration.json`;await fs.writeFile(path,JSON.stringify({version:1,directions,sheets},null,2)+'\n');
const destination=`assets/previews/illustrated-sprites/family-actions/${name}`;
const result=await packIllustratedSources({manifestPath:path,destination});console.log(name,result.atlases[name].records.length);
