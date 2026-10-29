import {
  mountSidebar,
  type NoteFiles,
  type NoteSidebar,
  type NoteExport,
} from '@local/milkdown-sidebar';
import type { AIProvider, AIPromptContext } from '@local/milkdown-notes';

const $ = (id: string) => document.getElementById(id)!;
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
function assert(value: unknown, message: string): asserts value {
  if (!value) throw Error(message);
}
async function until(check: () => boolean) {
  const deadline = Date.now() + 6000;
  while (!check()) {
    if (Date.now() > deadline) throw Error('等待状态超时');
    await delay(20);
  }
}

function memoryFiles() {
  const notes = new Map([
    ['one', { title: '第一篇', markdown: '# 第一篇\n\n等待 AI 改写的原文。\n' }],
    ['two', { title: '第二篇', markdown: '# 第二篇\n\n独立的另一篇笔记。\n' }],
  ]);
  const state = {
    failWrites: false,
    writeDelay: 0,
    readDelay: 0,
    writes: [] as { id: string; markdown: string }[],
  };
  const files: NoteFiles = {
    async list() {
      return [...notes].map(([id, note]) => ({ id, title: note.title }));
    },
    async read(id) {
      await delay(state.readDelay);
      const note = notes.get(id);
      if (!note) throw Error('Missing note');
      return { id, markdown: note.markdown };
    },
    async write(id, markdown) {
      await delay(state.writeDelay);
      if (state.failWrites) throw Error('Fixture disk full');
      state.writes.push({ id, markdown });
      notes.set(id, {
        title: notes.get(id)?.title ?? /^# (.+)$/m.exec(markdown)?.[1] ?? id,
        markdown,
      });
    },
    async rename(id, title) {
      notes.get(id)!.title = title;
    },
    async uploadImage(file) {
      assert(file.type === 'image/png', '图片类型丢失');
      return '/example/test-image.png';
    },
    resolveAsset: (source) => source,
  };
  return { files, notes, state };
}

let aiMode: 'normal' | 'slow' | 'error' = 'normal';
let received: AIPromptContext | undefined;
let aiSignal: AbortSignal | undefined;
const ai: AIProvider = async function* (context, signal) {
  received = context;
  aiSignal = signal;
  const result = '# AI 改写\n\n这是通过宿主 AI 接口返回的 Markdown。\n';
  for (let i = 0; i < result.length; i += 8) {
    await delay(aiMode === 'slow' ? 80 : 8);
    if (signal.aborted) return;
    if (aiMode === 'error') throw Error('Fixture model unavailable');
    yield result.slice(i, i + 8);
  }
};
let first: NoteSidebar;
let second: NoteSidebar;
let store = memoryFiles();
const exports: NoteExport[] = [];
const aiErrors: Error[] = [];
const unhandled: string[] = [];
let settingsValue = {
  provider: 'openai',
  model: 'gpt-6-luna',
  reasoningEffort: 'medium',
  keyConfigured: true,
};
let settingsFail = false;
window.addEventListener('unhandledrejection', (event) => unhandled.push(String(event.reason)));
async function mountDemo() {
  first = await mountSidebar($('left'), {
    files: store.files,
    initialNoteId: 'one',
    aiProvider: ai,
    aiSettings: {
      async load() {
        return settingsValue;
      },
      async save(value) {
        if (settingsFail) throw Error('设置保存失败测试');
        settingsValue = {
          ...settingsValue,
          model: value.model,
          reasoningEffort: value.reasoningEffort,
        };
        return settingsValue;
      },
    },
    onAIError: (error) => aiErrors.push(error),
    onExport: (file) => {
      exports.push(file);
    },
  });
  second = await mountSidebar($('right'), {
    files: memoryFiles().files,
    preferences: { theme: 'dark' },
  });
  $('status').textContent = '侧栏已挂载。选中文字可调用 AI；文件保存在本页内存中。';
}

$('suite').onclick = () => void suite();
async function suite() {
  const button = $('suite') as HTMLButtonElement;
  button.disabled = true;
  $('results').replaceChildren();
  let passed = 0,
    failed = 0;
  async function test(name: string, action: () => Promise<void>) {
    const li = document.createElement('li');
    li.textContent = name + '…';
    $('results').append(li);
    try {
      await action();
      li.textContent = '通过 · ' + name;
      li.dataset.result = 'pass';
      passed++;
    } catch (error) {
      li.textContent = '失败 · ' + name + '：' + String(error);
      li.dataset.result = 'fail';
      failed++;
    }
    $('status').textContent = `${passed} 通过，${failed} 失败`;
  }
  try {
    await test('多实例主题、唯一 ID 和宿主样式隔离', async () => {
      const other = second.editor.getMarkdown();
      first.setTheme('dark');
      await delay(20);
      assert(
        $('left').dataset.theme === 'dark' && $('right').dataset.theme === 'dark',
        '主题未应用',
      );
      first.setTheme('light');
      assert($('right').dataset.theme === 'dark', '主题串到另一个实例');
      assert(second.editor.getMarkdown() === other && !second.editor.ai, '未配置实例受到 AI 影响');
      const ids = [...document.querySelectorAll('.mn-sidebar [id]')].map((el) => el.id);
      assert(new Set(ids).size === ids.length, 'DOM ID 重复');
      assert(getComputedStyle($('host-button')).fontFamily === 'monospace', '宿主样式被覆盖');
    });
    await test('240/300/390/650/900px 容器适配，底栏 30px，全部功能可达', async () => {
      for (const width of [240, 300, 390, 650, 900]) {
        $('primary').style.width = width + 'px';
        await document.fonts.ready;
        await until(() => $('left').dataset.narrow === String($('left').clientWidth <= 330));
        await until(() => $('left').dataset.compact === String($('left').clientWidth <= 650));
        await delay(40);
        const host = $('left'),
          footer = host.querySelector('.statusbar')!,
          strip = host.querySelector<HTMLElement>('.status-actions')!;
        assert(Math.abs(footer.getBoundingClientRect().height - 30) < 1, '底栏高度变形：' + width);
        assert(
          host.scrollWidth <= host.clientWidth + 1,
          '侧栏水平溢出：' +
            width +
            ' actual=' +
            host.clientWidth +
            '/' +
            host.scrollWidth +
            ' narrow=' +
            host.dataset.narrow,
        );
        assert(strip.querySelectorAll('button').length === 8, '底栏按钮缺失');
        host.querySelector<HTMLButtonElement>('[data-id="menu-toggle"]')!.click();
        const panel = host.querySelector<HTMLElement>('[data-id="app-menu"]')!;
        assert(
          panel.getBoundingClientRect().right <= host.getBoundingClientRect().right + 1,
          '菜单超出容器',
        );
        host.querySelector<HTMLButtonElement>('[data-id="menu-toggle"]')!.click();
      }
      $('primary').style.width = '390px';
    });
    await test('setMarkdown 后立即 flush 保存，慢写期间的最新修改不丢失', async () => {
      await first.open('one');
      store.state.writeDelay = 80;
      first.editor.setMarkdown('# 第一次修改\n');
      const saving = first.flush();
      await delay(20);
      first.editor.setMarkdown('# 最后一次修改\n');
      await saving;
      store.state.writeDelay = 0;
      assert(
        store.notes.get('one')!.markdown === first.editor.getMarkdown() && !first.dirty,
        '保存未包含最新修改',
      );
    });
    await test('切换读取期间继续输入，以及连续导航有序完成', async () => {
      store.state.readDelay = 90;
      const opening = first.open('two');
      await delay(25);
      first.editor.setMarkdown('# 读取期间的修改\n');
      await opening;
      assert(store.notes.get('one')!.markdown.includes('读取期间'), '切换时丢失旧笔记修改');
      await Promise.all([first.open('one'), first.open('two')]);
      assert(first.documentId === 'two', '连续导航顺序错误');
      store.state.readDelay = 0;
    });
    await test('保存失败阻止切换/卸载，正文保留且可以重试', async () => {
      first.editor.setMarkdown('# 不可丢失的内容\n');
      store.state.failWrites = true;
      let errors = 0;
      try {
        await first.open('one');
      } catch {
        errors++;
      }
      try {
        await first.destroy();
      } catch {
        errors++;
      }
      assert(
        errors === 2 &&
          first.dirty &&
          first.documentId === 'two' &&
          $('left').querySelector('.ProseMirror'),
        '保存失败仍卸载',
      );
      store.state.failWrites = false;
      await first.flush();
      assert(!first.dirty && store.notes.get('two')!.markdown.includes('不可丢失'), '不能重试保存');
    });
    await test('创建、导入、重命名、Markdown 导出复用文件接口', async () => {
      const id = await first.importFile(
        new File(['# 导入的内容\n\n[[one]]\n'], '导入.markdown', { type: 'text/markdown' }),
      );
      await first.rename('宿主重命名');
      const output = await first.exportDocument('markdown');
      assert(
        first.documentId === id && store.notes.get(id)!.title === '宿主重命名',
        '导入或重命名失败',
      );
      assert(
        output.name === '宿主重命名.md' &&
          output.content.includes('[[one]]') &&
          exports.at(-1) === output,
        '导出未交给宿主',
      );
    });
    await test('AI 全文改写：上下文、未确认不保存、接受后保存和撤销', async () => {
      await first.open('one');
      const before = first.editor.getMarkdown(),
        writes = store.state.writes.length;
      assert(first.editor.ai!.run('精简', 'document'), 'AI 未启动');
      await until(() => first.editor.ai!.getState().status === 'review');
      assert(
        received?.document === before &&
          received.instruction === '精简' &&
          received.selection.includes('读取期间'),
        '上下文错误',
      );
      assert(
        store.state.writes.length === writes && first.editor.getMarkdown() === before,
        '草稿提前保存',
      );
      assert(!first.editor.ai!.run('重复请求'), '允许覆盖未确认 diff');
      first.editor.ai!.accept();
      await first.flush();
      assert(store.notes.get('one')!.markdown.includes('AI 改写'), '接受后未保存');
      assert(first.editor.undo(), '不可撤销');
      await first.flush();
      assert(store.notes.get('one')!.markdown === before, '撤销没有持久化');
    });
    await test('AI 放弃、取消、错误回调保持原文', async () => {
      const before = first.editor.getMarkdown();
      first.editor.ai!.run('改写', 'document');
      await until(() => first.editor.ai!.getState().status === 'review');
      first.editor.ai!.reject();
      aiMode = 'slow';
      first.editor.ai!.run('取消测试', 'document');
      await until(() => first.editor.ai!.getState().status === 'streaming');
      first.editor.ai!.abort();
      assert(aiSignal?.aborted, 'AbortSignal 未传递');
      await until(() => first.editor.ai!.getState().status === 'idle');
      aiMode = 'error';
      first.editor.ai!.run('错误测试', 'document');
      await until(() => aiErrors.length > 0);
      assert(
        first.editor.getMarkdown() === before && first.editor.ai!.getState().status === 'idle',
        '错误改变了正文',
      );
      aiMode = 'normal';
    });
    await test('HTML/PDF 导出携带主题、样式和字体，PDF 交给宿主转换', async () => {
      first.setTheme('dark');
      const html = await first.exportDocument('html');
      assert(
        html.content.includes('data-theme="dark"') &&
          html.content.includes('data:font/') &&
          !html.content.includes('<script'),
        'HTML 资源未嵌入',
      );
      const pdf = await first.exportDocument('pdf');
      assert(
        pdf.name.endsWith('.pdf') &&
          pdf.mimeType.startsWith('text/html') &&
          pdf.content.startsWith('<!doctype html>'),
        'PDF 协议错误',
      );
      first.setTheme('light');
    });
    await test('底栏点击：大纲、三种模式、拼写、源码与阅读切换', async () => {
      const host = $('left');
      const button = (selector: string) => host.querySelector<HTMLButtonElement>(selector)!;
      button('[data-testid="outline-toggle"]').click();
      assert(!host.querySelector<HTMLElement>('[data-id="outline"]')!.hidden, '大纲未打开');
      button('[aria-label="专注模式"]').click();
      await until(
        () =>
          host.querySelector<HTMLElement>('[data-id="document-layout"]')!.dataset.mode === 'focus',
      );
      assert(host.querySelector<HTMLElement>('[data-id="outline"]')!.hidden, '专注模式未收起大纲');
      button('[aria-label="打字机模式"]').click();
      await until(
        () =>
          host.querySelector<HTMLElement>('[data-id="document-layout"]')!.dataset.mode ===
          'typewriter',
      );
      button('[aria-label="正常模式"]').click();
      button('.spellcheck-toggle').click();
      assert(host.querySelector<HTMLElement>('.ProseMirror')!.spellcheck, '拼写开关未生效');
      button('[data-testid="source-reveal-toggle"]').click();
      host
        .querySelector('.ProseMirror h1')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 3 }));
      assert(host.querySelector('.mn-block-source'), '源码开关未生效');
      host
        .querySelector('.mn-block-source')!
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      button('[data-id="preview"]').click();
      await until(
        () => host.querySelector('.ProseMirror')?.getAttribute('contenteditable') === 'false',
      );
      assert(!first.editor.ai, '阅读模式仍暴露 AI');
      button('[data-id="preview"]').click();
      await until(
        () =>
          !!first.editor?.ai &&
          host.querySelector('.ProseMirror')?.getAttribute('contenteditable') === 'true',
      );
      assert(host.querySelector<HTMLElement>('.ProseMirror')!.spellcheck, '重挂丢失拼写偏好');
    });
    await test('长文统计跟随正文更新，主题和保存状态不重复读取正文', async () => {
      const editor = first.editor;
      const original = editor.getMarkdown();
      const read = editor.getMarkdown;
      let reads = 0;
      editor.getMarkdown = () => {
        reads++;
        return read();
      };
      try {
        editor.setMarkdown('# 长文\n\n' + '中文 English paragraph。\n\n'.repeat(200));
        await first.flush();
        const markdown = read();
        await until(() =>
          $('left')
            .querySelector('.status-stats')!
            .getAttribute('aria-label')!
            .includes(`${markdown.length} 字符`),
        );
        reads = 0;
        for (let i = 0; i < 10; i++) first.setTheme(i % 2 ? 'light' : 'dark');
        await delay(40);
        assert(reads === 0, '主题切换重新读取了整篇正文：' + reads);
        editor.setMarkdown('# 统计更新\n');
        await delay(30);
        reads = 0;
        await first.flush();
        assert(reads === 1, '保存状态重复读取正文：' + reads);
      } finally {
        editor.getMarkdown = read;
        editor.setMarkdown(original);
        await first.flush();
      }
    });
    await test('普通模式不测量焦点布局，专注/打字机切换后仍正确定位', async () => {
      const host = $('left');
      const pane = host.querySelector<HTMLElement>('[data-id="editor-pane"]')!;
      const editor = first.editor;
      const original = editor.getMarkdown();
      const measure = pane.getBoundingClientRect.bind(pane);
      let measurements = 0;
      pane.getBoundingClientRect = () => {
        measurements++;
        return measure();
      };
      const mode = (label: string) =>
        host.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!.click();
      try {
        mode('正常模式');
        editor.setMarkdown('# 模式测试\n\n' + '用于验证光标滚动的段落。\n\n'.repeat(60));
        await first.flush();
        await delay(80);
        measurements = 0;
        for (let i = 0; i < 5; i++) {
          document.dispatchEvent(new Event('selectionchange'));
          await delay(20);
        }
        assert(measurements === 0, '普通模式仍在测量焦点布局');
        const paragraph = host.querySelector('.ProseMirror p:last-child')!;
        const selection = getSelection()!;
        selection.collapse(paragraph.firstChild, 2);
        mode('专注模式');
        await until(() =>
          [...host.querySelectorAll<HTMLElement>('.focus-dimmer')].some((el) => !el.hidden),
        );
        assert(measurements > 0, '专注模式未测量当前段落');
        mode('打字机模式');
        await until(() => pane.scrollTop > 0);
        mode('正常模式');
        assert(
          [...host.querySelectorAll<HTMLElement>('.focus-dimmer')].every((el) => el.hidden),
          '普通模式残留遮罩',
        );
      } finally {
        mode('正常模式');
        pane.getBoundingClientRect = measure;
        editor.setMarkdown(original);
        await first.flush();
      }
    });
    await test('文件菜单点击：重命名对话框提交到文件接口', async () => {
      const host = $('left');
      host.querySelector<HTMLButtonElement>('[data-testid="markdown-file-menu-trigger"]')!.click();
      await until(() => !!host.querySelector('.snapshot-file-menu-popover'));
      host
        .querySelector<HTMLButtonElement>('.snapshot-file-menu-popover [role="menuitem"]')!
        .click();
      const dialog = host.querySelector<HTMLDialogElement>('[data-id="rename-dialog"]')!;
      assert(dialog.open, '重命名窗口未打开');
      const input = host.querySelector<HTMLInputElement>('[data-id="rename-name"]')!;
      input.value = '菜单重命名';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      dialog.querySelector<HTMLButtonElement>('[value="save"]')!.click();
      await until(() => store.notes.get(first.documentId)?.title === '菜单重命名');
      assert(
        !dialog.open &&
          host.querySelector('[data-id="notes"]')?.textContent?.includes('菜单重命名'),
        '名称未刷新到历史列表',
      );
    });
    await test('240px 设置入口可见，主题/模式/语言/拼写立即生效', async () => {
      const host = $('left');
      $('primary').style.width = '240px';
      await until(() => host.dataset.narrow === 'true');
      const trigger = host.querySelector<HTMLButtonElement>('.status-settings')!;
      const bounds = trigger.getBoundingClientRect();
      assert(
        bounds.left >= host.getBoundingClientRect().left &&
          bounds.right <= host.getBoundingClientRect().right,
        '设置按钮被挤出底栏',
      );
      trigger.click();
      const dialog = host.querySelector<HTMLDialogElement>('.settings-dialog')!;
      assert(dialog.open && dialog.getBoundingClientRect().width <= 240, '窄侧栏设置面板越界');
      $('primary').style.width = '390px';
      await until(() => dialog.getBoundingClientRect().width > 240);
      $('primary').style.width = '240px';
      await until(() => dialog.getBoundingClientRect().width <= 240);
      const select = async (name: string, value: string) => {
        const input = dialog.querySelector<HTMLSelectElement>('[name="' + name + '"]')!;
        input.value = value;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        await delay(80);
      };
      await select('theme', 'dark');
      assert(host.dataset.theme === 'dark', '主题设置未生效');
      await select('mode', 'typewriter');
      assert(
        host.querySelector<HTMLElement>('[data-id="document-layout"]')!.dataset.mode ===
          'typewriter',
        '模式未生效',
      );
      const spellcheck = dialog.querySelector<HTMLInputElement>('[name="spellcheck"]')!;
      spellcheck.checked = false;
      spellcheck.dispatchEvent(new Event('change', { bubbles: true }));
      await until(() => !host.querySelector<HTMLElement>('.ProseMirror')!.spellcheck);
      await select('locale', 'en');
      await until(
        () => host.querySelector('.ProseMirror')?.getAttribute('aria-label') === 'Note content',
      );
      await select('locale', 'zh-CN');
      await select('theme', 'light');
      await select('mode', 'normal');
      aiMode = 'slow';
      const activeEditor = first.editor;
      activeEditor.ai!.run('切换设置测试', 'document');
      await until(() => activeEditor.ai!.getState().status === 'streaming');
      await select('locale', 'en');
      assert(
        first.editor === activeEditor &&
          dialog.querySelector('.settings-message')?.textContent?.includes('请先结束 AI'),
        '语言切换丢弃了 AI 会话',
      );
      activeEditor.ai!.abort();
      aiMode = 'normal';
      dialog.querySelector<HTMLButtonElement>('.settings-close')!.click();
      assert(!dialog.open, '关闭设置失败');
      $('primary').style.width = '390px';
    });
    await test('AI 设置读取、保存、失败后重试，密钥不回显', async () => {
      const host = $('left');
      host.querySelector<HTMLButtonElement>('.status-settings')!.click();
      const dialog = host.querySelector<HTMLDialogElement>('.settings-dialog')!;
      const form = dialog.querySelector<HTMLFormElement>('.settings-ai-form')!;
      await until(() => !form.hidden);
      const key = form.querySelector<HTMLInputElement>('[name="apiKey"]')!;
      assert(key.type === 'password' && key.value === '', '已有密钥被回显');
      const effort = form.querySelector<HTMLSelectElement>('[name="reasoningEffort"]')!;
      effort.value = 'high';
      settingsFail = true;
      form.requestSubmit();
      await until(
        () =>
          !!dialog.querySelector('.settings-message')?.textContent?.includes('设置保存失败测试'),
      );
      assert(settingsValue.reasoningEffort === 'medium', '失败仍修改了配置');
      settingsFail = false;
      form.requestSubmit();
      await until(() => settingsValue.reasoningEffort === 'high');
      dialog.close();
      host.querySelector<HTMLButtonElement>('.status-settings')!.click();
      await until(() => !form.hidden);
      assert(effort.value === 'high' && key.value === '', '重新打开丢失设置');
      dialog.close();
    });
    await test('卸载取消 AI，清理浮层/事件，容器可以再次挂载', async () => {
      aiMode = 'slow';
      first.editor.ai!.run('卸载测试', 'document');
      await until(() => first.editor.ai!.getState().status === 'streaming');
      await first.destroy();
      assert(
        aiSignal?.aborted &&
          !$('left').childNodes.length &&
          !$('left').classList.contains('mn-sidebar'),
        '卸载残留',
      );
      await second.destroy();
      await delay(120);
      assert(!document.querySelector('.mn-note-menu-layer'), '菜单 portal 残留');
      aiMode = 'normal';
      store = memoryFiles();
      await mountDemo();
    });
    await test('无未处理的异步异常', async () => {
      await delay(150);
      assert(!unhandled.length, unhandled.join('\n'));
    });
  } finally {
    button.disabled = false;
    $('status').textContent = `侧栏回归完成：${passed} 通过，${failed} 失败`;
  }
}
await mountDemo();
