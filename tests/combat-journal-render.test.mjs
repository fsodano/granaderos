import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {createBattle} from '../game/tactical.js';
import {playerKnownBattle} from '../game/player-known-state.js';
import {mountBattlefield} from './mounted-battlefield.mjs';
const {default:CombatJournal}=await import('../web/app/CombatJournal.tsx');
const {default:Battlefield}=await import('../web/app/Battlefield.tsx');
const nodes=node=>!node||typeof node!=='object'?[]:[node,...(Array.isArray(node)?node:Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).flatMap(nodes)];

test('the collapsed panel displays only the shared public history, newest first',()=>{
 const battle={turn:3,log:['PRIVATE 95% 45 PA'],publicJournal:{version:1,entries:[{turn:1,text:'Primer suceso.'},{turn:3,text:'Último suceso.'}]}};
 const html=render(h(CombatJournal,{battle}));
 assert.match(html,/<details class="combat-journal">/);assert.match(html,/<summary>Diario de combate<\/summary>/);
 assert.ok(html.indexOf('Último suceso.')<html.indexOf('Primer suceso.'));assert.ok(!html.includes('PRIVATE'));
 const legacy=render(h(CombatJournal,{battle:{turn:3,log:battle.log}}));assert.match(legacy,/Aún no hay sucesos registrados/);assert.ok(!legacy.includes('PRIVATE'));
});

for(const phase of ['player','interrupt','defeat'])test(`Battlefield keeps the journal available during ${phase}`,async t=>{
 const battle=createBattle([{id:'p',x:1,y:1}],{width:8,height:8,enemies:[{id:'e',x:6,y:6}]});
 if(phase==='defeat'){battle.status='defeat';battle.units[0].hp=0;battle.units[0].ap=0;}
 else if(phase==='interrupt'){battle.phase='interrupt';battle.interrupt={side:'player',unitIds:['p'],enemyId:'e'};}
 const mounted=await mountBattlefield(t,Battlefield,{battle,onChange(){},onFinish(){}});
 const journal=nodes(mounted.tree()).find(node=>node.type===CombatJournal);assert.ok(journal);assert.equal(journal.props.battle,battle);
 const html=render(h(CombatJournal,journal.props));for(const entry of playerKnownBattle(battle).journal)assert.ok(html.includes(entry.text));
 assert.match(html,/<details class="combat-journal">/);
});
