# 侧栏接入：AI 与文件

`@local/milkdown-sidebar` 提供完整侧栏：左上角菜单、编辑器、30px 底栏、主题、大纲、导入导出。`@local/milkdown-notes` 提供单独的编辑器和 AI 控制接口。本地应用也通过这两个包运行，没有第二套文件操作实现。

## 安装与挂载

在本仓库运行 `npm ci && npm run build`，然后在宿主项目安装两个本地包：

```sh
npm install /absolute/path/to/milkdown-notes/packages/editor /absolute/path/to/milkdown-notes/packages/sidebar
```

```ts
import { mountSidebar, type NoteFiles } from '@local/milkdown-sidebar';
import '@local/milkdown-sidebar/style.css'; // 已包含编辑器样式

const files: NoteFiles = {
  list: () => host.notes.list(),
  read: (id) => host.notes.read(id),
  write: (id, markdown) => host.notes.write(id, markdown),
  rename: (id, title) => host.notes.rename(id, title),
  uploadImage: (file) => host.images.upload(file),
  resolveAsset: (source) => host.images.url(source),
};

const sidebar = await mountSidebar(element, {
  files,
  initialNoteId: 'note-id', // 可省略，默认列表第一篇；空列表创建空白笔记
  preferences: { theme: 'light' },
  aiProvider: (context, signal) => host.ai.stream(context, signal),
  onPreferencesChange: (value) => host.preferences.save(value),
  onError: (error) => host.showError(error),
  onAIError: (error) => host.showError(error),
});

await sidebar.open('another-id');
await sidebar.importFile(file);
await sidebar.rename('新标题');
sidebar.setTheme('dark');
await sidebar.flush();
await sidebar.destroy();
```

`host` 是宿主自己实现的 API，不是本包提供的全局对象。普通网页、Electron IPC、Tauri commands 或现有软件的服务都可以作为实现。容器必须为空且有明确高度，例如 `height:100%`（父容器也需有高度）或 `height:600px`。宽度由宿主控制；侧栏按实际容器宽度适配。支持同页多实例，主题和菜单独立。

无打包器时，分别映射整个 `packages/editor/dist` 和 `packages/sidebar/dist`，保留 chunks、fonts、licenses；在 import map 中将两个包名映射到各自的 `index.js`，加载侧栏 `style.css`。运行示例见 `/example/sidebar.html`。

## 文件契约

```ts
interface NoteSummary {
  id: string;
  title: string;
}
interface NoteDocument {
  id: string;
  markdown: string;
}
interface NoteFiles {
  list(): Promise<NoteSummary[]>;
  read(id: string): Promise<NoteDocument>;
  write(id: string, markdown: string): Promise<void>;
  rename(id: string, title: string): Promise<void>;
  uploadImage?(file: File): Promise<string>;
  resolveAsset?(source: string): string;
}
```

- `id` 是稳定标识，重命名只改标题；`write` 必须同时支持创建和覆盖。侧栏创建笔记使用 UUID。
- `markdown` 是完整正文；编辑器会规范化 Markdown。文件接口不接收 HTML、diff 草稿或 ProseMirror 对象。
- `uploadImage` 返回持久资源地址/标识，`resolveAsset` 把它转换成当前宿主可访问的 URL。返回值写入 Markdown，避免使用刷新后失效的临时 blob URL。
- 失败直接抛出异常。侧栏保留脏内容并显示错误；保存失败会阻止切换和卸载，下次 `flush()` 可重试。`onChange({id,markdown})` 是内容变更通知，不代表已持久化。
- 导航操作按顺序执行，自动保存合并到同一个写入任务。慢写期间的新修改会继续保存。`destroy()` 先保存，再取消 AI 和释放监听器/浮层；卸载失败时不要先移除宿主容器。每个容器只挂载一个侧栏；成功销毁后停止调用旧实例，重新挂载会返回新实例。

`refresh()` 只刷新历史笔记列表，`open(id)` 才加载正文。多窗口或远端多人同时改同一文件的冲突策略由宿主处理。

完整方法和配置的 TypeScript 定义见 `packages/sidebar/src/types.ts` 与 `files.ts`。`sidebar.editor` 是当前 `NoteEditor`；阅读/编辑或语言切换会重建编辑器，调用时读取该属性，不长期缓存旧实例。

## AI 契约

```ts
type AIPromptContext = {
  document: string;
  selection: string;
  instruction: string;
};
type AIProvider = (context: AIPromptContext, signal: AbortSignal) => AsyncIterable<string>;
```

Provider 按顺序产出**增量 Markdown 文本**，不是累积全文，也不是未经解析的 SSE/JSON。结束迭代进入 diff 审查；异常抛出，取消使用传入的 `AbortSignal`。模型、认证、网络和额度归宿主负责。未配置 provider 时没有 AI 入口。

```ts
const ai = sidebar.editor.ai;
if (ai) {
  ai.run('精简文字，保留引文', 'document'); // 默认 scope 为 selection
  ai.getState(); // {status: 'idle' | 'streaming' | 'review', pendingChanges: number}
  ai.abort(); // 停止并还原；abort(true) 将部分结果转入 diff 审查
  ai.accept(); // 接受全部，触发正文变更与自动保存
  ai.reject(); // 放弃剩余差异
}
```

方法返回是否成功启动/执行，不返回模型结果 Promise。用 UI 或 `getState()` 查看进度；流式草稿和未确认 diff 不作为正文保存。逐块接受/放弃、重新改写也保留在内置 AI UI 中。只读实例的 `editor.ai` 为 undefined。

可选 HTTP provider 从独立入口导入，复用 Milkdown 已有实现：

```ts
import { createOpenAIProvider, createAnthropicProvider } from '@local/milkdown-notes/providers';
```

配置类型随包发布；也可以直接使用宿主自己的流式 SDK。本地应用通过服务端 `/api/ai` 代理模型流。配置项目根目录的 `.env.local` 后重启服务：

```dotenv
AI_PROVIDER=openai
AI_BASE_URL=https://api.openai.com
AI_MODEL=gpt-6-luna
AI_REASONING_EFFORT=medium
AI_API_KEY=your-local-key
```

`.env.local` 已被 Git 忽略，密钥只在 Node 服务中使用，不返回浏览器。Milkdown provider 会给 `AI_BASE_URL` 自动追加 `/v1/chat/completions`，因此地址不包含 `/v1`。Anthropic 可设 `AI_PROVIDER=anthropic`，对应地址自动追加 `/v1/messages`。

宿主使用 `createHttpAIProvider(endpoint = '/api/ai')` 连接同一服务；它是标准 `AIProvider`，可直接传给 `mountSidebar`。

- `GET /api/ai` 返回 configured、provider、model、reasoningEffort，不含认证信息。
- `POST /api/ai` 接收 AIPromptContext JSON；返回逐行 JSON：`{"text":"增量"}`，最后是 `{"done":true}`；失败返回 `{"error":"原因"}`。
- 浏览器取消会关闭响应，并通过 AbortController 取消上游请求。中途失败不会标记为完成；没有 done 的截断响应也不会作为正常生成接受。
- 真实模型验收页：`/example/live-ai.html`。只有点击运行才发起请求，示例文件保存在内存；`?case=断线` 或 `?case=Esc` 可单独重测对应项目。

模型与参数核对依据：[GPT-6 Luna 官方文档](https://developers.openai.com/api/docs/models/gpt-6-luna)。实际结果见 [真实 AI 验收](live-ai-verification.md)。

## 导出交接

`onExport(file)` 可以接管 Markdown、HTML 和 PDF 菜单：

```ts
onExport: async (file) => {
  if (file.format === 'pdf') {
    // file.content 是包含主题/资源的 HTML，交给宿主原生打印接口生成 PDF。
    await host.printToPDF({ html: file.content, filename: file.name });
  } else {
    await host.saveFile({ name: file.name, mimeType: file.mimeType, content: file.content });
  }
};
```

`exportDocument(format)` 会调用上述回调并返回同一 `NoteExport`。PDF 的 `mimeType` 是 `text/html`，不会伪装成 PDF 二进制。未提供回调时，Markdown/HTML 下载，PDF 打开浏览器打印。

HTML/PDF 默认读取包旁的 `style.css`，嵌入同源字体、图片和当前主题。被宿主打包器改名后的 CSS，请用 `exportStylesheets: [实际样式URL]` 指定；加载失败会返回错误。跨域图片保留原地址，不擅自跨域下载。Markdown 导出不打包附件。

## 内置 HTTP 文件适配

`createHttpFiles('/api')` 对应本地服务；第二个参数可注入宿主 `fetch`（添加认证或转接请求）。

| 请求                   | 输入                                            | 成功返回             |
| ---------------------- | ----------------------------------------------- | -------------------- |
| `GET /api/notes`       | 无                                              | `NoteSummary[]`      |
| `GET /api/notes/:id`   | 无                                              | `{id, markdown}`     |
| `PUT /api/notes/:id`   | 原始 Markdown 文本                              | `{id, saved:true}`   |
| `PATCH /api/notes/:id` | JSON `{title}`                                  | `{id, renamed:true}` |
| `POST /api/images`     | 原始图片字节，Content-Type 为 PNG/JPEG/WebP/GIF | `{url}`              |

服务错误返回非 2xx 和 `{error}`。内置服务只监听本机并检查修改请求 Origin，不是跨站开放 API；外部软件优先实现 `NoteFiles` 或自己的代理。不要通过移除本地服务边界来接入。
