<div align="center">

# Milkdown Notes

**English** · [简体中文](README.zh-CN.md)

**Reusable Markdown editing infrastructure for AI applications**

Bring the editor, sidebar, and diff review into your own software.

TypeScript · Milkdown / ProseMirror · Local Markdown files · Development preview

[Screenshots](#screenshots) · [Syntax gallery](#markdown-syntax-gallery) · [Features](#what-works-today) · [Quick start](#quick-start) · [Integration](#integrate-with-your-software) · [AI and review](#ai-and-document-review) · [Development](#development-and-validation)

</div>

Readers, research tools, and AI workspaces often need the same foundations: a rich Markdown editor, file operations, streaming rewrites, and a clear way to review proposed changes.

**Milkdown Notes packages those foundations into an embeddable sidebar and an independent editor.** The included local notes application uses the same public interfaces that a host application would implement. Your software supplies storage, navigation, and AI; the modules provide the editing experience.

> Development preview. Browser modules and a local Node application are implemented. Packages are built from source and are not published to npm. This is an independent project, not an official Milkdown product.

## Screenshots

Actual captures from this project's October 2026 local validation, using demonstration documents and the Chinese interface. The theme captures predate the consolidated settings button; the settings capture shows that addition. The diff image uses a fixed test stream, not a live model call.

<table>
<tr><th width="50%">Light theme</th><th width="50%">Dark theme</th></tr>
<tr>
<td><img src="docs/media/theme-light.jpg" alt="Light editor with the corner menu and slim footer" width="480"></td>
<td><img src="docs/media/theme-dark.jpg" alt="Dark editor with matching menu, document, and footer colors" width="480"></td>
</tr>
</table>

<details>
<summary><strong>Settings, AI diff review, and a 240 px sidebar</strong></summary>

<table>
<tr><th>Settings</th><th>AI diff review</th><th>240 px sidebar</th></tr>
<tr>
<td><img src="docs/media/settings.jpg" alt="Appearance, editor preferences, model, reasoning effort, and a blank API key field" width="320"></td>
<td><img src="docs/evidence/ai-diff-sidebar.jpg" alt="Fixed-stream test showing per-change accept and reject controls" width="260"></td>
<td><img src="docs/media/sidebar-240.jpg" alt="Actual 240-pixel sidebar with the document and footer file menu" width="240"></td>
</tr>
</table>

</details>

The sidebar is checked at **240, 300, 390, 650, and 900 px container widths**. The footer stays 30 px tall; narrow containers keep control sizes and allow the action strip to scroll horizontally. Width adaptation is tested separately from mobile-device support.

## Markdown syntax gallery

These are **actual captures from this project’s `renderMarkdown` on 2026-11-06**, with source on the left and rendered output on the right. Screenshots preserve extensions that GitHub itself does not render; each group includes copyable source. The demonstration content is in Chinese.

After starting the local app, open **http://127.0.0.1:43150/example/syntax.html** to switch between five samples, edit their source, update the preview, and toggle light/dark themes. The gallery previews in memory without writing to your notes. See the [gallery implementation](examples/vanilla/syntax.js) and [all Markdown samples](examples/vanilla/syntax).

### Everyday Markdown

Heading levels 1–3, bold, italic, strikethrough, inline code, quotations, ordered/unordered/nested lists, tasks, links, rules, and footnotes.

![Everyday Markdown — source and actual rendering](docs/media/syntax-basics.jpg)

<details>
<summary>View copyable Markdown source</summary>

<!-- prettier-ignore -->
````markdown
# 一页笔记，多种表达

## 把思路写清楚

**重要观点**、*轻声强调*、~~旧的结论~~，还有 `inline code`。

> 写作是把想法变得清晰的过程。

- 收集线索
  - 整理来源
- 形成观点

1. 阅读材料
2. 写下结论

- [x] 完成初稿
- [ ] 继续打磨

### 追溯来源

阅读 [Milkdown](https://milkdown.dev) 文档，保留证据。[^note]

---

[^note]: 脚注用于补充来源与说明。
````

</details>

### Tables and highlighted code

Left-, center-, and right-aligned tables with formatted cells, plus fenced code with a language label and syntax highlighting.

![Tables and highlighted code — source and actual rendering](docs/media/syntax-tables-code.jpg)

<details>
<summary>View copyable Markdown source</summary>

<!-- prettier-ignore -->
````markdown
## 用表格整理信息

| 功能 | 状态 | 数量 |
| :--- | :---: | ---: |
| **编辑器** | 已接入 | 1 |
| 主题 | 明／暗 | 2 |
| `Markdown` | 可导出 | 3 |

## 让代码保持可读

```typescript
import { mountEditor } from '@local/milkdown-notes';

const editor = await mountEditor(element, {
  markdown: '# Hello, Markdown',
  onChange: (text) => save(text),
});

editor.setTheme('dark');
```

代码块保留语言标记，并显示语法高亮。
````

</details>

### Math and Mermaid diagrams

Inline math, an integral, a matrix, and a Mermaid flowchart rendered by this project. The flowchart illustrates Markdown content; it does not invoke an AI model.

![Math and Mermaid diagrams — source and actual rendering](docs/media/syntax-math-diagrams.jpg)

<details>
<summary>View copyable Markdown source</summary>

<!-- prettier-ignore -->
````markdown
## 用公式表达

行内公式 $E=mc^2$ 与正文一起阅读。

$$
\int_0^1 x^2\,dx=\frac{1}{3}
$$

$$
\mathbf{A}=\begin{pmatrix}1 & 2\\3 & 4\end{pmatrix}
$$

## 把流程画出来

```mermaid
graph LR
  A[Markdown] --> B[编辑器]
  B --> C[AI 改写]
  C --> D{审查差异}
  D -->|接受| E[保存]
  D -->|放弃| B
```
````

</details>

### Project-specific syntax

An automatic `[TOC]`, `[[wiki links|display labels]]`, `==highlight==`, `H~2~O`, `x^2^`, and inline HTML such as `<kbd>`, `<u>`, and `<mark>`. Wiki-link clicks call the host’s `onWikiLink`; the gallery displays the requested target.

![Project-specific syntax — source and actual rendering](docs/media/syntax-extensions.jpg)

<details>
<summary>View copyable Markdown source</summary>

<!-- prettier-ignore -->
````markdown
# 让笔记相互连接

[TOC]

## 双链导航

连接 [[集成指南|另一篇笔记]]，也可以写 [[研究日志]]。

## 标记重点

一句话中的 ==核心结论== 可以直接高亮。

水分子是 H~2~O，平方写作 x^2^。

## 正文 HTML

用 <kbd>Ctrl</kbd> + <kbd>Z</kbd> 撤销。

保留 <u>下划线</u> 与 <mark>HTML 高亮</mark>。
````

</details>

<details>
<summary>The same extensions in the dark theme</summary>

![Project-specific syntax in the dark theme](docs/media/syntax-extensions-dark.jpg)

</details>

### Images, captions, and sizing

Standard image syntax preserves alt text and displays the title as a caption. A `{mn-ratio:0.70}` title suffix stores this project’s image sizing; other renderers can still load the image but may ignore that size. The example uses an existing screenshot of the application.

![Images, captions, and sizing — source and actual rendering](docs/media/syntax-images.jpg)

<details>
<summary>View copyable Markdown source</summary>

<!-- prettier-ignore -->
````markdown
## 图片也是文档的一部分

![白天主题的编辑器界面](./editor-light.jpg "白天主题 · 本项目真实截图 {mn-ratio:0.70}")

图片保留替代文本，并用标题显示说明。

`{mn-ratio:0.70}` 是本项目的尺寸元数据，放在图片标题末尾。

普通 Markdown 阅读器仍可显示原始图片；这个扩展不占用 alt 文本。
````

</details>

> `@` references, backlinks, and AI diff review are host-integrated interactions, not standalone Markdown syntax. See the integration and AI review sections below.

## What works today

| Capability                   | Implementation                                                                                                                    |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Immersive sidebar**        | Top-left expandable menu, saved notes, reading mode, undo/redo, import/export, and a slim footer                                  |
| **Rich Markdown**            | CommonMark/GFM, task lists, tables, footnotes, images, code highlighting, KaTeX, and Mermaid                                      |
| **Knowledge-tool content**   | `[[wiki links]]`, `[TOC]`, `==highlight==`, subscript, superscript, host references and backlinks                                 |
| **Streaming AI**             | Selection or whole-document rewrites, cancellation, retry, partial-output review, accept/reject, and undo                         |
| **External document review** | Host-supplied before/after Markdown, candidate decisions, table annotations, versioned image assets, and read-only history        |
| **File handling**            | Host file adapter, local Markdown autosave, stable note IDs, rename, image upload, and import                                     |
| **Export**                   | Markdown, self-contained HTML with local assets, and browser PDF printing or a host PDF exporter                                  |
| **Preferences**              | Light/dark themes, normal/focus/typewriter modes, outline, spelling, triple-click block source, and Chinese/English editor labels |
| **Reusable modules**         | Framework-independent editor API, complete sidebar API, multi-instance isolation, and typed lifecycle hooks                       |

## Why this project

Use the complete sidebar when your application needs menus, files, and editing together. Use the editor alone when your host already owns navigation. Use the review interface when another agent or service produces a proposed document.

The editor does not own your filesystem or model credentials. `NoteFiles` and `AIProvider` keep those decisions in the host. React is used internally for the footer; a React host is not required.

## Quick start

Requires **Node.js 22.12+** and npm. Local development has been validated on Windows; a full cross-platform/browser matrix is not yet complete.

```sh
git clone https://github.com/Hemistic/milkdown-notes.git
cd milkdown-notes
npm ci
npm run build
npm start
```

Open **http://127.0.0.1:43150/**. Basic editing works without an AI account.

| Local route             | Purpose                                                           |
| ----------------------- | ----------------------------------------------------------------- |
| `/`                     | Local notes application                                           |
| `/example/`             | Independent editor and read-only renderer                         |
| `/example/syntax.html`  | Five Markdown source/rendering samples with light/dark themes     |
| `/example/sidebar.html` | Two embedded sidebars, memory-backed files, and regression checks |
| `/example/ai.html`      | Editor and AI/diff checks using fixed streaming data              |
| `/example/live-ai.html` | Optional real-model checks; running them consumes model quota     |

`npm run dev` builds and starts the server; it does not provide hot reload. Rebuild and refresh after changing source.

Notes live in `.data/notes/*.md`, name metadata in `.md.json` sidecars, and uploaded images in `.data/assets/`. These files and `.env.local` are excluded from Git. Back up both notes and assets.

To choose a different data directory or port in PowerShell:

```powershell
$env:NOTES_DATA_DIR = 'D:\MyNotes'
$env:PORT = '43151'
npm start
```

The server listens only on `127.0.0.1`. It is a local web application that needs a running Node process, not an installer or a cloud service.

## Integrate with your software

Build this repository, then install both local packages in your host project:

```sh
npm install /path/to/milkdown-notes/packages/editor /path/to/milkdown-notes/packages/sidebar
```

```ts
import { mountSidebar, type NoteFiles } from '@local/milkdown-sidebar';
import '@local/milkdown-sidebar/style.css';

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
  preferences: { theme: 'light' },
  aiProvider: (context, signal) => host.ai.stream(context, signal),
  onPreferencesChange: (value) => host.preferences.save(value),
});

await sidebar.open('note-id');
await sidebar.flush();
// When the host unmounts this sidebar:
await sidebar.destroy();
```

`host` is your implementation, not a global supplied by the package. Use HTTP, Electron IPC, Tauri commands, or another host service. The container must be empty and have an explicit height. `write` creates or overwrites a note; renaming preserves its ID. AI and image upload are optional.

For the editor alone:

```ts
import { mountEditor } from '@local/milkdown-notes';
import '@local/milkdown-notes/style.css';

const editor = await mountEditor(element, {
  markdown: '# Hello\n\nStart writing.',
  locale: 'en',
  theme: 'light',
  onChange: (markdown) => host.notes.save(markdown),
});
```

Use `renderMarkdown()` for the same rich renderer in read-only mode. Without a bundler, serve the **whole** `dist` directories, including chunks, fonts, styles, and licenses. See the [sidebar contract](docs/sidebar-integration.md), [editor API](docs/integration.md), and [runnable examples](examples/vanilla).

## AI and document review

In the local app, open **Settings** at the right of the footer. Enter the model, reasoning effort, and API key, then save. Configuration takes effect on the next request. Keys stay in the local Node service; the browser receives only configuration metadata. Available models and parameters depend on your provider account.

A host can supply its own provider:

```ts
type AIProvider = (
  context: { document: string; selection: string; instruction: string },
  signal: AbortSignal,
) => AsyncIterable<string>;
```

Yield incremental Markdown chunks, honor the abort signal, and throw on failure. The UI handles review before saving confirmed changes. The public controller exposes `run`, `abort`, `accept`, `reject`, and `getState` on `sidebar.editor.ai`. OpenAI and Anthropic provider factories are also available through the editor's `/providers` entry.

For proposals generated elsewhere, `mountEditor` accepts `review`, `onReviewChoice`, and `onReviewResult`. The host supplies original/candidate documents and decides how to persist the reviewed result. Selection and scroll state can be transferred with `getViewState()` / `restoreViewState()`; undo history is not serialized. See [external review](docs/external-review.md).

## Development and validation

```sh
npm run typecheck
npm test
npm run build
npm run format:check
```

- **23 Node tests:** storage, HTTP adapters, AI streaming/cancellation/truncation, configuration, statistics, and upstream compatibility.
- **34 editor + 17 sidebar browser checks:** run from the two local regression pages above. They use fixed streams and do not call paid models.
- **Performance checks:** a 200-paragraph document can switch themes ten times without rereading Markdown; a save reads it once; normal mode performs no focus-layout measurement on selection changes. These are operation-count checks, not an overall speed benchmark.
- **Real-model validation:** separately documented in [live AI verification](docs/live-ai-verification.md), including timeouts and retests. External review integration is recorded in [external review](docs/external-review.md).

```text
milkdown-notes/
├── packages/editor/   Rich editor, Markdown schema, AI and document review
├── packages/sidebar/  Menus, footer, preferences, file adapter and export
├── apps/local/        Local Node server and notes application
├── examples/          Browser integration and regression pages
├── tests/             Node regression checks
├── scripts/           Build, pinned Milkdown adapters and license notices
└── docs/              Integration, architecture, provenance and evidence
```

## Current boundaries

- Markdown is normalized on serialization; it is not a byte-for-byte source editor. Image sizing uses a documented title suffix.
- Local persistence is designed for one active editing session. Cloud sync, collaboration, and concurrent-write conflict resolution belong to the host.
- Browser DOM is required. There is no server-side string renderer or native Electron/Tauri packaging included.
- PDF export uses browser printing unless a host supplies a native exporter. Saving a PDF from the embedded browser has not been fully validated.
- Full browser/platform coverage and large-document latency benchmarks remain future work. Supporting technical documents are mostly in Chinese.

## Sources and license status

Extracted from the user's Artinfact 0.13.41 notes implementation, with the snapshot footer adapted separately. Source manifests, upstream adaptations, fonts, and third-party notices are preserved in [attribution](docs/attribution.md), [upstream adapters](docs/upstream-adapters.md), and [licenses](licenses/).

This is a **public source repository**, not a grant of a new project-wide open-source license. Package metadata remains `UNLICENSED` and `private: true` (preventing accidental npm publication). Third-party components retain their own terms. No new MIT/AGPL license is asserted for the extracted application code.

The README presentation follows the companion [ChatGPT Claude Sidebar](https://github.com/Hemistic/chatgpt-claude-sidebar): real interface captures first, followed by capabilities, setup, and host integration. The products are separate projects.
