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
test('rename persists the display/export name without changing Markdown, IDs or wiki references',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'milkdown-notes-rename-test-'));
  try{
    const storage=createStorage(root);await storage.init();const markdown='# Original\n\n[[stable-id]]\n';await storage.write('stable-id',markdown);
    await storage.rename('stable-id','重命名测试');
    const reopened=createStorage(root);assert.deepEqual(await reopened.list(),[{id:'stable-id',title:'重命名测试'}]);assert.equal(await reopened.read('stable-id'),markdown);
    await reopened.write('stable-id',markdown+'\nMore');assert.equal((await reopened.list())[0].title,'重命名测试');
    for(const bad of ['', '  ', '../outside', 'bad\\name', 'bad\u0000name', 'a'.repeat(201)])await assert.rejects(()=>storage.rename('stable-id',bad),/Invalid Markdown name/);
    await assert.rejects(()=>storage.rename('missing','title'),/ENOENT/);await assert.rejects(()=>storage.rename('../outside','title'),/Invalid note ID/);
  }finally{await rm(root,{recursive:true,force:true});}
});
