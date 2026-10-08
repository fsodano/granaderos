import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {VARIED_ROOF_CLIMB_SCENARIO,ROOF_CLIMB_CASES,createVariedRoofClimbBattle} from '../web/app/renderer-sandbox/varied-roof-climb-fixture.js';
import {ladderGeometry,sampleLadderClimb} from '../game/climb-geometry.js';
import {BUILDING_TYPES} from '../game/building-types.js';
import {BUILDING_VERTICAL_SCALE} from '../game/building-scale.js';
import {register} from 'node:module';register('../tests/tactical-render-loader.mjs',import.meta.url);
const {TILE_METRES}=await import('../web/lib/three/projection.ts');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const url=process.env.GRANADEROS_REVIEW_URL||'http://127.0.0.1:3189/renderer-sandbox',output=resolve(process.env.GRANADEROS_REVIEW_OUTPUT||'artifacts/varied-climb-current-ui'),requested=process.argv.filter(a=>a.startsWith('--case=')).map(a=>a.slice(7)),cases=requested.length?ROOF_CLIMB_CASES.filter(c=>requested.includes(c.id)):ROOF_CLIMB_CASES;
assert.ok(cases.length);await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:process.argv.includes('--headless'),...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],report=[],network=[],pending=[];
const sha=raw=>createHash('sha256').update(raw).digest('hex');
const sourcePaths=['web/lib/three/actor-runtime.ts','web/lib/three/climb-contact-fit.ts','web/lib/three/climb-body-phase.ts','game/climb-geometry.js','web/app/renderer-sandbox/varied-roof-climb-fixture.js','web/public/models/characters/manifest.json','web/public/models/characters/male-animations.glb','web/public/models/characters/female-animations.glb'];
const sourcePins=Object.fromEntries(await Promise.all(sourcePaths.map(async p=>[p,sha(await readFile(new URL('../'+p,import.meta.url)))])));
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push(`${r.status()} ${r.url()}`);if(new URL(r.url()).pathname.startsWith('/models/characters/'))pending.push((async()=>{const path=new URL(r.url()).pathname,body=await r.body(),actual=sha(body),expected=sha(await readFile(new URL('../web/public'+path,import.meta.url)));assert.equal(actual,expected,'Normal renderer served the exact reviewed asset '+path);network.push({path,status:r.status(),sha256:actual});})());});
const ready=()=>page.waitForFunction(()=>{const c=document.querySelector('canvas[data-sector-renderer="three"]');return c?.dataset.actors&&c.dataset.actors===c.dataset.loadedActors&&!document.querySelector('.tactical-three-status');});
const actor=page.locator('[data-unit-id="height-climber"]'),portrait=page.locator('.ja2-portrait-cell').filter({hasText:'Escalador'}),roster=()=>portrait.getAttribute('aria-label');
const pixels=(BUILDING_TYPES.house.height+BUILDING_VERTICAL_SCALE)/3;
const standingPoint=point=>({x:18*26+28+(point.x-point.y)*26,y:65+(point.x+point.y)*14-point.elevation*pixels});
const atPoint=async(point,level)=>{const actual=await actor.locator('[data-person-hit-target]').evaluate(e=>({x:Number(e.getAttribute('x'))+Number(e.getAttribute('width'))/2,y:Number(e.getAttribute('y'))+Number(e.getAttribute('height'))})),expected=standingPoint(point);assert.ok(Math.hypot(actual.x-expected.x,actual.y-expected.y)<.01,`Final normal overlay retains actual saved cell and height: ${JSON.stringify({actual,expected})}`);assert.equal(await actor.getAttribute('data-tactical-level'),level?'1':null);return actual;};
try{
 await page.goto(url,{waitUntil:'networkidle'});await ready();await page.getByRole('button',{name:VARIED_ROOF_CLIMB_SCENARIO.label,exact:true}).click();await ready();
 for(const item of cases){
  await page.getByRole('combobox',{name:'Altura del acceso',exact:true}).selectOption(item.id);await ready();
  await page.getByRole('button',{name:'Cámara',exact:true}).click();await page.getByRole('button',{name:'Acercar campo',exact:true}).click();await page.getByRole('button',{name:'Cámara',exact:true}).click();await ready();
  const fixture=createVariedRoofClimbBattle(item.id),link=fixture.climbLinks[0],initial=await roster();assert.ok(initial.includes('25 puntos de acción, energía 100'));const ground={...link.from,elevation:item.base},roof={...link.to,elevation:item.base+item.height};await atPoint(ground,0);await page.screenshot({path:resolve(output,`${item.id}-before.png`)});
  const cdp=await page.context().newCDPSession(page),frames=[];let capturing=false;
  cdp.on('Page.screencastFrame',async frame=>{cdp.send('Page.screencastFrameAck',{sessionId:frame.sessionId}).catch(()=>{});if(!capturing)return;const shadow=await actor.locator('[data-person-hit-target]').evaluate(e=>({x:Number(e.getAttribute('x'))+Number(e.getAttribute('width'))/2,y:Number(e.getAttribute('y'))+Number(e.getAttribute('height'))})).catch(()=>null);if(!shadow)return;const origin=18*26+28,delta=(shadow.x-origin)/26;if(item.vertical)return;const x=link.from.x,y=x-delta,worldHeight=(65+(x+y)*14-shadow.y)/pixels,target=worldHeight-item.base,g=ladderGeometry([0,item.base,0],[0,item.base+item.height,TILE_METRES],TILE_METRES);let a=.12,b=1;for(let i=0;i<32;i++){const mid=(a+b)/2;if(sampleLadderClimb(g,mid).root.height<target)a=mid;else b=mid;}const up=(a+b)/2;if(up>=.846&&up<=.904)frames.push({up,png:frame.data,timestamp:frame.metadata.timestamp});});
  for(const [direction,label,ap,energy,point,level]of [['up','Subir · 5 PA','20','88',roof,1],['down','Bajar · 3,75 PA','16,25','80',ground,0]]){
   await portrait.dblclick();await page.getByRole('button',{name:label,exact:true}).click();await page.getByRole('button',{name:'Escalador de la casa. Botón derecho: cerrar equipo',exact:true}).click({button:'right'});
   await page.waitForFunction(()=>document.querySelector('[data-unit-id="height-climber"]')?.dataset.moving==='true');capturing=true;if(item.id==='tall-cardinal')await cdp.send('Page.startScreencast',{format:'png',maxWidth:1440,maxHeight:1000,everyNthFrame:1});
   await page.waitForFunction(()=>document.querySelector('[data-unit-id="height-climber"]')?.dataset.moving!=='true',{},{timeout:20000});capturing=false;if(item.id==='tall-cardinal')await cdp.send('Page.stopScreencast');await ready();const final=await roster();assert.ok(final.includes(`${ap} puntos de acción, energía ${energy}`),final);const actual=await atPoint(point,level);await page.screenshot({path:resolve(output,`${item.id}-${direction}-complete.png`)});
   if(item.id==='tall-cardinal'){const selected=frames.splice(0).sort((a,b)=>Math.abs(a.up-.88)-Math.abs(b.up-.88)).slice(0,4);assert.ok(selected.length,'Normal visible climb captured the roof hand phase');for(const [i,frame]of selected.entries()){const file=`${item.id}-${direction}-palm-${i}.png`;await writeFile(resolve(output,file),Buffer.from(frame.png,'base64'));report.push({id:item.id,direction,file,upFractionFromOrdinaryOverlay:frame.up,timestamp:frame.timestamp});}}
   report.push({id:item.id,direction,final,actual,expected:point});
  }
  await cdp.detach();await page.getByRole('button',{name:'Reiniciar escena',exact:true}).click();await ready();assert.equal(await page.getByRole('combobox',{name:'Altura del acceso',exact:true}).inputValue(),item.id);assert.ok((await roster()).includes('25 puntos de acción, energía 100'));await atPoint(ground,0);console.log(item.id+': ordinary paid ascent, return and selected-case reset pass');
 }
 await Promise.all(pending);assert.deepEqual(errors,[]);for(const [path,value]of Object.entries(sourcePins))assert.equal(sha(await readFile(new URL('../'+path,import.meta.url))),value,'Review source remains exact '+path);await writeFile(resolve(output,'report.json'),JSON.stringify({url,errors,sourcePins,network,cases:report,scope:'Only visible controls and ordinary DOM telemetry. No state/pose/time injection.'},null,2)+'\n');
}finally{await browser.close();}
