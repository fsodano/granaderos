import {canonicalContent} from '../game/content-identity.js';
import {defaultContentPackage} from '../game/content-package.js';

// Each distinct authored package still earns its fixture through real orders.
// Repeated consumers receive independent copies of that exact completed setup.
export function contentFixtureCache(prepare){
 const prepared=new Map();
 return content=>{
  const key=canonicalContent(content??defaultContentPackage());
  if(!prepared.has(key))prepared.set(key,structuredClone(prepare(content)));
  return structuredClone(prepared.get(key));
 };
}
