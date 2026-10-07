import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {BUILDING_TYPES} from '../game/building-types.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const url=process.env.GRANADEROS_REVIEW_URL||'http://127.0.0.1:3150/renderer-sandbox';
const output=resolve(process.env.GRANADEROS_REVIEW_OUTPUT||'artifacts/three-gameplay-review');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
const errors=[],checks=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('pageerror',error=>errors.push(error.message));
 const ready=()=>page.waitForFunction(()=>{const c=document.querySelector('canvas[data-sector-renderer="three"]');return c?.dataset.actors&&c.dataset.actors===c.dataset.loadedActors&&!document.querySelector('.tactical-three-status');});
 await page.goto(url,{waitUntil:'networkidle'});await ready();
 await page.locator('.tactical-field').focus();await page.keyboard.press('f');
 await page.getByRole('button',{name:/^Realista rifle ·/}).press('Enter');
 await page.waitForFunction(()=>document.querySelector('[aria-label^="1. Fusil."]')?.getAttribute('aria-label').includes('0 carga(s)'));
 const rifle=page.locator('[aria-label^="1. Fusil."]');
 checks.push({action:'rifle-shot',equipment:await rifle.getAttribute('aria-label')});
 await page.screenshot({path:resolve(output,'rifle-shot-result.png')});
 // Wait for the normal committed player HUD. Presentation frames are busy.
 await page.getByRole('button',{name:'Fin del turno',exact:true}).click({trial:true});
 await page.locator('.tactical-field').focus();await page.keyboard.press('Alt+r');
 await page.waitForFunction(()=>document.querySelector('[aria-label^="1. Fusil."]')?.getAttribute('aria-label').includes('1 carga(s). 11 de reserva'));
 checks.push({action:'rifle-reload',equipment:await rifle.getAttribute('aria-label')});
 await page.getByRole('button',{name:'Posturas',exact:true}).click();await ready();
 await page.locator('[aria-label^="4. Arrastre."]').click();
 await page.getByRole('button',{name:'N6, accesible',exact:true}).press('Enter');
 await page.waitForSelector('[data-unit-id="crawler"][data-moving="true"]');
 await page.waitForTimeout(1000);
 assert.equal(await page.locator('[data-unit-id="crawler"]').getAttribute('data-moving'),'true','Crawl travel must not finish in one second');
 await page.screenshot({path:resolve(output,'crawl-in-motion.png')});
 await page.waitForSelector('[data-unit-id="crawler"][data-moving="false"]',{timeout:15000});
 checks.push({action:'male-crawl',finished:true});
 await page.getByRole('button',{name:'Arquitectura',exact:true}).click();await ready();
 for(const [index,type]of Object.keys(BUILDING_TYPES).entries()){
  await page.getByRole('combobox',{name:'Edificio a revisar',exact:true}).selectOption(type);await ready();
  await page.locator('.tactical-field').focus();await page.keyboard.press('-');
  await page.waitForTimeout(1100);
  await page.screenshot({path:resolve(output,`building-${index+1}.png`)});
 }
 assert.deepEqual(errors,[],'Live gameplay browser errors');
 const report={url,checks,errors,buildingScreenshots:9,scope:'Real UI rifle shot, finite reload, paid crawl movement and nine building camera views. Screenshots still require visual review.'};
 await writeFile(resolve(output,'actions-report.json'),`${JSON.stringify(report,null,2)}\n`);console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
