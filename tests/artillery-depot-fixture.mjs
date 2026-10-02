import {wakeBatteryCrew} from './stationed-artillery-fixture.mjs';
import {advanceCampaignHours} from './campaign-wait-fixture.mjs';
import assert from 'node:assert/strict';
import {fieldGun} from './artillery-transport-fixture.mjs';
import {order,saved} from './local-contract-fixture.mjs';
import {contentFixtureCache} from './content-fixture-cache.mjs';
export const homeDepotGun=contentFixtureCache(content=>{
 let s=fieldGun(content);const gun=s.sectorStates.san_nicolas.artillery[0];s=order(s,{type:'transportArtillery',sector:'san_nicolas',artilleryId:gun.id,to:'retiro',mode:'carts'});const due=s.artilleryTransfers[0].dueAt;s=order(s,{type:'travel',sector:'retiro'});s=wakeBatteryCrew(s);if(s.hour<due)s=advanceCampaignHours(s,due-s.hour);assert.equal(s.artilleryDepots.retiro[0].id,gun.id);s=saved({campaign:s}).campaign;return wakeBatteryCrew(s);
});
