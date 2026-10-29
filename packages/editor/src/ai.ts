import { commandsCtx, editorViewCtx, type Editor } from '@milkdown/core';
import { AllSelection } from '@milkdown/prose/state';
import { runAICmd, abortAICmd } from '@milkdown/crepe/feature/ai';
import { streamingPluginKey } from '@milkdown/plugin-streaming';
import {
  diffPluginKey,
  getPendingChanges,
  acceptAllDiffsCmd,
  clearDiffReviewCmd,
} from '@milkdown/plugin-diff';

export interface NoteAI {
  /** Uses the current selection by default. Returns false while busy or without a selection. */
  run(instruction: string, scope?: 'selection' | 'document'): boolean;
  /** keep=true finishes the partial result into diff review; false restores the original. */
  abort(keep?: boolean): boolean;
  accept(): boolean;
  reject(): boolean;
  getState(): { status: 'idle' | 'streaming' | 'review'; pendingChanges: number };
}

export function bindNoteAI(editor: Editor): NoteAI {
  return {
    run(instruction, scope = 'selection') {
      return editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        if (
          streamingPluginKey.getState(view.state)?.active ||
          diffPluginKey.getState(view.state)?.active
        )
          return false;
        if (scope === 'document')
          view.dispatch(view.state.tr.setSelection(new AllSelection(view.state.doc)));
        return ctx.get(commandsCtx).call(runAICmd.key, { instruction });
      });
    },
    abort: (keep = false) =>
      editor.action((ctx) => ctx.get(commandsCtx).call(abortAICmd.key, { keep })),
    accept: () => editor.action((ctx) => ctx.get(commandsCtx).call(acceptAllDiffsCmd.key)),
    reject: () => editor.action((ctx) => ctx.get(commandsCtx).call(clearDiffReviewCmd.key)),
    getState() {
      return editor.action((ctx) => {
        const state = ctx.get(editorViewCtx).state;
        const diff = diffPluginKey.getState(state);
        return {
          status: streamingPluginKey.getState(state)?.active
            ? 'streaming'
            : diff?.active
              ? 'review'
              : 'idle',
          pendingChanges: diff?.active ? getPendingChanges(diff).length : 0,
        };
      });
    },
  };
}
