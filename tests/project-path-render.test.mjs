import {register} from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {createBattle} from '../game/tactical.js';
import {compileWeaponDefinition} from '../game/weapon-definition.js';

// This is the value Vite supplies for a project build. Root rendering has its
// own existing tests, in separate Node test processes.
globalThis.__GRANADEROS_BASE_PATH__='/granaderos';
register('./tactical-render-loader.mjs',import.meta.url);
const {default:ContentEditor}=await import('../web/app/story/page.tsx');
const {default:CharacterCreator}=await import('../web/app/CharacterCreator.tsx');
const {default:Roster}=await import('../web/app/JA2Roster.tsx');
const {default:SpriteFigure}=await import('../web/app/SpriteFigure.tsx');
const {ArchitectureDefs}=await import('../web/app/TacticalArchitectureMaterials.tsx');

function assertHostedUrls(markup){
 const local=[...markup.matchAll(/(?:src|href)="(\/[^\"]+)"/g)].map(match=>match[1]);
 assert.ok(local.length>0);
 for(const url of local)assert.ok(url.startsWith('/granaderos/'),url);
}

test('the story editor keeps navigation, campaign downloads and build metadata in the project',()=>{
 const markup=render(h(ContentEditor));
 assertHostedUrls(markup);
 assert.ok(markup.includes('href="/granaderos/editor/"'));
 assert.ok(markup.includes('href="/granaderos/?content=1"'));
 assert.ok(markup.includes('href="/granaderos/campaigns/la-ruta-de-las-postas.json"'));
 assert.ok(markup.includes('href="/granaderos/build-info.json"'));
});

test('catalog portrait and sprite textures load from the project folder',()=>{
 assertHostedUrls(render(h(CharacterCreator,{onCreate(){}})));
 const markup=render(h('svg',null,h(ArchitectureDefs),h(SpriteFigure,{unit:{id:3,hp:100,skinTone:'dark'},position:{x:0,y:0},motion:{direction:4,frame:0,moving:false}})));
 assertHostedUrls(markup);
 assert.match(markup,/href="\/granaderos\/art\/skin\//);
 assert.match(markup,/href="\/granaderos\/art\/architecture-plaster-v2.png"/);
});

test('edited weapon art is resolved for display and remains portable in battle state',()=>{
 const definition=compileWeaponDefinition({id:'edited-pistol',template:1808,name:'Pistola editada',damage:20,fireAP:12,aimAP:1,readyAP:2,reloadAP:20,range:15,capacity:2,weight:1.5,price:100,art:'/art/custom-pistol.png'});
 const battle=createBattle([{id:'edited',name:'Tirador',weapon:1808,blade:0,weaponMetadata:{contentWeapon:definition},loaded:1,ammo:3}],{exploration:true,enemies:[]}),before=JSON.stringify(battle);
 const markup=render(h(Roster,{battle,players:battle.units,selected:'edited',onSelect(){},onOpenInventory(){}}));
 assertHostedUrls(markup);
 assert.ok(markup.includes('src="/granaderos/art/custom-pistol.png"'));
 assert.equal(JSON.stringify(battle),before);
 assert.equal(definition.art,'/art/custom-pistol.png');
});
