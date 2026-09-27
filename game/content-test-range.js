import {weaponMetadata} from './weapon-definition.js';
import { resolveContent } from "./content-package.js";
import { createBattle, WEAPONS, actBattle, shotChance, actionCosts } from "./tactical.js";
// The first adapter reuses a verified firearm family for ammunition/handling.
// Authored IDs remain distinct; it never replaces the global weapon catalog.
export function createContentTestRange(content, characterId, seed = 18130203) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw Error("Semilla inválida.");
  const definitions = resolveContent(content),
    character = definitions.characters.find((c) => c.id === characterId);
  if (!character) throw Error("Seleccioná un personaje.");
  const weapon = definitions.weapons.find((w) => w.id === character.weapon);
  if (!weapon) throw Error("Asigná un arma de fuego para probar el tiro.");
  const unit = {
    ...character.attributes,
    id: character.id,
    name: character.name,
    nickname: character.nickname,
    hp: character.attributes.maxHp,
    weapon: weapon.template,
    weaponMetadata: weaponMetadata(weapon),
    ammo: 20,
    blade: 1813,
    x: 2,
    y: 5,
    facing: 2,
  };
  const battle = createBattle([unit], {
    id: "content-test-range",
    name: "Prueba de contenido",
    seed,
    width: 16,
    height: 12,
    enemies: [
      {
        id: "target",
        name: "Oponente de prueba",
        x: 8,
        y: 5,
        hp: 100,
        maxHp: 100,
        weapon: 1800,
        overwatch: false,
        patrol: false,
      },
    ],
    weather: { rain: 0, humidity: 0 },
    tiles: Array.from({ length: 16 * 12 }, (_, i) => ({
      x: i % 16,
      y: Math.floor(i / 16),
      type: "grass",
      cover: 0,
      blocked: false,
    })),
  });
  // A clear range isolates weapon and character values from map generation.
  battle.tiles = battle.tiles.map((t) => ({ ...t, type: "grass", cover: 0, blocked: false }));
  battle.contentTest = { characterId, weaponId: weapon.id };
  return battle;
}

// A disposable trial uses the same admission rules as an actual firing order.
export function contentShotPreview(battle,unit,target){
 const attempt=actBattle(battle,{type:'fire',unitId:unit.id,targetId:target.id,aim:0});
 return {reason:attempt.lastError??null,chance:shotChance(battle,unit,target,0),pa:actionCosts(battle,unit).fire};
}
