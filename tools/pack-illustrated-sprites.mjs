// Pack authored raster frames. This removes the export key colour, crops known
// grid cells, and applies a single source scale; it does not synthesize animation.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import sharp from '../web/node_modules/sharp/lib/index.js';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function removeExportKey(data,width,key='magenta'){
 if(key==='white')return removeWhiteBackdrop(data,width);
 if(key!=='magenta')throw Error(`Unknown export key: ${key}`);
 const result=Buffer.from(data);
 for(let i=0;i<result.length;i+=4){
  const [r,g,b]=result.subarray(i,i+3);
  // The approved art has no magenta. Include antialiased key pixels to avoid
  // leaving a coloured fringe; do not erase red uniforms or brown skin.
  if(r>100&&b>100&&r>g*1.65&&b>g*1.65&&Math.abs(r-b)<100){
   result[i]=result[i+1]=result[i+2]=result[i+3]=0;
  }else if(r>130&&b>130&&r-g>8&&b-g>8&&Math.abs(r-b)<35){
   // Pale smoke and antialiased edges can contain the magenta backdrop.
   // Remove that known key contribution instead of leaving pink particles.
   // The authored palette has no pale violet material.
   const spill=Math.min(r-g,b-g),alpha=1-spill/255;
   result[i]=Math.min(255,Math.round((r-spill)/alpha));
   result[i+1]=Math.min(255,Math.round(g/alpha));
   result[i+2]=Math.min(255,Math.round((b-spill)/alpha));
   result[i+3]=Math.round(result[i+3]*alpha);
  }
 }
 // Dark outlines can also contain the export colour. Neutralize only a
 // near-magenta edge beside an already transparent pixel; interior cloth
 // colours do not take part in this edge cleanup.
 if(Number.isInteger(width)&&width>0){
  const count=result.length/4;
  for(let p=0;p<count;p++){
   const i=p*4,[r,g,b,a]=result.subarray(i,i+4);
   if(!a||Math.abs(r-b)>=18||r-g<=12||b-g<=12)continue;
   const x=p%width;
   const neighbours=[p-width,p+width,...(x>0?[p-1]:[]),...(x<width-1?[p+1]:[])];
   if(!neighbours.some(n=>n>=0&&n<count&&result[n*4+3]===0))continue;
   const spill=Math.min(r-g,b-g),alpha=1-spill/255;
   result[i]=Math.min(255,Math.round((r-spill)/alpha));
   result[i+1]=Math.min(255,Math.round(g/alpha));
   result[i+2]=Math.min(255,Math.round((b-spill)/alpha));
   result[i+3]=Math.round(a*alpha);
  }
 }
 return result;
}

// Some authoring exports use neutral white. Remove only the backdrop connected
// to the canvas border, so enclosed ivory cloth and white highlights survive.
function removeWhiteBackdrop(data,width){
 if(!Number.isInteger(width)||width<1||data.length%(width*4))throw Error('White export extraction requires the source width');
 const result=Buffer.from(data),count=data.length/4,height=count/width;
 const seen=new Uint8Array(count),queue=new Uint32Array(count);let end=0;
 const add=p=>{
  if(seen[p])return;seen[p]=1;
  const i=p*4,r=data[i],g=data[i+1],b=data[i+2];
  if(data[i+3]===0||(Math.min(r,g,b)>=242&&Math.max(r,g,b)-Math.min(r,g,b)<=12))queue[end++]=p;
 };
 for(let x=0;x<width;x++){add(x);add((height-1)*width+x);}
 for(let y=0;y<height;y++){add(y*width);add(y*width+width-1);}
 for(let start=0;start<end;start++){
  const p=queue[start],x=p%width;result.fill(0,p*4,p*4+4);
  if(p>=width)add(p-width);if(p+width<count)add(p+width);
  if(x>0)add(p-1);if(x<width-1)add(p+1);
 }
 // A white export can blend its edge into a dark outline. Recover partial
 // alpha from the adjacent dark contour, instead of retaining a white halo.
 const backdrop=new Uint8Array(count);
 for(let p=0;p<count;p++)if(!result[p*4+3])backdrop[p]=1;
 for(let p=0;p<count;p++){
  const i=p*4,r=data[i],g=data[i+1],b=data[i+2],x=p%width,y=Math.floor(p/width);
  if(backdrop[p]||Math.min(r,g,b)<110||Math.max(r,g,b)-Math.min(r,g,b)>50)continue;
  if(![p-width,p+width,...(x>0?[p-1]:[]),...(x<width-1?[p+1]:[])].some(n=>n>=0&&n<count&&backdrop[n]))continue;
  let baseSum=Infinity;
  for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
   const nx=x+dx,ny=y+dy;if(nx<0||nx>=width||ny<0||ny>=height)continue;
   const n=ny*width+nx,k=n*4;if(backdrop[n]||Math.max(data[k],data[k+1],data[k+2])>130)continue;
   baseSum=Math.min(baseSum,data[k]+data[k+1]+data[k+2]);
  }
  if(!Number.isFinite(baseSum))continue;
  const alpha=(765-r-g-b)/(765-baseSum);
  if(alpha<=0||alpha>=1)continue;
  for(let c=0;c<3;c++)result[i+c]=Math.max(0,Math.min(255,Math.round((data[i+c]-255*(1-alpha))/alpha)));
  result[i+3]=Math.round(data[i+3]*alpha);
 }
 return result;
}

export function boundsOf(data,width,height){
 let left=width,top=height,right=0,bottom=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>0){
  left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);
 }
 return right>left&&bottom>top?[left,top,right,bottom]:null;
}

// Read the empty gutters, not assumed canvas fractions: image authoring can
// retain all poses while adding a wider outer margin. Reject merged gutters.
export function sheetRectangles(data,width,height,columns,rows){
 const spans=(counts,expected,label)=>{
  const groups=[];let start=-1;
  for(let i=0;i<=counts.length;i++){
   if(counts[i]>0&&start<0)start=i;
   if(!(counts[i]>0)&&start>=0){groups.push([start,i]);start=-1;}
  }
  // Merge narrow gaps within a gun/boot outline, but never guess a missing
  // large gutter or silently accept a sheet with the wrong number of poses.
  const joined=[];
  for(const span of groups){
   const last=joined.at(-1);
   if(last&&span[0]-last[1]<=4)last[1]=span[1];else joined.push([...span]);
  }
  if(joined.length!==expected)throw Error(`Expected ${expected} ${label}, found ${joined.length}`);
  return joined;
 };
 const ys=Array(height).fill(0);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3])ys[y]++;
 const rowSpans=spans(ys,rows,'rows'),result=[];
 for(const [row,[y1,y2]] of rowSpans.entries()){
  const xs=Array(width).fill(0);
  for(let y=y1;y<y2;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3])xs[x]++;
  const columnsFound=spans(xs,columns,`columns in row ${row}`);
  for(const [col,[x1,x2]] of columnsFound.entries()){
   if(x1<2||y1<2||x2>width-2||y2>height-2)throw Error('Source art touches canvas edge');
   result.push({row,col,rect:[x1-2,y1-2,x2-x1+4,y2-y1+4]});
  }
 }
 return result;
}

export async function packIllustratedSources({manifestPath='assets/source/illustrated-sprites/sources.json',destination='assets/previews/illustrated-sprites/packed'}={}){
 const sourceManifest=JSON.parse(await readFile(resolve(ROOT,manifestPath),'utf8'));
 const atlases={};
 for(const job of sourceManifest.sheets){
  const input=await readFile(resolve(ROOT,job.source));
  const {data,info}=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const keyed=removeExportKey(data,info.width,job.exportKey);
  const clean=await sharp(keyed,{raw:{width:info.width,height:info.height,channels:4}}).png().toBuffer();
  const cells=[];
  for(const slot of job.slots){
   const left=slot.rect?.[0]??Math.round(slot.col*info.width/job.columns),top=slot.rect?.[1]??Math.round(slot.row*info.height/job.rows);
   const width=slot.rect?.[2]??Math.round((slot.col+1)*info.width/job.columns)-left;
   const height=slot.rect?.[3]??Math.round((slot.row+1)*info.height/job.rows)-top;
   const pixels=await sharp(clean).extract({left,top,width,height}).raw().toBuffer();
   const bounds=boundsOf(pixels,width,height);
   if(!bounds||bounds[0]===0||bounds[1]===0||bounds[2]===width||bounds[3]===height)throw Error(`${job.source}: empty or clipped cell ${slot.col},${slot.row}`);
   const crop=await sharp(pixels,{raw:{width,height,channels:4}}).extract({left:bounds[0],top:bounds[1],width:bounds[2]-bounds[0],height:bounds[3]-bounds[1]}).png().toBuffer();
   // Explicit source anchors are reviewed per cell. A foot-based default is
   // allowed only for stills; animation requires authored stable pivots.
   let sourceAnchor=slot.anchor;
   if(!sourceAnchor){
    if(job.frames!==1)throw Error(`${job.source}: animated frame needs an explicit anchor`);
    let footLeft=width,footRight=0;
    for(let y=Math.floor(bounds[3]-(bounds[3]-bounds[1])*.08);y<bounds[3];y++)for(let x=0;x<width;x++)if(pixels[(y*width+x)*4+3]){footLeft=Math.min(footLeft,x);footRight=Math.max(footRight,x+1);}
    sourceAnchor=[(footLeft+footRight)/2,bounds[3]];
   }
   // A reviewed per-slot override compensates for authoring scale drift;
   // the common map cell and anchor remain fixed for the whole sequence.
   const scale=slot.scale??job.scale;
   if(!Number.isFinite(scale)||scale<=0)throw Error(`${job.source}: invalid source scale`);
   const cropWidth=Math.round((bounds[2]-bounds[0])*scale),cropHeight=Math.round((bounds[3]-bounds[1])*scale);
   const x=Math.round(job.anchor[0]-(sourceAnchor[0]-bounds[0])*scale);
   const y=Math.round(job.anchor[1]-(sourceAnchor[1]-bounds[1])*scale);
   if(x<1||y<1||x+cropWidth>=job.cell||y+cropHeight>=job.cell)throw Error(`${job.source}: packed frame clips ${slot.direction}:${slot.frame}`);
   const image=await sharp(crop).resize(cropWidth,cropHeight,{kernel:'nearest'}).png().toBuffer();
   const frame=await sharp({create:{width:job.cell,height:job.cell,channels:4,background:'#00000000'}}).composite([{input:image,left:x,top:y}]).png().toBuffer();
   const dir=sourceManifest.directions.indexOf(slot.direction);
   if(dir<0||slot.frame<0||slot.frame>=job.frames)throw Error('Invalid direction or phase');
   cells.push({input:frame,left:(job.frames===1?dir:slot.frame)*job.cell,top:job.frames===1?0:dir*job.cell});
   const entry=atlases[job.name]??={cell:job.cell,anchor:job.anchor,logicalCell:job.logicalCell,framesPerDirection:job.frames,fps:job.fps,sources:[],records:[],layers:[]};
   if(entry.cell!==job.cell||entry.logicalCell!==job.logicalCell||entry.framesPerDirection!==job.frames||entry.fps!==job.fps||entry.anchor.join()!==job.anchor.join())throw Error(`Inconsistent source layouts for ${job.name}`);
   if(entry.records.some(record=>record.direction===slot.direction&&record.frame===slot.frame))throw Error(`Duplicate frame ${job.name}:${slot.direction}:${slot.frame}`);
   entry.records.push({direction:slot.direction,frame:slot.frame,source:job.source,sourceScale:scale,sourceAnchor,sourceBounds:bounds,bounds:[x,y,x+cropWidth,y+cropHeight],sha256:sha(frame)});
  }
  const entry=atlases[job.name];
  entry.layers.push(...cells);
  entry.sources.push({file:job.source,sha256:sha(input),scale:job.scale,...(job.exportKey?{exportKey:job.exportKey}:{})});
 }
 const output=resolve(ROOT,destination);
 await mkdir(output,{recursive:true});
 const manifest={version:1,style:'illustrated-pixel-art',status:'staging',directions:sourceManifest.directions,atlases:{}};
 for(const [name,entry] of Object.entries(atlases)){
  if(entry.records.length!==8*entry.framesPerDirection)throw Error(`Incomplete directions: ${name}`);
  const width=entry.cell*(entry.framesPerDirection===1?8:entry.framesPerDirection),height=entry.cell*(entry.framesPerDirection===1?1:8);
  const data=await sharp({create:{width,height,channels:4,background:'#00000000'}}).composite(entry.layers).png().toBuffer();
  const {layers,...record}=entry;
  manifest.atlases[name]={...record,file:`${name}.png`,size:[width,height],sha256:sha(data)};
  await writeFile(resolve(output,`${name}.png`),data);
 }
 await writeFile(resolve(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 return manifest;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=await packIllustratedSources();
 console.log(`Packed ${Object.keys(result.atlases).length} illustrated atlases into staging; runtime not published.`);
}
