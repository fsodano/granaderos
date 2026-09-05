import {OPERATIVES} from './data.js';
export const OFFICER_TRAITS=[
 {id:'cavalry_commander',name:'Comandante de caballería',description:'Instrucción ecuestre, mando y maniobras a caballo.'},
 {id:'guerrilla_tactician',name:'Táctico de guerrillas',description:'Exploración, ocultamiento y movilidad en terreno quebrado.'},
 {id:'gunsmith_artillerist',name:'Maestro armero y artillero',description:'Cuidado de llaves, reparación y servicio de las piezas.'},
 {id:'line_marksman',name:'Tirador de línea',description:'Puntería deliberada, tiro disciplinado y armas rayadas.'},
];
export const OFFICER_QUESTIONS=[
 {id:'origin',label:'¿Dónde adquiriste tu formación?',choices:[{id:'estancia',name:'En una estancia: caballos y trabajo de campo'},{id:'cabildo',name:'En el Cabildo: estudios y administración'},{id:'workshop',name:'En un taller: herramientas y metalurgia'}]},
 {id:'doctrine',label:'¿Qué disciplina guiará tu servicio?',choices:OFFICER_TRAITS.map(t=>({id:t.id,name:t.name}))},
 {id:'crisis',label:'Un compañero cae bajo el fuego. ¿Cómo respondes?',choices:[{id:'rescue',name:'Acudo a socorrerlo'},{id:'rally',name:'Reúno al grupo y sostengo la posición'},{id:'flank',name:'Busco un flanco para aliviar la presión'}]},
];
const common={dexterity:60,wisdom:60,mechanical:20,explosives:15,medical:20,leadership:35,hp:70,maxHp:70,agility:65,strength:65,marksmanship:50,weapon:1804,blade:1813,priming:50,flints:4,rations:2};
export const CIVIC_RECRUITS=[
 {...common,id:100,name:'Rafael Sosa',nickname:'Sosa',role:'Peón y miliciano provincial',biography:'Un peón de la campaña que acude al boletín del Cabildo. Su experiencia con caballos y facón compensa una instrucción militar todavía escasa.',monthlyPay:180,weeklyPay:42,agility:72,strength:78,marksmanship:43,traits:['cavalry_commander'],sector:'buenos_aires'},
 {...common,id:101,name:'Tomasa Ríos',nickname:'Ríos',role:'Exploradora del Litoral',biography:'Conoce los senderos y bañados del Litoral. Se incorpora para proteger los pueblos ribereños y aprende con rapidez durante las incursiones.',monthlyPay:220,weeklyPay:51,agility:80,wisdom:74,marksmanship:48,traits:['guerrilla_tactician'],sector:'san_nicolas'},
 {...common,id:102,name:'Mateo Ferreyra',nickname:'Ferreyra',role:'Aprendiz de la maestranza',biography:'Un aprendiz de Caroya que conoce las herramientas y desea servir en la artillería. Su oficio brinda una base para aprender a reparar las armas de campaña.',monthlyPay:200,weeklyPay:47,mechanical:65,dexterity:74,marksmanship:45,traits:['gunsmith_artillerist'],sector:'cordoba'},
];
export function createOfficerRecord(name,answers){
 if(typeof name!=='string'||name.trim().length<2||name.trim().length>30||/[<>\x00-\x1f]/u.test(name))throw Error('Escribe un nombre de entre 2 y 30 caracteres, sin símbolos de marcado.');
 if(!answers||OFFICER_QUESTIONS.some(q=>!q.choices.some(c=>c.id===answers[q.id])))throw Error('Completa las tres preguntas del examen del Cabildo.');
 const op={...common,id:1000,name:name.trim(),nickname:name.trim().slice(0,14),role:'Oficial del Cabildo',biography:'Oficial incorporado mediante el Examen de Aptitud del Cabildo de Buenos Aires.',monthlyPay:300,weeklyPay:70,hp:78,maxHp:78,agility:72,dexterity:72,strength:70,leadership:65,wisdom:75,marksmanship:65,mechanical:35,explosives:30,medical:35,weapon:1803,traits:[answers.doctrine]};
 const boosts={estancia:{strength:10,agility:6},cabildo:{wisdom:10,leadership:8},workshop:{mechanical:25,dexterity:8},rescue:{medical:20,strength:5},rally:{leadership:12,wisdom:5},flank:{agility:10,marksmanship:5}};
 for(const response of [answers.origin,answers.crisis])for(const[k,v]of Object.entries(boosts[response]))op[k]=Math.min(95,op[k]+v);
 if(answers.doctrine==='line_marksman'){op.marksmanship+=12;op.weapon=1802;}
 if(answers.doctrine==='gunsmith_artillerist'){op.mechanical+=15;op.explosives+=15;}
 return op;
}
export function rosterFor(state){
 const base=[...OPERATIVES,...CIVIC_RECRUITS];if(state.officer)base.push(createOfficerRecord(state.officer.name,state.officer.answers));
 return base.map(op=>{
   const progress=state.operativeState?.[op.id],xp=progress?.xp??0,level=1+Math.min(9,Math.floor(xp/100));
   if(!CIVIC_RECRUITS.some(c=>c.id===op.id))return {...op,xp,level:1};
   const grown={...op,xp,level};for(const field of ['maxHp','agility','dexterity','strength','leadership','wisdom','marksmanship','mechanical','explosives','medical'])grown[field]=Math.min(95,op[field]+(level-1)*(field==='marksmanship'?4:2));return grown;
 });
}
export function civicStatus(state,id){
 const op=CIVIC_RECRUITS.find(o=>o.id===Number(id));if(!op)return {available:false,reason:'No existe ese voluntario.'};
 if(state.recruited.includes(op.id))return {available:false,reason:'Ya se encuentra en tus filas.'};
 if(state.sectors[op.sector]?.owner!=='patriot')return {available:false,reason:'Libera su Cabildo para abrir el boletín provincial.'};
 return {available:true,reason:'Disponible en el boletín del Cabildo.'};
}
