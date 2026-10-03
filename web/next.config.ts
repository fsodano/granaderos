import type { NextConfig } from 'next';
import {normalizeBasePath} from '../tools/deployment-path.mjs';
const basePath = normalizeBasePath();
// vinext prerenders routes at their root paths. The asset prefix and browser
// URL helpers apply the project path without preventing that prerender pass.
// The build tool adds static directory entry points after prerendering.
const nextConfig: NextConfig = { output: 'export', assetPrefix: basePath };
export default nextConfig;
