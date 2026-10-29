export interface NoteSummary {
  id: string;
  title: string;
}
export interface NoteDocument {
  id: string;
  markdown: string;
}

/** Implement with HTTP, Electron IPC, Tauri, or your application's own storage. */
export interface NoteFiles {
  list(): Promise<NoteSummary[]>;
  read(id: string): Promise<NoteDocument>;
  write(id: string, markdown: string): Promise<void>;
  rename(id: string, title: string): Promise<void>;
  uploadImage?(file: File): Promise<string>;
  resolveAsset?(source: string): string;
}

/** Adapter for the included local server; baseURL may also be an absolute host URL. */
export function createHttpFiles(baseURL = '/api', request: typeof fetch = fetch): NoteFiles {
  const base = baseURL.replace(/\/$/, '');
  async function json<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await request(base + path, init);
    if (!response.ok)
      throw Error(`File request failed (${response.status}): ${await response.text()}`);
    return response.json() as Promise<T>;
  }
  const note = (id: string) => '/notes/' + encodeURIComponent(id);
  return {
    list: () => json<NoteSummary[]>('/notes'),
    read: (id) => json<NoteDocument>(note(id)),
    async write(id, markdown) {
      await json(note(id), {
        method: 'PUT',
        body: markdown,
        headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
      });
    },
    async rename(id, title) {
      await json(note(id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
    },
    async uploadImage(file) {
      const result = await json<{ url: string }>('/images', {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      return new URL(result.url, new URL(base, location.href)).href;
    },
    resolveAsset: (source) => new URL(source, new URL(base, location.href)).href,
  };
}
