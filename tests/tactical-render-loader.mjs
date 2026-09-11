// Render TSX in tests with the existing compiler; no extra test dependencies.
import {readFileSync,existsSync} from 'node:fs';
import ts from '../web/node_modules/typescript/lib/typescript.js';
export function resolve(specifier,context,next){
 if(specifier.startsWith('@/')){
  const base=new URL(`../web/${specifier.slice(2)}`,import.meta.url);
  const extension=['','.tsx','.ts','.js'].find(ext=>existsSync(new URL(`${base.href}${ext}`)));
  if(extension!==undefined)return next(`${base.href}${extension}`,context);
 }
 if(context.parentURL?.includes('/web/')&&specifier.startsWith('.')&&!/\.[a-z]+$/.test(specifier)){
  const extension=['.tsx','.ts','.js'].find(ext=>existsSync(new URL(`${specifier}${ext}`,context.parentURL)));
  if(extension)return next(`${specifier}${extension}`,context);
 }
 return next(specifier,context);
}
export function load(url,context,next){
 if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default {};'};
 if(url.endsWith('.json'))return next(url,{...context,importAttributes:{...context.importAttributes,type:'json'}});
 if(/\.tsx?$/.test(url)){
  const result=ts.transpileModule(readFileSync(new URL(url),'utf8'),{fileName:new URL(url).pathname,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
  const errors=(result.diagnostics??[]).filter(diagnostic=>diagnostic.category===ts.DiagnosticCategory.Error);
  if(errors.length)throw Error(`${url}: ${errors.map(error=>ts.flattenDiagnosticMessageText(error.messageText,'\n')).join('\n')}`);
  return {format:'module',shortCircuit:true,source:result.outputText};
 }
 return next(url,context);
}
