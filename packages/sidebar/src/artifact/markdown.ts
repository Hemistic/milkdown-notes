export function countWords(markdown: string): { words: number; chars: number; lines: number } {
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]+`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/[#>*_~`\-|=]/g, ' ')
    .trim();

  const chars = markdown.length;
  const lines = markdown === '' ? 0 : markdown.split('\n').length;
  const cjk = text.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) ?? [];
  const latin = text
    .replace(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  return {
    words: cjk.length + latin.length,
    chars,
    lines,
  };
}
