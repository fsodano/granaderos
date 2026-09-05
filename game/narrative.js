import {CAMPAIGN_SECTORS} from './data.js';
export const ROYALIST_COMMANDS=[
 {id:'crown',name:'Consejo de la Corona',commander:'Francisco Javier de Elío y Gaspar de Vigodet',theater:'coast',objective:'Sostener Montevideo, estrangular las aduanas y coordinar la restauración colonial.',doctrine:'Gobierno colonial y bloqueo del estuario'},
 {id:'north',name:'Ejército Real del Perú',commander:'Joaquín de la Pezuela',deputy:'Pío Tristán',theater:'north',objective:'Descender por Humahuaca, recuperar Jujuy y Salta, y alcanzar la Ciudadela de Tucumán.',doctrine:'Infantería veterana y penetración por el Camino Real'},
 {id:'naval',name:'Flotilla Realista del Plata',commander:'Jacinto de Romarate',theater:'coast',objective:'Interrumpir la recaudación aduanera y el contrabando mediante desembarcos y bloqueos.',doctrine:'Incursiones anfibias sobre los puertos de mayor valor'},
 {id:'partisans',name:'Cabildos leales y partidas del interior',commander:'Mandos locales y cuadros de Talavera',theater:'interior',objective:'Aprovechar el descontento para saquear estancias y cortar el enlace de Córdoba.',doctrine:'Sabotaje logístico y requisas sobre provincias de baja lealtad'},
];
export const NORTHERN_AXIS=['humahuaca','jujuy','salta','tucuman'];
export function coastalRevenue(s){return CAMPAIGN_SECTORS.filter(d=>d.theater==='coast'&&s.sectors[d.id].owner==='patriot').reduce((v,d)=>v+Math.floor(d.income*(s.sectors[d.id].damageUntil>s.hour?.25:1)*(s.blockade?.25:1)),0);}
export function royalistIntel(s){
 const north=NORTHERN_AXIS.find(id=>s.sectors[id].owner==='patriot');
 const ports=['san_nicolas','santa_fe','ensenada','buenos_aires'].filter(id=>s.sectors[id].owner==='patriot').sort((a,b)=>CAMPAIGN_SECTORS.find(x=>x.id===b).income-CAMPAIGN_SECTORS.find(x=>x.id===a).income);
 return ROYALIST_COMMANDS.map(c=>({...c,target:c.id==='north'?north??null:c.id==='naval'?ports[0]??null:c.id==='partisans'&&s.sectors.cordoba.owner==='patriot'&&s.sectors.cordoba.loyalty<50?'cordoba':null,nextActionHours:c.id==='north'?120-s.hour%120:c.id==='naval'?168-s.hour%168:c.id==='partisans'?144-s.hour%144:null,active:s.completed||s.defeated?false:c.id==='north'?Boolean(north):c.id==='naval'?coastalRevenue(s)>=500:c.id==='partisans'?s.sectors.cordoba.owner==='patriot'&&s.sectors.cordoba.loyalty<50:true}));
}
export function mentorDispatch(s){
 const messages=[
 'San Martín: «La instrucción comienza en Retiro. Reunamos hombres, caballos y armas antes de empeñar al regimiento».',
 'San Martín: «El convento de San Carlos oculta nuestra preparación. Coordinemos las dos alas para impedir que el desembarco vuelva a sus embarcaciones».',
 'San Martín: «En Yatasto estudiaremos el estado del Ejército del Norte. La vía del Alto Perú exige esfuerzos que pueden agotarnos sin resolver la guerra».',
 'San Martín: «Güemes sostendrá la frontera. Desde Cuyo preparemos las maestranzas, la tropa y los acuerdos necesarios para franquear los Andes».',
 'San Martín: «El ejército está preparado. Conservemos las comunicaciones y concluiremos la liberación de nuestras provincias».',
 ];
 return {name:'José de San Martín',role:s.phase<4?'Mentor estratégico':'Comandante disponible',text:messages[s.phase],deployable:s.phase>=4};
}
export function oppositionFor(request){
 const command=ROYALIST_COMMANDS.find(c=>c.id===(request.theater==='north'?'north':request.theater==='coast'?'naval':'partisans'));
 const count=Math.max(3,request.squad.length+request.difficulty-1);
 const names=request.theater==='north'?['Oficial de la vanguardia de Tristán','Veterano del Ejército Real del Perú','Fusilero de Pezuela']:request.theater==='coast'?['Oficial de la flotilla de Romarate','Infante de desembarco realista','Marinero de la escuadra de Montevideo']:['Oficial de los cuadros de Talavera','Partidario del Cabildo realista','Miliciano leal a la Corona'];
 return {enemyCommand:command.id,enemyCommander:command.commander,enemyObjective:command.objective,enemies:Array.from({length:count},(_,i)=>({id:`enemy-${i}`,name:`${names[i%names.length]} ${Math.floor(i/names.length)+1}`,weapon:i===0?1805:i%3===0?1801:1800,blade:i===0?1809:1811,marksmanship:50+request.difficulty*5+(request.theater==='north'?3:0),morale:60+request.difficulty*5,leadership:i===0?75:40}))};
}
