import test from 'node:test';
import assert from 'node:assert/strict';
import {scaffoldDocuments} from '../tools/campaign-authoring.mjs';
import {compileCampaignPackage} from '../game/campaign-library.js';
import {createMapPlaytest} from '../game/map-playtest.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
import {regionalWeatherAt} from '../game/regional-weather.js';
import {createBattle,weaponFor,bladeFor} from '../game/tactical.js';
import {buildSectorMap} from '../game/maps.js';
import {turnModel} from '../game/ja2-hud.js';

function independent(configure=files=>{}){
 const files=scaffoldDocuments('preview-frontier');
 configure(files);
 return compileCampaignPackage(files.manifest,{content:files.content,world:files.world,maps:files.maps,presentation:files.presentation,assets:files.assets});
}
test('selected editor playtests use the package cast, equipment, names, appearance and weather',()=>{
 const content=independent(),document=content.maps.camp,before=JSON.stringify({content,document});
 const battle=createMapPlaytest(document,content),player=battle.units.find(u=>u.side==='player'),enemy=battle.units.find(u=>u.side==='enemy');
 assert.equal(battle.sectorName,'Campamento');assert.equal(player.name,'Guía del campamento');assert.equal(player.contentId,'guide');
 assert.equal(player.portrait,'/campaigns/preview-frontier/assets/guide.png');assert.equal(player.spriteAppearance,'surgeon');assert.equal(player.skinTone,'brown');
 assert.equal(player.weapon,0);assert.equal(bladeFor({...player,activeSlot:'blade'}).name,'Herramienta de campo');assert.deepEqual(player.abilities,[]);
 assert.equal(enemy.name,'La oposición');assert.equal(enemy.weapon,0);assert.equal(enemy.spriteAppearance,'worker');assert.equal(enemy.skinTone,'brown');
 assert.deepEqual(battle.weather,regionalWeatherAt('camp',12,content));assert.deepEqual(battle.campaignPackage,content);assert.notEqual(battle.campaignPackage,content);
 assert.equal(turnModel(battle).label,'Turno 1 · La escuadra');assert.equal(turnModel({...battle,phase:'enemy'}).label,'Turno 1 · La oposición');
 assert.equal(turnModel({...battle,mode:'exploration'}).label,'Exploración libre');
 assert.deepEqual(validateBattleSnapshot(battle),battle);assert.equal(JSON.stringify({content,document}),before);
});

test('omitted enemy lists use neutral or authored generic force definitions and preserve legacy map equipment',()=>{
 const generic=independent(files=>{delete files.content.oppositionEquipment;delete files.content.oppositionBlades;});
 for(const content of [generic,{...generic,scenario:undefined}]){
  const map=buildSectorMap({sector:'camp',campaignPackage:content,compactLayout:true});assert.equal(map.enemies.length,3);
  for(const enemy of map.enemies)assert.deepEqual([enemy.weapon,enemy.blade,enemy.loaded,enemy.ammo,enemy.spriteAppearance,enemy.skinTone],[0,0,0,0,'worker','brown']);
  const battle=createBattle(map.squad,{...map,campaignPackage:content});
  assert.equal(turnModel(battle,content).label,'Turno 1 · La escuadra');assert.equal(turnModel({...battle,phase:'enemy'},content).label,'Turno 1 · La oposición');
  assert.ok(battle.units.filter(u=>u.side==='enemy').every(u=>u.weapon===0&&u.blade===0&&u.loaded===0&&u.ammo===0));
 }
 const configured=independent(files=>{const tool=files.content.weapons[0].id;files.content.oppositionEquipment={officer:tool,line:tool,veteran:tool};delete files.content.oppositionBlades;});
 const map=buildSectorMap({sector:'camp',campaignPackage:configured,compactLayout:true});
 for(const enemy of map.enemies){assert.equal(weaponFor(enemy).name,'Herramienta de campo');assert.equal(enemy.blade,0);assert.equal(enemy.ammo,0);}
 const legacy=buildSectorMap({sector:'retiro',compactLayout:true});assert.deepEqual(legacy.enemies.map(u=>u.weapon),[1801,1800,1800]);
});
test('selected preview assigns local primary definitions and leaves legacy one-argument map previews compatible',()=>{
 const content=structuredClone(independent()),blade=content.weapons[0];content.characters[0].weapon=blade.id;delete content.characters[0].blade;
 const battle=createMapPlaytest(content.maps.camp,{contentCampaign:{package:content}}),player=battle.units.find(u=>u.side==='player');
 assert.equal(weaponFor(player).name,'Herramienta de campo');assert.equal(player.blade,0);
 const legacy=createMapPlaytest(content.maps.camp);assert.equal(legacy.units[0].name,'Granadero');assert.equal(legacy.units[0].weapon,1800);assert.equal(legacy.campaignPackage,undefined);
 assert.equal(turnModel(legacy).label,'Turno 1 · Ejército patriota');
});
