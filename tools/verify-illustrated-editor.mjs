// Browser verification for the generated staging editor, including missing art.
// Set PLAYWRIGHT_MODULE and optionally CHROMIUM_EXECUTABLE for a bundled runtime.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {SPRITE_APPEARANCES} from '../game/sprite-appearances.js';
import {REQUIRED_SPRITE_SEQUENCES} from '../game/sprite-action-requirements.js';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const manifest=JSON.parse(await readFile('assets/previews/illustrated-sprites/packed/manifest.json','utf8'));
const expected=Object.keys(SPRITE_APPEARANCES).flatMap(appearance=>REQUIRED_SPRITE_SEQUENCES.map(sequence=>({appearance,sequence,name:`${appearance}-${sequence}`})));
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(resolve('assets/previews/illustrated-sprites/index.html')).href);
 await page.click('#play');
 const result=await page.evaluate(({expected,atlases})=>{
  const cards=[...document.querySelectorAll('.card')],failures=[];
  const check=(condition,message)=>{if(!condition)failures.push(message);};
  const select=(id,value)=>{const e=document.getElementById(id);e.value=value;e.dispatchEvent(new Event('change'));};
  check(cards.length===expected.length,'required card count');
  for(const [i,requirement] of expected.entries()){
   const card=cards[i],entry=atlases[requirement.name];
   check(card?.querySelector('h2')?.textContent===requirement.name,`card ${requirement.name}`);
   check(card?.classList.contains('missing')===!entry,`availability ${requirement.name}`);
   if(entry){const img=card.querySelector('img');check(img?.complete&&img.naturalWidth===entry.size[0]&&img.naturalHeight===entry.size[1],`image ${requirement.name}`);}
  }
  let directionFrames=0;
  for(let direction=0;direction<8;direction++){
   select('direction',String(direction));
   for(let step=0;step<4;step++){
    const before=cards.map(c=>c.querySelector('img')?.getAttribute('style'));
    document.getElementById('step').click();
    for(const [i,r]of expected.entries()){
     const entry=atlases[r.name];if(!entry)continue;
     const img=cards[i].querySelector('img');
     check(!/NaN|Infinity/.test(img.getAttribute('style')),`geometry ${r.name}`);
     check((img.getAttribute('style')!==before[i])===(entry.framesPerDirection>1),`step ${r.name}`);
     const scale=3*entry.logicalCell/entry.cell;
     if(entry.framesPerDirection>1){const anchor=Number.parseFloat(img.parentElement.style.getPropertyValue('--anchor-y'));check(Math.abs(Number.parseFloat(img.style.top)-(anchor-entry.anchor[1]*scale-direction*entry.cell*scale))<.01,`direction ${r.name}:${direction}`);}
     directionFrames++;
    }
   }
  }
  for(const [id,key]of [['appearance','appearance'],['sequence','sequence']]){
   for(const value of new Set(expected.map(r=>r[key]))){
    select(id,value);const visible=cards.filter(c=>!c.hidden);
    const selected=expected.filter(r=>r[key]===value),present=selected.filter(r=>atlases[r.name]).length;
    check(visible.length===selected.length,`filter ${id}:${value}`);
    check(document.getElementById('selection-status').textContent===`${present} present · ${selected.length-present} missing for this selection`,`status ${id}:${value}`);
   }
   select(id,'');
  }
  return {cards:cards.length,present:expected.filter(r=>atlases[r.name]).length,missing:expected.filter(r=>!atlases[r.name]).length,directionFrames,failures};
 },{expected,atlases:manifest.atlases});
 assert.deepEqual(errors,[],'browser errors');assert.deepEqual(result.failures,[],'editor checks');
 console.log(JSON.stringify({...result,scope:'staging editor only; does not prove missing art or runtime completion'},null,2));
}finally{await browser.close();}
