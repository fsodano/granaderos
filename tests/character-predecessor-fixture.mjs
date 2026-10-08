import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readGlb as readPublishedGlb} from './character-bank-fixture.mjs';

// Verify the active top layer before checking a frozen predecessor recipe.
// The Python helper replaces linked body entries before writing originals.
const folder=mkdtempSync(join(tmpdir(),'granaderos-predecessor-test-'));
process.on('exit',()=>rmSync(folder,{recursive:true,force:true}));
const snapshot=JSON.parse(execFileSync('python3',['-c',String.raw`
from pathlib import Path
import json,sys
root=Path.cwd();sys.path.insert(0,str(root/'tools/characters-3d'))
from apparel_surface_context import create_predecessor_snapshot
print(json.dumps(create_predecessor_snapshot(root,Path(sys.argv[1]),link_assets=True)))
`,join(folder,'root')],{cwd:new URL('..',import.meta.url),encoding:'utf8',maxBuffer:1024*1024}));
export const publicRoot=pathToFileURL(join(snapshot.root,'web/public')+'/');
export const assets=new URL('models/characters/',publicRoot);
export const manifest=JSON.parse(readFileSync(new URL('manifest.json',assets),'utf8'));
export const apparelPredecessorReceipt=snapshot;
export const readGlb=url=>readPublishedGlb(url,publicRoot);
