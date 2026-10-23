import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createStorage} from '../apps/local/storage.mjs';
test('local Markdown persists across storage instances and rejects path traversal',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'milkdown-notes-test-'));
  try{
    const first=createStorage(root);await first.init();
    const markdown='# Local title\n\n| A | B |\n|---|:---:|\n| one | two |\n\n$$x^2$$\n';
    await first.write('test-note',markdown);
    const reopened=createStorage(root);await reopened.init();
    assert.equal(await reopened.read('test-note'),markdown);
    assert.deepEqual(await reopened.list(),[{id:'test-note',title:'Local title'}]);
    await assert.rejects(()=>first.write('../outside','bad'),/Invalid note ID/);
    await assert.rejects(()=>first.read('..\\outside'),/Invalid note ID/);
    assert.deepEqual(await readdir(path.join(root,'notes')),['test-note.md']);
  }finally{await rm(root,{recursive:true,force:true});}
});
test('image storage returns a portable relative resource URL',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'milkdown-notes-assets-test-'));
  try{const storage=createStorage(root);await storage.init();const bytes=Buffer.from([137,80,78,71]);const url=await storage.image(bytes,'png');assert.match(url,/^\/assets\/[a-f0-9-]+\.png$/);assert.deepEqual(await readFile(path.join(root,url)),bytes);await assert.rejects(()=>storage.image(bytes,'html'),/Unsupported image/);}
  finally{await rm(root,{recursive:true,force:true});}
});
