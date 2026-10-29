import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { createAISettings } from '../apps/local/ai-settings.mjs';

test('AI settings preserve existing credentials and unrelated config across restarts', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'milkdown-settings-'));
  try {
    const file = path.join(directory, '.env.local');
    const initial =
      'AI_PROVIDER=openai\nAI_MODEL=gpt-6-luna\nAI_API_KEY=fixture-secret\nPORT=43150\n';
    await writeFile(file, initial);
    const settings = createAISettings(file, parseEnv(initial));
    await settings.save({ model: 'gpt-6-luna', reasoningEffort: 'high', apiKey: '' });
    const persisted = parseEnv(await readFile(file, 'utf8'));
    assert.equal(persisted.AI_API_KEY, 'fixture-secret');
    assert.equal(persisted.PORT, '43150');
    const restarted = createAISettings(file, persisted);
    assert.equal(restarted.read().reasoningEffort, 'high');
    assert.equal(JSON.stringify(restarted.read()).includes('fixture-secret'), false);
    await restarted.save({ model: 'gpt-6-luna', reasoningEffort: 'medium', apiKey: 'new-fixture' });
    assert.equal(parseEnv(await readFile(file, 'utf8')).AI_API_KEY, 'new-fixture');
    const valid = await readFile(file, 'utf8');
    await assert.rejects(
      () => restarted.save({ model: 'x\nPORT=1', reasoningEffort: 'medium' }),
      /模型/,
    );
    assert.equal(await readFile(file, 'utf8'), valid);
  } finally {
    assert.equal(path.dirname(directory), path.resolve(tmpdir()));
    await rm(directory, { recursive: true, force: true });
  }
});
