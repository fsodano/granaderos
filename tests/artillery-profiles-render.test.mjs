import test from 'node:test';import assert from 'node:assert/strict';
import {ARTILLERY} from '../game/artillery-definitions.js';
import {defaultContentPackage} from '../game/content-package.js';
import {initialCampaign} from '../game/campaign.js';
import {enterSector} from '../game/world.js';
import {order,saved} from './local-contract-fixture.mjs';
import {mountCampaign} from './mounted-campaign-fixture.mjs';
test('production battlefield renders the launched cannon image and its authored name after a full save',async t=>{
 const d=defaultContentPackage();d.artilleryProfiles=structuredClone(ARTILLERY);Object.assign(d.artilleryProfiles.swivel,{name:'Pedrero del Puerto',art:'/art/weapon-1801.png',price:99,initialLoaded:false,initialAmmo:2});let s=order(initialCampaign(42,d),{type:'createOfficer',name:'Isabel del Valle',answers:{origin:'cabildo',doctrine:'line_marksman',crisis:'rally'}});s=order(s,{type:'purchaseEquipment',item:'swivel'});s=order(s,{type:'attack',sector:'buenos_aires'});const p=saved({campaign:s,battle:enterSector({...s.pendingBattle,hour:s.hour})}),m=await mountCampaign(t,p);
 const gun=m.document.querySelector('[aria-label="Seleccionar Pedrero del Puerto"]');assert.ok(gun);assert.equal(gun.querySelector('image').getAttribute('href'),'/art/weapon-1801.png');assert.ok([...m.document.querySelectorAll('select[aria-label="Seleccionar pieza de artillería"] option')].some(o=>o.textContent.includes('Pedrero del Puerto')));assert.equal(m.saved().battle.artillery[0].ammo,2);assert.equal(m.saved().battle.artillery[0].loaded,false);
});
