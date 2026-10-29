import { bindNoteAI, type NoteAI } from './ai.js';
import { registerLocale } from './locale.js';
import { createNoteSurface } from './note-surface.js';
import type { NoteEditingOptions } from './note-references.js';
import { editorViewCtx } from '@milkdown/core';
import { undo, redo, closeHistory } from '@milkdown/prose/history';
import { settleNoteDiagrams } from './note-extensions.js';
import { bindBlockSource } from './note-source.js';
export type { NoteReference } from './note-references.js';
export type { NoteAI } from './ai.js';
export type { AIProvider, AIPromptContext } from '@milkdown/crepe/feature/ai';

export type EditorOptions = NoteEditingOptions & {
  readOnly?: boolean;
  label?: string;
  highlights?: string[];
  onTitleChange?: (title: string) => void;
  markdown?: string;
  theme?: 'light' | 'dark';
  onChange?: (markdown: string) => void;
  sourceReveal?: boolean;
  spellcheck?: boolean;
};
export interface NoteEditor {
  readonly ai?: NoteAI;
  getMarkdown(): string;
  /** Replace the document as one undoable change. */
  setMarkdown(markdown: string): void;
  onChange(listener: (markdown: string) => void): () => void;
  focus(): void;
  undo(): boolean;
  redo(): boolean;
  setTheme(theme: 'light' | 'dark'): void;
  setSourceReveal(enabled: boolean): void;
  setSpellcheck(enabled: boolean): void;
  /** Resolves when diagrams requested by the current document finish. */
  settled(): Promise<void>;
  destroy(): Promise<void>;
}
/** Browser-only. Load style.css once. Use a dedicated empty host element. */
export async function mountEditor(
  host: HTMLElement,
  options: EditorOptions = {},
): Promise<NoteEditor> {
  if (host.childNodes.length) throw Error('Editor host must be empty');
  const releaseLocale = registerLocale(host, options);
  const originalClass = host.className,
    originalTheme = host.getAttribute('data-theme');
  const restoreHost = () => {
    host.replaceChildren();
    host.className = originalClass;
    delete host.dataset.readonly;
    if (originalTheme === null) delete host.dataset.theme;
    else host.dataset.theme = originalTheme;
    releaseLocale();
  };
  host.dataset.theme = options.theme ?? 'light';
  const listeners = new Set<(markdown: string) => void>();
  if (options.onChange) listeners.add(options.onChange);
  let disposed = false,
    queued = false;
  const emit = (read: () => string) => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      if (!disposed) {
        const value = read();
        for (const fn of listeners) fn(value);
      }
    });
  };
  let surface: Awaited<ReturnType<typeof createNoteSurface>>;
  try {
    surface = await createNoteSurface(host, options.markdown ?? '', emit, options);
  } catch (error) {
    restoreHost();
    throw error;
  }
  const source = bindBlockSource(host, surface.editor, options);
  const closeUndoGroup = () =>
    surface.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      view.dispatch(closeHistory(view.state.tr));
    });
  const command = (fn: typeof undo) => {
    if (options.readOnly) return false;
    return surface.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      return fn(view.state, view.dispatch);
    });
  };
  return {
    ai: options.aiProvider && !options.readOnly ? bindNoteAI(surface.editor) : undefined,
    getMarkdown() {
      return surface.markdown();
    },
    setMarkdown(value) {
      source.cancel();
      closeUndoGroup();
      surface.setMarkdown(value);
      closeUndoGroup();
    },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    focus() {
      surface.editor.action((ctx) => ctx.get(editorViewCtx).focus());
    },
    undo: () => command(undo),
    redo: () => command(redo),
    setTheme(theme) {
      host.dataset.theme = theme;
    },
    setSourceReveal(value) {
      source.setEnabled(value);
    },
    setSpellcheck(value) {
      source.setSpellcheck(value);
    },
    settled: () => settleNoteDiagrams(host),
    async destroy() {
      if (disposed) return;
      source.destroy();
      disposed = true;
      listeners.clear();
      try {
        await surface.destroy();
      } finally {
        restoreHost();
      }
    },
  };
}
/** Read-only uses exactly the same schema, node views and styles. */
export const renderMarkdown = (
  host: HTMLElement,
  markdown: string,
  options: Omit<EditorOptions, 'markdown' | 'readOnly'> = {},
) => mountEditor(host, { ...options, markdown, readOnly: true });
