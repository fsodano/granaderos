import {ROSTER_SKIN_TONES} from './sprite-skin-roster.js';
import {BALANCED_PORTRAITS} from './portrait-expansion.js';

export const PORTRAIT_GENDERS=[{id:'woman',name:'Mujeres'},{id:'man',name:'Hombres'}];
export const PORTRAIT_ROLES=[
 {id:'soldier',name:'Soldados'},{id:'officer',name:'Oficiales'},
 {id:'scout',name:'Exploración'},{id:'gaucho',name:'Gauchos y gauchas'},
 {id:'artisan',name:'Artesanos y artesanas'},{id:'medic',name:'Medicina'},
];
export const PORTRAIT_SKIN_TONES=[{id:'light',name:'Clara'},{id:'brown',name:'Morena'},{id:'dark',name:'Oscura'}];
export const PORTRAITS_PER_COMBINATION=5;
// Surplus faces remain valid for old saves and for their paid recruit owners.
// The chooser uses exactly five faces in each gender/type/skin-tone group.
export const LEGACY_ONLY_PORTRAIT_IDS=Object.freeze(['104','113','143','100','106','108']);

// These are art categories, not gameplay classes or the identities of the
// recruits whose portraits are reused. Metadata follows assets/prompts/
// custom-avatars.json, paid-portraits.json and mercenary-portraits.json.
// Keep the original four avatars and 48 numeric IDs in their save-safe order.
const originalAvatars=[
 {id:'avatar-woman-scout',name:'Exploradora con trenza',gender:'woman',role:'scout',skinTone:'brown',spriteAppearance:'woman-scout'},
 {id:'avatar-woman-civilian',name:'Artesana con chal',gender:'woman',role:'artisan',skinTone:'brown',spriteAppearance:'woman-shawl'},
 {id:'avatar-man-gaucho',name:'Gaucho de poncho rojizo',gender:'man',role:'gaucho',skinTone:'brown',spriteAppearance:'gaucho'},
 {id:'avatar-man-soldier',name:'Soldado con patillas',gender:'man',role:'soldier',skinTone:'light',spriteAppearance:'granadero'},
// Preserve the original avatars' existing tactical palettes in older saves.
].map(portrait=>({...portrait,src:`/art/${portrait.id}.webp`,spriteSkinTone:'brown'}));

// The first five generated paid portraits have their own authoring manifest.
// The two naval portraits retain their established fair-skin art direction.
const earlySkinTones={100:'brown',101:'brown',102:'light',103:'light',104:'light',105:'light',106:'brown'};
/** @type {Array<[number,string,string,string]>} */
const paidPortraitRows=[
 [100,'man','gaucho','Campesino de poncho pardo'],
 [101,'woman','scout','Exploradora del Litoral'],
 [102,'man','artisan','Aprendiz con delantal'],
 [103,'man','artisan','Artillero de marina'],
 [104,'man','soldier','Marinero de chaqueta azul'],
 [105,'man','soldier','Fusilero veterano'],
 [106,'man','gaucho','Jinete de frontera'],
 [107,'woman','medic','Enfermera con pañuelo blanco'],
 [108,'man','gaucho','Gaucho de pañuelo rojo'],
 [109,'man','officer','Oficial de casaca escarlata'],
 [110,'man','soldier','Miliciano de cuello rojo'],
 [111,'man','officer','Oficial de ingenieros'],
 [112,'man','medic','Cirujano con anteojos'],
 [113,'man','officer','Oficial de infantería ligera'],
 [114,'man','soldier','Instructor de bigote gris'],
 [115,'man','scout','Explorador de poncho oscuro'],
 [116,'woman','medic','Socorrista de chal azul'],
 [117,'man','gaucho','Gaucho de poncho ocre'],
 [118,'man','officer','Oficial de artillería'],
 [119,'man','soldier','Recluta de chaqueta parda'],
 [120,'woman','scout','Guía de chal bordó'],
 [121,'man','artisan','Carpintero de delantal'],
 [122,'woman','medic','Practicante de chal verde'],
 [123,'man','soldier','Infante veterano'],
 [124,'man','officer','Oficial de caballería escarlata'],
 [125,'man','artisan','Zapador de chaqueta rojiza'],
 [126,'woman','scout','Exploradora serrana'],
 [127,'man','soldier','Instructor de túnica azul'],
 [128,'man','officer','Oficial de fusileros'],
 [129,'man','gaucho','Arriero de barba gris'],
 [130,'woman','medic','Auxiliar con pañuelo crema'],
 [131,'man','soldier','Carabinero de chaqueta azul'],
 [132,'man','officer','Oficial de patillas blancas'],
 [133,'man','artisan','Herrero de delantal de cuero'],
 [134,'man','scout','Vigía de bufanda oscura'],
 [135,'woman','medic','Practicante de trenzas grises'],
 [136,'man','scout','Viajero de pañuelo ocre'],
 [137,'man','officer','Oficial de caballería azul'],
 [138,'man','soldier','Artillero de casaca naval'],
 [139,'woman','medic','Enfermera de cabello rojizo'],
 [140,'man','artisan','Armero de chaleco de cuero'],
 [141,'man','soldier','Marinero de pañuelo rojo'],
 [142,'man','soldier','Fusilero de casaca verde'],
 [143,'man','officer','Oficial de cuello alto'],
 [144,'man','artisan','Mecánico de barba cuadrada'],
 [145,'man','gaucho','Gaucho de poncho rojo'],
 [146,'man','medic','Cirujano de casaca azul'],
 [147,'man','scout','Explorador de poncho tejido'],
];

// New authored Black characters include both genders in every visual role.
// The existing sprite families are shared; palettes remain independent.
const additionalAvatarRows=[
 ['man','soldier','Soldado de casaca azul','granadero'],
 ['man','officer','Oficial de cuello rojo','granadero'],
 ['man','scout','Explorador de campaña','gaucho'],
 ['man','gaucho','Gaucho de poncho tejido','gaucho'],
 ['man','artisan','Artesano de delantal','worker'],
 ['man','medic','Médico de campaña','surgeon'],
 ['woman','soldier','Soldada de casaca azul','woman-scout'],
 ['woman','officer','Oficial de cuello rojo','woman-scout'],
 ['woman','scout','Exploradora de campaña','woman-scout'],
 ['woman','gaucho','Gaucha de poncho tejido','woman-scout'],
 ['woman','artisan','Artesana de delantal','woman-shawl'],
 ['woman','medic','Médica de campaña','woman-shawl'],
];

export const CHARACTER_PORTRAITS=[
 ...originalAvatars,
 ...paidPortraitRows.map(([id,gender,role,name])=>({
  id:String(id),src:`/art/portrait-${id}.${[103,104].includes(id)?'png':'webp'}`,
  name,gender,role,skinTone:earlySkinTones[id]??ROSTER_SKIN_TONES[id],
 })),
 ...additionalAvatarRows.map(([gender,role,name,spriteAppearance])=>{
  const id=`avatar-${gender}-black-${role}`,skinTone=role==='gaucho'?'brown':'dark';
  return {id,src:`/art/${id}.webp`,name,gender,role,skinTone,spriteAppearance,spriteSkinTone:skinTone};
 }),
 ...BALANCED_PORTRAITS,
].map(portrait=>({...portrait,selectable:!LEGACY_ONLY_PORTRAIT_IDS.includes(portrait.id)}));

export const SELECTABLE_CHARACTER_PORTRAITS=CHARACTER_PORTRAITS.filter(portrait=>portrait.selectable);

const portraitsById=new Map(CHARACTER_PORTRAITS.map(portrait=>[portrait.id,portrait]));
export const characterPortrait=id=>portraitsById.get(id);
