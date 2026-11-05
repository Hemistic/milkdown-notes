import { renderMarkdown } from '/editor/index.js';

const samples = [
  ['basics', '01 基础排版', '标题、强调、引用、嵌套列表、任务、链接、分隔线与脚注。'],
  ['tables-code', '02 表格与代码', 'GFM 对齐表格与带语言标记的代码块。'],
  ['math-diagrams', '03 公式与图表', 'KaTeX 行内／块级公式与 Mermaid 流程图。'],
  ['extensions', '04 特色语法', '自动目录、双链、高亮、上下标与正文 HTML。双链点击交给宿主处理。'],
  ['images', '05 图片与尺寸', '标准图片、标题／说明，以及保留 alt 文本的图片尺寸扩展。'],
];
const source = document.getElementById('source');
const status = document.getElementById('status');
const themeButton = document.getElementById('theme');
const renderButton = document.getElementById('render');
const nav = document.querySelector('nav');
let reader;
let theme = 'light';

async function render() {
  renderButton.disabled = true;
  status.textContent = '正在渲染…';
  try {
    if (reader) reader.setMarkdown(source.value);
    else
      reader = await renderMarkdown(document.getElementById('reader'), source.value, {
        locale: 'zh-CN',
        resolveAsset: (url) => new URL(url, new URL('./syntax/', location.href)).href,
        theme,
        onWikiLink: (target) => {
          status.textContent = `宿主收到导航请求：${target}`;
        },
      });
    await reader.settled();
    status.textContent = '预览已更新';
    themeButton.disabled = false;
  } catch (error) {
    status.textContent = `渲染失败：${error.message}`;
  } finally {
    renderButton.disabled = false;
  }
}

async function selectSample(sample) {
  for (const button of nav.children) button.disabled = true;
  try {
    const response = await fetch(`./syntax/${sample[0]}.md`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    source.value = await response.text();
    document.getElementById('description').textContent = sample[2];
    for (const button of nav.children)
      button.setAttribute('aria-pressed', String(button.dataset.sample === sample[0]));
    history.replaceState(null, '', `#${sample[0]}`);
    await render();
  } catch (error) {
    status.textContent = `示例加载失败：${error.message}`;
  } finally {
    for (const button of nav.children) button.disabled = false;
  }
}

for (const sample of samples) {
  const button = document.createElement('button');
  button.textContent = sample[1];
  button.dataset.sample = sample[0];
  button.setAttribute('aria-pressed', 'false');
  button.onclick = () => selectSample(sample);
  nav.append(button);
}
renderButton.onclick = render;
themeButton.onclick = () => {
  theme = theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
  reader.setTheme(theme);
  themeButton.textContent = theme === 'light' ? '切换黑夜' : '切换白天';
};
await selectSample(samples.find(([id]) => id === location.hash.slice(1)) ?? samples[0]);
