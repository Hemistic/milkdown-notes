import { createNoteSurface } from '../packages/editor/src/note-surface.js';
import { bindBlockSource } from '../packages/editor/src/note-source.js';
import { mountEditor } from '../packages/editor/src/index.js';
import { commandsCtx, editorViewCtx } from '@milkdown/core';
import { TextSelection } from '@milkdown/prose/state';
import { undo, redo } from '@milkdown/prose/history';
import {
  runAICmd,
  abortAICmd,
  useAIProviderConfig,
  useAIInstructionTooltipAPI,
  type AIProvider,
} from '@milkdown/crepe/feature/ai';
import {
  diffPluginKey,
  getPendingChanges,
  acceptAllDiffsCmd,
  clearDiffReviewCmd,
  acceptDiffChunkCmd,
  rejectDiffChunkCmd,
} from '@milkdown/plugin-diff';
import { streamingPluginKey } from '@milkdown/plugin-streaming';

const $ = (id: string) => document.getElementById(id)!;
const unhandled: string[] = [];
window.addEventListener('unhandledrejection', (event) => unhandled.push(String(event.reason)));
const source = '原来的第一段。\n\n保持不变的中间段落。\n\n原来的最后一段。\n';
const replacement = '改写后的第一段。\n\n保持不变的中间段落。\n\n改写后的最后一段。\n';
type Surface = Awaited<ReturnType<typeof createNoteSurface>>;
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const assert = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};
async function until(check: () => unknown) {
  const end = Date.now() + 5000;
  while (!check()) {
    if (Date.now() > end) throw Error('等待状态超时');
    await delay(15);
  }
}
const view = (s: Surface) => s.editor.action((ctx) => ctx.get(editorViewCtx));
const review = (s: Surface) => diffPluginKey.getState(view(s).state);
const streaming = (s: Surface) => streamingPluginKey.getState(view(s).state);
const run = (s: Surface, instruction = 'test') =>
  s.editor.action((ctx) => ctx.get(commandsCtx).call(runAICmd.key, { instruction }));
const accept = (s: Surface) =>
  s.editor.action((ctx) => ctx.get(commandsCtx).call(acceptAllDiffsCmd.key));
const reject = (s: Surface) =>
  s.editor.action((ctx) => ctx.get(commandsCtx).call(clearDiffReviewCmd.key));
const cancel = (s: Surface, keep = false) =>
  s.editor.action((ctx) => ctx.get(commandsCtx).call(abortAICmd.key, { keep }));
const selectAll = (s: Surface) => {
  const v = view(s);
  v.dispatch(
    v.state.tr.setSelection(TextSelection.create(v.state.doc, 1, v.state.doc.content.size - 1)),
  );
};
const history = (s: Surface, command: typeof undo) => {
  const v = view(s);
  return command(v.state, v.dispatch);
};
function provider(text = replacement, mode = 'normal'): AIProvider {
  return async function* (context, signal) {
    $('context').textContent = JSON.stringify(context, null, 2);
    if (mode === 'empty') return;
    if (mode === 'early-error') throw Error('测试：首字前失败');
    for (let i = 0; i < text.length; i += 5) {
      await delay(mode === 'slow' ? 100 : 8);
      if (signal.aborted) return;
      yield text.slice(i, i + 5);
      if (mode === 'error' && i >= 5) throw Error('测试：流式中断');
    }
  };
}
let demo: Surface | undefined;
async function resetDemo() {
  await demo?.destroy();
  $('editor').replaceChildren();
  demo = await createNoteSurface(
    $('editor'),
    source,
    (read) => {
      $('markdown').textContent = read();
    },
    {
      locale: 'zh-CN',
      aiProvider: async function* (context, signal) {
        yield* provider(replacement, ($('scenario') as HTMLSelectElement).value)(context, signal);
      },
    },
  );
  $('markdown').textContent = demo.markdown();
  $('status').textContent = '选中文字后点击 AI 改写，或使用“打开 AI 菜单”。';
}
$('reset').onclick = () => void resetDemo();
$('width').onchange = () => {
  $('frame').style.width = ($('width') as HTMLSelectElement).value;
  $('frame').style.maxWidth = '100%';
};
$('palette').onpointerdown = (event) => event.preventDefault();
$('palette').onclick = () => {
  if (!demo) return;
  const v = view(demo);
  if (v.state.selection.empty) selectAll(demo);
  demo.editor.action((ctx) => {
    const selection = view(demo!).state.selection;
    useAIInstructionTooltipAPI(ctx).show(selection.from, selection.to);
  });
};

async function suite() {
  ($('suite') as HTMLButtonElement).disabled = true;
  $('results').replaceChildren();
  unhandled.length = 0;
  let passed = 0,
    failed = 0;
  let current: Surface | undefined,
    events: string[] = [];
  async function fresh(p: AIProvider = provider(), markdown = source) {
    await current?.destroy();
    $('test-host').replaceChildren();
    events = [];
    current = await createNoteSurface($('test-host'), markdown, (read) => events.push(read()), {
      locale: 'zh-CN',
      aiProvider: p,
    });
    selectAll(current);
    return current;
  }
  async function test(name: string, body: () => Promise<void>) {
    const li = document.createElement('li');
    li.textContent = name + '…';
    $('results').append(li);
    try {
      await body();
      li.dataset.result = 'pass';
      li.textContent = '通过 · ' + name;
      passed++;
    } catch (e) {
      li.dataset.result = 'fail';
      li.textContent = '失败 · ' + name + '：' + String(e);
      failed++;
    }
    $('status').textContent = `回归进行中：${passed} 通过，${failed} 失败`;
  }
  try {
    await test('选区上下文、流式期间保留原文且不触发保存', async () => {
      let received: any;
      const s = await fresh(async function* (c, signal) {
        received = c;
        yield* provider(replacement, 'slow')(c, signal);
      });
      const original = s.markdown();
      assert(run(s), '启动失败');
      await until(() => !!streaming(s)?.active);
      await delay(220);
      assert(
        received.selection.includes('原来的第一段') && received.document.includes('中间段落'),
        '上下文丢失',
      );
      assert(s.markdown() === original && events.length === 0, '流式草稿泄漏到保存');
      cancel(s);
      await until(() => !streaming(s)?.active);
      assert(s.markdown() === original, '取消没有恢复');
    });
    await test('全部放弃、不保存未确认 diff', async () => {
      const s = await fresh();
      const before = s.markdown();
      run(s);
      await until(() => review(s)?.active);
      assert(s.markdown() === before && events.length === 0, 'diff 尚未确认却保存');
      reject(s);
      await delay(20);
      assert(s.markdown() === before, '放弃改变原文');
    });
    await test('全部接受、保存、撤销与重做', async () => {
      const s = await fresh();
      const before = s.markdown();
      run(s);
      await until(() => review(s)?.active);
      accept(s);
      await delay(30);
      const after = s.markdown();
      assert(after.includes('改写后的最后一段') && events.at(-1) === after, '接受后未保存');
      assert(history(s, undo), '不可撤销');
      assert(s.markdown() === before, '撤销未还原');
      assert(history(s, redo) && s.markdown() === after, '重做未恢复');
    });
    await test('逐项接受与放弃、部分接受后禁止不安全重试', async () => {
      const s = await fresh();
      run(s);
      await until(() => review(s)?.active);
      assert(getPendingChanges(review(s)!).length >= 2, '缺少多处差异');
      s.editor.action((ctx) => ctx.get(commandsCtx).call(acceptDiffChunkCmd.key, 0));
      const retry = $('test-host').querySelector<HTMLButtonElement>(
        '.milkdown-ai-diff-actions-btn-retry',
      );
      assert(retry?.disabled, '部分接受后仍允许重试');
      s.editor.action((ctx) => ctx.get(commandsCtx).call(rejectDiffChunkCmd.key, 0));
      if (review(s)?.active) reject(s);
      assert(
        s.markdown().includes('改写后') && s.markdown().includes('原来的最后'),
        '逐项决策结果错误',
      );
    });
    await test('重新改写沿用原始选区和要求', async () => {
      const contexts: any[] = [];
      const s = await fresh(async function* (c, signal) {
        contexts.push(c);
        yield* provider()(c, signal);
      });
      run(s, '精简');
      await until(() => review(s)?.active);
      $('test-host')
        .querySelector<HTMLButtonElement>('.milkdown-ai-diff-actions-btn-retry')!
        .click();
      await until(() => contexts.length === 2 && review(s)?.active);
      assert(
        contexts[0].selection === contexts[1].selection && contexts[1].instruction === '精简',
        '重试上下文改变',
      );
      reject(s);
    });
    await test('流式取消并保留已生成部分', async () => {
      const s = await fresh(provider(replacement, 'slow'));
      run(s);
      await delay(350);
      cancel(s, true);
      await delay(30);
      assert(!streaming(s)?.active && s.markdown().includes('改写'), '保留部分输出失败');
    });
    for (const mode of ['early-error', 'error'])
      await test(mode === 'error' ? '流中失败回退并解锁' : '首字前失败回退并解锁', async () => {
        const s = await fresh(provider(replacement, mode));
        const before = s.markdown();
        run(s);
        await until(() => $('test-host').querySelector('.mn-note-ai-error'));
        await until(() => !streaming(s)?.active);
        assert(s.markdown() === before, '失败后原文丢失');
        const v = view(s);
        v.dispatch(v.state.tr.insertText('可继续编辑', 1));
        assert(s.markdown().includes('可继续编辑'), '失败后未解锁');
      });
    await test('空返回不删除选区', async () => {
      const s = await fresh(provider('', 'empty'));
      const before = s.markdown();
      run(s);
      await until(() => !streaming(s)?.active);
      if (review(s)?.active) accept(s);
      assert(s.markdown() === before, '空返回删除原文');
    });
    await test('相同内容无破坏性 diff', async () => {
      const s = await fresh(async function* (c) {
        yield c.selection;
      });
      const before = s.markdown();
      run(s);
      await until(() => !streaming(s)?.active);
      if (review(s)?.active) accept(s);
      assert(s.markdown() === before, '相同内容发生变化');
    });
    await test('流中与 diff 中阻止重复请求', async () => {
      const s = await fresh(provider(replacement, 'slow'));
      run(s);
      assert(!run(s), '流中重复启动');
      cancel(s);
      const fast = await fresh();
      run(fast);
      await until(() => review(fast)?.active);
      assert(!run(fast), 'diff 中重复启动');
      reject(fast);
    });
    await test('空选区在光标处插入', async () => {
      const s = await fresh(provider('新增内容'));
      const v = view(s);
      v.dispatch(v.state.tr.setSelection(TextSelection.create(v.state.doc, 1)));
      run(s);
      await until(() => review(s)?.active);
      accept(s);
      assert(s.markdown().includes('新增内容原来的第一段'), '没有在光标插入');
    });
    await test('Markdown 流跨 chunk：表格、公式、代码和加粗', async () => {
      const content =
        '## 新标题\n\n**加粗** 与 $x^2$\n\n| 列 | 值 |\n|---|---|\n| A | B |\n\n```js\nconst n = 1;\n```\n';
      const s = await fresh(provider(content));
      run(s);
      await until(() => review(s)?.active);
      accept(s);
      const result = s.markdown();
      for (const part of ['## 新标题', '**加粗**', '$x^2$', 'const n = 1', 'A'])
        assert(result.includes(part), 'Markdown 丢失 ' + part);
    });
    await test('构造上下文失败回退', async () => {
      const s = await fresh();
      const before = s.markdown();
      s.editor.action((ctx) => {
        useAIProviderConfig(ctx).buildContext = () => {
          throw Error('测试上下文错误');
        };
      });
      assert(!run(s), '错误上下文仍启动');
      assert(!streaming(s)?.active && s.markdown() === before, '没有回退');
    });
    await test('销毁时取消、清理 UI，重新挂载可运行', async () => {
      let signal: AbortSignal | undefined;
      const s = await fresh(async function* (c, sig) {
        signal = sig;
        yield* provider(replacement, 'slow')(c, sig);
      });
      run(s);
      await delay(130);
      await s.destroy();
      current = undefined;
      assert(signal?.aborted, '销毁未取消');
      await delay(150);
      assert(!$('test-host').querySelector('.milkdown-ai-diff-actions'), 'AI UI 未清理');
      const next = await fresh();
      run(next);
      await until(() => review(next)?.active);
      accept(next);
      assert(next.markdown().includes('改写后'), '重新挂载失败');
    });
    await test('只读和无 provider 隐藏 AI 入口', async () => {
      await current?.destroy();
      current = undefined;
      for (const readOnly of [false, true]) {
        $('test-host').replaceChildren();
        const editor = await mountEditor($('test-host'), {
          markdown: source,
          readOnly,
          ...(readOnly ? { aiProvider: provider() } : {}),
        });
        assert(!$('test-host').querySelector('[aria-label="AI 改写"]'), '不应显示 AI');
        await editor.destroy();
      }
    });
    await test('失败后重新请求清除旧错误提示', async () => {
      let calls = 0;
      const s = await fresh(async function* (c, signal) {
        yield* provider(replacement, calls++ ? 'normal' : 'error')(c, signal);
      });
      run(s);
      await until(() => $('test-host').querySelector('.mn-note-ai-error'));
      await until(() => !streaming(s)?.active);
      run(s);
      await until(() => review(s)?.active);
      assert(!$('test-host').querySelector('.mn-note-ai-error'), '旧错误仍显示');
      reject(s);
    });
    await test('三击源码：开关、Esc 取消、按块提交、撤销重做', async () => {
      await current?.destroy();
      current = undefined;
      $('test-host').replaceChildren();
      const e = await mountEditor($('test-host'), {
        markdown: '# 标题\n\n保留这一段。\n',
        locale: 'zh-CN',
      });
      try {
        const reveal = () => {
          $('test-host')
            .querySelector('h1')!
            .dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 3 }));
          return $('test-host').querySelector<HTMLTextAreaElement>('.mn-block-source');
        };
        assert(!reveal(), '关闭状态仍显示源码');
        e.setSourceReveal(true);
        let area = reveal()!;
        await delay(40);
        assert(area?.value === '# 标题', '没有序列化当前块');
        assert(
          area.getBoundingClientRect().width > 100 &&
            area.getBoundingClientRect().left >= $('test-host').getBoundingClientRect().left,
          'DOM 更新后源码定位丢失',
        );
        area.value = '# 不应保存';
        area.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        assert(e.getMarkdown().includes('# 标题'), 'Esc 未取消');
        area = reveal()!;
        area.value = '## 修改后的标题';
        area.dispatchEvent(new Event('input', { bubbles: true }));
        area.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }),
        );
        assert(
          e.getMarkdown().includes('## 修改后的标题') && e.getMarkdown().includes('保留这一段'),
          '块提交破坏其他内容',
        );
        assert(e.undo() && e.getMarkdown().includes('# 标题'), '源码不能撤销');
        assert(e.redo() && e.getMarkdown().includes('## 修改后的标题'), '源码不能重做');
      } finally {
        await e.destroy();
      }
    });
    await test('源码：失焦提交、关闭/销毁清理、只读保护', async () => {
      for (const readOnly of [false, true]) {
        $('test-host').replaceChildren();
        const e = await mountEditor($('test-host'), {
          markdown: '原文\n',
          sourceReveal: true,
          readOnly,
          spellcheck: true,
        });
        try {
          $('test-host')
            .querySelector('.ProseMirror p')!
            .dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 3 }));
          const area = $('test-host').querySelector<HTMLTextAreaElement>('.mn-block-source')!;
          assert(area && area.readOnly === readOnly && area.spellcheck, '只读/拼写状态错误');
          area.value = '新文';
          area.dispatchEvent(new Event('blur'));
          assert(e.getMarkdown().includes(readOnly ? '原文' : '新文'), '失焦或只读行为错误');
          $('test-host')
            .querySelector('.ProseMirror p')!
            .dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 3 }));
          e.setSourceReveal(false);
          assert(!$('test-host').querySelector('.mn-block-source'), '关闭未清理');
          e.setSpellcheck(false);
          assert(
            !$('test-host').querySelector<HTMLElement>('.ProseMirror')!.spellcheck,
            '拼写开关未同步',
          );
        } finally {
          await e.destroy();
        }
        assert(!document.querySelector('style[data-mn-source]'), '销毁遗留源码样式');
      }
    });
    await test('AI 流式和 diff 审查期间禁止源码越过编辑锁', async () => {
      const s = await fresh(provider(replacement, 'slow'));
      const blockSource = bindBlockSource($('test-host'), s.editor, { sourceReveal: true });
      const triple = () => {
        $('test-host')
          .querySelector('.ProseMirror p')!
          .dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 3 }));
        return $('test-host').querySelector('.mn-block-source');
      };
      try {
        run(s);
        await until(() => !!streaming(s)?.active);
        assert(!triple(), '流式期间允许源码编辑');
        await until(() => review(s)?.active);
        assert(!triple(), 'diff 期间允许源码编辑');
        reject(s);
        assert(triple(), '结束 diff 后源码未解锁');
      } finally {
        blockSource.destroy();
      }
    });
    await test('白天/黑夜主题：图表、浮层隔离与切换不修改正文', async () => {
      const a = document.createElement('div'),
        b = document.createElement('div');
      $('test-host').append(a, b);
      const markdown = '```mermaid\ngraph LR\n A[输入] --> B[输出]\n```\n';
      const changes: string[] = [];
      const one = await mountEditor(a, {
          markdown,
          theme: 'light',
          onChange: (m) => changes.push(m),
        }),
        two = await mountEditor(b, { markdown, theme: 'dark' });
      try {
        await Promise.all([one.settled(), two.settled()]);
        const original = one.getMarkdown();
        changes.length = 0;
        const fill = (host: HTMLElement) =>
          getComputedStyle(
            host.querySelector<SVGElement>('.mn-note-diagram-preview svg .node rect')!,
          ).fill;
        const dayFill = fill(a),
          nightFill = fill(b);
        assert(dayFill !== nightFill, '不同主题复用了错误图表缓存');
        one.setTheme('dark');
        await one.settled();
        assert(fill(a) === nightFill, '切换后图表未同步黑夜主题');
        assert(getComputedStyle(a).backgroundColor === 'rgb(38, 38, 36)', '正文背景未同步');
        two.setTheme('light');
        await two.settled();
        assert(fill(b) === dayFill && fill(a) === nightFill, '多实例主题互相污染');
        const layers = [...document.querySelectorAll<HTMLElement>('.mn-note-menu-layer')];
        assert(
          layers.some((el) => el.dataset.theme === 'dark') &&
            layers.some((el) => el.dataset.theme === 'light'),
          '浮层未同步主题',
        );
        assert(one.getMarkdown() === original && changes.length === 0, '切主题修改了正文');
      } finally {
        await one.destroy();
        await two.destroy();
        a.remove();
        b.remove();
      }
    });
    await test('异步生命周期无未处理异常', async () => {
      await delay(200);
      assert(unhandled.length === 0, unhandled.join('; '));
    });
  } finally {
    await current?.destroy();
    $('test-host').replaceChildren();
    ($('suite') as HTMLButtonElement).disabled = false;
    $('status').textContent = `回归完成：${passed} 通过，${failed} 失败（本地固定流式数据）`;
  }
}
$('suite').onclick = () => void suite();
await resetDemo();
