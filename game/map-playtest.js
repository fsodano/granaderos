import {prepareFiniteArsenalRequest} from './finite-artillery-arsenals.js';
import {enterSector} from './world.js';
import { compileMap } from "./compile-map.js";
import { validateMap } from "./map-schema.js";
import { createBattle } from "./tactical.js";
import {campaignDefinitions,campaignWorld,campaignFactions} from './campaign-definition.js';
import {authoredPresentation} from './content-character-presentation.js';
import {hasGenericCharacterDefinitions} from './content-character-ids.js';
import {startingCharacterCondition} from './character-condition.js';
import {startingCharacterSupplies} from './character-supplies.js';
import {authoredForceEquipment} from './content-force-equipment.js';
import {weaponMetadata,weaponSpecification} from './weapon-definition.js';
import {regionalConditions} from './regional-weather.js';

function previewUnits(map,content){
 const state={contentCampaign:{package:content}},generic=hasGenericCharacterDefinitions(content);
 const factions=campaignFactions(content),faction=side=>{
  if(side==='civilian')return 'Habitante';
  const ids=side==='player'?['patriot','directory']:['royalist','royalists'];
  return factions.find(f=>ids.includes(f.id))?.name??(side==='player'?'Tu escuadra':'Enemigo');
 };
 let playerIndex=0;
 return map.spawns.map(spawn=>{
  const character=spawn.side==='player'&&content.characters.length?content.characters[playerIndex++%content.characters.length]:null;
  let unit={...spawn,name:spawn.name??character?.name??faction(spawn.side),weapon:0,blade:0,loaded:0,ammo:0,traits:[],abilities:[],spriteAppearance:generic?'worker':spawn.side==='enemy'?'royalist':'granadero',skinTone:'brown',...(generic?{genericCharacter:true}:{})};
  if(character){
   const primary=content.weapons.find(w=>w.id===character.weapon),blade=content.weapons.find(w=>w.id===character.blade);
   unit={...unit,...character.attributes,...authoredPresentation(character),...startingCharacterCondition(character),...startingCharacterSupplies(character),contentId:character.id,portrait:character.portrait,traits:[...(character.traits??[])],abilities:[...(character.abilities??[])],weapon:primary?.template??0,blade:blade?.template??0,...(primary?{weaponMetadata:weaponMetadata(primary)}:{}),...(blade?{bladeMetadata:weaponMetadata(blade)}:{})};
   const cartridges=content.rules?.deploymentCartridges??0,capacity=weaponSpecification(unit)?.capacity??0;
   unit.loaded=Math.min(capacity,cartridges);unit.ammo=capacity?cartridges-unit.loaded:0;
  }else if(spawn.side==='enemy')unit=authoredForceEquipment(state,'oppositionEquipment','line',unit,content.rules?.enemyCartridges??0);
  return unit;
 });
}
/** @param {*} context Selected campaign package or state; omitted preserves legacy previews. */
export function createMapPlaytest(document,context=null,{expanded=false}={}) {
  const checked = validateMap(document, { playable: true });
  if (!checked.valid) throw Error(checked.errors.join("\n"));
  const map = compileMap(document),content=campaignDefinitions(context),
    units = content?.characters?previewUnits(map,content):map.spawns.map((s) => ({
      id: s.id,
      name: s.name ?? (s.side === "player" ? "Granadero" : "Realista"),
      x: s.x,
      y: s.y,
      side: s.side,
      weapon: 1800,
    }));
  const sector=content?campaignWorld(content).sectors.find(s=>s.id===document.id):null;
  const selected=content?{...content,maps:{...content.maps,[document.id]:structuredClone(document)}}:null;
  const request={id:document.id,sector:document.id,name:document.metadata?.title??sector?.name??document.id,biome:sector?.biome??'plains',campaignPackage:selected,compactLayout:!expanded,exploration:true,squad:units.filter(s=>s.side==='player'),enemies:units.filter(s=>s.side==='enemy'),npcs:units.filter(s=>s.side==='civilian'),...(sector?regionalConditions(document.id,12,selected):{})};
  if(selected)prepareFiniteArsenalRequest({contentCampaign:{package:selected},sectors:selected.startingTerritory??{}},request);
  const battle=selected&&document.width===20&&document.height===16?enterSector(request):createBattle(units.filter(s=>s.side==='player'),{...map,exploration:true,enemies:units.filter(s=>s.side==='enemy'),npcs:units.filter(s=>s.side==='civilian')});
  battle.sourceMapId = document.id;
  battle.sourceMapRevision = document.revision;
  if(content)battle.campaignPackage=structuredClone(selected);
  return battle;
}
