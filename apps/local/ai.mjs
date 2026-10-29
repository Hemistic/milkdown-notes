import { once } from 'node:events';
import { createOpenAIProvider } from '@milkdown/crepe/llm-providers/openai';
import { createAnthropicProvider } from '@milkdown/crepe/llm-providers/anthropic';

export function configuredAI(env = process.env) {
  if (!env.AI_MODEL) return undefined;
  const provider = env.AI_PROVIDER ?? 'openai';
  const factory = { openai: createOpenAIProvider, anthropic: createAnthropicProvider }[provider];
  if (!factory) throw Error('AI_PROVIDER must be openai or anthropic');
  return {
    provider,
    model: env.AI_MODEL,
    reasoningEffort: env.AI_REASONING_EFFORT,
    stream: factory({
      model: env.AI_MODEL,
      apiKey: env.AI_API_KEY,
      baseURL: env.AI_BASE_URL,
      ...(provider === 'openai' && env.AI_REASONING_EFFORT
        ? { body: { reasoning_effort: env.AI_REASONING_EFFORT } }
        : {}),
    }),
  };
}

/** Closing the browser response cancels the upstream model request. */
export async function streamAI(res, provider, context) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  res.once('close', cancel);
  const send = async (event) => {
    if (!res.write(JSON.stringify(event) + '\n'))
      await once(res, 'drain', { signal: controller.signal });
  };
  res.writeHead(200, {
    'Content-Type': 'application/x-ndjson; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.flushHeaders();
  try {
    for await (const text of provider(context, controller.signal)) await send({ text });
    await send({ done: true });
  } catch (error) {
    if (!controller.signal.aborted)
      await send({
        error: error.message + (error.cause?.code ? ' (' + error.cause.code + ')' : ''),
      });
  } finally {
    res.off('close', cancel);
    res.end();
  }
}
