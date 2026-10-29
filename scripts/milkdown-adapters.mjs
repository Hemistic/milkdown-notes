import { readFile } from 'node:fs/promises';

// Crepe 7.22.3 has no public hook for inline slash queries. Extend its two
// integration points at build time, retaining the upstream menu, commands and
// block handle. Fail closed if the upstream module changes.
export const milkdownSlashPlugin = () => ({
  name: 'milkdown-notes-adapters',
  setup(build) {
    build.onLoad(
      { filter: /[\\/]@milkdown[\\/]crepe[\\/]lib[\\/]esm[\\/]feature[\\/]ai[\\/]index\.js$/ },
      async ({ path }) => {
        let contents = await readFile(path, 'utf8');
        const anchor = '} finally {\n    const current = ctx.get(aiSessionCtx.key);';
        if (contents.split(anchor).length !== 2)
          throw Error('Milkdown AI disposal adapter needs review');
        // A cancelled async iterator may settle after destroy has removed its context.
        contents = contents.replace(
          anchor,
          '} finally {\n    if (!ctx.isInjected(aiSessionCtx.key)) return;\n    const current = ctx.get(aiSessionCtx.key);',
        );
        const placement = 'floatingUIOptions: {\n        placement: "bottom"';
        if (contents.split(placement).length !== 2)
          throw Error('Milkdown AI floating layout adapter needs review');
        contents = contents.replace(
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
        return { contents, loader: 'js' };
      },
    );
    build.onLoad(
      { filter: /[\\/]@milkdown[\\/]components[\\/]lib[\\/]table-block[\\/]index\.js$/ },
      async ({ path }) => {
        let contents = await readFile(path, 'utf8');
        const down = 'onPointerdown: (e) => e.stopPropagation(),';
        const unchanged =
            'if (node.sameMarkup(this.node) && node.content.eq(this.node.content))\n      return false;',
          cellClick =
            'return __privateMethod(this, _TableNodeView_instances, handleClick_fn).call(this, event);';
        if (contents.split(unchanged).length !== 2 || contents.split(cellClick).length !== 2)
          throw Error('Milkdown table selection adapter needs review');
        // Selection-only transactions must retain the node view. Let ProseMirror's
        // native table editing put a text caret where the user actually clicked.
        contents = contents
          .replace(unchanged, unchanged.replace('return false', 'return true'))
          .replace(cellClick, 'return false;');
        const stopHandle =
          'if (e.target instanceof Element && e.target.closest("button")) return true;';
        if (contents.split(stopHandle).length !== 2)
          throw Error('Milkdown table handle selection guard needs review');
        // Handles are outside contentDOM. Native mousedown must not move the document
        // caret to the heading above the table and cancel an active column drag.
        contents = contents.replace(
          stopHandle,
          'if (e.target instanceof Element && e.target.closest("button, [data-role$=drag-handle]")) return true;',
        );
        const previewClass = 'class: "drag-preview",';
        if (contents.split(previewClass).length !== 2)
          throw Error('Milkdown table preview isolation needs review');
        contents = contents.replace(previewClass, previewClass + ' contenteditable: "false",');
        const dragOver = 'const onDragOver = createDragOverHandler(refs);',
          drop = 'const onDrop = () => {';
        if (contents.split(dragOver).length !== 2 || contents.split(drop).length !== 2)
          throw Error('Milkdown table drop adapter needs review');
        contents = contents.replace(
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
        contents = contents.replace(
          drop,
          `const onDrop = (event) => {
    updateDragOver.flush();
    const bounds = refs.contentWrapperRef.value?.getBoundingClientRect();
    if (!bounds || event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) return;
    if (dragPreviewRef.value?.dataset.show !== 'true') return;
    event.preventDefault();
    event.stopPropagation();`,
        );
        // The card contains drag events so they cannot move the whiteboard itself.
        // Upstream table DnD listens on window; capture keeps its own drops reachable.
        for (const [event, handler] of [
          ['dragover', 'onDragOver'],
          ['dragend', 'onDragEnd'],
          ['drop', 'onDrop'],
        ])
          for (const action of ['add', 'remove']) {
            const call = `window.${action}EventListener("${event}", ${handler});`;
            if (contents.split(call).length !== 2)
              throw Error('Milkdown table drag adapter needs review');
            contents = contents.replace(
              call,
              `window.${action}EventListener("${event}", ${handler}, true);`,
            );
          }
        if (contents.split(down).length !== 3) throw Error('Milkdown table adapter needs review');
        const handleMove = 'onPointermove: (e) => e.stopPropagation(),\n            ref:';
        if (contents.split(handleMove).length !== 5)
          throw Error('Milkdown table handle hover needs review');
        contents = contents.replaceAll(
          handleMove,
          'onPointermove: (e) => { pointerMove.cancel(); e.stopPropagation(); },\n            ref:',
        );
        // A trailing throttled cell-hover event used to close the menu immediately
        // after opening it. Keep the existing upstream operations and popover.
        contents = contents.replaceAll(
          down,
          'onPointerdown: (e) => { pointerMove.cancel(); e.stopPropagation(); },',
        );
        const pointerStart =
          'function createPointerMoveHandler(refs, view) {\n  return throttle((e) => {';
        if (contents.split(pointerStart).length !== 2)
          throw Error('Milkdown table active drag guard needs review');
        contents = contents.replace(
          pointerStart,
          pointerStart + '\n    if (refs.dragPreviewRef.value?.dataset.show === "true") return;',
        );
        const leave =
          '      rowHandle.dataset.show = "false";\n      colHandle.dataset.show = "false";\n      yHandle.dataset.show = "false";';
        if (contents.split(leave).length !== 2)
          throw Error('Milkdown table leave adapter needs review');
        contents = contents.replace(
          leave,
          '      if (refs.dragPreviewRef.value?.dataset.show === "true") return;\n      if (rowHandle.matches(":hover") || colHandle.matches(":hover")) return;\n' +
            leave,
        );
        return { contents, loader: 'js' };
      },
    );
    // Keep Milkdown's image schema, resize handle and history, but measure in
    // document coordinates: the card can be transformed by the whiteboard zoom.
    build.onLoad(
      { filter: /[\\/]@milkdown[\\/]components[\\/]lib[\\/]image-block[\\/]index\.js$/ },
      async ({ path }) => {
        let contents = await readFile(path, 'utf8');
        const replace = (from, to) => {
          if (contents.split(from).length !== 2) throw Error('Milkdown image adapter needs review');
          contents = contents.replace(from, to);
        };
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
        if (contents.split(ratioProp).length !== 3)
          throw Error('Milkdown image alt props need review');
        contents = contents.replaceAll(
          ratioProp,
          '    alt: { type: Object, required: true },\n' + ratioProp,
        );
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
        if (contents.split(size).length !== 3)
          throw Error('Milkdown image dimensions adapter needs review');
        // Width plus auto height also responds to later card-width changes, without
        // leaving a tall letterboxed image when max-width clamps the picture.
        contents = contents.replaceAll(
          size,
          'image.style.width = `${Number(h2) * image.naturalWidth / image.naturalHeight}px`; image.style.height = "auto";',
        );
        return { contents, loader: 'js' };
      },
    );
    build.onLoad(
      {
        filter:
          /[\\/]@milkdown[\\/]crepe[\\/]lib[\\/]esm[\\/]feature[\\/]block-edit[\\/]index\.js$/,
      },
      async ({ path }) => {
        let contents = await readFile(path, 'utf8');
        const match = '      shouldShow(view2) {',
          clear = 'commands.call(clearTextInCurrentBlockCommand.key);';
        if (contents.split(match).length !== 2 || contents.split(clear).length !== 17)
          throw Error('Milkdown slash adapter needs review for this dependency version');
        contents = contents.replace(
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
        contents = contents.replaceAll(
          clear,
          'if (config?.slashMenu?.clearTrigger) config.slashMenu.clearTrigger(ctx); else ' + clear,
        );
        return { contents, loader: 'js' };
      },
    );
  },
});
