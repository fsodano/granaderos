// Render TSX in tests with the existing compiler; no extra test dependencies.
import {readFileSync,existsSync} from 'node:fs';
import ts from '../web/node_modules/typescript/lib/typescript.js';
export function resolve(specifier,context,next){
 if(context.parentURL?.includes('/web/app/')&&specifier.startsWith('.')&&!/\.[a-z]+$/.test(specifier)){
  const extension=['.tsx','.ts','.js'].find(ext=>existsSync(new URL(`${specifier}${ext}`,context.parentURL)));
  if(extension)return next(`${specifier}${extension}`,context);
 }
 return next(specifier,context);
}
export function load(url,context,next){
 if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default {};'};
 if(/\.tsx?$/.test(url))return {format:'module',shortCircuit:true,source:ts.transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText};
 return next(url,context);
}
