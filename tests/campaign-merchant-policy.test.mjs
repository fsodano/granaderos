import test from 'node:test';
import assert from 'node:assert/strict';
import {merchantProfile,merchantBuyingTerms,merchantWeaponRefusal,legacyMerchantAmmunitionLimit,validateMerchantPolicies} from '../game/merchant-preferences.js';
import {migrateCampaignAmmunition} from '../game/physical-ammunition.js';
import {resaleBreakdown} from '../game/equipment.js';
import {defaultContentPackage} from '../game/content-package.js';
import {initialCampaign,restoreCampaign,serializeCampaign} from '../game/campaign.js';
import {foundryFor} from '../game/campaign-foundry.js';
import {defaultStartingTerritory} from '../game/content-territory.js';

const context={scenario:'generic-v1',world:{defaultHeadquarters:'post',sectors:[{id:'post',name:'La posta'},{id:'port',name:'El puerto'}]}};
const policies={preferences:{post:{name:'Taller de la posta',description:'Recupera las herramientas del camino.',buyPercent:20,preferredPercent:60,preferredItems:[1803],minimumWeaponCondition:50,weaponRefusal:'Repará primero la herramienta.'}},legacyAmmunitionLimits:{port:0},defaultLegacyAmmunitionLimit:7};
const configured={...context,world:{...context.world,merchantPolicies:policies}};

test('generic omission has no stock labels, item preferences, condition refusal or Ensenada exception',()=>{
 for(const id of ['retiro','cordoba','mendoza']){assert.equal(merchantProfile(id,context),null);assert.deepEqual(merchantBuyingTerms(id,1803,context),{percent:40,fraction:.4,preferred:false});assert.equal(merchantWeaponRefusal(id,{condition:1},context),null);}
 assert.equal(legacyMerchantAmmunitionLimit(context,'ensenada'),60);assert.equal(legacyMerchantAmmunitionLimit(null,'ensenada'),0);
});

test('custom local market policy prices finite physical equipment and rejects malformed preferences',()=>{
 assert.deepEqual(validateMerchantPolicies(policies,context.world),[]);assert.equal(merchantProfile('post',configured).name,'Taller de la posta');assert.deepEqual(merchantBuyingTerms('post',1803,configured),{percent:60,fraction:.6,preferred:true});
 const item={item:1803,condition:50};assert.equal(resaleBreakdown(item,'post',configured).total,54);assert.equal(resaleBreakdown({...item,condition:49},'post',configured).reason,'Repará primero la herramienta.');assert.equal(resaleBreakdown(item,'post',configured).reason,null);
 for(const mutate of [p=>p.preferences.foreign=p.preferences.post,p=>p.preferences.post.buyPercent=80,p=>p.preferences.post.preferredItems=[999],p=>p.legacyAmmunitionLimits.foreign=2]){const p=structuredClone(policies);mutate(p);assert.ok(validateMerchantPolicies(p,context.world).length>0);}
});

test('legacy ammunition migration reads the selected campaign cap and retains stock migration separately',()=>{
 const state={contentCampaign:{package:configured},economyVersion:1,merchants:{post:{},port:{}},resources:{treasury:10,cartridges:0},operativeState:{}};migrateCampaignAmmunition(state,[],{fresh:true});
 assert.deepEqual(state.merchants.post.ammunition,{musket_75:21,rifle_62:7,pistol_69:21,shot_16:14});assert.deepEqual(state.merchants.port.ammunition,{musket_75:0,rifle_62:0,pistol_69:0,shot_16:0});
 const before=structuredClone(state);migrateCampaignAmmunition(state);assert.deepEqual(state,before);
});

test('generic headquarters and foundry defaults use the selected location and neutral descriptions',()=>{
 assert.deepEqual(defaultStartingTerritory(undefined,context),{post:{owner:'patriot',loyalty:65},port:{owner:'royalist',loyalty:25}});assert.deepEqual(foundryFor(context),{sector:'post',name:'Taller del cuartel',armyName:'Fuerza de campaña',setupCost:0,fundingCost:0});
 const d=defaultContentPackage();Object.assign(d,{scenario:'generic-v1',includeOriginalResidents:false,errands:[],roadsideDiscoveries:[],placements:[],quests:[],campaignRoles:{foundryEngineer:null,marchCommander:null}});d.characters=d.characters.filter(c=>c.id==='person-110');Object.assign(d.characters[0],{traits:[],abilities:[],recruitmentSource:'contract',service:'contract',progression:'experience'});delete d.foundry;
 const s=initialCampaign(8,d),loaded=restoreCampaign(serializeCampaign(s));assert.equal(foundryFor(loaded).name,'Taller del cuartel');assert.equal(merchantProfile('cordoba',loaded),null);
});
