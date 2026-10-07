// Playable template review. Every view uses normal door and movement orders.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {ARCHITECTURE_REVIEW_TEMPLATES} from '../web/app/renderer-sandbox/architecture-fixtures.js';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const url=process.env.GRANADEROS_REVIEW_URL||'http://127.0.0.1:3150/renderer-sandbox';
const output=resolve(process.env.GRANADEROS_REVIEW_OUTPUT||'artifacts/three-gameplay-review/catalog');
const full=process.argv.includes('--full');
const requested=process.argv.slice(2).filter(value=>value!=='--full');
const templates=requested.length?ARCHITECTURE_REVIEW_TEMPLATES.filter(item=>requested.includes(item.id)):ARCHITECTURE_REVIEW_TEMPLATES;
assert.ok(templates.length,'No building template selected');
for(const id of requested)assert.ok(templates.some(item=>item.id===id),`Unknown building template: ${id}`);
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
const errors=[],results=[];
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  page.on('pageerror',error=>errors.push(error.message));
  page.on('response',response=>{if(response.status()>=400&&!new URL(response.url()).pathname.endsWith('/favicon.ico'))errors.push(`${response.status()} ${response.url()}`);});
  const ready=()=>page.waitForFunction(()=>{const c=document.querySelector('canvas[data-sector-renderer="three"]');return c?.dataset.actors&&c.dataset.actors===c.dataset.loadedActors&&!document.querySelector('.tactical-three-status');});
  await page.goto(url,{waitUntil:'networkidle'});await ready();
  await page.getByRole('button',{name:'Catálogo de edificios',exact:true}).click();await ready();
  const states=full?[0,90,180,270].flatMap(rotation=>['exterior','partial','interior'].map(view=>({rotation,view}))):[
    {rotation:0,view:'exterior'},{rotation:0,view:'partial'},{rotation:0,view:'interior'},
    {rotation:90,view:'exterior'},{rotation:180,view:'partial'},{rotation:270,view:'interior'},
  ];
  for(const template of templates){
    await page.getByRole('combobox',{name:'Edificio del catálogo',exact:true}).selectOption(template.id);await ready();
    for(const state of states){
      await page.getByRole('combobox',{name:'Orientación del edificio',exact:true}).selectOption(String(state.rotation));
      await page.getByRole('combobox',{name:'Vista del edificio',exact:true}).selectOption(state.view);await ready();
      await page.locator('.tactical-field').focus();await page.keyboard.press('-');await page.waitForTimeout(180);
      const telemetry=await page.locator('canvas[data-sector-renderer="three"]').evaluate(element=>({...element.dataset}));
      assert.equal(telemetry.error,undefined,`${template.id} renderer failure`);
      assert.equal(telemetry.actors,'1',`${template.id} guard missing`);
      assert.ok(Number(telemetry.triangles)>0,`${template.id} empty geometry`);
      const bounds=await page.locator('.battle-layout').boundingBox();assert.ok(bounds&&bounds.y+bounds.height<=1001,`${template.id} HUD exceeds viewport`);
      const file=`${template.id}-${state.rotation}-${state.view}.png`;
      await page.screenshot({path:resolve(output,file)});results.push({template:template.id,...state,file,telemetry});
    }
    console.log(`${template.id}: ${states.length} live views ready`);
  }
  assert.deepEqual(errors,[],'Building catalogue browser errors');
  const report={url,full,views:results,errors,scope:'All selected templates in ordinary playable exterior, partial and interior states. Rotations use the compiled templates. Screenshots require visual comparison.'};
  await writeFile(resolve(output,'catalog-report.json'),`${JSON.stringify(report,null,2)}\n`);
  console.log(`${results.length} live building views; no browser errors`);
}finally{await browser.close();}
