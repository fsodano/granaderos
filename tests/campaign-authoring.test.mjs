import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {scaffoldCampaign,checkCampaign,refreshAuthorAssets} from '../tools/campaign-authoring.mjs';
import {initialCampaign,dispatchCampaign,rosterFor} from '../game/campaign.js';
import {encodeSave,decodeSave} from '../game/save.js';
import {campaignStorageKey} from '../game/content-launch.js';
import {defaultProfile} from '../game/recruitment.js';

test('a scaffold is a playable independent campaign with its own map, cast, portrait and saved identity',async()=>{
 const root=await mkdtemp(join(tmpdir(),'campaign-author-'));
 try{
  const folder=await scaffoldCampaign('new-frontier',join(root,'new-frontier')),content=await checkCampaign(folder);
  assert.equal(content.scenario,'generic-v1');assert.equal(content.headquarters,'camp');
  assert.deepEqual(content.characters.map(c=>c.id),['guide']);assert.deepEqual(Object.keys(content.maps),['camp','watch-post']);
  assert.equal(content.world.physical.caches.camp,undefined);assert.equal(content.presentation.calendar.year,1);
  assert.equal(content.presentation.characterPortraits[0].src,'/campaigns/new-frontier/assets/guide.png');
  assert.equal(defaultProfile(content).portraitId,'guide-face');
  assert.equal(JSON.stringify(content).includes('/campaigns/granaderos/'),false);
  let s=initialCampaign(8,content);const guide=rosterFor(s).find(c=>c.contentId==='guide');assert.ok(guide);
  s=dispatchCampaign(s,{type:'recruitCivic',id:guide.id,term:'day',destination:'camp'});assert.equal(s.lastError,null);
  assert.deepEqual(s.recruited,[guide.id]);
  const loaded=decodeSave(encodeSave(s)).campaign;
  assert.equal(loaded.location,'camp');assert.equal(loaded.campaignOrigin.id,'new-frontier');
  assert.equal(campaignStorageKey(loaded),'granaderos.campaign.v2.new-frontier');
  assert.equal(rosterFor(loaded).find(c=>c.id===guide.id).portrait,'/campaigns/new-frontier/assets/guide.png');
  await assert.rejects(scaffoldCampaign('new-frontier',folder),/EEXIST/);
  assert.deepEqual(await checkCampaign(folder),content);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('author checks use build validation and reject invalid data, changed resources and linked files',async()=>{
 const root=await mkdtemp(join(tmpdir(),'campaign-author-'));
 try{
  const folder=await scaffoldCampaign('new-frontier',join(root,'new-frontier')),asset=join(folder,'assets/guide.png'),original=await readFile(asset);
  await writeFile(asset,'changed');await assert.rejects(checkCampaign(folder),/checksum mismatch/);
  await writeFile(asset,original);
  const file=join(folder,'maps/camp.json'),map=JSON.parse(await readFile(file,'utf8'));map.terrain[0].type='invalid';await writeFile(file,JSON.stringify(map));await assert.rejects(checkCampaign(folder),/Mapa camp/);
  map.terrain[0].type='grass';await writeFile(file,JSON.stringify(map));
  await symlink(asset,join(folder,'linked.png'));await assert.rejects(checkCampaign(folder),/symbolic link/);
  await assert.rejects(scaffoldCampaign('granaderos',join(root,'granaderos')),/new lower-case/);
  await assert.rejects(scaffoldCampaign('new-frontier',join(root,'other-name')),/match/);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('asset refresh retains resource identity and admits changed bytes only after an explicit refresh',async()=>{
 const root=await mkdtemp(join(tmpdir(),'campaign-author-'));
 try{
  const folder=await scaffoldCampaign('new-frontier',join(root,'new-frontier'));
  const file=join(folder,'assets/guide.png'),before=JSON.parse(await readFile(join(folder,'assets.json'),'utf8'));
  // A valid alternate PNG keeps the picture usable while changing its bytes.
  const image=await readFile(file);await writeFile(file,Buffer.concat([image,Buffer.from('author revision')]));
  await assert.rejects(checkCampaign(folder),/checksum mismatch/);
  const refreshed=await refreshAuthorAssets(folder);
  assert.equal(refreshed[0].id,before.assets[0].id);assert.equal(refreshed[0].path,before.assets[0].path);
  assert.notEqual(refreshed[0].sha256,before.assets[0].sha256);
  assert.equal((await checkCampaign(folder)).campaignOrigin.id,'new-frontier');
  const manifest=await readFile(join(folder,'assets.json'),'utf8');
  await symlink(file,join(folder,'assets/linked.png'));
  await assert.rejects(refreshAuthorAssets(folder),/regular files/);
  assert.equal(await readFile(join(folder,'assets.json'),'utf8'),manifest);
 }finally{await rm(root,{recursive:true,force:true});}
});
