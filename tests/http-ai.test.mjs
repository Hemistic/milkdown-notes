import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { build } from 'esbuild';
import { configuredAI, streamAI } from '../apps/local/ai.mjs';

const bundle = await build({
  entryPoints: ['packages/sidebar/src/ai.ts'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
});
const { createHttpAIProvider } = await import(
  'data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64')
);
const context = { document: '原文', selection: '原文', instruction: '改写' };
async function serve(t, handler) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(
    () =>
      new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      }),
  );
  return 'http://127.0.0.1:' + server.address().port;
}
const collect = async (stream) => {
  let output = '';
  for await (const text of stream) output += text;
  return output;
};

test('AI proxy preserves real streaming chunks and supports retry after a mid-stream error', async (t) => {
  let attempt = 0;
  const endpoint = await serve(t, (_req, res) =>
    streamAI(
      res,
      async function* () {
        yield '中文';
        await delay(15);
        if (++attempt === 1) throw Error('upstream interrupted');
        yield ' **正文**';
      },
      context,
    ),
  );
  const provider = createHttpAIProvider(endpoint);
  await assert.rejects(
    () => collect(provider(context, new AbortController().signal)),
    /upstream interrupted/,
  );
  assert.equal(await collect(provider(context, new AbortController().signal)), '中文 **正文**');
});

test('AI cancellation closes the HTTP stream and aborts the upstream provider', async (t) => {
  let aborted = false;
  const endpoint = await serve(t, (_req, res) =>
    streamAI(
      res,
      async function* (_context, signal) {
        try {
          yield 'first';
          await delay(10000, null, { signal });
        } finally {
          aborted = signal.aborted;
        }
      },
      context,
    ),
  );
  const controller = new AbortController();
  const stream = createHttpAIProvider(endpoint)(context, controller.signal);
  assert.equal((await stream.next()).value, 'first');
  controller.abort();
  await assert.rejects(() => stream.next(), { name: 'AbortError' });
  for (let i = 0; i < 50 && !aborted; i++) await delay(10);
  assert.equal(aborted, true);
});

test('AI client refuses a truncated response rather than accepting partial output as complete', async (t) => {
  const endpoint = await serve(t, (_req, res) => res.end('{"text":"partial"}\n'));
  await assert.rejects(
    () => collect(createHttpAIProvider(endpoint)(context, new AbortController().signal)),
    /before completion/,
  );
});

test('OpenAI configuration sends the chosen model and reasoning effort without exposing the key', async (t) => {
  let payload;
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    payload = JSON.parse(init.body);
    assert.equal(init.headers.Authorization, 'Bearer fixture-secret');
    return new Response('data: [DONE]\n\n');
  });
  const ai = configuredAI({
    AI_PROVIDER: 'openai',
    AI_MODEL: 'gpt-6-luna',
    AI_REASONING_EFFORT: 'medium',
    AI_API_KEY: 'fixture-secret',
  });
  await collect(ai.stream(context, new AbortController().signal));
  assert.equal(payload.model, 'gpt-6-luna');
  assert.equal(payload.reasoning_effort, 'medium');
  assert.equal(JSON.stringify(ai).includes('fixture-secret'), false);
});
