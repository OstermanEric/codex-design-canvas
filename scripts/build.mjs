import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const root = new URL('../',import.meta.url);
const result=await build({entryPoints:[new URL('../web/app.js',import.meta.url).pathname],bundle:true,format:'esm',platform:'browser',write:false,minify:true});
let html=await readFile(new URL('web/index.html',root),'utf8');
html=html.replace('/* STYLES */',await readFile(new URL('web/style.css',root),'utf8')).replace('/* SCRIPT */',()=>result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script'));
await mkdir(new URL('dist/',root),{recursive:true});
await writeFile(new URL('dist/index.html',root),html);
for(const entry of ['mcp','http','cli']){
  await build({entryPoints:[new URL(`src/${entry}.mjs`,root).pathname],outfile:new URL(`dist/${entry}.mjs`,root).pathname,bundle:true,format:'esm',platform:'node',target:'node22',banner:{js:"import {createRequire as __createRequire} from 'node:module'; const require = __createRequire(import.meta.url);"}});
}
await build({entryPoints:[new URL('scripts/demo.mjs',root).pathname],outfile:new URL('dist/demo.mjs',root).pathname,bundle:true,format:'esm',platform:'node',target:'node22',banner:{js:"import {createRequire as __createRequire} from 'node:module'; const require = __createRequire(import.meta.url);"}});
console.log(`Built design canvas (${Math.round(Buffer.byteLength(html)/1024)} KB)`);

await import('./notices.mjs');
