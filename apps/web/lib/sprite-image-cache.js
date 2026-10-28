const images=new Map();
export function spriteContinuity(requested,loaded,readyHref){
 const sameLife=loaded&&['dead','collapse','unconscious'].every(condition=>loaded.name.includes(condition)===requested.name.includes(condition));
 return readyHref===requested.href?requested:sameLife?loaded:requested;
}
/** Keep the previous atlas drawn until the next one is decoded. */
export function loadSpriteImage(href,ImageClass=globalThis.Image){
 if(images.has(href))return images.get(href);
 if(!ImageClass)return Promise.resolve(false);
 const promise=new Promise(resolve=>{
  const image=new ImageClass();
  image.onload=async()=>{try{await image.decode?.();}catch{/* onload still confirms a usable image. */}resolve(true);};
  image.onerror=()=>resolve(false);
  image.src=href;
 });
 images.set(href,promise);return promise;
}
