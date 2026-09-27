export function portraitFor(id:number|string):string|null {
 if(typeof id==='string'&&(/^\/art\/[a-zA-Z0-9_-]+\.(png|webp|jpg|jpeg)$/.test(id)||/^data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+/=]+$/.test(id)))return id;
 if(['avatar-woman-scout','avatar-woman-civilian','avatar-man-gaucho','avatar-man-soldier'].includes(String(id)))return `/art/${id}.webp`;
 const value=Number(id);
 if([103,104].includes(value))return `/art/portrait-${value}.png`;
 return [0,1,2,3,4,5,6,7,8,9,10,11,57,100,101,102,105,106].includes(value)||(Number.isInteger(value)&&value>=107&&value<=147)?`/art/portrait-${value}.webp`:null;
}
