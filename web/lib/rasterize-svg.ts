import {sitePath} from './site-path.js';
// Static SVG scenery is expensive to repaint beside moving actors. Rasterize
// only a noninteractive depth layer, with its exact textures and SVG filters.
const assets=new Map<string,Promise<string>>();
type RasterProfileStamp={epoch:number;at:number};
type RasterProfileEntry={stage:string;at:number;ms:number;[key:string]:number|string};
let profileEpoch=0,profileStarted:number|null=null;
let profileStages:Record<string,{count:number;totalMs:number;maxMs:number}>={},profileEntries:RasterProfileEntry[]=[];
/** Opt-in diagnostics. Async stages report elapsed wait, not main-thread CPU. */
export function startRasterProfile(){profileEpoch++;profileStarted=performance.now();profileStages={};profileEntries=[];}
export function readRasterProfile({stop=false}:{stop?:boolean}={}){
 const result={elapsedMs:profileStarted===null?0:performance.now()-profileStarted,stages:Object.fromEntries(Object.entries(profileStages).map(([stage,value])=>[stage,{count:value.count,totalMs:Math.round(value.totalMs*100)/100,maxMs:Math.round(value.maxMs*100)/100}])),entries:profileEntries.slice()};
 if(stop)profileStarted=null;return result;
}
const profileStamp=():RasterProfileStamp|null=>profileStarted===null?null:{epoch:profileEpoch,at:performance.now()};
function profileStage(stage:string,start:RasterProfileStamp|null,details:Record<string,number>={}){
 if(!start||profileStarted===null||start.epoch!==profileEpoch)return;
 const ms=performance.now()-start.at,summary=profileStages[stage]??={count:0,totalMs:0,maxMs:0};summary.count++;summary.totalMs+=ms;summary.maxMs=Math.max(summary.maxMs,ms);
 if(profileEntries.length<300)profileEntries.push({stage,at:Math.round((start.at-profileStarted)*100)/100,ms:Math.round(ms*100)/100,...details});
}
type LayerBounds={x:number;y:number;width:number;height:number};
type BoundsRequest={source:SVGGElement;signal?:AbortSignal;bounds:LayerBounds|null};
const pendingBounds=new Set<BoundsRequest>();
function readPendingBounds(){
 // Read all new layers before replacing any of them. Reading getBBox after
 // each vector-to-image commit repeatedly lays out the whole remaining map.
 const requests=[...pendingBounds];pendingBounds.clear();const timing=profileStamp();
 for(const request of requests){
  if(request.signal?.aborted||!request.source.isConnected)continue;
  try{const {x,y,width,height}=request.source.getBBox();request.bounds={x,y,width,height};}catch{}
 }
 if(requests.length)profileStage('bounds-sync',timing,{layers:requests.length});
}
// A room reveal can replace many layers together. Spread image preparation
// across idle slots instead of drawing dozens of canvases in one frame.
const rasterJobs:Array<{run:()=>Promise<void>;cancelled:()=>boolean}>=[];
const rasterPublications:Array<()=>void>=[];
let rasterBusy=false,pendingStaticJobs=0;
const publishRasterBatch=()=>{for(const publish of rasterPublications.splice(0))publish();};
function pumpRasterJobs(){
 if(rasterBusy)return;
 if(!rasterJobs.length){
  // Publish prepared scenery together. Replacing one vector layer at a time
  // repaints all remaining filtered vectors after every single PNG (200+ times).
  publishRasterBatch();
  return;
 }
 rasterBusy=true;
 const start=()=>{void rasterJobs.shift()!.run();};
 if(rasterJobs[0].cancelled()){start();return;}
 if('requestIdleCallback' in window)window.requestIdleCallback(start,{timeout:200});
 else requestAnimationFrame(()=>setTimeout(start,0));
}
function rasterJob<T>(work:()=>Promise<T>,signal?:AbortSignal,publishTogether=false):Promise<T>{
 if(publishTogether)pendingStaticJobs++;
 return new Promise((resolve,reject)=>{rasterJobs.push({cancelled:()=>Boolean(signal?.aborted),run:async()=>{try{const result=await work();if(publishTogether)rasterPublications.push(()=>resolve(result));else resolve(result);}catch(error){reject(error);}finally{
  if(publishTogether){pendingStaticJobs--;if(!pendingStaticJobs||rasterPublications.length>=256)publishRasterBatch();}
  rasterBusy=false;pumpRasterJobs();
 }}});pumpRasterJobs();});
}
function blobData(blob:Blob):Promise<string>{
 return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(blob);});
}
function imageData(url:string){
 let pending=assets.get(url);
 if(!pending){
  pending=fetch(sitePath(url)).then(response=>{if(!response.ok)throw Error(`Scenery texture: ${response.status}`);return response.blob();}).then(blobData);
  assets.set(url,pending);pending.catch(()=>assets.delete(url));
 }
 return pending;
}
const tintedAssets=new Map<string,Promise<string>>();
/** Share a small shaded texture instead of filtering every tree every frame. */
export function shadedSceneryImage(href:string,brightness:number){
 const key=`${href}:${brightness}`;
 const retained=tintedAssets.get(key);
 if(retained){tintedAssets.delete(key);tintedAssets.set(key,retained);return retained;}
 const prepared=rasterJob(async()=>{
  const image=new Image();image.src=await imageData(href);await image.decode();
  const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
  const context=canvas.getContext('2d');if(!context||!('filter' in context))throw Error('Canvas brightness unavailable');
  context.filter=`brightness(${brightness})`;context.drawImage(image,0,0);
  const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('Scenery conversion failed');
  const result=await blobData(blob),decoded=new Image();decoded.src=result;await decoded.decode();return result;
 });
 tintedAssets.set(key,prepared);
 // Components keep their displayed image; only the reusable cache is bounded.
 if(tintedAssets.size>32)tintedAssets.delete(tintedAssets.keys().next().value!);
 prepared.catch(()=>{if(tintedAssets.get(key)===prepared)tintedAssets.delete(key);});
 return prepared;
}
type RasterImage={href:string;x:number;y:number;width:number;height:number;'data-raster-pixels':number};
export type RasterPicture={image:RasterImage;release:()=>void};
// Cache scenery at native screen density. Camera zoom magnifies those pixels;
// it must not rebuild every background texture while actors are moving.
// Actors, controls and effects keep their independent full-resolution drawing.
export const rasterDensity=()=>Math.min(3,Math.max(1,typeof window==='undefined'?1:window.devicePixelRatio||1));
async function drawPreparedSvg(svg:SVGSVGElement,bounds:{x:number;y:number;width:number;height:number},signal?:AbortSignal):Promise<RasterPicture|null>{
 if(signal?.aborted)return null;
 const {x,y,width,height}=bounds,scale=Math.min(rasterDensity(),Math.sqrt(16_000_000/(width*height)));
 svg.setAttribute('width',String(Math.ceil(width*scale)));svg.setAttribute('height',String(Math.ceil(height*scale)));
 let timing=profileStamp();const sourceBlob=new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'});profileStage('serialize-svg-sync',timing,{width,height,bytes:sourceBlob.size});
 timing=profileStamp();const url=await blobData(sourceBlob);profileStage('svg-data-url-async',timing);
 timing=profileStamp();const image=new Image();image.src=url;await image.decode();profileStage('svg-decode-async',timing);if(signal?.aborted)return null;
 const pixelWidth=Math.ceil(width*scale),pixelHeight=Math.ceil(height*scale);
 timing=profileStamp();
 const canvas=document.createElement('canvas');canvas.width=pixelWidth;canvas.height=pixelHeight;
 const context=canvas.getContext('2d');if(!context)return null;context.drawImage(image,0,0);profileStage('draw-image-sync',timing,{pixels:pixelWidth*pixelHeight});
 timing=profileStamp();const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/png'));profileStage('png-blob-async',timing);if(!blob)return null;
 // Keep the PNG binary. Converting large scenery layers to base64 creates
 // another full-size string and a FileReader task on the main thread.
 timing=profileStamp();const href=URL.createObjectURL(blob);profileStage('object-url-sync',timing,{bytes:blob.size});let released=false;
 const release=()=>{if(!released){released=true;URL.revokeObjectURL(href);}};
 try{
  timing=profileStamp();const decoded=new Image();decoded.src=href;await decoded.decode();profileStage('png-decode-async',timing);
  if(signal?.aborted){release();return null;}
  return {image:{href,x,y,width,height,'data-raster-pixels':pixelWidth*pixelHeight},release};
 }catch(error){release();throw error;}
}
export async function rasterizeSvgGroup(source:SVGGElement,signal?:AbortSignal){
 const request:BoundsRequest={source,signal,bounds:null};pendingBounds.add(request);
 const picture=await rasterJob(async()=>{
 readPendingBounds();
 if(signal?.aborted||!source.isConnected)return null;
 // Cloning and texture conversion remain queued one layer at a time.
 const owner=source.ownerSVGElement;if(!owner)return null;
 const bounds=request.bounds;
 if(!bounds?.width||!bounds.height)return null;
 const x=Math.floor(bounds.x)-3,y=Math.floor(bounds.y)-3,width=Math.ceil(bounds.x+bounds.width)-x+3,height=Math.ceil(bounds.y+bounds.height)-y+3;
 let timing=profileStamp();
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
 svg.setAttribute('xmlns',ns);svg.setAttribute('viewBox',`${x} ${y} ${width} ${height}`);
 const clone=source.cloneNode(true) as SVGGElement,defs=document.createElementNS(ns,'defs');svg.appendChild(defs);svg.appendChild(clone);
 // Include only referenced definitions; local wall textures are already in the
 // cloned group. Recursion handles patterns referencing other definitions.
 const included=new Set([...clone.querySelectorAll('[id]')].map(node=>node.id));
 let markup=clone.outerHTML;
 for(let pass=0;pass<8;pass++){
  const refs=[...markup.matchAll(/url\(["']?#([^\s)"']+)["']?\)/g)].map(match=>match[1]);let added='';
  for(const id of refs){if(included.has(id))continue;included.add(id);const node=owner.querySelector(`[id="${CSS.escape(id)}"]`);if(node){defs.appendChild(node.cloneNode(true));added+=node.outerHTML;}}
  if(!added)break;markup=added;
 }
 profileStage('clone-definitions-sync',timing,{width,height});
 timing=profileStamp();
 await Promise.all([...svg.querySelectorAll('image')].map(async image=>{const href=image.getAttribute('href')??image.getAttributeNS('http://www.w3.org/1999/xlink','href');if(href&&!href.startsWith('data:'))image.setAttribute('href',await imageData(href));}));
 profileStage('inline-textures-async',timing);
 if(signal?.aborted)return null;
 // The detached vector source can be released after this image is prepared.
 return drawPreparedSvg(svg,{x,y,width,height},signal);
 },signal,true);
 if(signal?.aborted){picture?.release();return null;}
 return picture;
}
