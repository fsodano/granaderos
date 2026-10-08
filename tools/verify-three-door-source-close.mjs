import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createArchitectureReviewBattle} from '../web/app/renderer-sandbox/architecture-fixtures.js';
import {entranceFrame} from '../game/building-profile.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const url=process.env.GRANADEROS_REVIEW_URL??'http://127.0.0.1:3150/renderer-sandbox',output=resolve(process.env.GRANADEROS_REVIEW_OUTPUT??'artifacts/door-source-review/current-close-ui');await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE}),errors=[],views=[];
try{const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.location().url.endsWith('/favicon.ico'))errors.push(m.text());});
 const ready=()=>page.waitForFunction(()=>{const c=document.querySelector('canvas[data-sector-renderer="three"]');return c?.dataset.actors&&c.dataset.actors===c.dataset.loadedActors&&!document.querySelector('.tactical-three-status');});
 await page.goto(url,{waitUntil:'networkidle'});await ready();await page.getByRole('button',{name:'Catálogo de edificios',exact:true}).click();await ready();
 for(const template of ['capilla','iglesia','casa','barraca'])for(const rotation of [0,90]){
  await page.getByRole('combobox',{name:'Edificio del catálogo',exact:true}).selectOption(template);await page.getByRole('combobox',{name:'Orientación del edificio',exact:true}).selectOption(String(rotation));await ready();
  await page.locator('.tactical-field').focus();await page.keyboard.press('+');await page.waitForTimeout(180);
  const b=createArchitectureReviewBattle(template,rotation,'exterior'),frame=entranceFrame(b.buildings[0]),door=frame.at(frame.doorU,0),target={x:b.height*26+28+(door.x-door.y)*26,y:65+(door.x+door.y+.8)*14-24};
  const camera=await page.locator('[data-scene-camera]').evaluate(e=>{const m=e.transform.baseVal.consolidate().matrix,v=e.ownerSVGElement.viewBox.baseVal;return{x:-m.e,y:-m.f,width:v.width,height:v.height};});const field=await page.locator('.tactical-field').boundingBox();await page.mouse.move(field.x+field.width*.5,field.y+field.height*.5);await page.mouse.wheel((target.x-camera.x-camera.width*.5)*3,(target.y-camera.y-camera.height*.5)*3);await page.waitForTimeout(180);await ready();const file=`${template}-${rotation}-exterior-close.png`;await page.screenshot({path:resolve(output,file)});await ready();views.push({template,rotation,file,telemetry:await page.locator('canvas[data-sector-renderer="three"]').evaluate(e=>({...e.dataset}))});
 }
 assert.deepEqual(errors,[]);await writeFile(resolve(output,'report.json'),JSON.stringify({url,views,errors,scope:'Normal catalogue controls and maximum normal zoom; no renderer or state injection.'},null,2)+'\n');console.log(`${views.length} normal close views; no browser errors`);
}finally{await browser.close();}
