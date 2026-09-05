import {OPERATIVES, WEAPONS, CAMPAIGN_SECTORS, FACTIONS, PHASES, RECIPES, RESOURCE_NAMES} from './data.js';
export {OPERATIVES, WEAPONS, CAMPAIGN_SECTORS, FACTIONS, PHASES, RECIPES, RESOURCE_NAMES};
const clone = value => JSON.parse(JSON.stringify(value));
const clamp = value => Math.max(-100,Math.min(100,value));
export function campaignDate(s){const day=Math.floor(s.hour/24);return {year:1812+Math.floor((2+Math.floor(day/30))/12),month:(2+Math.floor(day/30))%12+1,day:day%30+1,hour:s.hour%24};}
const sector = id => CAMPAIGN_SECTORS.find(s=>s.id===id);
const random = s => {s.seed=(Math.imul(1664525,s.seed)+1013904223)>>>0;return s.seed/4294967296;};
const note = (s,text) => {s.log.unshift({hour:s.hour,text});s.log=s.log.slice(0,80);};
const requireThat = (test,message) => {if(!test)throw Error(message);};
const pay = (s,cost) => {for(const [key,value] of Object.entries(cost))requireThat(s.resources[key]>=value,`Faltan recursos: ${RESOURCE_NAMES[key]??key} (${value}).`);for(const [key,value] of Object.entries(cost))s.resources[key]-=value;};
const add = (s,values) => {for(const [key,value] of Object.entries(values))s.resources[key]=(s.resources[key]??0)+value;};
const standing = (s,id,value) => {if(id!=='royalists')s.reputation[id]=clamp(s.reputation[id]+value);};
export function initialCampaign(seed=1812){
  return {version:1,seed:seed>>>0,hour:0,phase:0,location:'retiro',resources:{treasury:3200,horses:35,powder:100,copper:35,textiles:240,infantry:0,muskets:90,sabres:25,cartridges:300,uniforms:0,cannons:0,ponchos:6},reputation:{directory:35,gauchos:0,pardos:10,foreign:20,indigenous:0,royalists:-100},sectors:Object.fromEntries(CAMPAIGN_SECTORS.map(x=>[x.id,{owner:['buenos_aires','retiro','ensenada'].includes(x.id)?'patriot':'royalist',loyalty:['buenos_aires','retiro','ensenada'].includes(x.id)?65:25,militia:[0,0,0],damageUntil:0,fort:0}])),recruited:[3,4,10],squad:[3,4,10],operativeState:Object.fromEntries(OPERATIVES.map(o=>[o.id,{hp:o.maxHp,fatigue:0,alive:true}])),flags:{academy:false,sanLorenzo:false,northPact:false,partisanSupply:false,foundry:false,parliament:false,emancipation:false,commission:false,mentoring:false},production:[],shipments:[],routes:{posta:false,flotilla:false,carts:false},blockade:false,pendingBattle:null,completed:false,defeated:false,log:[{hour:0,text:'Buenos Aires, 1812. El Cabildo encomienda la formación de los Granaderos. Cabral, Dorrego y Paroissien están a tus órdenes.'}],lastError:null};
}
export function isSupplied(s,id){
  if(s.sectors[id]?.owner!=='patriot')return false;
  const visited=new Set(['buenos_aires']),queue=['buenos_aires'];
  while(queue.length){const here=queue.shift();for(const next of sector(here).neighbors){if(!visited.has(next)&&s.sectors[next].owner==='patriot'){visited.add(next);queue.push(next);}}}
  return visited.has(id);
}
export function recruitmentStatus(s,id){
  if(s.recruited.includes(id))return {available:false,reason:'Ya se encuentra en tus filas.'};
  if(!s.operativeState[id]?.alive)return {available:false,reason:'Ha caído en combate.'};
  const conditions={
    0:[s.flags.northPact,'Acuerda la defensa autónoma del norte.'],
    1:[s.flags.partisanSupply,'Entrega 50 mosquetes a las partidas del norte.'],
    2:[s.sectors.mendoza.owner==='patriot','Libera Mendoza.'],
    5:[s.reputation.foreign>=30&&!s.blockade,'Asegura el comercio y eleva a 30 el prestigio entre los extranjeros.'],
    6:[s.flags.sanLorenzo,'Vence en San Lorenzo.'],
    7:[s.flags.emancipation&&s.reputation.pardos>=30,'Proclama la emancipación y eleva a 30 el apoyo de Pardos y Morenos.'],
    8:[s.flags.northPact,'Acuerda la defensa autónoma del norte.'],
    9:[s.sectors.cordoba.owner==='patriot'&&s.reputation.gauchos>=10,'Libera Córdoba y respeta a las milicias provinciales.'],
    11:[s.sectors.cordoba.owner==='patriot','Libera Córdoba.'],
    57:[s.phase>=4,'Completa los preparativos de El Plumerillo.'],
  };
  const [available,reason]=conditions[id]??[false,'No está disponible.'];return {available,reason:available?'Disponible para incorporarse.':reason};
}
export function campaignObjectives(s){
  return PHASES.map((p,i)=>({...p,complete:i<s.phase||(i===4&&s.completed),active:i===s.phase&&!s.completed}));
}
export function availableActions(s){
  return {recruits:OPERATIVES.map(o=>({...o,...recruitmentStatus(s,o.id)})),destinations:CAMPAIGN_SECTORS.filter(x=>x.id!==s.location),recipes:Object.entries(RECIPES).map(([id,r])=>({id,...r})),phase:PHASES[s.phase]};
}
function progress(s){
  if(s.phase===0&&s.flags.academy){s.phase=1;note(s,'La academia de Retiro está organizada. Llegan noticias de un desembarco realista junto a San Lorenzo.');}
  if(s.phase===1&&s.flags.sanLorenzo){s.phase=2;standing(s,'directory',15);note(s,'Victoria en San Lorenzo. San Martín marcha al norte para estudiar la situación del Ejército del Norte.');}
  if(s.phase===2&&s.sectors.tucuman.owner==='patriot'&&s.flags.northPact&&isSupplied(s,'salta')){s.phase=3;note(s,'En Yatasto, San Martín confía el norte a Güemes. El esfuerzo principal se traslada a Cuyo.');}
  if(s.phase===3&&s.flags.foundry&&s.flags.parliament&&s.resources.infantry>=3000&&s.resources.cannons>=3&&['mendoza','uspallata','los_patos'].every(id=>s.sectors[id].owner==='patriot'&&s.sectors[id].fort>=1)){
    s.phase=4;note(s,'El Plumerillo alcanza plena capacidad. Tres mil infantes, artillería y pasos seguros: San Martín puede incorporarse al ejército.');
  }
  if(s.phase===4&&s.recruited.includes(57)&&Object.values(s.sectors).every(x=>x.owner==='patriot')&&!s.blockade&&!s.pendingBattle){s.completed=true;note(s,'¡Campaña concluida! Las provincias están libres y el Ejército de los Andes queda preparado para la liberación continental.');}
  if(s.sectors.buenos_aires.owner!=='patriot'){s.defeated=true;note(s,'La capital ha caído. El ejército debe reorganizarse desde una nueva campaña.');}
}
function raid(s,theater){
  const targets=CAMPAIGN_SECTORS.filter(x=>x.theater===theater&&s.sectors[x.id].owner==='patriot'&&x.id!=='retiro');
  if(!targets.length)return;
  const priorities=theater==='north'?['humahuaca','jujuy','salta','tucuman']:theater==='coast'?['san_nicolas','santa_fe','ensenada','buenos_aires']:['cordoba'];
  targets.sort((a,b)=>priorities.indexOf(a.id)-priorities.indexOf(b.id));
  const target=targets.find(x=>theater!=='interior'||s.sectors[x.id].loyalty<50);if(!target)return;
  const region=s.sectors[target.id],strength=3+Math.floor(s.hour/240);
  const defense=region.militia.reduce((v,n,i)=>v+n*(i+1),0)+region.fort*4+(s.location===target.id?s.squad.length*2:0)+(theater==='north'&&s.flags.northPact?5:0);
  if(defense>=strength){region.loyalty=Math.min(100,region.loyalty+3);note(s,`La guarnición de ${target.name} rechazó una incursión realista.`);return;}
  region.damageUntil=s.hour+24*14;region.loyalty=Math.max(0,region.loyalty-12);
  if(theater==='coast'){s.blockade=true;note(s,`La flotilla realista bloquea ${target.name}. Las aduanas reducen sus ingresos.`);}
  else {region.owner='royalist';region.militia=[0,0,0];note(s,`Los realistas recuperan ${target.name} y cortan las rutas de abastecimiento.`);}
}
function tick(s,hours){
  requireThat(Number.isInteger(hours)&&hours>=1&&hours<=240,'El avance debe ser de 1 a 240 horas.');
  for(let i=0;i<hours;i++){
    s.hour++;
    for(const task of [...s.production])if(task.due<=s.hour&&s.sectors[task.sector].owner==='patriot'&&isSupplied(s,task.sector)){add(s,task.yield);s.production.splice(s.production.indexOf(task),1);note(s,`La maestranza completó: ${task.name}.`);}
    for(const shipment of [...s.shipments])if(shipment.due<=s.hour&&!s.blockade&&s.sectors.ensenada.owner==='patriot'){add(s,shipment.goods);s.shipments.splice(s.shipments.indexOf(shipment),1);note(s,'Arribó un cargamento de contrabando a Ensenada.');}
    if(s.hour%24===0){
      let income=0;
      for(const def of CAMPAIGN_SECTORS){const region=s.sectors[def.id];if(region.owner==='patriot'){income+=Math.floor(def.income*(region.damageUntil>s.hour?0.25:1)*(def.theater==='coast'&&s.blockade?0.25:1)*(isSupplied(s,def.id)?1:0.5));if(isSupplied(s,def.id))region.loyalty=Math.min(100,region.loyalty+1);}}
      add(s,{treasury:income,textiles:s.sectors.cordoba.owner==='patriot'?50:20,copper:s.sectors.mendoza.owner==='patriot'?4:1,powder:s.flags.foundry?15:5,horses:2});
      for(const id of s.recruited){const op=s.operativeState[id];if(op.alive&&isSupplied(s,s.location)){op.hp=Math.min(OPERATIVES.find(o=>o.id===id).maxHp,op.hp+5);op.fatigue=Math.max(0,op.fatigue-10);}}
      note(s,`Las estancias y aduanas aportaron ${income} pesos a la tesorería.`);
    }
    if(s.hour%720===0){const payroll=s.recruited.reduce((sum,id)=>sum+OPERATIVES.find(o=>o.id===id).monthlyPay,0);if(s.resources.treasury>=payroll){s.resources.treasury-=payroll;standing(s,'foreign',5);note(s,`Se abonaron ${payroll} pesos en estipendios mensuales.`);}else{standing(s,'foreign',-20);standing(s,'directory',-10);note(s,'La tesorería no pudo abonar los sueldos. Los voluntarios reclaman el pago.');}}
    if(s.hour%120===0)raid(s,'north');
    if(s.hour%168===0&&CAMPAIGN_SECTORS.filter(x=>x.theater==='coast'&&s.sectors[x.id].owner==='patriot').length>=4)raid(s,'coast');
    if(s.hour%144===0)raid(s,'interior');
    progress(s);if(s.defeated||s.completed)break;
  }
}
function travelPath(s,from,to){
  const queue=[[from]],seen=new Set([from]);while(queue.length){const path=queue.shift(),last=path.at(-1);if(last===to)return path;for(const id of sector(last).neighbors)if(!seen.has(id)&&s.sectors[id].owner==='patriot'){seen.add(id);queue.push([...path,id]);}}return null;
}
export function dispatchCampaign(previous,action){
  const s=clone(previous);s.lastError=null;
  try{
    requireThat(action&&typeof action.type==='string','La orden no es válida.');
    requireThat(!s.completed&&!s.defeated,'La campaña ha terminado. Inicia otra campaña para continuar.');
    requireThat(!s.pendingBattle||action.type==='battleResult','Hay una batalla pendiente. Resuélvela antes de dar nuevas órdenes.');
    switch(action.type){
      case 'wait':tick(s,action.hours??24);break;
      case 'academy':requireThat(!s.flags.academy,'La academia ya está organizada.');pay(s,{treasury:300,horses:20,muskets:40,textiles:60});s.flags.academy=true;note(s,'Se funda la academia de Granaderos en Retiro.');break;
      case 'recruit':{
        const op=OPERATIVES.find(o=>o.id===Number(action.id));requireThat(op,'No existe ese oficial.');const gate=recruitmentStatus(s,op.id);requireThat(gate.available,gate.reason);pay(s,{treasury:op.monthlyPay});s.recruited.push(op.id);if(s.squad.length<6)s.squad.push(op.id);note(s,`${op.name} se incorpora a las fuerzas patriotas.`);break;
      }
      case 'squad':requireThat(Array.isArray(action.ids)&&action.ids.length>0&&action.ids.length<=6&&new Set(action.ids).size===action.ids.length&&action.ids.every(id=>s.recruited.includes(id)&&s.operativeState[id].alive),'Selecciona entre uno y seis combatientes disponibles.');s.squad=[...action.ids];break;
      case 'travel':{
        requireThat(sector(action.sector),'El destino no existe.');requireThat(s.sectors[action.sector].owner==='patriot','Primero debes liberar el destino.');const path=travelPath(s,s.location,action.sector);requireThat(path,'Los realistas cortan la ruta de tránsito.');
        const mode=action.mode??'march';requireThat(['march','posta','flotilla','carts'].includes(mode),'Medio de transporte desconocido.');
        if(mode!=='march')requireThat(s.routes[mode],'Debes organizar ese transporte.');
        if(mode==='flotilla')requireThat(!s.blockade&&path.every(id=>sector(id).theater==='coast'),'La flotilla requiere una ruta costera sin bloqueo.');
        const mountain=path.some(id=>sector(id).biome==='mountain');requireThat(!(path.some(id=>['uspallata','los_patos'].includes(id))&&campaignDate(s).month>=6&&campaignDate(s).month<=8),'La nieve invernal ha cerrado los pasos.');
        if(mode==='posta')pay(s,{horses:Math.max(1,path.length-1)});
        const hours=Math.max(1,Math.ceil((path.length-1)*(mode==='posta'?4:mode==='flotilla'?5:mode==='carts'?18:12)*(mountain?1.5:1)));tick(s,hours);s.location=action.sector;
        for(const id of s.squad)s.operativeState[id].fatigue=Math.min(90,s.operativeState[id].fatigue+(s.recruited.includes(57)?0:mountain?20:8));note(s,`El destacamento llega a ${sector(action.sector).name}.`);break;
      }
      case 'transport':requireThat(['posta','flotilla','carts'].includes(action.mode),'Transporte desconocido.');requireThat(!s.routes[action.mode],'Ese transporte ya está organizado.');pay(s,action.mode==='posta'?{treasury:150,horses:10}:action.mode==='flotilla'?{treasury:400,cannons:1}:{treasury:180,horses:4});s.routes[action.mode]=true;note(s,'La nueva red de transporte queda disponible.');break;
      case 'produce':{
        const recipe=RECIPES[action.recipe];requireThat(recipe,'La maestranza no conoce ese producto.');const at=action.sector??s.location;
        requireThat(['retiro','cordoba','mendoza'].includes(at)&&s.sectors[at].owner==='patriot'&&isSupplied(s,at),'La producción requiere una maestranza propia y abastecida.');
        if(['cannon','infantry'].includes(action.recipe))requireThat(s.flags.foundry&&at==='mendoza','Esta producción requiere la fundición de El Plumerillo.');
        requireThat(s.production.filter(p=>p.sector===at).length<3,'La maestranza ya tiene tres encargos.');pay(s,recipe.cost);s.production.push({id:`${s.hour}-${s.production.length}-${s.seed}`,sector:at,name:recipe.name,due:s.hour+recipe.hours,yield:clone(recipe.yield)});note(s,`Encargo iniciado: ${recipe.name}.`);break;
      }
      case 'foundry':requireThat(s.sectors.mendoza.owner==='patriot'&&s.recruited.includes(2),'Libera Mendoza e incorpora a Beltrán.');requireThat(!s.flags.foundry,'La fundición ya funciona.');pay(s,{treasury:500,copper:20});s.flags.foundry=true;note(s,'Beltrán pone en marcha la fundición de El Plumerillo.');break;
      case 'contraband':{
        requireThat(s.sectors.ensenada.owner==='patriot','El puerto de Ensenada está ocupado.');requireThat(s.reputation.foreign>=0,'Los comerciantes rechazan los tratos con el ejército.');
        const offers={arms:{price:250,goods:{muskets:50,cartridges:100}},supplies:{price:180,goods:{powder:40,textiles:120,copper:10}},mounts:{price:150,goods:{horses:15}},winter:{price:100,goods:{ponchos:6}}};const offer=offers[action.offer??'arms'];requireThat(offer,'Ese cargamento no está disponible.');pay(s,{treasury:offer.price});const delay=72+Math.floor(random(s)*49);s.shipments.push({due:s.hour+delay,goods:clone(offer.goods)});standing(s,'foreign',5);note(s,`El cargamento llegará en ${delay} horas, si el puerto permanece abierto.`);break;
      }
      case 'diplomacy':{
        const kind=action.kind;
        if(kind==='northPact'){requireThat(s.sectors.salta.owner==='patriot','Libera Salta para reunir su Cabildo.');requireThat(!s.flags.northPact,'El pacto del norte ya está firmado.');pay(s,{muskets:20,horses:10,powder:10});s.flags.northPact=true;standing(s,'gauchos',45);note(s,'Güemes acepta custodiar el norte con respeto a la autonomía provincial.');}
        else if(kind==='partisanSupply'){requireThat(s.sectors.tucuman.owner==='patriot','Abre una ruta hacia las partidas del norte.');requireThat(!s.flags.partisanSupply,'Las partidas ya recibieron su entrega.');pay(s,{muskets:50});s.flags.partisanSupply=true;standing(s,'gauchos',20);note(s,'Las partidas reciben cincuenta mosquetes. Azurduy ofrece su colaboración.');}
        else if(kind==='parliament'){requireThat(s.sectors.mendoza.owner==='patriot','El parlamento debe prepararse desde Cuyo.');requireThat(!s.flags.parliament,'Los pasos ya cuentan con un acuerdo.');pay(s,{treasury:200,textiles:60,sabres:10});s.flags.parliament=true;standing(s,'indigenous',60);note(s,'El parlamento acuerda el tránsito y respeta la autonomía pehuenche.');}
        else if(kind==='emancipation'){requireThat(!s.flags.emancipation,'El decreto ya fue proclamado.');pay(s,{treasury:150});s.flags.emancipation=true;standing(s,'pardos',30);standing(s,'directory',5);note(s,'El Cabildo proclama la libertad y garantiza la protección de las familias emancipadas.');}
        else if(kind==='commission'){requireThat(s.flags.emancipation,'Primero garantiza la emancipación.');requireThat(!s.flags.commission,'Las comisiones ya fueron otorgadas.');pay(s,{treasury:100});s.flags.commission=true;standing(s,'pardos',20);note(s,'Los batallones de Pardos y Morenos reciben comisiones de oficiales.');}
        else if(kind==='gift'){pay(s,{treasury:80,textiles:20});standing(s,'indigenous',15);note(s,'Una comitiva entrega presentes y renueva los acuerdos de frontera.');}
        else if(kind==='requisition'){add(s,{treasury:200,horses:5});standing(s,'gauchos',-20);standing(s,'directory',-10);s.sectors[s.location].loyalty=Math.max(0,s.sectors[s.location].loyalty-20);note(s,'La requisa abastece al ejército, pero provoca rechazo en la población.');}
        else if(kind==='autonomy'){pay(s,{treasury:80});standing(s,'gauchos',15);standing(s,'directory',-3);note(s,'El ejército reconoce las autoridades provinciales.');}
        else throw Error('No existe esa propuesta diplomática.');break;
      }
      case 'militia':{
        const at=action.sector??s.location,rank=Number(action.rank??0);requireThat(s.sectors[at]?.owner==='patriot'&&isSupplied(s,at),'La instrucción necesita un sector propio y abastecido.');requireThat([0,1,2].includes(rank),'Grado de milicia inválido.');if(rank>0)requireThat(s.sectors[at].militia[rank-1]>0,'Primero instruye el grado anterior.');pay(s,{treasury:60*(rank+1),muskets:rank===1?0:5,horses:rank===1?3:0});if(rank>0)s.sectors[at].militia[rank-1]--;s.sectors[at].militia[rank]+=3;note(s,`Se instruye una unidad de ${['cívicos','montoneros','granaderos y soldados de línea'][rank]} en ${sector(at).name}.`);break;
      }
      case 'fortify':{const at=action.sector??s.location;requireThat(s.sectors[at]?.owner==='patriot','Solo puedes fortificar sectores propios.');requireThat(s.sectors[at].fort<3,'El sector ya tiene la máxima fortificación.');pay(s,{treasury:150,sabres:5});s.sectors[at].fort++;note(s,`Se refuerzan las defensas de ${sector(at).name}.`);break;}
      case 'attack':{
        const at=action.sector??'san_lorenzo',san=at==='san_lorenzo',def=san?{id:at,name:'Combate de San Lorenzo',biome:'river',theater:'coast'}:sector(at);
        requireThat(def,'No existe ese campo de batalla.');requireThat(!(['uspallata','los_patos'].includes(at)&&campaignDate(s).month>=6&&campaignDate(s).month<=8),'La nieve invernal ha cerrado los pasos.');requireThat(s.squad.some(id=>s.operativeState[id].alive&&s.operativeState[id].hp>0),'No hay combatientes disponibles.');
        if(san)requireThat(s.phase>=1&&!s.flags.sanLorenzo&&s.sectors.san_nicolas.owner==='patriot','Organiza Retiro y libera San Nicolás antes de combatir en San Lorenzo.');
        else {requireThat(s.sectors[at].owner==='royalist'||(s.blockade&&def.theater==='coast'),'El sector ya está bajo control patriota.');requireThat(def.neighbors.some(id=>s.sectors[id].owner==='patriot'&&isSupplied(s,id)),'Debes abrir una ruta hasta el frente.');}
        const allocated={};let stock=s.resources.cartridges;
        for(const id of s.squad){const op=OPERATIVES.find(o=>o.id===id),capacity=WEAPONS[op.weapon]?.capacity??0;const rounds=capacity?Math.min(10,stock):0;allocated[id]={loaded:Math.min(capacity,rounds),ammo:Math.max(0,rounds-capacity)};stock-=rounds;}
        const issued=s.resources.cartridges-stock;pay(s,{cartridges:issued,powder:3});
        s.pendingBattle={id:`${at}-${s.hour}-${s.seed}`,sector:at,name:def.name,biome:def.biome,theater:def.theater,seed:Math.floor(random(s)*4294967296),issuedCartridges:issued,wasRoyalist:!san&&s.sectors[at].owner==='royalist',squad:s.squad.map(id=>({...clone(OPERATIVES.find(o=>o.id===id)),...clone(s.operativeState[id]),...allocated[id],horse:s.resources.horses>=s.squad.length,canMount:s.resources.horses>=s.squad.length,poncho:s.resources.ponchos>=s.squad.length})),difficulty:san?2:Math.min(4,1+Math.floor(s.hour/240)+(def.theater==='north'?1:0)),weather:{rain:def.biome==='wetland'||random(s)<0.2,humidity:def.theater==='coast'?0.8:0.3},cannons:s.resources.cannons};note(s,`El destacamento se despliega para ${def.name}.`);break;
      }
      case 'battleResult':{
        requireThat(s.pendingBattle,'No hay batalla pendiente.');requireThat(action.battleId===s.pendingBattle.id,'El resultado no corresponde a la batalla pendiente.');requireThat(['victory','defeat','retreat'].includes(action.outcome),'Resultado de batalla inválido.');const request=s.pendingBattle;
        const survivors=action.survivors??[];requireThat(Array.isArray(survivors),'El parte de bajas es inválido.');
        requireThat(survivors.every(x=>x&&request.squad.some(o=>o.id===Number(x.id))&&Number.isFinite(x.hp)&&x.hp>=0)&&new Set(survivors.map(x=>Number(x.id))).size===survivors.length,'El parte de bajas contiene combatientes o heridas inválidos.');
        let returned=0;
        for(const report of survivors){if(report.hp>0){const issuedUnit=request.squad.find(o=>o.id===Number(report.id));returned+=Math.min(issuedUnit.loaded+issuedUnit.ammo,Math.max(0,Math.floor(Number(report.loaded)||0))+Math.max(0,Math.floor(Number(report.ammo)||0)));}}
        s.resources.cartridges+=Math.min(request.issuedCartridges??0,returned);
        for(const id of s.squad){const report=survivors.find(x=>Number(x.id)===id);if(report){const max=OPERATIVES.find(o=>o.id===id).maxHp;s.operativeState[id].hp=Math.max(0,Math.min(max,Number(report.hp)||0));s.operativeState[id].alive=s.operativeState[id].hp>0;}else if(action.outcome!=='retreat'){s.operativeState[id].hp=0;s.operativeState[id].alive=false;}}
        if(action.outcome==='victory'){
          if(request.sector==='san_lorenzo')s.flags.sanLorenzo=true;
          else {const region=s.sectors[request.sector];region.owner='patriot';region.loyalty=Math.max(50,region.loyalty);region.damageUntil=0;}
          if(request.theater==='coast')s.blockade=false;if(request.wasRoyalist||request.sector==='san_lorenzo')add(s,{treasury:250,muskets:15,cartridges:80});standing(s,'directory',5);standing(s,'gauchos',request.theater==='north'?10:2);note(s,`Victoria en ${request.name}. Se recuperan armas y fondos realistas.`);
        }else{standing(s,'directory',-5);note(s,`El destacamento se retira de ${request.name}.`);}
        s.pendingBattle=null;s.squad=s.squad.filter(id=>s.operativeState[id].alive);if(!s.squad.length){const reserve=s.recruited.filter(id=>s.operativeState[id].alive);s.squad=reserve.slice(0,6);if(!s.squad.length){s.defeated=true;note(s,'No quedan combatientes. La campaña ha terminado.');}}break;
      }
      default:throw Error('Orden desconocida.');
    }
    progress(s);return s;
  }catch(error){const rejected=clone(previous);rejected.lastError=error.message;return rejected;}
}
export function serializeCampaign(s){return JSON.stringify(s);}
export function restoreCampaign(text){
  requireThat(typeof text==='string'&&text.length<=2_000_000,'El archivo de campaña no es compatible.');
  const s=JSON.parse(text),base=initialCampaign();
  const integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
  const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  requireThat(object(s)&&s.version===1&&integer(s.hour,0,24*365*100)&&integer(s.phase,0,4)&&integer(s.seed,0,4294967295)&&sector(s.location),'El archivo de campaña no es compatible.');
  requireThat(object(s.resources)&&Object.keys(base.resources).every(k=>integer(s.resources[k],0,1e9)),'La tesorería del archivo es inválida.');
  requireThat(object(s.reputation)&&Object.keys(base.reputation).every(k=>integer(s.reputation[k],-100,100))&&s.reputation.royalists===-100,'Las relaciones del archivo son inválidas.');
  requireThat(object(s.sectors)&&Object.keys(s.sectors).length===13&&CAMPAIGN_SECTORS.every(d=>{const r=s.sectors[d.id];return object(r)&&['patriot','royalist'].includes(r.owner)&&integer(r.loyalty,0,100)&&integer(r.fort,0,3)&&integer(r.damageUntil,0,1e9)&&Array.isArray(r.militia)&&r.militia.length===3&&r.militia.every(x=>integer(x,0,100000));}),'El mapa del archivo es inválido.');
  const ids=OPERATIVES.map(o=>o.id),validIds=values=>Array.isArray(values)&&new Set(values).size===values.length&&values.every(id=>ids.includes(id));
  requireThat(validIds(s.recruited)&&validIds(s.squad)&&s.squad.length<=6&&s.squad.every(id=>s.recruited.includes(id)),'El destacamento del archivo es inválido.');
  requireThat(object(s.operativeState)&&OPERATIVES.every(o=>{const r=s.operativeState[o.id];return object(r)&&integer(r.hp,0,o.maxHp)&&integer(r.fatigue,0,100)&&typeof r.alive==='boolean'&&r.alive===(r.hp>0);}),'Las hojas de servicio son inválidas.');
  requireThat(object(s.flags)&&Object.keys(base.flags).every(k=>typeof s.flags[k]==='boolean')&&object(s.routes)&&Object.keys(base.routes).every(k=>typeof s.routes[k]==='boolean'),'Los acuerdos del archivo son inválidos.');
  const resources=values=>object(values)&&Object.entries(values).every(([k,v])=>k in base.resources&&integer(v,0,100000));
  requireThat(Array.isArray(s.production)&&s.production.length<=9&&s.production.every(p=>object(p)&&typeof p.name==='string'&&p.name.length<100&&sector(p.sector)&&integer(p.due,0,1e9)&&resources(p.yield)),'La producción del archivo es inválida.');
  requireThat(Array.isArray(s.shipments)&&s.shipments.length<=1000&&s.shipments.every(p=>object(p)&&integer(p.due,0,1e9)&&resources(p.goods)),'Los cargamentos del archivo son inválidos.');
  requireThat(['blockade','completed','defeated'].every(k=>typeof s[k]==='boolean')&&Array.isArray(s.log)&&s.log.length<=80&&s.log.every(p=>object(p)&&integer(p.hour,0,1e9)&&typeof p.text==='string'&&p.text.length<=1000),'El registro del archivo es inválido.');
  if(s.pendingBattle!==null){const b=s.pendingBattle;requireThat(object(b)&&typeof b.id==='string'&&b.id.length<100&&(sector(b.sector)||b.sector==='san_lorenzo')&&integer(b.seed,0,4294967295)&&Array.isArray(b.squad)&&b.squad.length<=6&&b.squad.every(o=>object(o)&&s.squad.includes(o.id)&&integer(o.loaded,0,2)&&integer(o.ammo,0,10)&&integer(o.hp,1,100)),'La batalla guardada es inválida.');}
  s.lastError=null;return s;
}
