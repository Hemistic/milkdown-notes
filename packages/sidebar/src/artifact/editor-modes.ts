import type { NotesEditorMode } from './types';

// Adapted from ArtInFact App.tsx: retain the current top-level block while
// toolbar buttons have focus, dim outside its bounds, and center the caret at 48%.
export function bindEditorModes(pane: HTMLElement, host: HTMLElement) {
  let mode: NotesEditorMode = 'normal',
    activeBlock: HTMLElement | null = null,
    frame = 0;
  const masks = [document.createElement('div'), document.createElement('div')];
  masks.forEach((mask) => {
    mask.className = 'focus-dimmer';
    mask.hidden = true;
    mask.setAttribute('aria-hidden', 'true');
    pane.parentElement!.parentElement!.append(mask);
  });
  function blockFor(node: Node | null, pm: Element | null) {
    let el = node instanceof HTMLElement ? node : (node?.parentElement ?? null);
    while (el?.parentElement && el.parentElement !== pm) el = el.parentElement;
    return el?.parentElement === pm && !el.classList.contains('prosemirror-virtual-cursor')
      ? el
      : null;
  }
  function update() {
    frame = 0;
    if (mode === 'normal') return;
    const selection = getSelection(),
      pm = host.querySelector('.ProseMirror');
    const selected = blockFor(selection?.anchorNode ?? null, pm);
    if (selected) activeBlock = selected;
    if (!activeBlock?.isConnected)
      activeBlock =
        pm?.querySelector<HTMLElement>(
          ':scope > :not(.ProseMirror-widget):not(.prosemirror-virtual-cursor)',
        ) ?? null;
    masks.forEach((mask) => (mask.hidden = mode !== 'focus' || !activeBlock));
    const bounds = pane.getBoundingClientRect();
    if (mode === 'focus' && activeBlock) {
      const block = activeBlock.getBoundingClientRect();
      const top = Math.min(bounds.bottom, Math.max(bounds.top, block.top - 8)),
        bottom = Math.max(bounds.top, Math.min(bounds.bottom, block.bottom + 8));
      const ranges = [
        [bounds.top, top - bounds.top],
        [bottom, bounds.bottom - bottom],
      ];
      masks.forEach((mask, i) =>
        Object.assign(mask.style, {
          left: bounds.left + 'px',
          width: bounds.width + 'px',
          top: ranges[i][0] + 'px',
          height: ranges[i][1] + 'px',
        }),
      );
    }
    if (
      mode === 'typewriter' &&
      selection?.isCollapsed &&
      selection.rangeCount &&
      pm?.contains(selection.anchorNode)
    ) {
      const range = selection.getRangeAt(0).cloneRange();
      range.collapse(true);
      let rect: DOMRect | undefined = range.getClientRects()[0] || range.getBoundingClientRect();
      if (!rect.height)
        rect =
          pane.querySelector('.prosemirror-virtual-cursor')?.getBoundingClientRect() ||
          activeBlock?.getBoundingClientRect();
      if (rect) {
        const offset = rect.top - (bounds.top + pane.clientHeight * 0.48);
        if (Math.abs(offset) > 2) pane.scrollTop += offset;
      }
    }
  }
  const schedule = () => {
    if (mode !== 'normal' && !frame) frame = requestAnimationFrame(update);
  };
  document.addEventListener('selectionchange', schedule);
  // Scrolling only refreshes focus masks, never fights deliberate user scrolling.
  const scroll = () => {
    if (mode === 'focus') schedule();
  };
  pane.addEventListener('scroll', scroll);
  window.addEventListener('resize', schedule);
  const observer = new MutationObserver(schedule);
  observer.observe(host, { childList: true, characterData: true, subtree: true });
  return {
    set(value: NotesEditorMode) {
      mode = value;
      pane.parentElement!.dataset.mode = value;
      masks.forEach((mask) => (mask.hidden = true));
      schedule();
    },
    destroy() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('selectionchange', schedule);
      pane.removeEventListener('scroll', scroll);
      window.removeEventListener('resize', schedule);
      masks.forEach((mask) => mask.remove());
    },
  };
}
