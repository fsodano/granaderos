import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const url=process.env.GRANADEROS_REVIEW_URL||'http://127.0.0.1:3150/renderer-sandbox';
const output=resolve(process.env.GRANADEROS_REVIEW_OUTPUT||'artifacts/three-gameplay-review');
const fourBores=process.argv.includes('--four-bores');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
const errors=[],checks=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error'&&!message.location().url.endsWith('/favicon.ico'))errors.push(message.text());});
 const ready=()=>page.waitForFunction(()=>{const canvas=document.querySelector('canvas[data-sector-renderer="three"]');return canvas?.dataset.actors&&canvas.dataset.actors===canvas.dataset.loadedActors&&!document.querySelector('.tactical-three-status');});
 const idle=()=>page.getByRole('button',{name:fourBores?'Pausar':'Fin del turno',exact:true}).click({trial:true});
 await page.goto(url,{waitUntil:'networkidle'});
 await page.getByRole('button',{name:fourBores?'Recarga de cuatro cañones':'Recarga de dos pistolas',exact:true}).click();await ready();
 for(const [ordinal,name,remaining,reserve]of fourBores?[[1,'Dos pistolas',25,4],[2,'Segunda pistola',25,6]]:[[1,'Dos pistolas',10,6],[2,'Segunda pistola',18,7]]){
  if(ordinal===2){await page.getByRole('button',{name:'Reiniciar escena',exact:true}).click();await ready();}
  const roster=page.locator(`[aria-label^="${ordinal}. ${name}."]`);await roster.click();
  const before=await roster.getAttribute('aria-label');if(!fourBores)assert.match(before,/25 puntos de acción/);assert.match(before,/8 de reserva/);
  await page.locator('.tactical-field').focus();await page.keyboard.press('+');await page.keyboard.press('+');await page.keyboard.press('Alt+r');
  await page.waitForSelector('[data-enemy-frame]');const started=Date.now(),charges=(ordinal===1?2:1)*(fourBores?2:1);
  for(let charge=0;charge<charges;charge++){
   await page.waitForTimeout(Math.max(0,2800+4800*charge-(Date.now()-started)));
   const suffix=charge===0?'first':charge===1?'second':`charge-${charge+1}`;
   await page.screenshot({path:resolve(output,`paired-loading-${ordinal}-${suffix}.png`)});
   // Competing input during native work cannot issue another reload.
   if(charge===0){await page.locator('.tactical-field').focus();await page.keyboard.press('Alt+r');}
  }
  await idle();const after=await roster.getAttribute('aria-label');
  if(!fourBores)assert.match(after,new RegExp(`${remaining} puntos de acción`));
  assert.equal((after.match(new RegExp(`${fourBores?2:1} carga\\(s\\)\\. ${reserve} de reserva`,'g'))??[]).length,2,'Both owned pistols retain their paid charges and exact reserve');
  assert.doesNotMatch(after,/Recarga en curso/);assert.match(after,/Estado 81%/);assert.match(after,/Estado 57%/);
  checks.push({action:ordinal===1?'both-owned-pistols':'offhand-only',before,after});
  await page.screenshot({path:resolve(output,`paired-loading-${ordinal}-complete.png`)});
 }
 assert.deepEqual(errors,[],'Live paired-loading browser errors');
 const report={url,fourBores,checks,errors,scope:'Real reload orders, two owned pistols, offhand-only loading, blocked competing input and exact finite costs. Screenshots include each native rod stroke and require visual review.'};
 await writeFile(resolve(output,'paired-loading-report.json'),`${JSON.stringify(report,null,2)}\n`);console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
