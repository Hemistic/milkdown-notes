import {registerLocale} from './locale.js';
import {createNoteSurface} from './note-surface.js';
import type {NoteEditingOptions} from './note-references.js';
import {editorViewCtx} from '@milkdown/core';
import {undo, redo, closeHistory} from '@milkdown/prose/history';
import {settleNoteDiagrams} from './note-extensions.js';
export type {NoteReference} from './note-references.js';
export type {AIProvider} from '@milkdown/crepe/feature/ai';

export type EditorOptions = Omit<NoteEditingOptions, 'menuToolbar'> & {
  readOnly?: boolean;
  label?: string;
  highlights?: string[];
  onTitleChange?: (title:string)=>void;
  markdown?: string;
  theme?: 'light'|'dark';
  onChange?: (markdown: string) => void;
};
export interface NoteEditor {
  getMarkdown(): string;
  /** Replace the document as one undoable change. */
  setMarkdown(markdown: string): void;
  onChange(listener: (markdown: string) => void): () => void;
  focus(): void;
  undo(): boolean;
  redo(): boolean;
  setTheme(theme: 'light'|'dark'): void;
  /** Resolves when diagrams requested by the current document finish. */
  settled(): Promise<void>;
  destroy(): Promise<void>;
}
const mounted = new WeakSet<HTMLElement>();
/** Browser-only. Load style.css once. Use a dedicated empty host element. */
export async function mountEditor(host: HTMLElement, options: EditorOptions = {}): Promise<NoteEditor> {
  if (mounted.has(host) || host.childNodes.length) throw Error('Editor host must be empty and unmounted');
  mounted.add(host);
  const releaseLocale=registerLocale(host,options);
  const originalClass=host.className, originalTheme=host.getAttribute('data-theme');
  host.dataset.theme=options.theme??'light';
  const listeners=new Set<(markdown:string)=>void>();
  if(options.onChange)listeners.add(options.onChange);
  let disposed=false, queued=false;
  const emit=(read:()=>string)=>{
    if(queued)return;queued=true;
    queueMicrotask(()=>{queued=false;if(!disposed){const value=read();for(const fn of listeners)fn(value);}});
  };
  let surface:Awaited<ReturnType<typeof createNoteSurface>>;
  try { surface=await createNoteSurface(host,options.markdown??'',emit,{},options); }
  catch(error){releaseLocale();mounted.delete(host);host.replaceChildren();host.className=originalClass;throw error;}
  const assertLive=()=>{if(disposed)throw Error('Editor has been destroyed');};
  const command=(fn:typeof undo)=>{assertLive();if(options.readOnly)return false;return surface.editor.action(ctx=>{const view=ctx.get(editorViewCtx);return fn(view.state,view.dispatch);});};
  return {
    getMarkdown(){assertLive();return surface.markdown();},
    setMarkdown(value){assertLive();surface.editor.action(ctx=>{const v=ctx.get(editorViewCtx);v.dispatch(closeHistory(v.state.tr));});surface.setMarkdown(value);surface.editor.action(ctx=>{const v=ctx.get(editorViewCtx);v.dispatch(closeHistory(v.state.tr));});},
    onChange(fn){assertLive();listeners.add(fn);return()=>listeners.delete(fn);},
    focus(){assertLive();surface.editor.action(ctx=>ctx.get(editorViewCtx).focus());},
    undo:()=>command(undo),redo:()=>command(redo),
    setTheme(theme){assertLive();host.dataset.theme=theme;},
    settled:()=>settleNoteDiagrams(host),
    async destroy(){if(disposed)return;disposed=true;listeners.clear();try{await surface.destroy();}finally{host.replaceChildren();host.className=originalClass;delete host.dataset.readonly;if(originalTheme===null)delete host.dataset.theme;else host.dataset.theme=originalTheme;mounted.delete(host);releaseLocale();}},
  };
}
/** Read-only uses exactly the same schema, node views and styles. */
export const renderMarkdown=(host:HTMLElement,markdown:string,options:Omit<EditorOptions,'markdown'|'readOnly'>={})=>mountEditor(host,{...options,markdown,readOnly:true});
