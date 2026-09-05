// Individual mounts. Time is campaign hours; breeding never produces instant adults.
export const GESTATION_HOURS=330*24;
export const MATURITY_HOURS=3*365*24;
const clone=s=>structuredClone(s);
export function initialHorseState(){return{version:1,hour:0,nextId:1,horses:[],log:[],lastError:null};}
export function migrateHorseState(value){const s=value?clone(value):initialHorseState();s.version=1;s.nextId??=1;s.horses??=[];s.log??=[];s.hour??=0;s.lastError=null;return s;}
const note=(s,text)=>{s.log.unshift(text);s.log=s.log.slice(0,40);};
export function applyHorseAction(previous,action){const s=migrateHorseState(previous);try{
const need=(ok,msg)=>{if(!ok)throw Error(msg);};const h=s.horses.find(h=>h.id===action.horseId);
if(action.type==='acquire'||action.type==='hire'){
const cost=action.type==='hire'?35:180;need(Number.isFinite(action.funds)&&action.funds>=cost,'Faltan pesos para incorporar la montura.');need(typeof action.location==='string'&&action.location,'Debes indicar una estancia.');
const id=`horse-${s.nextId++}`;s.horses.push({id,name:action.name||`Criollo ${id.split('-')[1]}`,sex:action.sex==='mare'?'mare':'stallion',location:action.location,bornAt:s.hour-MATURITY_HOURS,stamina:100,condition:100,feed:7,assignedTo:null,hired:action.type==='hire',hireUntil:action.type==='hire'?s.hour+30*24:null,pregnantUntil:null});s.cost=cost;note(s,action.type==='hire'?'Montura arrendada por treinta días.':'Caballo incorporado a la caballada.');
}else if(action.type==='advance'){
need(Number.isInteger(action.hour)&&action.hour>=s.hour,'El calendario de la caballada no puede retroceder.');const days=Math.floor(action.hour/24)-Math.floor(s.hour/24);s.cost=0;
for(const horse of [...s.horses]){const fed=Math.min(days,horse.feed),unfed=Math.max(0,days-horse.feed);horse.feed=Math.max(0,horse.feed-days);horse.condition=Math.max(0,Math.min(100,horse.condition+fed-unfed*2));horse.stamina=Math.min(horse.condition,horse.stamina+days*10);if(horse.hired&&action.hour>=horse.hireUntil){horse.assignedTo=null;horse.returned=true;}if(horse.pregnantUntil!==null&&action.hour>=horse.pregnantUntil){const bornAt=horse.pregnantUntil;horse.pregnantUntil=null;const id=`horse-${s.nextId++}`;s.horses.push({id,name:`Potrillo de ${horse.name}`,sex:s.nextId%2?'mare':'stallion',location:horse.location,bornAt,stamina:100,condition:100,feed:7,assignedTo:null,hired:false,hireUntil:null,pregnantUntil:null,motherId:horse.id});note(s,`Nace ${id}. Necesita tres años de crianza antes de la monta.`);}}
s.hour=action.hour;
}else{
need(h&&!h.returned,'La montura no está disponible.');s.cost=0;
if(action.type==='feed'){need(Number.isInteger(action.days)&&action.days>0&&action.days<=365,'Indica entre uno y365 días de forraje.');need(action.funds>=action.days*2,'Faltan fondos para el forraje.');h.feed+=action.days;s.cost=action.days*2;}
else if(action.type==='assign'){need(s.hour-h.bornAt>=MATURITY_HOURS,'El potrillo aún no tiene edad de monta.');need(h.condition>=30&&h.stamina>=20,'El caballo necesita descanso y cuidados.');need(action.location===h.location,'El jinete debe estar en la misma estancia.');need(Number.isInteger(action.operativeId),'Jinete inválido.');need(!s.horses.some(other=>!other.returned&&other.assignedTo===action.operativeId&&other.id!==h.id),'Ese jinete ya tiene otra montura.');h.assignedTo=action.operativeId;}
else if(action.type==='unassign')h.assignedTo=null;
else if(action.type==='ride'){need(h.assignedTo===action.operativeId,'El caballo pertenece a otro jinete.');need(Number.isFinite(action.hours)&&action.hours>0&&action.hours<=72,'Duración de marcha inválida.');const cost=Math.ceil(action.hours*(3-(Math.max(0,Math.min(100,action.ridingSkill||0))/100)));need(h.stamina>=cost,'La montura está agotada.');h.stamina-=cost;if(action.destination)h.location=action.destination;}
else if(action.type==='breed'){const sire=s.horses.find(x=>x.id===action.sireId);need(h.sex==='mare'&&!h.hired&&!h.pregnantUntil&&s.hour-h.bornAt>=MATURITY_HOURS,'La yegua no está disponible para la cría.');need(sire&&!sire.returned&&sire.sex==='stallion'&&!sire.hired&&sire.location===h.location&&s.hour-sire.bornAt>=MATURITY_HOURS,'Se necesita un padrillo adulto propio en la misma estancia.');need(h.condition>=60&&sire.condition>=60,'Los reproductores necesitan buena condición.');need(action.funds>=80,'Faltan fondos para la reproducción.');h.pregnantUntil=s.hour+GESTATION_HOURS;s.cost=80;note(s,'Cría iniciada: gestación prevista de once meses.');}
else throw Error('Orden de caballada desconocida.');
}
return s;
}catch(error){const old=migrateHorseState(previous);old.lastError=error.message;old.cost=0;return old;}}
export function mountForOperative(state,id){const h=state.horses.find(h=>!h.returned&&h.assignedTo===id);return h?{horse:true,canMount:h.stamina>=20&&h.condition>=30,mount:{id:h.id,stamina:h.stamina,condition:h.condition}}:null;}
