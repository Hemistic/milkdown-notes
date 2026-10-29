import type { AIProvider } from '@local/milkdown-notes';

/** Connect to the local server or a host implementing its NDJSON stream contract. */
export function createHttpAIProvider(endpoint = '/api/ai'): AIProvider {
  return async function* (context, signal) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(context),
      signal,
    });
    if (!response.ok) throw Error((await response.json()).error);
    const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
    let pending = '';
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) throw Error('AI stream ended before completion');
        pending += value;
        let newline: number;
        while ((newline = pending.indexOf('\n')) !== -1) {
          const event = JSON.parse(pending.slice(0, newline));
          pending = pending.slice(newline + 1);
          if (event.error) throw Error(event.error);
          if (event.done) return;
          yield event.text;
        }
      }
    } finally {
      await reader.cancel();
      reader.releaseLock();
    }
  };
}
