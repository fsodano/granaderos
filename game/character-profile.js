export const PROFILE_ATTRIBUTES=[['maxHp','Salud'],['agility','Agilidad'],['dexterity','Destreza'],['strength','Fuerza'],['leadership','Liderazgo'],['wisdom','Sabiduría'],['marksmanship','Puntería'],['mechanical','Mecánica'],['explosives','Pólvora y artillería'],['medical','Medicina']].map(([id,name])=>({id,name}));
export const PROFILE_POINTS=550;
export const CHARACTER_CLASSES=[
 {id:'gaucho',name:'Gaucho',description:'Facón, carabina y experiencia ecuestre.',weapon:1803,blade:1813},
 {id:'soldado',name:'Soldado de línea',description:'Mosquete y bayoneta para la infantería.',weapon:1800,blade:1811},
 {id:'baqueano',name:'Baqueano',description:'Escopeta y facón para explorar la campaña.',weapon:1804,blade:1813},
 {id:'artesano',name:'Artesano',description:'Pistola y saber de taller.',weapon:1805,blade:1813},
];
export const CHARACTER_PORTRAITS=[{id:'avatar-woman-scout',src:'/art/avatar-woman-scout.webp',name:'Exploradora'},{id:'avatar-woman-civilian',src:'/art/avatar-woman-civilian.webp',name:'Artesana'},{id:'avatar-man-gaucho',src:'/art/avatar-man-gaucho.webp',name:'Gaucho'},{id:'avatar-man-soldier',src:'/art/avatar-man-soldier.webp',name:'Soldado'},{id:'103',src:'/art/portrait-103.png',name:'Marino'},{id:'104',src:'/art/portrait-104.png',name:'Voluntario'}];
export const PROFILE_QUESTIONS=[
 {id:'specialty',label:'Durante una marcha difícil, ¿qué tarea asumes?',choices:[{id:'rider',name:'Domar y conducir los caballos'},{id:'night',name:'Reconocer el terreno después del ocaso'},{id:'teacher',name:'Instruir a los voluntarios nuevos'}]},
 {id:'temperament',label:'Tras un revés, ¿cómo juzgas la próxima jornada?',choices:[{id:'optimistic',name:'Confío en que podremos recuperarnos'},{id:'pessimistic',name:'Preveo lo peor para no exponer a mis compañeros'},{id:'steady',name:'Me concentro en la tarea inmediata'}]},
];
export const defaultProfile=()=>({version:2,classId:'gaucho',portraitId:'avatar-man-gaucho',attributes:Object.fromEntries(PROFILE_ATTRIBUTES.map(a=>[a.id,55]))});
export function applyCharacterProfile(op,answers,profile){
 if(profile===undefined)return op;
 if(profile?.nickname!==undefined&&(typeof profile.nickname!=='string'||profile.nickname.length>16||/[<>\x00-\x1f]/u.test(profile.nickname)))throw Error('El apodo debe tener hasta 16 caracteres, sin símbolos de marcado.');
 const cls=CHARACTER_CLASSES.find(c=>c.id===profile?.classId);
 if(profile?.version!==2||!cls||!CHARACTER_PORTRAITS.some(p=>p.id===profile.portraitId))throw Error('Elegí una clase y un retrato válidos.');
 if(PROFILE_QUESTIONS.some(q=>!q.choices.some(c=>c.id===answers?.[q.id])))throw Error('Completá el cuestionario personal.');
 if(!profile.attributes||Object.keys(profile.attributes).length!==PROFILE_ATTRIBUTES.length||PROFILE_ATTRIBUTES.some(a=>!Number.isInteger(profile.attributes[a.id])||profile.attributes[a.id]<35||profile.attributes[a.id]>85)||Object.values(profile.attributes).reduce((a,b)=>a+b,0)!==PROFILE_POINTS)throw Error('Distribuí exactamente 550 puntos: cada atributo debe quedar entre 35 y 85.');
 return {...op,...profile.attributes,nickname:profile.nickname?.trim()||op.nickname,hp:profile.attributes.maxHp,role:cls.name,classId:cls.id,weapon:cls.weapon,blade:cls.blade,portrait:CHARACTER_PORTRAITS.find(p=>p.id===profile.portraitId).src,portraitId:profile.portraitId,monthlyPay:0,weeklyPay:0,personality:answers.temperament,ridingSkill:answers.specialty==='rider'?80:answers.origin==='estancia'?55:20,origin:answers.origin,crisisResponse:answers.crisis,traits:[answers.doctrine,...(answers.origin==='workshop'?['workshop_training']:answers.origin==='cabildo'?['teacher']:[]),...(answers.crisis==='rescue'?['field_rescuer']:answers.crisis==='rally'?['steadfast']:['guerrilla_tactician']),...(answers.specialty==='night'?['night_vision']:answers.specialty==='teacher'?['teacher']:['expert_rider'])],biography:'Granadero ficticio creado por el jugador. Sus atributos fueron asignados al comenzar la campaña.'};
}
