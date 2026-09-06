// Render TSX in tests with the existing compiler; no extra test dependencies.
import {readFileSync} from 'node:fs';
import ts from '../web/node_modules/typescript/lib/typescript.js';
export function resolve(specifier,context,next){
 if(context.parentURL?.includes('/web/app/')&&specifier.startsWith('.')&&!/\.[a-z]+$/.test(specifier))return next(`${specifier}.tsx`,context);
 return next(specifier,context);
}
export function load(url,context,next){
 if(url.endsWith('.tsx'))return {format:'module',shortCircuit:true,source:ts.transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText};
 return next(url,context);
}
