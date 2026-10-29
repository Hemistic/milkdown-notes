import { build } from 'esbuild';
import { mkdir, writeFile, cp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { milkdownSlashPlugin } from './milkdown-adapters.mjs';
import { writeNotices } from './notices.mjs';
const root = 'packages/editor';
const workspace = fileURLToPath(new URL('../', import.meta.url));
if (resolve('.') !== resolve(workspace)) throw Error('Run build from the repository root');
// Replace only the three known generated output directories.
for (const dir of ['packages/editor/dist', 'packages/sidebar/dist', 'apps/local/dist'])
  await rm(resolve(workspace, dir), { recursive: true, force: true });
await mkdir(`${root}/dist`, { recursive: true });
const js = await build({
  entryPoints: [`${root}/src/index.ts`, `${root}/src/providers.ts`],
  outdir: `${root}/dist`,
  bundle: true,
  format: 'esm',
  splitting: true,
  platform: 'browser',
  target: 'es2022',
  minify: true,
  plugins: [milkdownSlashPlugin()],
  legalComments: 'linked',
  chunkNames: 'chunks/[name]-[hash]',
  metafile: true,
});
const css = await build({
  entryPoints: [`${root}/src/style.css`],
  outfile: `${root}/dist/style.css`,
  bundle: true,
  minify: true,
  loader: { '.woff2': 'file', '.woff': 'file', '.ttf': 'file' },
  assetNames: 'fonts/[name]-[hash]',
  legalComments: 'linked',
  metafile: true,
});
await writeFile(`${root}/dist/style.css.d.ts`, 'export {};\n');
execFileSync(
  process.execPath,
  ['node_modules/typescript/bin/tsc', '--project', 'packages/editor/tsconfig.build.json'],
  { stdio: 'inherit' },
);
const sidebar = await build({
  entryPoints: ['packages/sidebar/src/index.ts'],
  outdir: 'packages/sidebar/dist',
  bundle: true,
  format: 'esm',
  target: 'es2022',
  external: ['@local/milkdown-notes'],
  minify: true,
  legalComments: 'linked',
  metafile: true,
});
await build({
  entryPoints: ['packages/sidebar/src/style.css'],
  outfile: 'packages/sidebar/dist/style.css',
  bundle: true,
  minify: true,
  loader: { '.woff2': 'file', '.woff': 'file', '.ttf': 'file' },
  assetNames: 'fonts/[name]-[hash]',
  legalComments: 'linked',
});
await writeFile('packages/sidebar/dist/style.css.d.ts', 'export {};\n');
execFileSync(
  process.execPath,
  ['node_modules/typescript/bin/tsc', '--project', 'packages/sidebar/tsconfig.build.json'],
  { stdio: 'inherit' },
);
await mkdir('apps/local/dist', { recursive: true });
const app = await build({
  entryPoints: ['apps/local/src/app.ts'],
  outfile: 'apps/local/dist/app.js',
  bundle: true,
  format: 'esm',
  target: 'es2022',
  external: ['@local/milkdown-sidebar'],
  sourcemap: true,
  metafile: true,
});
await build({
  entryPoints: ['apps/local/src/app.css'],
  outfile: 'apps/local/dist/app.css',
  bundle: true,
  loader: { '.woff2': 'file', '.ttf': 'file' },
  assetNames: 'fonts/[name]-[hash]',
});
await cp('apps/local/src/index.html', 'apps/local/dist/index.html');
await writeNotices([
  ...Object.keys(js.metafile.inputs),
  ...Object.keys(css.metafile.inputs),
  ...Object.keys(app.metafile.inputs),
  ...Object.keys(sidebar.metafile.inputs),
]);
await cp('licenses', 'packages/sidebar/dist/licenses', { recursive: true });
for (const name of ['OFL-CrimsonText.txt', 'OFL-NotoSerifSC.txt'])
  await cp('packages/sidebar/src/artifact/fonts/' + name, 'packages/sidebar/dist/licenses/' + name);
await build({
  entryPoints: ['examples/ai-test.ts'],
  outfile: 'apps/local/dist/ai-test.js',
  bundle: true,
  format: 'esm',
  target: 'es2022',
  minify: true,
  plugins: [milkdownSlashPlugin()],
  legalComments: 'linked',
});
await build({
  entryPoints: ['examples/sidebar-test.ts'],
  outfile: 'apps/local/dist/sidebar-test.js',
  bundle: true,
  format: 'esm',
  target: 'es2022',
  external: ['@local/milkdown-sidebar', '@local/milkdown-notes'],
});
await build({
  entryPoints: ['examples/live-ai-test.ts'],
  outfile: 'apps/local/dist/live-ai-test.js',
  bundle: true,
  format: 'esm',
  target: 'es2022',
  external: ['@local/milkdown-sidebar', '@local/milkdown-notes'],
});
console.log('Built editor, sidebar, local app and integration examples.');
