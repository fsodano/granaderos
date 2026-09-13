import {register} from 'node:module';register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {createElement as h} from '../web/node_modules/react/index.js';import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {initialCampaign,dispatchCampaign} from '../game/campaign.js';import {prepareCampaignBattle} from '../game/battle-handoff.js';
import {createBattle,actBattle} from '../game/tactical.js';import {beginSectorDeployment,sectorDeploymentModel} from '../game/sector-deployment.js';
import {encodeSave,decodeSave} from '../game/save.js';import {syncBattleTime} from '../game/time.js';
const {default:SectorDeployment,SectorDeploymentPanel}=await import('../web/app/SectorDeployment.tsx');
const nodes=node=>!node||typeof node!=='object'?[]:[node,...(Array.isArray(node)?node:Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).flatMap(nodes)];
const label=node=>typeof node==='string'?node:Array.isArray(node)?node.map(label).join(''):node?.props?label(node.props.children):'';
const order=(s,a)=>{const next=dispatchCampaign(s,a);assert.equal(next.lastError,null,next.lastError);return next;};
function paidArrival(){
 let campaign=initialCampaign(8);campaign=order(campaign,{type:'recruitCivic',id:110,term:'week'});campaign=order(campaign,{type:'recruitCivic',id:114,term:'week'});campaign=order(campaign,{type:'attack',sector:'buenos_aires'});
 const pair=prepareCampaignBattle(campaign,{placement:true});assert.equal(pair.error,null);assert.ok(pair.battle.deployment);return pair;
}
function controls(initial){
 let battle=initial,selection={unitId:'',wholeSquad:false},mapped=0;const updates=[];
 const tree=()=>SectorDeploymentPanel({battle,selection,onSelection:next=>selection=next,onChange:next=>{updates.push(next);battle=next;},onMap:()=>mapped++});
 const find=predicate=>nodes(tree()).find(predicate);
 return {get battle(){return battle;},get selection(){return selection;},get mapped(){return mapped;},updates,tree,
  button:text=>find(node=>node.type==='button'&&label(node)===text),
  soldier:id=>find(node=>node.type==='button'&&node.props['aria-label']?.startsWith(`Seleccionar ${sectorDeploymentModel(battle).units.find(u=>u.id===id).name}.`)),
  cell:(index=0)=>nodes(tree()).filter(node=>node.props?.['data-deployment-cell'])[index],
  selectGroup:id=>find(node=>node.type==='select').props.onChange({target:{value:id}}),
 };
}

test('arrival overview renders only its public terrain and own arrivals, with one keyboard entry point',()=>{
 const {battle}=paidArrival();battle.units.find(u=>u.side==='enemy').name='ENEMY_SECRET';battle.npcs.push({id:'secret',name:'NPC_SECRET',x:5,y:5});battle.groundItems=[{id:'secret-loot',name:'LOOT_SECRET',x:5,y:5}];
 const before=structuredClone(battle),html=render(h(SectorDeployment,{battle,onChange:()=>{}})),ui=controls(battle),model=sectorDeploymentModel(battle);
 assert.match(html,/LLEGADA AL SECTOR/);assert.match(html,/2 pendientes/);assert.doesNotMatch(html,/ENEMY_SECRET|NPC_SECRET|LOOT_SECRET|<img|Salud|Munición/);
 const entries=nodes(ui.tree()).filter(node=>node.props?.['data-deployment-cell']);assert.equal(entries.length,model.entryCells.N.length);assert.ok(entries.length<=battle.width);assert.ok(entries.length<battle.tiles.length/10);
 assert.equal(entries.filter(node=>node.props.tabIndex===0).length,1);assert.ok(entries.every(node=>node.props['aria-label'].includes('borde norte')));assert.equal(ui.button('Entrar al sector').props.disabled,true);assert.deepEqual(battle,before);
});

test('clicking an entry cell places one selected soldier; squad placement groups only its own arrivals',()=>{
 const {battle}=paidArrival(),ui=controls(battle),before=structuredClone(battle.units);
 ui.cell(3).props.onClick();assert.deepEqual(Object.keys(ui.battle.deployment.placements),['110']);assert.equal(ui.battle.lastError,null);assert.equal(ui.button('Entrar al sector').props.disabled,true);
 ui.soldier('114').props.onClick();assert.equal(ui.selection.unitId,'114');ui.cell(8).props.onClick();assert.equal(Object.keys(ui.battle.deployment.placements).length,2);assert.equal(ui.button('Entrar al sector').props.disabled,false);
 ui.button('Escuadra').props.onClick();ui.cell(4).props.onClick();const positions=Object.values(ui.battle.deployment.placements);assert.equal(new Set(positions.map(p=>`${p.x},${p.y}`)).size,2);assert.ok(positions.every(p=>p.y===0));assert.ok(Math.abs(positions[0].x-positions[1].x)<=1);
 assert.deepEqual(ui.battle.units,before,'draft choices do not move actual units or change equipment, health, energy or AP');assert.equal(ui.battle.elapsedSeconds,0);
});

test('clear, spread and campaign-map controls preserve the saved placement boundary',()=>{
 const {campaign,battle}=paidArrival(),ui=controls(battle),before=structuredClone(battle.units);
 ui.button('Distribuir').props.onClick();assert.equal(sectorDeploymentModel(ui.battle).ready,true);assert.equal(ui.battle.lastError,null);
 ui.button('Quitar selección del mapa').props.onClick();assert.equal(ui.battle.deployment.placements['110'],undefined);assert.ok(ui.battle.deployment.placements['114']);assert.equal(ui.button('Entrar al sector').props.disabled,true);
 ui.button('Carta de campaña').props.onClick();assert.equal(ui.mapped,1);assert.equal(ui.updates.length,2,'opening the campaign map does not cancel or confirm placement');
 const saved=decodeSave(encodeSave(campaign,ui.battle));assert.deepEqual(saved.battle.deployment,ui.battle.deployment);assert.match(render(h(SectorDeployment,{battle:saved.battle,onChange:()=>{}})),/1 pendiente/);
 ui.button('Quitar todos').props.onClick();assert.deepEqual(ui.battle.deployment.placements,{});assert.equal(ui.button('Quitar todos').props.disabled,true);assert.deepEqual(ui.battle.units,before);assert.equal(ui.battle.elapsedSeconds,0);
});

function coordinatedField(){
 const squad=Array.from({length:48},(_,i)=>({id:`u${i+1}`,name:`Soldado ${i+1}`,nickname:`Soldado ${i+1}`,weapon:1800,x:i%48+1,y:8,entryReason:'arrival',entryEdge:i<24?'N':'S',entryAnchor:{x:10,y:i<24?0:15}}));
 const assaultSquads=Array.from({length:8},(_,i)=>({id:`q${i+1}`,name:`Columna ${i+1}`,members:squad.slice(i*6,i*6+6).map(u=>u.id)}));
 const battle=createBattle(squad,{width:64,height:48,enemies:[],exploration:true,deferContact:true});battle.sectorName='Sector de prueba';
 assert.equal(beginSectorDeployment(battle,{squad,assaultSquads}),true);return battle;
}
test('eight squads remain selectable in a compact six-person list and use their own edge',()=>{
 const ui=controls(coordinatedField());assert.equal(nodes(ui.tree()).filter(node=>node.type==='option').length,8);
 assert.equal(nodes(ui.tree()).filter(node=>node.type==='li').length,6);
 ui.selectGroup('q8');assert.equal(ui.selection.unitId,'u43');assert.ok(ui.cell().props['aria-label'].includes('borde sur'));ui.button('Escuadra').props.onClick();ui.cell(30).props.onClick();assert.equal(ui.battle.lastError,null);
 assert.deepEqual(Object.keys(ui.battle.deployment.placements),['u43','u44','u45','u46','u47','u48']);assert.ok(Object.values(ui.battle.deployment.placements).every(p=>p.y===47));assert.equal(sectorDeploymentModel(ui.battle).remaining,42);
 ui.button('Distribuir').props.onClick();assert.equal(ui.battle.lastError,null);assert.equal(sectorDeploymentModel(ui.battle).remaining,0);assert.equal(new Set(Object.values(ui.battle.deployment.placements).map(p=>`${p.x},${p.y}`)).size,48);assert.equal(nodes(ui.tree()).filter(node=>node.type==='li').length,6);
});

test('the keyboard moves focus between authorized edge cells and Enter or Space places the selection',()=>{
 const ui=controls(paidArrival().battle);let prevented=0,focused=-1;
 const buttons=[0,1,2].map((n)=>({tabIndex:n===0?0:-1,focus(){focused=n;}}));for(const button of buttons)button.parentElement={querySelectorAll:()=>buttons};
 ui.cell().props.onKeyDown({key:'ArrowRight',currentTarget:buttons[0],preventDefault(){prevented++;}});assert.equal(focused,1);assert.equal(buttons[0].tabIndex,-1);assert.equal(buttons[1].tabIndex,0);
 ui.cell().props.onKeyDown({key:'End',currentTarget:buttons[1],preventDefault(){prevented++;}});assert.equal(focused,2);assert.equal(ui.updates.length,0);
 ui.cell(3).props.onKeyDown({key:'Enter',preventDefault(){prevented++;}});assert.ok(ui.battle.deployment.placements['110']);
 ui.soldier('114').props.onClick();ui.cell(5).props.onKeyDown({key:' ',preventDefault(){prevented++;}});assert.ok(ui.battle.deployment.placements['114']);assert.equal(prevented,4);assert.equal(ui.battle.lastError,null);
});

test('an incomplete confirmation retains the draft and presents the reducer error',()=>{
 const battle=paidArrival().battle,rejected=actBattle(battle,{type:'confirmDeployment'});assert.ok(rejected.lastError);assert.deepEqual(rejected.deployment,battle.deployment);
 const ui=controls(rejected);assert.equal(ui.button('Entrar al sector').props.disabled,true);const alerts=nodes(ui.tree()).filter(node=>node.props?.role==='alert');assert.equal(alerts.length,1);assert.equal(label(alerts[0]),rejected.lastError);
});

test('the page opens placement, confirmation uses the normal clock handoff, and an active save never reopens placement',()=>{
 const page=readFileSync(new URL('../web/app/page.tsx',import.meta.url),'utf8');assert.match(page,/prepareCampaignBattle\(state,\{placement:true\}\)/);assert.match(page,/battle\.deployment\?<SectorDeployment[^\n]*?onChange=\{updateBattle\}[^\n]*?\/>:<Battlefield/);
 const {campaign,battle}=paidArrival(),ui=controls(battle);ui.button('Distribuir').props.onClick();assert.equal(ui.button('Entrar al sector').props.disabled,false);ui.button('Entrar al sector').props.onClick();assert.equal(ui.battle.lastError,null);assert.equal(ui.battle.deployment,undefined);assert.equal(ui.battle.deploymentComplete,true);
 const pair=syncBattleTime(campaign,ui.battle);assert.equal(pair.error,null);const saved=decodeSave(encodeSave(pair.campaign,pair.battle));assert.equal(render(h(SectorDeployment,{battle:saved.battle,onChange:()=>{}})),'');assert.equal(saved.battle.syncedSeconds,saved.battle.elapsedSeconds);
 const resumed=prepareCampaignBattle({...saved.campaign,pendingBattle:{...saved.campaign.pendingBattle,resumeSnapshot:saved.battle}},{placement:true});assert.equal(resumed.error,null);assert.deepEqual(resumed.battle,saved.battle);
 for(const action of ['placeDeployment','clearDeployment','spreadDeployment','confirmDeployment']){assert.match(page,new RegExp(`enum:\\[[^\\]]*'${action}'`));assert.match(page,new RegExp(`!\\[[^\\]]*'${action}'[^\\]]*\\]\\.includes\\(action.type\\)`));}
 assert.match(page,/'deployment' in known\?\{deployment:known.deployment\}/,'WebMCP returns the safe placement model after an order');
});
