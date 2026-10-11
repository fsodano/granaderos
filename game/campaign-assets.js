// Portable campaign URLs remain independent of the hosting base path.
export function isCampaignAssetReference(value) {
 if(typeof value!=='string')return false;
 return /^\/campaigns\/[a-z0-9][a-z0-9_-]*\/assets\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:png|webp|jpg|jpeg)$/.test(value);
}

export function isContentImageReference(value) {
 return typeof value==='string'&&(isCampaignAssetReference(value)||/^\/art\/[a-zA-Z0-9_-]+\.(?:png|webp|jpg|jpeg)$/.test(value)||/^data:image\/(?:png|webp|jpeg);base64,[A-Za-z0-9+/=]+$/.test(value));
}

export const campaignRelativePath=value=>typeof value==='string'&&value.length<=240&&!value.startsWith('/')&&!value.includes('\\')&&value.split('/').every(part=>part&&part!=='.'&&part!=='..'&&/^[a-zA-Z0-9_.-]+$/.test(part));
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const fileTypes={png:'image/png',webp:'image/webp',jpg:'image/jpeg',jpeg:'image/jpeg',json:'application/json'};
const imageFields=new Set(['portrait','art','src','menuArt']);
export function validateCampaignAssets(value){
 if(!object(value)||value.version!==1||!Array.isArray(value.assets)||value.assets.length>3000)return ['Recursos de campaña: catálogo o versión inválida.'];
 const errors=[],ids=new Set(),paths=new Set();
 for(const asset of value.assets){
  const valid=object(asset)&&typeof asset.id==='string'&&/^[a-z][a-z0-9-]{0,79}$/.test(asset.id)&&!['constructor','prototype'].includes(asset.id)&&!ids.has(asset.id)&&campaignRelativePath(asset.path)&&asset.path.startsWith('assets/')&&!paths.has(asset.path)&&typeof asset.sha256==='string'&&/^[a-f0-9]{64}$/.test(asset.sha256)&&Object.hasOwn(fileTypes,asset.path.split('.').at(-1))&&fileTypes[asset.path.split('.').at(-1)]===asset.type;
  if(!valid)errors.push('Recursos de campaña: referencia, tipo o suma de control inválida.');
  ids.add(asset?.id);paths.add(asset?.path);
 }
 return errors;
}

// Installed packages can reference their own declared files or inline images.
// The renderer's shared textures are selected by core code, not by package JSON.
export function validateSelectedCampaignAssets(id,assets,sources){
 const errors=[],prefix=`/campaigns/${id}/`,files=new Map((Array.isArray(assets?.assets)?assets.assets:[]).filter(object).map(asset=>[asset.path,asset]));
 const visit=(value,field)=>{
  if(Array.isArray(value))for(const child of value)visit(child,field);
  else if(object(value))for(const [key,child]of Object.entries(value))visit(child,key);
  else if(typeof value==='string'){
   if(value.startsWith('/campaigns/')){
    const asset=value.startsWith(prefix)?files.get(value.slice(prefix.length)):undefined;
    if(!asset)errors.push(`El recurso ${value} no pertenece al paquete.`);
    else if(imageFields.has(field)||/\.(png|webp|jpe?g)$/.test(value))if(!isCampaignAssetReference(value)||typeof asset.type!=='string'||!asset.type.startsWith('image/'))errors.push(`El recurso de imagen ${value} tiene otro tipo.`);
   }else if(value.startsWith('/art/'))errors.push(`El recurso ${value} necesita estar incluido en el paquete.`);
   if(imageFields.has(field)&&(!isContentImageReference(value)||value.startsWith('data:')&&value.length>=350000))errors.push(`El campo ${field} necesita una imagen válida del paquete.`);
  }else if(imageFields.has(field))errors.push(`El campo ${field} necesita una imagen válida del paquete.`);
 };
 for(const source of sources)visit(source);
 return errors;
}
