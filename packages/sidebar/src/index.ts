import { mountEditor, type NoteEditor, type NoteReference } from '@local/milkdown-notes';
import { createFooter } from './artifact/footer.js';
import { countWords } from './artifact/markdown.js';
import { bindEditorModes } from './artifact/editor-modes.js';
import type { NotesEditorMode } from './artifact/types.js';
import type { MarkdownExportFormat } from './artifact/types.js';
import { download, safeName, exportHtml, printHtml } from './artifact/export.js';
import { template } from './template.js';
import type { SidebarOptions, NoteSidebar, SidebarPreferences } from './types.js';
export type { SidebarOptions, NoteSidebar, SidebarPreferences, NoteExport } from './types.js';
export type { MarkdownExportFormat } from './artifact/types.js';
export { createHttpFiles } from './files.js';
export type { NoteFiles, NoteDocument, NoteSummary } from './files.js';
import { setupMenu, setIcon } from './menu.js';
export async function mountSidebar(
  root: HTMLElement,
  options: SidebarOptions,
): Promise<NoteSidebar> {
  if (root.childNodes.length) throw Error('Sidebar host must be empty');
  root.classList.add('mn-sidebar');
  root.innerHTML = template('mn-sidebar-' + crypto.randomUUID());
  const $ = <T extends HTMLElement>(id: string) =>
    root.querySelector('[data-id="' + id + '"]') as T;
  const files = options.files;
  const events = new AbortController();
  let operations: Promise<unknown> = Promise.resolve();
  const serial = <T>(action: () => Promise<T>) => {
    const result = operations.then(action);
    operations = result.catch(() => {});
    return result;
  };
  const menu = setupMenu(root);
  const footer = createFooter($('statusbar-root'));
  const modes = bindEditorModes($('editor-pane'), $('editor'));
  const preference: Partial<SidebarPreferences> = options.preferences ?? {};
  let editorMode: NotesEditorMode = preference.mode ?? 'normal',
    outlineOpen = preference.outline === true,
    spellcheck = preference.spellcheck === true,
    sourceReveal = preference.source === true,
    statusText = '正在加载…';
  let editor: NoteEditor | undefined,
    id = '',
    notes: { id: string; title: string }[] = [],
    readOnly = false,
    theme: 'light' | 'dark' = preference.theme === 'dark' ? 'dark' : 'light',
    locale: 'zh-CN' | 'en' = 'zh-CN';
  let saveTask: Promise<void> | undefined,
    timer: ReturnType<typeof setTimeout> | undefined,
    dirty = false,
    revision = 0;
  const status = (text: string) => {
    statusText = text;
    $('status').textContent = text;
    renderFooter();
    const failed = text.startsWith('操作失败');
    $('menu-toggle').dataset.error = String(failed);
    $('menu-toggle').title = failed ? text : '笔记菜单';
  };
  const report = (error: unknown) => {
    status('操作失败：' + String(error));
    options.onError?.(error);
  };
  const perform = (action: () => Promise<unknown>) => {
    void serial(action).catch(report);
  };
  async function saveChanges() {
    status('正在保存…');
    while (dirty) {
      const ticket = revision;
      await files.write(id, editor!.getMarkdown());
      if (revision === ticket) dirty = false;
    }
    status('已保存');
    await refresh();
  }
  async function flush() {
    // Editor changes are batched into a microtask, including setMarkdown().
    await Promise.resolve();
    clearTimeout(timer);
    if (!saveTask && dirty)
      saveTask = saveChanges().finally(() => {
        saveTask = undefined;
      });
    await saveTask;
  }
  async function refresh() {
    notes = await files.list();
    const nav = $('notes');
    nav.replaceChildren();
    for (const note of notes) {
      const button = document.createElement('button');
      button.className = 'menu-item';
      const icon = document.createElement('span');
      icon.dataset.icon = 'file';
      setIcon(icon, 'file');
      const label = document.createElement('span');
      label.className = 'item-label';
      label.textContent = note.title;
      button.append(icon, label);
      button.title = note.title;
      button.setAttribute('aria-current', String(note.id === id));
      button.onclick = () => {
        menu.close();
        perform(() => open(note.id));
      };
      nav.append(button);
    }
  }
  const refs = (): NoteReference[] =>
    notes.map((n) => ({ id: n.id, label: n.title, kind: 'note' }));
  async function mount(markdown: string) {
    await editor?.destroy();
    editor = undefined;
    renderFooter();
    editor = await mountEditor($('editor'), {
      markdown,
      readOnly,
      theme,
      locale,
      spellcheck,
      sourceReveal,
      references: refs,
      aiProvider: options.aiProvider,
      onAIError: options.onAIError,
      onReference: (ref) => serial(() => open(ref.id)),
      onWikiLink: async (target) => {
        const found = notes.filter((n) => n.id === target || n.title === target);
        if (found.length !== 1)
          throw Error(found.length ? '同名笔记需要使用 ID' : '笔记不存在：' + target);
        await serial(() => open(found[0].id));
      },
      uploadImage: files.uploadImage ? (file) => files.uploadImage!(file) : undefined,
      resolveAsset: files.resolveAsset ? (source) => files.resolveAsset!(source) : undefined,
      onChange: (markdown) => {
        dirty = true;
        revision++;
        status('待保存…');
        clearTimeout(timer);
        timer = setTimeout(() => void flush().catch(report), 350);
        options.onChange?.({ id, markdown });
      },
    });
    updateOutline();
    modes.refresh();
    renderFooter();
  }
  async function open(next: string) {
    await flush();
    const note = await files.read(next);
    await flush();
    await mount(note.markdown);
    id = note.id;
    dirty = false;
    await refresh();
    status(readOnly ? '阅读模式' : '已保存');
  }
  async function create(markdown = '# 新笔记\n\n', title?: string) {
    await flush();
    const next = crypto.randomUUID();
    await files.write(next, markdown);
    if (title) await files.rename(next, title);
    await open(next);
    editor?.focus();
    return next;
  }
  $('new').onclick = () => {
    menu.close();
    perform(() => create());
  };
  $('undo').onclick = () => {
    menu.close();
    editor?.undo();
  };
  $('redo').onclick = () => {
    menu.close();
    editor?.redo();
  };
  $('preview').onclick = () => {
    menu.close();
    perform(async () => {
      if (!editor) return;
      await flush();
      const markdown = editor.getMarkdown();
      readOnly = !readOnly;
      $('preview').querySelector('.item-label')!.textContent = readOnly ? '返回编辑' : '阅读模式';
      setIcon($('preview').querySelector('[data-icon]')!, readOnly ? 'edit' : 'read');
      $<HTMLButtonElement>('undo').disabled = readOnly;
      $<HTMLButtonElement>('redo').disabled = readOnly;
      await mount(markdown);
      status(readOnly ? '阅读模式' : '已保存');
    });
  };
  function syncTheme() {
    root.dataset.theme = theme;
    editor?.setTheme(theme);
    $('theme-light').setAttribute('aria-pressed', String(theme === 'light'));
    $('theme-dark').setAttribute('aria-pressed', String(theme === 'dark'));
  }
  function selectTheme(next: 'light' | 'dark') {
    theme = next;
    syncTheme();
    savePreferences();
    renderFooter();
  }
  function toggleTheme() {
    selectTheme(theme === 'light' ? 'dark' : 'light');
  }
  $('theme-light').onclick = () => selectTheme('light');
  $('theme-dark').onclick = () => selectTheme('dark');
  for (const [button, next] of [
    ['locale-zh', 'zh-CN'],
    ['locale-en', 'en'],
  ] as const) {
    $(button).onclick = () =>
      perform(async () => {
        if (!editor) return;
        await flush();
        locale = next;
        await mount(editor.getMarkdown());
        $('locale-zh').setAttribute('aria-pressed', String(locale === 'zh-CN'));
        $('locale-en').setAttribute('aria-pressed', String(locale === 'en'));
      });
  }
  $('import').onclick = () => {
    menu.close();
    $<HTMLInputElement>('file').click();
  };
  $<HTMLInputElement>('file').onchange = () => {
    const input = $<HTMLInputElement>('file');
    const file = input.files?.[0];
    input.value = '';
    if (file) perform(() => importFile(file));
  };
  $('export').onclick = () => {
    menu.close();
    perform(() => exportDocument('markdown'));
  };
  function savePreferences() {
    options.onPreferencesChange?.({
      theme,
      mode: editorMode,
      outline: outlineOpen,
      spellcheck,
      source: sourceReveal,
    });
  }
  function updateOutline() {
    $('outline').hidden = !outlineOpen;
    const list = $('outline').querySelector('.outline-list')!;
    const headings = $('editor').querySelectorAll<HTMLElement>(
      '.ProseMirror h1,.ProseMirror h2,.ProseMirror h3,.ProseMirror h4,.ProseMirror h5,.ProseMirror h6',
    );
    list.replaceChildren();
    for (const heading of headings) {
      const button = document.createElement('button');
      button.className = 'outline-item outline-level-' + heading.tagName.slice(1);
      button.textContent = heading.textContent || '…';
      button.title = button.textContent;
      button.onclick = () =>
        heading.scrollIntoView({
          behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
          block: 'start',
        });
      list.append(button);
    }
    if (!headings.length) {
      const empty = document.createElement('div');
      empty.className = 'outline-empty';
      empty.textContent = locale === 'en' ? 'No headings yet' : '还没有标题';
      list.append(empty);
    }
    $('outline').querySelector('.outline-panel-title')!.textContent =
      locale === 'en' ? 'Outline' : '大纲';
  }
  function renderFooter() {
    const markdown = editor?.getMarkdown() ?? '';
    footer.render({
      ...countWords(markdown),
      status: statusText,
      locale: locale === 'en' ? 'en' : 'zh',
      spellcheckEnabled: spellcheck,
      ready: !!editor,
      outlineOpen,
      theme,
      editorMode,
      sourceRevealEnabled: sourceReveal,
      onToggleSpellcheck() {
        spellcheck = !spellcheck;
        editor?.setSpellcheck(spellcheck);
        savePreferences();
        renderFooter();
      },
      onToggleOutline() {
        outlineOpen = !outlineOpen;
        updateOutline();
        savePreferences();
        renderFooter();
      },
      onToggleTheme: toggleTheme,
      onSelectEditorMode(mode) {
        editorMode = mode;
        if (mode === 'focus') outlineOpen = false;
        updateOutline();
        modes.set(mode);
        savePreferences();
        renderFooter();
      },
      onToggleSourceReveal() {
        sourceReveal = !sourceReveal;
        editor?.setSourceReveal(sourceReveal);
        savePreferences();
        renderFooter();
      },
      onImportDocument: () => $<HTMLInputElement>('file').click(),
      onRenameDocument: renameDocument,
      onExportDocument: (format) => perform(() => exportDocument(format)),
    });
  }
  function renameDocument() {
    const dialog = $<HTMLDialogElement>('rename-dialog'),
      input = $<HTMLInputElement>('rename-name');
    input.value = notes.find((note) => note.id === id)?.title ?? 'note';
    input.setCustomValidity('');
    dialog.returnValue = '';
    dialog.showModal();
    input.select();
  }
  $<HTMLInputElement>('rename-name').oninput = () => {
    const input = $<HTMLInputElement>('rename-name');
    input.setCustomValidity(
      /[<>:"/\\|?*\x00-\x1f]/.test(input.value) || !input.value.trim() ? '请输入有效的文件名' : '',
    );
  };
  $('rename-dialog').addEventListener('close', () => {
    if ($<HTMLDialogElement>('rename-dialog').returnValue !== 'save') return;
    const noteId = id,
      title = $<HTMLInputElement>('rename-name').value.trim().replace(/\.md$/i, '');
    perform(async () => {
      await flush();
      await files.rename(noteId, title);
      await refresh();
      status('已重命名');
    });
  });
  async function importFile(file: File) {
    return create(await file.text(), safeName(file.name.replace(/\.markdown$/i, '')));
  }
  async function exportDocument(format: MarkdownExportFormat) {
    await flush();
    await editor!.settled();
    const title = notes.find((note) => note.id === id)?.title ?? 'note';
    const content =
      format === 'markdown'
        ? editor!.getMarkdown()
        : await exportHtml(
            $('editor'),
            title,
            options.exportStylesheets ?? [new URL('./style.css', import.meta.url).href],
          );
    const output = {
      format,
      name: safeName(title) + (format === 'markdown' ? '.md' : '.' + format),
      mimeType: format === 'markdown' ? 'text/markdown;charset=utf-8' : 'text/html;charset=utf-8',
      content,
    };
    if (options.onExport) await options.onExport(output);
    else if (format === 'pdf') {
      await printHtml(content);
      status('已请求打印，请选择另存为 PDF');
    } else download(content, output.mimeType, output.name);
    return output;
  }
  let outlineFrame = 0;
  const outlineObserver = new MutationObserver(() => {
    if (!outlineFrame)
      outlineFrame = requestAnimationFrame(() => {
        outlineFrame = 0;
        if (outlineOpen) updateOutline();
      });
  });
  outlineObserver.observe($('editor'), { subtree: true, childList: true, characterData: true });
  syncTheme();
  modes.set(editorMode);
  updateOutline();
  renderFooter();

  function updateBounds() {
    const box = root.getBoundingClientRect();
    root.dataset.compact = String(box.width <= 650);
    root.dataset.narrow = String(box.width <= 330);
    root.dataset.tiny = String(box.width <= 300);
    root.style.setProperty('--mn-sidebar-height', box.height + 'px');
    const bounds = $('editor-pane').getBoundingClientRect();
    $('editor').style.setProperty(
      '--mn-viewport-bottom',
      Math.max(0, innerHeight - bounds.bottom) + 'px',
    );
  }
  const resize = new ResizeObserver(updateBounds);
  resize.observe(root);
  updateBounds();
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden && dirty) void flush().catch(report);
    },
    { signal: events.signal },
  );
  async function release() {
    clearTimeout(timer);
    events.abort();
    outlineObserver.disconnect();
    resize.disconnect();
    cancelAnimationFrame(outlineFrame);
    menu.destroy();
    modes.destroy();
    footer.destroy();
    await editor?.destroy();
    root.replaceChildren();
    root.classList.remove('mn-sidebar');
    delete root.dataset.theme;
    delete root.dataset.compact;
    delete root.dataset.narrow;
    delete root.dataset.tiny;
    root.style.removeProperty('--mn-sidebar-height');
  }
  try {
    await refresh();
    if (!notes.length) await create();
    else await open(options.initialNoteId ?? notes[0].id);
  } catch (error) {
    await release();
    throw error;
  }
  return {
    get editor() {
      return editor!;
    },
    get documentId() {
      return id;
    },
    get dirty() {
      return dirty;
    },
    open: (next) => serial(() => open(next)),
    create: (markdown, title) => serial(() => create(markdown, title)),
    importFile: (file) => serial(() => importFile(file)),
    exportDocument: (format) => serial(() => exportDocument(format)),
    async rename(title) {
      await serial(async () => {
        await flush();
        await files.rename(id, title);
        await refresh();
      });
    },
    refresh,
    flush,
    setTheme: selectTheme,
    destroy: () =>
      serial(async () => {
        await flush();
        await release();
      }),
  };
}
