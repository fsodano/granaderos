import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {rasterizeSvgGroup} from '../web/lib/rasterize-svg.ts';

function browser(t,{pngDecode=async()=>{}}={}){
 const created=[],revoked=[],reads=[];
 const replace=(key,value)=>{const old=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});t.after(()=>{if(old)Object.defineProperty(globalThis,key,old);else delete globalThis[key];});};
 replace('window',{devicePixelRatio:1,requestIdleCallback:callback=>queueMicrotask(callback)});
 replace('FileReader',class{readAsDataURL(blob){reads.push(blob.type);this.result='data:image/svg+xml;base64,PHN2Zy8+';queueMicrotask(()=>this.onload());}});
 replace('Image',class{src='';async decode(){if(this.src.startsWith('blob:'))await pngDecode();}});
 replace('XMLSerializer',class{serializeToString(){return '<svg xmlns="http://www.w3.org/2000/svg"/>';}});
 const element=()=>({setAttribute(){},appendChild(){},querySelectorAll(){return [];}});
 replace('document',{createElementNS:element,createElement(){return {width:0,height:0,getContext(){return {drawImage(){}};},toBlob(callback){callback(new Blob(['pixels'],{type:'image/png'}));}};}});
 t.mock.method(URL,'createObjectURL',blob=>{assert.equal(blob.type,'image/png');const href=`blob:scenery-${created.length}`;created.push(href);return href;});
 t.mock.method(URL,'revokeObjectURL',href=>revoked.push(href));
 const source={isConnected:true,ownerSVGElement:{querySelector(){return null;}},getBBox(){return {x:0,y:0,width:20,height:30};},cloneNode(){return {...element(),outerHTML:'<g/>'};}};
 return {source,created,revoked,reads};
}

test('raster PNG stays binary and its owner can release it exactly once',async t=>{
 const b=browser(t),picture=await rasterizeSvgGroup(b.source);
 assert.ok(picture);assert.equal(picture.image.href,b.created[0]);
 assert.deepEqual(b.reads,['image/svg+xml'],'PNG must not create a second base64 string');
 assert.deepEqual(b.revoked,[],'the displayed picture keeps its URL');
 picture.release();picture.release();assert.deepEqual(b.revoked,b.created);
});

test('cancellation during PNG decoding releases the undelivered picture',async t=>{
 const controller=new AbortController(),b=browser(t,{pngDecode:async()=>controller.abort()});
 assert.equal(await rasterizeSvgGroup(b.source,controller.signal),null);
 assert.equal(b.created.length,1);assert.deepEqual(b.revoked,b.created);
});

test('a failed PNG decode releases its URL and the queue can render again',async t=>{
 let attempts=0;const b=browser(t,{pngDecode:async()=>{if(attempts++===0)throw Error('decode failed');}});
 await assert.rejects(rasterizeSvgGroup(b.source),/decode failed/);
 assert.deepEqual(b.revoked,[b.created[0]]);
 const picture=await rasterizeSvgGroup(b.source);assert.ok(picture);picture.release();assert.deepEqual(b.revoked,b.created);
});

test('an already cancelled raster request does not allocate a PNG',async t=>{
 const b=browser(t),controller=new AbortController();controller.abort();
 assert.equal(await rasterizeSvgGroup(b.source,controller.signal),null);assert.deepEqual(b.created,[]);
});

test('new scenery layers read their bounds together before the first cached image can change layout',async t=>{
 const b=browser(t),events=[];
 const layer=id=>({...b.source,getBBox(){events.push(`bounds-${id}`);return {x:id*10,y:2,width:20,height:30};},cloneNode(){events.push(`clone-${id}`);return b.source.cloneNode();}});
 const first=rasterizeSvgGroup(layer(1)),second=rasterizeSvgGroup(layer(2));
 const images=await Promise.all([first,second]);
 assert.deepEqual(events,['bounds-1','bounds-2','clone-1','clone-2']);
 assert.equal(images[0].image.x,7);assert.equal(images[1].image.x,17);
 for(const image of images)image.release();assert.deepEqual(b.revoked,b.created);
});

test('scenery publishes one prepared batch and releases a layer cancelled while waiting for that batch',async t=>{
 let releaseDecode,secondReady;const gate=new Promise(resolve=>{releaseDecode=resolve;}),started=new Promise(resolve=>{secondReady=resolve;});
 let decodes=0;const b=browser(t,{pngDecode:async()=>{if(++decodes===2){secondReady();await gate;}}}),controller=new AbortController(),published=[];
 const first=rasterizeSvgGroup(b.source,controller.signal).then(image=>{published.push('first');return image;});
 const second=rasterizeSvgGroup({...b.source}).then(image=>{published.push('second');return image;});
 await started;assert.deepEqual(published,[],'one finished image must not cause a paint of the remaining vector scene');
 controller.abort();releaseDecode();const images=await Promise.all([first,second]);
 assert.equal(images[0],null);assert.ok(images[1]);assert.deepEqual(published,['first','second']);
 assert.deepEqual(b.revoked,[b.created[0]]);images[1].release();assert.deepEqual(b.revoked,b.created);
});
