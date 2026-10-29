import type { SidebarPreferences, SidebarAISettingsAdapter } from './types.js';
import { setIcon } from './menu.js';

export function createSettings(
  root: HTMLElement,
  options: {
    preferences(): SidebarPreferences;
    change(value: SidebarPreferences): Promise<void>;
    ai?: SidebarAISettingsAdapter;
  },
) {
  const dialog = document.createElement('dialog');
  dialog.className = 'artifact-chrome settings-dialog';
  dialog.setAttribute('aria-label', '设置');
  dialog.innerHTML = `
    <header><div><h2>设置</h2><p>让侧栏适合你的工作习惯</p></div><button type="button" class="settings-close" aria-label="关闭设置"><span></span></button></header>
    <div class="settings-scroll">
      <form class="settings-preferences">
        <h3><span data-settings-icon="settings"></span>外观与编辑</h3>
        <label class="settings-field">主题<select name="theme"><option value="light">白天</option><option value="dark">黑夜</option></select></label>
        <label class="settings-field">编辑模式<select name="mode"><option value="normal">正常</option><option value="focus">专注</option><option value="typewriter">打字机</option></select></label>
        <label class="settings-field">编辑器语言<select name="locale"><option value="zh-CN">中文</option><option value="en">English</option></select></label>
        <label class="settings-toggle"><span>文档大纲<small>在侧栏中浏览标题</small></span><input type="checkbox" name="outline" role="switch"></label>
        <label class="settings-toggle"><span>拼写检查<small>使用浏览器的拼写检查</small></span><input type="checkbox" name="spellcheck" role="switch"></label>
        <label class="settings-toggle"><span>三击显示源码<small>连续三击查看当前块的 Markdown</small></span><input type="checkbox" name="source" role="switch"></label>
        <p class="settings-hint">编辑偏好自动保存，正文始终自动保存。</p>
      </form>
      <section class="settings-ai"><h3><span data-settings-icon="ai"></span>AI 改写</h3>
        <p class="settings-service"></p>
        <form class="settings-ai-form">
          <label class="settings-field">模型<input name="model" required maxlength="200" spellcheck="false" autocomplete="off" placeholder="gpt-6-luna"></label>
          <label class="settings-field">思考程度<select name="reasoningEffort"><option value="none">不思考 · none</option><option value="low">低 · low</option><option value="medium">中 · medium</option><option value="high">高 · high</option><option value="xhigh">更高 · xhigh</option><option value="max">最高 · max</option></select></label>
          <label class="settings-field">API 密钥<input name="apiKey" type="password" autocomplete="new-password" spellcheck="false" placeholder="留空保留已有密钥"></label>
          <p class="settings-hint settings-key-hint"></p>
          <button type="submit" class="settings-save">保存 AI 设置</button>
        </form>
      </section>
      <p class="settings-message" role="status" aria-live="polite"></p>
    </div>`;
  root.append(dialog);
  setIcon(dialog.querySelector('.settings-close span')!, 'close');
  for (const element of dialog.querySelectorAll<HTMLElement>('[data-settings-icon]'))
    setIcon(element, element.dataset.settingsIcon as 'settings' | 'ai');
  const form = dialog.querySelector<HTMLFormElement>('.settings-preferences')!;
  const aiForm = dialog.querySelector<HTMLFormElement>('.settings-ai-form')!;
  const message = dialog.querySelector<HTMLElement>('.settings-message')!;
  const field = <T extends HTMLInputElement | HTMLSelectElement>(name: string) =>
    form.elements.namedItem(name) as T;
  const aiField = (name: string) => aiForm.elements.namedItem(name) as HTMLInputElement;
  const save = aiForm.querySelector<HTMLButtonElement>('button')!;
  function sync() {
    const value = options.preferences();
    for (const name of ['theme', 'mode', 'locale'] as const) field(name).value = value[name];
    for (const name of ['outline', 'spellcheck', 'source'] as const)
      field<HTMLInputElement>(name).checked = value[name];
  }
  function tell(text: string, failed = false) {
    message.textContent = text;
    message.dataset.error = String(failed);
  }
  form.onchange = async () => {
    try {
      await options.change({
        theme: field('theme').value as SidebarPreferences['theme'],
        mode: field('mode').value as SidebarPreferences['mode'],
        locale: field('locale').value as SidebarPreferences['locale'],
        outline: field<HTMLInputElement>('outline').checked,
        spellcheck: field<HTMLInputElement>('spellcheck').checked,
        source: field<HTMLInputElement>('source').checked,
      });
      tell('编辑偏好已保存');
    } catch (error) {
      tell(String(error), true);
    }
    sync();
  };
  function showAI(value: Awaited<ReturnType<SidebarAISettingsAdapter['load']>>) {
    aiField('model').value = value.model;
    aiField('reasoningEffort').value = value.reasoningEffort || 'medium';
    aiField('apiKey').value = '';
    dialog.querySelector('.settings-service')!.textContent =
      value.provider === 'openai' ? 'OpenAI Platform' : value.provider;
    dialog.querySelector('.settings-key-hint')!.textContent = value.keyConfigured
      ? '密钥已配置。留空保持不变，仅保存在本机服务端。'
      : '尚未配置密钥。仅保存在本机服务端。';
  }
  aiForm.onsubmit = async (event) => {
    event.preventDefault();
    save.disabled = true;
    tell('正在保存 AI 设置…');
    try {
      showAI(
        await options.ai!.save({
          model: aiField('model').value.trim(),
          reasoningEffort: aiField('reasoningEffort').value,
          apiKey: aiField('apiKey').value.trim(),
        }),
      );
      tell('AI 设置已保存，下次改写生效');
    } catch (error) {
      tell(String(error), true);
    } finally {
      save.disabled = false;
    }
  };
  dialog.querySelector<HTMLButtonElement>('.settings-close')!.onclick = () => dialog.close();
  dialog.addEventListener('close', () => {
    aiField('apiKey').value = '';
  });
  function position() {
    const bounds = root.getBoundingClientRect();
    const width = Math.min(380, bounds.width - 16, innerWidth - 24);
    const bottom = Math.max(38, innerHeight - bounds.bottom + 38);
    dialog.style.width = width + 'px';
    dialog.style.left =
      Math.max(12, Math.min(bounds.right - width - 8, innerWidth - width - 12)) + 'px';
    dialog.style.bottom = bottom + 'px';
    dialog.style.setProperty('--settings-height', Math.max(160, innerHeight - bottom - 12) + 'px');
  }
  return {
    updateBounds() {
      if (dialog.open) position();
    },
    async open() {
      sync();
      tell('');
      position();
      dialog.showModal();
      aiForm.hidden = true;
      if (!options.ai) {
        dialog.querySelector('.settings-service')!.textContent = 'AI 服务由接入的应用管理。';
        return;
      }
      save.disabled = true;
      try {
        showAI(await options.ai.load());
        aiForm.hidden = false;
      } catch (error) {
        tell('读取 AI 设置失败：' + String(error), true);
      } finally {
        save.disabled = false;
      }
    },
    destroy() {
      dialog.close();
      dialog.remove();
    },
  };
}
