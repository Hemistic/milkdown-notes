import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({
  entryPoints: ['packages/sidebar/src/artifact/markdown.ts'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
});
const { countWords } = await import(
  'data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64')
);

test('statistics retain mixed-language counts and exclude Markdown code and links', () => {
  assert.deepEqual(countWords(''), { words: 0, chars: 0, lines: 0 });
  const markdown =
    '# 中文hello 世界\n\nOne **two**\n`ignored` [link](url) ![image](url)\n```js\nignored\n```\n';
  assert.deepEqual(countWords(markdown), {
    words: 7,
    chars: markdown.length,
    lines: 8,
  });
  assert.equal(countWords('hello中world\t文\n\n').words, 4);
  assert.equal(countWords('  \n\t').words, 0);
});
