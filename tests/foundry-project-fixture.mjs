import {rolePackage} from './campaign-roles-fixture.mjs';
import {defaultStartingTerritory} from '../game/content-territory.js';
export function foundryPackage(){
 const d=rolePackage();d.headquarters='salta';d.startingTerritory=defaultStartingTerritory('salta');d.startingTerritory.jujuy.owner='patriot';d.foundry={sector:'jujuy',name:'Taller del Norte',armyName:'Ejército del Norte Libre',setupCost:137,fundingCost:809};return d;
}
