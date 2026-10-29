import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let child, directory, origin;
before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'milkdown-http-'));
  const probe = createServer();
  await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  origin = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['apps/local/server.mjs'], {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    env: { ...process.env, PORT: String(port), NOTES_DATA_DIR: directory },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('HTTP fixture did not start')), 5000);
    child.once('error', reject);
    child.stdout.on('data', (data) => {
      if (data.toString().includes('Milkdown Notes:')) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
});
after(async () => {
  if (child && child.exitCode === null) {
    const stopped = new Promise((resolve) => child.once('exit', resolve));
    child.kill();
    await stopped;
  }
  if (directory) {
    assert.equal(path.dirname(directory), path.resolve(tmpdir()));
    await rm(directory, { recursive: true, force: true });
  }
});

const request = (route, init = {}) =>
  fetch(origin + route, { ...init, headers: { Origin: origin, ...init.headers } });

test('HTTP note creation, overwrite, rename and reads preserve the stable ID', async () => {
  const markdown = '# 网络测试\n\n[[other]]\n\n| A | B |\n| - | - |\n| 中 | 文 |\n';
  assert.equal(
    (await request('/api/notes/http-note', { method: 'PUT', body: markdown })).status,
    200,
  );
  assert.deepEqual(await (await request('/api/notes/http-note')).json(), {
    id: 'http-note',
    markdown,
  });
  assert.equal(
    (
      await request('/api/notes/http-note', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '新标题' }),
      })
    ).status,
    200,
  );
  await request('/api/notes/http-note', { method: 'PUT', body: markdown + '\n更新' });
  assert.deepEqual(await (await request('/api/notes')).json(), [
    { id: 'http-note', title: '新标题' },
  ]);
  assert.equal(
    (await (await request('/api/notes/http-note')).json()).markdown,
    markdown + '\n更新',
  );
});

test('HTTP image upload returns a readable asset with its original bytes', async () => {
  const bytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2xoAAAAASUVORK5CYII=',
    'base64',
  );
  const upload = await request('/api/images', {
    method: 'POST',
    headers: { 'Content-Type': 'image/png' },
    body: bytes,
  });
  assert.equal(upload.status, 200);
  const { url } = await upload.json();
  const asset = await request(url);
  assert.equal(asset.headers.get('Content-Type'), 'image/png');
  assert.deepEqual(Buffer.from(await asset.arrayBuffer()), bytes);
  const head = await request(url, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
});

test('HTTP failures are explicit and a bad request does not stop later saves', async () => {
  assert.equal((await request('/api/notes/missing')).status, 404);
  assert.equal(
    (await request('/api/notes/http-note', { method: 'PATCH', body: '{invalid' })).status,
    400,
  );
  assert.equal(
    (
      await request('/api/images', {
        method: 'POST',
        headers: { 'Content-Type': 'text/html' },
        body: '<p>not an image</p>',
      })
    ).status,
    415,
  );
  assert.equal((await request('/api/notes', { method: 'DELETE' })).status, 405);
  assert.equal(
    (await request('/api/notes/recovered', { method: 'PUT', body: '# 仍可保存' })).status,
    200,
  );
});

test('HTTP boundary rejects foreign writes and invalid file IDs', async () => {
  assert.equal(
    (
      await request('/api/notes/foreign', {
        method: 'PUT',
        headers: { Origin: 'https://other.example' },
        body: 'unexpected',
      })
    ).status,
    403,
  );
  assert.equal(
    (await request('/api/notes/..%5Coutside', { method: 'PUT', body: 'unexpected' })).status,
    400,
  );
  assert.equal((await request('/api/notes/foreign')).status, 404);
});
