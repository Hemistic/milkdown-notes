import { mkdir, readFile, writeFile, rename, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export async function atomicWrite(file, content) {
  const temporary = file + '.' + randomUUID() + '.tmp';
  try {
    await writeFile(temporary, content, 'utf8');
    await rename(temporary, file);
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
}

export function createStorage(root) {
  const notes = path.resolve(root, 'notes'),
    assets = path.resolve(root, 'assets');
  const valid = (id) => {
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw Error('Invalid note ID');
    return id;
  };
  return {
    async init() {
      await mkdir(notes, { recursive: true });
      await mkdir(assets, { recursive: true });
    },
    async list() {
      return Promise.all(
        (await readdir(notes))
          .filter((f) => f.endsWith('.md'))
          .sort()
          .map(async (f) => {
            const markdown = await readFile(path.join(notes, f), 'utf8');
            let title;
            try {
              title = JSON.parse(await readFile(path.join(notes, f + '.json'), 'utf8')).title;
            } catch (error) {
              if (error.code !== 'ENOENT') throw error;
            }
            return {
              id: f.slice(0, -3),
              title: title ?? /^#\s+(.+)$/m.exec(markdown)?.[1] ?? f.slice(0, -3),
            };
          }),
      );
    },
    async read(id) {
      return readFile(path.join(notes, valid(id) + '.md'), 'utf8');
    },
    async write(id, markdown) {
      await atomicWrite(path.join(notes, valid(id) + '.md'), markdown);
    },
    async rename(id, title) {
      valid(id);
      if (
        typeof title !== 'string' ||
        !title.trim() ||
        title.trim().length > 200 ||
        /[<>:"/\\|?*\x00-\x1f]/.test(title)
      )
        throw Error('Invalid Markdown name');
      await readFile(path.join(notes, id + '.md'));
      await atomicWrite(path.join(notes, id + '.md.json'), JSON.stringify({ title: title.trim() }));
    },
    async image(buffer, extension) {
      if (!['png', 'jpg', 'webp', 'gif'].includes(extension)) throw Error('Unsupported image');
      const name = randomUUID() + '.' + extension;
      await writeFile(path.join(assets, name), buffer);
      return '/assets/' + name;
    },
    assets,
  };
}
