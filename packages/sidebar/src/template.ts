export const template = (prefix: string) => `
  <div class="menu-anchor" data-id="menu-anchor" id="${prefix}-menu-anchor">
    <button data-id="menu-toggle" id="${prefix}-menu-toggle" aria-label="笔记菜单" aria-expanded="false" aria-controls="${prefix}-app-menu" title="笔记菜单"><span data-icon="menu"></span></button>
    <nav data-id="app-menu" id="${prefix}-app-menu" aria-label="笔记功能" hidden>
      <div class="menu-heading">Milkdown Notes<span>专注于此刻的想法</span></div>
      <button data-id="new" id="${prefix}-new" class="menu-item"><span data-icon="new"></span><span>新建笔记</span></button>
      <div class="menu-branch">
        <button class="menu-item branch-toggle" aria-expanded="false" aria-controls="${prefix}-history-menu"><span data-icon="history"></span><span>历史笔记</span><span data-icon="chevron" class="chevron"></span></button>
        <section data-id="history-menu" id="${prefix}-history-menu" class="submenu" aria-label="历史笔记" hidden><div class="submenu-heading">已保存的笔记</div><div data-id="notes" id="${prefix}-notes"></div></section>
      </div>
      <div class="menu-divider"></div>
      <button data-id="preview" id="${prefix}-preview" class="menu-item"><span data-icon="read"></span><span class="item-label">阅读模式</span></button>
      <button data-id="undo" id="${prefix}-undo" class="menu-item"><span data-icon="undo"></span><span>撤销</span></button>
      <button data-id="redo" id="${prefix}-redo" class="menu-item"><span data-icon="redo"></span><span>重做</span></button>
      <div class="menu-divider"></div>
      <div class="menu-branch">
        <button class="menu-item branch-toggle" aria-expanded="false" aria-controls="${prefix}-file-menu"><span data-icon="file"></span><span>导入与导出</span><span data-icon="chevron" class="chevron"></span></button>
        <section data-id="file-menu" id="${prefix}-file-menu" class="submenu" aria-label="导入与导出" hidden>
          <button data-id="import" id="${prefix}-import" class="menu-item"><span data-icon="import"></span><span>导入 Markdown</span></button>
          <button data-id="export" id="${prefix}-export" class="menu-item"><span data-icon="export"></span><span>导出 Markdown</span></button>
        </section>
      </div>
      <div class="menu-branch">
        <button class="menu-item branch-toggle" aria-expanded="false" aria-controls="${prefix}-settings-menu"><span data-icon="settings"></span><span>偏好设置</span><span data-icon="chevron" class="chevron"></span></button>
        <section data-id="settings-menu" id="${prefix}-settings-menu" class="submenu" aria-label="偏好设置" hidden>
          <div class="submenu-heading">主题</div>
          <button data-id="theme-light" id="${prefix}-theme-light" class="menu-item" aria-pressed="true"><span data-icon="sun"></span><span>白天主题</span><span data-icon="check" class="selected-mark"></span></button>
          <button data-id="theme-dark" id="${prefix}-theme-dark" class="menu-item" aria-pressed="false"><span data-icon="moon"></span><span>黑夜主题</span><span data-icon="check" class="selected-mark"></span></button>
          <div class="menu-divider"></div>
          <div class="submenu-heading">编辑器语言</div>
          <button data-id="locale-zh" id="${prefix}-locale-zh" class="menu-item" aria-pressed="true"><span data-icon="language"></span><span>中文</span><span data-icon="check" class="selected-mark"></span></button>
          <button data-id="locale-en" id="${prefix}-locale-en" class="menu-item" aria-pressed="false"><span data-icon="language"></span><span>English</span><span data-icon="check" class="selected-mark"></span></button>
        </section>
      </div>
      <div class="menu-divider"></div>
      <div class="menu-footer"><span data-icon="saved"></span><span data-id="status" id="${prefix}-status" role="status">正在加载…</span></div>
    </nav>
  </div>
  <div data-id="document-layout" id="${prefix}-document-layout"><aside data-id="outline" id="${prefix}-outline" class="artifact-chrome outline-panel" aria-label="文档大纲" hidden><div class="outline-panel-title">大纲</div><div class="outline-list"></div></aside><main data-id="editor-pane" id="${prefix}-editor-pane"><div class="paper"><div data-id="editor" id="${prefix}-editor"></div></div></main></div>
  <div data-id="statusbar-root" id="${prefix}-statusbar-root" class="artifact-chrome"></div>
  <dialog data-id="rename-dialog" id="${prefix}-rename-dialog" class="artifact-chrome"><form method="dialog"><label for="${prefix}-rename-name">重命名 Markdown</label><input data-id="rename-name" id="${prefix}-rename-name" name="name" required maxlength="200" autocomplete="off"><div><button value="cancel" formnovalidate>取消</button><button value="save">保存</button></div></form></dialog>
  <input data-id="file" id="${prefix}-file" type="file" accept=".md,.markdown,text/markdown,text/plain" hidden>
  `;
