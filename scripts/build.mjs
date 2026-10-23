import {build} from 'esbuild';
import {mkdir, readFile, writeFile, cp, rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {milkdownSlashPlugin} from './milkdown-adapters.mjs';
import {writeNotices} from './notices.mjs';
const root='packages/editor';
for(const name of ['@milkdown/crepe','@milkdown/components']) {
  const pkg=JSON.parse(await readFile(`node_modules/${name}/package.json`));
  if(pkg.version!=='7.22.3')throw Error(`Adapter supports ${name} 7.22.3 only; found ${pkg.version}`);
}
const workspace=fileURLToPath(new URL('../',import.meta.url));
if(resolve('.')!==resolve(workspace))throw Error('Run build from the repository root');
// Only these two known generated directories are replaced by the build.
for(const dir of ['packages/editor/dist','apps/local/dist'])await rm(resolve(workspace,dir),{recursive:true,force:true});
await mkdir(`${root}/dist`,{recursive:true});
const js=await build({entryPoints:[`${root}/src/index.ts`],outdir:`${root}/dist`,bundle:true,format:'esm',splitting:true,platform:'browser',target:'es2022',minify:true,plugins:[milkdownSlashPlugin()],legalComments:'linked',chunkNames:'chunks/[name]-[hash]',metafile:true});
const css=await build({entryPoints:[`${root}/src/style.css`],outfile:`${root}/dist/style.css`,bundle:true,minify:true,loader:{'.woff2':'file','.woff':'file','.ttf':'file'},assetNames:'fonts/[name]-[hash]',legalComments:'linked',metafile:true});
await writeNotices([...Object.keys(js.metafile.inputs),...Object.keys(css.metafile.inputs)]);
await writeFile(`${root}/dist/style.css.d.ts`,'export {};\n');
execFileSync(process.execPath,['node_modules/typescript/bin/tsc','--project','packages/editor/tsconfig.build.json'],{stdio:'inherit'});
await mkdir('apps/local/dist',{recursive:true});
await build({entryPoints:['apps/local/src/app.ts'],outfile:'apps/local/dist/app.js',bundle:true,format:'esm',target:'es2022',external:['@local/milkdown-notes'],sourcemap:true});
await cp('apps/local/src/app.css','apps/local/dist/app.css');
await cp('apps/local/src/index.html','apps/local/dist/index.html');
await build({entryPoints:['examples/ai-test.ts'],outfile:'apps/local/dist/ai-test.js',bundle:true,format:'esm',target:'es2022',minify:true,plugins:[milkdownSlashPlugin()],legalComments:'linked'});
console.log('Built reusable editor, local app and browser integration example.');
