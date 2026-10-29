import type { AIProvider, NoteEditor } from '@local/milkdown-notes';
import type { NoteFiles, NoteDocument } from './files.js';
import type { MarkdownExportFormat } from './artifact/types.js';

export interface SidebarPreferences {
  theme: 'light' | 'dark';
  mode: 'normal' | 'focus' | 'typewriter';
  outline: boolean;
  spellcheck: boolean;
  source: boolean;
}
export interface NoteExport {
  format: MarkdownExportFormat;
  name: string;
  mimeType: string;
  /** PDF supplies printable HTML. The host may use its native PDF exporter. */
  content: string;
}
export interface SidebarOptions {
  files: NoteFiles;
  initialNoteId?: string;
  aiProvider?: AIProvider;
  preferences?: Partial<SidebarPreferences>;
  onPreferencesChange?: (preferences: SidebarPreferences) => void;
  onChange?: (document: NoteDocument) => void;
  onError?: (error: unknown) => void;
  onAIError?: (error: Error) => void;
  /** Omit to download Markdown/HTML or open the browser's print dialog for PDF. */
  onExport?: (file: NoteExport) => void | Promise<void>;
  /** CSS URLs to embed when exporting HTML/PDF. Defaults to the package's style.css. */
  exportStylesheets?: string[];
}
export interface NoteSidebar {
  /** Current editor; reading/editing mode changes replace this instance. */
  readonly editor: NoteEditor;
  readonly documentId: string;
  readonly dirty: boolean;
  open(id: string): Promise<void>;
  create(markdown?: string, title?: string): Promise<string>;
  rename(title: string): Promise<void>;
  importFile(file: File): Promise<string>;
  exportDocument(format: MarkdownExportFormat): Promise<NoteExport>;
  refresh(): Promise<void>;
  flush(): Promise<void>;
  setTheme(theme: 'light' | 'dark'): void;
  /** Flushes changes before cleanup. A save failure leaves the sidebar mounted for retry. */
  destroy(): Promise<void>;
}
