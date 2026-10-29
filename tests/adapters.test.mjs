import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { milkdownSlashPlugin } from '../scripts/milkdown-adapters.mjs';
test('compatibility adapter rejects changed upstream table source', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'milkdown-adapter-test-'));
  try {
    const file = path.join(root, 'index.js');
    await writeFile(file, 'export const changed = true;');
    const plugin = milkdownSlashPlugin();
    let callback;
    plugin.setup({
      onLoad(options, fn) {
        if (options.filter.test('/node_modules/@milkdown/components/lib/table-block/index.js'))
          callback = fn;
      },
    });
    assert.ok(callback);
    await assert.rejects(() => callback({ path: file }), /needs review/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test('AI lifecycle adapter rejects changed upstream source', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'milkdown-ai-adapter-test-'));
  try {
    const file = path.join(root, 'index.js');
    await writeFile(file, 'export const changed = true;');
    let callback;
    milkdownSlashPlugin().setup({
      onLoad(options, fn) {
        if (options.filter.test('/node_modules/@milkdown/crepe/lib/esm/feature/ai/index.js'))
          callback = fn;
      },
    });
    assert.ok(callback);
    await assert.rejects(() => callback({ path: file }), /AI disposal adapter needs review/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
