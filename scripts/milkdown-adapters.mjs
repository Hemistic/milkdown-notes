import { readFile } from 'node:fs/promises';

async function patchFile(path, modify) {
  let source = await readFile(path, 'utf8');
  function replace(before, after, occurrences = 1) {
    const actual = source.split(before).length - 1;
    if (actual !== occurrences)
      throw Error(
        'Milkdown adapter needs review: expected ' +
          occurrences +
          ' matches, found ' +
          actual +
          ' for ' +
          before.slice(0, 80),
      );
    source = source.replaceAll(before, after);
  }
  modify(replace);
  return { contents: source, loader: 'js' };
}

// Crepe 7.22.3 has no public hook for inline slash queries. Extend its two
// integration points at build time, retaining the upstream menu, commands and
// block handle. Each replacement verifies its own upstream anchor.
export const milkdownSlashPlugin = () => ({
  name: 'milkdown-notes-adapters',
  setup(build) {
    build.onLoad(
      { filter: /[\\/]@milkdown[\\/]plugin-tooltip[\\/]lib[\\/]index\.js$/ },
      ({ path }) =>
        patchFile(path, (replace) => {
          // Floating UI awaits layout; snapshot the selection before the view can be destroyed.
          replace(
            'computePosition(reference, this.element, {',
            'const rect = reference.getBoundingClientRect();\n\t\t\tcomputePosition({ ...reference, getBoundingClientRect: () => rect }, this.element, {',
          );
        }),
    );
    build.onLoad(
      { filter: /[\\/]@milkdown[\\/]crepe[\\/]lib[\\/]esm[\\/]feature[\\/]ai[\\/]index\.js$/ },
      ({ path }) =>
        patchFile(path, (replace) => {
          const anchor = '} finally {\n    const current = ctx.get(aiSessionCtx.key);';
          // A cancelled async iterator may settle after destroy has removed its context.
          replace(
            anchor,
            '} finally {\n    if (!ctx.isInjected(aiSessionCtx.key)) return;\n    const current = ctx.get(aiSessionCtx.key);',
          );
          const placement = 'floatingUIOptions: {\n        placement: "bottom"';
          replace(
            placement,
            `floatingUIOptions: {
        strategy: "fixed",
        middleware: [{name: "noteAIViewport", fn: ({x,y,rects,elements}) => {
          const host = elements.floating.closest('.mn-note-surface')?.getBoundingClientRect();
          const left = Math.max(8, (host?.left ?? 0) + 8);
          const right = Math.min(document.documentElement.clientWidth - 8, (host?.right ?? innerWidth) - 8);
          return {x: Math.max(left, Math.min(x, right - rects.floating.width)), y: Math.max(8, Math.min(y, innerHeight - rects.floating.height - 8))};
        }}],
        placement: "bottom"`,
          );
        }),
    );
    build.onLoad(
      { filter: /[\\/]@milkdown[\\/]components[\\/]lib[\\/]table-block[\\/]index\.js$/ },
      ({ path }) =>
        patchFile(path, (replace) => {
          const down = 'onPointerdown: (e) => e.stopPropagation(),';
          const unchanged =
              'if (node.sameMarkup(this.node) && node.content.eq(this.node.content))\n      return false;',
            cellClick =
              'return __privateMethod(this, _TableNodeView_instances, handleClick_fn).call(this, event);';
          // Selection-only transactions must retain the node view. Let ProseMirror's
          // native table editing put a text caret where the user actually clicked.
          replace(unchanged, unchanged.replace('return false', 'return true'));
          replace(cellClick, 'return false;');
          const stopHandle =
            'if (e.target instanceof Element && e.target.closest("button")) return true;';
          // Handles are outside contentDOM. Native mousedown must not move the document
          // caret to the heading above the table and cancel an active column drag.
          replace(
            stopHandle,
            'if (e.target instanceof Element && e.target.closest("button, [data-role$=drag-handle]")) return true;',
          );
          const previewClass = 'class: "drag-preview",';
          replace(previewClass, previewClass + ' contenteditable: "false",');
          const dragOver = 'const onDragOver = createDragOverHandler(refs);',
            drop = 'const onDrop = () => {';
          replace(
            dragOver,
            `const updateDragOver = createDragOverHandler(refs);
  const onDragOver = (event) => {
    if (dragPreviewRef.value?.dataset.show !== 'true') return;
    const bounds = refs.contentWrapperRef.value?.getBoundingClientRect();
    if (!bounds || event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    updateDragOver(event);
  };`,
          );
          replace(
            drop,
            `const onDrop = (event) => {
    updateDragOver.flush();
    const bounds = refs.contentWrapperRef.value?.getBoundingClientRect();
    if (!bounds || event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) return;
    if (dragPreviewRef.value?.dataset.show !== 'true') return;
    event.preventDefault();
    event.stopPropagation();`,
          );
          // The editor contains drag events so they cannot move its host.
          // Upstream table DnD listens on window; capture keeps its own drops reachable.
          for (const [event, handler] of [
            ['dragover', 'onDragOver'],
            ['dragend', 'onDragEnd'],
            ['drop', 'onDrop'],
          ])
            for (const action of ['add', 'remove']) {
              const call = `window.${action}EventListener("${event}", ${handler});`;
              replace(call, `window.${action}EventListener("${event}", ${handler}, true);`);
            }
          const handleMove = 'onPointermove: (e) => e.stopPropagation(),\n            ref:';
          replace(
            handleMove,
            'onPointermove: (e) => { pointerMove.cancel(); e.stopPropagation(); },\n            ref:',
            4,
          );
          // A trailing throttled cell-hover event used to close the menu immediately
          // after opening it. Keep the existing upstream operations and popover.
          replace(down, 'onPointerdown: (e) => { pointerMove.cancel(); e.stopPropagation(); },', 2);
          const pointerStart =
            'function createPointerMoveHandler(refs, view) {\n  return throttle((e) => {';
          replace(
            pointerStart,
            pointerStart + '\n    if (refs.dragPreviewRef.value?.dataset.show === "true") return;',
          );
          const leave =
            '      rowHandle.dataset.show = "false";\n      colHandle.dataset.show = "false";\n      yHandle.dataset.show = "false";';
          replace(
            leave,
            '      if (refs.dragPreviewRef.value?.dataset.show === "true") return;\n      if (rowHandle.matches(":hover") || colHandle.matches(":hover")) return;\n' +
              leave,
          );
        }),
    );
    // Keep Milkdown's image schema, resize handle and history, but measure in
    // document coordinates, including hosts with CSS transforms.
    build.onLoad(
      { filter: /[\\/]@milkdown[\\/]components[\\/]lib[\\/]image-block[\\/]index\.js$/ },
      ({ path }) =>
        patchFile(path, (replace) => {
          // Carry the schema's real alt through the upstream Vue view (never the ratio).
          replace(
            'const caption = ref(initialNode.attrs.caption);',
            'const caption = ref(initialNode.attrs.caption); const alt = ref(initialNode.attrs.alt || "");',
          );
          replace(
            '        caption,\n        ratio,',
            '        caption,\n        alt,\n        ratio,',
          );
          replace(
            'caption.value = node.attrs.caption;',
            'caption.value = node.attrs.caption; alt.value = node.attrs.alt || "";',
          );
          const ratioProp = '    ratio: {\n      type: Object,\n      required: true\n    },';
          replace(ratioProp, '    alt: { type: Object, required: true },\n' + ratioProp, 2);
          replace(
            'setup({ src, caption, ratio, readonly, setAttr, config })',
            'setup({ src, caption, alt, ratio, readonly, setAttr, config })',
          );
          replace('alt: caption.value,', 'alt: alt.value || caption.value,');
          replace('class: "caption-input",', 'class: "caption-input", readOnly: readonly.value,');
          replace(
            'let maxWidth = host.getBoundingClientRect().width;',
            'let maxWidth = host.clientWidth;',
          );
          replace(
            'const h2 = (transformedHeight * ((_a2 = ratio.value) != null ? _a2 : 1)).toFixed(2);',
            'const h2 = Math.min(maxWidth * height / width, transformedHeight * ((_a2 = ratio.value) != null ? _a2 : 1)).toFixed(2);',
          );
          replace(
            'const onResizeHandlePointerMove = (e) => {',
            'let resizeStart;\n    const onResizeHandlePointerMove = (e) => {',
          );
          replace(
            'const top = image.getBoundingClientRect().top;\n      let height = e.clientY - top;\n      if (height < 100) height = 100;',
            `if (!resizeStart) return;
      const host = image.closest('.milkdown-image-block');
      const maxHeight = Math.min(host.clientWidth, config.maxWidth || Infinity) * image.naturalHeight / image.naturalWidth;
      let height = Math.max(24, Math.min(maxHeight, resizeStart.height + (e.clientY - resizeStart.y) / resizeStart.scale));`,
          );
          replace(
            'window.removeEventListener("pointerup", onResizeHandlePointerUp);',
            'window.removeEventListener("pointerup", onResizeHandlePointerUp);\n      window.removeEventListener("pointercancel", onResizeHandlePointerUp);\n      resizeStart = undefined;',
          );
          replace(
            'window.addEventListener("pointermove", onResizeHandlePointerMove);',
            `const image = imageRef.value;
      if (!image) return;
      const host = image.closest('.milkdown-image-block');
      image.dataset.origin = Math.min(image.naturalHeight, Math.min(host.clientWidth, config.maxWidth || Infinity) * image.naturalHeight / image.naturalWidth, config.maxHeight || Infinity).toFixed(2);
      const height = image.offsetHeight;
      resizeStart = {y: e.clientY, height, scale: image.getBoundingClientRect().height / height || 1};
      window.addEventListener("pointercancel", onResizeHandlePointerUp);
      window.addEventListener("pointermove", onResizeHandlePointerMove);`,
          );
          const size = 'image.style.height = `${h2}px`;';
          // Width plus auto height also responds to later card-width changes, without
          // leaving a tall letterboxed image when max-width clamps the picture.
          replace(
            size,
            'image.style.width = `${Number(h2) * image.naturalWidth / image.naturalHeight}px`; image.style.height = "auto";',
            2,
          );
        }),
    );
    build.onLoad(
      {
        filter:
          /[\\/]@milkdown[\\/]crepe[\\/]lib[\\/]esm[\\/]feature[\\/]block-edit[\\/]index\.js$/,
      },
      ({ path }) =>
        patchFile(path, (replace) => {
          const match = '      shouldShow(view2) {',
            clear = 'commands.call(clearTextInCurrentBlockCommand.key);';
          replace(
            match,
            match +
              `
        if (slashMenuOptions.getQuery && __privateGet$1(self, _programmaticallyPos) == null) {
          const query = slashMenuOptions.getQuery(view2);
          if (query == null) return false;
          filter.value = query;
          return true;
        }`,
          );
          replace(
            clear,
            'if (config?.slashMenu?.clearTrigger) config.slashMenu.clearTrigger(ctx); else ' +
              clear,
            16,
          );
        }),
    );
  },
});
