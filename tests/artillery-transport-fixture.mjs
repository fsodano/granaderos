import assert from 'node:assert/strict';
import {wonBattery,fireStationed} from './stationed-artillery-fixture.mjs';
import {order,saved,visit,leave} from './local-contract-fixture.mjs';
let prepared;
export function fieldGun(content){
 if(!content&&prepared)return structuredClone(prepared);
 let s=wonBattery(content);const cash=s.resources.treasury;s=order(s,{type:'transport',mode:'carts'});assert.equal(s.resources.treasury,cash-180);s=leave(fireStationed(visit(s)));s=saved({campaign:s}).campaign;if(!content)prepared=s;return structuredClone(s);
}
