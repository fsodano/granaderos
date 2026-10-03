import test from 'node:test';
import assert from 'node:assert/strict';
import {operativeIdForCharacter,characterForOperative,legacyOperativeId} from '../game/content-character-ids.js';
import {OPERATIVES} from '../game/data.js';
import {CIVIC_RECRUITS} from '../game/civic-recruits.js';

const content=()=>({characters:[{id:'custom-b',name:'B'},{id:'person-3',name:'Cabral'},{id:'custom-a',name:'A'}]});
const state=packageValue=>({contentCampaign:{package:packageValue}});

test('all original operative IDs retain their saved identity',()=>{
 for(const operative of [...OPERATIVES,...CIVIC_RECRUITS])assert.equal(legacyOperativeId(`person-${operative.id}`),operative.id);
 for(const value of ['custom-a','person-1000',null,undefined,3])assert.equal(legacyOperativeId(value),undefined);
});

test('mutable character membership and ID changes remain visible after repeated lookups',()=>{
 const packageValue=content(),campaign=state(packageValue);
 assert.equal(operativeIdForCharacter(packageValue,'custom-a'),2000);
 assert.equal(operativeIdForCharacter(packageValue,'custom-b'),2001);
 assert.equal(characterForOperative(campaign,3).name,'Cabral');
 packageValue.characters.reverse();
 assert.equal(operativeIdForCharacter(packageValue,'custom-a'),2000);
 packageValue.characters.push({id:'custom-0',name:'New'});
 assert.equal(operativeIdForCharacter(packageValue,'custom-a'),2001);
 assert.equal(characterForOperative(campaign,2000).name,'New');
 packageValue.characters.splice(packageValue.characters.findIndex(c=>c.id==='custom-0'),1);
 assert.equal(operativeIdForCharacter(packageValue,'custom-a'),2000);
 const b=packageValue.characters.find(c=>c.id==='custom-b');b.id='custom-0';
 assert.equal(operativeIdForCharacter(packageValue,'custom-b'),undefined);
 assert.equal(operativeIdForCharacter(packageValue,'custom-a'),2001);
 assert.equal(characterForOperative(campaign,2000),b);
});

test('definition replacements, edited fields and cloned save packages use their current objects',()=>{
 const packageValue=content(),campaign=state(packageValue);
 assert.equal(characterForOperative(campaign,2000).name,'A');
 const replacement={id:'custom-a',name:'Edited'};
 packageValue.characters[2]=replacement;
 assert.equal(characterForOperative(campaign,2000),replacement);
 replacement.name='Renamed';
 assert.equal(characterForOperative(campaign,2000).name,'Renamed');
 const clone=structuredClone(packageValue),clonedState=state(clone);
 assert.equal(characterForOperative(clonedState,2000).name,'Renamed');
 assert.notEqual(characterForOperative(clonedState,2000),replacement);
 Object.freeze(packageValue);replacement.id='person-4';
 assert.equal(operativeIdForCharacter(packageValue,'custom-a'),undefined);
 assert.equal(characterForOperative(campaign,4),replacement);
 assert.equal(operativeIdForCharacter(clone,'custom-a'),2000);
});
