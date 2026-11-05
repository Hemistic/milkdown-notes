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
