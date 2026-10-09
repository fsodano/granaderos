import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readGlb as readPublishedGlb} from './character-bank-fixture.mjs';

// Verify each active layer before exposing a historical recipe output. The
// correction is removed only after its native proof passes; frozen recipes
// then replay exactly. Linked assets are replaced before private writes.
const folders=[];
process.on('exit',()=>{for(const folder of folders)rmSync(folder,{recursive:true,force:true});});
function view(stage){
 const folder=mkdtempSync(join(tmpdir(),'granaderos-predecessor-test-'));folders.push(folder);
 const receipt=JSON.parse(execFileSync('python3',['-c',String.raw`
from pathlib import Path
import json,sys
root=Path.cwd();sys.path.insert(0,str(root/'tools/characters-3d'))
from coarse_garment_context import create_historical_snapshot
print(json.dumps(create_historical_snapshot(root,Path(sys.argv[1]),stage=sys.argv[2],link_assets=True)))
`,join(folder,'root'),stage],{cwd:new URL('..',import.meta.url),encoding:'utf8',maxBuffer:1024*1024}));
 const publicRoot=pathToFileURL(join(receipt.root,'web/public')+'/'),assets=new URL('models/characters/',publicRoot);
 return{receipt,publicRoot,assets,manifest:JSON.parse(readFileSync(new URL('manifest.json',assets),'utf8')),readGlb:url=>readPublishedGlb(url,publicRoot)};
}
const folds=view('folds');
export const publicRoot=folds.publicRoot;
export const assets=folds.assets;
export const manifest=folds.manifest;
export const apparelPredecessorReceipt=folds.receipt;
export const readGlb=folds.readGlb;
let apparel;
export function historicalApparelView(){return apparel??=view('apparel');}
