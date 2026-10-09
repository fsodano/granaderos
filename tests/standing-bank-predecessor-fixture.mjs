import{execFileSync}from'node:child_process';
import{mkdtempSync,readFileSync,rmSync}from'node:fs';
import{tmpdir}from'node:os';
import{join}from'node:path';
import{pathToFileURL}from'node:url';
const views=new Map(),folders=[];
process.on('exit',()=>{for(const folder of folders)rmSync(folder,{recursive:true,force:true});});
export function standingBankPredecessorView(root=new URL('..',import.meta.url)){
 const key=root.href;if(views.has(key))return views.get(key);const folder=mkdtempSync(join(tmpdir(),'granaderos-standing-bank-test-'));folders.push(folder);
 const receipt=JSON.parse(execFileSync('python3',['-c',String.raw`
from pathlib import Path
import sys,json
root=Path.cwd();sys.path.insert(0,str(root/'tools/characters-3d'))
from standing_arm_context import create_bank_predecessor_snapshot
print(json.dumps(create_bank_predecessor_snapshot(root,Path(sys.argv[1]))))
`,join(folder,'root')],{cwd:root,encoding:'utf8',maxBuffer:1024*1024}));
 const assets=pathToFileURL(join(receipt.root,'web/public/models/characters')+'/'),result={receipt,assets,manifest:JSON.parse(readFileSync(new URL('manifest.json',assets),'utf8'))};views.set(key,result);return result;
}
