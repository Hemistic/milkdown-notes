# 宿主 API 与资源加载

## 生命周期

`await mountEditor(host, options)` 返回 `NoteEditor`。host 必须是浏览器中专用的空 HTMLElement；不要与框架渲染的子节点共享。重复挂载会报错。`destroy()` 可重复调用；销毁后 host 可以再次挂载，旧实例的其他操作会报错。创建异步，框架组件卸载时应等待创建完成再销毁。

```ts
let stopped = false;
const ready = mountEditor(element, {markdown, onChange});
ready.then(editor => { if (stopped) void editor.destroy(); });
// React effect cleanup / Vue onBeforeUnmount equivalent:
const dispose = () => { stopped = true; void ready.then(editor => editor.destroy()); };
```

生命周期返回值没有暴露内部 ProseMirror 实例，避免业务代码直接耦合内部插件。若需要添加新的 schema，应在模块源码中实现并通过同一构建路径发布内部产物。

| API | 语义 |
| --- | --- |
| `getMarkdown()` | 同步返回当前规范化 Markdown |
| `setMarkdown(text)` | 替换全文，编辑模式下作为一个可撤销变更；外部同步应先处理业务冲突 |
| `onChange(fn)` | 返回取消订阅函数；同一微任务内的变更合并一次，无初始回调 |
| `focus()` | 聚焦编辑器 |
| `undo()` / `redo()` | 返回是否执行成功；只读模式返回 false |
| `setTheme('light' \| 'dark')` | 修改此实例主题 |
| `settled()` | 等待当前排队的 Mermaid 渲染完成，不是等待外部图片全部加载 |
| `destroy()` | 释放编辑器、菜单 portal、文档监听和节点视图 |
| `renderMarkdown(host, text, options)` | 同一实现的只读实例，也必须销毁 |

只读实例允许宿主调用 `setMarkdown` 更新显示，但不触发编辑变化回调。模式 / 语言切换采用保存 Markdown 后销毁重挂，撤销历史因此重置；主题切换不重挂。不要在 `onChange` 中对每次变化再调用 `setMarkdown`，会造成光标与历史抖动。宿主在持久化失败时应显示失败状态并保留编辑内容。

## 配置

`markdown` 默认空字符串；`readOnly` 默认 false；`theme` 默认 light；`locale` 默认 zh-CN，可用 en；`label` 设置编辑区域无障碍名称。`messages` 使用中文消息原文作为键覆盖标签，完整键见 `packages/editor/src/locale.ts`。界面翻译不改变用户正文。主题可进一步用宿主上的 `--crepe-color-*` CSS 变量调整。

`highlights` 对已有文档中的匹配文本添加临时证据高亮，不写入 Markdown。`onTitleChange` 在检测到 H1 改变时通知宿主；没有 H1 时不发出空标题回调。

## 宿主接口

| 配置 | 宿主责任 |
| --- | --- |
| `onChange(markdown)` / `editor.onChange` | 保存策略、错误提示、冲突处理 |
| `references(): NoteReference[]` | 返回 `{id,label,kind}`，供 @ 引用和双链解析；kind 是宿主自定义字符串 |
| `backlinks(): NoteReference[]` | 挂载时返回反向链接列表，刷新需重挂 |
| `onReference(reference)` | 打开引用；编辑态 Ctrl/Cmd 点击，阅读态普通点击 |
| `onWikiLink(target)` | 接管 `[[target\|alias]]`；未提供时按 references 的 id / label 唯一匹配 |
| `onLink(url)` | 可选普通链接导航；编辑态 Ctrl/Cmd 点击，阅读态点击；未提供保留上游链接工具行为 |
| `resolveAsset(source): string` | 同步把存储标识转换为可访问 URL；不会修改 Markdown 中原地址 |
| `uploadImage(file): Promise<string>` | 上传后返回持久资源标识或 URL；不要返回刷新后失效的 blob URL 作为永久保存值 |
| `aiProvider` | Milkdown Crepe 7.22.3 的 AIProvider；提供后才显示 AI 操作；宿主管理网络、授权、取消和错误 |

基础编辑不调用任何 AI 服务。没有配置上传时仍可粘贴图片地址，点击上传会显示未配置错误。示例应用提供 `/api/images` 与 `/assets/...`；存储在本机，不上传到外部。

## 资源与构建

使用已经构建的包入口，不能绕过构建直接导入 `src/note-ui.ts`，否则缺失上游兼容适配。构建绑定 Milkdown 7.22.3；依赖升级必须重新审查适配。消费者不用改 node_modules，也不用注册 esbuild 插件。

`style.css` 必须引入一次。加载整个 dist 目录，保留动态 chunks 与 KaTeX fonts。浏览器原生 ESM 示例通过服务器 `/editor/` 映射此目录。模块仅支持浏览器 DOM，不提供服务端 HTML 字符串渲染，SSR 应在客户端挂载。

只读模式保留真实节点视图，取代原白板的快照缓存和全局调度器。大量同时挂载的只读文档需要宿主做列表虚拟化。不要把它描述为轻量静态 Markdown 转 HTML 函数。

## 安全和本地存储边界

正文 HTML 用 DOMPurify 限制性配置净化；原 HTML 源码仍保留在 Markdown，其他渲染端同样必须净化。脚本、事件属性、iframe 和表单控件不作为可执行预览。Mermaid 使用 strict 模式；HTML fenced code 不运行。

图片解析后拒绝可执行协议；支持 HTTP(S)、blob、常见位图 data URL 和相对路径。远程图片是否允许由宿主策略决定。`onLink` / `onReference` 是宿主导航边界，宿主应验证自身可接受的目的地。

本地服务仅监听 loopback，检查 Host 和修改请求 Origin；默认不是远程部署服务。保存使用临时文件和 rename。当前是单用户、单活动编辑会话设计：多标签页或外部编辑器同时写同一文件会最后写入覆盖，不提供锁或冲突 UI。Markdown 导出不把图片打包，备份时一起复制 `.data/assets`。
