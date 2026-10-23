export const welcome=`# 让想法留在本地

这是一个独立运行的 Markdown 笔记工作台。点击正文开始编辑，输入 **/** 插入内容。修改会自动保存到本机 Markdown 文件。

[TOC]

## 编辑与表达

支持 **加粗**、*斜体*、~~删除线~~、==高亮==、H~2~O 和 x^2^。选中文字可打开格式工具栏。

- 普通列表
- [x] 模块与宿主分离
- [ ] 写下今天的想法

> 工具应该帮助思考，让文档保持开放。

链接到 [[集成指南|另一篇笔记]]，也可以插入 [普通链接](https://milkdown.dev)。脚注同样保留。[^local]

## 表格

| 能力 | 状态 | 说明 |
| :--- | :---: | ---: |
| Markdown | 本地保存 | 开放格式 |
| 编辑器 | 可集成 | 无框架绑定 |

## 数学与图表

行内公式 $E=mc^2$，点击公式直接编辑，按 Esc 返回正文。

$$
\\int_0^1 x^2\\,dx=\\frac{1}{3}
$$

\`\`\`mermaid
graph LR
  A[Markdown] --> B[Editor]
  B --> C[Local files]
  B --> D[Your application]
\`\`\`

## 代码与 HTML

\`\`\`typescript
const editor = await mountEditor(element, {
  markdown: '# Hello',
  onChange: markdown => save(markdown),
});
\`\`\`

正文 HTML：<kbd>Ctrl</kbd> + <kbd>Z</kbd> 撤销。<u>下划线</u>正常渲染。

\`\`\`html
<button onclick="alert('never runs')">源码，不执行</button>
\`\`\`

[^local]: 数据位于项目的 .data/notes 文件夹；可随时导出 Markdown。
`;
