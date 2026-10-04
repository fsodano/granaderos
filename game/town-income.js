// Initial game tuning, not a reconstruction of historical port revenues.
export const TOWN_INCOME_VERSION=1;
export const TOWN_INCOME_SOURCES=Object.freeze([
 {id:'buenos_aires',name:'Buenos Aires',source:'Puerto de Buenos Aires',sectorId:'buenos_aires',requiredSectors:['buenos_aires','retiro'],dailyAmount:8000,representative:{npcId:'local-buenos_aires',name:'Administrador del puerto',sectorId:'buenos_aires'}},
 {id:'ensenada',name:'Ensenada de Barragán',source:'Puerto de Ensenada',sectorId:'ensenada',requiredSectors:['ensenada'],dailyAmount:5000,representative:{npcId:'local-ensenada',name:'Capataz del puerto',sectorId:'ensenada'}},
 {id:'santa_fe',name:'Santa Fe',source:'Puerto fluvial de Santa Fe',sectorId:'santa_fe',requiredSectors:['santa_fe'],dailyAmount:4000,representative:{npcId:'local-santa_fe',name:'Consignatario del puerto',sectorId:'santa_fe'}},
].map(source=>Object.freeze({...source,requiredSectors:Object.freeze(source.requiredSectors),representative:Object.freeze(source.representative)})));

const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const exact=(value,keys)=>object(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const need=(ok,message='El registro de ingresos de las localidades es inválido.')=>{if(!ok)throw Error(message);};
const receiptKeys=['sourceId','npcId','sectorId','approach','hour','secondOfHour'];
const timeOf=state=>state.hour*3600+(state.secondOfHour??0);
const receiptTime=receipt=>receipt.hour*3600+receipt.secondOfHour;
const sourceById=id=>TOWN_INCOME_SOURCES.find(source=>source.id===id);
const validClock=state=>Number.isSafeInteger(state.hour)&&state.hour>=0&&Number.isSafeInteger(state.secondOfHour??0)&&(state.secondOfHour??0)>=0&&(state.secondOfHour??0)<3600&&Number.isSafeInteger(timeOf(state));
const validAmounts=amounts=>object(amounts)&&Object.entries(amounts).every(([id,amount])=>sourceById(id)&&Number.isSafeInteger(amount)&&amount>=0&&amount<=1_000_000);
const noOrphanAgreements=state=>need(Object.values(state.conversations??{}).every(record=>record?.incomeActivation===undefined),'Falta el acuerdo de ingresos de la conversación guardada.');

export function townIncomeSourceForNPC(npcId){return TOWN_INCOME_SOURCES.find(source=>source.representative.npcId===npcId)??null;}
export function townIncomeSourceForSector(sectorId){return TOWN_INCOME_SOURCES.find(source=>source.requiredSectors.includes(sectorId))??null;}

// Missing older state gains an empty ledger. Prior control and conversations
// cannot grant a new agreement or a payment for a past midnight.
export function initializeTownIncome(state,{dailyAmounts}={}){
 need(validClock(state),'El reloj de ingresos de las localidades es inválido.');
 if(dailyAmounts!==undefined)need(validAmounts(dailyAmounts),'Los importes diarios de las localidades son inválidos.');
 if(state.townIncome===undefined){noOrphanAgreements(state);state.townIncome={version:TOWN_INCOME_VERSION,activations:{},lastPaidDay:Math.floor(state.hour/24),...(dailyAmounts===undefined?{}:{dailyAmounts:{...dailyAmounts}})};}
 return state.townIncome;
}

export function townIncomeSources(state){
 return TOWN_INCOME_SOURCES.map(source=>{
  const uncontrolled=source.requiredSectors.filter(id=>state.sectors?.[id]?.owner!=='patriot');
  const controlled=uncontrolled.length===0,activated=Boolean(state.townIncome?.activations?.[source.id]);
  const base=state.townIncome?.dailyAmounts?.[source.id]??source.dailyAmount,daily=controlled&&activated?base:0;
  const statusCode=!controlled?'uncontrolled':!activated?'awaiting-representative':'active';
  const status=!controlled?(activated?'Suspendida: falta control total':'Falta control total'):!activated?`Hablá con ${source.representative.name}`:'Activa';
  return {...source,requiredSectors:[...source.requiredSectors],representative:{...source.representative},base,daily,income:daily,activated,controlled,uncontrolled,statusCode,status};
 });
}
export const dailyTownIncome=state=>townIncomeSources(state).reduce((total,source)=>total+source.daily,0);

export function townIncomeActivationQuote(state,{npcId,sectorId,approach}={}){
 const source=townIncomeSourceForNPC(npcId);
 const unavailable=(code,reason)=>({available:false,sourceId:source?.id??null,code,reason});
 if(!source)return unavailable('no-source','Este interlocutor no administra una fuente de ingresos.');
 if(sectorId!==source.representative.sectorId)return unavailable('wrong-sector','Hablá con el representante en su localidad.');
 if(!['friendly','direct'].includes(approach))return unavailable('approach','Hablá con el representante sin amenazarlo.');
 const conversation=state.conversations?.[npcId];
 if(conversation?.met!==true||conversation.hour!==state.hour||conversation.secondOfHour!==(state.secondOfHour??0)||conversation.sector!==sectorId||conversation.lastApproach!==approach)return unavailable('not-spoken','Primero hablá con el representante presente en la localidad.');
 if(source.requiredSectors.some(id=>state.sectors?.[id]?.owner!=='patriot'))return unavailable('uncontrolled','Primero asegurá toda la localidad.');
 if(state.townIncome?.activations?.[source.id])return unavailable('already-active','El acuerdo de ingresos ya está registrado.');
 return {available:true,sourceId:source.id,code:null,reason:null,dailyAmount:state.townIncome?.dailyAmounts?.[source.id]??source.dailyAmount};
}

// The reducer calls this only after its normal proximity, sight, living NPC
// and conversation checks. A mirrored receipt survives later conversations.
export function activateTownIncome(state,conversation){
 const quote=townIncomeActivationQuote(state,conversation);
 if(!quote.available)return {applied:false,...quote};
 initializeTownIncome(state);validateTownIncome(state);
 const receipt={sourceId:quote.sourceId,npcId:conversation.npcId,sectorId:conversation.sectorId,approach:conversation.approach,hour:state.hour,secondOfHour:state.secondOfHour??0};
 state.townIncome.activations[quote.sourceId]=receipt;
 state.conversations[conversation.npcId].incomeActivation={...receipt};
 return {applied:true,...quote,receipt:{...receipt}};
}

export function validateTownIncome(state){
 need(validClock(state),'El reloj de ingresos de las localidades es inválido.');
 if(state.townIncome===undefined){noOrphanAgreements(state);return;}
 const ledger=state.townIncome;
 need(exact(ledger,['version','activations','lastPaidDay',...(Object.hasOwn(ledger??{},'dailyAmounts')?['dailyAmounts']:[])])&&ledger.version===TOWN_INCOME_VERSION&&object(ledger.activations));
 need(Number.isSafeInteger(ledger.lastPaidDay)&&ledger.lastPaidDay>=0&&ledger.lastPaidDay<=Math.floor(state.hour/24),'La fecha del último cobro de las localidades es inválida.');
 if(ledger.dailyAmounts!==undefined)need(validAmounts(ledger.dailyAmounts),'Los importes diarios de las localidades son inválidos.');
 for(const [id,receipt]of Object.entries(ledger.activations)){
  const source=sourceById(id);
  need(source&&exact(receipt,receiptKeys)&&receipt.sourceId===id&&receipt.npcId===source.representative.npcId&&receipt.sectorId===source.representative.sectorId&&['friendly','direct'].includes(receipt.approach),'El acuerdo de ingresos no corresponde al representante.');
  need(Number.isSafeInteger(receipt.hour)&&receipt.hour>=0&&Number.isSafeInteger(receipt.secondOfHour)&&receipt.secondOfHour>=0&&receipt.secondOfHour<3600&&Number.isSafeInteger(receiptTime(receipt))&&receiptTime(receipt)<=timeOf(state),'La fecha del acuerdo de ingresos es inválida.');
  const record=state.conversations?.[receipt.npcId],mirror=record?.incomeActivation;
  need(record?.met===true&&validClock(record)&&record.secondOfHour!==undefined&&timeOf(record)>=receiptTime(receipt)&&timeOf(record)<=timeOf(state)&&exact(mirror,receiptKeys)&&receiptKeys.every(key=>mirror[key]===receipt[key]),'El acuerdo de ingresos no coincide con su conversación.');
 }
 for(const [npcId,record]of Object.entries(state.conversations??{}))if(record?.incomeActivation!==undefined){
  const source=townIncomeSourceForNPC(npcId);need(source&&ledger.activations[source.id],'Falta el acuerdo de ingresos de la conversación guardada.');
 }
}

// One boundary call yields one payment. Returning to a save at the same
// midnight cannot collect it again, including a zero-income boundary.
export function collectTownIncome(state){
 initializeTownIncome(state);validateTownIncome(state);
 const day=Math.floor(state.hour/24);
 if(!day||state.hour%24!==0||(state.secondOfHour??0)!==0||state.townIncome.lastPaidDay>=day)return {paid:false,day,amount:0,sources:[]};
 const sources=townIncomeSources(state).filter(source=>source.daily>0),amount=sources.reduce((total,source)=>total+source.daily,0),treasury=state.resources?.treasury;
 need(Number.isSafeInteger(treasury)&&treasury>=0&&Number.isSafeInteger(treasury+amount)&&treasury+amount<=1_000_000_000,'La tesorería no puede recibir este cobro.');
 state.resources.treasury+=amount;state.townIncome.lastPaidDay=day;
 return {paid:true,day,hour:state.hour,secondOfHour:0,amount,sources:sources.map(source=>({id:source.id,amount:source.daily}))};
}
