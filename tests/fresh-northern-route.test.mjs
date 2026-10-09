import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {encodeSave} from '../game/save.js';
import {enterSector} from '../game/world.js';
import {freshNorthernRoute} from './fresh-northern-fixture.mjs';

test('a funded Retiro force reaches Yatasto through paid replacements and actual northern victories with saved replay',()=>{
 const onCheckpoint=(name,campaign)=>{if(process.env.GRANADEROS_NORTHERN_CHECKPOINT_PREFIX){const battle=campaign.pendingBattle?enterSector(campaign.pendingBattle,campaign.sectorStates[campaign.pendingBattle.sector]):null;writeFileSync(`${process.env.GRANADEROS_NORTHERN_CHECKPOINT_PREFIX}-${name}.json`,encodeSave(campaign,battle));}};
 const {campaign,notes}=freshNorthernRoute({onCheckpoint});
 assert.deepEqual(notes.slice(0,3).map(n=>n.sector),['cordoba','tucuman','salta']);
 assert.equal(notes.at(-1).stage,'yatasto');assert.ok(campaign.resources.treasury>0);
 assert.ok(notes.some(n=>n.deaths.includes(1000)),'the created officer stays dead while the campaign continues');
});
