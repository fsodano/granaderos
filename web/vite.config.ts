import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';
export default defineConfig({ css: { postcss: { plugins: [tailwindcss()] } }, server: { host: '0.0.0.0', fs: { allow: ['..'] } }, plugins: [vinext()] });
