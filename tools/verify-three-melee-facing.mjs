import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const url=process.env.GRANADEROS_REVIEW_URL||'http://127.0.0.1:3151/renderer-sandbox';
const output=resolve(process.env.GRANADEROS_REVIEW_OUTPUT||'artifacts/three-paid-melee-facing-review');
const sourceRoot=resolve(process.env.GRANADEROS_SOURCE_ROOT||process.cwd());
const expected={
 'web/lib/three/melee-contact-fit.ts':'8538bdae294f464a49bb651dd2c9f8bbaf9f7e4a9be512530f04c7cebaae70f2',
 'web/lib/three/actor-runtime.ts':'6b821e10ec06a3792d94501ea86b21ffd540e06c56b4e4725177241301355272',
 'web/lib/three/presentation.ts':'6aa16eac91610ce55c1b7374cb8e2caeb1a94dd22ee20703137c312e9332c958',
 'web/lib/three/scene-actors.ts':'84c627e42344201f043b893e74ec6ac9f49a0e94d9f4f5e990a4ec2194abf9fd',
};
const sourceFiles=[...Object.keys(expected),'web/public/models/characters/manifest.json','web/public/models/characters/equipment.glb','web/public/models/characters/male-animations.glb','web/public/models/characters/female-animations.glb','web/public/models/characters/granadero-lod0.glb','web/public/models/characters/woman-scout-lod0.glb','web/public/models/characters/royalist-lod0.glb'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function sourceReceipt(){const hashes={};for(const file of sourceFiles)hashes[file]=sha(await readFile(resolve(sourceRoot,file)));return {root:sourceRoot,commit:execFileSync('git',['rev-parse','HEAD'],{cwd:sourceRoot,encoding:'utf8'}).trim(),hashes};}
const beforeSource=await sourceReceipt();for(const [file,hash]of Object.entries(expected))assert.equal(beforeSource.hashes[file],hash,`Review the exact frozen source: ${file}`);
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']});
const report={url,source:beforeSource,cases:[],errors:[],scope:'Visible ordinary combat scenario, paid preserve-facing movement and owned sabre selection. DOM/captures only; no injected state, saved-file edits or private renderer/model reads. Wall capture times may skip the exact authored contact marker.'};
try{
 for(const scenario of [
  {anatomy:'male',appearance:'granadero',id:'sabre',card:'3. Sable.',name:'Sable',move:'J7',target:'Realista sabre',targetCell:'K8'},
  {anatomy:'female',appearance:'woman-scout',id:'grenade',card:'4. Granada.',name:'Granada',move:'M9',target:'Realista grenade',targetCell:'N10'},
 ]){
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[],network=[],pending=[];page.setDefaultTimeout(20000);
  page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error'&&!message.location().url.endsWith('/favicon.ico'))errors.push(message.text());});
  page.on('response',response=>{if(response.status()>=400&&!new URL(response.url()).pathname.endsWith('/favicon.ico'))errors.push(`${response.status()} ${response.url()}`);if(/\/models\/characters\/|\/(?:melee-contact-fit|actor-runtime|presentation|scene-actors)\.ts(?:\?|$)/.test(response.url()))pending.push((async()=>{try{network.push({url:response.url(),status:response.status(),sha256:sha(await response.body())});}catch(error){network.push({url:response.url(),bodyUnavailable:String(error)});}})());});
  const ready=()=>page.waitForFunction(()=>{const canvas=document.querySelector('[data-sector-renderer="three"]');return canvas?.dataset.loadedActors==='13'&&canvas.dataset.actors==='13'&&!document.querySelector('.tactical-three-status');});
  await page.goto(url,{waitUntil:'networkidle',timeout:30000});await ready();await page.getByRole('button',{name:'Combate',exact:true}).click();await ready();
  const card=page.locator(`[aria-label^="${scenario.card}"]`);await card.click();
  // A is the ordinary paid 'equip blade' command; the female already owns this sabre.
  if(scenario.anatomy==='female'){await page.locator('.tactical-field').focus();await page.keyboard.press('a');await page.getByRole('button',{name:'Fin del turno',exact:true}).click({trial:true});}
  await card.click({button:'right'});await page.getByText('Cargas y accesorios',{exact:true}).click();
  const hands=await page.locator('[aria-label="Manos del combatiente"] button').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('aria-label')));
  assert.ok(hands.some(label=>label==='Mano principal: Sable de Caroya'),`${scenario.anatomy} uses its existing owned sabre`);
  await page.screenshot({path:resolve(output,`${scenario.anatomy}-owned-equipment.png`)});await page.getByRole('button',{name:'Listo',exact:true}).click();
  const moveBefore=await card.getAttribute('aria-label');
  // Alt+Enter is the visible preserve-facing movement control. No unpaid facing is set.
  await page.getByRole('button',{name:`${scenario.move}, accesible`,exact:true}).press('Alt+Enter');
  await page.waitForSelector(`[data-unit-id="${scenario.id}"][data-moving="true"]`);
  await page.waitForSelector(`[data-unit-id="${scenario.id}"][data-moving="false"]`,{timeout:45000});
  assert.equal(await page.locator(`[aria-label="${scenario.move}, ${scenario.name}"]`).count(),1);
  await page.getByRole('button',{name:'Fin del turno',exact:true}).click({trial:true});
  const moveAfter=await card.getAttribute('aria-label');assert.notEqual(moveAfter,moveBefore,'Ordinary combat movement spends PA');
  await page.getByRole('button',{name:'Cámara',exact:true}).click();for(let i=0;i<3;i++){const zoom=page.getByRole('button',{name:'Acercar campo',exact:true});if(await zoom.isEnabled())await zoom.click();}await page.getByRole('button',{name:'Cámara',exact:true}).click();
  await page.locator('.tactical-field').focus();await page.keyboard.press('Escape');
  const target=page.getByRole('button',{name:new RegExp(`^${scenario.target} ·`)}),before={card:await card.getAttribute('aria-label'),target:await target.getAttribute('aria-label'),actorCell:scenario.move,targetCell:scenario.targetCell,hands};
  assert.ok(before.target.includes('100 salud'));assert.equal(await page.locator(`[aria-label="${scenario.targetCell}, ${scenario.target}"]`).count(),1);
  await page.screenshot({path:resolve(output,`${scenario.anatomy}-ready-diagonal.png`)});
  await target.press('Enter');await page.evaluate(()=>document.activeElement?.blur());await page.mouse.move(20,20);const start=performance.now(),frames=[];
  for(const at of [0,80,160,240,320,400,480,560,640,720,800,960,1120,1360,1600,1800,2000,2400]){
   await page.waitForTimeout(Math.max(0,at-(performance.now()-start)));const frame=await page.locator('.tactical-field').getAttribute('data-enemy-frame'),label=await target.getAttribute('aria-label');frames.push({requestedAtMs:at,wallElapsedMs:performance.now()-start,frame,target:label});await page.screenshot({path:resolve(output,`${scenario.anatomy}-strike-${at}.png`)});
  }
  await page.getByRole('button',{name:'Fin del turno',exact:true}).click({trial:true});
  const after={card:await card.getAttribute('aria-label'),target:await target.getAttribute('aria-label')};assert.notEqual(after.card,before.card,'The single paid strike spends PA');
  assert.equal(await page.locator(`[aria-label="${scenario.move}, ${scenario.name}"]`).count(),1,'The admitted diagonal strike does not add a movement step');
  assert.equal(await page.locator('.tactical-field').getAttribute('data-enemy-frame'),null,'The paid action completes');
  const phases=new Set(frames.map(frame=>frame.frame?.split(':')[2]).filter(Boolean));assert.ok(phases.has('prepare')&&phases.has('contact')&&phases.has('impact'),'The visible finite paid strike presents all three phases');assert.ok(frames.filter(frame=>frame.frame).every(frame=>frame.frame.endsWith(':melee')),'The sequence contains only the paid melee action');
  const healthLabels=frames.map(frame=>frame.target).filter((label,index,array)=>index===0||label!==array[index-1]);assert.ok(healthLabels.length<=2,'Damage cannot be committed twice');
  await page.screenshot({path:resolve(output,`${scenario.anatomy}-complete.png`)});await Promise.allSettled(pending);assert.deepEqual(errors,[]);for(const response of network){const match=new URL(response.url).pathname.match(/\/models\/characters\/(.+)$/);if(match&&beforeSource.hashes[`web/public/models/characters/${match[1]}`])assert.equal(response.sha256,beforeSource.hashes[`web/public/models/characters/${match[1]}`],'Served native model bytes match the source capture receipt');}
  report.cases.push({...scenario,moveBefore,moveAfter,before,after,frames,healthLabels,network,errors});await page.close();
 }
 report.sourceAfter=await sourceReceipt();assert.deepEqual(report.sourceAfter,beforeSource,'Source and native asset hashes remain exact throughout capture');
}catch(error){report.errors.push(String(error));throw error;}finally{await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
console.log(JSON.stringify({source:report.source,cases:report.cases.map(({anatomy,before,after,errors})=>({anatomy,before,after,errors})),errors:report.errors,output},null,2));
