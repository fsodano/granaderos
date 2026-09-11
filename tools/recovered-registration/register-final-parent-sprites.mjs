import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const base='assets/source/illustrated-sprites/', path=base+'sources.json';
const manifest=JSON.parse(await readFile(path));
const old=manifest.sheets.filter(j=>j.name==='woman-headscarf-run').flatMap(j=>j.slots).find(s=>s.direction==='se'&&s.frame===2);
const runSource=base+'woman-headscarf-run-se-2-fix-v2.png';
const runSpec={columns:4,rows:4,scaleMode:'height',slots:[{direction:'se',frame:2,row:3,col:2}]};
await writeFile('/tmp/headscarf-run-se-2-regions.json',JSON.stringify(runSpec));
execFileSync('node',['tools/register-illustrated-correction.mjs',runSource,'woman-headscarf-run','granadero-run','/tmp/headscarf-run-se-2-regions.json'],{stdio:'inherit'});
const updated=JSON.parse(await readFile(path));
const slot=updated.sheets.find(j=>j.source===runSource).slots[0];
slot.scale=old.scale;
slot.anchor=[old.anchor[0]+old.rect[0]-slot.rect[0],old.anchor[1]+old.rect[1]-slot.rect[1]];
slot.anchorMethod='Preserved reviewed SE passing pose size and map pivot after pistol cleanup';
await writeFile(path,JSON.stringify(updated,null,2)+'\n');
const name='woman-headscarf-unconscious-breathe',reference='granadero-unconscious-breathe';
const plan={variants:[
 {source:base+name+'-north-v1.png',name,reference,half:'north',includeDirections:['e','se']},
 {source:base+name+'-south-v1.png',name,reference,half:'south'}
],corrections:[{source:base+name+'-n-ne-fix-v2.png',name,reference,spec:{columns:4,rows:2,scaleMode:'longest',slots:['n','ne'].flatMap((direction,row)=>Array.from({length:4},(_,frame)=>({direction,frame,row,col:frame})))}}]};
await writeFile(base+'woman-headscarf-breathe-registration-plan.json',JSON.stringify(plan,null,2)+'\n');
execFileSync('node',['/tmp/register-illustrated-plan.mjs',base+'woman-headscarf-breathe-registration-plan.json',base+'woman-elder-prone-armed-walk-registration-plan.json'],{stdio:'inherit'});
