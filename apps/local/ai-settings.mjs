import { readFile } from 'node:fs/promises';
import { atomicWrite } from './storage.mjs';
import { configuredAI } from './ai.mjs';

export function createAISettings(file, env = process.env) {
  let config = Object.fromEntries(
    ['AI_PROVIDER', 'AI_MODEL', 'AI_REASONING_EFFORT', 'AI_API_KEY', 'AI_BASE_URL'].map((key) => [
      key,
      env[key],
    ]),
  );
  const read = () => ({
    provider: config.AI_PROVIDER || 'openai',
    model: config.AI_MODEL || '',
    reasoningEffort: config.AI_REASONING_EFFORT || 'medium',
    keyConfigured: !!config.AI_API_KEY,
  });
  return {
    read,
    provider: () => configuredAI(config),
    async save({ model, reasoningEffort, apiKey = '' }) {
      if (typeof model !== 'string' || !model.trim() || /[\r\n]/.test(model))
        throw Error('请输入有效的模型名称');
      if (!['none', 'low', 'medium', 'high', 'xhigh', 'max'].includes(reasoningEffort))
        throw Error('请选择有效的思考程度');
      if (typeof apiKey !== 'string' || /[\r\n]/.test(apiKey)) throw Error('密钥不能包含换行');
      const next = {
        ...config,
        AI_MODEL: model.trim(),
        AI_REASONING_EFFORT: reasoningEffort,
        AI_API_KEY: apiKey.trim() || config.AI_API_KEY,
      };
      let content = await readFile(file, 'utf8').catch((error) => {
        if (error.code === 'ENOENT') return '';
        throw error;
      });
      for (const [key, value] of Object.entries(next)) {
        if (value === undefined) continue;
        const pattern = new RegExp('^' + key + '=.*$', 'm');
        const line = key + '=' + JSON.stringify(value);
        content = pattern.test(content)
          ? content.replace(pattern, () => line)
          : content.trimEnd() + '\n' + line + '\n';
      }
      await atomicWrite(file, content);
      config = next;
      return read();
    },
  };
}
