import {componentTree} from './component-tree.mjs';
import {register} from 'node:module';
register('./tactical-render-loader.mjs',import.meta.url);
import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from '../web/node_modules/react/index.js';
import {renderToStaticMarkup as render} from '../web/node_modules/react-dom/server.node.js';
import {createBattle,weaponFor,hasFirearm,actionCosts,actBattle,equipLootPreview} from '../game/tactical.js';
const {default:JA2Strip}=await import('../web/app/JA2Strip.tsx');
const {JA2OrdersPanel}=await import('../web/app/JA2OrdersMenu.tsx');
const {default:TacticalScene}=await import('../web/app/TacticalScene.tsx');
const {default:JA2EnvironmentPanel}=await import('../web/app/JA2EnvironmentPanel.tsx');
const {default:JA2GroupMovePanel}=await import('../web/app/JA2GroupMovePanel.tsx');
const {default:JA2ExitPanel}=await import('../web/app/JA2ExitPanel.tsx');
const {default:JA2CampaignReturn}=await import('../web/app/JA2CampaignReturn.tsx');
const {exitModel,fieldState}=await import('../game/ja2-hud.js');
const {motionDirection,takeMovementFacingOverride}=await import('../web/app/useUnitMotion.ts');
const project=(x,y)=>({x:300+(x-y)*26,y:65+(x+y)*14});
const fixture=()=>createBattle([{id:'scout',name:'Vigía',x:1,y:1}],{width:24,height:8,enemies:[{id:'far',name:'Enemigo oculto',x:22,y:6}],seed:45});
const noop=()=>{};
function stripProps(s,inventory=false,extra={}){
  const unit=s.units[0];
  return {battle:s,selected:unit.id,unit,players:[unit],missionAllies:[],localMilitia:[],mode:'move',showSight:false,aim:0,hitLocation:'torso',costs:actionCosts(s,unit),weapon:weaponFor(unit),firearm:hasFirearm(unit),cannonId:'',shotType:'solid',gunCosts:null,artillery:[],busy:false,inventoryId:inventory?unit.id:null,vw:1000,vh:700,cameraRect:{x:0,y:0,width:500,height:300},project,cameraX:0,cameraY:0,zoom:1,onSelect:noop,onOrder:noop,onMode:noop,onToggleSight:noop,onEndTurn:noop,onRetreat:noop,onOpenInventory:noop,onCloseInventory:noop,onCameraCenter:noop,onCameraPan:noop,onZoom:noop,onCannonChange:noop,onShotTypeChange:noop,onSetAim:noop,onHitLocationChange:noop,...extra};
}
const strip=(s,inventory=false,extra={})=>render(h(JA2Strip,stripProps(s,inventory,extra)));
const orders=(s,extra={})=>render(h(JA2OrdersPanel,stripProps(s,false,extra)));
function scene(s,positions={},extra={}){
  return render(h('svg',null,h(TacticalScene,{state:s,selected:'scout',unit:s.units[0],players:[s.units[0]],units:[s.units[0]],positions,poses:{},directions:{},hover:null,mode:'move',aim:0,reachable:[],showSight:false,sight:new Set(),revealed:new Set(),project,onTile:noop,onHover:noop,onTalk:noop,onCannon:noop,cannonId:'',...extra})));
}

test('inventory alone offers paid bayonet fitting and both removal destinations with separate conditions',()=>{
  const s=fixture(),u=s.units[0];Object.assign(u,{weapon:1800,activeSlot:'primary',condition:61,blade:1811,bladeCondition:73,bladeFittingPattern:'india_socket',bladeInstanceId:'socket-render'});
  let markup=strip(s,true);assert.match(markup,/Fijar al Brown Bess · 3 PA/);assert.match(markup,/suelta · estado 73% · 0.5 kg/);
  assert.ok(!strip(s).includes('Fijar al Brown Bess'));
  const fitted=actBattle(s,{type:'fitBayonet',unitId:u.id,item:'blade'});assert.equal(fitted.lastError,null);
  markup=strip(fitted,true);assert.match(markup,/fijada · estado 73%/);assert.match(markup,/Fusil: estado 61%/);
  assert.match(markup,/aria-label="Segunda mano: Ocupada por el arma"/);assert.match(markup,/class="blocked" disabled/);
  assert.ok(!markup.includes('aria-label="Equipar Bayoneta para Brown Bess India'));
  assert.match(markup,/Retirar a mochila · 2 PA/);assert.match(markup,/Retirar a secundaria · 2 PA/);
  assert.ok(!markup.includes('Calar bayoneta'));assert.match(markup,/Guardia de bayoneta/);
  const mismatch=structuredClone(s);mismatch.units[0].weapon=1801;
  const button=strip(mismatch,true).match(/<button[^>]*>Fijar al Brown Bess · 3 PA<\/button>/)?.[0];assert.match(button,/disabled=""/);
});

test('close-combat mode shows thrust cost without a shot percentage until explicit fire mode',()=>{
  const s=fixture(),u=s.units[0],enemy=s.units[1];
  Object.assign(u,{weapon:1800,x:1,y:1,activeSlot:'primary',weaponMode:'melee',weaponFittings:{bayonet:{weapon:1811,fittingPattern:'india_socket',condition:73,instanceId:'socket-render-close'}}});Object.assign(enemy,{x:3,y:1});
  const options={units:s.units,hover:enemy};
  assert.ok(!/>\d+%<\/text>/.test(scene(s,{},options)));
  assert.match(scene(s,{}, {...options,mode:'fire'}),/>\d+%<\/text>/);
  assert.match(orders(s,{target:enemy}),/Estocada de bayoneta · 4 PA/);
  assert.match(orders(s,{target:enemy,mode:'fire'}),/Disparo deliberado/);
  u.weaponFittings.bayonet.condition=0;assert.ok(!/>\d+%<\/text>/.test(scene(s,{},options)));assert.match(orders(s,{target:enemy}),/Culatazo|acercarse/);
});

test('figure activation uses its fixed person frame instead of the clipped atlas bounding box',()=>{
  const s=fixture(),u=s.units[0],enemy=s.units[1],orders=[];
  Object.assign(u,{x:15,y:8});Object.assign(enemy,{x:17,y:8,name:'Marinero'});
  const descendants=node=>!node||typeof node!=='object'?[]:[node,...(Array.isArray(node)?node:Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).flatMap(child=>descendants(child))];
  for(let facing=0;facing<8;facing++){
    enemy.facing=facing;
    const element=componentTree(TacticalScene,{state:s,selected:u.id,unit:u,players:[u],units:s.units,positions:{},poses:{},directions:{},hover:null,mode:'move',aim:0,reachable:[],showSight:false,sight:new Set(),revealed:new Set(),project,onTile:target=>orders.push(target),onHover:noop,onTalk:noop,onCannon:noop,cannonId:''});
    const nodes=descendants(element),figure=nodes.find(node=>node.props?.['data-unit-id']===enemy.id);
    const button=descendants(figure).find(node=>node.props?.role==='button');
    assert.equal(figure.props.role,undefined);assert.equal(figure.props.onClick,undefined);
    assert.equal(button.type,'rect');assert.equal(button.props['data-person-hit-target'],'true');
    assert.equal(button.props.children,undefined,'the click bounds contain no sprite atlas or animated frame');
    assert.equal(button.props.x,project(17,8).x-14);assert.equal(button.props.y,project(17,8).y-49);
    assert.equal(button.props.width,28);assert.equal(button.props.height,49);
    assert.match(button.props['aria-label'],/^Marinero · \d+ salud$/);
    button.props.onClick({clientY:25,currentTarget:{getBoundingClientRect:()=>({top:0,height:50})}});let prevented=false;button.props.onKeyDown({key:'Enter',preventDefault:()=>{prevented=true;}});assert.equal(prevented,true);
  }
  assert.equal(orders.length,16);assert.ok(orders.every(target=>target.id===enemy.id&&target.aimLocation==='torso'));
});

test('main controls expose facing and stealth while aim and body targeting stay on the battlefield',()=>{
  const s=fixture();let markup=orders(s);
  assert.match(markup,/aria-label="Mirar"/);assert.match(markup,/aria-label="Sigilo" aria-pressed="false"/);
  assert.doesNotMatch(markup,/aria-label="Zona de tiro"|Apuntar a cabeza|aria-label="Puntería"/);assert.match(markup,/Botón derecho: apuntar/);
  for(const label of ['Cargar','Atacar','Vendar','Cubrir'])assert.ok(!markup.includes(`aria-label="${label}"`));
  s.units[0].activeSlot='medical';s.units[0].stealthMode=true;markup=orders(s);
  assert.ok(!markup.includes('aria-label="Zona de tiro"'));assert.match(markup,/aria-label="Sigilo" aria-pressed="true"/);
  assert.match(markup,/Reduce la hemorragia y estabiliza heridas críticas hasta 15 de salud/);
});

test('automatic exploration is explained without a separate return button',()=>{
  const s=fixture();assert.doesNotMatch(strip(s),/Volver a explorar/);assert.match(orders(s),/automáticamente tras dos turnos completos/);
  s.units[1].lastKnownEnemy={x:1,y:1,turn:s.turn};assert.ok(!strip(s).includes('Volver a explorar'));
  delete s.units[1].lastKnownEnemy;s.phase='interrupt';s.interrupt={side:'player',unitIds:['scout'],enemyId:'far'};
  const markup=orders(s);assert.match(markup,/Continuar turno enemigo/);assert.match(markup,/Interrupción: usá los PA restantes/);assert.ok(!markup.includes('Volver a explorar'));
});

test('idle sprite directions follow all eight grid facings and preserve active movement',()=>{
  const s=fixture();
  for(let facing=0;facing<8;facing++){
    s.units[0].facing=facing;
    assert.match(scene(s),new RegExp(`data-unit-id="scout" data-moving="false" data-direction="${(facing+1)%8}"`));
  }
  assert.match(scene(s,{scout:{x:1.5,y:1,direction:3,frame:1,moving:true}}),/data-unit-id="scout" data-moving="true" data-direction="3"/);
});

test('noise rendering shows a brief direction hint and removes stale reports',()=>{
  const s=fixture();s.units[0].lastHeardNoise={x:7,y:3,turn:s.turn,kind:'fire',uncertainty:2,sourceId:'secret'};
  const markup=scene(s);assert.match(markup,/class="tactical-noise-direction"/);assert.doesNotMatch(markup,/>\?<\/text>|class="ja2-noise-marker"/);assert.match(markup,/aria-label="Ruido en esa dirección"/);
  assert.ok(!markup.includes('secret'));assert.ok(!markup.includes('Enemigo oculto'));assert.ok(!markup.includes('data-unit-id="far"'));
  s.turn+=4;assert.ok(!scene(s).includes('tactical-noise-direction'));
});

test('equipment panel keeps quantity, give/drop and selective pickup controls out of the combat strip',()=>{
  const s=fixture();s.groundItems.push({id:'loose',type:'item',item:'ammo',count:7,weight:.04,x:1,y:1});
  s.units[0].inventory.found={count:1,weight:4,weapon:1800,loaded:1,condition:63,jammed:true};
  const markup=strip(s,true);
  for(const label of ['Objeto para dar o soltar','Cantidad de objetos','Aliado que recibe el equipo','Objeto cercano para recoger','Cantidad para recoger'])assert.ok(markup.includes(`aria-label="${label}"`),label);
  assert.match(markup,/Manos del combatiente/);assert.match(markup,/Soltar aquí · 1 PA/);assert.match(markup,/Recoger · 2 PA/);
  assert.match(markup,/value="inventory:found"/);assert.match(markup,/estado 63%/);assert.match(markup,/4 grandes \/ 8 pequeños/);
  assert.match(markup,/En el suelo · Cartuchos · 7/);
  assert.ok(!strip(s).includes('Cantidad de objetos'));assert.ok(!strip(s).includes('Soltar aquí'));
});

test('equipping a small weapon cannot hide the space needed to store the current gun',()=>{
  const s=fixture(),u=s.units[0];u.inventory.pistol={weapon:1805,count:1,weight:1.3,loaded:1,condition:100};
  for(let i=0;i<4;i++)u.inventory[`pack${i}`]={count:1,weight:4,weapon:1800,loaded:0};
  const preview=equipLootPreview(s,u,'pistol','primary');assert.equal(preview.valid,false);
  assert.equal(actBattle(s,{type:'equipLoot',unitId:u.id,inventoryKey:'pistol',slot:'primary'}).lastError,preview.reason);
  assert.match(strip(s,true),/Bolsillo grande 4/);
  delete u.inventory.pack3;assert.equal(equipLootPreview(s,u,'pistol','primary').valid,true);
});

test('the environment panel never renders closed contents or an unknown trap',()=>{
  const target={key:'container:box',kind:'container',label:'Cofre',open:false,locked:true,trapKnown:false};
  const props={targets:[target],selected:target.key,target,preview:{label:'Inspeccionar',pa:8,chance:null,valid:true,reason:null},verbs:[],verb:'',busy:false,contents:[{index:0,label:'Secreto de prueba',count:3}],contentIndex:0,count:1,loot:{pa:8,valid:true},onTarget:noop,onVerb:noop,onUse:noop,onContent:noop,onCount:noop,onLoot:noop};
  const closed=render(h(JA2EnvironmentPanel,props));
  assert.ok(!closed.includes('Secreto de prueba'));assert.ok(!closed.includes('Trampa detectada'));assert.ok(!closed.includes('% de éxito'));
  assert.match(closed,/contenido permanece oculto/);
  const opened=render(h(JA2EnvironmentPanel,{...props,target:{...target,open:true,trapKnown:true}}));
  assert.match(opened,/Secreto de prueba/);assert.match(opened,/Trampa detectada/);assert.match(opened,/aria-label="Cantidad del cofre"/);
});

test('the real inventory renders equipped tools and only reveals an open nearby container',()=>{
  const s=fixture(),u=s.units[0];Object.assign(u,{mechanical:80,activeSlot:'tool',activeTool:'inventory:picks'});
  u.inventory.picks={itemType:'tool',toolKey:'lockpick',count:1,condition:47,weight:.4};
  s.props.push({id:'sealed',type:'chest',x:2,y:1,open:false,locked:true,contents:[{item:'ammo',count:137,weight:.04}],trap:{type:'alarm',difficulty:73,discoveredBy:[],armed:true}});
  const closed=strip(s,true);assert.ok(!closed.includes('aria-label="Equipar herramienta"'));assert.match(closed,/Ganzúas/);assert.match(closed,/[Ee]stado 47%/);assert.match(closed,/Forzar con ganzúas/);assert.ok(!closed.includes('Cartuchos · 137'));assert.ok(!closed.includes('Trampa detectada'));
  s.props[0].open=true;s.props[0].locked=false;
  const open=strip(s,true);assert.match(open,/Cartuchos · 137/);assert.match(open,/aria-label="Cantidad del cofre"/);
});

test('optional squad bandaging stays in medical equipment and reports untreated casualties',()=>{
  const s=createBattle([{id:'scout',name:'Sanitario',medical:80,hp:75,bleeding:2}],{exploration:true,enemies:[]});
  const ready=strip(s,true,{onAutoBandage:noop});
  const button=ready.match(/<button[^>]*>Vendar heridos<\/button>/)?.[0];
  assert.ok(button);assert.ok(!button.includes('disabled'));assert.match(ready,/Usa tiempo, fuerzas y vendas/);
  assert.ok(!strip(s,false,{onAutoBandage:noop}).includes('Vendar heridos'));
  const report=strip(s,true,{onAutoBandage:noop,bandageReport:{treatedIds:['one'],elapsedSeconds:9,untreated:[{id:'blocked',name:'Herido aislado',reason:'No hay un camino abierto.'}]}});
  assert.match(report,/1 atendidos · 9 s/);assert.match(report,/Herido aislado: No hay un camino abierto/);
  s.mode='combat';
  const blocked=strip(s,true,{onAutoBandage:noop}).match(/<button[^>]*>Vendar heridos<\/button>/)?.[0];
  assert.ok(blocked);assert.match(blocked,/disabled=""/);assert.match(blocked,/sector seguro/);
});

test('supplies use ordinary pockets and hands without dedicated selectors',()=>{
  const s=fixture(),u=s.units[0];Object.assign(u,{activeSlot:'supply',activeSupply:'torches'});
  const inventory=strip(s,true);
  assert.ok(!inventory.includes('aria-label="Equipar pertrecho"'));
  assert.ok(!inventory.includes('aria-label="Equipar herramienta"'));
  assert.match(inventory,/aria-label="Bolsillos del combatiente"/);
  assert.match(inventory,/aria-label="Manos del combatiente"/);

  for(const label of ['Arrojar antorcha','Lanzar boleadoras','Comer tasajo'])assert.ok(!new RegExp(`<button[^>]*>[^<]*${label}`).test(inventory),label);
  const main=orders(s);assert.match(main,/Antorcha · 2,5 PA/);assert.match(main,/Para avanzar, cambiá el objeto en mano/);assert.ok(!main.includes('aria-label="Zona de tiro"'));
  assert.ok(!main.includes('aria-label="Equipar pertrecho"'));
  Object.assign(u,{activeSupply:'rations',energy:45});
  const ration=orders(s);assert.match(ration,/Ración de tasajo · 2,5 PA/);assert.match(ration,/Seleccionate a vos para comer/);
  u.torches=0;u.boleadoras=0;u.rations=0;u.activeSlot='unarmed';delete u.activeSupply;
  assert.ok(!strip(s,true).includes('aria-label="Equipar pertrecho"'));
});

test('group selection renders portrait membership, planned slots, and clear individual-control return',()=>{
  const s=fixture();assert.match(strip(s,false,{groupIds:['scout']}),/En el grupo de marcha/);
  assert.match(strip(s,false,{groupIds:['scout']}),/group-selected/);
  const members=[{id:'scout',name:'Vigía'},{id:'medic',name:'Sanitario'}];
  const markup=render(h(JA2GroupMovePanel,{members,anchorId:'scout',busy:false,onRemove:noop,onClear:noop,preview:{ok:true,members:[{unitId:'scout',destination:{x:4,y:2},path:[{x:4,y:2}],reason:''},{unitId:'medic',destination:null,path:[],reason:'La ruta está bloqueada.'}]}}));
  assert.match(markup,/Vigía · referencia/);assert.match(markup,/Quitar a Sanitario del grupo/);assert.match(markup,/Vigía: C5 · 1 pasos/);assert.match(markup,/Sanitario: La ruta está bloqueada/);assert.match(markup,/Volver a órdenes individuales/);
  const stopped=render(h(JA2GroupMovePanel,{members:[],busy:false,onRemove:noop,onClear:noop,report:{reason:'Contacto enemigo: continúa con órdenes individuales.',elapsedSeconds:9,names:{scout:'Vigía'},members:[{unitId:'scout',status:'stopped',reason:'La marcha se detuvo.'}]}}));
  assert.match(stopped,/Contacto enemigo/);assert.match(stopped,/Vigía: La marcha se detuvo/);assert.match(stopped,/Cerrar parte de marcha/);assert.ok(!stopped.includes('Quitar a'));
});

test('group route details stay collapsed before, during, and after a preview',()=>{
  const members=[{id:'scout',name:'Vigía'},{id:'medic',name:'Sanitario'}];
  const props={members,anchorId:'scout',busy:false,onRemove:noop,onClear:noop};
  const views=[
    render(h(JA2GroupMovePanel,props)),
    render(h(JA2GroupMovePanel,{...props,preview:{ok:true,members:members.map((member,index)=>({unitId:member.id,destination:{x:3,y:4+index},path:[{x:3,y:4+index}],reason:''}))}})),
    render(h(JA2GroupMovePanel,{...props,preview:{ok:false,reason:'La ruta está bloqueada. '.repeat(30)}})),
    render(h(JA2GroupMovePanel,props)),
  ];
  const routeTag=markup=>markup.match(/<details class="ja2-group-preview"[^>]*>/)?.[0];
  assert.ok(routeTag(views[0]));
  for(const markup of views)assert.equal(routeTag(markup),routeTag(views[0]));
  assert.doesNotMatch(routeTag(views[0]),/ open(?:[ =]|>)/);
  assert.match(views[0],/<summary>Ruta del grupo<\/summary>/);
  assert.match(views[0],/Señalá una casilla libre para ver la ruta/);
  assert.ok(!views[0].includes('sin destino'));
  assert.match(views[1],/Vigía: E4 · 1 pasos/);
  assert.match(views[2],/La ruta está bloqueada/);
  const large=render(h(JA2GroupMovePanel,{...props,members:Array.from({length:12},(_,index)=>({id:String(index),name:`Soldado ${index}`}))}));
  assert.doesNotMatch(routeTag(large),/ open(?:[ =]|>)/);
});

test('settled exploration offers a campaign report separately from physical exit orders',()=>{
  const battle=createBattle([{id:'medic',name:'Sanitario',x:1,y:1},{id:'patient',name:'Herido',x:1,y:2,hp:1,unconscious:true}],{width:10,height:8,exploration:true,enemies:[]});
  battle.sectorCleared=false;
  const props={battle,peacefulVisit:true,busy:false,onFinish:noop};
  const markup=render(h(JA2CampaignReturn,props));
  assert.match(markup,/>Volver a la campaña<\/button>/);
  assert.match(markup,/La escuadra permanece en este sector/);
  assert.ok(!markup.includes('Cruzar el borde'));
  assert.match(render(h(JA2CampaignReturn,{...props,busy:true})),/disabled=""/);
  assert.equal(render(h(JA2CampaignReturn,{...props,peacefulVisit:false})), '');
  battle.sectorCleared=true;
  assert.match(render(h(JA2CampaignReturn,{...props,peacefulVisit:false})),/Volver a la campaña/);
  battle.units.push({id:'hidden',side:'enemy',hp:100,x:9,y:7});
  assert.equal(render(h(JA2CampaignReturn,props)), '');
});

test('preserved-facing animation belongs only to its accepted battle and keeps the moving sprite direction',()=>{
  const s=fixture(),holder={current:{battle:s,unitId:'scout',direction:1}};
  const command=takeMovementFacingOverride(holder,s);assert.equal(command.direction,1);assert.equal(holder.current,null);
  assert.equal(takeMovementFacingOverride(holder,s),null);
  assert.equal(takeMovementFacingOverride({current:{battle:s,unitId:'scout',direction:1}},structuredClone(s)),null);
  const from={x:3,y:3},to={x:2,y:3};
  assert.equal(motionDirection(from,to,command.direction),1);assert.notEqual(motionDirection(from,to),1);
  const markup=scene(s,{scout:{x:2.5,y:3,direction:motionDirection(from,to,command.direction),frame:1,moving:true}});
  assert.match(markup,/data-unit-id="scout" data-moving="true" data-direction="1"/);
  assert.ok(!strip(s).includes('aria-label="Mover sin girar"'));
});

test('withdrawal panel renders destinations, per-soldier rejection and an explicit eligible subset',()=>{
 const state=createBattle([{id:'p',name:'Listo para salir',x:0,y:1},{id:'q',name:'Debe acercarse',x:3,y:1}],{width:10,height:8,exits:[{id:'west',edge:'W',destination:'san_nicolas',entryEdge:'E',entryAnchor:{x:19,y:3}}],enemies:[{id:'e',x:8,y:6}]});
 const props={model:exitModel(state,{unitIds:['p','q'],exitId:'west'}),selectedId:'p',busy:false,onUnits:noop,onExit:noop,onLeave:noop,onClose:noop,exploring:false};
 const markup=render(h(JA2ExitPanel,props));assert.match(markup,/aria-label="Destino de salida"/);assert.match(markup,/Oeste · san nicolas/);assert.match(markup,/2 PA para cruzar/);assert.match(markup,/Debe alcanzar el borde/);assert.match(markup,/Seleccionar los que pueden salir/);assert.match(markup,/Solo se mantiene un encuentro táctico activo/);
 const blocked=markup.match(/<button[^>]*>Cruzar el borde[^<]*<\/button>/)?.[0];assert.match(blocked,/disabled=""/);
 const ready=render(h(JA2ExitPanel,{...props,model:exitModel(state,{unitIds:['p'],exitId:'west'})})).match(/<button[^>]*>Cruzar el borde[^<]*<\/button>/)?.[0];assert.ok(ready&&!ready.includes('disabled'));
 state.phase='interrupt';state.interrupt={side:'player',unitIds:['p'],enemyId:'e'};const paused=render(h(JA2ExitPanel,{...props,model:exitModel(state,{unitIds:['p'],exitId:'west'})}));assert.match(paused,/turno normal del jugador/);
});

test('departed actors disappear from scene and radar while a partial encounter stays active',()=>{
 const s=createBattle([{id:'scout',name:'Vigía',x:0,y:1},{id:'remaining',name:'Retaguardia',x:1,y:1}],{width:10,height:8,exploration:true,enemies:[],exits:[{id:'west',edge:'W',destination:'retiro',entryEdge:'E',entryAnchor:{x:19,y:3}}]});
 const next=actBattle(s,{type:'exit',unitIds:['scout'],exitId:'west'}),field=fieldState(next),unit=field.units[0];assert.equal(next.status,'active');assert.equal(next.units.length,2);
 const markup=render(h('svg',null,h(TacticalScene,{state:field,selected:unit.id,unit,players:field.units,units:field.units,positions:{},poses:{},directions:{},hover:null,mode:'move',aim:0,reachable:[],showSight:false,sight:new Set(),revealed:new Set(),project,onTile:noop,onHover:noop,onTalk:noop,onCannon:noop,cannonId:''})));
 assert.ok(!markup.includes('data-unit-id="scout"'));assert.match(markup,/data-unit-id="remaining"/);
 const hud=strip(next,false,{selected:unit.id,unit,players:field.units,costs:actionCosts(next,unit),weapon:weaponFor(unit),firearm:hasFirearm(unit)});assert.ok(!hud.includes('aria-label="Seleccionar Vigía"'));assert.match(hud,/Salir del sector/);
});
