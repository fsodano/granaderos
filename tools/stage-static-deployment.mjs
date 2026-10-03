import {cp,mkdir,readFile,readdir,rename,rm,rmdir,writeFile} from 'node:fs/promises';
import {resolve,relative,dirname} from 'node:path';
import {createHash} from 'node:crypto';

async function filesAt(directory){
 const files=[];
 for(const entry of await readdir(directory,{withFileTypes:true})){
  const path=resolve(directory,entry.name);
  if(entry.isDirectory())files.push(...await filesAt(path));
  else if(entry.isFile())files.push(path);
  else throw Error(`Unexpected non-file export entry: ${path}`);
 }
 return files;
}

// Vinext's assetPrefix is both a URL prefix and an output directory. A Pages
// project mounts the artifact at that prefix, so its files must be flat.
export async function stageStaticDeployment(source,destination,basePath=''){
 await rm(destination,{recursive:true,force:true});
 await cp(source,destination,{recursive:true});
 for(const file of await filesAt(source)){
  const target=resolve(destination,relative(source,file));
  const digest=data=>createHash('sha256').update(data).digest('hex');
  if(digest(await readFile(file))!==digest(await readFile(target)))throw Error(`Staged file differs: ${target}`);
 }
 if(basePath){
  const prefix=basePath.slice(1),assetDirectory=resolve(destination,prefix,'_next');
  await rename(assetDirectory,resolve(destination,'_next'));
  let empty=dirname(assetDirectory);
  while(empty!==resolve(destination)){await rmdir(empty);empty=dirname(empty);}
  const flatten=path=>typeof path==='string'&&path.startsWith(`${prefix}/_next/`)?path.slice(prefix.length+1):path;
  const manifestPath=resolve(destination,'.vite/manifest.json');
  const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
  for(const entry of Object.values(manifest)){
   if(entry.file)entry.file=flatten(entry.file);
   for(const field of ['css','assets'])if(entry[field])entry[field]=entry[field].map(flatten);
  }
  await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
  const clientPath=resolve(destination,'vinext-client-entry-manifest.json');
  const client=JSON.parse(await readFile(clientPath,'utf8'));
  client.appBrowserEntry=flatten(client.appBrowserEntry);
  await writeFile(clientPath,JSON.stringify(client,null,2)+'\n');
  // Prerendering with trailingSlash redirects the route requests before they
  // can be exported. Keep its flat output and add static directory endpoints.
  for(const route of ['editor','story']){
   await mkdir(resolve(destination,route),{recursive:true});
   await cp(resolve(destination,`${route}.html`),resolve(destination,route,'index.html'));
   try{await cp(resolve(destination,`${route}.rsc`),resolve(destination,route,'index.rsc'));}
   catch(error){if(error.code!=='ENOENT')throw error;}
  }
 }
 await writeFile(resolve(destination,'.nojekyll'),'');
}
