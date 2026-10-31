import type { LoadHook } from 'node:module';
// Test-only counters at real read-model entry points. No production hooks or mocks.
import ts from '../apps/web/node_modules/typescript/lib/typescript.js';
const names = new Set([
  'orderDescriptors',
  'equipmentSlots',
  'handSlots',
  'equippedItemHelp',
  'heardNoiseModel',
  'medicalUsePreview',
  'itemUsePreview',
  'supplyUsePreview',
  'artilleryReloadPreview',
]);
export const load: LoadHook = async (url, context, next) => {
  const result = await next(url, context);
  if (!/\/game\/(ja2-hud|tactical)\.js$/.test(url)) {
    return result;
  }
  if (result.source === null || result.source === undefined) {
    throw new Error('The instrumented JavaScript module must have source text.');
  }
  let source =
    typeof result.source === 'string' ? result.source : new TextDecoder().decode(result.source);
  const file = ts.createSourceFile(url, source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS);
  const functions = file.statements.filter(ts.isFunctionDeclaration);
  for (const node of functions.reverse()) {
    if (!node.name || !names.has(node.name.text) || !node.body) {
      continue;
    }
    const at = node.body.getStart(file) + 1,
      name = JSON.stringify(node.name.text);
    source =
      source.slice(0, at) +
      `if(globalThis.__ordersWork)globalThis.__ordersWork[${name}]=(globalThis.__ordersWork[${name}]??0)+1;` +
      source.slice(at);
  }
  return { ...result, source };
};
