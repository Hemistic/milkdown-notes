import { editorViewCtx, parserCtx, serializerCtx, type Editor } from '@milkdown/core';
import { closeHistory } from '@milkdown/prose/history';
import type { Node as ProseNode } from '@milkdown/prose/model';
import { diffPluginKey } from '@milkdown/plugin-diff';
import { streamingPluginKey } from '@milkdown/plugin-streaming';

/** ArtInFact Editor.tsx block-source flow, adapted to a disposable vanilla host.
 * Serialize a document-wrapped top-level node; commit one block transaction.
 * Escape cancels, blur/Ctrl+Enter/Ctrl+S applies, triple-click preserves normal selection.
 */
export function bindBlockSource(
  host: HTMLElement,
  editor: Editor,
  options: { readOnly?: boolean; locale?: string; sourceReveal?: boolean; spellcheck?: boolean },
) {
  let enabled = options.sourceReveal ?? false,
    spellcheck = options.spellcheck ?? false;
  let active:
    | {
        area: HTMLTextAreaElement;
        block: HTMLElement;
        style: HTMLStyleElement;
        position: number;
        node: ProseNode;
        original: string;
      }
    | undefined;
  const token = 'source-' + crypto.randomUUID();
  function dismiss(commit = false, focus = false) {
    const current = active;
    if (!current) return;
    active = undefined;
    current.style.remove();
    delete host.dataset.mnSourceId;
    current.area.remove();
    if (commit && !options.readOnly && current.area.value !== current.original)
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        // Never replace an unrelated block if an external edit changed this document.
        if (view.state.doc.nodeAt(current.position) !== current.node) return;
        const parsed = ctx.get(parserCtx)(current.area.value);
        const replacement = parsed.content.size
          ? parsed.content
          : view.state.schema.nodes.paragraph.createAndFill();
        if (replacement) {
          view.dispatch(
            closeHistory(view.state.tr)
              .replaceWith(current.position, current.position + current.node.nodeSize, replacement)
              .scrollIntoView(),
          );
          view.dispatch(closeHistory(view.state.tr));
        }
      });
    if (focus) editor.action((ctx) => ctx.get(editorViewCtx).focus());
  }
  function resize() {
    if (!active) return;
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx),
        node = view.nodeDOM(active!.position);
      if (node instanceof HTMLElement) active!.block = node;
    });
    const { area, block, style } = active;
    if (!block.isConnected) return;
    const rect = block.getBoundingClientRect(),
      scope = host.getBoundingClientRect();
    area.style.top = rect.top - scope.top + host.scrollTop + 'px';
    area.style.left = rect.left - scope.left + 'px';
    area.style.width = rect.width + 'px';
    area.style.height = '32px';
    const height = Math.max(32, area.scrollHeight);
    area.style.height = height + 'px';
    const index = Array.from(block.parentElement!.children).indexOf(block) + 1;
    // Keep presentation outside ProseMirror-owned DOM. Mutating its nodes'
    // attributes can cause the DOM observer to replace the active block.
    const rule = `[data-mn-source-id="${token}"] .ProseMirror > :nth-child(${index}){visibility:hidden!important;pointer-events:none!important;height:${height}px!important;min-height:0!important;margin-block:0!important;overflow:hidden!important}`;
    if (style.textContent !== rule) style.textContent = rule;
  }
  const click = (event: MouseEvent) => {
    if (!enabled || event.detail !== 3 || active) return;
    const target = event.target instanceof Element ? event.target : null;
    if (
      !target ||
      target.closest('a,button,input,textarea,.milkdown-toolbar,.milkdown-link-edit,.tools')
    )
      return;
    const pm = host.querySelector('.ProseMirror');
    let block = target as HTMLElement;
    if (!pm?.contains(block)) return;
    while (block.parentElement && block.parentElement !== pm) block = block.parentElement;
    if (block.parentElement !== pm || block.classList.contains('ProseMirror-widget')) return;
    event.preventDefault();
    event.stopPropagation();
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      if (
        streamingPluginKey.getState(view.state)?.active ||
        diffPluginKey.getState(view.state)?.active
      )
        return;
      const pos = view.posAtDOM(block, 0);
      const resolved = view.state.doc.resolve(pos);
      const index = resolved.index(0);
      const node = view.state.doc.child(index);
      let position = 0;
      for (let i = 0; i < index; i++) position += view.state.doc.child(i).nodeSize;
      const original = ctx
        .get(serializerCtx)(view.state.schema.topNodeType.create(null, [node]))
        .replace(/\n+$/u, '');
      const area = document.createElement('textarea'),
        style = document.createElement('style');
      style.dataset.mnSource = token;
      area.className = 'mn-block-source';
      area.value = original;
      area.readOnly = !!options.readOnly;
      area.spellcheck = spellcheck;
      area.setAttribute(
        'aria-label',
        options.locale === 'en'
          ? 'Markdown source for the current block'
          : '当前块的 Markdown 源码',
      );
      active = { area, style, block, position, node, original };
      host.dataset.mnSourceId = token;
      document.head.append(style);
      host.append(area);
      resize();
      area.addEventListener('input', resize);
      area.addEventListener('blur', () => dismiss(true));
      area.addEventListener('keydown', (event) => {
        if (event.isComposing) return;
        if (event.key === 'Escape') {
          event.preventDefault();
          dismiss(false, true);
        } else if (
          (event.ctrlKey || event.metaKey) &&
          (event.key === 'Enter' || event.key.toLowerCase() === 's')
        ) {
          event.preventDefault();
          dismiss(true, true);
        }
      });
      area.focus();
      area.setSelectionRange(area.value.length, area.value.length);
      resize();
    });
  };
  host.addEventListener('click', click, true);
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  const domObserver = new MutationObserver(resize);
  const pm = host.querySelector('.ProseMirror');
  if (pm) domObserver.observe(pm, { childList: true, subtree: true });
  const setSpellcheck = (value: boolean) => {
    spellcheck = value;
    host
      .querySelectorAll<HTMLElement>('[contenteditable],textarea')
      .forEach((node) => (node.spellcheck = value));
  };
  setSpellcheck(spellcheck);
  return {
    setEnabled(value: boolean) {
      enabled = value;
      if (!value) dismiss();
    },
    setSpellcheck,
    cancel() {
      dismiss();
    },
    destroy() {
      dismiss();
      observer.disconnect();
      domObserver.disconnect();
      host.removeEventListener('click', click, true);
    },
  };
}
