# Milkdown 7.22.3 兼容适配

来源：Artinfact 0.13.41 的 `scripts/milkdown-slash.mjs`。这些是本项目对官方 Milkdown 实现的局部适配，**不是 Milkdown 官方发布的补丁**。不修改已安装原插件、不修改源项目、不写入任何 node_modules 文件。

构建只接受 `@milkdown/crepe` 和 `@milkdown/components` 的 **7.22.3**。依赖锁定到精确版本。每个文本锚点都核对出现次数，不符合则构建失败；测试覆盖了上游文件改变后的拒绝路径。消费者安装已构建包无需再应用补丁。

| 模块 | 修改与原因 | 验证边界 |
| --- | --- | --- |
| components/code-block | 节点 DOM 保留代码源码/语言快照属性 | 从原快照实现继承，核心只读当前仍用真实代码组件 |
| components/table-block | 相同文档内容时保留节点视图；把单元格点击交还 ProseMirror 文本光标 | 点击、输入、对齐、撤销 |
| components/table-block | 拖放先检查表格范围和拖动预览，刷新节流 hover；capture 监听保证宿主阻断冒泡时仍可收到 | 行/列拖动需真实浏览器验证，不能仅凭构建断言 |
| components/table-block | 打开手柄菜单时取消滞后的 hover；鼠标到手柄时不立即关闭 | 保留官方菜单操作和坐标计算 |
| components/table-block | 拖动预览不可编辑、不可命中指针；拖动期间保留手柄；手柄 mousedown 不交给正文光标处理 | 本次独立浏览器复现并修复第一列向右拖动中断；双向移动、撤销、只读重建通过 |
| components/image-block | 用 clientWidth、元素缩放比例和起始位置换算拖动；按天然宽高比约束尺寸；pointercancel 清理 | 70% transform 容器内拖动，2:1 测试图保持比例 |
| components/image-block | 新增真实 alt 的响应式传递 | 本次提取新增，配合公开 schema 配置保留图片 alt |
| components/image-block | 只读图题输入框设置 readOnly | 实际 DOM 属性已确认；隐藏阅读态操作手柄 |
| crepe/block-edit | 支持 inline slash query 和仅删除触发范围，保留上游菜单与命令 | 斜杠插表、公式插入后退出再触发 |

模块内 `note-table.ts` 使用官方 `CellSelection.colSelection`、`setCellAttr`、`goToNextCell`、`addRowAfter`，在同一事务内恢复原文本光标。列手柄来自 Lucide `GripHorizontal`（横向 3×2），行手柄来自 `GripVertical`。对齐栏固定预留顶部空间，避免焦点引发布局跳动。

模块内 `note-image.ts` 使用 Milkdown 的 schema 配置接口保留 `alt` 与 `caption`。上游把 alt 解释为 ratio，本项目改用 title 中的可选 `{mn-ratio:0.70}` 后缀，比例默认为 1。这个扩展约定需其他宿主明确支持；不自动把旧数字 alt 猜成比例。

升级步骤：先检查上游对应源文件和变更记录，逐个决定适配是否仍需要；更新版本与锚点；构建；复测表格、图片、菜单、撤销和序列化；更新本文与验收记录。不要为了构建通过删除检查，也不要对未测版本扩大兼容声明。
