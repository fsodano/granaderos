import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {componentTree} from './component-tree.mjs';import {createBattle,canSee} from '../game/tactical.js';
import {rosterCells} from '../game/ja2-hud.js';
import {validateBattleSnapshot} from '../game/validate-battle.js';
const {default:Roster}=await import('../web/app/JA2Roster.tsx');
const descendants=n=>!n||typeof n!=='object'?[]:[n,...(Array.isArray(n)?n:Array.isArray(n.props?.children)?n.props.children:[n.props?.children]).flatMap(descendants)];
const noop=()=>{};
const field=()=>createBattle([
 {id:'a',name:'Fusilero',weapon:1800,blade:1813,weaponMode:'melee',weaponFittings:{bayonet:{weapon:1811,fittingPattern:'india_socket',condition:0,instanceId:'socket'}}},
 {id:'b',name:'Tirador',weapon:1805,blade:0,offHand:{weapon:1808,count:1,weight:1.3,loaded:2,condition:61},leftHandItem:'offhand'},
 {id:'c',name:'Médico',weapon:0,blade:0,activeSlot:'medical',medkits:2,leftHandItem:'medkits'},
 {id:'d',name:'Explorador',weapon:0,blade:0,activeSlot:'tool',activeTool:'inventory:key',inventory:{key:{kind:'tool',toolKey:'key',keyId:'gate',count:1,weight:.1}}},
 {id:'e',name:'Cuchillero',weapon:0,blade:1813,activeSlot:'blade'},
 {id:'f',name:'Mensajero',weapon:0,blade:0,activeSlot:'unarmed'},
].map((u,i)=>({...u,x:1+i,y:1})),{width:12,height:8,exploration:true,enemies:[]});
const props=b=>({battle:b,players:b.units,selected:'a',onSelect:noop,onOpenInventory:noop});
test('portrait loading progress survives admitted restoration and stays distinct from ready charges in each hand',()=>{
 // Current saved-state fixture; it makes no native wounded-cycle claim.
 const battle=validateBattleSnapshot(createBattle([{id:'a',name:'Cargador',weapon:1808,loaded:1,reloadProgress:.71,ammo:9,offHand:{weapon:1805,count:1,weight:1.3,loaded:0,condition:61,reloadProgress:.43},leftHandItem:'offhand'}],{exploration:true,enemies:[]})),before=structuredClone(battle);
 const tree=componentTree(Roster,props(battle)),card=descendants(tree).find(n=>n.props?.role==='listitem'),hands=descendants(card).filter(n=>n.props?.['data-hand-side']);
 assert.match(card.props['aria-label'],/Mano principal.*1 carga\(s\).*71% del próximo cartucho/);assert.match(card.props['aria-label'],/Segunda mano.*0 carga\(s\).*43% del próximo cartucho/);
 assert.match(hands[0].props.title,/71% del próximo cartucho/);assert.match(hands[1].props.title,/43% del próximo cartucho/);
 const markup=render(h(Roster,props(battle)));assert.match(markup,/class="roster-hand-load">1<span class="roster-hand-loading"[^>]*> ·71%/);assert.match(markup,/class="roster-hand-load">0<span class="roster-hand-loading"[^>]*> ·43%/);assert.deepEqual(battle,before);
 for(const loaded of [0,2]){const old=createBattle([{id:'a',weapon:1808,loaded,ammo:9}],{exploration:true,enemies:[]});assert.doesNotMatch(render(h(Roster,props(old))),/Recarga en curso/);}
});

test('six occupied cards contain twelve noninteractive hand slots, real art, icons and independent status stars',()=>{
 const b=field(),html=render(h(Roster,props(b))),tree=componentTree(Roster,props(b)),cards=descendants(tree).filter(n=>n.props?.role==='listitem');
 assert.equal(cards.length,6);assert.equal((html.match(/data-hand-side=/g)||[]).length,12);assert.doesNotMatch(html,/ja2-weapon-line/);assert.equal((html.match(/class="close-combat"/g)||[]).length,2);assert.equal((html.match(/class="attachment"/g)||[]).length,1);
 for(const card of cards){const children=descendants(card).slice(1);assert.ok(!children.some(n=>n.type==='button'));assert.equal(children.filter(n=>n.props?.['data-hand-side']).length,2);}
 const first=cards[0],hands=descendants(first).filter(n=>n.props?.['data-hand-side']);assert.equal(hands[0].props['data-close-combat'],true);assert.equal(hands[0].props['data-attachment'],true);assert.equal(hands[1].props['data-hand-item'],'');
 assert.match(first.props['aria-label'],/Combate cercano activo/);assert.match(first.props['aria-label'],/Bayoneta para Brown Bess India \(roto\)/);assert.match(first.props['aria-label'],/Segunda mano: ocupada/);
 assert.match(html,/src="\/art\/weapon-1800.png"/);assert.match(html,/src="\/art\/weapon-1808.png"/);assert.equal((html.match(/src="\/art\/weapon-1813.png"/g)||[]).length,1,'only the active knife is rendered; the rifleman stowed knife stays hidden');assert.match(html,/lucide-cross/);assert.match(html,/lucide-key-round/);
});

test('hand display keeps card selection, additive selection, keyboard click and right-click details intact',()=>{
 const b=field(),selected=[],opened=[];const tree=componentTree(Roster,{...props(b),onSelect:(...args)=>selected.push(args),onOpenInventory:id=>opened.push(id)}),card=descendants(tree).find(n=>n.props?.role==='listitem');
 card.props.onClick({shiftKey:false,detail:0});card.props.onClick({shiftKey:true});card.props.onContextMenu({preventDefault(){}});card.props.onDoubleClick();assert.deepEqual(selected,[['a',false],['a',true]]);assert.deepEqual(opened,['a','a']);assert.equal(card.props.disabled,undefined);
});

test('empty roster cells and later pages stay six cells wide without phantom held items',()=>{
 const b=field();let html=render(h(Roster,{...props(b),players:b.units.slice(0,2)}));assert.equal((html.match(/empty-portrait-slot/g)||[]).length,4);assert.equal((html.match(/data-hand-side=/g)||[]).length,4);
 const units=[...b.units,...b.units.slice(0,2).map(u=>({...u,id:`later-${u.id}`}))];html=render(h(Roster,{...props(b),players:units,selected:'later-b'}));assert.equal((html.match(/class="ja2-portrait-cell /g)||[]).length,2);assert.equal((html.match(/empty-portrait-slot/g)||[]).length,4);assert.equal((html.match(/data-hand-side=/g)||[]).length,4);assert.match(html,/2 \/ 2/);
});

test('the squad strip uses an edited weapon image and its selected ammunition family',async()=>{
 const {compileWeaponDefinition}=await import('../game/weapon-definition.js');
 const definition=compileWeaponDefinition({id:'roster-pistol',template:1808,name:'Pistola del editor',damage:20,fireAP:12,aimAP:1,readyAP:2,reloadAP:20,range:15,capacity:2,weight:1.5,price:100,art:'/art/custom-pistol.png',ammunitionFamily:'ammoMusket',alternativeLoads:[{family:'ammoRifle',damage:15,range:20,pattern:'single'}]});
 const battle=createBattle([{id:'edited',name:'Tirador',weapon:1808,blade:0,weaponMetadata:{contentWeapon:definition},ammunitionChoice:'ammoRifle',loaded:1,ammunition:{ammoMusket:8,ammoRifle:3},ammo:11}],{exploration:true,enemies:[]});
 const markup=render(h(Roster,{battle,players:battle.units,selected:'edited',onSelect:noop,onOpenInventory:noop}));
 assert.ok(markup.includes('src="/art/custom-pistol.png"'));assert.match(markup,/Pistola del editor/);assert.match(markup,/3 de reserva/);assert.ok(!markup.includes('11 de reserva'));
});


test('personal enemy counts follow each observer sight and AP remains explicit at zero',()=>{
 const battle=createBattle([{id:'watcher',name:'Vigía',x:2,y:2,facing:2},{id:'away',name:'Retaguardia',x:2,y:6,facing:6}],{width:10,height:10,enemies:[{id:'one',x:5,y:2},{id:'two',x:6,y:2}]});
 battle.tiles.forEach(t=>{t.type='grass';t.blocked=false;t.cover=0;});battle.units[0].ap=19;battle.units[1].ap=0;
 const players=battle.units.filter(u=>u.side==='player'),cells=rosterCells(players,'watcher',battle);
 assert.equal(cells[0].visibleEnemyCount,2);assert.equal(cells[1].visibleEnemyCount,0);
 for(const cell of cells.filter(c=>c.unit))assert.equal(cell.visibleEnemyCount,battle.units.filter(e=>e.side==='enemy'&&e.hp>0&&canSee(battle,cell.unit,e)).length);
 const html=render(h(Roster,{...props(battle),players,selected:'watcher'}));
 assert.match(html,/Vigía ve 2 enemigos/);assert.match(html,/Retaguardia ve 0 enemigos/);
 assert.match(html,/class="ja2-ap-readout"[^>]*>19<small>PA/);assert.match(html,/class="ja2-ap-readout"[^>]*>0<small>PA/);
 battle.units.find(u=>u.id==='one').hp=0;assert.equal(rosterCells(players,'watcher',battle)[0].visibleEnemyCount,1);
});

test('treated and untreated wounds remain distinct and a dead card shows a skull with empty vitals',()=>{
 const battle=createBattle([{id:'wounded',name:'Herido',x:1,y:1,maxHp:100,hp:50,bandaged:20,bleeding:3,morale:65},{id:'dead',name:'Caído',x:2,y:1,hp:0}],{width:8,height:8,enemies:[]});
 const cells=rosterCells(battle.units,'wounded',battle);assert.equal(cells[0].bandaged,20);assert.equal(cells[0].untreated,30);assert.equal(cells[0].moralePct,65);assert.equal(cells[1].dead,true);assert.equal(cells[1].moralePct,0);
 const tree=componentTree(Roster,{...props(battle),players:battle.units,selected:'wounded'}),cards=descendants(tree).filter(n=>n.props?.role==='listitem'),dead=cards[1];
 assert.match(dead.props['aria-label'],/Muerto/);assert.doesNotMatch(dead.props['aria-label'],/Salud|energía|Ve \d/);
 const vitals=descendants(dead).find(n=>n.props?.className==='ja2-vitals');assert.equal(vitals.props['aria-hidden'],true);
 for(const fill of descendants(vitals).filter(n=>n.type==='i'))assert.equal(fill.props.style.height,'0%');
 const html=render(h(Roster,{...props(battle),players:battle.units,selected:'wounded'}));assert.match(html,/ja2-dead-skull/);assert.match(html,/Heridas sin tratar: 30/);assert.match(html,/class="morale" style="height:65%"/);
});
