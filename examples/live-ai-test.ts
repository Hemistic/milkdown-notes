import {
  mountSidebar,
  createHttpAIProvider,
  type NoteSidebar,
  type NoteFiles,
} from '@local/milkdown-sidebar';
import type { AIProvider, AIPromptContext } from '@local/milkdown-notes';

const $ = (id: string) => document.getElementById(id)!;
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
function assert(value: unknown, message: string) {
  if (!value) throw Error(message);
}
async function until(check: () => unknown) {
  const deadline = Date.now() + 90000;
  while (!check()) {
    if (Date.now() > deadline) throw Error('等待真实模型超时');
    await delay(20);
  }
}
const source = '# 雨天阅读\n\n今天下雨，我在家读书。\n\n读完以后，记下想法。\n';
const instruction =
  '把这篇笔记扩写为一篇约 500 字的中文短文，保留标题，写 6 个自然段，主题为雨天阅读与记录想法。仅输出改写后的完整 Markdown。';
const httpProvider = createHttpAIProvider();
let sidebar: NoteSidebar | undefined;
let saved = source;
let writes = 0;
let failNext = false;
let errors: string[] = [];
const requests: {
  context: AIPromptContext;
  chunks: number;
  chars: number;
  started: number;
  firstMs?: number;
  totalMs?: number;
  aborted: boolean;
  completed: boolean;
}[] = [];
const measuredProvider: AIProvider = async function* (context, signal) {
  const row = {
    context,
    chunks: 0,
    chars: 0,
    started: performance.now(),
    aborted: false,
    completed: false,
    error: '',
    firstMs: undefined as number | undefined,
    totalMs: undefined as number | undefined,
  };
  requests.push(row);
  const shouldFail = failNext;
  failNext = false;
  const connection = new AbortController();
  const cancel = () => connection.abort();
  signal.addEventListener('abort', cancel, { once: true });
  try {
    for await (const text of httpProvider(context, AbortSignal.any([signal, connection.signal]))) {
      row.firstMs ??= Math.round(performance.now() - row.started);
      row.chunks++;
      row.chars += text.length;
      $('metrics').textContent = JSON.stringify(
        requests.map(({ context: _context, started: _started, ...rest }) => rest),
        null,
        2,
      );
      if (shouldFail && row.chunks === 3) {
        connection.abort();
        throw Error('验收注入：真实流输出后断开连接');
      }
      yield text;
    }
    row.completed = true;
  } catch (error) {
    row.error = String(error);
    throw error;
  } finally {
    row.aborted = signal.aborted;
    row.totalMs = Math.round(performance.now() - row.started);
    signal.removeEventListener('abort', cancel);
    $('metrics').textContent = JSON.stringify(
      requests.map(({ context: _context, started: _started, ...rest }) => rest),
      null,
      2,
    );
  }
};
const files: NoteFiles = {
  async list() {
    return [{ id: 'live-test', title: '真实 AI 验收' }];
  },
  async read(id) {
    return { id, markdown: saved };
  },
  async write(_id, markdown) {
    saved = markdown;
    writes++;
  },
  async rename() {},
  async uploadImage() {
    throw Error('此验收页不上传图片');
  },
  resolveAsset: (source) => source,
};
async function fresh() {
  await sidebar?.destroy();
  saved = source;
  writes = 0;
  errors = [];
  sidebar = await mountSidebar($('sidebar'), {
    files,
    aiProvider: measuredProvider,
    onAIError: (error) => errors.push(error.message),
  });
  return sidebar.editor;
}
function clickDiff(action: string) {
  const button = $('sidebar').querySelector<HTMLButtonElement>(
    '.milkdown-ai-diff-actions-btn-' + action,
  );
  assert(button && !button.disabled, '缺少可用的 diff 按钮：' + action);
  button!.click();
}
async function review() {
  await until(() => errors.length || sidebar!.editor.ai!.getState().status === 'review');
  assert(errors.length === 0, errors.join('; '));
}
const config = await (await fetch('/api/ai')).json();
$('model').textContent = config.configured
  ? `${config.model} · ${config.reasoningEffort ?? '默认思考程度'}`
  : '请先在 .env.local 配置真实模型';
($('suite') as HTMLButtonElement).disabled = !config.configured;
if (config.configured) await fresh();
$('suite').onclick = async () => {
  ($('suite') as HTMLButtonElement).disabled = true;
  $('results').replaceChildren();
  requests.length = 0;
  let passed = 0,
    failed = 0;
  const unexpected: string[] = [];
  const onError = (event: PromiseRejectionEvent) => unexpected.push(String(event.reason));
  window.addEventListener('unhandledrejection', onError);
  async function test(name: string, run: () => Promise<void>) {
    const only = new URLSearchParams(location.search).get('case');
    if (only && !name.includes(only)) return;
    const item = document.createElement('li');
    item.textContent = name + '…';
    $('results').append(item);
    try {
      await run();
      item.dataset.result = 'pass';
      item.textContent = '通过 · ' + name;
      passed++;
    } catch (error) {
      item.dataset.result = 'fail';
      item.textContent = '失败 · ' + name + '：' + String(error);
      failed++;
      sidebar?.editor.ai?.abort();
      sidebar?.editor.ai?.reject();
    }
    $('status').textContent = `${passed} 通过，${failed} 失败`;
  }
  try {
    await test('真实流式逐段到达，草稿不保存；点击全部放弃保留原文', async () => {
      const editor = await fresh();
      const before = editor.getMarkdown();
      assert(editor.ai!.run(instruction, 'document'), '未启动');
      await until(() => requests.at(-1)!.chunks >= 2 || errors.length);
      assert(errors.length === 0, '真实接口失败：' + errors.join('; '));
      assert(editor.ai!.getState().status === 'streaming', '未观察到分段流式状态');
      assert(editor.getMarkdown() === before && writes === 0, '流式草稿进入了文件');
      await review();
      assert(requests.at(-1)!.completed && requests.at(-1)!.chunks > 2, '流未正常结束');
      assert(editor.getMarkdown() === before && writes === 0, '未确认 diff 进入文件');
      clickDiff('reject');
      await sidebar!.flush();
      assert(editor.getMarkdown() === before && writes === 0, '放弃后正文被修改');
    });
    await test('点击重新改写重发原始上下文；全部接受、保存、撤销与重做', async () => {
      const editor = await fresh();
      const before = editor.getMarkdown();
      editor.ai!.run(instruction, 'document');
      await review();
      const first = requests.at(-1)!;
      const count = requests.length;
      clickDiff('retry');
      await until(() => requests.length > count);
      await review();
      assert(
        JSON.stringify(requests.at(-1)!.context) === JSON.stringify(first.context),
        '重试上下文改变',
      );
      clickDiff('accept');
      await sidebar!.flush();
      const accepted = editor.getMarkdown();
      assert(accepted !== before && saved === accepted && writes > 0, '接受结果未保存');
      assert(
        $('sidebar').querySelector('h1')?.textContent === '雨天阅读',
        '全文重试后标题结构错误',
      );
      assert(editor.undo() && editor.getMarkdown() === before, '撤销错误');
      assert(editor.redo() && editor.getMarkdown() === accepted, '重做错误');
    });
    await test('首个 token 前取消：恢复正文并终止请求', async () => {
      const editor = await fresh();
      const before = editor.getMarkdown();
      editor.ai!.run(instruction, 'document');
      await until(() => editor.ai!.getState().status === 'streaming');
      const row = requests.at(-1)!;
      editor.ai!.abort();
      await until(() => row.totalMs !== undefined);
      assert(row.aborted && row.chunks === 0, '取消未在首 token 前发生');
      assert(
        editor.ai!.getState().status === 'idle' && editor.getMarkdown() === before && writes === 0,
        '取消后状态错误',
      );
    });
    await test('真实输出中取消：不再接收后续文本，不落盘', async () => {
      const editor = await fresh();
      const before = editor.getMarkdown();
      editor.ai!.run(instruction, 'document');
      await until(() => requests.at(-1)!.chunks >= 2 || errors.length);
      assert(errors.length === 0, '真实接口失败：' + errors.join('; '));
      const row = requests.at(-1)!;
      editor.ai!.abort();
      await until(() => row.totalMs !== undefined);
      const chunks = row.chunks;
      await delay(300);
      assert(row.aborted && !row.completed && row.chunks === chunks, '取消后仍继续输出');
      assert(
        editor.getMarkdown() === before && writes === 0 && editor.ai!.getState().status === 'idle',
        '取消后的正文或状态错误',
      );
    });
    await test('真实流中注入断线，再次请求成功并清除旧错误', async () => {
      const editor = await fresh();
      const before = editor.getMarkdown();
      failNext = true;
      editor.ai!.run(instruction, 'document');
      await until(() => errors.length && editor.ai!.getState().status === 'idle');
      assert(errors[0].includes('验收注入'), '未进入注入阶段：' + errors[0]);
      assert(editor.getMarkdown() === before && writes === 0, '断线污染正文');
      errors = [];
      assert(editor.ai!.run(instruction, 'document'), '失败后不能重试');
      await review();
      assert(!$('sidebar').querySelector('.mn-note-ai-error'), '旧错误未清除');
      clickDiff('reject');
    });
    await test('Esc 停止并保留真实草稿；放弃部分结果恢复原文', async () => {
      const editor = await fresh();
      const before = editor.getMarkdown();
      editor.ai!.run(instruction, 'document');
      await until(() => requests.at(-1)!.chars >= 100 || errors.length);
      const row = requests.at(-1)!;
      $('sidebar')
        .querySelector('.ProseMirror')!
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await review();
      await until(() => row.totalMs !== undefined);
      assert(row.aborted && !row.completed, 'Esc 没有停止真实请求');
      assert(editor.getMarkdown() === before && writes === 0, '部分草稿进入正文');
      clickDiff('reject');
      await delay(50);
      assert(
        editor.getMarkdown() === before &&
          editor.ai!.getState().status === 'idle' &&
          writes === 0 &&
          !sidebar!.dirty,
        '放弃部分结果失败',
      );
    });
    await test('真实请求完成后无未处理异步错误', async () => {
      await delay(300);
      assert(!unexpected.length, unexpected.join('; '));
    });
  } finally {
    window.removeEventListener('unhandledrejection', onError);
    $('status').textContent = `真实 AI 回归完成：${passed} 通过，${failed} 失败`;
    ($('suite') as HTMLButtonElement).disabled = false;
  }
};
