# 来源、归属与许可证状态

此工程由用户已有的 Artinfact 0.13.41 Milkdown 笔记实现提取，暂用 `milkdown-notes` / `@local/milkdown-notes`。它不是 Milkdown 官方产品。没有选择新的开源许可证，没有公开远程仓库，没有发布软件包。

提取源为 `C:/Users/41448/AppData/Local/Temp/artinfact-0.13.16-work`；已安装插件只作为版本背景，没有修改缓存。`docs/source-manifest.json` 记录原始输入文件的 SHA-256；模块文件经过宿主解耦、命名空间更名和 API 包装，不代表与原文件逐字相同。原报告/截图没有当作新项目的验收证据。

源工程根 `LICENSE` 开头明确写的是 Corporation for Digital Scholarship 的 Zotero pdf-reader AGPLv3 说明。该文件不足以单独确定用户编写的笔记适配代码许可，本仓库仅将其保存在 `licenses/source-root-Zotero-NOT-module-license.txt` 作为来源证据。没有提取 Zotero/PDF Reader 代码，也没有据此对新模块整体选择 AGPL 或 MIT。对来源文件的许可适用范围仍需权利人明确；公开分发前必须解决这个问题。

新项目元数据使用 `private: true`、`license: UNLICENSED`，表示尚未授予新的公开分发许可，不能解释为撤销第三方已有许可或宣称全部代码归本项目独占。

核心上游包括：

| 上游 | 用途 | 已安装包声明 |
| --- | --- | --- |
| Milkdown / Crepe 7.22.3 | 编辑器、UI、schema、交互 | MIT |
| ProseMirror | 编辑状态、历史、表格 | MIT |
| CodeMirror / Lezer | 代码编辑和高亮 | MIT |
| Mermaid 11.12.1 | 官方图表渲染 | MIT |
| KaTeX | 公式与字体 | MIT，字体附带原声明 |
| DOMPurify | HTML 净化 | Apache-2.0 OR MPL-2.0 |
| Lucide | 图标 | ISC |
| unified / remark / micromark | Markdown 处理 | 保留各包原声明 |

精确版本、声明和许可证全文以 `licenses/dependencies.json`、`licenses/third-party/` 为准。构建从 esbuild 的实际依赖图（含懒加载块与 CSS）生成清单并保留 legal comments，复制到包的 `dist/licenses/`。没有根许可文本的包会明确标记，不能把自动清单当作法律审查结论。

`remark-math@6.0.0` 的 npm 包没有携带根 license 文件，已从官方仓库对应 `6.0.0` 标签提交 `d5d0660b150810a535bbb07eac6cc96a4510aa24` 补齐 [原始 MIT 许可](https://raw.githubusercontent.com/remarkjs/remark-math/d5d0660b150810a535bbb07eac6cc96a4510aa24/license)，存于 `licenses/supplemental/remark-math.txt`。没有从第三方转载站猜测许可。

如后续公开分发，先确认自有/来源代码授权范围，再补齐元数据、署名和相应分发义务；用户本轮没有授权公开发布。
