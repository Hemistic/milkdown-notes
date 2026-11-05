# 架构边界

```text
apps/local/src ──→ @local/milkdown-sidebar ──→ @local/milkdown-notes
      │                 │                         ↑
      └─ NoteFiles ─ HTTP ──→ local file storage    │
other hosts ── NoteFiles + AIProvider ──→ sidebar   │
examples/vanilla ──────────────────────────────────┘

packages/editor/src → Milkdown / ProseMirror
                    → CodeMirror / Lezer
                    → KaTeX / official Mermaid
                    → DOMPurify / Lucide
```

`packages/editor` 拥有文档 schema、解析序列化、编辑/阅读视图、交互 UI、样式与宿主回调类型。核心不读取本地文件、不请求 MCP、不访问白板状态、不直接调用 Agent，不使用 localStorage。

`packages/sidebar` 拥有菜单、底栏、笔记列表、保存任务、导入导出、主题/语言切换。它接受 `NoteFiles` 和 `AIProvider`，不读取 localStorage，不绑定固定 API 路径。React 只用于复用原底栏，宿主可以用任意框架。

`apps/local` 实现本地文件服务，并通过 `createHttpFiles` 接入完整侧栏；负责初始欢迎笔记和偏好持久化。HTTP 服务使用 Node 标准库，不引入数据库或框架；`.data` 不是源码。

`examples/vanilla` 包含单独编辑器、AI/diff 和完整侧栏示例。侧栏示例使用内存文件适配器和固定 AI 流，直接消费构建模块，验证多个宿主容器，不依赖本地应用的笔记 API。

`scripts/milkdown-adapters.mjs` 是构建时兼容层，作用于精确版本的上游模块输入，不写入 node_modules。`scripts/build.mjs` 输出 ESM、按需 chunks、CSS、字体、声明与依赖许可。源代码依赖按实际 import 明确列在 package.json；锁文件是可重复安装依据。

提取时保留了便于追踪的 `note-*.ts` 文件划分，命名空间从 `wb-note` 改为 `mn-note`，清除了白板选择器与最近卡片查找。原 `note-static.ts` 中的白板可见性调度、画布事件和全局缓存没有移植；公开只读 API 与编辑器使用同一个实现。原 `note-editor.ts`、保存补丁、引用目录生成器和 AI 宿主 provider 均留在来源工程。

当前取舍：框架无关的浏览器组件优先于自定义插件框架；异步 `mount/destroy` 优先于隐式全局单例；Markdown 文件优先于数据库；源码本地构建，GitHub 公开，npm 软件包尚未发布。后续若做 Electron/Tauri，只需要实现存储/导航/资源适配，不应把这些逻辑放回编辑器核心。
