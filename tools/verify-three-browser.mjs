// Real browser acceptance for the integrated renderer. Screenshots are local
// evidence; passing this check alone does not establish final visual quality.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {RENDERER_SCENARIOS} from '../web/app/renderer-sandbox/fixtures.js';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const url=process.env.GRANADEROS_REVIEW_URL||'http://127.0.0.1:3150/renderer-sandbox';
const output=resolve(process.env.GRANADEROS_REVIEW_OUTPUT||'artifacts/three-gameplay-review');
const requested=process.argv.slice(2);
const scenarios=requested.length?RENDERER_SCENARIOS.filter(item=>requested.includes(item.id)):RENDERER_SCENARIOS.filter(item=>!['performance24','performance60'].includes(item.id));
assert.ok(scenarios.length,'No review scenario selected');
for(const id of requested)assert.ok(scenarios.some(item=>item.id===id),`Unknown scenario: ${id}`);
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
const results=[];
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('response',response=>{if(response.status()>=400&&!new URL(response.url()).pathname.endsWith('/favicon.ico'))errors.push(`${response.status()} ${response.url()}`);});
  await page.goto(url,{waitUntil:'networkidle'});
  for(const scenario of scenarios){
    const start=errors.length;
    await page.getByRole('button',{name:scenario.label,exact:true}).click();
    const canvas=page.locator('canvas[data-sector-renderer="three"]');
    await page.waitForFunction(()=>{
      const element=document.querySelector('canvas[data-sector-renderer="three"]');
      return element?.dataset.actors!==undefined&&Number(element.dataset.loadedActors)===Number(element.dataset.actors)&&!document.querySelector('.tactical-three-status');
    },null,{timeout:30000});
    const telemetry=await canvas.evaluate(element=>({...element.dataset}));
    assert.equal(telemetry.error,undefined,`${scenario.id} renderer error`);
    assert.equal(telemetry.loadedActors,telemetry.actors,`${scenario.id} missing character`);
    assert.ok(Number(telemetry.triangles)>0,`${scenario.id} empty scene`);
    assert.deepEqual(errors.slice(start),[],`${scenario.id} browser errors`);
    const bounds=await page.locator('.battle-layout').boundingBox();
    assert.ok(bounds&&bounds.y+bounds.height<=1001,`${scenario.id} HUD does not fit the review viewport`);
    await page.screenshot({path:resolve(output,`${scenario.id}.png`)});
    results.push({scenario:scenario.id,telemetry});
  }
  assert.deepEqual(errors,[],'Browser errors during initial load');
  const report={url,viewport:{width:1440,height:1000},scenarios:results,errors,scope:'Integrated scene loading, real geometry, viewport fit and screenshots. Screenshots need visual review; FPS samples do not prove sustained performance.'};
  await writeFile(resolve(output,'browser-report.json'),`${JSON.stringify(report,null,2)}\n`);
  console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
