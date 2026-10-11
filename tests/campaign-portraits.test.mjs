import test from 'node:test';
import assert from 'node:assert/strict';
import {campaignCharacterPortraits,campaignCharacterPortrait,NEUTRAL_CHARACTER_PORTRAIT} from '../game/campaign-portraits.js';
import {DEFAULT_PRESENTATION,DEFAULT_CATALOGUE} from '../campaigns/default.js';

test('stock portraits have one source and retain the compatibility catalogue',()=>{
 assert.equal(campaignCharacterPortraits(),DEFAULT_PRESENTATION.characterPortraits);
 assert.equal(DEFAULT_CATALOGUE.characterPortraits,DEFAULT_PRESENTATION.characterPortraits);
 assert.equal(campaignCharacterPortrait('avatar-man-gaucho').src,'/campaigns/granaderos/assets/avatar-man-gaucho.webp');
});

test('a selected campaign supplies its own portrait menu and never inherits stock faces',()=>{
 const portrait={id:'my-guide',name:'Guía',src:'/campaigns/another/assets/guide.webp',gender:'woman',role:'scout',skinTone:'dark',spriteSkinTone:'dark',spriteAppearance:'surgeon'};
 const content={scenario:'generic-v1',characters:[],presentation:{characterPortraits:[portrait]}};
 assert.deepEqual(campaignCharacterPortraits({contentCampaign:{package:content}}),[portrait]);
 assert.equal(campaignCharacterPortrait('avatar-man-gaucho',content),undefined);
 assert.equal(campaignCharacterPortrait('my-guide',content),portrait);
});

test('a generic campaign can derive a menu from its cast or use the neutral placeholder',()=>{
 const content={scenario:'generic-v1',characters:[{id:'guide',name:'Guía',portrait:'/campaigns/another/assets/guide.webp',skinTone:'dark',spriteAppearance:'woman-shawl'},{id:'duplicate',name:'Duplicado',portrait:'/campaigns/another/assets/guide.webp'},{id:'unsafe',name:'Externo',portrait:'https://example.com/face.webp'}]};
 const portraits=campaignCharacterPortraits(content);
 assert.equal(portraits.length,1);
 assert.equal(portraits[0].src,'/campaigns/another/assets/guide.webp');
 assert.equal(portraits[0].skinTone,'dark');
 assert.equal(portraits[0].spriteAppearance,'woman-shawl');
 assert.deepEqual(campaignCharacterPortraits({scenario:'generic-v1',characters:[]}),[NEUTRAL_CHARACTER_PORTRAIT]);
 assert.deepEqual(campaignCharacterPortraits({scenario:'generic-v1',presentation:{characterPortraits:[]}}),[NEUTRAL_CHARACTER_PORTRAIT]);
 assert.deepEqual(campaignCharacterPortraits({campaignStory:{},characters:[]}),[NEUTRAL_CHARACTER_PORTRAIT]);
});
