import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile,readdir} from 'node:fs/promises';
import {join,relative} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';

const omitted=new Set(['node_modules','dist','.next','.vinext','.vite','.git']);
// Vinext creates this declaration during a clean build. It is output, not a
// game input; including it makes the first build identify two source versions.
const generatedFiles=new Set(['web/next-env.d.ts']);
async function sourceFiles(root,directory){
 const files=[];
 for(const entry of await readdir(directory,{withFileTypes:true})){
  if(omitted.has(entry.name)||entry.name.endsWith('.tsbuildinfo')||entry.name==='.DS_Store')continue;
  const path=join(directory,entry.name);
  if(entry.isDirectory())files.push(...await sourceFiles(root,path));
  else if(entry.isFile()){
   const name=relative(root,path).replaceAll('\\','/');
   if(!generatedFiles.has(name))files.push(name);
  }
 }
 return files;
}
// The source digest identifies dirty candidates too. A commit label alone
// would incorrectly identify an uncommitted build as its base revision.
export async function buildIdentity(root){
 const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
 const paths=['package.json',...(await Promise.all(['game','web','tools'].map(dir=>sourceFiles(root,join(root,dir))))).flat()].sort();
 const hash=createHash('sha256');
 for(const path of paths){hash.update(path);hash.update('\0');hash.update(await readFile(join(root,path)));hash.update('\0');}
 const source=hash.digest('hex');let revision=null;
 try{revision=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{}
 return {version:pkg.version,id:source.slice(0,12),source,revision};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(await buildIdentity(fileURLToPath(new URL('..',import.meta.url))),null,2));
