/** Apply a selected tone without double-tinting an optional coloured albedo.
 * Materials without a valid reference retain the existing palette behaviour.
 * @param {{color:{set:(tone:string)=>unknown,r:number,g:number,b:number},userData?:Record<string,unknown>}} material
 * @param {string} tone
 */
export function applySkinPalette(material,tone){
  material.color.set(tone);
  const reference=material.userData?.skinAlbedoReference;
  if(!Array.isArray(reference)||reference.length!==3||!reference.every(value=>Number.isFinite(value)&&value>0))return;
  material.color.r/=reference[0];material.color.g/=reference[1];material.color.b/=reference[2];
}
