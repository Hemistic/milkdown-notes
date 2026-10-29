import { mountSidebar, createHttpFiles, type SidebarPreferences } from '@local/milkdown-sidebar';
import { welcome } from './welcome.js';

const files = createHttpFiles();
const preferenceKey = 'milkdown.notes.editorPreferences';
let preferences: Partial<SidebarPreferences> = {};
try {
  preferences = JSON.parse(localStorage.getItem(preferenceKey) ?? '{}') ?? {};
} catch {
  /* Ignore old/corrupt preferences. */
}

try {
  if (!(await files.list()).length) {
    await files.write(
      'guide',
      '# 集成指南\n\n此应用使用与集成示例相同的侧栏模块。\n\n返回 [[welcome|欢迎笔记]]。',
    );
    await files.write('welcome', welcome);
  }
  const notes = await files.list();
  const sidebar = await mountSidebar(document.getElementById('sidebar')!, {
    files,
    initialNoteId: notes.find((note) => note.id === 'welcome')?.id ?? notes[0].id,
    preferences,
    onPreferencesChange(value) {
      localStorage.setItem(preferenceKey, JSON.stringify(value));
    },
    onError: console.error,
  });
  window.addEventListener('beforeunload', (event) => {
    if (sidebar.dirty) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
} catch (error) {
  document.getElementById('sidebar')!.textContent = '加载失败：' + String(error);
  console.error(error);
}
