import {cp,mkdir,rm} from 'node:fs/promises';
const target=new URL('./dist/',import.meta.url);
await rm(target,{recursive:true,force:true});
await mkdir(target,{recursive:true});
for(const name of ['index.html','src'])await cp(new URL(name,import.meta.url),new URL(name,target),{recursive:true});
await cp(new URL('public/assets',import.meta.url),new URL('assets',target),{recursive:true});
await mkdir(new URL('vendor/three',target),{recursive:true});
for(const name of ['build','examples/jsm'])await cp(new URL(`node_modules/three/${name}`,import.meta.url),new URL(`vendor/three/${name}`,target),{recursive:true});
console.log('Standalone playground built in dist/.');
