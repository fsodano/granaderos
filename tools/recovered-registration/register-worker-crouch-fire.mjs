import fs from 'node:fs/promises';
import sharp from '/Users/fsodano/fibradev/games/granaderos/web/node_modules/sharp/lib/index.js';
import {removeExportKey,boundsOf,packIllustratedSources} from '/Users/fsodano/fibradev/games/granaderos/tools/pack-illustrated-sprites.mjs';
const root='/Users/fsodano/fibradev/games/granaderos';process.chdir(root);
const dir='assets/source/illustrated-sprites/complete-actions';
const manifestPath='assets/source/illustrated-sprites/sources.json';
const existing=JSON.parse(await fs.readFile('assets/previews/illustrated-sprites/packed/manifest.json','utf8'));
const idle=existing.atlases['worker-crouch-idle'];
const directions=['n','ne','e','se','s','sw','w','nw'];
const specs=[['n-fix-v1',1,[[0,'n']]],['north-v1',4,[[1,'ne']]],['north-v3',4,[[2,'e'],[3,'se']]],['south-v2',4,[[0,'s'],[1,'sw'],[2,'w'],[3,'nw']]]];
function feet(data,width,bounds){let l=width,r=0;for(let y=Math.floor(bounds[3]-(bounds[3]-bounds[1])*.08);y<bounds[3];y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]){l=Math.min(l,x);r=Math.max(r,x+1);}return (l+r)/2;}
const sheets=[];
for(const [suffix,rows,rowDirections]of specs){
 const source=`${dir}/worker-crouch-fire-${suffix}.png`;
 const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const clean=removeExportKey(data,info.width);const sheet={name:'worker-crouch-fire',source,prompt:source.replace('.png','.prompt.txt'),columns:4,rows,frames:4,fps:5,cell:210,logicalCell:70,anchor:[105,186],scale:1,slots:[]};
 for(const [row,direction]of rowDirections){
  const cells=[];
  for(let col=0;col<4;col++){
   const x=Math.round(col*info.width/4),y=Math.round(row*info.height/rows),w=Math.round((col+1)*info.width/4)-x,h=Math.round((row+1)*info.height/rows)-y;
   const pixels=await sharp(clean,{raw:{width:info.width,height:info.height,channels:4}}).extract({left:x,top:y,width:w,height:h}).raw().toBuffer();
   cells.push({col,rect:[x,y,w,h],pixels,bounds:boundsOf(pixels,w,h)});
  }
  const ref=idle.records.find(r=>r.direction===direction),targetHeight=ref.bounds[3]-ref.bounds[1];
  const scale=Number((targetHeight/(direction==='n'?321:cells[0].bounds[3]-cells[0].bounds[1])).toFixed(8));
  const old=await sharp('assets/previews/illustrated-sprites/packed/worker-crouch-idle.png').extract({left:directions.indexOf(direction)*156,top:0,width:156,height:156}).ensureAlpha().raw().toBuffer();
  const delta=feet(old,156,ref.bounds)-idle.anchor[0];
  for(const cell of cells)sheet.slots.push({direction,frame:cell.col,col:cell.col,row,rect:cell.rect,scale,anchor:[Number((feet(cell.pixels,cell.rect[2],cell.bounds)-delta/scale).toFixed(5)),cell.bounds[3]],sourceBounds:cell.bounds,anchorMethod:'boot alignment to approved crouch idle; per-direction scale from no-effect frame zero',calibration:{targetBodyHeight:targetHeight,bodyScaleSourceFrame:0,review:'pending packed visual check'}});
 }
 sheets.push(sheet);
}
const registration={version:1,directions,sheets};
await fs.writeFile(`${dir}/worker-crouch-fire.registration.json`,JSON.stringify(registration,null,2)+'\n');
const packed=await packIllustratedSources({manifestPath:`${dir}/worker-crouch-fire.registration.json`,destination:'assets/previews/illustrated-sprites/family-actions/worker-crouch-fire'});
const entry=packed.atlases['worker-crouch-fire'];if(new Set(entry.records.map(r=>r.sha256)).size!==32)throw Error('Repeated new frame');
const layers=[];
for(let row=0;row<8;row++){
 layers.push({input:await sharp('assets/previews/illustrated-sprites/packed/worker-crouch-idle.png').extract({left:row*156,top:0,width:156,height:156}).png().toBuffer(),left:27,top:row*210+48});
 for(let col=0;col<4;col++)layers.push({input:await sharp('assets/previews/illustrated-sprites/family-actions/worker-crouch-fire/worker-crouch-fire.png').extract({left:col*210,top:row*210,width:210,height:210}).png().toBuffer(),left:(col+1)*210,top:row*210});
}
await sharp({create:{width:1050,height:1680,channels:4,background:'#676658'}}).composite(layers).png().toFile('assets/previews/illustrated-sprites/family-actions/worker-crouch-fire/worker-crouch-fire-review.png');
console.log(JSON.stringify({frames:entry.records.length,distinct:new Set(entry.records.map(r=>r.sha256)).size,directions:8,sourceRegistration:`${dir}/worker-crouch-fire.registration.json`,review:'assets/previews/illustrated-sprites/family-actions/worker-crouch-fire/worker-crouch-fire-review.png'}));