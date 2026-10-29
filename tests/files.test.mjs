import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({
  entryPoints: ['packages/sidebar/src/files.ts'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
});
const { createHttpFiles } = await import(
  'data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64')
);

test('file adapter implements list, read, write and rename without changing Markdown', async () => {
  const calls = [];
  const files = createHttpFiles('https://host.example/api/', async (url, init = {}) => {
    calls.push({ url, ...init });
    return Response.json(
      init.method
        ? { saved: true }
        : url.endsWith('/notes')
          ? [{ id: 'folder/note', title: 'Title' }]
          : { id: 'folder/note', markdown: '# Original\n' },
    );
  });
  assert.equal((await files.list())[0].title, 'Title');
  assert.deepEqual(await files.read('folder/note'), {
    id: 'folder/note',
    markdown: '# Original\n',
  });
  await files.write('folder/note', '# Exact\n\n$e=mc^2$\n');
  await files.rename('folder/note', '新标题');
  assert.equal(calls[1].url, 'https://host.example/api/notes/folder%2Fnote');
  assert.equal(calls[2].body, '# Exact\n\n$e=mc^2$\n');
  assert.deepEqual(JSON.parse(calls[3].body), { title: '新标题' });
});

test('file adapter propagates server failures so callers can preserve dirty content and retry', async () => {
  const files = createHttpFiles('/api', async () => new Response('disk full', { status: 507 }));
  await assert.rejects(() => files.write('note', 'do not lose'), /507.*disk full/);
});

test('image adapter resolves relative asset URLs against the storage host', async (t) => {
  globalThis.location = { href: 'https://editor.example/sidebar/' };
  t.after(() => {
    delete globalThis.location;
  });
  const file = new File(['image'], 'example.png', { type: 'image/png' });
  let request;
  const files = createHttpFiles('https://storage.example/api', async (url, init) => {
    request = { url, ...init };
    return Response.json({ url: '/assets/image.png' });
  });
  assert.equal(await files.uploadImage(file), 'https://storage.example/assets/image.png');
  assert.equal(request.body, file);
  assert.equal(request.headers['Content-Type'], 'image/png');
  assert.equal(files.resolveAsset('/assets/image.png'), 'https://storage.example/assets/image.png');
});
