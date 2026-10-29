import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStorage } from './storage.mjs';
import { streamAI } from './ai.mjs';
import { createAISettings } from './ai-settings.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const envFile = process.env.NOTES_ENV_FILE ?? path.join(root, '.env.local');
if (existsSync(envFile)) loadEnvFile(envFile);
const aiSettings = createAISettings(envFile);
const port = Number(process.env.PORT ?? 43150);
const storage = createStorage(process.env.NOTES_DATA_DIR ?? path.join(root, '.data'));
await storage.init();
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.md': 'text/markdown; charset=utf-8',
};
const origin = `http://127.0.0.1:${port}`;
async function body(req) {
  let size = 0,
    parts = [];
  for await (const p of req) {
    size += p.length;
    if (size > 12 * 1024 * 1024) throw Error('Request too large');
    parts.push(p);
  }
  return Buffer.concat(parts);
}
http
  .createServer(async (req, res) => {
    const reply = (status, data, type = 'application/json') => {
      res.writeHead(status, {
        'Content-Type': type,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store',
      });
      res.end(type === 'application/json' ? JSON.stringify(data) : data);
    };
    try {
      if (req.headers.host !== `127.0.0.1:${port}` && req.headers.host !== `localhost:${port}`)
        return reply(403, { error: 'Local host required' });
      const url = new URL(req.url, origin),
        route = decodeURIComponent(url.pathname);
      if (
        !['GET', 'HEAD'].includes(req.method) &&
        req.headers.origin !== origin &&
        req.headers.origin !== `http://localhost:${port}`
      )
        return reply(403, { error: 'Same-origin requests only' });
      if (route === '/api/notes' && req.method === 'GET') return reply(200, await storage.list());
      if (route === '/api/ai/settings' && req.method === 'GET')
        return reply(200, aiSettings.read());
      if (route === '/api/ai/settings' && req.method === 'PATCH') {
        const value = await aiSettings.save(JSON.parse((await body(req)).toString('utf8')));
        return reply(200, value);
      }
      if (route === '/api/ai' && req.method === 'GET') {
        const ai = aiSettings.provider();
        return reply(200, {
          configured: !!ai,
          provider: ai?.provider,
          model: ai?.model,
          reasoningEffort: ai?.reasoningEffort,
        });
      }
      if (route === '/api/ai' && req.method === 'POST') {
        const ai = aiSettings.provider();
        if (!ai) return reply(503, { error: '请先在底栏设置中配置 AI 模型' });
        const context = JSON.parse((await body(req)).toString('utf8'));
        if (
          !['document', 'selection', 'instruction'].every((key) => typeof context[key] === 'string')
        )
          return reply(400, { error: 'AI context requires document, selection and instruction' });
        await streamAI(res, ai.stream, context);
        return;
      }
      if (route.startsWith('/api/notes/')) {
        const id = route.slice(11);
        if (req.method === 'GET') return reply(200, { id, markdown: await storage.read(id) });
        if (req.method === 'PUT') {
          const markdown = (await body(req)).toString('utf8');
          await storage.write(id, markdown);
          return reply(200, { id, saved: true });
        }
        if (req.method === 'PATCH') {
          const { title } = JSON.parse((await body(req)).toString('utf8'));
          await storage.rename(id, title);
          return reply(200, { id, renamed: true });
        }
      }
      if (route === '/api/images' && req.method === 'POST') {
        const ext = {
          'image/png': 'png',
          'image/jpeg': 'jpg',
          'image/webp': 'webp',
          'image/gif': 'gif',
        }[req.headers['content-type']];
        if (!ext) return reply(415, { error: 'Use PNG, JPEG, WebP or GIF' });
        return reply(200, { url: await storage.image(await body(req), ext) });
      }
      if (req.method !== 'GET' && req.method !== 'HEAD')
        return reply(405, { error: 'Method not allowed' });
      let base, relative;
      if (route.startsWith('/editor/')) {
        base = path.join(root, 'packages/editor/dist');
        relative = route.slice(8);
      } else if (route.startsWith('/sidebar/')) {
        base = path.join(root, 'packages/sidebar/dist');
        relative = route.slice(9);
      } else if (route.startsWith('/assets/')) {
        base = storage.assets;
        relative = route.slice(8);
      } else if (route.startsWith('/example/')) {
        base = path.join(root, 'examples/vanilla');
        relative = route.slice(9) || 'index.html';
      } else {
        base = path.join(root, 'apps/local/dist');
        relative = route === '/' ? 'index.html' : route.slice(1);
      }
      const target = path.resolve(base, relative);
      if (!target.startsWith(base + path.sep)) return reply(403, { error: 'Invalid path' });
      const data = await readFile(target);
      return reply(
        200,
        req.method === 'HEAD' ? '' : data,
        types[path.extname(target)] ?? 'application/octet-stream',
      );
    } catch (error) {
      reply(error.code === 'ENOENT' ? 404 : 400, { error: error.message });
    }
  })
  .listen(port, '127.0.0.1', () =>
    console.log(
      `Milkdown Notes: ${origin}\nIntegration example: ${origin}/example/\nLocal data: ${process.env.NOTES_DATA_DIR ?? path.join(root, '.data')}`,
    ),
  );
