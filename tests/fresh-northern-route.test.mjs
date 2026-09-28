import test from 'node:test';
import assert from 'node:assert/strict';
import {freshNorthernRoute} from './fresh-northern-fixture.mjs';

test('a fresh Retiro force reaches Yatasto through paid replacements and actual northern victories with saved replay',()=>{
 const {campaign,notes}=freshNorthernRoute();
 assert.deepEqual(notes.slice(0,3).map(n=>n.sector),['cordoba','tucuman','salta']);
 assert.equal(notes.at(-1).stage,'yatasto');assert.ok(campaign.resources.treasury>0);
 assert.ok(notes.some(n=>n.deaths.includes(1000)),'the created officer stays dead while the campaign continues');
});
