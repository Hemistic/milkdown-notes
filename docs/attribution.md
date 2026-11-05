# 来源、归属与许可证状态

此工程由用户已有的 Artinfact 0.13.41 Milkdown 笔记实现提取，暂用 `milkdown-notes` / `@local/milkdown-notes`。它不是 Milkdown 官方产品。2026-11-05 按项目所有者要求公开到 GitHub；没有选择新的项目整体开源许可证，也没有发布 npm 软件包。

提取源为本机 Artinfact 工作副本；已安装插件只作为版本背景，没有修改缓存。`docs/source-manifest.json` 记录原始输入文件的 SHA-256；模块文件经过宿主解耦、命名空间更名和 API 包装，不代表与原文件逐字相同。原报告/截图没有当作新项目的验收证据。

源工程根 `LICENSE` 开头明确写的是 Corporation for Digital Scholarship 的 Zotero pdf-reader AGPLv3 说明。该文件不足以单独确定用户编写的笔记适配代码许可，本仓库仅将其保存在 `licenses/source-root-Zotero-NOT-module-license.txt` 作为来源证据。没有提取 Zotero/PDF Reader 代码，也没有据此对新模块整体选择 AGPL 或 MIT。来源文件的许可适用范围仍以各自权利声明为准；公开仓库不代表已为这些文件新增统一开源授权。

包元数据保留 `private: true`（阻止意外 npm 发布）、`license: UNLICENSED`（尚未指定项目整体许可）。GitHub 仓库为 Public；这些字段不能解释为撤销第三方已有许可或宣称全部代码归本项目独占。

核心上游包括：

| 上游                         | 用途                     | 已安装包声明          |
| ---------------------------- | ------------------------ | --------------------- |
| Milkdown / Crepe 7.22.3      | 编辑器、UI、schema、交互 | MIT                   |
| ProseMirror                  | 编辑状态、历史、表格     | MIT                   |
| CodeMirror / Lezer           | 代码编辑和高亮           | MIT                   |
| Mermaid 11.12.1              | 官方图表渲染             | MIT                   |
| KaTeX                        | 公式与字体               | MIT，字体附带原声明   |
| DOMPurify                    | HTML 净化                | Apache-2.0 OR MPL-2.0 |
| Lucide                       | 图标                     | ISC                   |
| unified / remark / micromark | Markdown 处理            | 保留各包原声明        |

精确版本、声明和许可证全文以 `licenses/dependencies.json`、`licenses/third-party/` 为准。构建从 esbuild 的实际依赖图（含懒加载块与 CSS）生成清单并保留 legal comments，复制到包的 `dist/licenses/`。没有根许可文本的包会明确标记，不能把自动清单当作法律审查结论。

`remark-math@6.0.0` 的 npm 包没有携带根 license 文件，已从官方仓库对应 `6.0.0` 标签提交 `d5d0660b150810a535bbb07eac6cc96a4510aa24` 补齐 [原始 MIT 许可](https://raw.githubusercontent.com/remarkjs/remark-math/d5d0660b150810a535bbb07eac6cc96a4510aa24/license)，存于 `licenses/supplemental/remark-math.txt`。没有从第三方转载站猜测许可。

公开仓库：https://github.com/Hemistic/milkdown-notes 。第三方署名与许可文本随源码保留；如后续选择项目整体许可，应单独明确来源代码的授权范围。
