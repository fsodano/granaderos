import {isValidElement,type ReactNode} from 'react';

// Room discovery rebuilds scene descriptions. Equal descriptions must keep
// their mounted raster layer; replacing them briefly restores thousands of
// filtered SVG shapes, even when the resulting image has not changed.
// Inputs belong to immutable scene descriptions. Weak keys release old maps
// and share comparisons of room metadata repeated by many wall segments.
const compared=new WeakMap<object,WeakMap<object,boolean>>();
export function sameStaticSceneContent(a:unknown,b:unknown):boolean{
 if(Object.is(a,b))return true;
 if(a===null||b===null||typeof a!=='object'||typeof b!=='object')return false;
 const known=compared.get(a)?.get(b);if(known!==undefined)return known;
 const equal=compareContent(a,b);
 let pairs=compared.get(a);if(!pairs){pairs=new WeakMap();compared.set(a,pairs);}pairs.set(b,equal);
 return equal;
}
function compareContent(a:object,b:object):boolean{
 if(isValidElement(a)||isValidElement(b)){
  return isValidElement(a)&&isValidElement(b)&&a.type===b.type&&a.key===b.key&&sameStaticSceneContent(a.props,b.props);
 }
 if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((item,index)=>sameStaticSceneContent(item,b[index]));
 // Scene props are plain objects. Unknown objects use identity so a new
 // resource, callback or collection cannot silently retain an old picture.
 if(Object.getPrototypeOf(a)!==Object.prototype||Object.getPrototypeOf(b)!==Object.prototype)return false;
 const keys=Object.keys(a),other=Object.keys(b);
 return keys.length===other.length&&keys.every(key=>Object.hasOwn(b,key)&&sameStaticSceneContent((a as Record<string,unknown>)[key],(b as Record<string,unknown>)[key]));
}

export const sameStaticSceneProps=(previous:{children:ReactNode},next:{children:ReactNode})=>sameStaticSceneContent(previous.children,next.children);
