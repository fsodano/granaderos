// Build the browser-only game and stage a verified static export for hosting.
import {verifyTacticalAssets} from './verify-tactical-assets.mjs';
import {MERCENARY_ADDITIONS} from '../game/mercenaries.js';
import {spawnSync} from 'node:child_process';
import {cp,readFile,readdir,rm,stat} from 'node:fs/promises';
import {resolve,dirname,relative,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=resolve(root,'web/dist/client'),destination=resolve(root,'dist');
if(!process.argv.includes('--stage-only')){
  const build=spawnSync(process.platform==='win32'?'npm.cmd':'npm',['--prefix',resolve(root,'web'),'run','build'],{stdio:'inherit',shell:process.platform==='win32'});
  if(build.error)throw build.error;
  if(build.status!==0)process.exit(build.status??1);
}
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
const sourceFiles=await filesAt(source);
if(!(await stat(resolve(source,'index.html'))).isFile())throw Error('Static export has no index.html.');
const known=new Set(sourceFiles.map(file=>relative(source,file).replaceAll('\\','/')));
const checked=new Set();
function requireAsset(reference,from='index.html'){
  if(!reference||/^(?:[a-z]+:|\/\/|#)/i.test(reference))return;
  const url=new URL(reference,`https://granaderos.invalid/${from}`);
  const name=decodeURIComponent(url.pathname).replace(/^\//,'');
  if(!name)return;
  // Internal page links resolve to their static HTML; asset URLs must be exact.
  const match=known.has(name)?name:known.has(`${name}/index.html`)?`${name}/index.html`:null;
  if(!match)throw Error(`Missing exported asset: ${reference} (referenced by ${from})`);
  checked.add(match);
}
for(const file of sourceFiles){
  const name=relative(source,file).replaceAll('\\','/');
  if(extname(file)==='.html'){
    const html=await readFile(file,'utf8');
    for(const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g))requireAsset(match[1].replaceAll('&amp;','&'),name);
  }
  if(extname(file)==='.js'){
    const javascript=await readFile(file,'utf8');
    for(const match of javascript.matchAll(/[\"'`](\/art\/[^\"'`$?#]+)[\"'`]/g))requireAsset(match[1],name);
  }
  if(extname(file)==='.css'){
    const css=await readFile(file,'utf8');
    for(const match of css.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/g))requireAsset(match[1],name);
  }
}
for(const id of [103,104])requireAsset(`/art/portrait-${id}.png`,'foreign volunteer portrait');
for(const id of ['avatar-woman-scout','avatar-woman-civilian','avatar-man-gaucho','avatar-man-soldier'])requireAsset(`/art/${id}.webp`,'custom avatar');
// Dynamic portrait and action-frame URLs are not visible to literal URL scans.
for(const id of [0,1,2,3,4,5,6,7,8,9,10,11,57,100,101,102,105,106])requireAsset(`/art/portrait-${id}.webp`,'roster');
for(const {id} of MERCENARY_ADDITIONS)requireAsset(`/art/portrait-${id}.webp`,'paid mercenary roster');
for(let id=1800;id<=1813;id++)requireAsset(`/art/weapon-${id}.png`,'armory');
for(const direction of ['se','sw'])for(const pose of ['idle','fire','reload','strike'])requireAsset(`/art/granadero-${direction}-${pose}.png`,'tactical sprites');
const artwork=JSON.parse(await readFile(resolve(source,'art/manifest.json'),'utf8'));
for(const asset of artwork.assets){
  requireAsset(`/art/${asset.path}`,'art manifest');
  const actual=createHash('sha256').update(await readFile(resolve(source,'art',asset.path))).digest('hex');
  if(actual!==asset.sha256)throw Error(`Artwork checksum mismatch: ${asset.path}`);
}
const manifest=JSON.parse(await readFile(resolve(source,'.vite/manifest.json'),'utf8'));
for(const [key,entry] of Object.entries(manifest)){
  if(entry.file)requireAsset(`/${entry.file}`,`manifest:${key}`);
  for(const file of [...(entry.css||[]),...(entry.assets||[])])requireAsset(`/${file}`,`manifest:${key}`);
  for(const dependency of [...(entry.imports||[]),...(entry.dynamicImports||[])]){
    if(!manifest[dependency])throw Error(`Missing manifest dependency: ${dependency} from ${key}`);
  }
}
for(const faction of ["granadero","royalist"])for(const action of ["idle","walk"])requireAsset(`/art/${faction}-${action}-atlas.png`,"infantry animation");
for(const action of ["idle","walk"])requireAsset(`/art/cavalry-${action}-atlas.png`,"cavalry animation");
requireAsset("/art/cavalry-animation.json","cavalry animation metadata");
for(const faction of ["granadero","royalist"])for(const stance of ["crouch","prone"])for(const action of ["idle","walk"])requireAsset(`/art/${faction}-${stance}-${action}-atlas.png`,"low stance animation");
requireAsset("/art/stance-animation.json","stance animation metadata");
await verifyTacticalAssets(source,requireAsset);
await rm(destination,{recursive:true,force:true});
await cp(source,destination,{recursive:true});
for(const file of sourceFiles){
  const target=resolve(destination,relative(source,file));
  const digest=data=>createHash('sha256').update(data).digest('hex');
  if(digest(await readFile(file))!==digest(await readFile(target)))throw Error(`Staged file differs: ${target}`);
}
console.log(`Static export verified: ${sourceFiles.length} files, ${checked.size} asset references, staged in dist/.`);
