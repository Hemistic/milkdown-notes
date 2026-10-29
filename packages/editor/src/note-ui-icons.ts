import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Highlighter,
  Subscript,
  Superscript,
  ListTree,
  Workflow,
  Bold,
  Italic,
  Strikethrough,
  Code,
  Link,
  GripVertical,
  GripHorizontal,
  Plus,
  Sigma,
  Check,
  Pencil,
  Trash2,
  Copy,
  Sparkles,
  type IconNode,
} from 'lucide';
const icons = {
  alignLeft: AlignLeft,
  alignCenter: AlignCenter,
  alignRight: AlignRight,
  highlight: Highlighter,
  subscript: Subscript,
  superscript: Superscript,
  toc: ListTree,
  diagram: Workflow,
  bold: Bold,
  italic: Italic,
  strike: Strikethrough,
  code: Code,
  link: Link,
  drag: GripVertical,
  dragColumn: GripHorizontal,
  add: Plus,
  math: Sigma,
  confirm: Check,
  edit: Pencil,
  remove: Trash2,
  copy: Copy,
  ai: Sparkles,
} satisfies Record<string, IconNode>;
export function noteUiIcon(name: keyof typeof icons, label: string) {
  const safe = label.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
  const content = icons[name]
    .map(
      ([tag, attrs]) =>
        `<${tag} ${Object.entries(attrs)
          .map(([key, value]) => `${key}="${String(value)}"`)
          .join(' ')}></${tag}>`,
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="${safe}" data-note-command="${name}"><title>${safe}</title>${content}</svg>`;
}
