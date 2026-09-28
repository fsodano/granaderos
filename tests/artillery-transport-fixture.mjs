import assert from 'node:assert/strict';
import {wonBattery,fireStationed} from './stationed-artillery-fixture.mjs';
import {order,saved,visit,leave} from './local-contract-fixture.mjs';
let prepared;
export function fieldGun(){
 if(prepared)return structuredClone(prepared);
 let s=wonBattery();const cash=s.resources.treasury;s=order(s,{type:'transport',mode:'carts'});assert.equal(s.resources.treasury,cash-180);s=leave(fireStationed(visit(s)));prepared=saved({campaign:s}).campaign;return structuredClone(prepared);
}
