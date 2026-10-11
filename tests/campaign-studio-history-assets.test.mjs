import {register} from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createCampaignProject,projectResourceBytes} from '../game/campaign-editor-project.js';
import {registerPreviewAssets,sitePath,pagePath} from '../web/lib/site-path.js';
register('./tactical-render-loader.mjs',import.meta.url);
const {emptyStudioHistory,changeStudioProject,undoStudioProject,redoStudioProject}=await import('../web/lib/campaign-studio-history.ts');
const {studioAssetURLs,replaceProjectImageReferences,projectAssetUsage}=await import('../web/lib/campaign-studio-assets.ts');
test('one history restores full documents, resource bytes and building templates; new edits discard future',async()=>{
 const original=await createCampaignProject('studio-history'),changed={...original,world:{...original.world,defaultFoundry:'watch-post'},editor:{buildingTemplates:[{id:'own-house'}]}},third={...changed,presentation:{...changed.presentation,title:'Nueva presentación'}};
 let history=changeStudioProject(emptyStudioHistory(),original);history=changeStudioProject(history,changed);history=changeStudioProject(history,third);
 const undone=undoStudioProject(history);assert.equal(undone.current,changed);assert.deepEqual(undone.current.editor.buildingTemplates,[{id:'own-house'}]);assert.deepEqual(projectResourceBytes(undone.current,'assets/guide.png'),projectResourceBytes(original,'assets/guide.png'));
 assert.equal(redoStudioProject(undone).current,third);assert.equal(changeStudioProject(undone,original).future.length,0);
 for(let i=0;i<70;i++)history=changeStudioProject(history,{...third,manifest:{...third.manifest,revision:String(i)}});assert.equal(history.past.length,50);
});
test('private asset scopes use draft bytes, nest safely and leave hosting/game URLs unchanged after cleanup',async()=>{
 const project=await createCampaignProject('studio-images'),reference='/campaigns/studio-images/assets/guide.png',before=JSON.stringify(project),urls=studioAssetURLs(project);
 assert.ok(urls.get(reference).startsWith('data:image/png;base64,'));const release=registerPreviewAssets(urls);assert.equal(sitePath(reference,'/granaderos'),urls.get(reference));assert.equal(pagePath('/studio','/granaderos'),'/granaderos/studio/');
 const child=registerPreviewAssets(new Map([[reference,'blob:preview-child']]));assert.equal(sitePath(reference), 'blob:preview-child');child();assert.equal(sitePath(reference),urls.get(reference));release();release();assert.equal(sitePath(reference,'/granaderos'),'/granaderos'+reference);assert.equal(JSON.stringify(project),before);
});
test('asset renames change exact image references across documents without changing unrelated text or bytes',async()=>{
 const project=await createCampaignProject('studio-rename'),from='/campaigns/studio-rename/assets/guide.png',to='/campaigns/studio-rename/assets/own-face.png';project.presentation.menuArt=from;project.presentation.caption='A story mentions '+from;
 const usage=projectAssetUsage(project,'assets/guide.png');assert.ok(usage.includes('presentation.menuArt'));assert.ok(usage.includes('content.characters.0.portrait'));
 const next=replaceProjectImageReferences(project,from,to);assert.equal(next.content.characters[0].portrait,to);assert.equal(next.presentation.menuArt,to);assert.equal(next.presentation.caption,project.presentation.caption);assert.deepEqual(next.resources,project.resources);assert.equal(project.content.characters[0].portrait,from);
});
