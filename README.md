# Milkdown Notes

一个面向应用集成的 Markdown 编辑器模块，以及使用同一模块的本地笔记应用。暂用名称，不属于 Milkdown 官方项目。

本仓库从 Artinfact 0.13.41 的笔记实现提取；没有携带 MCP、白板存储、宿主协议、PDF Reader、用户资料或 Agent 服务。当前是本地私有工程，未发布仓库或 npm 包，项目整体许可尚未指定。第三方许可保持各自归属，见 [来源与许可](docs/attribution.md)。

## 运行

需要 Node.js 22.12+ 和 npm 10+；本机验收使用 Node 24.13.0 / npm 11.6.2。

```powershell
cd D:\Project\milkdown-notes
npm ci
npm run build
npm start
```

- 本地笔记：<http://127.0.0.1:43150/>
- 无框架集成示例：<http://127.0.0.1:43150/example/>
- `npm run dev`：构建后启动；当前不含热更新，修改后重新构建并刷新。
- `npm run typecheck`：TypeScript 检查。
- `npm test`：8 个聚焦测试，覆盖存储、路径边界、适配失败和 AI provider 流式协议。
- AI / diff 验收：<http://127.0.0.1:43150/example/ai.html>，本地固定流式数据，无需模型账户；完整结果见 [侧栏与 AI 验收记录](docs/ai-responsive-verification.md)。

笔记保存在 `.data/notes/*.md`，图片保存在 `.data/assets/`，均被 Git 忽略。标题取首个一级标题。导入会新建笔记，导出为 Markdown。更换数据目录和端口：

```powershell
$env:NOTES_DATA_DIR = 'D:\MyNotes'
$env:PORT = '43151'
npm start
```

服务只监听 `127.0.0.1`。这是本地网页应用，需要 Node 进程运行，不是 Windows 安装包。没有云同步、实时协作或多端冲突合并。

本地应用采用沉浸式布局：点击左上角图标展开功能菜单，悬停或点击历史笔记、导入与导出、偏好设置即可打开子菜单。历史笔记列出本机保存的文档。所有菜单项使用 Lucide 图标；支持方向键导航、Esc 收起以及点击正文关闭菜单。

## 集成模块

先在本仓库构建，再在使用 Vite、Webpack 等工具的项目中安装本地目录：

```sh
npm install /absolute/path/to/milkdown-notes/packages/editor
```

```ts
import {mountEditor, renderMarkdown} from '@local/milkdown-notes';
import '@local/milkdown-notes/style.css';

const editor = await mountEditor(document.querySelector('#note')!, {
  markdown: '# Hello\n\nStart here.',
  locale: 'en',
  theme: 'light',
  onChange: markdown => console.log(markdown),
  onWikiLink: target => navigateToNote(target),
  resolveAsset: source => resolveLocalAsset(source),
  uploadImage: file => uploadToYourStorage(file),
});

editor.setMarkdown('# Updated');
const markdown = editor.getMarkdown();
const unsubscribe = editor.onChange(markdown => save(markdown));
editor.undo();
editor.redo();
editor.setTheme('dark');
await editor.settled();
unsubscribe();
await editor.destroy();

const reader = await renderMarkdown(document.querySelector('#preview')!, markdown);
await reader.destroy();
```

`navigateToNote`、`resolveLocalAsset`、`uploadToYourStorage`、`save` 是宿主自己的函数，均非基础编辑的必需依赖。完整、可直接运行的示例在 [examples/vanilla](examples/vanilla)。

无打包器时，把 `packages/editor/dist/` **整个目录**作为静态资源提供：加载 `style.css`，从 `index.js` 导入。保留 `chunks/`、`fonts/` 和许可证文件的相对位置。公式字体、Mermaid 和语法包全部来自本地安装与构建，不使用 CDN。只复制 `index.js` 会破坏懒加载资源。

## 能力与边界

- 相同 Milkdown schema / node views 支持编辑与只读；Markdown 导入导出、变化通知、撤销重做。
- CommonMark/GFM：标题、列表、任务、引用、链接、图片、表格、脚注；KaTeX 正文公式。
- `==高亮==`、`~下标~`、`^上标^`、`[[note|alias]]`、`[TOC]`、官方 Mermaid 11.12.1。
- CodeMirror / Lezer 代码高亮与语言标签；DOMPurify 处理正文 HTML；HTML 代码块只显示源码。
- 斜杠菜单、内容左侧加号、块拖动、选文工具栏；表格列对齐、Tab 增行和行列拖动；缩放容器内图片按比例调整。
- 每实例中文 / 英文、消息覆盖与明暗主题；宿主负责导航、资源、持久化；AIProvider 完全可选。

Markdown 会被规范化，非逐字节往返。图片尺寸使用标题后缀 `{mn-ratio:0.70}`，保留真正的 alt 与图题；其他 Markdown 阅读器能显示图片，但不会理解这个缩放约定。旧 Artinfact 数字 alt 的图片需要显式迁移，模块不会把纯数字替代文字猜成尺寸。

请结合 [实际验收记录](docs/verification.md) 判断已验证范围。AI 网络服务、浏览器全矩阵、大文档性能、多人协作不属于本轮已完成验收。

更多：[宿主 API](docs/integration.md) · [架构边界](docs/architecture.md) · [Milkdown 适配明细](docs/upstream-adapters.md) · [来源与许可](docs/attribution.md)

## Artifact 快照底栏

本地应用复用 Artifact Markdown 快照的 `StatusBar.tsx`、30px 底栏样式、13 种原始 SVG 和原字体。大纲、主题、正常/专注/打字机模式、三击块源码、拼写与统计切换均已接通。文件菜单支持重命名、打开 Markdown、导出 Markdown/HTML 和浏览器 PDF 打印。窄于完整按钮组的侧栏保留按钮尺寸，通过滚轮、触控或键盘横向访问。

重命名保存显示/导出名称，稳定 ID 和正文不变；名称元数据位于 `.data/notes/<id>.md.json`。导出的 HTML 内嵌样式、字体和本机图片，保留公式与图表。PDF 使用浏览器打印的“另存为 PDF”，不是 Electron 的原生 `printToPDF`；当前内置浏览器只验证了调用，未验证 PDF 文件保存。原组件的“在 ArtInFact 中打开”宿主回调仍保留，独立应用没有对应宿主，因此不显示此按钮。

来源哈希、适配说明和字体来源位于 `apps/local/src/artifact/provenance.json`。构建、类型检查、9 项 Node 测试及 `/example/ai.html` 的 21 项浏览器回归通过；AI 测试使用固定流式数据，不代表真实模型服务验收。

## 统一白天 / 黑夜主题

左上角「偏好设置」可选择白天或黑夜主题，底栏日月按钮可快速切换。正文、菜单、底栏、大纲、弹窗、代码块和图表使用 `packages/editor/src/themes.css` 的同一套颜色变量；界面和正文复用原 Artifact 字体。选择会保存在本机，页面首屏就应用已保存主题。

Mermaid 图表按主题缓存，串行渲染以隔离不同实例；主题切换不修改 Markdown。HTML 导出保留当前主题和字体。新增主题/图表隔离回归后，浏览器验收共 22 项通过。
