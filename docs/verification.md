# 独立模块验收记录

日期：2026-10-23（Asia/Shanghai）。环境：Windows、Node 24.13.0、npm 11.6.2、Codex 内置 Chromium 浏览器。验收目标为本仓库的新服务 `127.0.0.1:43150`，不是原 `43137` 测试页或 `43140` Artinfact 预览。

## 实际浏览器操作

| 能力 | 本轮结果与具体证据 |
| --- | --- |
| 挂载 / 销毁 / 重挂 | 集成页点击 Destroy、Mount；正文恢复。销毁时菜单 portal 数量为 0；只读第二实例仍可显示 |
| Markdown 读写 / 通知 | textarea → Set Markdown → 编辑器；实际按键、表格操作 → textarea 规范化 Markdown；变化计数递增 |
| 撤销 / 重做 | 表格对齐 Ctrl+Z；列拖动 Ctrl+Z；图片缩放 Undo 恢复 title 中无比例元数据。公开 redo 与历史插件保留，未逐项复测每种操作的 redo |
| 编辑 / 只读一致 | 同屏显示同源表格、图片、HTML、代码、公式、高亮、脚注；图片两侧均为 221.50 × 110.75 CSS px；没有另建 Markdown 渲染器 |
| 标题 / 列表 / 任务 / 引用 / 链接 | 欢迎文档实际渲染；H1 快捷输入生成笔记标题；选文加粗写回 Markdown。列表项目的完整键盘组合不作为已覆盖范围 |
| 脚注 | 引用和 definition list 均显示，导出的 `[^a]` 与定义保留 |
| 高亮 / 上下标 / 双链 / 目录 | 欢迎文档渲染正确；集成页高亮序列化保留；目录点击可定位标题；本地双链导航使用可替换回调 |
| Mermaid | 官方 11.12.1 真正生成 SVG；节点与连线实际可见。使用固定 neutral 图表主题及浅色画布，编辑器外框支持明暗主题 |
| 公式 | 斜杠菜单插入公式块，输入 `a^2+b^2=c^2`，Esc 退出后再次输入 `/`，菜单出现并成功插入表格 |
| HTML 与代码 | 正文 kbd / span 正常显示；onclick 属性在预览 DOM 中为 0；HTML fenced block 只有源码、html 语言标签和高亮，没有可执行按钮；原 Markdown HTML 源码仍保留 |
| 表格键盘 | 点击单元格输入；Tab 到下一格；末格 Tab 新增一行并继续输入。未穷举跨表格 Shift+Tab 的边界 |
| 表格对齐 | 点击单元格出现整列左/中/右栏；右对齐后 Ctrl+Z；居中写回 `:---:` 并在只读/本地重载中保持 |
| 表格手柄 / 拖动 | 列为 Lucide GripHorizontal 横向 3×2 点，行为 GripVertical。真实拖动行；第二列向左、第一列向右均改变 Markdown 列序；撤销及只读重建确认 |
| 图片 | 本地相对 URL 加载；真实在 70% transform 容器拖动；310×155 变为约 217.57×108.78 CSS px，保持 2:1。alt、caption、比例元数据可序列化和重建 |
| 只读图片 | 图题 input.readOnly=true，阅读态隐藏缩放/操作控件 |
| 浮动加号 / 块拖动 | 点击加号打开上游菜单；第一段拖到第三段后面，Markdown 顺序改变。正文左右 padding 均为 28px；18px 手柄在 host 左内沿 +5px，未越界 |
| 选文工具栏 | 真实选择 Second paragraph，出现格式栏，点击 Bold 后序列化为 `**Second paragraph.**` |
| 本地持久保存 | 新建“独立模块验收”，斜杠菜单插表、Tab 输入、整列居中，阅读模式后重载并重新打开；内容与对齐保留。另直接回读 `.data/notes/*.md` 确认磁盘文件 |
| 语言 / 主题 | 本地中文编辑，集成页英文编辑可并存；本地深色主题实际查看；可切回浅色 |

截图均来自新项目，位于 `docs/evidence/`：

- `integration-readonly.jpg`：表格居中、公式、高亮与 Markdown 源码。
- `table-drag.jpg`：列移动与撤销后的读写一致。
- `image-scaled.jpg`：70% 容器内的图片调整与比例元数据。
- `roundtrip-html-images.jpg`：最终构建的表格、相同尺寸图片、HTML、代码高亮和脚注。
- `local-saved-dark.jpg`：重载后保存的本地笔记，深色主题。
- `local-overview.jpg`、`local-extensions.jpg`：独立应用整体和扩展区。

## 安装与工程检查

- `npm run build`：通过；ESM + 懒加载 chunks + CSS + KaTeX 字体 + TypeScript 声明 + 235 项实际打包依赖的许可。
- `npm run typecheck`：通过。
- `npm test`：3/3 通过；持久存储重开、路径穿越拒绝、图片资源存储、适配锚点失效拒绝（前两项同一存储测试）。没有几百项镜像实现的形式测试。
- `npm pack`：仅生成被 Git 忽略的本地 tgz，没有 publish。
- 仓库外空项目安装 tgz：成功；`skipLibCheck:false` 严格 tsc 通过；包含 CSS 与动态资源的 esbuild 消费者构建通过。
- 首轮消费者验证发现 CSS 导入缺少声明，已新增 `style.css.d.ts` 与 export types，再安装复测通过。
- 没有修改来源 Artinfact、已安装插件缓存或 Claudian 产品源码；原始输入 SHA-256 清单保留。

## 本轮实际修复

1. 解除白板根元素、资源协议和引用导航耦合；用同一托管只读实例取代白板专用快照调度。
2. 修正 `setMarkdown` 对初始字符串的陈旧比较，允许宿主替换当前文档。
3. 图片 alt 与缩放比例分离；只读图题真正不可编辑。
4. 表格拖动预览设为不可编辑且不接收指针，修复第一列向右拖动被打断；拖动期间防止 hover/leave 隐藏手柄。
5. 英文/中文配置按实例生效，菜单 portal 跟随宿主主题；补齐 CSS 类型声明。

## 仍有限制

- 本轮浏览器覆盖 Chromium；未宣称 Safari、Firefox、移动端触摸和所有 IME 组合均通过。
- AIProvider 接口保留且可选；没有配置真实 AI 服务，因此没有进行模型网络端到端验收。
- 文件导入/导出按钮已实现，Markdown API 往返与文件服务已验证；浏览器文件选择器、下载权限弹窗和各种 OS 文件交互未逐一验收。Markdown 导出不打包图片。
- 单活动编辑会话；不含多人协作、同文件并发合并、外部文件变更监听、云同步、桌面安装器或大文档性能基准。
- 图片比例使用 `{mn-ratio:...}` 标题后缀，其他 Markdown 工具不一定理解；旧 Artinfact 数字 alt 需显式迁移。
- Markdown 保存会规范化空白、表格宽度与标记形式；不保证源文件逐字节不变。
- 模块新分发许可未定，保持 private / UNLICENSED；本轮没有公开发布。
