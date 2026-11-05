import { noteReviewPlugin } from './review.js';
import { headingIdGenerator } from '@milkdown/preset-commonmark';
import { noteTableKeyboard } from './note-table.js';
import { configureNoteImages } from './note-image.js';
import { noteHtmlPlugins } from './note-html.js';
import {
  serializerCtx,
  parserCtx,
  editorViewCtx,
  editorViewOptionsCtx,
  remarkStringifyOptionsCtx,
} from '@milkdown/core';
import { $prose } from '@milkdown/utils';
import { Plugin } from '@milkdown/prose/state';
import { Decoration, DecorationSet } from '@milkdown/prose/view';
import type { Node as ProseNode } from '@milkdown/prose/model';
import { noteMathPlugins } from './note-math.js';
import { noteExtensionPlugins, bindNoteExtensions } from './note-extensions.js';
import { remarkGFMPlugin, strikethroughInputRule } from '@milkdown/preset-gfm';
import { editableNoteEditor, bindNoteUi } from './note-ui.js';
import type { NoteEditingOptions } from './note-references.js';
import { streamingPluginKey } from '@milkdown/plugin-streaming';
import { diffPluginKey } from '@milkdown/plugin-diff';
import { abortAICmd } from '@milkdown/crepe/feature/ai';
import { commandsCtx } from '@milkdown/core';
import { bindResponsiveEditor } from './note-responsive.js';

export type NoteSurfaceOptions = NoteEditingOptions & {
  readOnly?: boolean;
  label?: string;
  highlights?: string[];
  onTitleChange?: (title: string) => void;
};
function highlightDecorations(doc: ProseNode, highlights: string[]) {
  const positions: number[] = [];
  let text = '';
  const add = (character: string, position: number) => {
    if (/\s/.test(character)) {
      if (text.endsWith(' ')) return;
      character = ' ';
    }
    text += character;
    positions.push(position);
  };
  doc.descendants((node, position) => {
    if (node.isBlock && text) add(' ', -1);
    if (node.isText) for (let i = 0; i < node.text!.length; i++) add(node.text![i], position + i);
  });
  const decorations: Decoration[] = [];
  for (const value of [...new Set(highlights)]) {
    const query = value.replace(/\s+/g, ' ').trim();
    if (!query) continue;
    let offset = 0;
    while (offset < text.length) {
      const start = text.indexOf(query, offset);
      if (start < 0) break;
      const end = start + query.length,
        range = positions.slice(start, end),
        from = range.find((p) => p >= 0),
        to = range.reverse().find((p) => p >= 0);
      if (from !== undefined && to !== undefined)
        decorations.push(
          Decoration.inline(from, to + 1, { nodeName: 'mark', class: 'mn-evidence-highlight' }),
        );
      offset = end;
    }
  }
  return DecorationSet.create(doc, decorations);
}
export async function createNoteSurface(
  host: HTMLElement,
  markdown: string,
  onChange: (readMarkdown: () => string) => void,
  options: NoteSurfaceOptions = {},
) {
  host.classList.add('mn-note-surface', 'mn-markdown', 'mn-note-document');
  const headingPrefix = 'mn-heading-' + crypto.randomUUID() + '-';
  // Rendering is immediate; only a save or navigation needs the complete serialized document.
  let readMarkdown = () => markdown;
  host.dataset.readonly = String(!!options.readOnly);
  const busy = (state: import('@milkdown/prose/state').EditorState) =>
    !!(streamingPluginKey.getState(state)?.active || diffPluginKey.getState(state)?.active);
  let lastTitle: string | undefined;
  const titleChanged = (doc: ProseNode) => {
    if (!options.onTitleChange) return;
    let title: string | undefined;
    doc.forEach((node) => {
      if (title === undefined && node.type.name === 'heading' && node.attrs.level === 1)
        title = node.textContent.replace(/\s+/g, ' ').trim();
    });
    if (title !== undefined && title !== lastTitle) {
      lastTitle = title;
      options.onTitleChange(title);
    }
  };
  const notify = (doc: ProseNode) => {
    titleChanged(doc);
    onChange(() => readMarkdown());
  };
  const changes = $prose(
    () =>
      new Plugin({
        view: (view) => {
          let lastDoc = view.state.doc;
          const publish = () => {
            if (lastDoc.eq(view.state.doc)) return;
            lastDoc = view.state.doc;
            notify(lastDoc);
          };
          return {
            update: (view, previous) => {
              const phase = streamingPluginKey.getState(view.state)?.active ? 'streaming' : diffPluginKey.getState(view.state)?.active ? 'review' : 'idle';
              const oldPhase = streamingPluginKey.getState(previous)?.active ? 'streaming' : diffPluginKey.getState(previous)?.active ? 'review' : 'idle';
              if (phase !== oldPhase) options.onAIStateChange?.(phase);
              if (options.review) return;
              if (
                options.readOnly ||
                busy(view.state) ||
                (previous.doc.eq(view.state.doc) && !busy(previous))
              )
                return;
              if (busy(previous))
                queueMicrotask(() => {
                  if (!view.isDestroyed && !busy(view.state)) publish();
                });
              else publish();
            },
          };
        },
      }),
  );
  const evidence = $prose(
    () =>
      new Plugin({
        state: {
          init: (_, state) => highlightDecorations(state.doc, options.highlights ?? []),
          apply: (transaction, set) => set.map(transaction.mapping, transaction.doc),
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
  );
  const editor = editableNoteEditor(
    host,
    markdown,
    options.readOnly ? { ...options, aiProvider: undefined, references: undefined } : options,
  )
    .config((ctx) => {
      configureNoteImages(ctx);
      ctx.update(headingIdGenerator.key, (generate) => (node) => headingPrefix + generate(node));
      ctx.update(remarkGFMPlugin.options.key, (previous) => ({ ...previous, singleTilde: false }));
      // Milkdown's trailing-space shortcut bypasses escaping for our delimiters.
      ctx.update(remarkStringifyOptionsCtx, (previous) => ({
        ...previous,
        handlers: {
          ...previous.handlers,
          text: (node, _, state, info) =>
            state.safe(node.value, { ...info, encode: [] }).replace(/&#x20;$/, ' '),
        },
      }));
      ctx.update(editorViewOptionsCtx, (previous) => ({
        ...previous,
        editable: () => !options.readOnly,
        attributes: {
          'aria-label': options.label ?? (options.locale === 'en' ? 'Note content' : '笔记正文'),
          role: options.readOnly ? 'document' : 'textbox',
          ...(options.readOnly ? { 'aria-readonly': 'true' } : { 'aria-multiline': 'true' }),
        },
      }));
    })
    .use(changes)
    .use(noteMathPlugins)
    .use(noteExtensionPlugins(host))
    .use(noteHtmlPlugins)
    .use(noteTableKeyboard(options));
  if (options.review) editor.use($prose(ctx => noteReviewPlugin(ctx, options.review!, options.onReviewChoice ?? (() => {}), options.onReviewResult ?? (() => {}))));
  if (options.highlights?.length) editor.use(evidence);
  await editor.remove(strikethroughInputRule);
  await editor.create();
  editor.action((ctx) => titleChanged(ctx.get(editorViewCtx).state.doc));
  const uiCleanup = bindNoteUi(host, options, headingPrefix),
    extensionCleanup = bindNoteExtensions(host, options),
    responsiveCleanup = bindResponsiveEditor(host);
  const cleanup = () => {
    responsiveCleanup();
    uiCleanup();
    extensionCleanup();
  };
  let cachedDoc: unknown,
    cachedText = '';
  readMarkdown = () =>
    editor.action((ctx) => {
      const state = ctx.get(editorViewCtx).state,
        streaming = streamingPluginKey.getState(state),
        doc = streaming?.active ? streaming.originalDoc : state.doc;
      if (doc !== cachedDoc) {
        cachedText = ctx.get(serializerCtx)(doc);
        cachedDoc = doc;
      }
      return cachedText;
    });
  return {
    editor,
    setMarkdown: (value: string) => {
      if (readMarkdown() === value) return;
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx),
          doc = ctx.get(parserCtx)(value);
        view.dispatch(
          view.state.tr
            .replaceWith(0, view.state.doc.content.size, doc.content)
            .setMeta('addToHistory', !options.readOnly),
        );
      });
    },
    markdown: () => readMarkdown(),
    destroy: () => {
      if (options.aiProvider && !options.readOnly)
        editor.action((ctx) => ctx.get(commandsCtx).call(abortAICmd.key, { keep: false }));
      cleanup();
      // Stop DOM observers before Milkdown removes feature contexts.
      editor.action((ctx) => ctx.get(editorViewCtx).destroy());
      return editor.destroy();
    },
  };
}
