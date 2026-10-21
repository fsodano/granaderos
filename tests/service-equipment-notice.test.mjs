import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_WORLD} from '../campaigns/default.js';
import {serviceEquipmentReturnReason} from '../game/service-equipment-notice.js';

const marker=(sectorId,siteId=sectorId)=>({id:'service-return-7',sectorId,siteId,entryEdge:'S',entryAnchor:{x:10,y:15}});
const state=(returned,toolkitPoints=0)=>({operativeState:{110:{location:'buenos_aires',serviceEquipmentReturn:returned,toolkitPoints}}});

test('the rehire notice uses the fixed departure location and remaining repair materials without reading the battlefield',()=>{
 const s=state(marker('cordoba'),65),before=structuredClone(s);
 for(const key of ['sectorStates','sceneStates','enemyGroups','civilianState'])Object.defineProperty(s,key,{get(){assert.fail(`The notice must not inspect ${key}`);}});
 const reason=serviceEquipmentReturnReason(s,110);
 assert.match(reason,/equipo que dejó en Córdoba/);
 assert.match(reason,/Equipo del sector.*combatiente presente, consciente y despierto/);
 assert.match(reason,/sector reconocido y seguro/);
 assert.match(reason,/65 puntos de «Materiales de reparación»/);
 assert.doesNotMatch(reason,/Buenos Aires|service-return-7|entryAnchor/);
 assert.deepEqual(s.operativeState,before.operativeState);
});

test('mission and rural returns name the actual site instead of the recruit current location',()=>{
 const mission=serviceEquipmentReturnReason(state(marker('tucuman','yatasto')),110);
 assert.match(mission,/Conferencia de Yatasto \(Tucumán\)/);
 assert.match(mission,/En «Lugar», elegí «Conferencia de Yatasto»/);
 const rural=serviceEquipmentReturnReason(state(marker('cell-27-27')),110);
 assert.match(rural,/Celda 28,28/);
 assert.doesNotMatch(rural,/cell-27-27|Lugar|Materiales de reparación/);
});

test('authored sector names are used and only the blocked recruit owns the notice',()=>{
 const s=state(marker('cordoba'),1);
 s.contentCampaign={package:{scenario:'generic-v1',world:{...DEFAULT_WORLD,sectors:DEFAULT_WORLD.sectors.map(sector=>sector.id==='cordoba'?{...sector,name:'Puesto del Sauce'}:sector)}}};
 s.operativeState[111]={location:'retiro'};
 s.serviceEquipmentReturns={version:1,nextId:2,entries:[{operativeId:111,sectorId:'retiro',siteId:'retiro'}]};
 const reason=serviceEquipmentReturnReason(s,110);
 assert.match(reason,/Puesto del Sauce/);assert.match(reason,/1 punto de «Materiales de reparación»/);assert.doesNotMatch(reason,/Córdoba|1 puntos/);
 assert.equal(serviceEquipmentReturnReason(s,111),null);
 delete s.operativeState[110].serviceEquipmentReturn;
 assert.equal(serviceEquipmentReturnReason(s,110),null);
 assert.equal(serviceEquipmentReturnReason(null,110),null);
});
