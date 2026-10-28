import {readFileSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {GLTFLoader} from '../web/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
const publicRoot=new URL('../web/public/',import.meta.url);
const libraryRoot=process.env.GRANADEROS_CHARACTER_LIBRARY?pathToFileURL(resolve(process.env.GRANADEROS_CHARACTER_LIBRARY)+sep):new URL('models/characters/',publicRoot);
export const manifest=JSON.parse(readFileSync(new URL('manifest.json',libraryRoot))),loads=new Map();
function load(url){
 if(loads.has(url))return loads.get(url);
 // Keep native geometry, skinning and tracks; CPU contact review does not need
 // the browser's image decoders. No source asset or material is modified.
 if(!url.startsWith('/models/characters/'))throw Error(`Unexpected character asset: ${url}`);
 const bytes=readFileSync(new URL(url.slice('/models/characters/'.length),libraryRoot)),length=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+length));
 delete doc.images;delete doc.textures;delete doc.samplers;doc.materials=(doc.materials??[]).map(material=>({name:material.name}));
 const json=Buffer.from(JSON.stringify(doc)),padded=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]),binary=bytes.subarray(20+length),header=Buffer.from(bytes.subarray(0,20));
 header.writeUInt32LE(20+padded.length+binary.length,8);header.writeUInt32LE(padded.length,12);
 const buffer=Buffer.concat([header,padded,binary]),promise=new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.length),'');loads.set(url,promise);return promise;
}
export async function publishedActor(id,lod=1){
 const appearance=manifest.appearances[id],bank=manifest.animationLibraries[appearance.animationLibrary];
 const [body,animation,equipment]=await Promise.all([load(appearance.lods[lod].url),load(bank.url),load(manifest.equipment.url)]);
 return {manifest,appearance,body,animation,equipment,clips:bank.clips,lod};
}
