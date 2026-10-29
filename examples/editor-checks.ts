import { mountEditor, type EditorOptions, type NoteEditor } from '../packages/editor/src/index.js';

type RunTest = (name: string, action: () => Promise<void>) => Promise<void>;
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
function assert(value: unknown, message: string) {
  if (!value) throw Error(message);
}
async function until(check: () => unknown) {
  const deadline = Date.now() + 5000;
  while (!check()) {
    if (Date.now() > deadline) throw Error('等待编辑器状态超时');
    await delay(20);
  }
}
function selectText(element: Element, collapse = false) {
  const range = document.createRange();
  range.selectNodeContents(element);
  if (collapse) range.collapse(false);
  const selection = getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  document.dispatchEvent(new Event('selectionchange'));
}

export async function runEditorChecks(test: RunTest, host: HTMLElement) {
  // Focus/selection tests need a visible, focusable surface rather than the AI suite's hidden fixture.
  host.style.cssText =
    'position:fixed;left:16px;top:16px;width:400px;max-width:95vw;max-height:90vh;overflow:auto;visibility:visible;pointer-events:auto;z-index:2000;background:var(--mn-page)';
  async function withEditor(
    markdown: string,
    options: EditorOptions,
    action: (editor: NoteEditor) => Promise<void>,
  ) {
    const editor = await mountEditor(host, { ...options, markdown });
    try {
      await action(editor);
    } finally {
      await editor.destroy();
    }
  }

  await test('完整正文：标题、列表、任务、引用、表格、公式、脚注与扩展往返', async () => {
    const markdown =
      '# 标题\n\n**加粗**、*斜体*、~~删除~~、==高亮==、H~2~O、x^2^。\n\n- 普通列表\n- [x] 已完成\n\n> 引用段落\n\n| A | B |\n| --- | --- |\n| 甲 | 乙 |\n\n行内 $x^2$。\n\n$$\nx+y\n$$\n\n[[note|别名]] 和脚注[^local]。\n\n[^local]: 脚注内容\n\n```js\nconst answer = 42;\n```\n';
    await withEditor(markdown, {}, async (editor) => {
      for (const selector of [
        'h1',
        'strong',
        'em',
        'del',
        'mark',
        'sub',
        'sup',
        'blockquote',
        'table',
        '.mn-note-math',
        '[data-note-wiki]',
        '.milkdown-code-block',
      ]) {
        assert(host.querySelector(selector), '正文节点缺失：' + selector);
      }
      const normalized = editor.getMarkdown();
      editor.setMarkdown(normalized);
      assert(editor.getMarkdown() === normalized, '重复解析改变了规范化正文');
      assert(
        normalized.includes('[x]') &&
          normalized.includes('[^local]') &&
          normalized.includes('const answer = 42'),
        '列表、脚注或代码丢失',
      );
    });
  });

  await test('公开编辑 API：变更合并、取消订阅、撤销与重做', async () => {
    const events: string[] = [];
    await withEditor('初始文本\n', { onChange: (text) => events.push(text) }, async (editor) => {
      assert(events.length === 0, '挂载触发了保存');
      const initial = editor.getMarkdown();
      let subscribed = 0;
      const unsubscribe = editor.onChange(() => subscribed++);
      editor.setMarkdown('第一次\n');
      editor.setMarkdown('第二次\n');
      await delay(20);
      assert(
        events.length === 1 && subscribed === 1 && events[0] === editor.getMarkdown(),
        '同一轮变更没有合并',
      );
      unsubscribe();
      editor.undo();
      await delay(20);
      assert(editor.getMarkdown().includes('第一次') && subscribed === 1, '撤销或取消订阅失败');
      editor.undo();
      assert(editor.getMarkdown() === initial, '第二次撤销没有回到初始正文');
      editor.redo();
      editor.redo();
      assert(editor.getMarkdown().includes('第二次'), '重做未恢复');
    });
  });

  await test('选文工具栏：真实选区加粗、撤销和重做', async () => {
    await withEditor('格式测试文本\n', {}, async (editor) => {
      editor.focus();
      selectText(host.querySelector('.ProseMirror p')!);
      await until(() => host.querySelector('.milkdown-toolbar[data-show="true"]'));
      host.querySelector<HTMLButtonElement>('.milkdown-toolbar [aria-label="加粗"]')!.click();
      assert(editor.getMarkdown().includes('**格式测试文本**'), '加粗未写入 Markdown');
      editor.undo();
      assert(!editor.getMarkdown().includes('**'), '格式不能撤销');
      editor.redo();
      assert(editor.getMarkdown().includes('**'), '格式不能重做');
    });
  });

  await test('表格：Tab 增行、列对齐及完整撤销', async () => {
    await withEditor('| A | B |\n| --- | --- |\n| 甲 | 乙 |\n', {}, async (editor) => {
      const original = editor.getMarkdown();
      editor.focus();
      selectText(host.querySelector('tbody tr:last-child td:last-child p')!, true);
      await until(() => host.querySelector('.mn-note-table-toolbar'));
      host
        .querySelector('.ProseMirror')!
        .dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
        );
      assert(host.querySelectorAll('tr').length === 3, '表格末尾 Tab 未增行');
      host
        .querySelector<HTMLButtonElement>('.mn-note-table-toolbar [aria-label="右对齐"]')!
        .click();
      assert(/-+:/.test(editor.getMarkdown()), '列对齐未序列化');
      editor.undo();
      editor.undo();
      assert(editor.getMarkdown() === original, '表格撤销未还原');
    });
  });

  await test('图片：宿主资源解析、alt、图题、比例和只读状态', async () => {
    const resolved: string[] = [];
    await withEditor(
      '![真实替代文字](asset:example "图题 {mn-ratio:0.50}")\n',
      {
        readOnly: true,
        resolveAsset(source) {
          resolved.push(source);
          return '/example/test-image.png';
        },
      },
      async (editor) => {
        await until(() => host.querySelector<HTMLImageElement>('img')?.naturalWidth);
        const image = host.querySelector<HTMLImageElement>('img')!;
        assert(
          resolved.includes('asset:example') && image.alt === '真实替代文字',
          '资源解析或 alt 丢失',
        );
        const caption = host.querySelector<HTMLInputElement>('.caption-input')!;
        assert(caption.value === '图题' && caption.readOnly, '图题或只读属性丢失');
        assert(
          editor.getMarkdown().includes('asset:example') &&
            /mn-ratio:0\.5/.test(editor.getMarkdown()),
          '图片存储标识或比例丢失',
        );
      },
    );
  });

  await test('HTML：可显示内容保留，脚本与事件属性不执行', async () => {
    const markdown =
      '<div onclick="alert(1)">保留<strong>内容</strong><script>alert(2)</script><iframe src="about:blank"></iframe></div>\n';
    await withEditor(markdown, {}, async (editor) => {
      assert(host.textContent?.includes('保留'), 'HTML 内容丢失');
      assert(
        !host.querySelector('.ProseMirror script,.ProseMirror iframe,.ProseMirror [onclick]'),
        '危险 HTML 进入可执行 DOM',
      );
      assert(editor.getMarkdown().includes('<script>'), '源码未保留');
    });
  });

  await test('导航：编辑态修饰键、Wiki、反向链接与阅读态普通链接', async () => {
    const calls: string[] = [];
    const ref = { id: 'n1', label: '参考笔记', kind: 'note' };
    const markdown = '[引用](#note-ref/note/n1) 和 [[n1|双链]]\n';
    await withEditor(
      markdown,
      {
        references: () => [ref],
        backlinks: () => [ref],
        onReference: (value) => {
          calls.push(value.id);
        },
      },
      async () => {
        const link = host.querySelector<HTMLAnchorElement>('a[href="#note-ref/note/n1"]')!;
        link.click();
        assert(calls.length === 0, '编辑态普通点击打开了引用');
        link.dispatchEvent(
          new MouseEvent('click', { ctrlKey: true, bubbles: true, cancelable: true }),
        );
        host.querySelector<HTMLAnchorElement>('[data-note-wiki]')!.click();
        host.querySelector<HTMLButtonElement>('.mn-note-backlinks button')!.click();
        await delay(20);
        assert(calls.join(',') === 'n1,n1,n1', '引用路由不完整');
      },
    );
    await withEditor(
      '[普通链接](https://example.com)\n',
      {
        readOnly: true,
        onLink: (url) => {
          calls.push(url);
        },
      },
      async () => {
        host.querySelector<HTMLAnchorElement>('a')!.click();
        await delay(20);
        assert(calls.at(-1) === 'https://example.com', '阅读链接没有交给宿主');
      },
    );
  });

  await test('导航错误：同步与异步异常报告原因，反向链接不产生未处理异常', async () => {
    const ref = { id: 'n1', label: '失败的引用', kind: 'note' };
    await withEditor(
      '[引用](#note-ref/note/n1) [[n1]]\n',
      {
        readOnly: true,
        references: () => [ref],
        backlinks: () => [ref],
        onReference() {
          throw Error('同步打开失败');
        },
        async onWikiLink() {
          throw Error('异步打开失败');
        },
      },
      async () => {
        host.querySelector<HTMLAnchorElement>('a[href="#note-ref/note/n1"]')!.click();
        await delay(20);
        assert(
          host.querySelector('.mn-note-reference-error')?.textContent?.includes('同步打开失败'),
          '错误被吞掉',
        );
        host.querySelector<HTMLAnchorElement>('[data-note-wiki]')!.click();
        await delay(20);
        assert(
          host.querySelector('.mn-note-wiki-status')?.textContent?.includes('异步打开失败'),
          '异步原因被吞掉',
        );
        host.querySelector<HTMLButtonElement>('.mn-note-backlinks button')!.click();
        await delay(20);
        assert(
          host.querySelector('.mn-note-wiki-status')?.textContent?.includes('同步打开失败'),
          '反向链接未报告错误',
        );
      },
    );
  });

  await test('只读、语言与标题回调：更新展示不触发编辑保存', async () => {
    const titles: string[] = [],
      changes: string[] = [];
    await withEditor(
      '# First\n',
      {
        readOnly: true,
        locale: 'en',
        onChange: (value) => changes.push(value),
        onTitleChange: (title) => titles.push(title),
      },
      async (editor) => {
        assert(
          host.querySelector('.ProseMirror')?.getAttribute('contenteditable') === 'false',
          '只读仍可输入',
        );
        assert(host.querySelector('[aria-label="Note content"]'), '英语标签缺失');
        assert(!editor.undo() && !editor.redo() && !editor.ai, '只读编辑入口未关闭');
        editor.setMarkdown('# Second\n');
        await delay(20);
        assert(
          host.querySelector('h1')?.textContent === 'Second' && changes.length === 0,
          '只读更新触发保存',
        );
        assert(titles[0] === 'First', '初始标题没有通知宿主');
      },
    );
  });

  await test('生命周期：取消排队回调，恢复宿主，再次挂载', async () => {
    const oldClass = host.className;
    host.dataset.theme = 'dark';
    const changes: string[] = [];
    const editor = await mountEditor(host, {
      markdown: '原文\n',
      onChange: (value) => changes.push(value),
    });
    editor.setMarkdown('即将销毁\n');
    await editor.destroy();
    await editor.destroy();
    await delay(30);
    assert(
      changes.length === 0 &&
        !host.childNodes.length &&
        host.className === oldClass &&
        host.dataset.theme === 'dark',
      '销毁未清理排队任务或恢复容器',
    );
    await withEditor('再次挂载\n', {}, async (next) => {
      assert(next.getMarkdown().includes('再次挂载'), '无法重挂');
    });
    delete host.dataset.theme;
  });
  host.removeAttribute('style');
}
