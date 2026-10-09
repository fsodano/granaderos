import {cp,mkdir,rm,readFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const target=new URL('./dist/',import.meta.url);
await rm(target,{recursive:true,force:true});
await mkdir(target,{recursive:true});
for(const name of ['index.html','src'])await cp(new URL(name,import.meta.url),new URL(name,target),{recursive:true});
await cp(new URL('public/assets',import.meta.url),new URL('assets',target),{recursive:true});
// Package the same single shared module served by the development route.
await mkdir(new URL('game',target),{recursive:true});
await cp(new URL('../../game/skin-palette.js',import.meta.url),new URL('game/skin-palette.js',target));
await mkdir(new URL('vendor/three',target),{recursive:true});
for(const name of ['build','examples/jsm'])await cp(new URL(`node_modules/three/${name}`,import.meta.url),new URL(`vendor/three/${name}`,target),{recursive:true});
// Copy only the models this lab can select. Production sources stay in one place.
const publicRoot=new URL('../../web/public/',import.meta.url);
const manifestPath='models/characters/manifest.json';
const manifest=JSON.parse(await readFile(new URL(manifestPath,publicRoot),'utf8'));
const models=new Set([
 ...Object.values(manifest.appearances).map(appearance=>appearance.lods.find(lod=>lod.lod===0).url.slice(1)),
 ...Object.values(manifest.animationLibraries).map(bank=>bank.url.slice(1)),manifest.equipment.url.slice(1)
]);
const files=new Set([manifestPath,...models]);
for(const path of models){
 const bytes=await readFile(new URL(path,publicRoot)),json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
 for(const image of json.images??[])if(image.uri){
  const texture=new URL(image.uri,new URL(path,publicRoot));
  if(!texture.href.startsWith(publicRoot.href))throw Error(`Texture outside production library: ${image.uri}`);
  files.add(texture.href.slice(publicRoot.href.length));
 }
}
for(const path of files){const destination=new URL(path,target);await mkdir(dirname(fileURLToPath(destination)),{recursive:true});await cp(new URL(path,publicRoot),destination);}
console.log('Standalone character laboratory built in dist/.');
