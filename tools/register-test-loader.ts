import { register } from 'node:module';

register('./test-module-loader.ts', import.meta.url);

register('./test-render-loader.ts', import.meta.url);
