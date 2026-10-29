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
window.addEventListener('unhandledrejection', (event) => unhandled.push(String(event.reason)));
async function mountDemo() {
  first = await mountSidebar($('left'), {
    files: store.files,
    initialNoteId: 'one',
    aiProvider: ai,
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
