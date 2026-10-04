import assert from 'node:assert/strict';
import {equipmentCatalogItem,isImportedEquipment} from '../game/equipment.js';

// An old save's finite, already-paid order. No current purchase or debit.
export function withLegacyPaidCargo(state,item=1802,{quantity=1,due=96}={}){
 const next=structuredClone(state);
 assert.ok(isImportedEquipment(equipmentCatalogItem(item,next)));
 next.equipmentShipments.push({item,quantity,due});return next;
}
