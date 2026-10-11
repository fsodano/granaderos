import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCampaign} from '../game/campaign.js';
import {defaultContentPackage} from '../game/content-package.js';
import {defaultCampaignStory} from '../game/campaign-story.js';
import {questsFor,NPC_QUESTS} from '../game/quests.js';
import {validateQuestContext} from '../game/quest-definitions.js';
import {encodeSave,decodeSave} from '../game/save.js';

test('a historical legacy package preserves omitted errands through save restore',()=>{
 const content=defaultContentPackage();delete content.errands;
 const campaign=initialCampaign(8,content);
 assert.equal(campaign.errandDefinitions,undefined);
 assert.deepEqual(questsFor(campaign),NPC_QUESTS);
 const restored=decodeSave(encodeSave(campaign)).campaign;
 assert.equal(restored.errandDefinitions,undefined);
 assert.deepEqual(questsFor(restored),NPC_QUESTS);
});

test('an older authored story with no saved errand collection cannot inherit stock deliveries',()=>{
 const content=defaultContentPackage();delete content.errands;content.campaignStory=defaultCampaignStory();
 const campaign=initialCampaign(8,content);
 assert.deepEqual(campaign.errandDefinitions,[]);
 // An older saved story can omit this field. Its story still defines the scope.
 delete campaign.errandDefinitions;
 const restored=decodeSave(encodeSave(campaign)).campaign;
 assert.deepEqual(questsFor(restored),[]);
 assert.doesNotThrow(()=>validateQuestContext(restored,{errandDefinitions:[]}));
 assert.throws(()=>validateQuestContext(restored,{errandDefinitions:structuredClone(NPC_QUESTS)}),/encargos/);
});

test('explicit generic campaigns use no stock fallback and reject a foreign tactical collection',()=>{
 const campaign={contentCampaign:{package:{scenario:'generic-v1'}}};
 assert.deepEqual(questsFor(campaign),[]);
 assert.doesNotThrow(()=>validateQuestContext(campaign,{errandDefinitions:[]}));
 assert.throws(()=>validateQuestContext(campaign,{errandDefinitions:structuredClone(NPC_QUESTS)}),/encargos/);
});
