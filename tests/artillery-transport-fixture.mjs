import assert from 'node:assert/strict';
import {wonBattery,fireStationed} from './stationed-artillery-fixture.mjs';
import {order,saved,visit,leave} from './local-contract-fixture.mjs';
import {contentFixtureCache} from './content-fixture-cache.mjs';
export const fieldGun=contentFixtureCache(content=>{
 let s=wonBattery(content);const cash=s.resources.treasury;s=order(s,{type:'transport',mode:'carts'});assert.equal(s.resources.treasury,cash-180);s=leave(fireStationed(visit(s)));return saved({campaign:s}).campaign;
});
