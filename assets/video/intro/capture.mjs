import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

// This records the ordinary live game. It does not replace UI or inject game state.
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const origin=process.env.GRANADEROS_CAPTURE_ORIGIN||'http://127.0.0.1:3210';
const browserExecutable=process.env.CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const output=resolve(root,'assets/video/intro'),rawDir=resolve(root,'.cache/trailer-capture/raw');
const proofDir=resolve(output,'source/evidence');
const manifestPath=resolve(output,'source/capture-manifest.json');
async function serverIdentity(){
 const response=await fetch(origin+'/build-info.json',{cache:'no-store'});
 assert.ok(response.ok,'The recorded game must expose its build identity.');
 const identity=await response.json();
 assert.match(identity.revision??'',/^[0-9a-f]{40}$/,'The recorded game must identify its Git revision.');
 assert.match(identity.source??'',/^[0-9a-f]{64}$/,'The recorded game must identify its actual source bytes.');
 assert.equal(identity.id,identity.source.slice(0,12));
 if(process.env.GRANADEROS_EXPECTED_CAPTURE_SOURCE)assert.equal(identity.source,process.env.GRANADEROS_EXPECTED_CAPTURE_SOURCE,'The recording server must match the expected game source.');
 return identity;
}
const build=await serverIdentity();
await mkdir(rawDir,{recursive:true});await mkdir(proofDir,{recursive:true});
const manifest={schema:2,date:new Date().toISOString(),commit:build.revision,build,captureScriptRevision:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),captureScriptSha256:createHash('sha256').update(await readFile(fileURLToPath(import.meta.url))).digest('hex'),origin,viewport:{width:1600,height:900},browser:{engine:'Chromium',executable:browserExecutable,recording:'Playwright recordVideo, real browser frames, no speed change'},errors:[],clips:[]};
if(['combat','battle'].includes(process.env.GRANADEROS_CAPTURE_SECTION)){
 const previous=JSON.parse(await readFile(manifestPath));
 assert.equal(previous.commit,manifest.commit);assert.equal(previous.build?.source,build.source,'Partial capture must retain the same game source.');manifest.clips=previous.clips.filter(c=>process.env.GRANADEROS_CAPTURE_SECTION==='battle'?c.name!=='battle':['recruitment','campaign-map'].includes(c.name));
}
const browser=await chromium.launch({headless:true,executablePath:browserExecutable});
manifest.browser.version=browser.version();
function observe(page,label){
 page.on('pageerror',e=>manifest.errors.push({label,type:'pageerror',message:e.message}));
 page.on('console',m=>{if(m.type()==='error'&&!m.location().url.endsWith('favicon.ico'))manifest.errors.push({label,type:'console',message:m.text()});});
 page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))manifest.errors.push({label,type:'http',status:r.status(),url:r.url()});});
}
const ready=page=>page.waitForFunction(()=>{const c=document.querySelector('canvas[data-sector-renderer="three"]');return c?.dataset.loadedActors===c?.dataset.actors&&Number(c?.dataset.actors)>0&&c.dataset.pendingActors==='0'&&!document.querySelector('.tactical-three-status');},undefined,{timeout:60000});
async function recording(label){
 const context=await browser.newContext({viewport:manifest.viewport,recordVideo:{dir:rawDir,size:manifest.viewport}});
 const page=await context.newPage();observe(page,label);await page.goto(origin+'/',{waitUntil:'networkidle',timeout:120000});return {context,page,clips:[]};
}
async function shot(page,name){const path=resolve(proofDir,name+'.png');await page.screenshot({path});return 'assets/video/intro/source/evidence/'+name+'.png';}
async function holdUntil(page,start,seconds){await page.waitForTimeout(Math.max(0,seconds*1000-(Date.now()-start)));}
async function interval(rec,name,duration,actions){const row={name,path:'assets/video/intro/source/'+name+'.mp4',duration,actions,evidence:[],wallStart:Date.now()};rec.clips.push(row);return row;}
async function finish(rec){
 const closedAt=Date.now();await rec.context.close();const raw=await rec.page.video().path();
 const rawDuration=Number(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',raw],{encoding:'utf8'}).trim());
 for(const row of rec.clips){
  row.rawVideo=raw.replace(root+'/','');row.rawTrimStart=Math.max(0,rawDuration-(closedAt-row.wallStart)/1000);row.rawTrimEnd=row.rawTrimStart+row.duration;
  execFileSync('ffmpeg',['-y','-loglevel','error','-ss',row.rawTrimStart.toFixed(3),'-i',raw,'-vf','setpts=PTS-STARTPTS','-frames:v',String(row.duration*25),'-r','25','-an','-c:v','libx264','-preset','medium','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',resolve(root,row.path)]);
  row.media=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','stream=width,height,r_frame_rate,nb_frames,start_time,duration','-show_entries','format=duration,start_time,size','-of','json',resolve(root,row.path)],{encoding:'utf8'}));
  assert.equal(row.media.streams[0].nb_frames,String(row.duration*25));assert.equal(Number(row.media.streams[0].start_time),0);assert.equal(Number(row.media.format.duration),row.duration);
  row.sha256=createHash('sha256').update(await readFile(resolve(root,row.path))).digest('hex');
  row.evidenceSha256=Object.fromEntries(await Promise.all(row.evidence.map(async path=>[path,createHash('sha256').update(await readFile(resolve(root,path))).digest('hex')])));
  delete row.wallStart;manifest.clips.push(row);console.log(JSON.stringify({clip:row.name,duration:row.duration,path:row.path,sha256:row.sha256}));
 }
}
try{
 if(!['combat','battle'].includes(process.env.GRANADEROS_CAPTURE_SECTION)){
 const campaign=await recording('campaign'),p=campaign.page;
 await p.getByRole('button',{name:'Nueva campaña →',exact:true}).click();await p.getByRole('button',{name:'Omitir introducción →',exact:true}).click();
 const card=p.locator('.contract-card').filter({has:p.getByRole('button',{name:'Ver hoja de servicio de Alistair Kerr',exact:true})});
 await p.mouse.move(1000,700);await p.mouse.wheel(0,310);await p.waitForTimeout(1200);
 await p.waitForFunction(()=>Array.from(document.querySelectorAll('.contract-card img')).slice(0,5).every(i=>i.complete&&i.naturalWidth>0));
 const hiring=await interval(campaign,'recruitment',8,['Browse the live contract catalogue.','Open Alistair Kerr\'s service sheet, then close it with Escape.','Hire Alistair Kerr for one day through the ordinary contract button.']);
 hiring.evidence.push(await shot(p,'recruitment-before'));
 await holdUntil(p,hiring.wallStart,1);await p.getByRole('button',{name:'Ver hoja de servicio de Alistair Kerr',exact:true}).click();
 await holdUntil(p,hiring.wallStart,3.8);hiring.evidence.push(await shot(p,'recruitment-service-sheet'));await p.keyboard.press('Escape');
 await holdUntil(p,hiring.wallStart,5.2);await card.getByRole('button',{name:'Contratar · 162 pesos',exact:true}).click();
 await p.waitForFunction(()=>document.querySelector('.catalogue-count[role="status"]')?.textContent.includes('1 en tus filas'));
 hiring.actionEvidence={afterHire:await p.locator('.catalogue-count[role="status"]').innerText(),contractButton:await card.getByRole('button',{name:/^Renovar/}).innerText()};
 await holdUntil(p,hiring.wallStart,8);hiring.evidence.push(await shot(p,'recruitment-after'));
 await p.getByRole('button',{name:'Carta de operaciones →',exact:true}).click();await p.evaluate(()=>window.scrollTo(0,0));await p.waitForTimeout(1500);
 const map=await interval(campaign,'campaign-map',7,['Show the live campaign atlas after hiring one combatant.','Switch from the cities layer to the troops layer.','Select the Buenos Aires / Retiro sector and inspect its ordinary sector panel.']);
 map.evidence.push(await shot(p,'campaign-map-cities'));
 await holdUntil(p,map.wallStart,1.3);await p.getByRole('button',{name:'Tropas',exact:true}).click();
 await holdUntil(p,map.wallStart,3);await p.locator('[data-map-sector="retiro"]').first().press('Enter');
 await holdUntil(p,map.wallStart,4.6);map.evidence.push(await shot(p,'campaign-map-troops'));
 map.actionEvidence={selectedSector:await p.locator('[data-map-sector="retiro"]').first().getAttribute('aria-label'),troopsView:await p.getByRole('button',{name:'Tropas',exact:true}).getAttribute('aria-pressed')};
 await holdUntil(p,map.wallStart,7);await finish(campaign);
 }

 const combat=await recording('san-lorenzo'),b=combat.page;
 await b.getByRole('button',{name:'Combate de San Lorenzo ⚔',exact:true}).click();await ready(b);
 const rifle=b.locator('[aria-label^="3. Lorenzo Barcala."]');await rifle.click();
 await b.getByRole('button',{name:'Cámara',exact:true}).click();await b.getByRole('button',{name:'Centrar cámara en el combatiente seleccionado',exact:true}).click();await b.getByRole('button',{name:'Cámara',exact:true}).click();
 // Pan through the game's native wheel controls to include the rifleman and target.
 await b.mouse.move(950,430);await b.mouse.wheel(200,110);await b.waitForTimeout(1200);await ready(b);
 if(process.env.GRANADEROS_CAPTURE_SECTION!=='battle'){
 const preparation=await interval(combat,'preparation',7,['Open the selected rifleman\'s live equipment panel.','Inspect the Charleville and its charges/accessories.','Close the equipment panel through Listo.']);
 preparation.actionEvidence={beforeEquipment:await rifle.getAttribute('aria-label')};
 await holdUntil(b,preparation.wallStart,.8);await b.getByRole('button',{name:'Equipo',exact:true}).click();
 await holdUntil(b,preparation.wallStart,2.2);await b.getByText('Cargas y accesorios',{exact:true}).click();
 await holdUntil(b,preparation.wallStart,4.2);preparation.evidence.push(await shot(b,'preparation-equipment'));
 preparation.actionEvidence.equipmentText=(await b.locator('body').innerText()).slice(-10000);
 await holdUntil(b,preparation.wallStart,5.5);await b.getByRole('button',{name:'Listo',exact:true}).click();await holdUntil(b,preparation.wallStart,7);
 }
 // Use the real next turn to retain five AP, then move clear of roof and foliage.
 // This common setup applies to both a complete run and a battle-only recapture.
 await b.getByRole('button',{name:'Fin del turno',exact:true}).click();
 let nextTurnReady=false;
 for(let i=0;i<60;i++){
  await b.waitForTimeout(500);const resume=b.getByRole('button',{name:'Continuar turno enemigo',exact:true}).first();
  if(await resume.isVisible()&&await resume.isEnabled())await resume.click();
  if((await b.locator('body').innerText()).includes('Turno 2 · Ejército patriota')&&await b.getByRole('button',{name:'Fin del turno',exact:true}).isEnabled()){nextTurnReady=true;break;}
 }
 assert.ok(nextTurnReady,'The ordinary enemy turn must complete.');await rifle.click();
 await b.getByRole('button',{name:'Cámara',exact:true}).click();await b.getByRole('button',{name:'Alejar campo',exact:true}).click();await b.getByRole('button',{name:'Centrar cámara en el combatiente seleccionado',exact:true}).click();await b.getByRole('button',{name:'Cámara',exact:true}).click();await ready(b);
 await b.locator('.tactical-field').focus();await b.keyboard.press('r');await b.keyboard.press('g');await b.getByRole('button',{name:'U44, accesible',exact:true}).press('Enter');
 await b.waitForFunction(()=>document.querySelector('[aria-label="U44, Lorenzo Barcala"]'),undefined,{timeout:20000});
 await b.getByRole('button',{name:'Fin del turno',exact:true}).click({trial:true});
 await b.getByRole('button',{name:'Cámara',exact:true}).click();await b.getByRole('button',{name:'Acercar campo',exact:true}).click();await b.getByRole('button',{name:'Centrar cámara en el combatiente seleccionado',exact:true}).click();await b.getByRole('button',{name:'Cámara',exact:true}).click();await ready(b);
 await b.mouse.move(950,430);await b.mouse.wheel(160,80);await b.locator('.tactical-field').focus();await b.keyboard.press('Escape');await b.mouse.move(80,45);await b.waitForTimeout(1000);
 const firing=await interval(combat,'battle',12,['Select the ordinary firearm targeting mode with F.','Target Soldado realista 1 and fire the Charleville with Enter.','Reload with the ordinary Alt+R shortcut and consume one reserve cartridge.']);
 firing.actionEvidence={before:await rifle.getAttribute('aria-label'),renderer:await b.locator('canvas[data-sector-renderer="three"]').evaluate(e=>({...e.dataset}))};
 firing.actionEvidence.setup='In a fresh San Lorenzo skirmish, complete the ordinary first enemy turn with Fin del turno and resume any interruptions through Continuar turno enemigo. Barcala starts the second player turn with 30 PA by retaining five. Select Barcala, choose Run with R and issue a normal movement order from T35 to U44 before the recorded interval. Recenter and pan the native camera. This move clears the convent roof and foliage and leaves enough PA for fire and reload. Cabral fell during the preceding real enemy turn.';
 firing.evidence.push(await shot(b,'battle-before'));
 await b.locator('.tactical-field').focus();await b.keyboard.press('f');await b.getByRole('button',{name:/^Soldado realista 1 ·/}).focus();
 await holdUntil(b,firing.wallStart,1.5);await b.getByRole('button',{name:/^Soldado realista 1 ·/}).press('Enter');
 await b.waitForFunction(()=>document.querySelector('[aria-label^="3. Lorenzo Barcala."]')?.getAttribute('aria-label').includes('0 carga(s)'));
 firing.actionEvidence.afterShot=await rifle.getAttribute('aria-label');assert.match(firing.actionEvidence.afterShot,/0 carga\(s\). 12 de reserva/);
 await holdUntil(b,firing.wallStart,3.6);firing.evidence.push(await shot(b,'battle-after-shot'));
 await holdUntil(b,firing.wallStart,5.1);await b.locator('.tactical-field').focus();await b.keyboard.press('Alt+r');
 await b.waitForFunction(()=>document.querySelector('[aria-label^="3. Lorenzo Barcala."]')?.getAttribute('aria-label').includes('1 carga(s). 11 de reserva'));
 firing.actionEvidence.afterReload=await rifle.getAttribute('aria-label');assert.match(firing.actionEvidence.afterReload,/1 carga\(s\). 11 de reserva/);
 await holdUntil(b,firing.wallStart,9);firing.evidence.push(await shot(b,'battle-after-reload'));await holdUntil(b,firing.wallStart,12);

 if(process.env.GRANADEROS_CAPTURE_SECTION!=='battle'){
 const dorrego=b.locator('[aria-label^="2. Manuel Dorrego."]');await dorrego.click();
 await b.getByRole('button',{name:'Cámara',exact:true}).click();await b.getByRole('button',{name:'Centrar cámara en el combatiente seleccionado',exact:true}).click();await b.getByRole('button',{name:'Cámara',exact:true}).click();await ready(b);await b.mouse.move(950,400);await b.waitForTimeout(900);
 const maneuver=await interval(combat,'maneuver',10,['Select Manuel Dorrego.','Issue a normal ground movement order to AC39.','Lower the selected combatant to a crouched posture.','Use the native camera wheel to survey the sector.']);
 maneuver.actionEvidence={before:await dorrego.getAttribute('aria-label'),initialPosition:await b.locator('[data-unit-id="4"]').getAttribute('data-posture')};
 maneuver.evidence.push(await shot(b,'maneuver-before'));
 await b.locator('.tactical-field').focus();await b.keyboard.press('g');
 await holdUntil(b,maneuver.wallStart,1);await b.getByRole('button',{name:'AC39, accesible',exact:true}).press('Enter');
 await b.waitForFunction(()=>document.querySelector('[aria-label="AC39, Manuel Dorrego"]'),undefined,{timeout:20000});
 maneuver.actionEvidence.afterMove=await dorrego.getAttribute('aria-label');maneuver.actionEvidence.destination='AC39, Manuel Dorrego';
 await holdUntil(b,maneuver.wallStart,4.8);await b.getByRole('button',{name:'Bajar postura',exact:true}).click();
 await b.waitForFunction(()=>document.querySelector('[data-unit-id="4"]')?.getAttribute('data-posture')==='crouch');
 maneuver.actionEvidence.afterPosture=await dorrego.getAttribute('aria-label');
 await holdUntil(b,maneuver.wallStart,6.5);maneuver.evidence.push(await shot(b,'maneuver-crouched'));await b.mouse.move(960,370);await b.mouse.wheel(150,-90);
 await holdUntil(b,maneuver.wallStart,10);maneuver.evidence.push(await shot(b,'maneuver-after'));
 }
 await finish(combat);
 assert.deepEqual(await serverIdentity(),build,'The game build must remain unchanged throughout recording.');
 assert.deepEqual(manifest.errors,[],'The live recording must have no runtime or HTTP errors.');
 assert.equal(manifest.clips.length,5,'The source manifest must have all five complete clips.');
 manifest.scope='Fresh isolated contexts. Live UI recorded at normal browser zoom. Clip trimming and H.264 encoding only; no synthetic game frames, crop, playback speed changes, or game state injection. Screenshots document the captured actions.';
 manifest.clips.sort((a,b)=>['recruitment','campaign-map','preparation','battle','maneuver'].indexOf(a.name)-['recruitment','campaign-map','preparation','battle','maneuver'].indexOf(b.name));
 await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
}finally{await browser.close();}
