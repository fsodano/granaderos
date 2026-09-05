export function portraitFor(id:number|string):string|null {
 const value=Number(id);
 if([103,104].includes(value))return `/art/portrait-${value}.png`;
 return [0,1,2,3,4,5,6,7,8,9,10,11,57].includes(value)?`/art/portrait-${value}.webp`:null;
}
